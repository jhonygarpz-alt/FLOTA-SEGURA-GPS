import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, Map, Truck, ShieldAlert, UserCircle2, FlaskConical } from 'lucide-react';
import clsx from 'clsx';
import { MODULES } from '../lib/modules';
import { useAuth } from '../lib/auth';
import { Logo } from './Logo';
import { ErrorBoundary } from './ErrorBoundary';

const TABS = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/mapa', label: 'Mapa', icon: Map },
  { to: '/unidades', label: 'Unidades', icon: Truck },
  { to: '/alertas', label: 'Alertas', icon: ShieldAlert },
  { to: '/perfil', label: 'Perfil', icon: UserCircle2 },
];

export function DemoBanner() {
  const { user } = useAuth();
  if (!user?.company?.isDemo) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-center text-[13px] font-semibold text-amber-950 safe-top" role="status">
      <FlaskConical className="h-4 w-4 shrink-0" />
      <span>
        MODO DEMOSTRACIÓN · Datos simulados<span className="hidden sm:inline">, no corresponden a vehículos reales</span>
      </span>
    </div>
  );
}

function Sidebar() {
  const { can } = useAuth();
  const items = MODULES.filter((m) => !m.permission || can(m.permission));
  return (
    <aside className="sticky top-0 hidden h-dvh w-[88px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-pearl-200 bg-white/80 py-4 backdrop-blur no-scrollbar md:flex dark:border-white/5 dark:bg-ink-800/80">
      <NavLink to="/" className="mb-3" aria-label="Inicio">
        <Logo className="h-11 w-11" />
      </NavLink>
      <NavLink to="/" end className={({ isActive }) => clsx('side-item', isActive && 'active')} title="Inicio">
        {({ isActive }) => <SideItem active={isActive} label="Inicio" color="#0B5966" Icon={Home} />}
      </NavLink>
      {items.map((m) => (
        <NavLink key={m.key} to={m.path} title={m.name}>
          {({ isActive }) => <SideItem active={isActive} label={m.name} color={m.color} Icon={m.icon} />}
        </NavLink>
      ))}
    </aside>
  );
}

function SideItem({ active, label, color, Icon }: { active: boolean; label: string; color: string; Icon: typeof Home }) {
  return (
    <span className="group flex w-[76px] flex-col items-center gap-1 rounded-2xl py-1.5">
      <span
        className={clsx('grid h-10 w-10 place-items-center rounded-xl transition', active ? 'text-white shadow-icon' : 'text-slate-500 group-hover:bg-pearl-100 dark:text-slate-400 dark:group-hover:bg-white/5')}
        style={active ? { backgroundColor: color } : undefined}
      >
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className={clsx('max-w-full truncate text-[10.5px] font-medium', active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{label}</span>
    </span>
  );
}

function BottomTabs() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-pearl-200 bg-white/90 backdrop-blur-xl md:hidden dark:border-white/5 dark:bg-ink-800/90 safe-bottom" aria-label="Navegación principal">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium transition', isActive ? 'text-brand-700 dark:text-accent-400' : 'text-slate-400')}>
            {({ isActive }) => (
              <>
                <t.icon className="h-6 w-6" strokeWidth={isActive ? 2.3 : 1.8} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const fullBleed = pathname.startsWith('/mapa');
  return (
    <div className={clsx('flex flex-col', fullBleed ? 'h-dvh overflow-hidden' : 'min-h-dvh')}>
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className={clsx('min-w-0 flex-1', fullBleed ? 'relative' : 'px-4 pb-28 pt-4 sm:px-6 md:pb-10 lg:px-10')}>
          <div className={clsx(!fullBleed && 'mx-auto max-w-6xl')}>
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
