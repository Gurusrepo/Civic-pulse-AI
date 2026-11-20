import * as suggestionService from './suggestion.service.js';

export function listSuggestions(req, res, next) {
  try {
    const result = suggestionService.listSuggestions(req.validatedQuery);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export function getSuggestion(req, res, next) {
  try {
    const suggestion = suggestionService.getSuggestion(req.params.referenceId);
    if (!suggestion) return res.status(404).json({ error: 'Improvement suggestion not found' });
    res.json({ suggestion });
  } catch (error) {
    next(error);
  }
}

export function updateSuggestion(req, res, next) {
  try {
    const suggestion = suggestionService.updateSuggestion(req.params.referenceId, req.body);
    if (!suggestion) return res.status(404).json({ error: 'Improvement suggestion not found' });
    res.json({ suggestion });
  } catch (error) {
    next(error);
  }
}
