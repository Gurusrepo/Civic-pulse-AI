import * as notificationService from './notification.service.js';

export function list(req, res, next) {
  try {
    res.json(notificationService.listNotifications(req.user.id, req.validatedQuery));
  } catch (error) { next(error); }
}

export function unreadCount(req, res, next) {
  try {
    res.json({ unreadCount: notificationService.getUnreadCount(req.user.id) });
  } catch (error) { next(error); }
}

export function markRead(req, res, next) {
  try {
    const notification = notificationService.markNotificationRead(req.user.id, req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (error) { next(error); }
}

export function markAllRead(req, res, next) {
  try {
    res.json({ updatedCount: notificationService.markAllNotificationsRead(req.user.id) });
  } catch (error) { next(error); }
}
