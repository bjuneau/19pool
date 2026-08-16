import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

// Dark-utility pill buttons. Primary = volt-lime with near-black text
// (the challenge-b signature CTA). Secondary = hairline outline ghost.
const base =
  'inline-flex items-center justify-center font-bold tracking-tight transition-transform disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent hover:bg-accent-bright text-paper px-6 py-3 rounded-full text-sm hover:scale-[1.03]',
  secondary:
    'bg-transparent border border-ink-line hover:border-ink-dim hover:bg-white/5 text-ink px-6 py-3 rounded-full text-sm',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}
