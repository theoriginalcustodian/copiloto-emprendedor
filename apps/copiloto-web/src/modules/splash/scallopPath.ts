/**
 * BL-X10 — festón de N lóbulos (primer blob del splash), puerto directo del generador JS de
 * `explorations/splash-o/v2-inmersivo.html`. Catmull-Rom -> Bezier cúbica sobre un círculo de
 * puntos alternando radio exterior/interior, coords `objectBoundingBox` 0–1 (para `viewBox="0 0 1 1"`).
 */
export function scallopPath(n = 12, notch = 0.06): string {
  const rBase = 0.5 - notch;
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? rBase - notch : rBase + notch;
    pts.push([0.5 + Math.cos(ang) * r, 0.5 + Math.sin(ang) * r]);
  }
  const at = (i: number) => pts[((i % pts.length) + pts.length) % pts.length];

  let d = `M ${at(0)[0].toFixed(4)} ${at(0)[1].toFixed(4)} `;
  for (let i = 0; i < pts.length; i++) {
    const [p0x, p0y] = at(i - 1);
    const [p1x, p1y] = at(i);
    const [p2x, p2y] = at(i + 1);
    const [p3x, p3y] = at(i + 2);
    const c1x = p1x + (p2x - p0x) / 6;
    const c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6;
    const c2y = p2y - (p3y - p1y) / 6;
    d += `C ${c1x.toFixed(4)} ${c1y.toFixed(4)} ${c2x.toFixed(4)} ${c2y.toFixed(4)} ${p2x.toFixed(4)} ${p2y.toFixed(4)} `;
  }
  return `${d}Z`;
}
