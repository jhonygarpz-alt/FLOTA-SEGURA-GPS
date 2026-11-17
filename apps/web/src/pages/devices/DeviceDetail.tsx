import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, MapPin, RefreshCw, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFleet } from '../../lib/fleet';
import type { Device, DeviceStatus, LivePosition } from '../../lib/types';
import { fmtAgo, fmtDateTime, fmtSpeed } from '../../lib/format';
import { ErrorNote, PageHeader, Spinner } from '../../components/ui';
import { DEVICE_STATUS } from './deviceStatus';
import { Stepper } from './DeviceWizard';

interface Setup {
  device: { name: string; manufacturer: string; model: string; uniqueId: string };
  server: { host: string | null; hostConfigured: boolean; port: number; transport: string; protocol: string };
  apn: string | null;
  interval: { movingSeconds: number; stoppedSeconds: number };
  instructions: { verification: 'official' | 'manufacturer'; steps: string[]; reference: string };
}
interface Diagnostics { status: DeviceStatus; statusLabel: string; demo: boolean; traccarEnabled?: boolean; traccarReachable?: boolean; traccar: { status: string; lastUpdate: string | null } | null; lastPosition: LivePosition | null }

const FLOW: DeviceStatus[] = ['PENDING_CONFIG', 'WAITING', 'RECEIVING', 'CONNECTED'];

function CopyRow({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-pearl-200 py-3 last:border-0 dark:border-white/5">
      <span className="text-[14px] text-slate-500">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={clsx('truncate font-mono text-[15px] font-semibold', !value && 'text-amber-600')}>{value ?? 'Pendiente'}</span>
        {value && (
          <button
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pearl-100 text-slate-500 dark:bg-ink-700"
            onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            aria-label={`Copiar ${label}`}
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
        )}
      </span>
    </div>
  );
}

export default function DeviceDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { can, user } = useAuth();
  const { refresh } = useFleet();
  const [device, setDevice] = useState<Device | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const fromWizard = params.get('asistente') === '1';
  const canWrite = can('devices:write') && !user?.company?.isDemo;

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setDiag(await api<Diagnostics>(`/devices/${id}/diagnostics`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, [id]);

  useEffect(() => {
    api<Device>(`/devices/${id}`).then(setDevice).catch((e) => setError(e.message));
    api<Setup>(`/devices/${id}/setup`).then(setSetup).catch(() => undefined);
    void check();
  }, [id, check]);

  // Verificación periódica mientras se espera la primera transmisión
  useEffect(() => {
    if (!diag || diag.status === 'CONNECTED' || diag.demo) return;
    const t = setInterval(() => void check(), 3000);
    return () => clearInterval(t);
  }, [diag, check]);

  useEffect(() => {
    if (diag?.status === 'CONNECTED') void refresh();
  }, [diag?.status, refresh]);

  const sync = async () => {
    setError(null);
    try {
      await api(`/devices/${id}/sync`, { method: 'POST' });
      await check();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!confirm('¿Eliminar este dispositivo? También se eliminará del servidor de rastreo.')) return;
    await api(`/devices/${id}`, { method: 'DELETE' });
    void refresh();
    nav('/dispositivos');
  };

  if (!device) return error ? <ErrorNote message={error} /> : <div className="grid place-items-center py-20"><Spinner /></div>;
  const status = diag?.status ?? device.status;
  const meta = DEVICE_STATUS[status];
  const connected = status === 'CONNECTED';
  const wizardStep = connected ? 7 : status === 'PENDING_CONFIG' || status === 'CONFIG_ERROR' ? 5 : 6;
  const pos = diag?.lastPosition;

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <PageHeader title={device.name} subtitle={`${device.manufacturer} ${device.model} · ID ${device.uniqueId}`} back="/" />
      {fromWizard && <Stepper step={wizardStep} />}

      {/* Diagnóstico */}
      <section className="card p-5" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white" style={{ backgroundColor: meta.color }}>
            {connected ? <CheckCircle2 className="h-7 w-7" /> : status === 'CONFIG_ERROR' || status === 'NO_COMMUNICATION' ? <AlertTriangle className="h-7 w-7" /> : <Spinner className="h-6 w-6" />}
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{connected && fromWizard ? '¡Dispositivo conectado!' : meta.label}</h2>
            <p className="text-[15px] text-slate-500">{meta.hint}</p>
            {diag && !diag.demo && diag.traccarEnabled === false && (
              <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                El servidor Traccar todavía no está configurado en la plataforma. El equipo quedará pendiente hasta conectarlo (vea el manual de instalación).
              </p>
            )}
            {diag?.traccarReachable === false && diag.traccarEnabled && <p className="mt-2 text-[13px] font-medium text-red-600">No hay comunicación con el servidor Traccar en este momento.</p>}
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-pearl-100 dark:bg-ink-700" onClick={() => void check()} aria-label="Verificar de nuevo">
            <RefreshCw className={clsx('h-5 w-5', checking && 'animate-spin')} />
          </button>
        </div>
        <ol className="mt-5 grid grid-cols-4 gap-2 text-center text-[11px] font-medium sm:text-[12px]">
          {FLOW.map((s, i) => {
            const reached = FLOW.indexOf(status) >= i;
            return (
              <li key={s} className={clsx('rounded-2xl px-1 py-2', reached ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-accent-400' : 'bg-pearl-100 text-slate-400 dark:bg-ink-700')}>
                {DEVICE_STATUS[s].label}
              </li>
            );
          })}
        </ol>
        {pos && (
          <div className="mt-4 rounded-2xl bg-pearl-100 p-4 text-[14px] dark:bg-ink-700">
            <p className="font-semibold">Última posición recibida {pos.source === 'demo' && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}</p>
            <p className="text-slate-500">{pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)} · {fmtSpeed(pos.speedKmh)} · GPS {pos.valid ? 'válido' : 'sin señal válida'}</p>
            <p className="text-slate-500">{fmtDateTime(pos.fixTime)} ({fmtAgo(pos.fixTime)})</p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {connected && device.vehicle && <Link className="btn-primary" to={`/mapa?unidad=${device.vehicle.id}`}><MapPin className="h-5 w-5" /> Ver en el mapa</Link>}
          {canWrite && status === 'CONFIG_ERROR' && <button className="btn-primary" onClick={() => void sync()}><RefreshCw className="h-5 w-5" /> Reintentar registro</button>}
          {canWrite && status === 'PENDING_CONFIG' && diag?.traccarEnabled && <button className="btn-primary" onClick={() => void sync()}><RefreshCw className="h-5 w-5" /> Registrar en servidor</button>}
        </div>
        <div className="mt-3"><ErrorNote message={error} /></div>
      </section>

      {/* Ficha de configuración */}
      {setup && !device.isDemo && (
        <section className="card mt-4 p-5">
          <h2 className="text-xl font-bold">Ficha de configuración</h2>
          <p className="mb-2 text-[15px] text-slate-500">Programe estos datos en el equipo.</p>
          <CopyRow label="Servidor (IP o dominio)" value={setup.server.host} />
          <CopyRow label="Puerto" value={String(setup.server.port)} />
          <CopyRow label="Conexión" value={setup.server.transport} />
          <CopyRow label="Protocolo (Traccar)" value={setup.server.protocol} />
          <CopyRow label="Identificador" value={setup.device.uniqueId} />
          {setup.server.protocol !== 'osmand' && <CopyRow label="APN" value={setup.apn} />}
          <CopyRow label="Intervalo recomendado" value={`${setup.interval.movingSeconds} s en movimiento · ${setup.interval.stoppedSeconds / 60} min detenido`} />
          {!setup.server.hostConfigured && <p className="mt-2 text-[13px] font-medium text-amber-600">La dirección pública del servidor se mostrará cuando se configure el VPS de Traccar.</p>}

          <h3 className="mt-5 font-bold">Instrucciones</h3>
          <span className={clsx('mt-1 inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold', setup.instructions.verification === 'official' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800')}>
            {setup.instructions.verification === 'official' ? 'Verificado con documentación oficial' : 'Confirme la sintaxis en el manual del fabricante'}
          </span>
          <ol className="mt-3 space-y-2">
            {setup.instructions.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-[15px]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-700 text-[12px] font-bold text-white">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {setup.instructions.reference.startsWith('http') && (
            <a href={setup.instructions.reference} target="_blank" rel="noreferrer" className="btn-ghost mt-3 px-0"><ExternalLink className="h-4 w-4" /> Documentación oficial</a>
          )}
        </section>
      )}

      {canWrite && (
        <button className="btn-ghost mt-4 text-red-600" onClick={() => void remove()}><Trash2 className="h-4 w-4" /> Eliminar dispositivo</button>
      )}
    </div>
  );
}
