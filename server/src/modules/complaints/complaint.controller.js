import * as complaintService from './complaint.service.js';
import * as intelligenceService from '../intelligence/intelligence.service.js';

export async function create(req, res, next) {
  try {
    const complaint = await complaintService.createComplaint(req.user.id, req.body, req.file);
    res.status(201).json({ complaint });
  } catch (error) { next(error); }
}

export function list(req, res, next) {
  try {
    res.json(complaintService.listComplaints(req.user.id, req.validatedQuery));
  } catch (error) { next(error); }
}

export async function getById(req, res, next) {
  try {
    const complaint = await complaintService.getComplaint(req.user.id, req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
    res.json({ complaint });
  } catch (error) { next(error); }
}

export function getAiAssessment(req, res, next) {
  try {
    const assessment = intelligenceService.getOwnedAssessment(req.user.id, req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Complaint or AI assessment not found' });
    res.json({ assessment });
  } catch (error) { next(error); }
}
