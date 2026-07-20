import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NavLink,
  Outlet,
  useNavigate,
  useOutletContext,
} from 'react-router-dom';
import { cn } from '@/lib/cn';
import { getRepository } from '@/data';
import type { TeamWithPlayers } from '@/data/types';
import { useAuth } from '@/store/AuthContext';
import { useT } from '@/store/LangContext';
import { RequireTeam } from '@/features/admin/RequireAuth';

/** Data shared with every team-space screen (the captain's own team). */
export interface TeamOutlet {
  team: TeamWithPlayers;
  reload: () => Promise<void>;
}

export function useMyTeam(): TeamOutlet {
  return useOutletContext<TeamOutlet>();
}

const NAV = [
  { to: '/team/new', labelKey: 'team.newEncounter' },
  { to: '/team/history', labelKey: 'team.history' },
  { to: '/team/stats', labelKey: 'team.stats' },
  { to: '/team/squad', labelKey: 'team.squad' },
];

/** Team (captain) shell — mirrors the admin layout, scoped to one team. */
export function TeamLayout() {
  return (
    <RequireTeam>
      <TeamShell />
    </RequireTeam>
  );
}

function TeamShell() {
  const navigate = useNavigate();
  const { teamId, signOut } = useAuth();
  const { t } = useT();
  const repo = useMemo(() => getRepository(), []);

  const [team, setTeam] = useState<TeamWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!teamId) return;
    const all = await repo.listTeams();
    setTeam(all.find((tm) => tm.id === teamId) ?? null);
  }, [repo, teamId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void reload().finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reload]);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-5">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg px-2 py-1 text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-2)]"
          >
            {t('common.app')}
          </button>
          <h1 className="truncate text-xl font-black">
            {team?.name ?? t('team.title')}
          </h1>
        </div>
        <button
          onClick={() => signOut()}
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface-2)]"
        >
          {t('admin.signOut')}
        </button>
      </header>

      <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-[var(--color-border)]">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) =>
              cn(
                '-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
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

      {loading ? (
        <p className="py-8 text-center text-[var(--color-text-dim)]">
          {t('common.loading')}
        </p>
      ) : !team ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-text-dim)]">
          {t('team.noTeamAssigned')}
        </p>
      ) : (
        <Outlet context={{ team, reload } satisfies TeamOutlet} />
      )}
    </div>
  );
}
