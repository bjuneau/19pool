import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type InputProps = {
  label?: string;
  error?: string;
  endAdornment?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

// Dark-utility input — small-caps kicker label + subtle filled field
// with a hairline outline. Focus lights up volt-lime via the global
// input:focus rule in index.css.
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
        <label htmlFor={inputId} className="kicker block mb-2 text-ink-dim">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-paper-2 border border-ink-line focus:border-accent text-ink placeholder-ink-muted px-4 py-3 ${paddingRight} rounded-xl text-sm transition-colors ${className}`}
          {...rest}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-hot">{error}</p>}
    </div>
  );
});
