import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { Loading } from '@/components/ui/Loading';
import { AdminLogin } from '@/features/admin/AdminLogin';

/** Standalone sign-in page: shows the login form, then returns home. */
export function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;
  return <AdminLogin />;
}
