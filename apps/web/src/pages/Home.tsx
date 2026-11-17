import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useFleet } from '../lib/fleet';
import { MODULES } from '../lib/modules';
import { countByState, STATE_META, VehicleState } from '../lib/status';
import { greeting, LOCALE } from '../lib/format';
import { AppIcon } from '../components/AppIcon';
import { StatusPill } from '../components/StatusPill';

const SUMMARY: VehicleState[] = ['moving', 'idle', 'parked', 'alert', 'offline'];

export default function Home() {
  const { user, can } = useAuth();
  const { vehicles, offlineMinutes, loading, now } = useFleet();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const tz = user?.company?.timezone;
  const counts = useMemo(() => countByState(vehicles, offlineMinutes), [vehicles, offlineMinutes, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const modules = MODULES.filter((m) => !m.permission || can(m.permission));
  const badges: Record<string, number> = { alerts: counts.alert, devices: counts.offline };
  const firstName = user?.name.split(' ')[0] ?? '';
  const today = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(new Date());

  return (
    <div className="animate-fade-up">
      <header className="flex items-start justify-between gap-4 pt-2">
        <div>
          <p className="text-[14px] font-medium first-letter:uppercase text-slate-500 dark:text-slate-400">{today}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">
            {greeting(tz)}, {firstName}
          </h1>
          <p className="text-[15px] text-slate-500 dark:text-slate-400">{user?.company?.name ?? 'SECUREFLEET CONSULTING'}</p>
        </div>
        <Link to="/alertas" className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white shadow-soft dark:bg-ink-800" aria-label="Alertas">
          <Bell className="h-5 w-5" />
          {counts.alert > 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white dark:ring-ink-800" />}
        </Link>
      </header>

      <form
        className="relative mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          nav(`/mapa${q ? `?q=${encodeURIComponent(q)}` : ''}`);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input className="input bg-white py-3.5 pl-12 shadow-soft ring-0 dark:bg-ink-800" placeholder="Buscar unidad, placas u operador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar unidad" />
      </form>

      {can('monitoring:read') && (
        <section className="mt-5" aria-label="Resumen de la flota">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
            <Link to="/mapa" className="card flex min-w-[120px] flex-col px-4 py-3">
              <span className="text-[26px] font-bold leading-none">{loading ? '—' : vehicles.length}</span>
              <span className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Unidades</span>
            </Link>
            {SUMMARY.map((s) => (
              <Link key={s} to={`/mapa?estado=${s}`} className="card flex min-w-[132px] flex-col items-start gap-2 px-4 py-3">
                <span className="text-[26px] font-bold leading-none" style={{ color: STATE_META[s].color }}>
                  {loading ? '—' : counts[s]}
                </span>
                <StatusPill state={s} short className="!px-0 !py-0 !bg-transparent" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8" aria-label="Módulos">
        <h2 className="section-title mb-4">Aplicaciones</h2>
        <div className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-5 lg:grid-cols-8">
          {modules.map((m) => (
            <AppIcon key={m.key} m={m} badge={badges[m.key]} />
          ))}
        </div>
      </section>
    </div>
  );
}
