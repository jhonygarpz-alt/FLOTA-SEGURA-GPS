import { LngLat } from './geo';

/**
 * Escenarios del MODO DEMOSTRACIÓN. Son datos sintéticos, claramente marcados como
 * demostración, y nunca se mezclan con dispositivos reales.
 */
export interface DemoScenario {
  uniqueId: string;
  kind: 'moving' | 'idle' | 'parked' | 'offline' | 'alert';
  route?: LngLat[];
  point?: LngLat;
  speedKmh?: number;
  alarm?: string;
  offlineHours?: number;
  fuel?: number;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  { uniqueId: 'DEMO-0001', kind: 'moving', speedKmh: 42, fuel: 63, route: [[-99.1677, 19.427], [-99.171, 19.41], [-99.176, 19.395], [-99.18, 19.38], [-99.185, 19.36], [-99.187, 19.345]] },
  { uniqueId: 'DEMO-0002', kind: 'moving', speedKmh: 84, fuel: 48, route: [[-99.205, 19.505], [-99.225, 19.55], [-99.24, 19.6], [-99.27, 19.66], [-99.31, 19.72], [-99.36, 19.79]] },
  { uniqueId: 'DEMO-0003', kind: 'moving', speedKmh: 55, route: [[-100.3161, 25.6866], [-100.3, 25.675], [-100.28, 25.67], [-100.26, 25.68], [-100.245, 25.695]] },
  { uniqueId: 'DEMO-0004', kind: 'idle', point: [-103.3496, 20.6597], fuel: 71 },
  { uniqueId: 'DEMO-0005', kind: 'parked', point: [-99.15, 19.49] },
  { uniqueId: 'DEMO-0006', kind: 'alert', point: [-99.34, 20.05], alarm: 'powerCut' },
  { uniqueId: 'DEMO-0007', kind: 'offline', point: [-98.2063, 19.0414], offlineHours: 3 },
];
