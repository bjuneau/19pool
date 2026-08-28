import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Sticky admin overlay for the super-user only. Lists every league in
// the system in a dropdown; picking one drives the Dashboard as if the
// super-user were that league's commissioner (isCommissioner is or'd
// with isSuper client-side; Firestore rules gate via isSuper() server-
// side). Selection is persisted per browser via localStorage so a
// refresh doesn't drop context.

const STORAGE_KEY = 'super:selected-league-code';

export function readSuperLeagueCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeSuperLeagueCode(code: string) {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op — private mode or storage disabled
  }
}

type LeagueSummary = {
  code: string;
  name: string;
  status: string;
  memberCount: number;
  commissionerName: string;
};

export default function SuperBar({
  selectedCode,
  onSelect,
}: {
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'leagues')),
      (snap) => {
        const list: LeagueSummary[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            code: d.id,
            name: (data.name as string) ?? d.id,
            status: (data.status as string) ?? 'recruiting',
            memberCount: (data.memberCount as number) ?? 0,
            commissionerName: (data.commissionerName as string) ?? '',
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setLeagues(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  return (
    <div className="sticky top-0 z-[60] bg-hot text-void border-b border-black/20">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 h-10 flex items-center gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] flex-shrink-0">
          Super
        </span>
        <span className="text-xs text-void/60 flex-shrink-0 hidden sm:inline">
          Jump to league
        </span>
        <div className="relative flex-1">
          <select
            value={selectedCode}
            onChange={(e) => onSelect(e.target.value)}
            disabled={loading}
            className="w-full bg-black/25 text-void border border-black/25 rounded-md pl-3 pr-8 py-1 text-sm font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-black/40 disabled:opacity-60"
          >
            <option value="">
              {loading
                ? 'Loading leagues…'
                : leagues.length === 0
                  ? 'No leagues yet'
                  : `Select a league (${leagues.length})`}
            </option>
            {leagues.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name} — {l.code} · {l.memberCount} · {l.status}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-void/70 text-xs"
            aria-hidden="true"
          >
            ▾
          </span>
        </div>
        {selectedCode && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="text-xs font-semibold text-void/80 hover:text-void underline-offset-2 hover:underline flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
