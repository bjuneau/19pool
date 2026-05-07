import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

type InputProps = {
  label?: string;
  error?: string;
  endAdornment?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, endAdornment, className = '', id, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const paddingRight = endAdornment ? 'pr-16' : '';

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-3 ${paddingRight} rounded-xl text-sm ${className}`}
          {...rest}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            {endAdornment}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
});
