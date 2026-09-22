import { normalizarDecimal } from './formatoDinero';

/**
 * El total aproximado de un presupuesto en construcción — cantidad × precio por fila, sumado, con
 * aritmética decimal exacta (`BigInt`, nunca `Number`) y **redondeado a 2 decimales** al final.
 *
 * 🔴 **BL-D5.** Vivía duplicado línea a línea en `FormularioPresupuesto.tsx` de mobile y web:
 * multiplicar dos decimales exactos SUMA sus cantidades de decimales (`"1.00" × "30000.00"` da
 * `"30000.0000"`, matemáticamente correcto: 2+2 decimales), pero ninguna de las dos copias
 * redondeaba el resultado antes de mostrarlo — la card mostraba `"Total aproximado: $30.000,0000"`.
 *
 * `formatearImporte` (`./formatoDinero.ts`) NO redondea **a propósito** (ver su docstring): ese
 * módulo re-escribe un importe que YA vino del backend, y redondear ahí escondería un backend mal
 * formado. Este valor es distinto — es un cálculo LOCAL, "aproximado" por definición (el total real
 * lo calcula el backend) — así que acá sí corresponde redondear antes de formatear.
 */

/** Multiplica dos decimales string SIN pasar por `Number`. `null` si alguno no es un decimal válido. */
function multiplicarDecimal(a: string, b: string): string | null {
  const na = normalizarDecimal(a);
  const nb = normalizarDecimal(b);
  if (!/^\d+(\.\d+)?$/.test(na) || !/^\d+(\.\d+)?$/.test(nb)) return null;
  const decimales = (na.split('.')[1]?.length ?? 0) + (nb.split('.')[1]?.length ?? 0);
  const producto = BigInt(na.replace('.', '')) * BigInt(nb.replace('.', ''));
  const s = producto.toString().padStart(decimales + 1, '0');
  const corte = s.length - decimales;
  return decimales === 0 ? s : `${s.slice(0, corte)}.${s.slice(corte)}`;
}

/** Suma dos decimales string SIN pasar por `Number`. */
function sumarDecimal(a: string, b: string): string {
  const decimales = Math.max(a.split('.')[1]?.length ?? 0, b.split('.')[1]?.length ?? 0);
  const escala = (v: string) => {
    const [ent, dec = ''] = v.split('.');
    return BigInt(ent + dec.padEnd(decimales, '0'));
  };
  const suma = (escala(a) + escala(b)).toString().padStart(decimales + 1, '0');
  const corte = suma.length - decimales;
  return decimales === 0 ? suma : `${suma.slice(0, corte)}.${suma.slice(corte)}`;
}

/**
 * Redondea un decimal string no-negativo a `n` decimales, mitad-arriba (`"1.005"` → `"1.01"`), sin
 * pasar por `Number` — evita el famoso `Math.round(1.005 * 100) / 100 === 1` del float binario.
 */
function redondear(valor: string, n: number): string {
  const [ent = '0', dec = ''] = valor.split('.');
  if (dec.length <= n) return n === 0 ? ent : `${ent}.${dec.padEnd(n, '0')}`;
  const conservados = dec.slice(0, n);
  const siguienteDigito = Number(dec[n]);
  let base = BigInt(ent + conservados);
  if (siguienteDigito >= 5) base += 1n;
  const s = base.toString().padStart(n + 1, '0');
  const corte = s.length - n;
  return n === 0 ? s : `${s.slice(0, corte)}.${s.slice(corte)}`;
}

export interface FilaTotalAproximado {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

/**
 * El aproximado del total de un presupuesto, redondeado a 2 decimales — o `null` si alguna fila
 * (con descripción o precio tipeados) todavía no es un número válido.
 *
 * Filas totalmente vacías (sin descripción NI precio) se saltean, igual que hacían las dos copias
 * originales — son la fila en blanco al final del formulario, no un ítem a punto de cargarse.
 */
export function calcularTotalAproximado(items: readonly FilaTotalAproximado[]): string | null {
  let acumulado = '0';
  for (const it of items) {
    if (it.descripcion.trim() === '' && it.precioUnitario.trim() === '') continue;
    const parcial = multiplicarDecimal(it.cantidad, it.precioUnitario);
    if (parcial == null) return null;
    acumulado = sumarDecimal(acumulado, parcial);
  }
  return redondear(acumulado, 2);
}
