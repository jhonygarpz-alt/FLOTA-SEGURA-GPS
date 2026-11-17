import { ReactNode, useEffect } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: string; back?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-1 inline-flex items-center gap-0.5 text-[15px] font-medium text-brand-600 dark:text-accent-400">
            <ChevronLeft className="h-5 w-5" /> Inicio
          </Link>
        )}
        <h1 className="truncate text-[28px] font-bold tracking-tight sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center animate-fade-up">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-white/5 dark:text-accent-400">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-[15px] text-slate-500 dark:text-slate-400">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal aria-label={title}>
      <div
        className={clsx('card max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 animate-fade-up sm:rounded-3xl sm:p-6 safe-bottom', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-pearl-300 sm:hidden dark:bg-white/15" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-pearl-100 text-slate-500 dark:bg-ink-700" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-2xl bg-pearl-200 p-1 dark:bg-ink-700" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-xl px-3 py-1.5 text-[13px] font-semibold transition', value === o.value ? 'bg-white text-slate-900 shadow-sm dark:bg-ink-600 dark:text-white' : 'text-slate-500')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">{message}</p>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-label="Cargando" />;
}
