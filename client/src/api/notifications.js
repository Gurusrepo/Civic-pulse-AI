import apiClient from './client.js';

const body = (request) => request.then(({ data }) => data);

export function listNotifications(params = {}) {
  return body(apiClient.get('/notifications', { params }));
}

export function getUnreadNotificationCount() {
  return body(apiClient.get('/notifications/unread-count'));
}

export function markNotificationRead(id) {
  return body(apiClient.patch(`/notifications/${id}/read`));
}

export function markAllNotificationsRead() {
  return body(apiClient.patch('/notifications/read-all'));
}
