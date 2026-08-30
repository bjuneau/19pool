// First-party ad attribution. No third-party SDK, no cross-site tracking —
// we just read the query string our own ads land on and remember it long
// enough to stamp it on the user document at signup.
//
// This is what lets us answer "which campaign produced this league?" without
// handing anything to Meta. It works whether or not the Meta Pixel is on.

const STORAGE_KEY = '19pool.attribution';

/** Query params we care about. UTMs are ours; the *clid ones are ad-platform click IDs. */
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const CLICK_ID_KEYS = ['fbclid', 'gclid', 'ttclid'] as const;

export type Attribution = {
  [K in (typeof UTM_KEYS)[number]]?: string;
} & {
  [K in (typeof CLICK_ID_KEYS)[number]]?: string;
} & {
  /** Document referrer at first touch, host only — we don't keep full URLs. */
  referrerHost?: string;
  /** ISO timestamp of the first touch in this session. */
  capturedAt: string;
};

/** Cap stored values so a crafted URL can't bloat the user doc. */
function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || undefined;
}

/**
 * Read attribution params off the current URL and persist them for this
 * session. First touch wins: if we already captured something, a later
 * in-session navigation (or a param-less page load) will not overwrite it.
 *
 * Safe to call on every render/route change — it's a no-op after the first
 * capture. Returns the stored attribution, or null when there's nothing.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;

  const existing = getAttribution();
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const record: Attribution = { capturedAt: new Date().toISOString() };

  let found = false;
  for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
    const value = clean(params.get(key));
    if (value) {
      record[key] = value;
      found = true;
    }
  }

  // Only bother with the referrer when it's genuinely external.
  try {
    if (document.referrer) {
      const host = new URL(document.referrer).host;
      if (host && host !== window.location.host) {
        record.referrerHost = host;
        found = true;
      }
    }
  } catch {
    // Malformed referrer — ignore, it's decoration.
  }

  if (!found) return null;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode / storage disabled. Attribution is best-effort; the app
    // must not care that this failed.
  }
  return record;
}

/** Returns this session's captured attribution, or null. */
export function getAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort: attach this session's attribution to an existing user doc.
 *
 * Deliberately fire-and-forget and never thrown from. Attribution is
 * marketing nice-to-have; it must never be able to fail an account creation.
 * Keeping it out of the initial setDoc also means Firestore rules that
 * validate the created field set exactly will not reject signup.
 */
export async function recordAttribution(uid: string): Promise<void> {
  const record = getAttribution();
  if (!record) return;
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    await updateDoc(doc(db, 'users', uid), { attribution: record });
  } catch {
    // Rules rejection, offline, whatever — the account already exists and
    // that is what matters. Swallow it.
  }
}
