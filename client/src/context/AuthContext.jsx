import { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as authApi from '../api/auth.js';
import { SESSION_EXPIRED_EVENT } from '../api/client.js';

const AuthContext = createContext(null);

// Provides the backend-managed user session to the application.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const authVersion = useRef(0);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    function handleExpiredSession() {
      authVersion.current += 1;
      setUser(null);
      setSessionError(null);
      setIsLoading(false);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiredSession);
  }, []);

  useEffect(
    // Restores the existing cookie session and ignores stale responses after auth actions.
    () => {
      let isMounted = true;
      const requestVersion = authVersion.current;

      // Stores the user returned by the current-session endpoint.
      function applyRestoredUser(restoredUser) {
        if (!isMounted || authVersion.current !== requestVersion) return;
        setUser(restoredUser);
        setSessionError(null);
      }

      // Treats only HTTP 401 as a missing session and surfaces other failures.
      function handleRestoreFailure(error) {
        if (!isMounted || authVersion.current !== requestVersion) return;
        if (error.response?.status === 401) {
          setUser(null);
          setSessionError(null);
          return;
        }
        setSessionError(error);
      }

      // Ends the loading state after the session request settles.
      function finishRestoringSession() {
        if (isMounted && authVersion.current === requestVersion) setIsLoading(false);
      }

      authApi.getCurrentUser()
        .then(applyRestoredUser)
        .catch(handleRestoreFailure)
        .finally(finishRestoringSession);

      // Prevents updates from this effect after its provider instance unmounts.
      function stopSessionUpdates() {
        isMounted = false;
      }

      return stopSessionUpdates;
    },
    [restoreAttempt]
  );

  function retrySession() {
    setSessionError(null);
    setIsLoading(true);
    setRestoreAttempt((attempt) => attempt + 1);
  }

  // Registers a citizen and adopts the role returned by the backend.
  async function register(credentials) {
    const registeredUser = await authApi.register(credentials);
    authVersion.current += 1;
    setUser(registeredUser);
    setIsLoading(false);
    setSessionError(null);
    setLogoutWarning(false);
    return registeredUser;
  }

  // Logs in and adopts the role returned by the backend.
  async function login(credentials) {
    const authenticatedUser = await authApi.login(credentials);
    authVersion.current += 1;
    setUser(authenticatedUser);
    setIsLoading(false);
    setSessionError(null);
    setLogoutWarning(false);
    return authenticatedUser;
  }

  // Adopts the public user returned after a profile update.
  async function updateProfile(profile) {
    const updatedUser = await authApi.updateProfile(profile);
    authVersion.current += 1;
    setUser(updatedUser);
    setIsLoading(false);
    setSessionError(null);
    return updatedUser;
  }

  async function uploadProfileImage(file, onUploadProgress) {
    const result = await authApi.uploadProfileImage(file, onUploadProgress);
    authVersion.current += 1;
    setUser(result.user);
    setIsLoading(false);
    setSessionError(null);
    return result.profileImageUrl;
  }

  async function removeProfileImage() {
    const updatedUser = await authApi.removeProfileImage();
    authVersion.current += 1;
    setUser(updatedUser);
    setIsLoading(false);
    setSessionError(null);
    return updatedUser;
  }

  // Clears local auth state even when the backend logout request fails.
  async function logout() {
    authVersion.current += 1;
    setLogoutWarning(false);
    try {
      await authApi.logout();
    } catch (error) {
      setLogoutWarning(true);
      throw error;
    } finally {
      setUser(null);
      setSessionError(null);
      setIsLoading(false);
    }
  }

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    sessionError,
    logoutWarning,
    register,
    login,
    updateProfile,
    uploadProfileImage,
    removeProfileImage,
    logout,
    retrySession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Reads the shared authentication context from a component.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
