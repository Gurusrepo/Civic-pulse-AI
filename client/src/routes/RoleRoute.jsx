import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const roleLandingRoutes = {
  CITIZEN: '/citizen',
  OFFICER: '/officer',
  ADMIN: '/admin'
};

// Renders a route only when the backend-provided role is allowed.
export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleLandingRoutes[user.role] ?? '/'} replace />;
  }

  return children;
}
