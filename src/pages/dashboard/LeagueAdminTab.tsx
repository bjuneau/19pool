import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/Card';
import { EntryFeeCard } from '../../components/EntryFeeCard';
import { Modal, ModalCancel, ModalDestructive } from '../../components/Modal';
import { deleteLeague as deleteLeagueHelper } from '../../lib/members';
import type { League, LeagueStatus } from '../../lib/types';

// Commissioner-only view of the league. Owns the league identity card
// (name / code / status / role), the entry-fee editor, and the
// Delete League affordance + confirmation. Members see the same
// information on their Account page instead — they don't have Admin.

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string };

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

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
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

      {/* League identity + status */}
      <Card>
        <h2 className="text-xl font-bold text-white mb-1">League</h2>
        <p className="text-sm text-slate-400 mb-6">
          Your league at a glance.
        </p>

        <div className="bg-navy-950/60 border border-white/10 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-white font-bold text-lg truncate">
                {league.name}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {leagueCode}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusPill(league.status).className}`}
            >
              {statusPill(league.status).label}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-3">
            Role: <span className="text-white font-semibold">Commissioner</span>
          </p>
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

      {/* Entry fee + season pot */}
      <EntryFeeCard
        league={league}
        leagueCode={leagueCode}
        isCommissioner={true}
        onToast={showToast}
      />

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
