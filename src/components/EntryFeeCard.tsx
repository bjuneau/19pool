import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Card } from './Card';
import { Modal, ModalCancel } from './Modal';
import { db } from '../lib/firebase';
import {
  computeWeeklyShareFromPot,
  getSeasonPot,
  isPotManuallySet,
} from '../lib/scoring';
import type { League } from '../lib/types';

// Shared entry-fee / pot card. Renders the numbers everyone sees plus
// the commissioner-only edit affordances. Also owns the Venmo pay
// button for non-commissioners.

function fmtDollars(n: number): string {
  return (
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  );
}

type PotChoice = 'keep' | 'sync';

export function EntryFeeCard({
  league,
  leagueCode,
  isCommissioner,
  onToast,
}: {
  league: League;
  leagueCode: string;
  isCommissioner: boolean;
  onToast: (msg: string) => void;
}) {
  const entry = league.seasonEntry;
  const memberCount = league.memberCount ?? 0;
  const autoPot = entry * memberCount;
  const pot = getSeasonPot(league);
  const isManual = isPotManuallySet(league);
  const weeklyShare = computeWeeklyShareFromPot(pot);

  const [editingEntry, setEditingEntry] = useState(false);
  const [entryDraft, setEntryDraft] = useState('');
  const [editingPot, setEditingPot] = useState(false);
  const [potDraft, setPotDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const [potChoiceModal, setPotChoiceModal] = useState<{ newPot: number } | null>(null);
  const [potChoice, setPotChoice] = useState<PotChoice | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  function beginEditEntry() {
    setEntryDraft(String(entry));
    setFieldError('');
    setEditingEntry(true);
  }

  async function saveEntry() {
    const n = parseInt(entryDraft, 10);
    if (Number.isNaN(n) || n < 1) {
      setFieldError('Enter a positive whole-dollar amount.');
      return;
    }
    setSaving(true);
    setFieldError('');
    try {
      const update: Record<string, unknown> = { seasonEntry: n };
      if (isManual) update.potOverride = null;
      await updateDoc(doc(db, 'leagues', leagueCode), update);
      setEditingEntry(false);
      if (isManual) {
        onToast(
          `✓ Entry updated. Pot recalculated to $${(n * memberCount).toLocaleString('en-US')}.`
        );
      } else {
        onToast('✓ Entry updated.');
      }
    } catch (err) {
      setFieldError((err as { message?: string })?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function beginEditPot() {
    setPotDraft(String(pot));
    setFieldError('');
    setEditingPot(true);
  }

  async function savePot() {
    const n = parseInt(potDraft, 10);
    if (Number.isNaN(n) || n < 1) {
      setFieldError('Enter a positive whole-dollar amount.');
      return;
    }
    if (n === autoPot) {
      setSaving(true);
      setFieldError('');
      try {
        await updateDoc(doc(db, 'leagues', leagueCode), { potOverride: null });
        setEditingPot(false);
        onToast('✓ Pot back to auto.');
      } catch (err) {
        setFieldError((err as { message?: string })?.message ?? 'Save failed.');
      } finally {
        setSaving(false);
      }
      return;
    }
    setPotChoice(null);
    setPotChoiceModal({ newPot: n });
  }

  async function confirmPotChoice() {
    if (!potChoiceModal || !potChoice) return;
    const { newPot } = potChoiceModal;
    setSaving(true);
    try {
      if (potChoice === 'keep') {
        await updateDoc(doc(db, 'leagues', leagueCode), { potOverride: newPot });
      } else {
        const newEntry = memberCount > 0 ? Math.round(newPot / memberCount) : 0;
        await updateDoc(doc(db, 'leagues', leagueCode), {
          seasonEntry: newEntry,
          potOverride: null,
        });
      }
      setPotChoiceModal(null);
      setPotChoice(null);
      setEditingPot(false);
      onToast('✓ Pot updated.');
    } catch (err) {
      setFieldError((err as { message?: string })?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function resetToAuto() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'leagues', leagueCode), { potOverride: null });
      setResetModalOpen(false);
      onToast('✓ Pot reset to auto.');
    } catch (err) {
      setFieldError((err as { message?: string })?.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const venmoHandle = (league.venmo ?? '').trim().replace(/^@/, '');
  const commishName = league.commissionerName?.trim() || 'the commissioner';
  const payVenmoUrl = venmoHandle
    ? `https://venmo.com/${venmoHandle}?txn=pay&amount=${entry}&note=${encodeURIComponent(
        `${league.name} entry fee`
      )}`
    : null;

  return (
    <>
      <Card>
        <h2 className="text-xl font-bold text-white mb-1">Entry Fee</h2>
        <p className="text-sm text-slate-400 mb-6">
          {isCommissioner
            ? 'Per-player entry, season pot, and weekly payout. Everyone in your league sees these numbers.'
            : `The buy-in for this league. Pay ${commishName} via Venmo to lock in your spot.`}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:divide-x sm:divide-white/10">
          {/* Per-player entry */}
          <div className="sm:pr-5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Per-Player Entry
            </p>
            {!editingEntry ? (
              <div className="flex items-center justify-between mt-1">
                <p className="text-2xl font-extrabold text-white">{fmtDollars(entry)}</p>
                {isCommissioner && (
                  <button
                    type="button"
                    onClick={beginEditEntry}
                    className="text-xs text-slate-400 hover:text-amber-400 transition-colors font-semibold"
                  >
                    Edit
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center bg-navy-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                  <span className="text-slate-400 mr-1">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={entryDraft}
                    onChange={(e) => setEntryDraft(e.target.value)}
                    className="bg-transparent text-white text-sm w-full focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void saveEntry()}
                  disabled={saving}
                  className="text-xs bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-3 py-1.5 rounded-lg disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntry(false);
                    setFieldError('');
                  }}
                  disabled={saving}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1.5"
                >
                  Cancel
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500 mt-1.5">Everyone pays the same to enter</p>
          </div>

          {/* Season pot */}
          <div className="sm:pl-5 pt-5 sm:pt-0 border-t border-white/10 sm:border-t-0">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              Season Pot
            </p>
            {!editingPot ? (
              <div className="flex items-center justify-between mt-1">
                <p className="text-2xl font-extrabold text-white">{fmtDollars(pot)}</p>
                {isCommissioner && (
                  <button
                    type="button"
                    onClick={beginEditPot}
                    className="text-xs text-slate-400 hover:text-amber-400 transition-colors font-semibold"
                  >
                    Edit
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex items-center bg-navy-950/80 border border-white/10 rounded-lg px-2.5 py-1.5 flex-1 min-w-0">
                  <span className="text-slate-400 mr-1">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={potDraft}
                    onChange={(e) => setPotDraft(e.target.value)}
                    className="bg-transparent text-white text-sm w-full focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void savePot()}
                  disabled={saving}
                  className="text-xs bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold px-3 py-1.5 rounded-lg disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPot(false);
                    setFieldError('');
                  }}
                  disabled={saving}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1.5"
                >
                  Cancel
                </button>
              </div>
            )}
            {isManual ? (
              <>
                <p className="text-xs text-slate-500 mt-1.5">
                  Manually set
                  {isCommissioner && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setResetModalOpen(true)}
                        className="text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
                      >
                        Reset to auto
                      </button>
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Auto would be {fmtDollars(autoPot)} ({memberCount} × {fmtDollars(entry)})
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 mt-1.5">
                {memberCount} member{memberCount === 1 ? '' : 's'} × {fmtDollars(entry)}
              </p>
            )}
          </div>
        </div>

        {fieldError && <p className="text-red-400 text-xs mt-3">{fieldError}</p>}

        <div className="border-t border-white/10 mt-5 pt-4 flex items-baseline justify-between gap-3">
          <p className="text-sm text-slate-300">
            Weekly pot:{' '}
            <span className="font-bold text-white">{fmtDollars(weeklyShare)}</span>
          </p>
          <p className="text-xs text-slate-500">over 18 weeks</p>
        </div>

        {/* Player-only: pay commissioner. Uses league.venmo which is the
            commissioner's own handle (captured at CreateLeague). */}
        {!isCommissioner && entry > 0 && (
          <div className="border-t border-white/10 mt-4 pt-4">
            {payVenmoUrl ? (
              <a
                href={payVenmoUrl}
                target="_blank"
                rel="noopener"
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold py-3 rounded-xl transition-all"
              >
                Pay {commishName}{' '}
                <span className="text-navy-900">{fmtDollars(entry)}</span>{' '}
                via Venmo →
              </a>
            ) : (
              <div className="text-center">
                <p className="text-slate-500 text-xs italic">
                  {commishName} hasn't set a Venmo handle yet — pay them however you normally do.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Pot-choice modal */}
      {potChoiceModal && (
        <Modal
          onClose={() => {
            if (!saving) {
              setPotChoiceModal(null);
              setPotChoice(null);
            }
          }}
        >
          <h2 className="text-white font-bold text-lg mb-2">
            You changed the pot to {fmtDollars(potChoiceModal.newPot)}.
          </h2>
          <p className="text-slate-400 text-sm mb-5">
            That's {fmtDollars(Math.abs(potChoiceModal.newPot - autoPot))}{' '}
            {potChoiceModal.newPot > autoPot ? 'more' : 'less'} than {memberCount}{' '}
            member{memberCount === 1 ? '' : 's'} × {fmtDollars(entry)} entry.
          </p>
          <p className="text-white text-sm font-semibold mb-3">
            What about the per-player entry?
          </p>
          <div className="space-y-2 mb-5">
            <ChoiceRow
              selected={potChoice === 'keep'}
              onClick={() => setPotChoice('keep')}
              title={`Keep per-player entry at ${fmtDollars(entry)}`}
              sub={`Pot will show ${fmtDollars(potChoiceModal.newPot)} (manually set).`}
            />
            <ChoiceRow
              selected={potChoice === 'sync'}
              onClick={() => setPotChoice('sync')}
              title={`Update per-player entry to ${fmtDollars(
                memberCount > 0 ? Math.round(potChoiceModal.newPot / memberCount) : 0
              )}`}
              sub={`So the math matches (${fmtDollars(
                memberCount > 0 ? Math.round(potChoiceModal.newPot / memberCount) : 0
              )} × ${memberCount} member${memberCount === 1 ? '' : 's'} = ${fmtDollars(
                potChoiceModal.newPot
              )}).`}
            />
          </div>
          {fieldError && <p className="text-red-400 text-xs mb-3">{fieldError}</p>}
          <div className="flex gap-3">
            <ModalCancel
              disabled={saving}
              onClick={() => {
                setPotChoiceModal(null);
                setPotChoice(null);
              }}
            />
            <button
              type="button"
              onClick={() => void confirmPotChoice()}
              disabled={!potChoice || saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      )}

      {/* Reset-to-auto modal */}
      {resetModalOpen && (
        <Modal onClose={() => !saving && setResetModalOpen(false)}>
          <h2 className="text-white font-bold text-lg mb-3">
            Reset pot to auto-calculated?
          </h2>
          <div className="text-slate-400 text-sm space-y-1 mb-4">
            <p>
              Current manual pot:{' '}
              <span className="text-white font-semibold">{fmtDollars(pot)}</span>
            </p>
            <p>
              Auto-calculated:{' '}
              <span className="text-white font-semibold">{fmtDollars(autoPot)}</span>{' '}
              ({memberCount} member{memberCount === 1 ? '' : 's'} × {fmtDollars(entry)}{' '}
              entry)
            </p>
          </div>
          <p className="text-slate-400 text-sm mb-5">
            Your pot will change to {fmtDollars(autoPot)}.
          </p>
          {fieldError && <p className="text-red-400 text-xs mb-3">{fieldError}</p>}
          <div className="flex gap-3">
            <ModalCancel disabled={saving} onClick={() => setResetModalOpen(false)} />
            <button
              type="button"
              onClick={() => void resetToAuto()}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Reset'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ChoiceRow({
  selected,
  onClick,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
        selected
          ? 'bg-amber-500/10 border-amber-500/40'
          : 'bg-navy-950/60 border-white/10 hover:border-white/25'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            selected ? 'border-amber-400' : 'border-slate-500'
          }`}
        >
          {selected && <span className="w-2 h-2 rounded-full bg-amber-400" />}
        </span>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold">{title}</p>
          <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
        </div>
      </div>
    </button>
  );
}
