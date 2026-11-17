import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, SatelliteDish, Smartphone } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import type { Device } from '../../lib/types';
import { fmtAgo } from '../../lib/format';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../../components/ui';
import { DEVICE_STATUS } from './deviceStatus';

export default function Devices() {
  const { can, user } = useAuth();
  const [list, setList] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canWrite = can('devices:write') && !user?.company?.isDemo;
  useEffect(() => {
    api<Device[]>('/devices').then(setList).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="animate-fade-up">
      <PageHeader title="Dispositivos" subtitle="Equipos GPS y diagnóstico de conexión" back="/" actions={canWrite && <Link className="btn-primary" to="/dispositivos/nuevo"><Plus className="h-5 w-5" /> <span className="hidden sm:inline">Conectar GPS</span></Link>} />
      <ErrorNote message={error} />
      {!list && !error ? <div className="grid place-items-center py-20"><Spinner /></div> : list?.length === 0 ? (
        <EmptyState
          icon={<SatelliteDish className="h-8 w-8" />}
          title="Conecte su primer GPS"
          text="El asistente le guía paso a paso. Si aún no tiene un equipo, puede probar con su teléfono usando la app Traccar Client."
          action={canWrite && <Link className="btn-primary" to="/dispositivos/nuevo"><Plus className="h-5 w-5" /> Conectar GPS</Link>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list?.map((d) => {
            const s = DEVICE_STATUS[d.status];
            return (
              <Link key={d.id} to={`/dispositivos/${d.id}`} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-float">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-white">
                    {d.protocol === 'osmand' ? <Smartphone className="h-6 w-6" /> : <SatelliteDish className="h-6 w-6" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{d.name}</p>
                    <p className="truncate text-[13px] text-slate-500">{d.manufacturer} {d.model}</p>
                    <p className="truncate text-[12px] text-slate-400">ID {d.uniqueId}{d.vehicle ? ` · ${d.vehicle.economicNumber}` : ''}</p>
                  </div>
                  {d.isDemo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ color: s.color, backgroundColor: `${s.color}1A` }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
                  </span>
                  <span className="text-[12px] text-slate-400">{d.lastPositionAt ? fmtAgo(d.lastPositionAt) : ''}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
