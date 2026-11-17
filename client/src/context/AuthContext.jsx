import { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as authApi from '../api/auth.js';

const AuthContext = createContext(null);

// Provides the backend-managed user session to the application.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);
  const authVersion = useRef(0);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

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
    return registeredUser;
  }

  // Logs in and adopts the role returned by the backend.
  async function login(credentials) {
    const authenticatedUser = await authApi.login(credentials);
    authVersion.current += 1;
    setUser(authenticatedUser);
    setIsLoading(false);
    setSessionError(null);
    return authenticatedUser;
  }

  // Clears local auth state even when the backend logout request fails.
  async function logout() {
    authVersion.current += 1;
    try {
      await authApi.logout();
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
    register,
    login,
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
