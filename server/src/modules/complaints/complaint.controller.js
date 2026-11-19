import * as complaintService from './complaint.service.js';
import * as intelligenceService from '../intelligence/intelligence.service.js';
import { createComplaintResolutionService } from './complaint-resolution.service.js';
import * as objectStorage from '../../services/objectStorage.js';

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

export function summary(req, res, next) {
  try {
    res.json({ summary: complaintService.getComplaintSummary(req.user.id) });
  } catch (error) { next(error); }
}

export function timeline(req, res, next) {
  try {
    const result = complaintService.getComplaintTimeline(req.user.id, req.params.id);
    if (!result) return res.status(404).json({ error: 'Complaint not found' });
    res.json(result);
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

export function createResolutionController(storageAdapter = objectStorage) {
  const resolutionService = createComplaintResolutionService(storageAdapter);
  return {
    async getResolution(req, res, next) {
      try {
        const resolution = await resolutionService.getResolution(req.params.id, req.user.id);
        if (!resolution) return res.status(404).json({ error: 'Complaint not found' });
        res.json({ resolution });
      } catch (error) { next(error); }
    },
    submitResolutionVerification(req, res, next) {
      try {
        const verification = resolutionService.submitVerification(req.params.id, req.user.id, req.body);
        if (!verification) return res.status(404).json({ error: 'Complaint not found' });
        res.status(201).json({ verification });
      } catch (error) { next(error); }
    }
  };
}
