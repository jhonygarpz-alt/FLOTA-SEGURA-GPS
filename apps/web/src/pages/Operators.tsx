import { FormEvent, useEffect, useState } from 'react';
import { Phone, Plus, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Operator } from '../lib/types';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Spinner } from '../components/ui';

export default function Operators() {
  const { can, user } = useAuth();
  const [list, setList] = useState<Operator[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', license: '' });
  const [error, setError] = useState<string | null>(null);
  const canWrite = can('operators:write') && !user?.company?.isDemo;
  const load = () => api<Operator[]>('/operators').then(setList).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/operators', { method: 'POST', json: { name: f.name, ...(f.phone && { phone: f.phone }), ...(f.license && { license: f.license }) } });
      setOpen(false);
      setF({ name: '', phone: '', license: '' });
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader title="Operadores" subtitle="Directorio de operadores" back="/" actions={canWrite && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> <span className="hidden sm:inline">Nuevo operador</span></button>} />
      {!list ? <div className="grid place-items-center py-20"><Spinner /></div> : list.length === 0 ? (
        <EmptyState icon={<UserRound className="h-8 w-8" />} title="Sin operadores" text="Registre a los operadores para asignarlos a las unidades." />
      ) : (
        <ul className="card divide-y divide-pearl-100 dark:divide-white/5">
          {list.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-teal-600 text-[15px] font-bold text-white">{o.name.split(' ').slice(0, 2).map((s) => s[0]).join('')}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{o.name}</p>
                <p className="truncate text-[13px] text-slate-500">{o.vehicles.length ? `Unidad ${o.vehicles.map((v) => v.economicNumber).join(', ')}` : 'Sin unidad asignada'}</p>
              </div>
              {o.phone && <a href={`tel:${o.phone}`} className="grid h-10 w-10 place-items-center rounded-full bg-pearl-100 text-brand-700 dark:bg-ink-700 dark:text-accent-400" aria-label={`Llamar a ${o.name}`}><Phone className="h-5 w-5" /></a>}
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo operador">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre completo *"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Teléfono"><input className="input" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Licencia"><input className="input" value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} /></Field>
          <ErrorNote message={error} />
          <button className="btn-primary w-full">Guardar</button>
        </form>
      </Modal>
    </div>
  );
}
