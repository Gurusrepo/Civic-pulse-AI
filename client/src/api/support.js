import apiClient from './client.js';

export async function submitBugReport({ title, category, description, screenshot }) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('category', category);
  formData.append('description', description);
  if (screenshot) formData.append('screenshot', screenshot);
  const response = await apiClient.post('/support/reports', formData);
  return response.data.submission;
}

export async function submitSuggestion(suggestion) {
  const response = await apiClient.post('/support/suggestions', suggestion);
  return response.data.submission;
}
