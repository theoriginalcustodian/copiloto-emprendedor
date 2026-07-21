import type { OpcionSelect } from '../../theme/glass/campos';

/**
 * Catálogos fijos de `CampoSelect` para el formulario de facturación. Los códigos numéricos
 * (`condicionIva`/`tipoDoc` del receptor) son los de AFIP (`CondicionIVA`/`TipoDoc` en
 * `afip_rules.py`, backend) — `afip.ts` deliberadamente NO los reexpone (ver su docstring de
 * `ReceptorInput`: "esta capa no reexpone ese catálogo"), así que viven acá, en la UI que los usa.
 *
 * `CampoSelect.valor`/`onChange` trabajan en `string` (son chips, no un `<select numérico>`) — por eso
 * cada `valor` es un string aunque represente un código numérico. La conversión a `number` para el
 * payload de `setCliente`/`setDatosVenta` ocurre en el punto de envío (`Number(valor)`), nunca acá:
 * esto es un catálogo de CÓDIGOS fijos, no un importe — no aplica la prohibición de `Number()` de
 * `CampoNumero` (esa es sólo para dinero).
 */

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
export const OPCIONES_TIPO_DOC: OpcionSelect[] = [
  { valor: '80', etiqueta: 'CUIT' },
  { valor: '86', etiqueta: 'CUIL' },
  { valor: '96', etiqueta: 'DNI' },
  { valor: '99', etiqueta: 'Consumidor Final' },
];
