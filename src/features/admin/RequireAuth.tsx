import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { useT } from '@/store/LangContext';
import { Loading } from '@/components/ui/Loading';
import { AdminLogin } from './AdminLogin';

/** Gate that makes everything inside totally inaccessible without auth. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <AdminLogin />;
  return <>{children}</>;
}

/**
 * Admin-only gate. A signed-in captain is bounced to their own team space
 * rather than seeing the (RLS-protected but confusing) admin tools.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isCaptain } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <AdminLogin />;
  if (isCaptain) return <Navigate to="/team" replace />;
  return <>{children}</>;
}

/**
 * Captain-only gate for the team space. Admins are sent to the admin area
 * (they have no single team scope), and a captain with no team assigned yet
 * gets a clear message instead of an empty screen.
 */
export function RequireTeam({ children }: { children: ReactNode }) {
  const { user, loading, isCaptain, teamId } = useAuth();
  const { t } = useT();
  if (loading) return <Loading />;
  if (!user) return <AdminLogin />;
  if (!isCaptain) return <Navigate to="/admin" replace />;
  if (!teamId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="text-5xl">🎯</div>
        <p className="text-[var(--color-text-dim)]">{t('team.noTeamAssigned')}</p>
      </div>
    );
  }
  return <>{children}</>;
}
