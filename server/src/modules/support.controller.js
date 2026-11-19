import * as objectStorage from '../services/objectStorage.js';
import * as supportService from './support.service.js';

export async function submitBugReport(req, res, next) {
  try {
    const submission = await supportService.createSupportSubmission(req.user.id, 'BUG_REPORT', req.body, req.file, objectStorage);
    res.status(201).json({ submission });
  } catch (error) { next(error); }
}

export async function submitSuggestion(req, res, next) {
  try {
    const submission = await supportService.createSupportSubmission(req.user.id, 'SUGGESTION', req.body, null, objectStorage);
    res.status(201).json({ submission });
  } catch (error) { next(error); }
}
