import apiClient from './client.js';

let currentUserRequest = null;

// Extracts the authenticated user from the API response.
function readUserResponse(response) {
  return response.data.user;
}

// Registers a citizen and returns the user created by the backend.
export async function register(credentials) {
  const response = await apiClient.post('/auth/register', credentials);
  return response.data.user;
}

// Logs in and returns the user while the backend manages the cookie.
export async function login(credentials) {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data.user;
}

// Shares an in-flight current-user request between StrictMode effect replays.
export function getCurrentUser() {
  if (!currentUserRequest) {
    const request = apiClient.get('/auth/me')
      .then(readUserResponse)
      .finally(() => {
        if (currentUserRequest === request) currentUserRequest = null;
      });
    currentUserRequest = request;
  }

  return currentUserRequest;
}

// Requests cookie invalidation from the backend.
export async function logout() {
  await apiClient.post('/auth/logout');
}
