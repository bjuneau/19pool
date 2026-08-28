import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

// Site-wide footer, rendered globally in App.tsx below every route.
// Same layout everywhere so navigation between marketing, dashboard,
// and legal pages feels like one product.
//
// Left: copyright + NFL/ESPN disclaimer + Venmo donate link.
// Right: legal nav — Terms / Privacy / Contact.

export default function SiteFooter() {
  return (
    <footer className="bg-paper border-t border-ink-line">
      <div className="mx-auto px-5 sm:px-8 max-w-5xl py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <p className="uppercase tracking-widest">
            © 2026 19 Pool · Not affiliated with NFL or ESPN
          </p>
          <DonateLink />
        </div>
        <nav className="flex gap-5 uppercase tracking-widest font-semibold">
          <FooterLink to="/terms">Terms</FooterLink>
          <FooterLink to="/privacy">Privacy</FooterLink>
          <FooterLink to="/contact">Contact</FooterLink>
        </nav>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `transition-colors ${isActive ? 'text-ink' : 'hover:text-ink'}`
      }
      end
    >
      {children}
    </NavLink>
  );
}

// Prefilled Venmo pay link — $5 to @Brooks-Juneau with a memo tying
// the charge back to keeping 19pool.com running. noopener so the
// Venmo tab can't reach back into our window.
function DonateLink() {
  const href =
    'https://venmo.com/Brooks-Juneau?txn=pay&amount=5&note=' +
    encodeURIComponent('Keep 19pool.com rolling');
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="text-ink-dim hover:text-accent transition-colors normal-case tracking-normal"
    >
      Keep 19pool.com rolling,{' '}
      <span className="font-semibold text-accent">donate $5</span>
    </a>
  );
}
