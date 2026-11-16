import { db } from '../../config/database.js';
import * as objectStorage from '../../services/objectStorage.js';

export class ResolutionError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

export function createComplaintResolutionService(storage = objectStorage) {
  const findOwnedIssue = db.prepare(`SELECT c.id AS complaint_id,c.civic_issue_id,i.status,i.merged_into_issue_id
    FROM complaints c JOIN civic_issues i ON i.id=c.civic_issue_id
    WHERE c.id=? AND c.user_id=?`);

  async function getResolution(complaintId, citizenId) {
    const linked = findOwnedIssue.get(complaintId, citizenId);
    if (!linked) return null;
    if (linked.status === 'MERGED' || linked.merged_into_issue_id !== null) {
      throw new ResolutionError('Merged issues cannot be verified', 409);
    }
    const review = db.prepare(`SELECT decision,reason,reviewed_at FROM civic_issue_dispute_reviews WHERE civic_issue_id=?`)
      .get(linked.civic_issue_id);
    const hasCompletedWork = db.prepare(`SELECT 1 FROM civic_issue_work_events
      WHERE civic_issue_id=? AND event_type='COMPLETED' LIMIT 1`).get(linked.civic_issue_id);
    if (linked.status !== 'RESOLVED' && !(review?.decision === 'ACCEPTED' && hasCompletedWork)) {
      throw new ResolutionError('Resolution evidence is not available yet', 409);
    }
    const evidenceRows = db.prepare(`SELECT id,stage,mime_type,byte_size,object_key,created_at
      FROM civic_issue_repair_evidence WHERE civic_issue_id=? ORDER BY created_at,id`).all(linked.civic_issue_id);
    const evidence = await Promise.all(evidenceRows.map(async row => ({ id: row.id, stage: row.stage,
      mimeType: row.mime_type, byteSize: row.byte_size, createdAt: row.created_at,
      url: await storage.createRepairEvidenceReadUrl(row.object_key, row.mime_type) })));
    const verification = db.prepare(`SELECT decision,created_at FROM civic_issue_resolution_verifications
      WHERE civic_issue_id=? AND citizen_user_id=?`).get(linked.civic_issue_id, citizenId);
    return {
      issue: { id: linked.civic_issue_id, status: linked.status },
      evidence,
      myVerification: verification ? { decision: verification.decision, submittedAt: verification.created_at } : null,
      review: review ? { decision: review.decision, reviewedAt: review.reviewed_at } : null
    };
  }

  const submitTx = db.transaction((complaintId, citizenId, decision, reason) => {
    const linked = findOwnedIssue.get(complaintId, citizenId);
    if (!linked) return null;
    if (linked.status !== 'RESOLVED' || linked.merged_into_issue_id !== null) {
      throw new ResolutionError('Only an active RESOLVED issue can be verified', 409);
    }
    if (db.prepare('SELECT 1 FROM civic_issue_dispute_reviews WHERE civic_issue_id=?').get(linked.civic_issue_id)) {
      throw new ResolutionError('This issue has a final admin review', 409);
    }
    const result = db.prepare(`INSERT INTO civic_issue_resolution_verifications
      (civic_issue_id,complaint_id,citizen_user_id,decision,reason) VALUES(?,?,?,?,?)`)
      .run(linked.civic_issue_id, complaintId, citizenId, decision, reason ?? null);
    const row = db.prepare('SELECT created_at FROM civic_issue_resolution_verifications WHERE id=?').get(Number(result.lastInsertRowid));
    return { id: Number(result.lastInsertRowid), issueId: linked.civic_issue_id,
      decision, submittedAt: row.created_at };
  });

  function submitVerification(complaintId, citizenId, { decision, reason }) {
    try {
      const result = submitTx.immediate(complaintId, citizenId, decision, reason);
      if (!result) return null;
      return result;
    } catch (error) {
      if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ResolutionError('You have already submitted a verification for this issue', 409);
      }
      throw error;
    }
  }

  return { getResolution, submitVerification };
}
