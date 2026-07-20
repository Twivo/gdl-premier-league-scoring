import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { getRepository } from '@/data';
import type { TeamWithPlayers } from '@/data/types';
import { useRoster } from '@/store/RosterContext';
import { useT } from '@/store/LangContext';
import { useMyTeam } from './TeamLayout';

/**
 * Captain roster management: create players, add existing free players to the
 * squad, and remove members. All writes are scoped to the captain's own team
 * by Row-Level Security — this screen only ever touches `team.id`.
 */
export function TeamSquad() {
  const { team, reload } = useMyTeam();
  const confirm = useConfirm();
  const { t } = useT();
  const repo = useMemo(() => getRepository(), []);
  const { players, reload: reloadRoster } = useRoster();

  const [allTeams, setAllTeams] = useState<TeamWithPlayers[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      setAllTeams(await repo.listTeams());
    } catch {
      /* non-blocking: taken-set is a convenience */
    }
  }, [repo]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await Promise.all([reload(), reloadRoster(), loadTeams()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const memberName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? '???';
  const memberColor = (id: string) =>
    players.find((p) => p.id === id)?.color ?? '#666';

  // Players already on ANY team can't be added (a player belongs to one team).
  const taken = useMemo(() => {
    const set = new Set<string>();
    for (const tm of allTeams) for (const pid of tm.playerIds) set.add(pid);
    return set;
  }, [allTeams]);

  const addable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => !taken.has(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, taken, query]);

  const addMember = (playerId: string) =>
    run(() => repo.setTeamPlayers(team.id, [...team.playerIds, playerId]));

  const removeMember = (playerId: string) =>
    run(() =>
      repo.setTeamPlayers(
        team.id,
        team.playerIds.filter((id) => id !== playerId),
      ),
    );

  const createAndAdd = () => {
    const name = newName.trim();
    if (!name) return;
    void run(async () => {
      const created = await repo.createPlayer({ name });
      await repo.setTeamPlayers(team.id, [...team.playerIds, created.id]);
      setNewName('');
    });
  };

  const roster = useMemo(
    () =>
      [...team.playerIds].sort((a, b) =>
        memberName(a).localeCompare(memberName(b)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [team.playerIds, players],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
          placeholder={t('team.newPlayerName')}
          className="min-w-40 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 outline-none focus:border-[var(--color-accent)]"
        />
        <Button
          variant="surface"
          size="md"
          disabled={busy || !newName.trim()}
          onClick={createAndAdd}
        >
          {t('team.createAndAdd')}
        </Button>
        <Button
          variant="accent"
          size="md"
          disabled={busy}
          onClick={() => {
            setQuery('');
            setPickerOpen(true);
          }}
        >
          {t('team.addExisting')}
        </Button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
          {error}
        </p>
      )}

      <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
        {t('team.mySquad')} ·{' '}
        {t(
          roster.length === 1 ? 'admin.playerCount' : 'admin.playerCountPlural',
        ).replace('{count}', String(roster.length))}
      </p>

      {roster.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-[var(--color-text-dim)]">
          {t('team.noMembers')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roster.map((pid) => (
            <li
              key={pid}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: memberColor(pid) }}
              />
              <span className="flex-1 truncate text-lg">{memberName(pid)}</span>
              <button
                disabled={busy}
                onClick={async () => {
                  const ok = await confirm({
                    title: t('team.removeMemberTitle').replace(
                      '{name}',
                      memberName(pid),
                    ),
                    message: t('team.removeMemberMessage'),
                    confirmLabel: t('team.remove'),
                  });
                  if (ok) void removeMember(pid);
                }}
                className="rounded-lg px-2.5 py-1.5 text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                aria-label={t('team.remove')}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('team.addExisting')}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('setup.searchPlayers')}
          className="mb-3 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 outline-none focus:border-[var(--color-accent)]"
        />
        <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {addable.length === 0 ? (
            <li className="py-6 text-center text-sm text-[var(--color-text-dim)]">
              {t('setup.noPlayerFound')}
            </li>
          ) : (
            addable.map((p) => (
              <li key={p.id}>
                <button
                  disabled={busy}
                  onClick={() => {
                    void addMember(p.id);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: p.color ?? '#666' }}
                  />
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="mt-3 text-xs text-[var(--color-text-mute)]">
          {t('admin.oneTeamOnly')}
        </p>
      </Modal>
    </div>
  );
}
