import { useEffect, useRef, useState } from 'react';
import {
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { LeagueModeModal, MODE_COPY } from '../../components/LeagueMode';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { executeReshuffle, preflightReshuffle } from '../../lib/reshuffle';
import type { PreflightResult } from '../../lib/reshuffle';
import { membersCollectionRef, sortMembers } from '../../lib/members';
import type { MemberWithId } from '../../lib/members';
import { TEAM_BY_ABBR, TEAM_COUNT } from '../../lib/teams';
import { distributeTeams, swapTeams } from '../../lib/teamAssignment';
import type { League, LeagueMode } from '../../lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  leagueCode: string;
  league: League;
};

type ModalKind = 'none' | 'assign' | 'reroll' | 'lock';

type DragPayload = {
  team: string;
  fromId: string | null; // null = unowned pool
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamsTab({ leagueCode, league }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberWithId[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [modal, setModal] = useState<ModalKind>('none');
  const [writing, setWriting] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [lockError, setLockError] = useState('');

  // League mode ("how teams get assigned"). Editable until the season starts.
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [savingMode, setSavingMode] = useState(false);
  const [modeError, setModeError] = useState('');

  // Roulette reshuffle.
  const [reshuffleOpen, setReshuffleOpen] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState(false);
  const [reshuffling, setReshuffling] = useState(false);

  // Drag state
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragOverId, setDragOverId] = useState<string | 'unowned' | null>(null);

  // Tap-to-move state — the touch/click equivalent of drag. HTML5 drag events
  // don't fire on touch devices, so mobile users go tap-chip → tap-card.
  // Also usable on desktop as an accessible alternative.
  const [tapSelected, setTapSelected] = useState<{
    team: string;
    fromId: string | null;
  } | null>(null);

  // Track toast
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      membersCollectionRef(leagueCode),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MemberWithId, 'id'>),
        }));
        setMembers(sortMembers(list));
        setLoadingMembers(false);
      },
      () => setLoadingMembers(false)
    );
    return unsub;
  }, [leagueCode]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  // ── Roster change detection ────────────────────────────────────────────────

  const assignedMemberCount = members.filter((m) => m.teams.length > 0).length;
  const rosterMismatch =
    league.status === 'assigned' &&
    !league.skipReassignmentCheck &&
    assignedMemberCount > 0 &&
    assignedMemberCount !== members.length;

  const newMemberNames = rosterMismatch
    ? members
        .filter((m) => m.teams.length === 0)
        .map((m) => m.name || m.email)
        .join(', ')
    : '';

  // ── Assign teams ──────────────────────────────────────────────────────────

  async function handleAssignTeams() {
    setModal('none');
    setWriting(true);
    setWriteError('');
    try {
      const joinedMembers = members.filter((m) => m.joinedAt != null);
      const { assignments, unowned } = distributeTeams(joinedMembers.map((m) => m.id));

      const batch = writeBatch(db);
      for (const m of joinedMembers) {
        batch.update(doc(db, 'leagues', leagueCode, 'members', m.id), {
          teams: assignments[m.id] ?? [],
        });
      }
      batch.update(doc(db, 'leagues', leagueCode), {
        unownedTeams: unowned,
        teamsAssignedAt: serverTimestamp(),
        status: 'assigned',
        skipReassignmentCheck: false,
      });
      await batch.commit();
      showToast('🎲 Teams assigned!');
    } catch (err) {
      setWriteError((err as { message?: string })?.message ?? 'Write failed. Try again.');
    } finally {
      setWriting(false);
    }
  }

  // ── Reroll ────────────────────────────────────────────────────────────────

  async function handleReroll() {
    setModal('none');
    setWriting(true);
    setWriteError('');
    try {
      const joinedMembers = members.filter((m) => m.joinedAt != null);
      const { assignments, unowned } = distributeTeams(joinedMembers.map((m) => m.id));

      const batch = writeBatch(db);
      for (const m of joinedMembers) {
        batch.update(doc(db, 'leagues', leagueCode, 'members', m.id), {
          teams: assignments[m.id] ?? [],
        });
      }
      // Clear teams for anyone who hasn't joined yet (pending invites)
      for (const m of members.filter((m) => m.joinedAt == null)) {
        batch.update(doc(db, 'leagues', leagueCode, 'members', m.id), { teams: [] });
      }
      batch.update(doc(db, 'leagues', leagueCode), {
        unownedTeams: unowned,
        teamsAssignedAt: serverTimestamp(),
        skipReassignmentCheck: false,
      });
      await batch.commit();
      showToast('🎲 Teams rerolled!');
    } catch (err) {
      setWriteError((err as { message?: string })?.message ?? 'Write failed. Try again.');
    } finally {
      setWriting(false);
    }
  }

  // ── Dismiss mismatch (manually assign) ───────────────────────────────────

  async function handleDismissMismatch() {
    try {
      await updateDoc(doc(db, 'leagues', leagueCode), {
        skipReassignmentCheck: true,
      });
    } catch {
      // Non-critical — the banner will reappear on next load but that's fine.
    }
  }

  // ── Lock league ──────────────────────────────────────────────────────────

  async function handleLockLeague() {
    setModal('none');
    setLockError('');

    // Validation
    const noTeamMembers = members.filter(
      (m) => m.joinedAt != null && m.teams.length === 0
    );
    if (noTeamMembers.length > 0) {
      const names = noTeamMembers.map((m) => m.name || m.email).join(', ');
      setLockError(
        `All players must have teams before locking. ${noTeamMembers.length} player${noTeamMembers.length === 1 ? '' : 's'} without teams: ${names}`
      );
      return;
    }

    const totalAssigned = members.reduce((sum, m) => sum + m.teams.length, 0);
    const totalUnowned = (league.unownedTeams ?? []).length;
    if (totalAssigned + totalUnowned !== TEAM_COUNT) {
      setLockError(
        `Team count mismatch: ${totalAssigned} assigned + ${totalUnowned} unowned = ${totalAssigned + totalUnowned}, expected ${TEAM_COUNT}. Try rerolling.`
      );
      return;
    }

    setWriting(true);
    try {
      await updateDoc(doc(db, 'leagues', leagueCode), {
        status: 'in_season',
        lockedAt: serverTimestamp(),
      });
      showToast('🔒 League locked! Season begins. Good luck!');
    } catch (err) {
      setLockError((err as { message?: string })?.message ?? 'Lock failed. Try again.');
    } finally {
      setWriting(false);
    }
  }

  // ── League mode ───────────────────────────────────────────────────────────

  async function handleSaveMode(next: LeagueMode) {
    setSavingMode(true);
    setModeError('');
    try {
      await updateDoc(doc(db, 'leagues', leagueCode), { mode: next });
      setModeModalOpen(false);
      showToast(`Mode set to ${MODE_COPY[next].label}`);
    } catch (err) {
      setModeError(
        (err as { message?: string })?.message ?? 'Could not save mode. Try again.'
      );
    } finally {
      setSavingMode(false);
    }
  }

  // ── Roulette reshuffle ────────────────────────────────────────────────────

  async function openReshuffle() {
    setReshuffleOpen(true);
    setPreflight(null);
    setCheckingPreflight(true);
    try {
      setPreflight(await preflightReshuffle(league));
    } catch (err) {
      setPreflight({
        ok: false,
        week: null,
        reason: 'Could not verify the schedule.',
        details: [(err as Error).message],
      });
    } finally {
      setCheckingPreflight(false);
    }
  }

  async function handleReshuffle() {
    if (!preflight?.ok || !user) return;
    setReshuffling(true);
    setWriteError('');
    try {
      const outcome = await executeReshuffle(
        leagueCode,
        league,
        members,
        preflight.week,
        user.uid
      );
      if (outcome.ok) {
        setReshuffleOpen(false);
        showToast(
          `🎲 Teams reshuffled for ${outcome.membersReassigned} player${
            outcome.membersReassigned === 1 ? '' : 's'
          }`
        );
      } else {
        setReshuffleOpen(false);
        setWriteError(outcome.message);
      }
    } finally {
      setReshuffling(false);
    }
  }

  // ── Move commit (shared by drag-and-drop and tap-to-move) ─────────────────

  async function commitMove(
    team: string,
    fromId: string | null,
    toId: string | null
  ) {
    if (fromId === toId) return; // same source → no-op

    // Build current assignment state from live members.
    const current = {
      assignments: Object.fromEntries(members.map((m) => [m.id, [...m.teams]])),
      unowned: [...(league.unownedTeams ?? [])],
    };
    const next = swapTeams(current, team, fromId, toId);

    setWriting(true);
    try {
      const batch = writeBatch(db);
      if (fromId !== null) {
        batch.update(doc(db, 'leagues', leagueCode, 'members', fromId), {
          teams: next.assignments[fromId] ?? [],
        });
      }
      if (toId !== null) {
        batch.update(doc(db, 'leagues', leagueCode, 'members', toId), {
          teams: next.assignments[toId] ?? [],
        });
      }
      batch.update(doc(db, 'leagues', leagueCode), {
        unownedTeams: next.unowned,
      });
      await batch.commit();
    } catch (err) {
      setWriteError((err as { message?: string })?.message ?? 'Swap failed. Try again.');
    } finally {
      setWriting(false);
    }
  }

  // Drag flow: HTML5 drag-and-drop, desktop only in practice.
  async function handleDrop(toId: string | null) {
    if (!dragPayload) return;
    const { team, fromId } = dragPayload;
    setDragPayload(null);
    setDragOverId(null);
    await commitMove(team, fromId, toId);
  }

  // Tap flow: touch-friendly alternative. Tap a chip to select it, tap a
  // member/unowned card to move it there.
  function handleChipTap(team: string, fromId: string | null) {
    setTapSelected((cur) => {
      if (cur && cur.team === team && cur.fromId === fromId) return null; // deselect
      return { team, fromId };
    });
  }

  async function handleZoneTap(toId: string | null) {
    const sel = tapSelected;
    if (!sel) return;
    setTapSelected(null);
    await commitMove(sel.team, sel.fromId, toId);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingMembers) {
    return <p className="text-slate-500 text-sm">Loading…</p>;
  }

  const joinedMembers = members.filter((m) => m.joinedAt != null);
  const unownedTeams = league.unownedTeams ?? [];
  const isLocked = league.status === 'in_season';
  const isComplete = league.status === 'complete';
  // Editing is enabled for assigned/in_season/complete. Only recruiting is
  // the empty pre-assignment state.
  const isPostLock = isLocked || isComplete;
  // Reshuffle is a Roulette-only, in-season, commissioner-only action. Super
  // users are deliberately excluded: this rewrites every roster in someone
  // else's league and should be the commissioner's own call.
  const canReshuffle =
    league.mode === 'roulette' &&
    isLocked &&
    !!user &&
    user.uid === league.commissionerId;

  return (
    <div className="space-y-6 relative">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-navy-700 border border-amber-500/30 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Tap-to-move active pill. Sticky above the panels so a moving-away
          finger can still hit Cancel. */}
      {tapSelected && (
        <div className="sticky top-2 z-30 flex justify-center pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-3 bg-navy-900 border border-amber-500/40 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-2xl">
            <span>
              Move{' '}
              <span className="text-amber-400 font-mono">{tapSelected.team}</span>{' '}
              — tap a member card
            </span>
            <button
              type="button"
              onClick={() => setTapSelected(null)}
              className="text-slate-400 hover:text-white transition-colors text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Write error */}
      {writeError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
          {writeError}
          <button
            className="ml-3 underline text-red-300"
            onClick={() => setWriteError('')}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* League mode. Commissioner-only by virtue of where this tab lives.
          Editable pre-lock; frozen once the season starts. */}
      <LeagueModeSection
        mode={league.mode}
        locked={isPostLock}
        onChange={() => { setModeError(''); setModeModalOpen(true); }}
      />

      {/* ── STATUS: recruiting ───────────────────────────────────────────── */}
      {league.status === 'recruiting' && (
        <RecruitingState
          memberCount={joinedMembers.length}
          onAssign={() => setModal('assign')}
          disabled={writing}
        />
      )}

      {/* ── STATUS: assigned ─────────────────────────────────────────────── */}
      {league.status === 'assigned' && (
        <>
          {/* Header bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-white font-bold text-lg">Teams assigned</p>
              <p className="text-slate-400 text-sm">
                {joinedMembers.length} player{joinedMembers.length === 1 ? '' : 's'} ·{' '}
                {unownedTeams.length} unowned
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModal('reroll')}
                disabled={writing}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 text-slate-300 hover:text-white hover:border-white/30 transition-all disabled:opacity-50"
              >
                Reroll
              </button>
              <button
                type="button"
                onClick={() => { setLockError(''); setModal('lock'); }}
                disabled={writing}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold transition-all disabled:opacity-50"
              >
                Lock League
              </button>
            </div>
          </div>

          {/* Lock error (from validation) */}
          {lockError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
              {lockError}
              <button
                className="ml-3 underline text-red-300"
                onClick={() => setLockError('')}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Roster mismatch banner — hot vermillion so it reads as
              caution instead of borrowing the brand-lime accent. */}
          {rosterMismatch && (
            <div className="bg-hot-dim border border-hot/40 rounded-xl px-4 py-4">
              <p className="text-hot font-semibold text-sm mb-1">
                ⚠️ Roster changed
              </p>
              <p className="text-ink-dim text-sm mb-3">
                {newMemberNames} joined after teams were assigned. Choose how to handle:
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModal('reroll')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-navy-950 text-xs font-bold rounded-lg transition-all"
                >
                  Reroll All Teams
                </button>
                <button
                  type="button"
                  onClick={handleDismissMismatch}
                  className="px-3 py-1.5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Manually Assign
                </button>
              </div>
            </div>
          )}

          {/* Writing overlay hint */}
          {writing && (
            <p className="text-slate-500 text-xs text-right">Saving…</p>
          )}

          {/* Member panels */}
          {joinedMembers.map((m) => (
            <MemberTeamCard
              key={m.id}
              member={m}
              isDragOver={dragOverId === m.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(m.id); }}
              onDragLeave={() => { if (dragOverId === m.id) setDragOverId(null); }}
              onDrop={() => handleDrop(m.id)}
              onTeamDragStart={(team) => setDragPayload({ team, fromId: m.id })}
              onTeamDragEnd={() => { setDragPayload(null); setDragOverId(null); }}
              readonly={false}
              selectedTeamAbbr={tapSelected?.fromId === m.id ? tapSelected.team : null}
              hasSelection={!!tapSelected}
              onChipTap={(team) => handleChipTap(team, m.id)}
              onCardTap={() => handleZoneTap(m.id)}
            />
          ))}

          {/* Unowned panel */}
          <UnownedCard
            teams={unownedTeams}
            isDragOver={dragOverId === 'unowned'}
            onDragOver={(e) => { e.preventDefault(); setDragOverId('unowned'); }}
            onDragLeave={() => { if (dragOverId === 'unowned') setDragOverId(null); }}
            onDrop={() => handleDrop(null)}
            onTeamDragStart={(team) => setDragPayload({ team, fromId: null })}
            onTeamDragEnd={() => { setDragPayload(null); setDragOverId(null); }}
            readonly={false}
            selectedTeamAbbr={tapSelected?.fromId === null ? tapSelected.team : null}
            hasSelection={!!tapSelected}
            onChipTap={(team) => handleChipTap(team, null)}
            onCardTap={() => handleZoneTap(null)}
          />
        </>
      )}

      {/* ── STATUS: in_season / complete ─────────────────────────────────── */}
      {/* Editable post-lock. Reroll/Lock buttons hidden; a warning banner
          replaces them so the commissioner knows changes affect only future
          weeks and never historical results. */}
      {isPostLock && (
        <>
          {/* Warning banner — hot vermillion */}
          <div className="bg-hot-dim border border-hot/40 rounded-xl px-4 py-4">
            <p className="text-hot font-semibold text-sm mb-1">
              ⚠️{' '}
              {isLocked ? 'Season is in progress' : 'Season is over'}
            </p>
            <p className="text-ink-dim text-sm leading-relaxed">
              {isLocked
                ? "Changes affect this week's winner detection and future payouts. Past weekly results are not changed. Remove players from the Players tab, or drag teams here to reassign them."
                : "Edits here are for correcting errors after the fact. Existing weekly results and payouts don't change."}
            </p>
          </div>

          {/* Compact header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{isLocked ? '🏈' : '🏁'}</span>
              <div>
                <p className="text-white font-bold">
                  {isLocked ? 'Season in progress' : 'Season complete'}
                </p>
                {league.lockedAt && (
                  <p className="text-slate-400 text-xs">
                    Locked on{' '}
                    {new Date(league.lockedAt.toMillis()).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-slate-400 text-sm">
                {joinedMembers.length} member{joinedMembers.length === 1 ? '' : 's'} ·{' '}
                {unownedTeams.length} unowned
              </p>
              {canReshuffle && (
                <button
                  type="button"
                  onClick={openReshuffle}
                  disabled={writing || reshuffling}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-navy-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reshuffle Teams
                </button>
              )}
            </div>
          </div>

          {writing && (
            <p className="text-slate-500 text-xs text-right">Saving…</p>
          )}

          {/* Editable member + unowned panels — same handlers as the
              'assigned' branch. handleDrop persists to Firestore and the
              onSnapshot listener drives the re-render. */}
          {joinedMembers.map((m) => (
            <MemberTeamCard
              key={m.id}
              member={m}
              isDragOver={dragOverId === m.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverId(m.id); }}
              onDragLeave={() => { if (dragOverId === m.id) setDragOverId(null); }}
              onDrop={() => handleDrop(m.id)}
              onTeamDragStart={(team) => setDragPayload({ team, fromId: m.id })}
              onTeamDragEnd={() => { setDragPayload(null); setDragOverId(null); }}
              readonly={false}
              selectedTeamAbbr={tapSelected?.fromId === m.id ? tapSelected.team : null}
              hasSelection={!!tapSelected}
              onChipTap={(team) => handleChipTap(team, m.id)}
              onCardTap={() => handleZoneTap(m.id)}
            />
          ))}

          <UnownedCard
            teams={unownedTeams}
            isDragOver={dragOverId === 'unowned'}
            onDragOver={(e) => { e.preventDefault(); setDragOverId('unowned'); }}
            onDragLeave={() => { if (dragOverId === 'unowned') setDragOverId(null); }}
            onDrop={() => handleDrop(null)}
            onTeamDragStart={(team) => setDragPayload({ team, fromId: null })}
            onTeamDragEnd={() => { setDragPayload(null); setDragOverId(null); }}
            readonly={false}
            selectedTeamAbbr={tapSelected?.fromId === null ? tapSelected.team : null}
            hasSelection={!!tapSelected}
            onChipTap={(team) => handleChipTap(team, null)}
            onCardTap={() => handleZoneTap(null)}
          />
        </>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {reshuffleOpen && (
        <ReshuffleModal
          checking={checkingPreflight}
          preflight={preflight}
          reshuffling={reshuffling}
          memberCount={joinedMembers.length}
          onConfirm={handleReshuffle}
          onCancel={() => setReshuffleOpen(false)}
        />
      )}
      {modeModalOpen && (
        <LeagueModeModal
          current={league.mode}
          status={league.status}
          saving={savingMode}
          error={modeError}
          onSave={handleSaveMode}
          onCancel={() => setModeModalOpen(false)}
        />
      )}
      {modal === 'assign' && (
        <ConfirmModal
          title="Assign teams?"
          body={`Assign teams to all ${joinedMembers.length} joined member${joinedMembers.length === 1 ? '' : 's'}? You'll be able to reroll or manually adjust before locking.`}
          confirmLabel="Assign Teams"
          onConfirm={handleAssignTeams}
          onCancel={() => setModal('none')}
        />
      )}
      {modal === 'reroll' && (
        <ConfirmModal
          title="Reroll teams?"
          body="This will randomize all assignments. Any manual swaps will be lost."
          confirmLabel="Reroll"
          danger
          onConfirm={handleReroll}
          onCancel={() => setModal('none')}
        />
      )}
      {modal === 'lock' && (
        <ConfirmModal
          title="Lock the league and start the season?"
          body={
            <ul className="list-disc list-inside text-slate-300 text-sm space-y-1 mt-2">
              <li>Add or remove players</li>
              <li>Change team assignments</li>
              <li>Send new invites</li>
            </ul>
          }
          bodyPrefix="Once locked, you can't:"
          confirmLabel="Lock League"
          danger
          onConfirm={handleLockLeague}
          onCancel={() => setModal('none')}
        />
      )}
    </div>
  );
}

// ─── Reshuffle modal ──────────────────────────────────────────────────────────

function ReshuffleModal({
  checking,
  preflight,
  reshuffling,
  memberCount,
  onConfirm,
  onCancel,
}: {
  checking: boolean;
  preflight: PreflightResult | null;
  reshuffling: boolean;
  memberCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const blocked = preflight !== null && !preflight.ok;
  const ready = preflight !== null && preflight.ok;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={reshuffling ? undefined : onCancel}
      />
      <div className="relative z-50 w-full max-w-md bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-3">
          {ready ? `Reshuffle teams for Week ${preflight.week}?` : 'Reshuffle teams'}
        </h2>

        {checking && (
          <p className="text-slate-400 text-sm mb-2 flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            Checking the schedule with ESPN…
          </p>
        )}

        {blocked && !preflight.ok && (
          <div className="mb-2">
            <p className="text-hot font-semibold text-sm mb-2">
              Cannot reshuffle right now
            </p>
            <p className="text-slate-400 text-sm leading-relaxed">
              {preflight.reason}
            </p>
            {preflight.details.length > 0 && (
              <ul className="list-disc list-inside text-slate-500 text-xs mt-2 space-y-1">
                {preflight.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {ready && (
          <div className="text-slate-400 text-sm leading-relaxed space-y-2 mb-2">
            <p>
              Week {preflight.week} is final and next week has not kicked off, so
              this is a safe moment to reshuffle.
            </p>
            <p>
              All 32 NFL teams get redealt across{' '}
              <span className="text-amber-400 font-semibold">
                {memberCount} player{memberCount === 1 ? '' : 's'}
              </span>
              . Everyone gets a new set of teams, and nobody keeps what they had.
            </p>
            <p>
              Week {preflight.week} results and payouts are locked first, so past
              weeks are not affected. This cannot be undone.
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={reshuffling}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {blocked ? 'Close' : 'Cancel'}
          </button>
          {!blocked && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={!ready || reshuffling}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {reshuffling ? 'Reshuffling…' : 'Reshuffle Teams'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── League mode section ──────────────────────────────────────────────────────

function LeagueModeSection({
  mode,
  locked,
  onChange,
}: {
  mode: LeagueMode;
  locked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="bg-navy-950/60 border border-white/10 rounded-2xl px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-white font-bold text-sm">
          League Mode:{' '}
          <span className="text-amber-400">{MODE_COPY[mode].label}</span>
        </p>
        {locked ? (
          <p className="text-slate-500 text-xs italic">
            Mode is locked once the season starts.
          </p>
        ) : (
          <button
            type="button"
            onClick={onChange}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-slate-300 hover:text-white hover:border-white/30 transition-all"
          >
            Change
          </button>
        )}
      </div>
      <p className="text-slate-400 text-xs mt-1 leading-relaxed">
        {MODE_COPY[mode].short}
      </p>
    </div>
  );
}

// ─── Recruiting state ─────────────────────────────────────────────────────────

function RecruitingState({
  memberCount,
  onAssign,
  disabled,
}: {
  memberCount: number;
  onAssign: () => void;
  disabled: boolean;
}) {
  const MIN_MEMBERS = 8;
  const canAssign = memberCount >= MIN_MEMBERS;
  const perMember = memberCount > 0 ? Math.floor(TEAM_COUNT / memberCount) : 0;
  const leftover = memberCount > 0 ? TEAM_COUNT % memberCount : 0;

  return (
    <div className="space-y-4">
      <div className="bg-navy-950/60 border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-slate-400 text-sm mb-2">No teams assigned yet.</p>
        <p className="text-slate-500 text-xs mb-6 leading-relaxed">
          Once you have at least {MIN_MEMBERS} members, you can assign teams. Each
          member gets an equal share of the 32 NFL franchises. Leftover teams stay
          unowned.
        </p>

        {memberCount > 0 && (
          <p className="text-xs text-slate-400 mb-6 bg-navy-950/80 border border-white/10 rounded-xl px-4 py-3">
            {canAssign ? (
              <>
                If you assign now:{' '}
                <span className="text-white font-semibold">{memberCount} members</span>
                {' → '}
                <span className="text-amber-400 font-semibold">
                  {perMember} team{perMember === 1 ? '' : 's'} each
                </span>
                {leftover > 0 && (
                  <>, {leftover} team{leftover === 1 ? '' : 's'} unowned</>
                )}
              </>
            ) : (
              <>
                Add at least {MIN_MEMBERS} members first —{' '}
                <span className="text-white font-semibold">
                  currently {memberCount}
                </span>
              </>
            )}
          </p>
        )}

        <button
          type="button"
          onClick={onAssign}
          disabled={!canAssign || disabled}
          className="bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-8 py-3 rounded-xl transition-all tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Assign Teams
        </button>

        {!canAssign && memberCount > 0 && (
          <p className="text-slate-500 text-xs mt-3">
            Add at least {MIN_MEMBERS} members first — currently {memberCount}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Member team card ─────────────────────────────────────────────────────────

function MemberTeamCard({
  member,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onTeamDragStart,
  onTeamDragEnd,
  readonly,
  selectedTeamAbbr,
  hasSelection,
  onChipTap,
  onCardTap,
}: {
  member: MemberWithId;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onTeamDragStart: (team: string) => void;
  onTeamDragEnd: () => void;
  readonly: boolean;
  selectedTeamAbbr: string | null;
  hasSelection: boolean;
  onChipTap: (team: string) => void;
  onCardTap: () => void;
}) {
  const initials =
    ((member.firstName || '').charAt(0) + (member.lastName || '').charAt(0))
      .toUpperCase()
      .slice(0, 2) || '?';
  const isTapTarget = hasSelection && !readonly && selectedTeamAbbr === null;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={readonly ? undefined : onCardTap}
      className={`bg-navy-950/60 border rounded-2xl p-4 transition-all ${
        isDragOver || isTapTarget
          ? 'border-amber-500/60 bg-amber-500/5'
          : 'border-white/10'
      } ${isTapTarget ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-paper-3 border border-ink-line text-ink font-bold text-sm flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {member.name || member.email}
          </p>
          <p className="text-xs text-slate-500 truncate">{member.email}</p>
        </div>
        {member.teams.length === 0 && (
          <span className="ml-auto flex-shrink-0 text-xs text-slate-500 italic">
            no teams
          </span>
        )}
      </div>
      {member.teams.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {member.teams.map((abbr) => (
            <TeamChip
              key={abbr}
              abbr={abbr}
              draggable={!readonly}
              onDragStart={() => onTeamDragStart(abbr)}
              onDragEnd={onTeamDragEnd}
              isSelected={selectedTeamAbbr === abbr}
              onClick={readonly ? undefined : () => onChipTap(abbr)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Unowned teams card ───────────────────────────────────────────────────────

function UnownedCard({
  teams,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onTeamDragStart,
  onTeamDragEnd,
  readonly,
  selectedTeamAbbr,
  hasSelection,
  onChipTap,
  onCardTap,
}: {
  teams: string[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onTeamDragStart: (team: string) => void;
  onTeamDragEnd: () => void;
  readonly: boolean;
  selectedTeamAbbr: string | null;
  hasSelection: boolean;
  onChipTap: (team: string) => void;
  onCardTap: () => void;
}) {
  const isTapTarget = hasSelection && !readonly && selectedTeamAbbr === null;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={readonly ? undefined : onCardTap}
      className={`bg-navy-950/60 border rounded-2xl p-4 transition-all ${
        isDragOver || isTapTarget
          ? 'border-amber-500/60 bg-amber-500/5'
          : 'border-white/10'
      } ${isTapTarget ? 'cursor-pointer' : ''}`}
    >
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
        Unowned Teams
        {teams.length > 0 && (
          <span className="ml-2 text-slate-500 normal-case tracking-normal font-normal">
            ({teams.length})
          </span>
        )}
      </p>
      {teams.length === 0 ? (
        <p className="text-slate-600 text-sm italic">
          {isDragOver || isTapTarget ? 'Drop here to unassign' : 'All teams are assigned'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {teams.map((abbr) => (
            <TeamChip
              key={abbr}
              abbr={abbr}
              draggable={!readonly}
              onDragStart={() => onTeamDragStart(abbr)}
              onDragEnd={onTeamDragEnd}
              isSelected={selectedTeamAbbr === abbr}
              onClick={readonly ? undefined : () => onChipTap(abbr)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Team chip ────────────────────────────────────────────────────────────────

function TeamChip({
  abbr,
  draggable,
  onDragStart,
  onDragEnd,
  isSelected,
  onClick,
}: {
  abbr: string;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const team = TEAM_BY_ABBR[abbr];
  const label = team ? `${abbr} · ${team.name}` : abbr;
  const isInteractive = !!onClick;

  return (
    <span
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={
        onClick
          ? (e) => {
              // Prevent the containing card's onClick (which would treat this
              // as a "move selected team here" tap) from firing.
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={team?.fullName ?? abbr}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border select-none transition-all ${
        isSelected
          ? 'bg-amber-500/20 border-amber-500 text-white ring-2 ring-amber-500/60'
          : 'bg-navy-950/80 border-white/10 text-slate-200'
      } ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${
        isInteractive && !isSelected ? 'hover:border-amber-500/40 hover:text-white' : ''
      }`}
    >
      {label}
    </span>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  bodyPrefix,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: React.ReactNode;
  bodyPrefix?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Panel */}
      <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        <h2 className="text-white font-bold text-lg mb-3">{title}</h2>
        {bodyPrefix && (
          <p className="text-slate-400 text-sm mb-1">{bodyPrefix}</p>
        )}
        {typeof body === 'string' ? (
          <p className="text-slate-400 text-sm mb-6">{body}</p>
        ) : (
          <div className="mb-6">{body}</div>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              danger
                ? 'bg-red-500 hover:bg-red-400 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-navy-950'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
