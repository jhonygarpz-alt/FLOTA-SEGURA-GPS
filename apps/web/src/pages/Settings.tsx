import { useState } from 'react';
import { LogOut, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { ErrorNote, PageHeader, Segmented } from '../components/ui';

export default function Settings() {
  const { user, logout, reload } = useAuth();
  const [theme, setTheme] = useTheme();
  const [mfa, setMfa] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const demo = user?.company?.isDemo;

  const startMfa = async () => {
    setError(null);
    try {
      setMfa(await api('/auth/mfa/setup', { method: 'POST' }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const enableMfa = async () => {
    setError(null);
    try {
      await api('/auth/mfa/enable', { method: 'POST', json: { code } });
      setMfa(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader title="Perfil y configuración" back="/" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-700 text-2xl font-bold text-white">{user?.name[0]}</span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{user?.name}</p>
              <p className="truncate text-[14px] text-slate-500">{user?.email}</p>
              <p className="text-[13px] font-semibold text-brand-600 dark:text-accent-400">{user?.roleLabel}{user?.company ? ` · ${user.company.name}` : ''}</p>
            </div>
          </div>
          <button className="btn-secondary mt-5 w-full text-red-600" onClick={() => void logout()}>
            <LogOut className="h-5 w-5" /> Cerrar sesión
          </button>
        </section>

        <section className="card p-5">
          <h2 className="font-bold">Apariencia</h2>
          <p className="mb-3 text-[14px] text-slate-500">Modo claro, oscuro o según su dispositivo.</p>
          <Segmented value={theme} onChange={setTheme} options={[
            { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="h-4 w-4" /> Claro</span> },
            { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="h-4 w-4" /> Oscuro</span> },
            { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="h-4 w-4" /> Sistema</span> },
          ]} />
          <h2 className="mt-6 font-bold">Región</h2>
          <p className="text-[14px] text-slate-500">Español (México) · MXN · km/h · km · litros · Zona horaria: {user?.company?.timezone ?? 'America/Mexico_City'}</p>
        </section>

        <section className="card p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <ShieldCheck className={user?.mfaEnabled ? 'h-6 w-6 text-green-600' : 'h-6 w-6 text-slate-400'} />
            <div className="flex-1">
              <h2 className="font-bold">Verificación en dos pasos</h2>
              <p className="text-[14px] text-slate-500">
                {user?.mfaEnabled ? 'Activa. Se solicitará un código de su aplicación autenticadora al iniciar sesión.' : 'Proteja su cuenta con Google Authenticator, Microsoft Authenticator u otra app compatible.'}
              </p>
              {!user?.mfaEnabled && !mfa && !demo && <button className="btn-primary mt-3" onClick={() => void startMfa()}>Activar</button>}
              {demo && <p className="mt-2 text-[13px] text-amber-600">No disponible en modo demostración.</p>}
              {mfa && (
                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <img src={mfa.qr} alt="Código QR para la app autenticadora" className="h-44 w-44 rounded-2xl bg-white p-2" />
                  <div className="space-y-3">
                    <p className="text-[14px]">1. Escanee el código QR con su app. <br />2. Escriba el código de 6 dígitos.</p>
                    <p className="break-all text-[12px] text-slate-400">Clave manual: {mfa.secret}</p>
                    <div className="flex gap-2">
                      <input className="input w-36 text-center tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Código" />
                      <button className="btn-primary" onClick={() => void enableMfa()}>Confirmar</button>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3"><ErrorNote message={error} /></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
