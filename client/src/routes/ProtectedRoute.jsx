import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ErrorState, LoadingState } from '../components/AsyncState.jsx';

// Requires a restored authenticated session before rendering protected content.
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, sessionError, retrySession } = useAuth();

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f6ef] p-6"><LoadingState>Restoring your session...</LoadingState></main>;
  }

  if (sessionError) {
    return <main className="grid min-h-screen place-items-center bg-[#f7f6ef] p-6"><ErrorState onRetry={retrySession}>Unable to verify your session.</ErrorState></main>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}
