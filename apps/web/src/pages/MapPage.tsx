import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import maplibregl, { GeoJSONSource, Map as MlMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import clsx from 'clsx';
import {
  BatteryCharging, ChevronDown, ChevronUp, Crosshair, Expand, Fuel, Gauge, KeyRound, Layers, Link2, LocateFixed, MapPin, Radio, Route, Search, Send, Share2, UserRound, X,
} from 'lucide-react';
import { useFleet } from '../lib/fleet';
import { useIsDark } from '../lib/theme';
import { MAP_FONT, MAP_STYLE_DARK, MAP_STYLE_LIGHT, MAP_STYLE_SATELLITE, MEXICO_CENTER } from '../lib/mapStyle';
import { ALARM_LABELS, STATE_META, vehicleState, VehicleState } from '../lib/status';
import { fmtAgo, fmtDateTime, fmtSpeed, VEHICLE_TYPE_LABELS } from '../lib/format';
import type { FleetVehicle } from '../lib/types';
import { StatusPill } from '../components/StatusPill';
import { VehicleGlyph } from '../components/VehicleGlyph';
import { useAuth } from '../lib/auth';

type Filter = 'all' | VehicleState;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'moving', label: 'En movimiento' },
  { value: 'idle', label: 'Detenidas' },
  { value: 'parked', label: 'Estacionadas' },
  { value: 'alert', label: 'Alertas' },
  { value: 'offline', label: 'Sin comunicación' },
];

function arrowImage(): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(24, 9);
  g.lineTo(35, 36);
  g.lineTo(24, 30);
  g.lineTo(13, 36);
  g.closePath();
  g.fill();
  return g.getImageData(0, 0, 48, 48);
}

/** Rótulos del mapa en español cuando el proveedor los ofrece. */
function localizeLabels(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol' || layer.id.startsWith('veh-') || layer.id.startsWith('cluster')) continue;
    const tf = map.getLayoutProperty(layer.id, 'text-field');
    if (tf && JSON.stringify(tf).includes('name')) map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:es'], ['get', 'name']]);
  }
}

function addFleetLayers(map: MlMap) {
  try {
    localizeLabels(map);
  } catch {
    /* estilo sin rótulos compatibles */
  }
  if (!map.hasImage('fs-arrow')) map.addImage('fs-arrow', arrowImage(), { pixelRatio: 2 });
  if (map.getSource('fleet')) return;
  map.addSource('fleet', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 48, clusterMaxZoom: 11 });
  map.addSource('selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'clusters', type: 'circle', source: 'fleet', filter: ['has', 'point_count'], paint: { 'circle-color': '#0B5966', 'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 50, 32], 'circle-stroke-width': 4, 'circle-stroke-color': 'rgba(34,211,238,.35)' } });
  map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'fleet', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': MAP_FONT, 'text-size': 14 }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'sel-ring', type: 'circle', source: 'selected', paint: { 'circle-radius': 26, 'circle-color': 'rgba(6,182,212,.18)', 'circle-stroke-width': 2, 'circle-stroke-color': '#06B6D4' } });
  map.addLayer({ id: 'veh-dot', type: 'circle', source: 'fleet', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 15, 'circle-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } });
  map.addLayer({ id: 'veh-arrow', type: 'symbol', source: 'fleet', filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'state'], 'moving']], layout: { 'icon-image': 'fs-arrow', 'icon-rotate': ['get', 'course'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true } });
  map.addLayer({ id: 'veh-symbol', type: 'symbol', source: 'fleet', filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'state'], 'moving']], layout: { 'text-field': ['get', 'symbol'], 'text-font': MAP_FONT, 'text-size': 13, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'veh-label', type: 'symbol', source: 'fleet', filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'label'], 'text-font': MAP_FONT, 'text-size': 12, 'text-offset': [0, 1.9], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#0B1215', 'text-halo-color': '#fff', 'text-halo-width': 2 } });
}

export default function MapPage() {
  const { vehicles, offlineMinutes, link, now, loading } = useFleet();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const isDark = useIsDark();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(0);
  const [satellite, setSatellite] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('unidad'));
  const [follow, setFollow] = useState(true);
  const [q, setQ] = useState(params.get('q') ?? '');
  const [filter, setFilter] = useState<Filter>((params.get('estado') as Filter) || 'all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const fittedRef = useRef(false);

  const withState = useMemo(() => vehicles.map((v) => ({ v, state: vehicleState(v.position, offlineMinutes, now) })), [vehicles, offlineMinutes, now]);
  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return withState.filter(({ v, state }) => {
      if (filter !== 'all' && state !== filter && !(filter === 'offline' && state === 'nodata')) return false;
      if (!term) return true;
      return [v.economicNumber, v.plates, v.operator?.name, v.brand, v.model].some((s) => s?.toLowerCase().includes(term));
    });
  }, [withState, q, filter]);
  const selected = withState.find((x) => x.v.id === selectedId) ?? null;

  // Inicializar mapa
  useEffect(() => {
    if (!mapEl.current) return;
    const map = new maplibregl.Map({ container: mapEl.current, style: isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT, center: MEXICO_CENTER, zoom: 5, attributionControl: { compact: true } });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');
    map.on('style.load', () => {
      addFleetLayers(map);
      setReady((r) => r + 1);
    });
    map.on('click', 'veh-dot', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) {
        setSelectedId(id);
        setFollow(true);
      }
    });
    map.on('click', 'clusters', async (e) => {
      const f = e.features?.[0];
      if (!f) return;
      const src = map.getSource('fleet') as GeoJSONSource;
      const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id);
      map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });
    for (const l of ['veh-dot', 'clusters']) {
      map.on('mouseenter', l, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', l, () => (map.getCanvas().style.cursor = ''));
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio de estilo (modo oscuro / satelital)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(satellite && MAP_STYLE_SATELLITE ? MAP_STYLE_SATELLITE : isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, satellite]);

  // Actualizar datos del mapa
  useEffect(() => {
    const map = mapRef.current;
    const src = map?.getSource('fleet') as GeoJSONSource | undefined;
    if (!map || !src) return;
    src.setData({
      type: 'FeatureCollection',
      features: visible
        .filter(({ v }) => v.position)
        .map(({ v, state }) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [v.position!.longitude, v.position!.latitude] },
          properties: { id: v.id, label: v.economicNumber, state, color: STATE_META[state].color, symbol: STATE_META[state].symbol, course: v.position!.course },
        })),
    });
    const sel = map.getSource('selected') as GeoJSONSource | undefined;
    sel?.setData({
      type: 'FeatureCollection',
      features: selected?.v.position ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [selected.v.position.longitude, selected.v.position.latitude] }, properties: {} }] : [],
    });
  }, [visible, selected, ready]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    const pts = visible.filter(({ v }) => v.position).map(({ v }) => [v.position!.longitude, v.position!.latitude] as [number, number]);
    if (!map || !pts.length) return;
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
    pts.forEach((p) => b.extend(p));
    const desktop = w >= 700;
    const padding = desktop ? { top: 80, bottom: 80, left: 420, right: 80 } : { top: 70, bottom: 210, left: 40, right: 40 };
    // Evita relleno mayor que el propio mapa (pantallas pequeñas o en transición)
    if (w <= padding.left + padding.right + 40 || h <= padding.top + padding.bottom + 40) return map.setCenter(pts[0]);
    try {
      map.fitBounds(b, { padding, maxZoom: 14, duration: 700 });
    } catch {
      map.setCenter(pts[0]);
    }
  }, [visible]);

  useEffect(() => {
    if (!fittedRef.current && ready && !loading && visible.some(({ v }) => v.position)) {
      fittedRef.current = true;
      if (!selectedId) fitAll();
    }
  }, [ready, loading, visible, fitAll, selectedId]);

  // Seguimiento automático de la unidad seleccionada
  const selPos = selected?.v.position;
  useEffect(() => {
    if (!selPos || !follow || !mapRef.current) return;
    mapRef.current.easeTo({ center: [selPos.longitude, selPos.latitude], zoom: Math.max(mapRef.current.getZoom(), 14), duration: 800 });
  }, [selPos?.latitude, selPos?.longitude, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (id: string | null) => {
    setSelectedId(id);
    setFollow(true);
    setSheetOpen(false);
    const next = new URLSearchParams(params);
    if (id) next.set('unidad', id);
    else next.delete('unidad');
    setParams(next, { replace: true });
  };

  return (
    <div className="absolute inset-0 bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0">
      <div className="absolute inset-0">
        <div ref={mapEl} className="h-full w-full" aria-label="Mapa de la flota" />
      </div>

      {/* Barra superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-2 p-3 md:left-[392px] md:p-4">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-[13px] font-semibold shadow-float backdrop-blur dark:bg-ink-800/95">
          <span className={clsx('h-2.5 w-2.5 rounded-full', link === 'online' ? 'bg-green-500 animate-pulse2' : 'bg-amber-500')} />
          {link === 'online' ? 'En vivo' : link === 'offline' ? 'Desconectado' : 'Reconectando…'}
          {user?.company?.isDemo && <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] text-amber-950">DEMO</span>}
        </div>
        <div className="flex-1" />
        <div className="pointer-events-auto mr-12 flex gap-2">
          <button onClick={fitAll} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-float dark:bg-ink-800" title="Ver todas las unidades" aria-label="Ver todas las unidades">
            <Expand className="h-5 w-5" />
          </button>
          {MAP_STYLE_SATELLITE && (
            <button onClick={() => setSatellite((s) => !s)} className={clsx('grid h-10 w-10 place-items-center rounded-full shadow-float', satellite ? 'bg-brand-700 text-white' : 'bg-white dark:bg-ink-800')} title="Vista satelital" aria-label="Vista satelital" aria-pressed={satellite}>
              <Layers className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Panel de unidades: hoja inferior en móvil, panel flotante en escritorio */}
      {!selected && (
        <section
          className={clsx(
            'absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[28px] bg-white shadow-float transition-[height] duration-300 dark:bg-ink-800',
            'md:inset-y-4 md:left-4 md:right-auto md:h-auto md:w-[360px] md:rounded-[28px]',
            sheetOpen ? 'h-[72%]' : 'h-[188px]',
          )}
          aria-label="Lista de unidades"
        >
          <button className="flex w-full flex-col items-center pt-2 md:hidden" onClick={() => setSheetOpen((o) => !o)} aria-label={sheetOpen ? 'Contraer lista' : 'Expandir lista'}>
            <span className="h-1.5 w-10 rounded-full bg-pearl-300 dark:bg-white/15" />
          </button>
          <div className="px-4 pb-2 pt-2 md:pt-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold">Monitoreo</h1>
              <button className="text-slate-400 md:hidden" onClick={() => setSheetOpen((o) => !o)} aria-hidden tabIndex={-1}>
                {sheetOpen ? <ChevronDown /> : <ChevronUp />}
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input py-2.5 pl-10" placeholder="Buscar unidad" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setSheetOpen(true)} aria-label="Buscar unidad" />
            </div>
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 no-scrollbar">
              {FILTERS.map((f) => (
                <button key={f.value} onClick={() => setFilter(f.value)} className={clsx('chip', filter === f.value ? 'bg-brand-700 text-white ring-brand-700' : 'bg-white text-slate-600 ring-pearl-200 dark:bg-ink-700 dark:text-slate-300 dark:ring-white/10')}>
                  {f.value !== 'all' && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATE_META[f.value as VehicleState].color }} />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
            {loading && <li className="p-4 text-center text-sm text-slate-400">Cargando flota…</li>}
            {!loading && visible.length === 0 && (
              <li className="p-6 text-center text-sm text-slate-500">
                {vehicles.length === 0 ? (
                  <>
                    Aún no hay unidades.{' '}
                    <Link className="font-semibold text-brand-600" to="/dispositivos/nuevo">
                      Conectar un GPS
                    </Link>
                  </>
                ) : (
                  'Sin resultados para este filtro.'
                )}
              </li>
            )}
            {visible.map(({ v, state }) => (
              <li key={v.id}>
                <button onClick={() => select(v.id)} className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition hover:bg-pearl-100 dark:hover:bg-white/5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${STATE_META[state].color}1F`, color: STATE_META[state].color }}>
                    <VehicleGlyph type={v.type} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{v.economicNumber}</span>
                      {v.plates && <span className="truncate text-[12px] text-slate-400">{v.plates}</span>}
                    </span>
                    <span className="block truncate text-[13px] text-slate-500 dark:text-slate-400">
                      {STATE_META[state].label}
                      {v.position ? ` · ${fmtAgo(v.position.fixTime, now)}` : ''}
                    </span>
                  </span>
                  {state === 'moving' && <span className="text-[13px] font-semibold text-state-moving">{fmtSpeed(v.position?.speedKmh)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && <VehicleCard v={selected.v} state={selected.state} follow={follow} onFollow={() => setFollow((f) => !f)} onClose={() => select(null)} now={now} />}
    </div>
  );
}

function Metric({ icon: Icon, label, value, muted }: { icon: typeof Gauge; label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl bg-pearl-100 p-3 dark:bg-ink-700">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={clsx('mt-1 truncate text-[15px] font-semibold', muted && 'text-slate-400 dark:text-slate-500')}>{value}</div>
    </div>
  );
}

function VehicleCard({ v, state, follow, onFollow, onClose, now }: { v: FleetVehicle; state: VehicleState; follow: boolean; onFollow: () => void; onClose: () => void; now: number }) {
  const p = v.position;
  const online = state !== 'offline' && state !== 'nodata';
  return (
    <section className="absolute inset-x-0 bottom-0 z-20 max-h-[78%] overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-float animate-fade-up dark:bg-ink-800 md:inset-y-4 md:left-4 md:right-auto md:max-h-none md:w-[380px] md:rounded-[28px]" aria-label={`Unidad ${v.economicNumber}`}>
      <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-pearl-300 md:hidden dark:bg-white/15" />
      <div className="flex items-start gap-3">
        <div className="grid h-20 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-pearl-100 dark:bg-ink-700">
          {v.photoUrl ? <img src={v.photoUrl} alt={`Fotografía de ${v.economicNumber}`} className="h-full w-full object-cover" /> : (
            <div className="flex flex-col items-center text-slate-400">
              <VehicleGlyph type={v.type} className="h-8 w-8" />
              <span className="mt-0.5 text-[10px]">Sin fotografía</span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate text-xl font-bold">{v.economicNumber}</h2>
            <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pearl-100 text-slate-500 dark:bg-ink-700" aria-label="Cerrar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="truncate text-[14px] text-slate-500 dark:text-slate-400">
            {[v.plates, VEHICLE_TYPE_LABELS[v.type], [v.brand, v.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill state={state} />
            {p?.source === 'demo' && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800">DEMO</span>}
          </div>
        </div>
      </div>

      {p?.alarm && (
        <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-[14px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
          ⚠ {ALARM_LABELS[p.alarm] ?? `Alarma: ${p.alarm}`}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric icon={Gauge} label="Velocidad" value={p ? fmtSpeed(p.speedKmh) : 'Sin datos'} muted={!p} />
        <Metric icon={KeyRound} label="Ignición" value={p?.ignition == null ? 'No reportada' : p.ignition ? 'Encendida' : 'Apagada'} muted={p?.ignition == null} />
        <Metric icon={Fuel} label="Combustible" value={p?.fuel == null ? 'No disponible' : `${Math.round(p.fuel)} %`} muted={p?.fuel == null} />
        <Metric icon={BatteryCharging} label="Voltaje" value={p?.powerVolts == null ? 'No reportado' : `${p.powerVolts.toFixed(1)} V`} muted={p?.powerVolts == null} />
        <Metric icon={Radio} label="Última transmisión" value={p ? fmtAgo(p.fixTime, now) : 'Nunca'} muted={!p} />
        <Metric icon={Link2} label="Comunicación" value={online ? 'En línea' : 'Sin comunicación'} />
      </div>

      <div className="mt-2 space-y-2 rounded-2xl bg-pearl-100 p-3 text-[14px] dark:bg-ink-700">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate">{v.operator?.name ?? 'Sin operador asignado'}</span>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0">
            {p ? (
              <>
                <span className="block truncate">{p.address ?? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</span>
                <span className="text-[12px] text-slate-400">{fmtDateTime(p.fixTime)}</span>
              </>
            ) : (
              'Sin ubicación registrada'
            )}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <button onClick={onFollow} className={clsx('flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[12px] font-semibold', follow ? 'bg-brand-700 text-white' : 'bg-pearl-100 dark:bg-ink-700')} aria-pressed={follow}>
          {follow ? <LocateFixed className="h-5 w-5" /> : <Crosshair className="h-5 w-5" />} Seguir
        </button>
        <Link to={`/recorridos?unidad=${v.id}`} className="flex flex-col items-center gap-1 rounded-2xl bg-pearl-100 py-2.5 text-[12px] font-semibold dark:bg-ink-700">
          <Route className="h-5 w-5 text-violet-600" /> Recorridos
        </Link>
        <button disabled title="Disponible en la fase 3" className="flex flex-col items-center gap-1 rounded-2xl bg-pearl-100 py-2.5 text-[12px] font-semibold opacity-50 dark:bg-ink-700">
          <Share2 className="h-5 w-5" /> Compartir
        </button>
        <button disabled title="Disponible en la fase 5 con doble autorización" className="flex flex-col items-center gap-1 rounded-2xl bg-pearl-100 py-2.5 text-[12px] font-semibold opacity-50 dark:bg-ink-700">
          <Send className="h-5 w-5" /> Comandos
        </button>
      </div>
    </section>
  );
}
