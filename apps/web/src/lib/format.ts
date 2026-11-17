/** Configuración regional: español de México, km/h, km, litros, MXN. Fechas en UTC internamente. */
export const LOCALE = 'es-MX';

export function fmtDateTime(iso: string | null | undefined, tz?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeStyle: 'short', timeZone: tz }).format(new Date(iso));
}

export function fmtDate(iso: string | Date, tz?: string) {
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz }).format(new Date(iso));
}

export function fmtSpeed(kmh: number | null | undefined) {
  if (kmh == null) return '—';
  return `${Math.round(kmh)} km/h`;
}

export function fmtKm(km: number) {
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(km)} km`;
}

export function fmtMxn(n: number) {
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'MXN' }).format(n);
}

const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
export function fmtAgo(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 'Sin datos';
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const a = Math.abs(s);
  if (a < 45) return 'hace un momento';
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

export function greeting(tz?: string) {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date()));
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TRACTOR: 'Tractocamión',
  TANKER: 'Autotanque',
  TRAILER: 'Remolque',
  TRUCK: 'Camión',
  CAR: 'Automóvil',
  MOTORCYCLE: 'Motocicleta',
  MACHINERY: 'Maquinaria',
};
