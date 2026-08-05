/**
 * Catálogos fijos de opciones de `<select>` para el formulario de facturación. Los códigos numéricos
 * (`condicionIva`/`tipoDoc` del receptor) son los de AFIP (`CondicionIVA`/`TipoDoc` en
 * `afip_rules.py`, backend) — `afip.ts` deliberadamente NO los reexpone (ver su docstring de
 * `ReceptorInput`: "esta capa no reexpone ese catálogo"), así que viven acá, en la UI que los usa.
 *
 * Port de `apps/mobile/src/modules/facturacion/catalogos.ts` — mismos catálogos, mismos valores. La
 * única diferencia es `OpcionSelect`: mobile la importa de `theme/glass/campos` (primitivo de chips);
 * acá es un tipo local mínimo porque el equivalente web es un `<option>` HTML nativo (ver
 * `FormularioGasto.tsx`), que sólo necesita `{ valor, etiqueta }`.
 *
 * `valor` es siempre `string` (matchea `<option value>`) aunque represente un código numérico — la
 * conversión a `number` para el payload de `setCliente`/`setDatosVenta` ocurre en el punto de envío
 * (`Number(valor)`), nunca acá: esto es un catálogo de CÓDIGOS fijos, no un importe.
 */
export interface OpcionSelect {
  valor: string;
  etiqueta: string;
}

/** `DatosVentaInput.concepto`: 1 productos · 2 servicios · 3 ambos (`afip_rules.py`, R6). */
export const OPCIONES_CONCEPTO: OpcionSelect[] = [
  { valor: '1', etiqueta: 'Productos' },
  { valor: '2', etiqueta: 'Servicios' },
  { valor: '3', etiqueta: 'Ambos' },
];

/** El backend sólo valida no-vacío (respuesta backend §"Sobre lo que no me pediste") — este vocabulario
 *  es una elección de la UI, no un catálogo de AFIP. */
export const OPCIONES_CONDICION_VENTA: OpcionSelect[] = [
  { valor: 'contado', etiqueta: 'Contado' },
  { valor: 'cuenta_corriente', etiqueta: 'Cuenta corriente' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
];

/** `ReceptorInput.condicionIva` — códigos de `CondicionIVA` (AFIP). */
export const OPCIONES_CONDICION_IVA_RECEPTOR: OpcionSelect[] = [
  { valor: '1', etiqueta: 'Responsable Inscripto' },
  { valor: '4', etiqueta: 'Exento' },
  { valor: '5', etiqueta: 'Consumidor Final' },
  { valor: '6', etiqueta: 'Monotributo' },
];

/** `ReceptorInput.tipoDoc` — códigos de `TipoDoc` (AFIP). */
/**
 * El código de "consumidor final" en el catálogo de AFIP. Vive nombrado y no como `'99'` suelto porque
 * es el ÚNICO tipo de documento que cambia qué campos son obligatorios (`afip_rules.validar_receptor`:
 * con 99 no se exige documento; con cualquier otro sí). Un `99` mágico en medio de una condición es
 * justo el detalle que se pierde en un refactor.
 */
export const TIPO_DOC_CONSUMIDOR_FINAL = 99;

export const OPCIONES_TIPO_DOC: OpcionSelect[] = [
  { valor: '80', etiqueta: 'CUIT' },
  { valor: '86', etiqueta: 'CUIL' },
  { valor: '96', etiqueta: 'DNI' },
  { valor: '99', etiqueta: 'Consumidor Final' },
];
