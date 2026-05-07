import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';

type InputProps = {
  label?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id ?? reactId;

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
      <input
        ref={ref}
        id={inputId}
        className={`w-full bg-navy-950/60 border border-white/10 text-white placeholder-slate-600 px-4 py-3 rounded-xl text-sm ${className}`}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
});
