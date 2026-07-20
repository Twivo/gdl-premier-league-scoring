import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/AuthContext';
import { useT } from '@/store/LangContext';
import { RequireAdmin } from './RequireAuth';

/**
 * Admin shell. New admin tools = just add a route + a nav entry below;
 * the auth gate and layout are shared.
 */
const NAV = [
  { to: '/admin/players', labelKey: 'admin.players' },
  { to: '/admin/teams', labelKey: 'admin.teams' },
  { to: '/admin/stats', labelKey: 'admin.title' },
  { to: '/admin/championship', labelKey: 'admin.championship' },
  { to: '/admin/review', labelKey: 'admin.seasonReview' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useT();

  return (
    <RequireAdmin>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg px-2 py-1 text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
            >
              {t('common.app')}
            </button>
            <h1 className="text-xl font-black">{t('admin.title')}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[var(--color-text-dim)] sm:inline">
              {user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 hover:bg-[var(--color-surface-2)]"
            >
              {t('admin.signOut')}
            </button>
          </div>
        </header>

        <nav className="mb-5 flex gap-2 border-b border-[var(--color-border)]">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  '-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'border-[var(--color-accent)] text-[var(--color-text)]'
                    : 'border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]',
                )
              }
            >
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </RequireAdmin>
  );
}
