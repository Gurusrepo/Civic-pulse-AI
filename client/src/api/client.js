import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api';
const apiBaseUrl = configuredBaseUrl.replace(/\/+$/, '').replace(/\/api$/i, '') + '/api';

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true
});

export default apiClient;
