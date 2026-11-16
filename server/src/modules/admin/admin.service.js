import { db } from '../../config/database.js';

export class AdminIssueError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const selectIssueBase = db.prepare(`
  SELECT i.id, i.status, i.merged_into_issue_id, i.assigned_officer_id,
         i.created_at, i.updated_at,
         officer.display_name AS officer_name,
         (SELECT e.created_at FROM civic_issue_assignment_events e
          WHERE e.civic_issue_id = i.id AND e.officer_id = i.assigned_officer_id
            AND e.event_type IN ('ASSIGNED', 'REASSIGNED')
          ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS assigned_at,
         (SELECT COUNT(*) FROM complaints c WHERE c.civic_issue_id = i.id) AS report_count
  FROM civic_issues i
  LEFT JOIN users officer ON officer.id = i.assigned_officer_id
  WHERE i.id = ?
`);

const countByCategory = db.prepare(`
  WITH latest_success AS (
    SELECT a.* FROM complaint_ai_assessments a
    WHERE a.status = 'SUCCEEDED' AND a.id = (
      SELECT candidate.id FROM complaint_ai_assessments candidate
      WHERE candidate.complaint_id = a.complaint_id AND candidate.status = 'SUCCEEDED'
      ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 1
    )
  )
  SELECT a.category AS value, COUNT(*) AS count
  FROM complaints c JOIN latest_success a ON a.complaint_id = c.id
  WHERE c.civic_issue_id = ? AND a.category IS NOT NULL
  GROUP BY a.category ORDER BY count DESC, value
`);
const countAssessedReports = db.prepare(`
  WITH latest_success AS (
    SELECT a.* FROM complaint_ai_assessments a
    WHERE a.status = 'SUCCEEDED' AND a.id = (
      SELECT candidate.id FROM complaint_ai_assessments candidate
      WHERE candidate.complaint_id = a.complaint_id AND candidate.status = 'SUCCEEDED'
      ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 1
    )
  )
  SELECT COUNT(*) AS count
  FROM complaints c JOIN latest_success a ON a.complaint_id = c.id
  WHERE c.civic_issue_id = ?
`);
const countByDepartment = db.prepare(`
  WITH latest_success AS (
    SELECT a.* FROM complaint_ai_assessments a
    WHERE a.status = 'SUCCEEDED' AND a.id = (
      SELECT candidate.id FROM complaint_ai_assessments candidate
      WHERE candidate.complaint_id = a.complaint_id AND candidate.status = 'SUCCEEDED'
      ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 1
    )
  )
  SELECT a.department AS value, COUNT(*) AS count
  FROM complaints c JOIN latest_success a ON a.complaint_id = c.id
  WHERE c.civic_issue_id = ? AND a.department IS NOT NULL
  GROUP BY a.department ORDER BY count DESC, value
`);
const countBySeverity = db.prepare(`
  WITH latest_success AS (
    SELECT a.* FROM complaint_ai_assessments a
    WHERE a.status = 'SUCCEEDED' AND a.id = (
      SELECT candidate.id FROM complaint_ai_assessments candidate
      WHERE candidate.complaint_id = a.complaint_id AND candidate.status = 'SUCCEEDED'
      ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 1
    )
  )
  SELECT a.severity AS value, COUNT(*) AS count
  FROM complaints c JOIN latest_success a ON a.complaint_id = c.id
  WHERE c.civic_issue_id = ? AND a.severity IS NOT NULL
  GROUP BY a.severity ORDER BY count DESC, value
`);
const latestSuccessfulAssessment = db.prepare(`
  SELECT a.complaint_id, a.category, a.department, a.severity, a.confidence,
         a.human_review_required, a.created_at
  FROM complaints c JOIN complaint_ai_assessments a ON a.complaint_id = c.id
  WHERE c.civic_issue_id = ? AND a.status = 'SUCCEEDED'
  ORDER BY a.created_at DESC, a.id DESC LIMIT 1
`);
const countReviewed = db.prepare(`
  WITH latest_success AS (
    SELECT a.* FROM complaint_ai_assessments a
    WHERE a.status = 'SUCCEEDED' AND a.id = (
      SELECT candidate.id FROM complaint_ai_assessments candidate
      WHERE candidate.complaint_id = a.complaint_id AND candidate.status = 'SUCCEEDED'
      ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 1
    )
  )
  SELECT COUNT(*) AS count
  FROM complaints c JOIN latest_success a ON a.complaint_id = c.id
  WHERE c.civic_issue_id = ? AND a.human_review_required = 1
`);

function mapAssessmentSummary(issueId) {
  const latest = latestSuccessfulAssessment.get(issueId);
  if (!latest) return null;
  return {
    assessedReportCount: countAssessedReports.get(issueId).count,
    categoryCounts: countByCategory.all(issueId).map(({ value, count }) => ({ category: value, count })),
    departmentCounts: countByDepartment.all(issueId).map(({ value, count }) => ({ department: value, count })),
    severityCounts: countBySeverity.all(issueId).map(({ value, count }) => ({ severity: value, count })),
    humanReviewRequiredCount: countReviewed.get(issueId).count,
    latestSuccessfulComplaintAssessment: {
      complaintId: latest.complaint_id,
      category: latest.category,
      department: latest.department,
      severity: latest.severity,
      confidence: latest.confidence,
      humanReviewRequired: Boolean(latest.human_review_required),
      assessedAt: latest.created_at
    }
  };
}

function mapIssue(row) {
  return {
    id: row.id,
    status: row.status,
    canonicalIssueId: row.status === 'MERGED'
      ? (findCanonicalIssue.get(row.id)?.id ?? row.merged_into_issue_id)
      : null,
    reportCount: row.report_count,
    currentAssignment: row.assigned_officer_id === null ? null : {
      officerId: row.assigned_officer_id,
      officerName: row.officer_name,
      assignedAt: row.assigned_at
    },
    aiAssessmentSummary: mapAssessmentSummary(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listCivicIssues({ limit, offset, status }) {
  const where = status ? 'i.status = ?' : "i.status <> 'MERGED'";
  const params = status ? [status, limit + 1, offset] : [limit + 1, offset];
  const rows = db.prepare(`
    SELECT i.id, i.status, i.merged_into_issue_id, i.assigned_officer_id,
           i.created_at, i.updated_at,
           officer.display_name AS officer_name,
           (SELECT e.created_at FROM civic_issue_assignment_events e
            WHERE e.civic_issue_id = i.id AND e.officer_id = i.assigned_officer_id
              AND e.event_type IN ('ASSIGNED', 'REASSIGNED')
            ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS assigned_at,
           (SELECT COUNT(*) FROM complaints c WHERE c.civic_issue_id = i.id) AS report_count
    FROM civic_issues i
    LEFT JOIN users officer ON officer.id = i.assigned_officer_id
    WHERE ${where}
    ORDER BY i.updated_at DESC, i.id DESC
    LIMIT ? OFFSET ?
  `).all(...params);
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(mapIssue),
    pagination: { limit, offset, hasMore }
  };
}

const findCanonicalIssue = db.prepare(`
  WITH RECURSIVE issue_chain(id, status, merged_into_issue_id) AS (
    SELECT id, status, merged_into_issue_id FROM civic_issues WHERE id = ?
    UNION
    SELECT next.id, next.status, next.merged_into_issue_id
    FROM civic_issues next JOIN issue_chain current ON next.id = current.merged_into_issue_id
  )
  SELECT id, status FROM issue_chain WHERE merged_into_issue_id IS NULL LIMIT 1
`);

export function getCivicIssue(issueId) {
  const row = selectIssueBase.get(issueId);
  if (!row) return null;
  const issue = mapIssue(row);
  if (row.status === 'MERGED') {
    issue.canonicalIssue = findCanonicalIssue.get(issueId) ?? null;
  }
  issue.linkedComplaints = db.prepare(`
    SELECT c.id AS complaint_id, c.status, c.created_at,
           a.status AS assessment_status, a.category, a.department, a.severity,
           a.human_review_required
    FROM complaints c
    LEFT JOIN complaint_ai_assessments a ON a.id = (
      SELECT latest.id FROM complaint_ai_assessments latest
      WHERE latest.complaint_id = c.id
      ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1
    )
    WHERE c.civic_issue_id = ?
    ORDER BY c.created_at DESC, c.id DESC
  `).all(issueId).map((report) => ({
    complaintId: report.complaint_id,
    status: report.status,
    createdAt: report.created_at,
    aiAssessment: report.assessment_status === null ? null : {
      status: report.assessment_status,
      category: report.category,
      department: report.department,
      severity: report.severity,
      humanReviewRequired: report.human_review_required === null ? null : Boolean(report.human_review_required)
    }
  }));
  issue.assignmentHistory = db.prepare(`
    SELECT e.id, e.event_type, e.previous_officer_id, previous.display_name AS previous_officer_name,
           e.officer_id, officer.display_name AS officer_name,
           e.admin_user_id, admin.display_name AS admin_name, e.created_at
    FROM civic_issue_assignment_events e
    LEFT JOIN users previous ON previous.id = e.previous_officer_id
    LEFT JOIN users officer ON officer.id = e.officer_id
    JOIN users admin ON admin.id = e.admin_user_id
    WHERE e.civic_issue_id = ?
    ORDER BY e.created_at, e.id
  `).all(issueId).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    previousOfficer: event.previous_officer_id === null ? null : {
      id: event.previous_officer_id,
      name: event.previous_officer_name
    },
    officer: event.officer_id === null ? null : { id: event.officer_id, name: event.officer_name },
    admin: { id: event.admin_user_id, name: event.admin_name },
    createdAt: event.created_at
  }));
  return issue;
}

const findAdmin = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'ADMIN'");
const findIssueForAssignment = db.prepare(`
  SELECT id, status, merged_into_issue_id, assigned_officer_id
  FROM civic_issues WHERE id = ?
`);
const findOfficer = db.prepare("SELECT id, display_name FROM users WHERE id = ? AND role = 'OFFICER'");
const updateAssignment = db.prepare(`
  UPDATE civic_issues SET assigned_officer_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ? AND status <> 'MERGED' AND merged_into_issue_id IS NULL
`);
const insertAssignmentEvent = db.prepare(`
  INSERT INTO civic_issue_assignment_events
    (civic_issue_id, event_type, previous_officer_id, officer_id, admin_user_id)
  VALUES (@issueId, @eventType, @previousOfficerId, @officerId, @adminId)
`);

function assignmentTransaction(operation) {
  const transaction = db.transaction((issueId, officerId, adminId) => {
    if (!findAdmin.get(adminId)) throw new AdminIssueError('Admin authorization is required', 403);
    const issue = findIssueForAssignment.get(issueId);
    if (!issue) throw new AdminIssueError('Civic issue not found', 404);
    if (issue.status === 'MERGED' || issue.merged_into_issue_id !== null) {
      throw new AdminIssueError('Merged civic issues cannot be assigned', 409);
    }

    const priorOfficerId = issue.assigned_officer_id;
    if (operation === 'ASSIGNED' && priorOfficerId !== null) {
      throw new AdminIssueError('Civic issue already has an assigned officer', 409);
    }
    if (operation !== 'ASSIGNED' && priorOfficerId === null) {
      throw new AdminIssueError('Civic issue has no assigned officer', 409);
    }

    let officer = null;
    if (operation !== 'UNASSIGNED') {
      officer = findOfficer.get(officerId);
      if (!officer) throw new AdminIssueError('Target user is not an active officer', 400);
      if (operation === 'REASSIGNED' && priorOfficerId === officer.id) {
        throw new AdminIssueError('Civic issue is already assigned to that officer', 409);
      }
    }

    const nextOfficerId = operation === 'UNASSIGNED' ? null : officer.id;
    const update = updateAssignment.run(nextOfficerId, issue.id);
    if (update.changes !== 1) throw new AdminIssueError('Civic issue assignment changed; retry the request', 409);
    const event = insertAssignmentEvent.run({
      issueId: issue.id,
      eventType: operation,
      previousOfficerId: operation === 'ASSIGNED' ? null : priorOfficerId,
      officerId: nextOfficerId,
      adminId
    });
    return {
      id: Number(event.lastInsertRowid),
      civicIssueId: issue.id,
      eventType: operation,
      previousOfficer: priorOfficerId === null ? null : { id: priorOfficerId },
      officer: officer ? { id: officer.id, name: officer.display_name } : null,
      assignedOfficerId: nextOfficerId,
      assignedByAdminId: adminId
    };
  });
  return (issueId, officerId, adminId) => transaction.immediate(issueId, officerId, adminId);
}

export function assignOfficer(issueId, officerId, adminId) {
  return assignmentTransaction('ASSIGNED')(issueId, officerId, adminId);
}

export function reassignOfficer(issueId, officerId, adminId) {
  return assignmentTransaction('REASSIGNED')(issueId, officerId, adminId);
}

export function unassignOfficer(issueId, adminId) {
  return assignmentTransaction('UNASSIGNED')(issueId, null, adminId);
}
