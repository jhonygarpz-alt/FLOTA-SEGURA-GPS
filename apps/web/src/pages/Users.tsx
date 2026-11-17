import { FormEvent, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Role } from '../lib/types';
import { fmtAgo } from '../lib/format';
import { EmptyState, ErrorNote, Field, Modal, PageHeader, Spinner } from '../components/ui';

interface UserRow { id: string; email: string; name: string; role: Role; roleLabel: string; active: boolean; mfaEnabled: boolean; lastLoginAt: string | null }

const ROLES: { value: Role; label: string }[] = [
  { value: 'COMPANY_ADMIN', label: 'Administrador de empresa' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'MONITOR', label: 'Monitorista' },
  { value: 'INSTALLER', label: 'Instalador' },
  { value: 'VIEWER', label: 'Usuario de consulta' },
];

export default function Users() {
  const { can, user } = useAuth();
  const [list, setList] = useState<UserRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'VIEWER' as Role });
  const [error, setError] = useState<string | null>(null);
  const canWrite = can('users:write') && !user?.company?.isDemo && user?.role !== 'SUPERADMIN';
  const load = () => api<UserRow[]>('/users').then(setList).catch((e) => setError(e.message));
  useEffect(() => void load(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api('/users', { method: 'POST', json: f });
      setOpen(false);
      void load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader title="Usuarios" subtitle="Roles y permisos de acceso" back="/" actions={canWrite && <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-5 w-5" /> <span className="hidden sm:inline">Nuevo usuario</span></button>} />
      {!list ? <div className="grid place-items-center py-20"><Spinner /></div> : list.length === 0 ? (
        <EmptyState icon={<UsersIcon className="h-8 w-8" />} title="Sin usuarios" text="Invite a su equipo asignando el rol adecuado." />
      ) : (
        <ul className="card divide-y divide-pearl-100 dark:divide-white/5">
          {list.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-green-700 font-bold text-white">{u.name[0]?.toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{u.name} {!u.active && <span className="text-[12px] font-medium text-red-600">· Inactivo</span>}</p>
                <p className="truncate text-[13px] text-slate-500">{u.email}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[13px] font-semibold">{u.roleLabel}</p>
                <p className="text-[12px] text-slate-400">{u.lastLoginAt ? `Último acceso ${fmtAgo(u.lastLoginAt)}` : 'Sin accesos'}</p>
              </div>
              {u.mfaEnabled && <ShieldCheck className="h-5 w-5 text-green-600" aria-label="Verificación en dos pasos activa" />}
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo usuario">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre *"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Correo *"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Contraseña temporal *" hint="Mínimo 10 caracteres. Compártala por un medio seguro."><input className="input" type="password" minLength={10} required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
          <Field label="Rol">
            <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <ErrorNote message={error} />
          <button className="btn-primary w-full">Crear usuario</button>
        </form>
      </Modal>
    </div>
  );
}
