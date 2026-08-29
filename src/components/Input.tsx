import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type InputProps = {
  label?: string;
  error?: string;
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

// Dark-utility input — small-caps kicker label + subtle filled field
// with a hairline outline. Focus lights up volt-lime via the global
// input:focus rule in index.css. Optional start/end adornments sit
// inside the field (e.g. an "@" prefix, a Show/Hide password toggle).
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, startAdornment, endAdornment, className = '', id, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const paddingLeft = startAdornment ? 'pl-8' : '';
  const paddingRight = endAdornment ? 'pr-14' : '';

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="kicker block mb-2 text-ink-dim">
          {label}
        </label>
      )}
      <div className="relative">
        {startAdornment && (
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-ink-muted text-sm">
            {startAdornment}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-paper-2 border border-ink-line focus:border-accent text-ink placeholder-ink-muted px-4 py-3 ${paddingLeft} ${paddingRight} rounded-xl text-sm transition-colors ${className}`}
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
