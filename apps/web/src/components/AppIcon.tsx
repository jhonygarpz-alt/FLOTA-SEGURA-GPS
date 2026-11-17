import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { AppModule } from '../lib/modules';
import { AVAILABLE_PHASE } from '../lib/modules';

/** Icono tipo lanzador de iPhone: cuadrado redondeado, color distintivo y nombre corto. */
export function AppIcon({ m, badge, size = 'lg' }: { m: AppModule; badge?: number; size?: 'lg' | 'md' }) {
  const Icon = m.icon;
  const soon = m.phase > AVAILABLE_PHASE;
  return (
    <Link
      to={m.path}
      aria-label={`${m.name}${badge ? `, ${badge} pendientes` : ''}${soon ? ', próximamente' : ''}`}
      className="group flex select-none flex-col items-center gap-2 rounded-3xl p-1 outline-none"
    >
      <span
        className={clsx(
          'relative grid place-items-center rounded-[22%] text-white shadow-icon transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-float group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-accent-500 group-focus-visible:ring-offset-2',
          size === 'lg' ? 'h-[68px] w-[68px] sm:h-[76px] sm:w-[76px]' : 'h-14 w-14',
        )}
        style={{ backgroundColor: m.color, backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,0) 55%)' }}
      >
        <Icon className={size === 'lg' ? 'h-8 w-8 sm:h-9 sm:w-9' : 'h-7 w-7'} strokeWidth={1.9} />
        {badge ? (
          <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-red-600 px-1.5 text-[12px] font-bold text-white ring-2 ring-pearl-100 dark:ring-ink-900">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
        {soon && <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-white/70" aria-hidden />}
      </span>
      <span className="max-w-[84px] truncate text-center text-[13px] font-medium text-slate-700 dark:text-slate-200">{m.name}</span>
    </Link>
  );
}
