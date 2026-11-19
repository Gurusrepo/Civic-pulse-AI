import { db } from '../../config/database.js';
import * as objectStorage from '../../services/objectStorage.js';
import { notifyDisputingReporters, notifyIssueReporters } from '../notifications/notification.service.js';

export class DisputeReviewError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

export function createDisputeReviewService(storage = objectStorage) {
  function listDisputes({ limit, offset }) {
    const rows = db.prepare(`SELECT i.id,i.status,i.updated_at,
        (SELECT COUNT(*) FROM civic_issue_resolution_verifications v WHERE v.civic_issue_id=i.id AND v.decision='DISPUTE') AS dispute_count,
        (SELECT COUNT(*) FROM civic_issue_resolution_verifications v WHERE v.civic_issue_id=i.id AND v.decision='CONFIRM') AS confirmation_count,
        (SELECT MAX(v.created_at) FROM civic_issue_resolution_verifications v WHERE v.civic_issue_id=i.id AND v.decision='DISPUTE') AS latest_dispute_at
      FROM civic_issues i
      WHERE i.status='RESOLVED' AND i.merged_into_issue_id IS NULL
        AND EXISTS (SELECT 1 FROM civic_issue_resolution_verifications v WHERE v.civic_issue_id=i.id AND v.decision='DISPUTE')
        AND NOT EXISTS (SELECT 1 FROM civic_issue_dispute_reviews r WHERE r.civic_issue_id=i.id)
      ORDER BY latest_dispute_at DESC,i.id DESC LIMIT ? OFFSET ?`).all(limit + 1, offset);
    const hasMore = rows.length > limit;
    return { items: rows.slice(0, limit).map(row => ({ issueId: row.id, status: row.status,
      disputeCount: row.dispute_count, confirmationCount: row.confirmation_count,
      latestDisputeAt: row.latest_dispute_at, updatedAt: row.updated_at })),
      pagination: { limit, offset, hasMore } };
  }

  async function getDispute(issueId) {
    const issue = db.prepare(`SELECT i.id,i.status,i.routing_department,i.assigned_team_id,t.name AS team_name,
        w.code AS ward_code,w.name AS ward_name,
        (SELECT COUNT(*) FROM complaints c WHERE c.civic_issue_id=i.id) AS report_count
      FROM civic_issues i LEFT JOIN ward_teams t ON t.id=i.assigned_team_id
      LEFT JOIN wards w ON w.id=t.ward_id WHERE i.id=? AND i.merged_into_issue_id IS NULL`).get(issueId);
    if (!issue) return null;
    const disputes = db.prepare(`SELECT reason,created_at FROM civic_issue_resolution_verifications
      WHERE civic_issue_id=? AND decision='DISPUTE' ORDER BY created_at,id`).all(issueId)
      .map(row => ({ reason: row.reason, submittedAt: row.created_at }));
    if (!disputes.length) return null;
    const confirmations = db.prepare(`SELECT COUNT(*) AS count FROM civic_issue_resolution_verifications
      WHERE civic_issue_id=? AND decision='CONFIRM'`).get(issueId).count;
    const evidenceRows = db.prepare(`SELECT id,stage,mime_type,byte_size,object_key,created_at
      FROM civic_issue_repair_evidence WHERE civic_issue_id=? ORDER BY created_at,id`).all(issueId);
    const evidence = await Promise.all(evidenceRows.map(async row => ({ id: row.id, stage: row.stage,
      mimeType: row.mime_type, byteSize: row.byte_size, createdAt: row.created_at,
      url: await storage.createRepairEvidenceReadUrl(row.object_key, row.mime_type) })));
    const workHistory = db.prepare(`SELECT e.id,e.event_type,e.team_id,t.name AS team_name,
        e.officer_user_id,u.display_name AS officer_name,e.status_before,e.status_after,e.created_at
      FROM civic_issue_work_events e JOIN users u ON u.id=e.officer_user_id
      JOIN ward_teams t ON t.id=e.team_id WHERE e.civic_issue_id=? ORDER BY e.created_at,e.id`).all(issueId)
      .map(row => ({ id: row.id, eventType: row.event_type, team: { id: row.team_id, name: row.team_name },
        officer: { id: row.officer_user_id, name: row.officer_name }, statusBefore: row.status_before,
        statusAfter: row.status_after, createdAt: row.created_at }));
    const review = db.prepare(`SELECT decision,reason,status_before,status_after,reviewed_at
      FROM civic_issue_dispute_reviews WHERE civic_issue_id=?`).get(issueId);
    return { issue: { id: issue.id, status: issue.status, department: issue.routing_department,
      currentTeam: issue.assigned_team_id === null ? null : { id: issue.assigned_team_id, name: issue.team_name },
      ward: issue.ward_code === null ? null : { code: issue.ward_code, name: issue.ward_name },
      reportCount: issue.report_count }, disputes, confirmationCount: confirmations, evidence, workHistory,
      review: review ? { decision: review.decision, reason: review.reason,
        statusBefore: review.status_before, statusAfter: review.status_after, reviewedAt: review.reviewed_at } : null };
  }

  const reviewTx = db.transaction((issueId, adminId, decision, reason) => {
    if (!db.prepare("SELECT 1 FROM users WHERE id=? AND role='ADMIN'").get(adminId)) {
      throw new DisputeReviewError('Admin authorization is required', 403);
    }
    const issue = db.prepare(`SELECT id,status,merged_into_issue_id,assigned_team_id,routing_department,assigned_officer_id
      FROM civic_issues WHERE id=?`).get(issueId);
    if (!issue) throw new DisputeReviewError('Civic issue not found', 404);
    if (issue.status !== 'RESOLVED' || issue.merged_into_issue_id !== null) {
      throw new DisputeReviewError('Only active RESOLVED issues can be reviewed', 409);
    }
    if (!db.prepare(`SELECT 1 FROM civic_issue_resolution_verifications WHERE civic_issue_id=? AND decision='DISPUTE' LIMIT 1`).get(issueId)) {
      throw new DisputeReviewError('No dispute exists for this civic issue', 409);
    }
    if (db.prepare('SELECT 1 FROM civic_issue_dispute_reviews WHERE civic_issue_id=?').get(issueId)) {
      throw new DisputeReviewError('This issue has already received a final review', 409);
    }
    if (issue.assigned_team_id !== null && issue.assigned_officer_id !== null) {
      throw new DisputeReviewError('Issue has conflicting team and individual assignments');
    }

    let teamEventId = null;
    let officerEventId = null;
    const statusAfter = decision === 'ACCEPT' ? 'OPEN' : 'RESOLVED';
    if (decision === 'ACCEPT') {
      if (issue.assigned_team_id !== null && !issue.routing_department) {
        throw new DisputeReviewError('Assigned team has no routing department');
      }
      const update = db.prepare(`UPDATE civic_issues SET status='OPEN',assigned_team_id=NULL,
          routing_department=NULL,assigned_officer_id=NULL,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id=? AND status='RESOLVED' AND merged_into_issue_id IS NULL
          AND assigned_team_id IS ? AND assigned_officer_id IS ?`)
        .run(issueId, issue.assigned_team_id, issue.assigned_officer_id);
      if (update.changes !== 1) throw new DisputeReviewError('Issue state changed; refresh and retry');
      if (issue.assigned_team_id !== null) {
        teamEventId = Number(db.prepare(`INSERT INTO civic_issue_team_assignment_events
          (civic_issue_id,event_type,previous_team_id,team_id,approved_department,admin_user_id)
          VALUES(?,'UNASSIGNED',?,NULL,?,?)`).run(issueId, issue.assigned_team_id, issue.routing_department, adminId).lastInsertRowid);
      }
      if (issue.assigned_officer_id !== null) {
        officerEventId = Number(db.prepare(`INSERT INTO civic_issue_assignment_events
          (civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
          VALUES(?,'UNASSIGNED',?,NULL,?)`).run(issueId, issue.assigned_officer_id, adminId).lastInsertRowid);
      }
    }

    const inserted = db.prepare(`INSERT INTO civic_issue_dispute_reviews
      (civic_issue_id,decision,reason,admin_user_id,previous_team_id,previous_officer_id,
       unassigned_team_event_id,unassigned_officer_event_id,status_before,status_after)
      VALUES(?,?,?,?,?,?,?,?, 'RESOLVED',?)`).run(issueId,
      decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', reason, adminId,
      issue.assigned_team_id, issue.assigned_officer_id, teamEventId, officerEventId, statusAfter);
    const reviewed = db.prepare('SELECT reviewed_at FROM civic_issue_dispute_reviews WHERE id=?').get(Number(inserted.lastInsertRowid));
    const notification = {
      eventKey: `issue:${issueId}:dispute-review:${Number(inserted.lastInsertRowid)}`,
      notificationType: 'DISPUTE_REVIEWED',
      title: decision === 'ACCEPT' ? 'Your dispute was accepted' : 'Your dispute was rejected',
      message: decision === 'ACCEPT'
        ? 'An admin accepted your resolution dispute. The civic issue has been reopened for further work.'
        : 'An admin reviewed and rejected your resolution dispute. The civic issue remains resolved.'
    };
    if (decision === 'ACCEPT') notifyIssueReporters(issueId, notification);
    else notifyDisputingReporters(issueId, notification);
    return { id: Number(inserted.lastInsertRowid), issueId,
      decision: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', issueStatus: statusAfter,
      teamUnassignmentEventId: teamEventId, individualUnassignmentEventId: officerEventId,
      reviewedAt: reviewed.reviewed_at };
  });

  function reviewDispute(issueId, adminId, { decision, reason }) {
    try { return reviewTx.immediate(issueId, adminId, decision, reason); }
    catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new DisputeReviewError('This issue has already received a final review', 409);
      }
      throw error;
    }
  }

  return { listDisputes, getDispute, reviewDispute };
}
