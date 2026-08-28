import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Shared chrome for /terms, /privacy, /contact. Same masthead as
// Dashboard so the site feels like one product; centered, prose-width
// content area. The site-wide footer is rendered globally in App.tsx.

export function LegalPage({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-paper flex-1">
      <div className="mx-auto px-5 sm:px-8 max-w-5xl w-full">
        <header className="flex items-center justify-between h-14 border-b border-ink-line">
          <Link to="/" className="flex items-baseline">
            <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-accent">
              19
            </span>
            <span className="font-display font-extrabold text-2xl leading-none tracking-tight text-ink">
              POOL
            </span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-ink-dim hover:text-ink transition-colors"
          >
            ← Home
          </Link>
        </header>

        <main className="py-8 sm:py-12">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
              {title}
            </h1>
            {effectiveDate && (
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-8">
                Effective {effectiveDate}
              </p>
            )}
            <div className="prose-legal">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Prose helpers used by the individual legal pages. Kept in the same
// file so each legal page reads top-to-bottom without hunting for a
// shared stylesheet — but exported so they can be reused freely.

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-white text-xl font-bold tracking-tight mt-10 mb-3">
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-slate-300 text-[15px] leading-relaxed mb-4">{children}</p>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="text-slate-300 text-[15px] leading-relaxed mb-4 list-disc pl-5 space-y-1.5">
      {children}
    </ul>
  );
}

export const CONTACT_EMAIL = 'bjuneau@gmail.com';
