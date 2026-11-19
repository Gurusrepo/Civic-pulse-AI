import { db } from '../../config/database.js';
import * as objectStorage from '../../services/objectStorage.js';
import { notifyIssueReporters } from '../notifications/notification.service.js';

export class OfficerWorkflowError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

const currentAccess = db.prepare(`
  SELECT i.id,i.status,i.merged_into_issue_id,i.assigned_team_id,t.name AS team_name,t.department,
         w.id AS ward_id,w.name AS ward_name,w.code AS ward_code,
         a.id AS assignment_event_id,a.created_at AS assigned_at
  FROM civic_issues i
  JOIN ward_teams t ON t.id=i.assigned_team_id AND t.is_active=1
  JOIN wards w ON w.id=t.ward_id AND w.is_active=1
  JOIN ward_team_memberships m ON m.team_id=t.id AND m.officer_user_id=? AND m.removed_at IS NULL
  JOIN users u ON u.id=m.officer_user_id AND u.role='OFFICER'
  JOIN civic_issue_team_assignment_events a ON a.id=(
    SELECT latest.id FROM civic_issue_team_assignment_events latest
    WHERE latest.civic_issue_id=i.id ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1
  ) AND a.team_id=i.assigned_team_id AND a.event_type IN ('ASSIGNED','REASSIGNED')
  WHERE i.id=? AND i.status<>'MERGED' AND i.merged_into_issue_id IS NULL
`);

function requireAccess(issueId, officerId) {
  const access = currentAccess.get(officerId, issueId);
  if (!access) throw new OfficerWorkflowError('Civic issue not found', 404);
  return access;
}

const insertWorkEvent = db.prepare(`INSERT INTO civic_issue_work_events
  (civic_issue_id,event_type,team_id,assignment_event_id,officer_user_id,evidence_id,status_before,status_after)
  VALUES(@issueId,@eventType,@teamId,@assignmentEventId,@officerId,@evidenceId,@statusBefore,@statusAfter)`);

const startTx = db.transaction((issueId, officerId) => {
  const access = requireAccess(issueId, officerId);
  if (access.status !== 'OPEN') throw new OfficerWorkflowError('Only OPEN issues can be started');
  const update = db.prepare(`UPDATE civic_issues SET status='IN_PROGRESS',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id=? AND status='OPEN' AND assigned_team_id=? AND merged_into_issue_id IS NULL`).run(issueId, access.assigned_team_id);
  if (update.changes !== 1) throw new OfficerWorkflowError('Issue state changed; refresh and retry');
  const event = insertWorkEvent.run({ issueId, eventType: 'STARTED', teamId: access.assigned_team_id,
    assignmentEventId: access.assignment_event_id, officerId, evidenceId: null,
    statusBefore: 'OPEN', statusAfter: 'IN_PROGRESS' });
  return { id: Number(event.lastInsertRowid), civicIssueId: issueId, eventType: 'STARTED', status: 'IN_PROGRESS' };
});

const completeTx = db.transaction((issueId, officerId) => {
  const access = requireAccess(issueId, officerId);
  if (access.status !== 'IN_PROGRESS') throw new OfficerWorkflowError('Only IN_PROGRESS issues can be completed');
  const counts = db.prepare(`SELECT stage,COUNT(*) AS count FROM civic_issue_repair_evidence
    WHERE civic_issue_id=? AND team_id=? AND assignment_event_id=? GROUP BY stage`)
    .all(issueId, access.assigned_team_id, access.assignment_event_id);
  const byStage = Object.fromEntries(counts.map(row => [row.stage, row.count]));
  if (!byStage.BEFORE || !byStage.AFTER) throw new OfficerWorkflowError('At least one BEFORE and one AFTER evidence photo are required');
  const update = db.prepare(`UPDATE civic_issues SET status='RESOLVED',updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id=? AND status='IN_PROGRESS' AND assigned_team_id=? AND merged_into_issue_id IS NULL`)
    .run(issueId, access.assigned_team_id);
  if (update.changes !== 1) throw new OfficerWorkflowError('Issue state changed; refresh and retry');
  const event = insertWorkEvent.run({ issueId, eventType: 'COMPLETED', teamId: access.assigned_team_id,
    assignmentEventId: access.assignment_event_id, officerId, evidenceId: null,
    statusBefore: 'IN_PROGRESS', statusAfter: 'RESOLVED' });
  notifyIssueReporters(issueId, {
    eventKey: `issue:${issueId}:work:${Number(event.lastInsertRowid)}`,
    notificationType: 'ISSUE_RESOLVED',
    title: 'Your complaint has been resolved',
    message: 'A civic issue you reported has been marked resolved. Review the repair evidence and respond from your complaint details.'
  });
  return { id: Number(event.lastInsertRowid), civicIssueId: issueId, eventType: 'COMPLETED', status: 'RESOLVED' };
});

export function createOfficerService(storage = objectStorage) {
  function listIssues(officerId, { limit, offset, status }) {
    const filters = ["i.status<>'MERGED'", 'i.merged_into_issue_id IS NULL'];
    const params = [officerId];
    if (status) { filters.push('i.status=?'); params.push(status); }
    params.push(limit + 1, offset);
    const rows = db.prepare(`SELECT i.id,i.status,i.routing_department,i.created_at,i.updated_at,
        t.name AS team_name,w.code AS ward_code,w.name AS ward_name,
        (SELECT COUNT(*) FROM complaints c WHERE c.civic_issue_id=i.id) AS report_count
      FROM civic_issues i JOIN ward_teams t ON t.id=i.assigned_team_id AND t.is_active=1
      JOIN wards w ON w.id=t.ward_id AND w.is_active=1
      JOIN ward_team_memberships m ON m.team_id=t.id AND m.officer_user_id=? AND m.removed_at IS NULL
      JOIN users u ON u.id=m.officer_user_id AND u.role='OFFICER'
      WHERE ${filters.join(' AND ')} ORDER BY i.updated_at DESC,i.id DESC LIMIT ? OFFSET ?`).all(...params);
    const hasMore = rows.length > limit;
    return { items: rows.slice(0, limit).map(row => ({ id: row.id, status: row.status,
      department: row.routing_department, teamName: row.team_name, ward: { code: row.ward_code, name: row.ward_name },
      reportCount: row.report_count, createdAt: row.created_at, updatedAt: row.updated_at })),
      pagination: { limit, offset, hasMore } };
  }

  function getIssue(issueId, officerId) {
    const row = requireAccess(issueId, officerId);
    const evidence = db.prepare(`SELECT id,stage,mime_type,byte_size,created_at FROM civic_issue_repair_evidence
      WHERE civic_issue_id=? ORDER BY created_at,id`).all(issueId).map(item => ({ id: item.id, stage: item.stage,
        mimeType: item.mime_type, byteSize: item.byte_size, createdAt: item.created_at }));
    const history = db.prepare(`SELECT id,event_type,status_before,status_after,created_at FROM civic_issue_work_events
      WHERE civic_issue_id=? ORDER BY created_at,id`).all(issueId).map(event => ({ id: event.id,
        eventType: event.event_type, statusBefore: event.status_before, statusAfter: event.status_after, createdAt: event.created_at }));
    return { id: row.id, status: row.status, department: row.department, team: { id: row.assigned_team_id, name: row.team_name },
      ward: { id: row.ward_id, code: row.ward_code, name: row.ward_name }, evidence, workHistory: history };
  }

  async function uploadEvidence(issueId, officerId, stage, file) {
    const beforeUpload = requireAccess(issueId, officerId);
    validateEvidenceStage(beforeUpload, stage);
    const objectKey = await storage.uploadRepairEvidenceImage({ buffer: file.buffer, size: file.size, mimeType: file.verifiedMimeType });
    try {
      return recordEvidenceTx.immediate(issueId, officerId, stage, file, objectKey);
    } catch (error) {
      try { await storage.deleteRepairEvidenceObject(objectKey); }
      catch { console.error('Repair evidence rollback cleanup failed'); }
      throw error;
    }
  }

  const recordEvidenceTx = db.transaction((issueId, officerId, stage, file, objectKey) => {
    const access = requireAccess(issueId, officerId);
    validateEvidenceStage(access, stage);
    const result = db.prepare(`INSERT INTO civic_issue_repair_evidence
      (civic_issue_id,team_id,assignment_event_id,uploaded_by_officer_id,stage,object_key,mime_type,byte_size)
      VALUES(?,?,?,?,?,?,?,?)`).run(issueId, access.assigned_team_id, access.assignment_event_id,
      officerId, stage, objectKey, file.verifiedMimeType, file.size);
    const evidenceId = Number(result.lastInsertRowid);
    const event = insertWorkEvent.run({ issueId, eventType: 'EVIDENCE_UPLOADED', teamId: access.assigned_team_id,
      assignmentEventId: access.assignment_event_id, officerId, evidenceId,
      statusBefore: access.status, statusAfter: access.status });
    return { id: evidenceId, civicIssueId: issueId, stage, mimeType: file.verifiedMimeType,
      byteSize: file.size, eventId: Number(event.lastInsertRowid) };
  });

  function validateEvidenceStage(access, stage) {
    if (!['BEFORE', 'AFTER'].includes(stage)) throw new OfficerWorkflowError('Evidence stage must be BEFORE or AFTER', 400);
    if (stage === 'BEFORE' && !['OPEN', 'IN_PROGRESS'].includes(access.status)) throw new OfficerWorkflowError('BEFORE evidence can only be added to OPEN or IN_PROGRESS issues');
    if (stage === 'AFTER' && access.status !== 'IN_PROGRESS') throw new OfficerWorkflowError('AFTER evidence can only be added to IN_PROGRESS issues');
  }

  async function listEvidence(issueId, officerId) {
    requireAccess(issueId, officerId);
    const rows = db.prepare(`SELECT id,stage,mime_type,byte_size,object_key,created_at FROM civic_issue_repair_evidence
      WHERE civic_issue_id=? ORDER BY created_at,id`).all(issueId);
    return Promise.all(rows.map(async row => ({ id: row.id, stage: row.stage, mimeType: row.mime_type,
      byteSize: row.byte_size, createdAt: row.created_at,
      url: await storage.createRepairEvidenceReadUrl(row.object_key, row.mime_type) })));
  }

  return { listIssues, getIssue, startWork: (issueId, officerId) => startTx.immediate(issueId, officerId),
    uploadEvidence, listEvidence, completeWork: (issueId, officerId) => completeTx.immediate(issueId, officerId) };
}
