import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If specified, user must have at least one of these roles */
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user) {
    const hasAccess = allowedRoles.some(r => user.roles.includes(r));
    if (!hasAccess) {
      // Redirect agents to /assigned, others to /
      if (user.isPendingAgent || user.isPredictionAgent) {
        return <Navigate to="/assigned" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
