import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, Info, Search, SatelliteDish, Smartphone } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useFleet } from '../../lib/fleet';
import { ErrorNote, Field, PageHeader, Spinner } from '../../components/ui';
import { VehicleGlyph } from '../../components/VehicleGlyph';

interface CatalogEntry { manufacturer: string; model: string; protocol: string; port: number }
interface Priority { key: string; label: string; manufacturer: string | null; verification: 'partial' | 'unverified'; note: string }
interface Catalog { source: string; retrievedAt: string; traccarVersion: string; manufacturers: { name: string; models: number }[]; priority: Priority[] }

export const WIZARD_STEPS = ['Fabricante', 'Modelo', 'Identificación', 'SIM', 'Vehículo', 'Configuración', 'Primera transmisión', 'Conectado'];

export function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex gap-1.5" aria-label={`Paso ${step + 1} de ${WIZARD_STEPS.length}: ${WIZARD_STEPS[step]}`}>
      {WIZARD_STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <span className={clsx('block h-1.5 rounded-full transition', i <= step ? 'bg-brand-600 dark:bg-accent-500' : 'bg-pearl-200 dark:bg-white/10')} />
          <span className={clsx('mt-1.5 hidden text-[11px] font-medium lg:block', i === step ? 'text-slate-900 dark:text-white' : 'text-slate-400')}>{i + 1}. {s}</span>
        </li>
      ))}
    </ol>
  );
}

/** Luhn: valida el dígito verificador del IMEI. */
export function isValidImei(v: string) {
  if (!/^\d{15}$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(v[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export default function DeviceWizard() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { vehicles, refresh } = useFleet();
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [manufacturer, setManufacturer] = useState<string | null>(null);
  const [models, setModels] = useState<CatalogEntry[]>([]);
  const [model, setModel] = useState<CatalogEntry | null>(null);
  const [modelQ, setModelQ] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [serial, setSerial] = useState('');
  const [sim, setSim] = useState({ iccid: '', phone: '', carrier: '', apn: '' });
  const [vehicleId, setVehicleId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isPhone = manufacturer === 'Traccar Client';

  useEffect(() => {
    api<Catalog>('/devices/catalog/manufacturers').then(setCatalog).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!manufacturer) return;
    api<CatalogEntry[]>(`/devices/catalog/models?manufacturer=${encodeURIComponent(manufacturer)}`).then((m) => {
      setModels(m);
      if (m.length === 1) setModel(m[0]);
    });
  }, [manufacturer]);

  const filteredModels = useMemo(() => models.filter((m) => m.model.toLowerCase().includes(modelQ.toLowerCase())), [models, modelQ]);
  const freeVehicles = vehicles.filter((v) => !v.device);
  const priorityFor = catalog?.priority.filter((p) => p.manufacturer === manufacturer || (p.manufacturer === null && manufacturer && ['Concox', 'Jimi IoT'].includes(manufacturer))) ?? [];

  const idError = (() => {
    if (!uniqueId) return null;
    if (isPhone) return /^[A-Za-z0-9_-]{4,40}$/.test(uniqueId) ? null : 'Use de 4 a 40 letras o números';
    if (/^\d{15}$/.test(uniqueId) && !isValidImei(uniqueId)) return 'El IMEI no supera la verificación (dígito verificador incorrecto). Revíselo en la etiqueta.';
    return /^[A-Za-z0-9_-]{4,40}$/.test(uniqueId) ? null : 'Identificador inválido';
  })();

  const canNext = [Boolean(manufacturer), Boolean(model), Boolean(uniqueId) && !idError, isPhone || !sim.iccid || /^\d{18,22}F?$/i.test(sim.iccid), true][step];

  const create = async () => {
    if (!model) return;
    setBusy(true);
    setError(null);
    try {
      const v = vehicles.find((x) => x.id === vehicleId);
      const body: Record<string, unknown> = {
        name: name.trim() || (v ? `GPS ${v.economicNumber}` : isPhone ? `Teléfono ${uniqueId.slice(-4)}` : `${model.model} ${uniqueId.slice(-4)}`),
        manufacturer: model.manufacturer,
        model: model.model,
        protocol: model.protocol,
        port: model.port,
        uniqueId: uniqueId.trim(),
      };
      if (serial) body.serialNumber = serial;
      if (vehicleId) body.vehicleId = vehicleId;
      if (!isPhone && sim.iccid) body.sim = { iccid: sim.iccid, ...(sim.phone && { phone: sim.phone }), ...(sim.carrier && { carrier: sim.carrier }), ...(sim.apn && { apn: sim.apn }) };
      const created = await api<{ id: string }>('/devices', { method: 'POST', json: body });
      void refresh();
      nav(`/dispositivos/${created.id}?asistente=1`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (user?.company?.isDemo) {
    return (
      <div className="animate-fade-up">
        <PageHeader title="Conectar GPS" back="/" />
        <p className="card p-6 text-center text-slate-500">El modo demostración es de solo lectura. Inicie sesión con su cuenta para conectar equipos reales.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <PageHeader title="Conectar GPS" subtitle={`Paso ${step + 1} de 8 · ${WIZARD_STEPS[step]}`} back="/" />
      <Stepper step={step} />

      <div className="card p-5 sm:p-6">
        {step === 0 && (
          <>
            <h2 className="text-xl font-bold">¿Qué equipo va a conectar?</h2>
            <p className="mb-4 text-[15px] text-slate-500">Seleccione el fabricante. La lista proviene del catálogo oficial de Traccar {catalog?.traccarVersion}.</p>
            {!catalog ? <Spinner /> : (
              <>
                <button onClick={() => setManufacturer('Traccar Client')} className={clsx('mb-4 flex w-full items-center gap-4 rounded-3xl p-4 text-left ring-2 transition', manufacturer === 'Traccar Client' ? 'bg-brand-50 ring-brand-500 dark:bg-brand-900/30' : 'bg-pearl-100 ring-transparent dark:bg-ink-700')}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-white"><Smartphone className="h-6 w-6" /></span>
                  <span className="flex-1">
                    <span className="block font-bold">Probar con mi teléfono</span>
                    <span className="text-[14px] text-slate-500">Sin comprar un GPS: use la app gratuita Traccar Client.</span>
                  </span>
                  {manufacturer === 'Traccar Client' && <Check className="h-6 w-6 text-brand-600" />}
                </button>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {catalog.manufacturers.filter((m) => m.name !== 'Traccar Client').map((m) => (
                    <button key={m.name} onClick={() => { setManufacturer(m.name); setModel(null); }} className={clsx('flex items-center gap-3 rounded-2xl p-3 text-left ring-2 transition', manufacturer === m.name ? 'bg-brand-50 ring-brand-500 dark:bg-brand-900/30' : 'bg-pearl-100 ring-transparent dark:bg-ink-700')}>
                      <SatelliteDish className="h-5 w-5 shrink-0 text-cyan-600" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{m.name}</span>
                        <span className="text-[12px] text-slate-500">{m.models} modelos</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 space-y-2">
                  {catalog.priority.map((p) => (
                    <p key={p.key} className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" /> <span><strong>{p.label}:</strong> {p.note}</span>
                    </p>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-xl font-bold">Modelo de {manufacturer}</h2>
            <p className="mb-4 text-[15px] text-slate-500">Confírmelo en la etiqueta del equipo. El protocolo y puerto se asignan automáticamente.</p>
            {models.length > 6 && (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="input pl-10" placeholder="Buscar modelo" value={modelQ} onChange={(e) => setModelQ(e.target.value)} />
              </div>
            )}
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto">
              {filteredModels.map((m) => (
                <button key={`${m.model}-${m.protocol}`} onClick={() => setModel(m)} className={clsx('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ring-2 transition', model === m ? 'bg-brand-50 ring-brand-500 dark:bg-brand-900/30' : 'bg-pearl-100 ring-transparent dark:bg-ink-700')}>
                  <span className="font-semibold">{m.model}</span>
                  <span className="text-[12px] text-slate-500">{m.protocol} · puerto {m.port}</span>
                </button>
              ))}
            </div>
            {priorityFor.map((p) => (
              <p key={p.key} className="mt-3 flex gap-2 rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {p.note}</p>
            ))}
          </>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">{isPhone ? 'Identificador del teléfono' : 'IMEI y número de serie'}</h2>
            <p className="text-[15px] text-slate-500">
              {isPhone ? 'Abra Traccar Client y copie el valor de "Identificador del dispositivo", o escriba uno nuevo y cámbielo después en la app.' : 'El IMEI (15 dígitos) aparece en la etiqueta del equipo o de su caja. Es el dato que el GPS usa para identificarse.'}
            </p>
            <Field label={isPhone ? 'Identificador *' : 'IMEI *'}>
              <input className="input font-mono text-lg tracking-wider" inputMode={isPhone ? 'text' : 'numeric'} value={uniqueId} onChange={(e) => setUniqueId(e.target.value.trim())} maxLength={40} autoFocus />
            </Field>
            {idError && <p className="text-[13px] font-medium text-red-600">{idError}</p>}
            {!isPhone && <Field label="Número de serie"><input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} /></Field>}
            <Field label="Nombre para identificarlo (opcional)"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Se usa el número económico si lo asigna a una unidad" /></Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Tarjeta SIM</h2>
            {isPhone ? (
              <p className="rounded-2xl bg-pearl-100 p-4 text-[15px] dark:bg-ink-700">El teléfono usa su propia conexión de datos. No es necesario registrar una SIM. Continúe.</p>
            ) : (
              <>
                <p className="text-[15px] text-slate-500">Datos de la SIM instalada en el GPS. El APN lo proporciona su operador (Telcel, AT&amp;T, Movistar u operador IoT).</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ICCID" hint="18 a 22 dígitos impresos en la SIM"><input className="input font-mono" inputMode="numeric" value={sim.iccid} onChange={(e) => setSim({ ...sim, iccid: e.target.value.trim() })} /></Field>
                  <Field label="Número telefónico"><input className="input" type="tel" value={sim.phone} onChange={(e) => setSim({ ...sim, phone: e.target.value.trim() })} /></Field>
                  <Field label="Operador"><input className="input" list="carriers" value={sim.carrier} onChange={(e) => setSim({ ...sim, carrier: e.target.value })} /></Field>
                  <Field label="APN"><input className="input" value={sim.apn} onChange={(e) => setSim({ ...sim, apn: e.target.value.trim() })} placeholder="Proporcionado por su operador" /></Field>
                </div>
                <datalist id="carriers"><option value="Telcel" /><option value="AT&T" /><option value="Movistar" /><option value="Otro (IoT)" /></datalist>
                <p className="text-[13px] text-slate-400">Puede omitir este paso y registrar la SIM más adelante.</p>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Asignar a un vehículo</h2>
            <p className="text-[15px] text-slate-500">Seleccione la unidad donde está instalado. Puede hacerlo después.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => setVehicleId('')} className={clsx('rounded-2xl p-3 text-left font-semibold ring-2', !vehicleId ? 'bg-brand-50 ring-brand-500 dark:bg-brand-900/30' : 'bg-pearl-100 ring-transparent dark:bg-ink-700')}>Sin asignar por ahora</button>
              {freeVehicles.map((v) => (
                <button key={v.id} onClick={() => setVehicleId(v.id)} className={clsx('flex items-center gap-3 rounded-2xl p-3 text-left ring-2', vehicleId === v.id ? 'bg-brand-50 ring-brand-500 dark:bg-brand-900/30' : 'bg-pearl-100 ring-transparent dark:bg-ink-700')}>
                  <VehicleGlyph type={v.type} className="h-6 w-6 text-blue-600" />
                  <span><span className="block font-semibold">{v.economicNumber}</span><span className="text-[12px] text-slate-500">{v.plates ?? 'Sin placas'}</span></span>
                </button>
              ))}
            </div>
            {freeVehicles.length === 0 && <p className="text-[13px] text-slate-400">No hay unidades sin GPS. Puede registrar unidades en el módulo Unidades.</p>}
            <div className="rounded-2xl bg-pearl-100 p-4 text-[14px] dark:bg-ink-700">
              <p className="font-semibold">Resumen</p>
              <p className="text-slate-500">{model?.manufacturer} {model?.model} · protocolo {model?.protocol} · puerto {model?.port} · ID {uniqueId}</p>
            </div>
          </div>
        )}

        <div className="mt-4"><ErrorNote message={error} /></div>
        <div className="mt-6 flex justify-between gap-2">
          <button className="btn-secondary" onClick={() => (step === 0 ? nav('/dispositivos') : setStep(step - 1))}>{step === 0 ? 'Cancelar' : 'Atrás'}</button>
          {step < 4 ? (
            <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar <ChevronRight className="h-5 w-5" /></button>
          ) : (
            <button className="btn-primary" disabled={busy} onClick={() => void create()}>{busy ? <Spinner /> : <>Registrar equipo <ChevronRight className="h-5 w-5" /></>}</button>
          )}
        </div>
      </div>
    </div>
  );
}
