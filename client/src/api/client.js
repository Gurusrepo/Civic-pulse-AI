import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';
const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '').replace(/\/api$/i, '') + '/api';

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

export const SESSION_EXPIRED_EVENT = 'civicpulse:session-expired';

apiClient.interceptors.response.use(undefined, (error) => {
  const requestUrl = error.config?.url ?? '';
  const isPublicCredentialRequest = /^\/?auth\/(login|register)\/?$/.test(requestUrl);
  if (error.response?.status === 401 && !isPublicCredentialRequest && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  return Promise.reject(error);
});

export default apiClient;
