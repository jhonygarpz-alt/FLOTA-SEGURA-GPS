export type LngLat = [number, number];
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(a: LngLat, b: LngLat) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Punto a `meters` desde el inicio de la polilínea, con su rumbo. */
export function pointAlong(line: LngLat[], meters: number): { point: LngLat; course: number } {
  let remaining = meters;
  for (let i = 0; i < line.length - 1; i++) {
    const seg = distanceMeters(line[i], line[i + 1]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        point: [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t],
        course: bearing(line[i], line[i + 1]),
      };
    }
    remaining -= seg;
  }
  const n = line.length;
  return { point: line[n - 1], course: bearing(line[n - 2], line[n - 1]) };
}

export function lineLength(line: LngLat[]) {
  let total = 0;
  for (let i = 0; i < line.length - 1; i++) total += distanceMeters(line[i], line[i + 1]);
  return total;
}
