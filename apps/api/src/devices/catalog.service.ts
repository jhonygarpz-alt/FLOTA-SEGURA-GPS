import { Injectable } from '@nestjs/common';
import catalog from './catalog/traccar-devices.json';

export interface CatalogEntry {
  manufacturer: string;
  model: string;
  protocol: string;
  port: number;
}

/**
 * Notas de validación para modelos prioritarios. Solo se afirma lo que figura en la lista
 * oficial de Traccar; lo demás se marca como pendiente de verificación física.
 */
export const PRIORITY_MODELS = [
  {
    key: 'suntech-st8300rp',
    label: 'Suntech ST8300RP',
    manufacturer: 'Suntech',
    protocol: 'suntech',
    port: 5011,
    verification: 'partial' as const,
    note:
      'La lista oficial de Traccar incluye "Suntech ST8300" (protocolo suntech, puerto 5011). La variante "RP" no aparece por separado: confirme en la etiqueta del equipo el modelo exacto y la versión de firmware antes de instalar en producción.',
  },
  {
    key: 'at6',
    label: 'AT6 (fabricante por confirmar)',
    manufacturer: null,
    protocol: null,
    port: null,
    verification: 'unverified' as const,
    note:
      'Ningún dispositivo llamado exactamente "AT6" figura en la lista oficial de Traccar. Existen equipos AT6 de distintos fabricantes (por ejemplo, rastreadores vehiculares de Jimi IoT/Concox). Envíe una foto de la etiqueta (fabricante, modelo e IMEI) para identificar el protocolo; no asigne puerto hasta confirmarlo.',
  },
];

@Injectable()
export class CatalogService {
  readonly entries: CatalogEntry[] = (catalog as { devices: CatalogEntry[] }).devices;
  readonly meta = { source: catalog.source, retrievedAt: catalog.retrievedAt, traccarVersion: catalog.traccarVersion };

  manufacturers() {
    const map = new Map<string, number>();
    for (const e of this.entries) map.set(e.manufacturer, (map.get(e.manufacturer) ?? 0) + 1);
    return [...map].map(([name, models]) => ({ name, models }));
  }

  models(manufacturer: string) {
    return this.entries.filter((e) => e.manufacturer.toLowerCase() === manufacturer.toLowerCase());
  }

  isValid(protocol: string, port: number) {
    return this.entries.some((e) => e.protocol === protocol && e.port === port);
  }
}
