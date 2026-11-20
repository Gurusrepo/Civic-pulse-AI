import { db } from '../../config/database.js';

const complaintCounts = db.prepare(`
  SELECT COUNT(c.id) AS total,
    COALESCE(SUM(CASE WHEN i.status='OPEN' THEN 1 ELSE 0 END),0) AS open,
    COALESCE(SUM(CASE WHEN i.status='IN_PROGRESS' THEN 1 ELSE 0 END),0) AS in_progress,
    COALESCE(SUM(CASE WHEN i.status='RESOLVED' THEN 1 ELSE 0 END),0) AS resolved
  FROM complaints c
  LEFT JOIN civic_issues i ON i.id=c.civic_issue_id
`);

const supportCounts = db.prepare(`
  SELECT COALESCE(SUM(CASE WHEN kind='BUG_REPORT' THEN 1 ELSE 0 END),0) AS reported_problems,
    COALESCE(SUM(CASE WHEN kind='SUGGESTION' THEN 1 ELSE 0 END),0) AS suggestions
  FROM citizen_support_submissions
`);

const activeOfficerCount = db.prepare(`
  SELECT COUNT(*) AS count FROM users
  WHERE role='OFFICER' AND account_status='ACTIVE'
`);

const publishedAnnouncementCount = db.prepare(`
  SELECT COUNT(*) AS count FROM civic_announcements
  WHERE is_published=1 AND is_public=1
`);

const recentComplaints = db.prepare(`
  SELECT c.id,c.title,i.status,c.created_at
  FROM complaints c
  LEFT JOIN civic_issues i ON i.id=c.civic_issue_id
  ORDER BY c.created_at DESC,c.id DESC
  LIMIT 5
`);

const recentSupportSubmissions = db.prepare(`
  SELECT reference_id,kind,title,category,created_at
  FROM citizen_support_submissions
  ORDER BY created_at DESC,reference_id DESC
  LIMIT 5
`);

const recentAnnouncements = db.prepare(`
  SELECT id,title,published_at
  FROM civic_announcements
  WHERE is_published=1 AND is_public=1
  ORDER BY published_at DESC,id DESC
  LIMIT 5
`);

export function getAdminDashboard() {
  const complaints = complaintCounts.get();
  const support = supportCounts.get();

  return {
    summary: {
      totalComplaints: complaints.total,
      openComplaints: complaints.open,
      inProgressComplaints: complaints.in_progress,
      resolvedComplaints: complaints.resolved,
      reportedProblems: support.reported_problems,
      suggestions: support.suggestions,
      activeOfficers: activeOfficerCount.get().count,
      publishedAnnouncements: publishedAnnouncementCount.get().count
    },
    recent: {
      complaints: recentComplaints.all().map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        createdAt: row.created_at
      })),
      supportSubmissions: recentSupportSubmissions.all().map((row) => ({
        referenceId: row.reference_id,
        kind: row.kind,
        title: row.title,
        category: row.category,
        createdAt: row.created_at
      })),
      announcements: recentAnnouncements.all().map((row) => ({
        id: row.id,
        title: row.title,
        publishedAt: row.published_at
      }))
    }
  };
}
