import { db } from '../../config/database.js';
import { createReadUrl, deleteObject, uploadComplaintImage } from '../../services/objectStorage.js';
import { generateCandidatesForComplaint } from '../admin/duplicate.service.js';

const insertCivicIssue = db.prepare('INSERT INTO civic_issues DEFAULT VALUES');
const insertComplaint = db.prepare(`
  INSERT INTO complaints (user_id, civic_issue_id, title, description, latitude, longitude, location_accuracy_meters)
  VALUES (@userId, @civicIssueId, @title, @description, @latitude, @longitude, @locationAccuracyMeters)
`);
const insertMedia = db.prepare(`
  INSERT INTO complaint_media (complaint_id, uploader_id, object_key, media_type, mime_type, byte_size)
  VALUES (@complaintId, @uploaderId, @objectKey, 'IMAGE', @mimeType, @byteSize)
`);
const insertAiAssessment = db.prepare(`
  INSERT INTO complaint_ai_assessments (complaint_id, status)
  VALUES (?, 'PENDING')
`);
const findOwnedComplaint = db.prepare(`
  SELECT c.id, c.user_id, c.civic_issue_id, c.title, c.description, c.latitude, c.longitude,
         c.location_accuracy_meters, c.status, c.created_at, c.updated_at,
         i.status AS civic_issue_status,
         (SELECT COUNT(*) FROM complaints linked WHERE linked.civic_issue_id = c.civic_issue_id) AS issue_report_count
  FROM complaints c
  LEFT JOIN civic_issues i ON i.id = c.civic_issue_id
  WHERE c.id = ? AND c.user_id = ?
`);
const findMediaById = db.prepare(`
  SELECT id, media_type, mime_type, byte_size, created_at
  FROM complaint_media WHERE id = ?
`);
export const createComplaintTransaction = db.transaction((data) => {
  const civicIssueId = Number(insertCivicIssue.run().lastInsertRowid);
  const result = insertComplaint.run({
    userId: data.userId,
    civicIssueId,
    title: data.fields.title,
    description: data.fields.description,
    latitude: data.fields.latitude,
    longitude: data.fields.longitude,
    locationAccuracyMeters: data.fields.location_accuracy_meters ?? null
  });
  const complaintId = Number(result.lastInsertRowid);
  const mediaResult = insertMedia.run({
    complaintId,
    uploaderId: data.userId,
    objectKey: data.objectKey,
    mimeType: data.file.verifiedMimeType,
    byteSize: data.file.size
  });
  insertAiAssessment.run(complaintId);
  return {
    complaint: findOwnedComplaint.get(complaintId, data.userId),
    media: findMediaById.get(Number(mediaResult.lastInsertRowid))
  };
});
function mapComplaint(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAccuracyMeters: row.location_accuracy_meters,
    civicIssueId: row.civic_issue_id,
    issueStatus: row.civic_issue_status,
    reportCount: row.issue_report_count,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMedia(row) {
  return {
    id: row.id,
    mediaType: row.media_type,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    createdAt: row.created_at
  };
}

export async function createComplaint(userId, fields, file) {
  let objectKey;
  try {
    objectKey = await uploadComplaintImage({
      buffer: file.buffer,
      size: file.size,
      mimeType: file.verifiedMimeType
    });
    const { complaint: row, media: mediaRow } = createComplaintTransaction({
      userId,
      fields,
      file,
      objectKey
    });
    try { generateCandidatesForComplaint(row.id); }
    catch (error) { console.error('Duplicate candidate generation failed:', error?.code ?? error?.name ?? 'Error'); }
    return {
      ...mapComplaint(row),
      media: [mapMedia(mediaRow)]
    };
  } catch (error) {
    if (objectKey) {
      try {
        await deleteObject(objectKey);
      } catch {
        console.error('Complaint media rollback cleanup failed');
      }
    }
    // The database transaction rolls back both records when either insert fails.
    throw error;
  }
}

export function listComplaints(userId, { limit, offset }) {
  const rows = db.prepare(`
    SELECT c.id, c.title, c.description, c.latitude, c.longitude, c.location_accuracy_meters,
           c.civic_issue_id, c.status, c.created_at, c.updated_at,
           i.status AS civic_issue_status,
           (SELECT COUNT(*) FROM complaints linked WHERE linked.civic_issue_id = c.civic_issue_id) AS issue_report_count,
           (SELECT COUNT(*) FROM complaint_media m WHERE m.complaint_id = c.id) AS media_count
    FROM complaints c
    LEFT JOIN civic_issues i ON i.id = c.civic_issue_id
    WHERE c.user_id = ?
    ORDER BY c.created_at DESC, c.id DESC
    LIMIT ? OFFSET ?
  `).all(userId, limit + 1, offset);
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map((row) => ({
      ...mapComplaint(row),
      reportCount: row.issue_report_count,
      mediaCount: row.media_count
    })),
    pagination: { limit, offset, hasMore }
  };
}

export async function getComplaint(userId, complaintId) {
  const row = findOwnedComplaint.get(complaintId, userId);
  if (!row) return null;
  const mediaRows = db.prepare(`
    SELECT id, object_key, media_type, mime_type, byte_size, created_at
    FROM complaint_media WHERE complaint_id = ? ORDER BY created_at, id
  `).all(row.id);
  const media = await Promise.all(mediaRows.map(async (item) => ({
    ...mapMedia(item),
    url: await createReadUrl(item.object_key, item.mime_type)
  })));
  return { ...mapComplaint(row), media };
}
