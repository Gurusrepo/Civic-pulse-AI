import { randomBytes } from 'node:crypto';
import { db } from '../config/database.js';

function createReference() {
  return `NM-${randomBytes(8).toString('hex').toUpperCase()}`;
}

export async function createSupportSubmission(userId, kind, fields, file, storage) {
  const referenceId = createReference();
  let screenshotKey = null;
  let screenshotMimeType = null;
  if (file) {
    screenshotMimeType = file.verifiedMimeType;
    screenshotKey = await storage.uploadSupportAttachment({ buffer: file.buffer, mimeType: screenshotMimeType });
  }
  try {
    db.prepare(`INSERT INTO citizen_support_submissions
      (reference_id,user_id,kind,title,category,description,screenshot_key,screenshot_mime_type)
      VALUES(?,?,?,?,?,?,?,?)`).run(referenceId, userId, kind, fields.title, fields.category,
      fields.description, screenshotKey, screenshotMimeType);
  } catch (error) {
    if (screenshotKey) {
      try { await storage.deleteSupportAttachment(screenshotKey); } catch { /* Orphan cleanup can be retried. */ }
    }
    throw error;
  }
  return { referenceId, submittedAt: new Date().toISOString() };
}
