/**
 * Formateo de importes **desde string, sin pasar nunca por `number`**.
 *
 * 🔴 **La regla que este módulo existe para hacer cumplible.** El backend manda la plata como string
 * decimal (`"45000.00"`) a propósito: el `float` de JavaScript pierde precisión (`0.1 + 0.2 !== 0.3`)
 * y un redondeo de un centavo en un presupuesto que después se factura es un problema fiscal. Pero
 * un string crudo en pantalla se lee mal (`45000.00` no es `$45.000,00`), y la salida cómoda —
 * `Number(total).toLocaleString()`— reintroduce exactamente el float que el contrato evitó.
 *
 * Sin una función como esta, cada pantalla resuelve el formateo sola y **alguna va a usar `Number`**:
 * no por descuido, sino porque es lo primero que uno escribe. Acá se hace con manipulación de
 * strings, y el tipo de la entrada (`string`) hace incómodo el atajo.
 *
 * ⚠️ **Esto NO es aritmética.** No suma, no multiplica, no redondea: sólo re-escribe para mostrar.
 * Si alguna vez hace falta operar con estos importes, va una librería decimal — nunca `+` sobre
 * `Number()`.
 */

/** Separador de miles y decimal del formato argentino: `1.234.567,89`. */
const SEPARADOR_MILES = '.';
const SEPARADOR_DECIMAL = ',';

/** Agrupa de a tres desde la derecha: `1234567` → `1.234.567`. */
function agruparMiles(entera: string): string {
  let salida = '';
  for (let i = 0; i < entera.length; i += 1) {
    // Cuántos dígitos faltan para el final: cada vez que es múltiplo de 3 (y no es el primero), corta.
    const restantes = entera.length - i;
    if (i > 0 && restantes % 3 === 0) salida += SEPARADOR_MILES;
    salida += entera[i];
  }
  return salida;
}

/**
 * `"45000.00"` → `"$45.000,00"`.
 *
 * El backend garantiza 2 decimales siempre, pero esto tolera que no vengan (`"45000"` → `"$45.000"`)
 * en vez de inventarlos: agregar un `,00` que el backend no mandó sería afirmar una precisión que no
 * se recibió. Un valor no numérico se devuelve **tal cual**, sin símbolo: es preferible mostrar el
 * dato crudo que enmascarar con `$0,00` un backend que mandó algo inesperado.
 */
export function formatearImporte(valor: string, simbolo = '$'): string {
  const limpio = valor.trim();
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) return valor;

  const negativo = limpio.startsWith('-');
  const sinSigno = negativo ? limpio.slice(1) : limpio;
  // `?? ''` para el compilador: el regex de arriba ya garantiza al menos un dígito antes del punto,
  // pero el índice de un `split` es `string | undefined` bajo `noUncheckedIndexedAccess` y ese `!`
  // sería una afirmación no verificable desde acá.
  const partes = sinSigno.split('.');
  const entera = partes[0] ?? '';
  const decimales = partes[1];

  const cuerpo = decimales === undefined
    ? agruparMiles(entera)
    : `${agruparMiles(entera)}${SEPARADOR_DECIMAL}${decimales}`;

  return `${negativo ? '-' : ''}${simbolo}${cuerpo}`;
}

/**
 * `"2026-07-21T22:14:03.120Z"` → `"21 jul"`. Para las cards, donde el año casi siempre sobra.
 *
 * Una fecha ilegible se devuelve `''` en vez de `Invalid Date`: la card simplemente no muestra fecha,
 * que es mejor que mostrar una palabra que el emprendedor no puede interpretar ni corregir.
 */
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatearFechaCorta(iso: string): string {
  if (iso === '') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** `"2026-07-21T22:14:03.120Z"` → `"21 jul 2026"`. Para el detalle, donde el año sí importa. */
export function formatearFechaLarga(iso: string): string {
  if (iso === '') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}
