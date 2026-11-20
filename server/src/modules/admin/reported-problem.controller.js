import * as reportedProblemService from './reported-problem.service.js';
import * as defaultStorage from '../../services/objectStorage.js';

export function createReportedProblemController(storageAdapter = defaultStorage) {
  return {
    list: (req, res, next) => {
      try {
        const result = reportedProblemService.listReportedProblems(req.validatedQuery);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
    get: async (req, res, next) => {
      try {
        const problem = await reportedProblemService.getReportedProblem(
          req.params.referenceId,
          storageAdapter
        );
        if (!problem) return res.status(404).json({ error: 'Reported problem not found' });
        res.json({ problem });
      } catch (error) {
        next(error);
      }
    },
    update: async (req, res, next) => {
      try {
        const problem = await reportedProblemService.updateReportedProblem(
          req.params.referenceId,
          req.body,
          storageAdapter
        );
        if (!problem) return res.status(404).json({ error: 'Reported problem not found' });
        res.json({ problem });
      } catch (error) {
        next(error);
      }
    }
  };
}
