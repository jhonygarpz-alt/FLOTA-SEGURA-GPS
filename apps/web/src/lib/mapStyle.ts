/**
 * Estilos de mapa. Por defecto OpenFreeMap (gratuito, sin clave, uso comercial permitido).
 * La vista satelital solo se habilita si se configura un proveedor autorizado (VITE_SATELLITE_STYLE_URL).
 */
export const MAP_STYLE_LIGHT = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
export const MAP_STYLE_DARK = import.meta.env.VITE_MAP_STYLE_DARK_URL || 'https://tiles.openfreemap.org/styles/dark';
export const MAP_STYLE_SATELLITE: string | undefined = import.meta.env.VITE_SATELLITE_STYLE_URL || undefined;
export const MAP_FONT = [import.meta.env.VITE_MAP_FONT || 'Noto Sans Bold'];
export const MEXICO_CENTER: [number, number] = [-99.1332, 19.4326];
