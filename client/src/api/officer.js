import apiClient from './client.js';

const body = (request) => request.then(({ data }) => data);
const issuePath = (id) => `/officer/civic-issues/${id}`;

export function listCivicIssues(params = {}) { return body(apiClient.get('/officer/civic-issues', { params })); }
export function getCivicIssue(id) { return body(apiClient.get(issuePath(id))); }
export function startWork(id) { return body(apiClient.post(`${issuePath(id)}/start`)); }
export function listRepairEvidence(id) { return body(apiClient.get(`${issuePath(id)}/repair-evidence`)); }
export function uploadRepairEvidence(id, { photo, stage }) {
  const form = new FormData();
  form.append('photo', photo);
  form.append('stage', stage);
  return body(apiClient.post(`${issuePath(id)}/repair-evidence`, form));
}
export function completeWork(id) { return body(apiClient.post(`${issuePath(id)}/complete`)); }
