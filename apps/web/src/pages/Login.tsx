import { FormEvent, useState } from 'react';
import { FlaskConical, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo } from '../components/Logo';
import { ErrorNote, Spinner } from '../components/ui';

export default function Login() {
  const { login, verifyMfa, demo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mfaToken) return verifyMfa(mfaToken, code);
      const r = await login(email, password);
      if (r.mfaToken) setMfaToken(r.mfaToken);
    });
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-12 w-12" />
          <div>
            <p className="text-lg font-bold">Flota Segura GPS</p>
            <p className="text-sm text-brand-200">SECUREFLEET CONSULTING</p>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Su flota, siempre a la vista.</h1>
          <p className="mt-4 text-lg text-brand-100">Rastreo satelital en tiempo real, alertas y control operativo para transporte de carga, hidrocarburos y flotillas.</p>
        </div>
        <svg className="absolute -bottom-24 -right-24 h-[420px] w-[420px] text-accent-500/10" viewBox="0 0 200 200" aria-hidden>
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="66" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="36" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="100" cy="100" r="6" fill="currentColor" />
        </svg>
        <p className="text-sm text-brand-200">© {new Date().getFullYear()} SECUREFLEET CONSULTING</p>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo className="mb-3 h-16 w-16" />
            <p className="text-xl font-bold">Flota Segura GPS</p>
            <p className="text-sm text-slate-500">SECUREFLEET CONSULTING</p>
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">{mfaToken ? 'Verificación en dos pasos' : 'Iniciar sesión'}</h2>
          <p className="mb-6 mt-1 text-[15px] text-slate-500 dark:text-slate-400">
            {mfaToken ? 'Escriba el código de 6 dígitos de su aplicación autenticadora.' : 'Ingrese con el correo que le asignó su administrador.'}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {!mfaToken ? (
              <>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-12" type="email" autoComplete="username" placeholder="correo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Correo" />
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-12" type="password" autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Contraseña" />
                </div>
              </>
            ) : (
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input className="input pl-12 text-center text-2xl tracking-[.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus aria-label="Código" />
              </div>
            )}
            <ErrorNote message={error} />
            <button className="btn-primary w-full py-3.5 text-base" disabled={busy}>
              {busy ? <Spinner /> : mfaToken ? 'Verificar' : 'Entrar'}
            </button>
          </form>
          {!mfaToken && (
            <>
              <div className="my-6 flex items-center gap-3 text-[13px] text-slate-400">
                <span className="h-px flex-1 bg-pearl-200 dark:bg-white/10" /> o <span className="h-px flex-1 bg-pearl-200 dark:bg-white/10" />
              </div>
              <button className="btn-secondary w-full py-3.5" onClick={() => void run(demo)} disabled={busy}>
                <FlaskConical className="h-5 w-5 text-amber-500" /> Probar modo demostración
              </button>
              <p className="mt-3 text-center text-[12px] text-slate-400">El modo demostración usa datos simulados y es de solo lectura.</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
