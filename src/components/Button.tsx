import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary';

type ButtonProps = {
  variant?: Variant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;

// Editorial buttons: sharp corners, solid fill for primary, hairline
// border for secondary. Amber whiskey accent is the brand color; text is
// on-paper-black so it reads as a headline chip, not a candy button.
const base =
  'inline-flex items-center justify-center font-semibold tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent hover:bg-accent-bright text-paper px-6 py-3 rounded-sm text-base',
  secondary:
    'bg-transparent border border-ink-line hover:border-ink-dim text-ink font-semibold px-6 py-3 rounded-sm text-base',
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
