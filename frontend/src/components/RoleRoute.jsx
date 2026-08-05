import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Guard a route to specific roles. Renders inside <Layout> (already behind
 * ProtectedRoute), so `user` is present; a wrong role is bounced to the
 * dashboard rather than the login page.
 */
export default function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
