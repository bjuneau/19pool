import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

// Dark utility card — matches the challenge-b look: elevated panel with
// a hairline outline and generous rounded corners. Chunky, no glass.
export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`bg-paper-2 border border-ink-line rounded-2xl p-5 sm:p-7 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
