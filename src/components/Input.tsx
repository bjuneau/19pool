import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type InputProps = {
  label?: string;
  error?: string;
  endAdornment?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

// Editorial input: a bare line underneath the field, no filled panel.
// Label is a small-caps kicker. This is the biggest single visual shift
// per field — the old "chip inside a chip" wrapper is gone.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, endAdornment, className = '', id, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const paddingRight = endAdornment ? 'pr-14' : '';

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="kicker block mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-transparent border-b border-ink-line focus:border-accent text-ink placeholder-ink-muted px-0 py-2 ${paddingRight} rounded-none text-base transition-colors ${className}`}
          {...rest}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-hot">{error}</p>}
    </div>
  );
});
