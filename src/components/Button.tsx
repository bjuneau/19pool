import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const base =
  'inline-flex items-center justify-center font-bold tracking-wide transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100';

const variants: Record<Variant, string> = {
  primary:
    'bg-amber-500 hover:bg-amber-400 text-navy-950 px-8 py-4 rounded-full text-lg glow-gold-sm',
  secondary:
    'glass border border-white/10 hover:border-amber-500/30 text-white font-semibold px-8 py-4 rounded-full text-lg',
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
