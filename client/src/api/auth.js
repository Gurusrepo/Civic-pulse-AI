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

// Updates the current authenticated user's public profile fields.
export async function updateProfile(profile) {
  const response = await apiClient.patch('/auth/profile', profile);
  return response.data.user;
}

export async function uploadProfileImage(file, onUploadProgress) {
  const formData = new FormData();
  formData.append('photo', file);
  const response = await apiClient.post('/auth/profile/avatar', formData, { onUploadProgress });
  return { user: response.data.user, profileImageUrl: response.data.profileImageUrl };
}

export async function getProfileImageUrl() {
  const response = await apiClient.get('/auth/profile/avatar');
  return response.data.url;
}

export async function removeProfileImage() {
  const response = await apiClient.delete('/auth/profile/avatar');
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
