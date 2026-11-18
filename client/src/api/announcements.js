import apiClient from './client.js';

const body = (request) => request.then(({ data }) => data);

export function listAnnouncements(params = {}) {
  return body(apiClient.get('/announcements', { params }));
}

export function getAnnouncement(id) {
  return body(apiClient.get(`/announcements/${id}`));
}

export function listAdminAnnouncements(params = {}) {
  return body(apiClient.get('/admin/announcements', { params }));
}

export function publishAnnouncement(payload) {
  return body(apiClient.post('/admin/announcements', payload));
}
