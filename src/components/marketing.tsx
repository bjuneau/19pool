import type { ReactNode } from 'react';

// Shared visual primitives for the marketing pages (/ and the ad landing
// route). Deliberately contains styling only — no copy. The two pages have
// very different messaging constraints, so all wording stays in the page
// files where it can be reviewed in one place.

/** Route for the paid-acquisition landing page. */
export const AD_LANDING_PATH = '/nfl-pool-app';

export const VOLT = '#C4F82A';

/**
 * Inter Tight at heaviest weight for chunky headline display. Inter Tight is
 * a condensed member of the Inter family — no wdth axis, just the tighter
 * default glyphs. Pair with heavy weight + tight tracking.
 */
export const DISPLAY_WIDE: React.CSSProperties = {
  fontFamily: '"Inter Tight", Inter, ui-sans-serif, system-ui, sans-serif',
  fontWeight: 900,
  letterSpacing: '-0.035em',
};

export function Section({
  children,
  tint = false,
}: {
  children: ReactNode;
  tint?: boolean;
}) {
  return (
    <section className={tint ? 'border-y border-void-line bg-void-2/40' : ''}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        {children}
      </div>
    </section>
  );
}

export function SectionHead({ title, sub }: { title: ReactNode; sub?: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <h2
        className="uppercase text-4xl sm:text-6xl leading-[0.95]"
        style={DISPLAY_WIDE}
      >
        {title}
      </h2>
      {sub && (
        <p className="mt-5 text-white/60 leading-relaxed text-base sm:text-lg">
          {sub}
        </p>
      )}
    </div>
  );
}

/** The signature move — highlighter-style volt background behind key words. */
export function VoltMark({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-block px-[0.15em] text-black"
      style={{
        backgroundColor: VOLT,
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
      }}
    >
      {children}
    </span>
  );
}
