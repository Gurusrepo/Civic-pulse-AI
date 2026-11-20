import * as dashboardService from './dashboard.service.js';

export function getDashboard(req, res, next) {
  try {
    res.json(dashboardService.getAdminDashboard());
  } catch (error) {
    next(error);
  }
}
