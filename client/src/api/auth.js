import apiClient from './client.js';

let currentUserRequest = null;

// Extracts the authenticated user from the API response.
function readUserResponse(response) {
  return response.data.user;
}

// Starts registration and returns the pending email-verification state.
export async function register(credentials) {
  const response = await apiClient.post('/auth/register', credentials);
  return response.data;
}

export async function completeRegistrationEmail(credentials) {
  const response = await apiClient.post('/auth/registration/email/verify', credentials);
  return response.data;
}

export async function resendRegistrationEmail(credentials) {
  const response = await apiClient.post('/auth/registration/email/resend', credentials);
  return response.data;
}

// Starts email/password sign-in and returns an email OTP challenge without adopting a session.
export async function login(credentials) {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
}

export async function completeLoginOtp(credentials) {
  const response = await apiClient.post('/auth/login/otp/verify', credentials);
  return response.data;
}

export async function resendLoginOtp(credentials) {
  const response = await apiClient.post('/auth/login/otp/resend', credentials);
  return response.data;
}

export async function requestPasswordReset(credentials) {
  const response = await apiClient.post('/auth/password/forgot', credentials);
  return response.data;
}

export async function completePasswordReset(credentials) {
  const response = await apiClient.post('/auth/password/reset', credentials);
  return response.data;
}

// Updates the current authenticated user's public profile fields.
export async function updateProfile(profile) {
  const response = await apiClient.patch('/auth/profile', profile);
  return response.data.user;
}

export async function deactivateAccount(credentials) {
  const response = await apiClient.delete('/auth/account', { data: credentials });
  return response.data;
}

export async function sendEmailVerificationCode() {
  const response = await apiClient.post('/auth/verification/email/send');
  return response.data;
}

export async function verifyEmailCode(code) {
  const response = await apiClient.post('/auth/verification/email/verify', { code });
  return response.data;
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

export async function getPreferences() {
  const response = await apiClient.get('/auth/preferences');
  return response.data.preferences;
}

export async function updatePreferences(preferences) {
  const response = await apiClient.put('/auth/preferences', preferences);
  return response.data.preferences;
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
