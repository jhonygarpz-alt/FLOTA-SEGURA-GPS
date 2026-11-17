import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Plus, Rows3, Search, Truck } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useFleet } from '../lib/fleet';
import { vehicleState } from '../lib/status';
import { fmtAgo, VEHICLE_TYPE_LABELS } from '../lib/format';
import type { Operator, VehicleType } from '../lib/types';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Segmented, Spinner } from '../components/ui';
import { StatusPill } from '../components/StatusPill';
import { VehicleGlyph } from '../components/VehicleGlyph';

const TYPES = Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[];

export default function Vehicles() {
  const { can, user } = useAuth();
  const { vehicles, offlineMinutes, loading, refresh, now } = useFleet();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [type, setType] = useState<VehicleType | 'all'>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const canWrite = can('vehicles:write') && !user?.company?.isDemo;

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return vehicles.filter((v) => (type === 'all' || v.type === type) && (!t || [v.economicNumber, v.plates, v.brand, v.model, v.operator?.name].some((s) => s?.toLowerCase().includes(t))));
  }, [vehicles, type, q]);
  const typesPresent = TYPES.filter((t) => vehicles.some((v) => v.type === t));

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Unidades"
        subtitle={`${vehicles.length} unidades registradas`}
        back="/"
        actions={canWrite && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-5 w-5" /> <span className="hidden sm:inline">Nueva unidad</span>
          </button>
        )}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input bg-white py-2.5 pl-10 dark:bg-ink-800" placeholder="Buscar por número, placas u operador" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar unidades" />
        </div>
        <Segmented value={view} onChange={setView} options={[{ value: 'cards', label: <LayoutGrid className="h-4 w-4" aria-label="Tarjetas" /> }, { value: 'table', label: <Rows3 className="h-4 w-4" aria-label="Tabla" /> }]} />
      </div>
      {typesPresent.length > 1 && (
        <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          {(['all', ...typesPresent] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={clsx('chip', type === t ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-pearl-200 dark:bg-ink-800 dark:text-slate-300 dark:ring-white/10')}>
              {t !== 'all' && <VehicleGlyph type={t} className="h-4 w-4" />}
              {t === 'all' ? 'Todas' : VEHICLE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20"><Spinner /></div>
      ) : vehicles.length === 0 ? (
        <EmptyState icon={<Truck className="h-8 w-8" />} title="Registre su primera unidad" text="Agregue tractocamiones, autotanques, remolques o cualquier vehículo y asígnele un GPS." action={canWrite && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-5 w-5" /> Nueva unidad</button>} />
      ) : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((v) => {
            const s = vehicleState(v.position, offlineMinutes, now);
            return (
              <Link key={v.id} to={`/mapa?unidad=${v.id}`} className="card flex gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-float">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-pearl-100 text-brand-600 dark:bg-ink-700 dark:text-accent-400">
                  {v.photoUrl ? <img src={v.photoUrl} alt="" className="h-full w-full object-cover" /> : <VehicleGlyph type={v.type} className="h-8 w-8" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[17px] font-bold">{v.economicNumber}</p>
                    {v.device?.isDemo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}
                  </div>
                  <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">{[v.plates, VEHICLE_TYPE_LABELS[v.type]].filter(Boolean).join(' · ')}</p>
                  <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">{v.operator?.name ?? 'Sin operador'}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusPill state={s} short />
                    {!v.device && <span className="text-[12px] font-medium text-amber-600">Sin GPS</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[14px]">
            <thead className="text-[12px] uppercase tracking-wide text-slate-500">
              <tr className="border-b border-pearl-200 dark:border-white/5">
                {['Número', 'Placas', 'Tipo', 'Marca / modelo', 'Operador', 'GPS', 'Estado', 'Última transmisión'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className="border-b border-pearl-100 last:border-0 hover:bg-pearl-50 dark:border-white/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold"><Link to={`/mapa?unidad=${v.id}`}>{v.economicNumber}</Link></td>
                  <td className="px-4 py-3">{v.plates ?? '—'}</td>
                  <td className="px-4 py-3">{VEHICLE_TYPE_LABELS[v.type]}</td>
                  <td className="px-4 py-3">{[v.brand, v.model, v.year].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3">{v.operator?.name ?? '—'}</td>
                  <td className="px-4 py-3">{v.device?.name ?? <span className="text-amber-600">Sin GPS</span>}</td>
                  <td className="px-4 py-3"><StatusPill state={vehicleState(v.position, offlineMinutes, now)} short /></td>
                  <td className="px-4 py-3 text-slate-500">{fmtAgo(v.position?.fixTime, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <VehicleForm open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void refresh(); }} />
    </div>
  );
}

function VehicleForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ economicNumber: '', plates: '', vin: '', type: 'TRACTOR' as VehicleType, brand: '', model: '', year: '', operatorId: '', photoUrl: '' });
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) api<Operator[]>('/operators').then(setOperators).catch(() => setOperators([]));
  }, [open]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { economicNumber: f.economicNumber.trim(), type: f.type };
      if (f.plates) body.plates = f.plates.trim().toUpperCase();
      if (f.vin) body.vin = f.vin.trim().toUpperCase();
      if (f.brand) body.brand = f.brand;
      if (f.model) body.model = f.model;
      if (f.year) body.year = Number(f.year);
      if (f.operatorId) body.operatorId = f.operatorId;
      if (f.photoUrl) body.photoUrl = f.photoUrl;
      await api('/vehicles', { method: 'POST', json: body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva unidad" wide>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">Tipo de unidad</span>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {TYPES.map((t) => (
              <button type="button" key={t} onClick={() => setF({ ...f, type: t })} className={clsx('flex flex-col items-center gap-1 rounded-2xl p-2 text-[11px] font-medium ring-1 ring-inset transition', f.type === t ? 'bg-brand-50 text-brand-700 ring-brand-500 dark:bg-brand-900/40 dark:text-accent-400' : 'ring-pearl-200 dark:ring-white/10')}>
                <VehicleGlyph type={t} className="h-6 w-6" />
                {VEHICLE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número económico *"><input className="input" required value={f.economicNumber} onChange={set('economicNumber')} placeholder="T-101" /></Field>
          <Field label="Placas"><input className="input uppercase" value={f.plates} onChange={set('plates')} placeholder="ABC-123-D" /></Field>
          <Field label="VIN" hint="17 caracteres"><input className="input uppercase" value={f.vin} onChange={set('vin')} maxLength={17} /></Field>
          <Field label="Año"><input className="input" type="number" min={1950} max={2100} value={f.year} onChange={set('year')} /></Field>
          <Field label="Marca"><input className="input" value={f.brand} onChange={set('brand')} placeholder="Kenworth" /></Field>
          <Field label="Modelo"><input className="input" value={f.model} onChange={set('model')} placeholder="T680" /></Field>
          <Field label="Operador">
            <select className="input" value={f.operatorId} onChange={set('operatorId')}>
              <option value="">Sin operador</option>
              {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Fotografía (URL)" hint="Carga de archivos disponible en una próxima fase"><input className="input" type="url" value={f.photoUrl} onChange={set('photoUrl')} placeholder="https://" /></Field>
        </div>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Guardar unidad'}</button>
        </div>
      </form>
    </Modal>
  );
}
