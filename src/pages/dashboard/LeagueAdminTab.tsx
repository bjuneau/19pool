import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { Card } from '../../components/Card';
import { EntryFeeCard } from '../../components/EntryFeeCard';
import { LeagueModeCard } from '../../components/LeagueMode';
import { Modal, ModalCancel, ModalDestructive } from '../../components/Modal';
import { db } from '../../lib/firebase';
import { deleteLeague as deleteLeagueHelper } from '../../lib/members';
import type { League, LeagueStatus } from '../../lib/types';

// Commissioner-only view of the league. Owns the entry-fee editor
// (top) plus the league identity card underneath — name, code,
// status, rename, delete. Members see the same information on their
// Account page instead; they don't have Admin access.

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

const LEAGUE_NAME_MAX = 40;

function statusPill(status: LeagueStatus): { label: string; className: string } {
  switch (status) {
    case 'recruiting':
      return {
        label: 'Recruiting',
        className: 'bg-white/5 text-slate-300 border border-white/10',
      };
    case 'assigned':
      return {
        label: 'Teams Assigned',
        className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      };
    case 'in_season':
      return {
        label: 'In Season',
        className: 'bg-green-500/15 text-green-400 border border-green-500/30',
      };
    case 'complete':
      return {
        label: 'Complete',
        className: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
      };
  }
}

export default function LeagueAdminTab({
  league,
  leagueCode,
}: {
  league: League;
  leagueCode: string;
}) {
  const navigate = useNavigate();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTyped, setDeleteTyped] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<SaveStatus>({ kind: 'idle' });

  // Inline rename state — mirrors the EntryFeeCard's Edit / Save / Cancel
  // pattern so the affordance reads the same to a commissioner.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }

  function beginEditName() {
    setNameDraft(league.name);
    setNameError('');
    setEditingName(true);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError('League name is required.');
      return;
    }
    if (trimmed.length > LEAGUE_NAME_MAX) {
      setNameError(`Keep it under ${LEAGUE_NAME_MAX} characters.`);
      return;
    }
    if (trimmed === league.name) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    setNameError('');
    try {
      await updateDoc(doc(db, 'leagues', leagueCode), { name: trimmed });
      setEditingName(false);
      showToast('✓ League name updated.');
    } catch (err) {
      setNameError((err as { message?: string })?.message ?? 'Save failed.');
    } finally {
      setNameSaving(false);
    }
  }

  async function handleDeleteLeague() {
    if (deleteTyped !== league.name) return;
    setDeleteStatus({ kind: 'saving' });
    const result = await deleteLeagueHelper(league, leagueCode);
    if (!result.ok) {
      const message =
        result.reason === 'locked'
          ? "You can't delete a league while it's in season."
          : result.error ?? 'Delete failed.';
      setDeleteStatus({ kind: 'error', message });
      return;
    }
    setDeleteOpen(false);
    setDeleteStatus({ kind: 'idle' });
    setDeleteTyped('');
    showToast('✓ League deleted.');
    navigate('/dashboard', { replace: true });
  }

  const canDelete = league.status !== 'in_season';

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] bg-navy-900 border border-amber-500/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Entry fee + season pot */}
      <EntryFeeCard
        league={league}
        leagueCode={leagueCode}
        isCommissioner={true}
        onToast={showToast}
      />

      {/* How teams get assigned. Grouped with the entry fee as a league
          level setting rather than living on the Teams tab. */}
      <LeagueModeCard
        league={league}
        leagueCode={leagueCode}
        onToast={showToast}
      />

      {/* League identity + rename + delete */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-6">League Name</h2>

        <div className="bg-navy-950/60 border border-white/10 rounded-xl p-4">
          {/* Name row — takes the full width. In edit mode the input +
              Save + Cancel need room, so the status pill drops below
              instead of squeezing into the same row. */}
          {!editingName ? (
            <div className="flex items-center gap-3">
              <p className="text-white font-bold text-lg truncate flex-1 min-w-0">
                {league.name}
              </p>
              <button
                type="button"
                onClick={beginEditName}
                className="text-xs text-slate-400 hover:text-amber-400 transition-colors font-semibold flex-shrink-0"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={LEAGUE_NAME_MAX}
                autoFocus
                className="flex-1 min-w-0 bg-navy-950/80 border border-white/10 text-white text-base font-bold px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500/50"
              />
              <button
                type="button"
                onClick={() => void saveName()}
                disabled={nameSaving}
                className="text-xs bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-3 py-1.5 rounded-lg disabled:opacity-60"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setNameError('');
                }}
                disabled={nameSaving}
                className="text-xs text-slate-400 hover:text-white px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          )}
          {nameError && (
            <p className="text-red-400 text-xs mt-2">{nameError}</p>
          )}

          {/* Meta row: code + role on the left, status pill on the right. */}
          <div className="flex items-end justify-between gap-3 mt-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-mono">{leagueCode}</p>
              <p className="text-sm text-slate-400 mt-2">
                Role:{' '}
                <span className="text-white font-semibold">Commissioner</span>
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusPill(league.status).className}`}
            >
              {statusPill(league.status).label}
            </span>
          </div>
        </div>

        <div className="mt-4">
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                setDeleteStatus({ kind: 'idle' });
                setDeleteTyped('');
                setDeleteOpen(true);
              }}
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-3 rounded-xl transition-colors"
            >
              Delete League
            </button>
          ) : (
            <p className="text-xs text-slate-500 italic">
              You can't delete a league while it's in season.
            </p>
          )}
        </div>
      </Card>

      {/* Delete league modal */}
      {deleteOpen && (
        <Modal
          onClose={() =>
            deleteStatus.kind !== 'saving' && setDeleteOpen(false)
          }
        >
          <h2 className="text-white font-bold text-lg mb-3">Delete this league?</h2>
          <p className="text-slate-400 text-sm mb-4">
            This permanently deletes the league and removes all members. This
            cannot be undone.
          </p>
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1.5">
              Type{' '}
              <span className="text-white font-mono font-semibold">
                {league.name}
              </span>{' '}
              to confirm:
            </p>
            <input
              type="text"
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              autoFocus
              className="w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-2.5 rounded-xl text-sm"
            />
          </div>
          {deleteStatus.kind === 'error' && (
            <p className="text-red-400 text-sm mb-4">
              {deleteStatus.message}
            </p>
          )}
          <div className="flex gap-3">
            <ModalCancel
              disabled={deleteStatus.kind === 'saving'}
              onClick={() => setDeleteOpen(false)}
            />
            <ModalDestructive
              disabled={
                deleteTyped !== league.name ||
                deleteStatus.kind === 'saving'
              }
              onClick={() => void handleDeleteLeague()}
              label={
                deleteStatus.kind === 'saving' ? 'Deleting…' : 'Delete League'
              }
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
