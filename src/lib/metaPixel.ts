// Meta (Facebook/Instagram) Pixel — OFF unless VITE_META_PIXEL_ID is set.
//
// IMPORTANT: enabling this makes 19 Pool share visitor activity with Meta for
// ad targeting. Our published privacy policy currently states the opposite
// ("we don't run advertising", "no analytics SDK"). Do not set the env var in
// production until /privacy has been updated in the same deploy.
//
// Everything here is a no-op when the ID is absent: no script tag is injected,
// no global is created, no network request is made.

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID ?? '').trim();

/** Key for the persisted user opt-out. */
const OPT_OUT_KEY = '19pool.adTrackingOptOut';

/**
 * True when the visitor has signalled they don't want ad tracking — either via
 * Global Privacy Control (a browser/extension setting that California law
 * treats as a valid opt-out of "sharing") or via our own stored opt-out.
 *
 * Our /privacy page promises both of these work; keep them working.
 */
export function hasOptedOut(): boolean {
  if (typeof window === 'undefined') return true;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (nav.globalPrivacyControl === true) return true;
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist an opt-out. Takes effect on the next page load. */
export function optOutOfAdTracking(): void {
  try {
    localStorage.setItem(OPT_OUT_KEY, '1');
  } catch {
    // Storage unavailable — nothing more we can do client-side.
  }
}

/** True when a pixel ID is configured AND the visitor hasn't opted out. */
export function isPixelEnabled(): boolean {
  return PIXEL_ID.length > 0 && !hasOptedOut();
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: unknown;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let initialized = false;

/**
 * Inject the Meta Pixel bootstrap and fire the initial PageView.
 * Idempotent, and a no-op when no pixel ID is configured.
 */
export function initMetaPixel(): void {
  if (!isPixelEnabled() || initialized) return;
  if (typeof window === 'undefined') return;
  initialized = true;

  // Standard Meta bootstrap stub: queues calls until the real script loads.
  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function (this: any) {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  // Automatic advanced matching is left OFF deliberately: it would ship
  // hashed emails/names to Meta and is a materially bigger privacy step than
  // pageview tracking. Turn it on only as a separate, considered decision.
  window.fbq?.('init', PIXEL_ID, {}, { autoConfig: false });
  window.fbq?.('track', 'PageView');
}

/** Fire a PageView. Call on SPA route changes (the initial one is automatic). */
export function trackPageView(): void {
  if (!isPixelEnabled() || !initialized) return;
  window.fbq?.('track', 'PageView');
}

/** Meta standard events we actually use. */
export type StandardEvent =
  | 'CompleteRegistration'
  | 'StartTrial'
  | 'Lead'
  | 'ViewContent';

/**
 * Fire a Meta standard event. Never pass raw PII (email, name, Venmo handle)
 * in `params` — these are sent to Meta in the clear.
 */
export function trackEvent(
  event: StandardEvent,
  params?: Record<string, string | number>
): void {
  if (!isPixelEnabled() || !initialized) return;
  window.fbq?.('track', event, params);
}
