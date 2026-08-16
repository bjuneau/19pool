import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

// Editorial "card" — a flat bordered region, not a floating chip. Kept the
// component name so page-level layouts don't change; just the treatment.
// If you need a chip-in-chip layout, use inline hairline rules instead of
// nesting Cards.
export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`bg-paper-2 border border-ink-line rounded-sm p-5 sm:p-8 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
