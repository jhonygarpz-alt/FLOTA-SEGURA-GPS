import { FormEvent, useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Spinner } from '../components/ui';

interface CompanyRow { id: string; name: string; rfc: string | null; status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED'; isDemo: boolean; _count: { users: number; vehicles: number; devices: number } }

const STATUS = { ACTIVE: ['Activa', 'bg-green-100 text-green-800'], SUSPENDED: ['Suspendida', 'bg-amber-100 text-amber-800'], CANCELLED: ['Cancelada', 'bg-slate-200 text-slate-700'] } as const;

/** Panel exclusivo de SECUREFLEET CONSULTING. */
export default function Clients() {
  const [list, setList] = useState<CompanyRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', rfc: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const load = () => api<CompanyRow[]>('/admin/companies').then(setList).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  const toggle = async (c: CompanyRow) => {
    const status = c.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`¿${status === 'SUSPENDED' ? 'Suspender' : 'Reactivar'} el servicio de ${c.name}?`)) return;
    await api(`/admin/companies/${c.id}`, { method: 'PATCH', json: { status } });
    void load();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/admin/companies', { method: 'POST', json: { name: f.name, ...(f.rfc && { rfc: f.rfc.toUpperCase() }), ...(f.email && { email: f.email }) } });
      setOpen(false);
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader title="Clientes" subtitle="Empresas que contratan Flota Segura GPS" back="/" actions={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> <span className="hidden sm:inline">Nueva empresa</span></button>} />
      <ErrorNote message={error} />
      {!list ? <div className="grid place-items-center py-20"><Spinner /></div> : list.length === 0 ? (
        <EmptyState icon={<Building2 className="h-8 w-8" />} title="Sin empresas" text="Registre a su primer cliente." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-bold">{c.name}</p>
                  <p className="text-[13px] text-slate-500">{c.rfc ?? 'RFC no registrado'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.isDemo ? 'bg-amber-100 text-amber-800' : STATUS[c.status][1]}`}>{c.isDemo ? 'Demostración' : STATUS[c.status][0]}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[['Usuarios', c._count.users], ['Unidades', c._count.vehicles], ['GPS', c._count.devices]].map(([l, n]) => (
                  <div key={l} className="rounded-2xl bg-pearl-100 py-2 dark:bg-ink-700"><p className="text-lg font-bold">{n}</p><p className="text-[12px] text-slate-500">{l}</p></div>
                ))}
              </div>
              {!c.isDemo && <button className="btn-ghost mt-2 w-full" onClick={() => void toggle(c)}>{c.status === 'ACTIVE' ? 'Suspender servicio' : 'Reactivar servicio'}</button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nueva empresa">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre comercial *"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="RFC"><input className="input uppercase" maxLength={13} value={f.rfc} onChange={(e) => setF({ ...f, rfc: e.target.value })} /></Field>
          <Field label="Correo de contacto"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <button className="btn-primary w-full">Registrar empresa</button>
        </form>
      </Modal>
    </div>
  );
}
