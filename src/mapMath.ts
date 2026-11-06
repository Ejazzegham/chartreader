// Map maths for the signup map (no libraries). The shapes in public/world-map.json were drawn with the Equal Earth projection;
// project() is the same formula, so a latitude / longitude lands exactly on its place on the map.
export type MapCountry = { n: string; d: string; b: number[] };
export type MapData = { w: number; h: number; p: { s: number; tx: number; ty: number }; c: Record<string, MapCountry> };
export type VB = [number, number, number, number];

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;

export function project(p: MapData['p'], lon: number, lat: number): [number, number] {
  const phi = (lat * Math.PI) / 180, lam = (lon * Math.PI) / 180;
  const l = Math.asin(M * Math.sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
  const x = (lam * Math.cos(l)) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)));
  const y = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2));
  return [p.tx + p.s * x, p.ty - p.s * y];
}

// The part of the map to show for one country: its biggest piece (so Alaska or French Guiana do not shrink the view), with some air around it,
// never smaller than `minW` map units (a tiny country would otherwise be magnified into a blur), in the same shape as the whole map.
export function zoomBox(b: number[], aspect: number, minW = 90): VB {
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  const w = Math.max((b[2] - b[0]) * 1.45, (b[3] - b[1]) * 1.45 * aspect, minW), h = w / aspect;
  return [cx - w / 2, cy - h / 2, w, h];
}
