import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

const FullPageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-brand-surface">
    <div className="text-center">
      <div
        className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"
        style={{ borderColor: '#836efe', borderTopColor: 'transparent' }}
      />
      <p className="text-brand-text-secondary text-sm">Загрузка...</p>
    </div>
  </div>
);

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
