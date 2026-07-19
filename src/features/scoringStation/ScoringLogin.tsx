import { Navigate } from 'react-router-dom';
import { AdminLogin } from '@/features/admin/AdminLogin';
import { useAuth } from '@/store/AuthContext';

export function ScoringLogin() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : <AdminLogin />;
}
