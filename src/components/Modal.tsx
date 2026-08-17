import type { ReactNode } from 'react';

// Shared modal primitives. Account.tsx and dashboard/LeagueAdminTab.tsx
// both mount confirm-and-destroy dialogs with an identical shape
// (backdrop, centered card, cancel + destructive footer buttons), so the
// wrappers live here.

export function Modal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pt-16 sm:pt-24">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-sm bg-navy-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

export function ModalCancel({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm font-semibold hover:text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Cancel
    </button>
  );
}

export function ModalDestructive({
  disabled,
  onClick,
  label,
}: {
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
