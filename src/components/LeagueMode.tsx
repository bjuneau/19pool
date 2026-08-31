import { useState } from 'react';
import type { LeagueMode, LeagueStatus } from '../lib/types';

// Shared UI for the league mode ("how teams get assigned") setting.
// CreateLeague mounts the radio cards inline; the Teams tab mounts them
// inside a modal. Both read the same copy from MODE_COPY so the two
// surfaces can never drift.

export const MODE_COPY: Record<
  LeagueMode,
  { label: string; short: string; long: string }
> = {
  classic: {
    label: 'Classic',
    short: 'Each player gets NFL teams for the whole season.',
    long: 'Each player gets NFL teams for the whole season. Set it once at lock, and you keep those teams all 18 weeks.',
  },
  roulette: {
    label: 'Roulette',
    short: 'Teams reshuffle each week.',
    long: 'Teams reshuffle each week. Everyone gets new NFL teams every Tuesday, keeping the game fresh all season.',
  },
};

const MODES: LeagueMode[] = ['classic', 'roulette'];

// ─── Radio cards ──────────────────────────────────────────────────────────────

export function LeagueModeCards({
  value,
  onChange,
  disabled = false,
  name = 'leagueMode',
}: {
  value: LeagueMode;
  onChange: (mode: LeagueMode) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <div className="space-y-2">
      {MODES.map((mode) => {
        const selected = value === mode;
        return (
          <label
            key={mode}
            className={`block rounded-xl border p-4 transition-all ${
              disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            } ${
              selected
                ? 'border-amber-500/60 bg-amber-500/[0.07]'
                : 'border-white/10 bg-navy-950/60 hover:border-white/25'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name={name}
                value={mode}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(mode)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center transition-all ${
                  selected ? 'border-amber-500' : 'border-white/25'
                }`}
              >
                {selected && (
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-sm font-bold ${
                    selected ? 'text-amber-400' : 'text-white'
                  }`}
                >
                  {MODE_COPY[mode].label}
                </span>
                <span className="block text-xs text-slate-400 leading-relaxed mt-1">
                  {MODE_COPY[mode].long}
                </span>
              </span>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ─── Mode pill ────────────────────────────────────────────────────────────────

// Classic is the default, so it gets no pill. Roulette announces itself to
// every member, not just the commissioner.
export function LeagueModePill({ mode }: { mode: LeagueMode }) {
  if (mode !== 'roulette') return null;
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-400 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 align-middle">
      Roulette
    </span>
  );
}

// ─── Change-mode modal ────────────────────────────────────────────────────────

export function LeagueModeModal({
  current,
  status,
  saving,
  error,
  onSave,
  onCancel,
}: {
  current: LeagueMode;
  status: LeagueStatus;
  saving: boolean;
  error: string;
  onSave: (mode: LeagueMode) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<LeagueMode>(current);
  const [confirming, setConfirming] = useState(false);

  const changed = selected !== current;
  // Teams are already distributed at 'assigned', so a switch there gets a
  // second confirmation step. During 'recruiting' there is nothing to lose.
  const needsConfirm = status === 'assigned' && changed;

  function handlePrimary() {
    if (!changed) {
      onCancel();
      return;
    }
    if (needsConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    onSave(selected);
  }

  const confirmBody =
    selected === 'roulette'
      ? 'Your current team assignments will be replaced when the first weekly reshuffle happens. Continue?'
      : 'Teams stay exactly as they are now and will not reshuffle. Continue?';

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={saving ? undefined : onCancel}
      />
      <div className="relative z-50 w-full max-w-md bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        {confirming ? (
          <>
            <h2 className="text-white font-bold text-lg mb-3">
              Change league mode to {MODE_COPY[selected].label}?
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              {confirmBody}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-white font-bold text-lg mb-1">
              How teams get assigned
            </h2>
            <p className="text-slate-400 text-sm mb-4">
              You can change this until the season starts.
            </p>
            <LeagueModeCards
              value={selected}
              onChange={setSelected}
              disabled={saving}
            />
          </>
        )}

        {error && (
          <p className="text-red-400 text-xs mt-4">{error}</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={confirming ? () => setConfirming(false) : onCancel}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {confirming ? 'Back' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving
              ? 'Saving…'
              : confirming
                ? `Change to ${MODE_COPY[selected].label}`
                : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
