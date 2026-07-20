import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { getRepository } from '@/data';
import type { TeamAccountAssignment, TeamWithPlayers } from '@/data/types';
import { useRoster } from '@/store/RosterContext';
import { useT } from '@/store/LangContext';

export function AdminTeams() {
  const confirm = useConfirm();
  const { t: tr } = useT();
  const repo = useMemo(() => getRepository(), []);
  const { players } = useRoster();

  const [teams, setTeams] = useState<TeamWithPlayers[]>([]);
  const [accounts, setAccounts] = useState<TeamAccountAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberPickerTeamId, setMemberPickerTeamId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState('');
  const [assignEmail, setAssignEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, a] = await Promise.all([
        repo.listTeams(),
        repo.listTeamAccounts().catch(() => [] as TeamAccountAssignment[]),
      ]);
      setTeams(t);
      setAccounts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('admin.failedLoadTeams'));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('admin.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    return teams.filter((t) => !s || t.name.toLowerCase().includes(s));
  }, [teams, search]);

  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? '???';

  const captainOf = (teamId: string) =>
    accounts.find((a) => a.teamId === teamId && a.role === 'captain')?.email ??
    null;

  const assignCaptain = (teamId: string) => {
    const email = assignEmail.trim();
    if (!email) return;
    void run(async () => {
      await repo.assignCaptain(email, teamId);
      setAssignEmail('');
    });
  };
  const unassignCaptain = (teamId: string) =>
    void run(() => repo.unassignCaptain(teamId));

  // A player can belong to only one team: anyone already on a team is not
  // offered in the add-player dialog.
  const taken = useMemo(() => {
    const set = new Set<string>();
    for (const tm of teams) for (const pid of tm.playerIds) set.add(pid);
    return set;
  }, [teams]);

  const memberPickerTeam = teams.find((t) => t.id === memberPickerTeamId) ?? null;
  const addablePlayers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return players
      .filter((p) => !taken.has(p.id))
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, taken, memberQuery]);

  const openMemberPicker = (teamId: string) => {
    setMemberPickerTeamId(teamId);
    setMemberQuery('');
  };
  const closeMemberPicker = () => {
    setMemberPickerTeamId(null);
    setMemberQuery('');
  };

  const addMember = (team: TeamWithPlayers, playerId: string) => {
    if (!playerId) return;
    void run(() => repo.setTeamPlayers(team.id, [...team.playerIds, playerId]));
    closeMemberPicker();
  };
  const removeMember = (team: TeamWithPlayers, playerId: string) => {
    void run(() =>
      repo.setTeamPlayers(
        team.id,
        team.playerIds.filter((id) => id !== playerId),
      ),
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              void run(async () => {
                await repo.createTeam(newName);
                setNewName('');
              });
            }
          }}
          placeholder={tr('admin.newTeamName')}
          className="min-w-40 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 outline-none focus:border-[var(--color-accent)]"
        />
        <Button
          variant="accent"
          size="md"
          disabled={busy || !newName.trim()}
          onClick={() =>
            void run(async () => {
              await repo.createTeam(newName);
              setNewName('');
            })
          }
        >
          {tr('admin.addTeam')}
        </Button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tr('admin.searchTeams')}
        className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
      />

      {error && (
        <p className="mb-3 rounded-lg bg-[var(--color-accent-soft)] px-3 py-2 text-sm text-[var(--color-accent)]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-[var(--color-text-dim)]">{tr('common.loading')}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-[var(--color-text-dim)]">
          {teams.length === 0 ? tr('admin.noTeams') : tr('admin.noMatch')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((t) => {
            const expanded = expandedId === t.id;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {editingId === t.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          void run(async () => {
                            if (editName.trim())
                              await repo.updateTeam(t.id, { name: editName.trim() });
                            setEditingId(null);
                          });
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => setEditingId(null)}
                      className="flex-1 rounded-lg bg-[var(--color-surface-2)] px-2 py-1 outline-none"
                    />
                  ) : (
                    <button
                      className="flex-1 text-left"
                      onClick={() => {
                        setEditingId(t.id);
                        setEditName(t.name);
                      }}
                    >
                      <span className="text-lg font-semibold">{t.name}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-dim)]">
                        {tr(t.playerIds.length === 1 ? 'admin.playerCount' : 'admin.playerCountPlural')
                          .replace('{count}', String(t.playerIds.length))}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                  >
                    {expanded ? tr('common.close') : tr('admin.playersButton')}
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: tr('admin.deleteTeamTitle').replace('{name}', t.name),
                        danger: true,
                        confirmLabel: tr('common.delete'),
                      });
                      if (ok) void run(() => repo.deleteTeam(t.id));
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                    aria-label={tr('common.delete')}
                  >
                    ✕
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-[var(--color-border)] p-3">
                    {/* captain account (one login per team) */}
                    <div className="mb-3 rounded-lg bg-[var(--color-surface-2)] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
                        {tr('admin.captainAccount')}
                      </p>
                      {captainOf(t.id) ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-[var(--color-accent-soft)] px-2 py-1 text-sm font-semibold text-[var(--color-accent)]">
                            {captainOf(t.id)}
                          </span>
                          <button
                            disabled={busy}
                            onClick={() => unassignCaptain(t.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--color-warning)] hover:bg-[var(--color-surface)]"
                          >
                            {tr('admin.captainRemove')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="email"
                            value={assignEmail}
                            onChange={(e) => setAssignEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') assignCaptain(t.id);
                            }}
                            placeholder={tr('admin.captainEmailPlaceholder')}
                            className="min-w-48 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                          />
                          <Button
                            variant="surface"
                            size="sm"
                            disabled={busy || !assignEmail.trim()}
                            onClick={() => assignCaptain(t.id)}
                          >
                            {tr('admin.captainAssign')}
                          </Button>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-[var(--color-text-mute)]">
                        {tr('admin.captainHint')}
                      </p>
                    </div>

                    {/* current members (removable) */}
                    {t.playerIds.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {t.playerIds.map((pid) => (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-accent)] bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white"
                          >
                            {playerName(pid)}
                            <button
                              disabled={busy}
                              onClick={() => removeMember(t, pid)}
                              className="text-white/80 hover:text-white"
                              aria-label={tr('setup.removePlayer')}
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-[var(--color-text-dim)]">
                        {tr('admin.noMembers')}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="surface"
                        size="sm"
                        disabled={busy}
                        onClick={() => openMemberPicker(t.id)}
                      >
                        {tr('admin.addPlayer')}
                      </Button>
                      <span className="text-xs text-[var(--color-text-mute)]">
                        {tr('admin.oneTeamOnly')}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={memberPickerTeam !== null}
        onClose={closeMemberPicker}
        title={memberPickerTeam ? `${tr('admin.addPlayer')} — ${memberPickerTeam.name}` : tr('admin.addPlayer')}
      >
        <input
          autoFocus
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          placeholder={tr('setup.searchPlayers')}
          className="mb-3 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 outline-none focus:border-[var(--color-accent)]"
        />
        <ul className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto">
          {addablePlayers.length === 0 ? (
            <li className="py-6 text-center text-sm text-[var(--color-text-dim)]">
              {tr('setup.noPlayerFound')}
            </li>
          ) : (
            addablePlayers.map((p) => (
              <li key={p.id}>
                <button
                  disabled={busy || !memberPickerTeam}
                  onClick={() => memberPickerTeam && addMember(memberPickerTeam, p.id)}
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
      </Modal>
    </div>
  );
}
