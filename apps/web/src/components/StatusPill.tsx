import clsx from 'clsx';
import { AlertTriangle, CircleParking, Navigation, Pause, WifiOff, MinusCircle } from 'lucide-react';
import { STATE_META, VehicleState } from '../lib/status';

const ICONS = { moving: Navigation, idle: Pause, parked: CircleParking, alert: AlertTriangle, offline: WifiOff, nodata: MinusCircle };

/** El color de estado siempre va acompañado de icono y texto (accesibilidad). */
export function StatusPill({ state, short, className }: { state: VehicleState; short?: boolean; className?: string }) {
  const meta = STATE_META[state];
  const Icon = ICONS[state];
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold', className)}
      style={{ color: meta.color, backgroundColor: `${meta.color}1A` }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden />
      <span className="dark:brightness-150">{short ? meta.short : meta.label}</span>
    </span>
  );
}
