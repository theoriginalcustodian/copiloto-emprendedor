/**
 * Respuestas de ejemplo del «modo demo» (sólo desarrollo): el cuerpo JSON crudo —tal como lo mandaría el
 * backend— de cada GET que leen las pantallas, para ver la app con una cuenta llena sin tocar el servidor.
 *
 * El negocio es uno solo y es coherente entre endpoints: «Rivas Electricidad», de Diego Rivas, electricista
 * matriculado de Rosario, monotributista. Los mismos clientes, facturas, presupuestos, gastos e ingresos
 * alimentan TODAS las respuestas: los resúmenes, la portada de Inteligencia, los impagos y la actividad se
 * CALCULAN a partir de esas listas, así que no pueden contradecirse.
 *
 * Las fechas se calculan en el momento respecto de hoy (`esteMes`, `mesAnterior`, `enDias`), nunca fijas:
 * «hoy», «este mes» y «mes pasado» siempre tienen datos, se abra cuando se abra.
 *
 * Todos los CUIT, DNI, teléfonos y mails son inventados. Acá hay datos y nada más: ni lógica de UI ni
 * imports desde `modules/`. La forma de cada respuesta la fija `respuestasDemo.test.ts`, que la pasa por
 * los lectores reales del core.
 */
import { LEGAL_VERSION } from '@copiloto/core';
import type { MeResponse, PeticionHttp } from '@copiloto/core';

// ---------------------------------------------------------------------------
// Fechas relativas a hoy
// ---------------------------------------------------------------------------

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` en hora local (no UTC: a la noche `toISOString()` ya dice «mañana»). */
function isoDia(d: Date): string {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`;
}

/** El día de hoy corrido `n` días (negativo = para atrás), como fecha local. */
function fechaEnDias(n: number): Date {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate() + n);
}

/** Dentro de `n` días (`n` negativo = hace tantos días). */
function enDias(n: number): string {
  return isoDia(fechaEnDias(n));
}

/**
 * Un día de ESTE mes, `n` días atrás. Se recorta al día 1: a principio de mes «hace 9 días» caería en el
 * mes pasado y «este mes» quedaría vacío.
 */
function esteMes(n: number): string {
  const diaDelMes = new Date().getDate();
  return enDias(-Math.min(n, diaDelMes - 1));
}

/** El día `dia` de `meses` meses atrás (día ≤ 28, para que exista en febrero). */
function mesAnterior(meses: number, dia: number): string {
  const h = new Date();
  return isoDia(new Date(h.getFullYear(), h.getMonth() - meses, Math.min(dia, 28)));
}

/** `YYYY-MM` de `meses` meses atrás (0 = el mes en curso). */
function periodoHace(meses: number): string {
  const h = new Date();
  return isoDia(new Date(h.getFullYear(), h.getMonth() - meses, 1)).slice(0, 7);
}

/** Cuántos meses atrás queda un período `YYYY-MM` (0 = este mes; negativo = futuro). */
function mesesAtras(periodo: string): number {
  const h = new Date();
  const [anio, mes] = periodo.split('-').map(Number);
  if (anio == null || mes == null || Number.isNaN(anio) || Number.isNaN(mes)) return 0;
  return (h.getFullYear() - anio) * 12 + (h.getMonth() + 1 - mes);
}

function fechaDe(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** Días corridos desde `dia` hasta hoy (negativo = todavía no llegó). */
function diasDesde(dia: string): number {
  return Math.round((fechaEnDias(0).getTime() - fechaDe(dia).getTime()) / 86_400_000);
}

function sumarDias(dia: string, n: number): string {
  const f = fechaDe(dia);
  return isoDia(new Date(f.getFullYear(), f.getMonth(), f.getDate() + n));
}

/** Instante ISO de un día a una hora LOCAL (lo que el backend manda como timestamp). */
function instante(dia: string, hora: number, minuto = 0): string {
  const f = fechaDe(dia);
  return new Date(f.getFullYear(), f.getMonth(), f.getDate(), hora, minuto).toISOString();
}

/** «11 de octubre» */
function diaEnPalabras(dia: string): string {
  const f = fechaDe(dia);
  return `${f.getDate()} de ${MESES[f.getMonth()]}`;
}

// ---------------------------------------------------------------------------
// Plata
// ---------------------------------------------------------------------------

/** El wire manda la plata como string decimal con dos decimales. */
const plata = (n: number): string => n.toFixed(2);

/** «$480.000», para los textos redactados (tarjetas de Mi día). */
const pesos = (n: number): string => `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const sumar = (ns: readonly number[]): number => ns.reduce((a, n) => a + n, 0);

// ---------------------------------------------------------------------------
// El negocio
// ---------------------------------------------------------------------------

export const CUIT_DEMO = '20301112223';
const EMAIL_DEMO = 'diego@rivaselectricidad.ejemplo.com';
const PUNTO_VENTA = 1;
/** Factura C: la que emite un monotributista. */
const TIPO_FACTURA_C = 11;
const DOC_CUIT = 80;
const DOC_DNI = 96;
const IVA_RESP_INSCRIPTO = 1;
const IVA_EXENTO = 4;
const IVA_CONSUMIDOR_FINAL = 5;

interface ClienteDemo {
  id: number;
  nombre: string;
  docTipo: number | null;
  docNro: string | null;
  condicionIva: number | null;
  domicilio: string | null;
  email: string | null;
  telefono: string | null;
  notas: string | null;
  origen: 'derivado' | 'manual' | 'voz';
  creado: string;
}

interface ItemDemo {
  descripcion: string;
  cantidad: number;
  precio: number;
}

interface PresupuestoDemo {
  id: number;
  numero: number;
  fecha: string;
  clienteId: number;
  concepto: string;
  items: ItemDemo[];
  estado: 'pendiente' | 'aprobado' | 'desestimado';
  /** Id de la factura que salió de este presupuesto, si ya se facturó. */
  facturaId: number | null;
  sinRespuesta: boolean;
}

interface FacturaDemo {
  id: number;
  nro: number;
  fecha: string;
  clienteId: number;
  concepto: string;
  total: number;
  presupuestoId: number | null;
}

interface IngresoDemo {
  id: number;
  fecha: string;
  monto: number;
  medio: 'transferencia' | 'efectivo' | 'mercadopago';
  origen: 'factura' | 'mercadopago' | 'voz';
  clienteId: number;
  concepto: string;
  /** El cobro de una factura es, además, un ingreso: mismo registro, dos vistas. */
  facturaId: number | null;
}

interface GastoDemo {
  id: number;
  fecha: string;
  monto: number;
  categoria: 'mercaderia' | 'servicios' | 'impuestos' | 'transporte' | 'herramientas';
  proveedor: string;
  medioPago: string;
  descripcion: string;
  origen: 'voz' | 'manual' | 'foto';
  /** Presupuesto (trabajo) al que se imputó el gasto. */
  presupuestoId: number | null;
}

interface NegocioDemo {
  clientes: ClienteDemo[];
  presupuestos: PresupuestoDemo[];
  facturas: FacturaDemo[];
  ingresos: IngresoDemo[];
  gastos: GastoDemo[];
}

/** Arma el negocio completo con las fechas de HOY. Barato: se llama en cada respuesta. */
function negocio(): NegocioDemo {
  const clientes: ClienteDemo[] = [
    {
      id: 1, nombre: 'Consorcio Pellegrini 1250', docTipo: DOC_CUIT, docNro: '30701112224', condicionIva: IVA_EXENTO,
      domicilio: 'Av. Pellegrini 1250, Rosario', email: 'administracion@consorciopellegrini.ejemplo.com',
      telefono: '341 555-0101', notas: 'Hablar con Graciela, la administradora. Portero en planta baja.',
      origen: 'derivado', creado: mesAnterior(7, 9),
    },
    {
      id: 2, nombre: 'Laura Benítez', docTipo: DOC_DNI, docNro: '30111222', condicionIva: IVA_CONSUMIDOR_FINAL,
      domicilio: 'Mendoza 2840, 3° B, Rosario', email: 'laura.benitez@ejemplo.com', telefono: '341 555-0102',
      notas: 'Departamento antiguo, instalación original de tela y goma.', origen: 'voz', creado: mesAnterior(2, 18),
    },
    {
      id: 3, nombre: 'Estudio Ferrero', docTipo: DOC_CUIT, docNro: '30701113335', condicionIva: IVA_RESP_INSCRIPTO,
      domicilio: 'Córdoba 1452, piso 6, Rosario', email: 'contacto@estudioferrero.ejemplo.com',
      telefono: '341 555-0103', notas: null, origen: 'derivado', creado: mesAnterior(6, 3),
    },
    {
      id: 4, nombre: 'Panadería La Espiga', docTipo: DOC_CUIT, docNro: '30701114446', condicionIva: IVA_RESP_INSCRIPTO,
      domicilio: 'San Martín 3310, Rosario', email: 'laespiga@ejemplo.com', telefono: '341 555-0104',
      notas: 'Trabajar después de las 14: a la mañana está el horno prendido.', origen: 'derivado',
      creado: mesAnterior(5, 21),
    },
    {
      id: 5, nombre: 'Marcelo Quiroga', docTipo: DOC_DNI, docNro: '28111333', condicionIva: IVA_CONSUMIDOR_FINAL,
      domicilio: 'Zeballos 915, Rosario', email: null, telefono: '341 555-0105', notas: null, origen: 'voz',
      creado: mesAnterior(3, 14),
    },
    {
      id: 6, nombre: 'Kiosco El Faro', docTipo: null, docNro: null, condicionIva: null,
      domicilio: 'Bv. Oroño 780, Rosario', email: null, telefono: '341 555-0106',
      notas: 'Paga siempre por Mercado Pago.', origen: 'manual', creado: mesAnterior(4, 2),
    },
    {
      id: 7, nombre: 'Silvina Ortiz', docTipo: DOC_DNI, docNro: '32111444', condicionIva: IVA_CONSUMIDOR_FINAL,
      domicilio: 'Pasco 1620, Rosario', email: 'silvina.ortiz@ejemplo.com', telefono: '341 555-0107', notas: null,
      origen: 'derivado', creado: mesAnterior(1, 19),
    },
    {
      id: 8, nombre: 'Gimnasio Impulso', docTipo: DOC_CUIT, docNro: '30701115557', condicionIva: IVA_RESP_INSCRIPTO,
      domicilio: 'Av. Francia 2105, Rosario', email: 'hola@gimnasioimpulso.ejemplo.com', telefono: '341 555-0108',
      notas: 'Tablero principal en el depósito del fondo.', origen: 'derivado', creado: esteMes(13),
    },
    {
      id: 9, nombre: 'Tomás Ledesma', docTipo: DOC_DNI, docNro: '35111555', condicionIva: IVA_CONSUMIDOR_FINAL,
      domicilio: null, email: null, telefono: '341 555-0109', notas: 'Lo recomendó Laura Benítez.', origen: 'voz',
      creado: esteMes(2),
    },
  ];

  const itemsTablero: ItemDemo[] = [
    { descripcion: 'Gabinete, térmicas y disyuntor diferencial', cantidad: 1, precio: 210_000 },
    { descripcion: 'Mano de obra: armado y conexionado', cantidad: 1, precio: 230_000 },
    { descripcion: 'Rotulado de circuitos y medición final', cantidad: 1, precio: 40_000 },
  ];

  const presupuestos: PresupuestoDemo[] = [
    {
      id: 21, numero: 14, fecha: mesAnterior(2, 27), clienteId: 1, concepto: 'Tablero eléctrico nuevo',
      items: itemsTablero, estado: 'aprobado', facturaId: 102, sinRespuesta: false,
    },
    {
      id: 22, numero: 15, fecha: mesAnterior(1, 8), clienteId: 4, concepto: 'Luminarias LED en local',
      items: [
        { descripcion: 'Luminaria LED de 40 W', cantidad: 12, precio: 12_500 },
        { descripcion: 'Mano de obra: colocación y cableado', cantidad: 1, precio: 110_000 },
      ],
      estado: 'aprobado', facturaId: 103, sinRespuesta: false,
    },
    {
      id: 23, numero: 16, fecha: mesAnterior(1, 18), clienteId: 3, concepto: 'Recableado de oficinas',
      items: [
        { descripcion: 'Cable, cañería y cajas', cantidad: 1, precio: 280_000 },
        { descripcion: 'Mano de obra: recableado de seis oficinas', cantidad: 1, precio: 360_000 },
      ],
      estado: 'desestimado', facturaId: null, sinRespuesta: false,
    },
    {
      id: 24, numero: 17, fecha: mesAnterior(1, 24), clienteId: 6, concepto: 'Tablero eléctrico nuevo',
      items: itemsTablero, estado: 'pendiente', facturaId: null, sinRespuesta: true,
    },
    {
      id: 25, numero: 18, fecha: mesAnterior(1, 28), clienteId: 2, concepto: 'Recableado de departamento',
      items: [
        { descripcion: 'Cable de 2,5 y 4 mm, caños y cajas', cantidad: 1, precio: 380_000 },
        { descripcion: 'Mano de obra: recableado completo', cantidad: 1, precio: 460_000 },
        { descripcion: 'Tablero seccional con térmicas', cantidad: 1, precio: 80_000 },
      ],
      estado: 'aprobado', facturaId: 106, sinRespuesta: false,
    },
    {
      id: 26, numero: 19, fecha: esteMes(13), clienteId: 8, concepto: 'Puesta a tierra',
      items: [
        { descripcion: 'Jabalina, cable desnudo y morsetos', cantidad: 1, precio: 52_000 },
        { descripcion: 'Mano de obra y medición de resistencia', cantidad: 1, precio: 88_000 },
      ],
      estado: 'aprobado', facturaId: 105, sinRespuesta: false,
    },
    {
      id: 27, numero: 20, fecha: esteMes(2), clienteId: 9, concepto: 'Instalación de aire acondicionado',
      items: [
        { descripcion: 'Instalación de split frío/calor', cantidad: 1, precio: 150_000 },
        { descripcion: 'Línea dedicada con térmica', cantidad: 1, precio: 30_000 },
      ],
      estado: 'pendiente', facturaId: null, sinRespuesta: false,
    },
  ];

  const facturas: FacturaDemo[] = [
    { id: 101, nro: 38, fecha: mesAnterior(2, 22), clienteId: 3, concepto: 'Revisión y certificado', total: 90_000, presupuestoId: null },
    { id: 102, nro: 39, fecha: mesAnterior(1, 6), clienteId: 1, concepto: 'Tablero eléctrico nuevo', total: 480_000, presupuestoId: 21 },
    { id: 103, nro: 40, fecha: mesAnterior(1, 11), clienteId: 4, concepto: 'Luminarias LED en local', total: 260_000, presupuestoId: 22 },
    { id: 104, nro: 41, fecha: mesAnterior(1, 21), clienteId: 7, concepto: 'Instalación de aire acondicionado', total: 180_000, presupuestoId: null },
    { id: 105, nro: 42, fecha: esteMes(12), clienteId: 8, concepto: 'Puesta a tierra', total: 140_000, presupuestoId: 26 },
    { id: 106, nro: 43, fecha: esteMes(9), clienteId: 2, concepto: 'Recableado de departamento', total: 920_000, presupuestoId: 25 },
    { id: 107, nro: 44, fecha: esteMes(5), clienteId: 5, concepto: 'Urgencia por cortocircuito', total: 65_000, presupuestoId: null },
    { id: 108, nro: 45, fecha: esteMes(2), clienteId: 1, concepto: 'Revisión y certificado', total: 90_000, presupuestoId: null },
  ];

  const ingresos: IngresoDemo[] = [
    { id: 301, fecha: mesAnterior(2, 26), monto: 90_000, medio: 'transferencia', origen: 'factura', clienteId: 3, concepto: 'Revisión y certificado', facturaId: 101 },
    { id: 302, fecha: mesAnterior(2, 28), monto: 55_000, medio: 'efectivo', origen: 'voz', clienteId: 6, concepto: 'Cambio de tomas y térmica', facturaId: null },
    { id: 303, fecha: mesAnterior(1, 3), monto: 38_000, medio: 'mercadopago', origen: 'mercadopago', clienteId: 5, concepto: 'Reparación de portero eléctrico', facturaId: null },
    { id: 304, fecha: mesAnterior(1, 14), monto: 480_000, medio: 'transferencia', origen: 'factura', clienteId: 1, concepto: 'Tablero eléctrico nuevo', facturaId: 102 },
    { id: 305, fecha: mesAnterior(1, 21), monto: 180_000, medio: 'mercadopago', origen: 'factura', clienteId: 7, concepto: 'Instalación de aire acondicionado', facturaId: 104 },
    { id: 306, fecha: mesAnterior(1, 25), monto: 48_000, medio: 'mercadopago', origen: 'mercadopago', clienteId: 6, concepto: 'Cambio de térmica y revisión', facturaId: null },
    { id: 307, fecha: mesAnterior(1, 27), monto: 30_000, medio: 'efectivo', origen: 'voz', clienteId: 2, concepto: 'Colocación de dos apliques', facturaId: null },
    { id: 308, fecha: esteMes(10), monto: 70_000, medio: 'transferencia', origen: 'factura', clienteId: 8, concepto: 'Puesta a tierra (seña del 50 %)', facturaId: 105 },
    { id: 309, fecha: esteMes(7), monto: 920_000, medio: 'transferencia', origen: 'factura', clienteId: 2, concepto: 'Recableado de departamento', facturaId: 106 },
    { id: 310, fecha: esteMes(5), monto: 65_000, medio: 'mercadopago', origen: 'factura', clienteId: 5, concepto: 'Urgencia por cortocircuito', facturaId: 107 },
    { id: 311, fecha: esteMes(3), monto: 42_000, medio: 'mercadopago', origen: 'mercadopago', clienteId: 6, concepto: 'Cartel luminoso: cambio de fuente', facturaId: null },
    { id: 312, fecha: esteMes(1), monto: 25_000, medio: 'efectivo', origen: 'voz', clienteId: 7, concepto: 'Cambio de llave térmica', facturaId: null },
  ];

  const gastos: GastoDemo[] = [
    { id: 201, fecha: mesAnterior(1, 5), monto: 148_000, categoria: 'mercaderia', proveedor: 'Electricidad Oroño', medioPago: 'transferencia', descripcion: 'Gabinete, térmicas y disyuntor', origen: 'foto', presupuestoId: 21 },
    { id: 202, fecha: mesAnterior(1, 7), monto: 72_000, categoria: 'impuestos', proveedor: 'ARCA', medioPago: 'débito', descripcion: 'Monotributo', origen: 'manual', presupuestoId: null },
    { id: 203, fecha: mesAnterior(1, 10), monto: 118_000, categoria: 'mercaderia', proveedor: 'Iluminación del Sur', medioPago: 'transferencia', descripcion: 'Luminarias LED y drivers', origen: 'foto', presupuestoId: 22 },
    { id: 204, fecha: mesAnterior(1, 15), monto: 45_000, categoria: 'transporte', proveedor: 'Estación de servicio', medioPago: 'débito', descripcion: 'Combustible de la camioneta', origen: 'voz', presupuestoId: null },
    { id: 205, fecha: mesAnterior(1, 20), monto: 58_000, categoria: 'servicios', proveedor: 'Seguros del Litoral', medioPago: 'débito', descripcion: 'Seguro de la camioneta', origen: 'manual', presupuestoId: null },
    { id: 206, fecha: mesAnterior(1, 26), monto: 86_000, categoria: 'herramientas', proveedor: 'Ferretería Industrial Rosario', medioPago: 'tarjeta', descripcion: 'Pinza amperométrica', origen: 'voz', presupuestoId: null },
    { id: 207, fecha: esteMes(13), monto: 312_000, categoria: 'mercaderia', proveedor: 'Electricidad Oroño', medioPago: 'transferencia', descripcion: 'Cable de 2,5 y 4 mm, caños y cajas', origen: 'foto', presupuestoId: 25 },
    { id: 208, fecha: esteMes(11), monto: 46_000, categoria: 'mercaderia', proveedor: 'Electricidad Oroño', medioPago: 'efectivo', descripcion: 'Jabalina, cable desnudo y morsetos', origen: 'foto', presupuestoId: 26 },
    { id: 209, fecha: esteMes(8), monto: 72_000, categoria: 'impuestos', proveedor: 'ARCA', medioPago: 'débito', descripcion: 'Monotributo', origen: 'manual', presupuestoId: null },
    { id: 210, fecha: esteMes(6), monto: 52_000, categoria: 'transporte', proveedor: 'Estación de servicio', medioPago: 'débito', descripcion: 'Combustible de la camioneta', origen: 'voz', presupuestoId: null },
    { id: 211, fecha: esteMes(4), monto: 58_000, categoria: 'servicios', proveedor: 'Seguros del Litoral', medioPago: 'débito', descripcion: 'Seguro de la camioneta', origen: 'manual', presupuestoId: null },
    { id: 212, fecha: esteMes(1), monto: 39_000, categoria: 'herramientas', proveedor: 'Ferretería Industrial Rosario', medioPago: 'efectivo', descripcion: 'Mechas y discos de corte', origen: 'voz', presupuestoId: null },
  ];

  return { clientes, presupuestos, facturas, ingresos, gastos };
}

// ---------------------------------------------------------------------------
// Cuentas derivadas (una sola fuente para todos los endpoints)
// ---------------------------------------------------------------------------

const delPeriodo = <T extends { fecha: string }>(filas: readonly T[], periodo: string): T[] =>
  filas.filter((f) => f.fecha.startsWith(periodo));

const totalPresupuesto = (p: PresupuestoDemo): number => sumar(p.items.map((i) => i.cantidad * i.precio));

function nombreCliente(n: NegocioDemo, id: number): string {
  return n.clientes.find((c) => c.id === id)?.nombre ?? '';
}

const numeroFactura = (f: FacturaDemo): string => `${String(PUNTO_VENTA).padStart(4, '0')}-${String(f.nro).padStart(8, '0')}`;

function cobradoDe(n: NegocioDemo, f: FacturaDemo): number {
  return sumar(n.ingresos.filter((i) => i.facturaId === f.id).map((i) => i.monto));
}

function estadoCobro(n: NegocioDemo, f: FacturaDemo): 'impaga' | 'parcial' | 'cobrada' {
  const cobrado = cobradoDe(n, f);
  if (cobrado <= 0) return 'impaga';
  return cobrado >= f.total ? 'cobrada' : 'parcial';
}

/**
 * Los meses anteriores al pasado no tienen movimientos en las listas (las listas muestran lo reciente):
 * sus totales son estos, fijos. Índice = meses atrás.
 */
const HISTORIA: Readonly<Record<number, { entro: number; salio: number; facturado: number; facturas: number }>> = {
  2: { entro: 742_000, salio: 468_000, facturado: 730_000, facturas: 6 },
  3: { entro: 668_000, salio: 431_000, facturado: 655_000, facturas: 5 },
  4: { entro: 705_000, salio: 455_000, facturado: 680_000, facturas: 6 },
  5: { entro: 610_000, salio: 402_000, facturado: 590_000, facturas: 5 },
};
/** Facturado de los seis meses previos a la serie, para el acumulado de doce meses. */
const FACTURADO_MESES_VIEJOS = 4_100_000;
/** Tope de la categoría de monotributo del ejemplo (cifra de ejemplo, no la escala oficial). */
const TOPE_MONOTRIBUTO = 24_500_000;
const MESES_DE_SERIE = 6;

interface TotalesMes {
  entro: number;
  salio: number;
  facturado: number;
  facturas: number;
}

/** Totales de un mes: este y el pasado salen de las listas; los anteriores, de `HISTORIA`. */
function totalesDelMes(n: NegocioDemo, atras: number): TotalesMes {
  if (atras === 0 || atras === 1) {
    const periodo = periodoHace(atras);
    const facturas = delPeriodo(n.facturas, periodo);
    return {
      entro: sumar(delPeriodo(n.ingresos, periodo).map((i) => i.monto)),
      salio: sumar(delPeriodo(n.gastos, periodo).map((g) => g.monto)),
      facturado: sumar(facturas.map((f) => f.total)),
      facturas: facturas.length,
    };
  }
  return HISTORIA[atras] ?? { entro: 0, salio: 0, facturado: 0, facturas: 0 };
}

/** Los últimos seis meses, del más viejo al actual. */
function serie(n: NegocioDemo): { mes: string; totales: TotalesMes }[] {
  const puntos: { mes: string; totales: TotalesMes }[] = [];
  for (let atras = MESES_DE_SERIE - 1; atras >= 0; atras -= 1) {
    puntos.push({ mes: periodoHace(atras), totales: totalesDelMes(n, atras) });
  }
  return puntos;
}

function porCategoria(gastos: readonly GastoDemo[]): { categoria: string; total: string; porcentaje: number }[] {
  const total = sumar(gastos.map((g) => g.monto));
  const acumulado = new Map<string, number>();
  for (const g of gastos) acumulado.set(g.categoria, (acumulado.get(g.categoria) ?? 0) + g.monto);
  return [...acumulado.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([categoria, monto]) => ({
      categoria,
      total: plata(monto),
      porcentaje: total > 0 ? Math.round((monto / total) * 100) : 0,
    }));
}

/** Facturado por cliente (todas las facturas del ejemplo), de mayor a menor. */
function rankingClientes(n: NegocioDemo): { clienteId: number; nombre: string; total: number; comprobantes: number }[] {
  return n.clientes
    .map((c) => {
      const suyas = n.facturas.filter((f) => f.clienteId === c.id);
      return { clienteId: c.id, nombre: c.nombre, total: sumar(suyas.map((f) => f.total)), comprobantes: suyas.length };
    })
    .filter((c) => c.comprobantes > 0)
    .sort((a, b) => b.total - a.total);
}

function impagas(n: NegocioDemo): FacturaDemo[] {
  return n.facturas.filter((f) => estadoCobro(n, f) !== 'cobrada');
}

const saldoDe = (n: NegocioDemo, f: FacturaDemo): number => f.total - cobradoDe(n, f);

/**
 * En cuántos días vence el CAE de las facturas de este mes. Va aparte de la fecha de emisión porque a
 * principio de mes esas fechas se amontonan en el día 1 y todos los CAE vencerían juntos, fuera de la semana.
 */
const DIAS_CAE_POR_FACTURA: Readonly<Record<number, number>> = { 105: -2, 106: 1, 107: 5, 108: 8 };

function venceCae(f: FacturaDemo): string {
  const dias = DIAS_CAE_POR_FACTURA[f.id];
  return dias != null ? enDias(dias) : sumarDias(f.fecha, 10);
}

// ---------------------------------------------------------------------------
// Formas crudas (snake_case, como el backend)
// ---------------------------------------------------------------------------

function clienteCrudo(n: NegocioDemo, c: ClienteDemo): Record<string, unknown> {
  const suyas = n.facturas.filter((f) => f.clienteId === c.id);
  return {
    id: c.id,
    nombre: c.nombre,
    doc_tipo: c.docTipo,
    doc_nro: c.docNro,
    condicion_iva: c.condicionIva,
    domicilio: c.domicilio,
    email: c.email,
    telefono: c.telefono,
    notas: c.notas,
    origen: c.origen,
    creado_en: instante(c.creado, 10, 15),
    comprobantes_cantidad: suyas.length,
    monto_facturado: plata(sumar(suyas.map((f) => f.total))),
    // Sin documento cargado, una factura no se le puede atribuir: la app dice «Sin CUIT cargado».
    facturas_atribuibles: c.docNro != null,
  };
}

const linkPresupuesto = (numero: number): string =>
  `https://docs.ejemplo.com/presupuestos/presupuesto-${String(numero).padStart(4, '0')}`;

function presupuestoCrudo(n: NegocioDemo, p: PresupuestoDemo): Record<string, unknown> {
  const c = n.clientes.find((x) => x.id === p.clienteId);
  return {
    id: p.id,
    numero: p.numero,
    fecha: instante(p.fecha, 11, 20),
    concepto: p.concepto,
    receptor: {
      nombre: c?.nombre ?? '',
      doc_tipo: c?.docTipo ?? null,
      doc_nro: c?.docNro ?? null,
      condicion_iva: c?.condicionIva ?? null,
      domicilio: c?.domicilio ?? null,
      contacto: c?.email ?? c?.telefono ?? null,
    },
    items: p.items.map((i, orden) => ({
      orden,
      descripcion: i.descripcion,
      cantidad: String(i.cantidad),
      precio_unitario: plata(i.precio),
      codigo: null,
    })),
    cantidad_items: p.items.length,
    total: plata(totalPresupuesto(p)),
    moneda: 'ARS',
    doc_link: linkPresupuesto(p.numero),
    doc_id: `demo-doc-presupuesto-${p.numero}`,
    sheet_fila: `Presupuestos!A${p.numero + 1}`,
    reemplaza_a: null,
    reemplazado_por: null,
    factura_id: p.facturaId != null ? `presu-${p.id}` : null,
    facturado: p.facturaId != null,
    estado: p.estado,
    estado_actualizado_en: p.estado === 'pendiente' ? null : instante(sumarDias(p.fecha, 2), 16, 40),
    sin_respuesta: p.sinRespuesta,
  };
}

const linkFactura = (f: FacturaDemo): string => `https://drive.ejemplo.com/facturas/factura-c-${numeroFactura(f)}.pdf`;

function comprobanteCrudo(n: NegocioDemo, f: FacturaDemo): Record<string, unknown> {
  const c = n.clientes.find((x) => x.id === f.clienteId);
  return {
    id: f.id,
    cuit: CUIT_DEMO,
    tipo_cbte: TIPO_FACTURA_C,
    punto_venta: PUNTO_VENTA,
    nro: f.nro,
    cae: `7600000000${String(f.nro).padStart(4, '0')}`,
    cae_vto: venceCae(f),
    fecha_emision: f.fecha,
    total: plata(f.total),
    estado: 'emitida',
    pdf_url: null,
    cbte_asoc_nro: null,
    drive_file_id: `demo-drive-factura-${f.nro}`,
    drive_link: linkFactura(f),
    receptor_nombre: c?.nombre ?? null,
    doc_tipo: c?.docTipo ?? null,
    doc_nro: c?.docNro ?? null,
  };
}

function estadoDeCobroCrudo(n: NegocioDemo, f: FacturaDemo): Record<string, unknown> {
  return {
    id: f.id,
    total: plata(f.total),
    cobrado: plata(cobradoDe(n, f)),
    saldo: plata(saldoDe(n, f)),
    estado_cobro: estadoCobro(n, f),
  };
}

function gastoCrudo(n: NegocioDemo, g: GastoDemo): Record<string, unknown> {
  const p = g.presupuestoId != null ? n.presupuestos.find((x) => x.id === g.presupuestoId) : undefined;
  return {
    id: g.id,
    monto: plata(g.monto),
    monto_sugerido: g.origen === 'foto' ? plata(g.monto) : null,
    fecha: g.fecha,
    categoria: g.categoria,
    proveedor: g.proveedor,
    medio_pago: g.medioPago,
    descripcion: g.descripcion,
    origen: g.origen,
    creado_en: instante(g.fecha, 9 + (g.id % 9), 12),
    imputacion:
      p != null
        ? {
            presupuesto_ref: p.id,
            comprobante_ref: null,
            cobro_ref: null,
            etiqueta: `${nombreCliente(n, p.clienteId)} · ${p.concepto}`,
          }
        : null,
  };
}

function ingresoCrudo(n: NegocioDemo, i: IngresoDemo): Record<string, unknown> {
  const f = i.facturaId != null ? n.facturas.find((x) => x.id === i.facturaId) : undefined;
  return {
    id: i.id,
    monto: plata(i.monto),
    medio: i.medio,
    fecha: i.fecha,
    origen: i.origen,
    cliente_nombre: nombreCliente(n, i.clienteId),
    concepto: i.concepto,
    comprobante_id: f?.id ?? null,
    comprobante_nro: f?.nro ?? null,
    presupuesto_ref: f?.presupuestoId ?? null,
    // El cobro de una factura se deshace desde la factura, no desde Ingresos.
    borrable: f == null,
  };
}

/** Más nuevo primero; a igual fecha, el de id más alto. */
const masNuevoPrimero = <T extends { fecha: string; id: number }>(filas: readonly T[]): T[] =>
  [...filas].sort((a, b) => (a.fecha === b.fecha ? b.id - a.id : a.fecha < b.fecha ? 1 : -1));

/** `?limit=`/`?limite=` → cuántas filas devolver; ausente o ilegible = todas. */
function recortar<T>(filas: readonly T[], crudo: string | null): T[] {
  const limite = crudo != null ? Number(crudo) : NaN;
  return Number.isFinite(limite) && limite > 0 ? filas.slice(0, limite) : [...filas];
}

// ---------------------------------------------------------------------------
// Cuenta, catálogo, ARCA, perfil
// ---------------------------------------------------------------------------

const SERVICIOS_GOOGLE = ['gmail', 'googlecalendar', 'googledrive', 'googledocs', 'googlesheets'];

function me(): MeResponse {
  return {
    cliente_id: 'demo-rivas-electricidad',
    email: EMAIL_DEMO,
    cuenta_google: true,
    onboarding_completado: true,
    mp_connected: true,
    composio_connected: SERVICIOS_GOOGLE,
    es_admin: false,
    legal_aceptado: true,
    legal_version_aceptada: LEGAL_VERSION,
    fecha_alta: mesAnterior(8, 12),
  };
}

interface AlcanceDemo {
  texto: string;
  condicion: 'solo_lectura' | 'requiere_ok' | 'ninguna';
  icono?: string;
}

function servicio(
  key: string,
  nombre: string,
  etiqueta: string,
  categoria: string,
  descripcion: string,
  alcance: AlcanceDemo[],
  acciones: string[],
): Record<string, unknown> {
  const esPago = key === 'mercadopago';
  return {
    key,
    display_name: nombre,
    work_label: etiqueta,
    category: categoria,
    kind: esPago ? 'payments' : 'composio',
    description: descripcion,
    capabilities: alcance.map((a) => a.texto),
    alcance_items: alcance,
    acciones,
    connected: true,
    status: 'conectado',
    connect_path: esPago ? '/mp/connect' : `/composio/connect?service=${key}`,
    disconnect_path: esPago ? '/mp/connection' : `/composio/connection?service=${key}`,
  };
}

/** Mismos servicios y textos que `apps/copiloto/catalog.py`, todos conectados y sanos. */
function catalogo(): unknown {
  return {
    services: [
      servicio('mercadopago', 'Mercado Pago', 'Cobrar', 'Pagos', 'Generar links de cobro para tus clientes.', [
        { texto: 'Leer tus cobros', condicion: 'solo_lectura', icono: 'coins' },
        { texto: 'Armar links de cobro cuando vos confirmás', condicion: 'requiere_ok', icono: 'link' },
      ], ['mp_charge']),
      servicio('gmail', 'Gmail', 'Mail', 'Comunicación', 'Mandar correos por vos. No puede leerlos.', [
        { texto: 'Enviar mails', condicion: 'requiere_ok', icono: 'paper-plane-tilt' },
      ], ['gmail_send']),
      servicio('googlecalendar', 'Google Calendar', 'Agenda', 'Agenda', 'Agendarte eventos y reuniones.', [
        { texto: 'Agendar reuniones', condicion: 'requiere_ok' },
      ], ['calendar_book']),
      servicio('googledrive', 'Google Drive', 'Archivos', 'Archivos', 'Archiva tus facturas automáticamente. No se usa por chat.', [
        { texto: 'Guardar tus facturas', condicion: 'ninguna' },
      ], []),
      servicio('googledocs', 'Google Docs', 'Archivos', 'Archivos', 'Crear documentos o leer uno que ya tengas.', [
        { texto: 'Crear documento', condicion: 'requiere_ok', icono: 'file-text' },
        { texto: 'Leer documento', condicion: 'solo_lectura', icono: 'file-text' },
      ], ['docs_create_doc', 'docs_read_doc']),
      servicio('googlesheets', 'Google Sheets', 'Archivos', 'Archivos', 'Agregar filas a tus planillas.', [
        { texto: 'Agregar fila', condicion: 'requiere_ok' },
      ], ['sheets_append_row']),
    ],
  };
}

function estadoArca(): unknown {
  return {
    cuit: CUIT_DEMO,
    cuit_vinculado: CUIT_DEMO,
    conectado: true,
    ws_autorizados: ['wsfe'],
    perfil_completo: true,
    puede_facturar: true,
    motivo_no_puede_facturar: null,
    ambiente: 'prod',
    ambientes_vinculados: ['prod'],
    drive_conectado: true,
    onboarding: { paso: 'habilitado', motivo: null, causa: null, ws_autorizados: ['wsfe'], terminado: true, ok: true },
  };
}

function perfilFiscal(): unknown {
  return {
    perfil: {
      cuit: CUIT_DEMO,
      razon_social: 'RIVAS DIEGO',
      domicilio_comercial: 'Calle de Ejemplo 1234, Rosario, Santa Fe',
      condicion_iva: 'monotributo',
      ingresos_brutos: '021-111222-3',
      inicio_actividades: '2019-03-01',
      punto_venta: PUNTO_VENTA,
      guardar_en_drive: true,
      categoria_monotributo: 'D',
    },
  };
}

function perfilNegocio(): unknown {
  return {
    perfil: {
      que_vende:
        'Instalaciones eléctricas en casas y comercios de Rosario: tableros, recableados, puesta a tierra, luminarias LED, aires acondicionados y urgencias. Electricista matriculado.',
      a_quien: 'ambos',
      nombre_comercial: 'Rivas Electricidad',
      horario_atencion: 'Lunes a viernes de 8 a 18, sábados de 9 a 13',
      telefono: '341 555-0134',
      email: EMAIL_DEMO,
      formalidad: 'cercano',
      largo_respuesta: 'breve',
      nombre_copiloto: 'Odobi',
      modo_ceremonia: 'confirmacion',
      actualizado_en: instante(mesAnterior(2, 4), 19, 5),
    },
  };
}

function ejemploDeTono(q: URLSearchParams): unknown {
  const formal = q.get('formalidad') === 'formal';
  const detallado = q.get('largo_respuesta') === 'detallado';
  const base = formal
    ? 'Listo. Registré el gasto de $52.000 en combustible.'
    : 'Listo, anoté los $52.000 de nafta.';
  const extra = formal
    ? ' En lo que va del mes lleva $579.000 en gastos; si desea, le muestro el detalle por categoría.'
    : ' Este mes vas $579.000 en gastos; si querés te muestro en qué se fue.';
  return { ejemplo: detallado ? base + extra : base };
}

const CONCEPTOS: readonly { id: number; nombre: string; precio: number }[] = [
  { id: 1, nombre: 'Tablero eléctrico nuevo', precio: 480_000 },
  { id: 2, nombre: 'Recableado de departamento', precio: 920_000 },
  { id: 3, nombre: 'Instalación de aire acondicionado', precio: 180_000 },
  { id: 4, nombre: 'Luminarias LED en local', precio: 260_000 },
  { id: 5, nombre: 'Urgencia por cortocircuito', precio: 65_000 },
  { id: 6, nombre: 'Puesta a tierra', precio: 140_000 },
  { id: 7, nombre: 'Revisión y certificado', precio: 90_000 },
];

function capacidades(): unknown {
  return {
    capacidades: [
      { tool: 'emitir_factura', rotulo: 'Facturar', ejemplos: ['facturale 90 mil al Consorcio Pellegrini por la revisión', 'haceme una factura para Laura Benítez'] },
      { tool: 'crear_presupuesto', rotulo: 'Presupuestos', ejemplos: ['armame un presupuesto de tablero nuevo para el Kiosco El Faro'] },
      { tool: 'listar_presupuestos', rotulo: 'Presupuestos', ejemplos: ['qué presupuestos tengo sin respuesta'] },
      { tool: 'registrar_cobro', rotulo: 'Cobros', ejemplos: ['la panadería me pagó la factura', 'quién me debe plata'] },
      { tool: 'mp_charge', rotulo: 'Cobros', ejemplos: ['armame un link de cobro de 65 mil'] },
      { tool: 'registrar_gasto', rotulo: 'Gastos', ejemplos: ['gasté 52 mil en nafta', 'pagué 312 mil de cable en Electricidad Oroño'] },
      { tool: 'registrar_ingreso', rotulo: 'Ingresos', ejemplos: ['me pagaron 25 mil en efectivo por un cambio de térmica'] },
      { tool: 'guardar_cliente', rotulo: 'Clientes', ejemplos: ['agendame a Tomás Ledesma, es cliente nuevo'] },
      { tool: 'calendar_book', rotulo: 'Agenda', ejemplos: ['agendame mañana a las 9 la visita al gimnasio'] },
      { tool: 'gmail_send', rotulo: 'Mail', ejemplos: ['mandale el presupuesto por mail a Estudio Ferrero'] },
    ],
    fechas: {
      entiendo: ['hoy', 'ayer', 'anteayer', 'el lunes', 'el 12'],
      si_no_esta: 'Para cualquier otro día, tocá la fecha en la tarjeta.',
    },
  };
}

// ---------------------------------------------------------------------------
// Mi día
// ---------------------------------------------------------------------------

/** En cuántos días vence el certificado de ARCA del ejemplo. */
const DIAS_CERTIFICADO = 6;

interface TarjetaDemo {
  id: string;
  regla: string | null;
  entidadTipo: string | null;
  entidadId: string | null;
  texto: string;
  cliente?: string;
  categoria: string | null;
  criticidad: 'critico' | 'pronto' | 'sin_plazo';
  verbo: string | null;
  destino?: { tipo: string; id: string };
  presentacion?: {
    chip?: { texto: string; tono: string };
    prosa?: string;
    kv?: { k: string; v: string }[];
  };
  /** Hace cuántos días se creó. */
  creadaHace: number;
}

function tarjetaCruda(t: TarjetaDemo, estado: string): Record<string, unknown> {
  const presentacion =
    t.presentacion != null
      ? {
          ...t.presentacion,
          ...(t.verbo != null && t.destino != null ? { accion: { texto: t.verbo, destino: t.destino } } : {}),
        }
      : null;
  return {
    id: t.id,
    regla: t.regla,
    entidad_tipo: t.entidadTipo,
    entidad_id: t.entidadId,
    texto: t.texto,
    estado,
    datos: {
      ...(t.cliente != null ? { cliente: t.cliente } : {}),
      ...(t.destino != null ? { destino: t.destino } : {}),
    },
    categoria: t.categoria,
    criticidad: t.criticidad,
    verbo: t.verbo,
    presentacion,
    creada_en: instante(enDias(-t.creadaHace), 8, 10),
    movida_en: estado === 'para_hoy' ? null : instante(enDias(-Math.max(t.creadaHace - 1, 0)), 17, 30),
  };
}

function tablero(n: NegocioDemo): unknown {
  const impagaVieja = n.facturas.find((f) => f.id === 103);
  const porVencer = n.facturas.find((f) => f.id === 108);
  const enfriandose = n.presupuestos.find((p) => p.id === 24);
  if (impagaVieja == null || porVencer == null || enfriandose == null) return { solapas: [] };

  const diasImpaga = diasDesde(impagaVieja.fecha);
  const diasCae = -diasDesde(venceCae(porVencer));
  const diasPresupuesto = diasDesde(enfriandose.fecha);
  const periodo = periodoHace(0);
  const materialesMes = sumar(delPeriodo(n.gastos, periodo).filter((g) => g.categoria === 'mercaderia').map((g) => g.monto));
  const materialesAntes = sumar(
    delPeriodo(n.gastos, periodoHace(1)).filter((g) => g.categoria === 'mercaderia').map((g) => g.monto),
  );

  const paraHoy: TarjetaDemo[] = [
    {
      id: 'demo-tarjeta-certificado', regla: 'certificado_afip_por_vencer', entidadTipo: 'certificado', entidadId: CUIT_DEMO,
      texto: `El certificado de ARCA vence en ${DIAS_CERTIFICADO} días. Sin renovarlo no vas a poder facturar.`,
      categoria: 'arca', criticidad: 'critico', verbo: 'Renovarlo',
      destino: { tipo: 'certificado', id: CUIT_DEMO },
      presentacion: {
        chip: { texto: `Vence en ${DIAS_CERTIFICADO} días`, tono: 'critico' },
        prosa: 'Es el permiso que te deja emitir facturas desde la app. Renovarlo lleva un par de minutos.',
        kv: [{ k: 'Vence', v: diaEnPalabras(enDias(DIAS_CERTIFICADO)) }, { k: 'CUIT', v: '20-30111222-3' }],
      },
      creadaHace: 1,
    },
    {
      id: 'demo-tarjeta-impaga', regla: 'facturas_impagas_viejas', entidadTipo: 'comprobante', entidadId: String(impagaVieja.id),
      texto: `Panadería La Espiga te debe ${pesos(impagaVieja.total)} de las luminarias LED desde hace ${diasImpaga} días.`,
      cliente: 'Panadería La Espiga', categoria: 'cobros', criticidad: 'pronto', verbo: 'Reclamar el pago',
      destino: { tipo: 'comprobante', id: String(impagaVieja.id) },
      presentacion: {
        chip: { texto: `${diasImpaga} días sin cobrar`, tono: 'pronto' },
        prosa: `Emitida hace ${diasImpaga} días. Son ${pesos(impagaVieja.total)} que ya facturaste y todavía no entraron.`,
        kv: [{ k: 'Factura', v: numeroFactura(impagaVieja) }, { k: 'Emitida', v: diaEnPalabras(impagaVieja.fecha) }],
      },
      creadaHace: 4,
    },
    {
      id: 'demo-tarjeta-presupuesto', regla: 'presupuestos_enfriandose', entidadTipo: 'presupuesto', entidadId: String(enfriandose.id),
      texto: `Kiosco El Faro no respondió el presupuesto del tablero nuevo (${pesos(totalPresupuesto(enfriandose))}).`,
      cliente: 'Kiosco El Faro', categoria: 'presupuestos', criticidad: 'pronto', verbo: 'Mandarle un recordatorio',
      destino: { tipo: 'presupuesto', id: String(enfriandose.id) },
      presentacion: {
        chip: { texto: `${diasPresupuesto} días sin respuesta`, tono: 'pronto' },
        prosa: 'Los presupuestos que pasan de las tres semanas sin respuesta casi nunca se cierran solos.',
        kv: [
          { k: 'Presupuesto', v: `N° ${enfriandose.numero}` },
          { k: 'Enviado', v: diaEnPalabras(enfriandose.fecha) },
          { k: 'Total', v: pesos(totalPresupuesto(enfriandose)) },
        ],
      },
      creadaHace: 2,
    },
    {
      id: 'demo-tarjeta-cae', regla: 'cae_por_vencer', entidadTipo: 'comprobante', entidadId: String(porVencer.id),
      texto: `El CAE de la factura N° ${porVencer.nro} del Consorcio Pellegrini 1250 vence en ${diasCae} días.`,
      cliente: 'Consorcio Pellegrini 1250', categoria: 'arca', criticidad: 'pronto', verbo: 'Revisarla',
      destino: { tipo: 'comprobante', id: String(porVencer.id) },
      presentacion: {
        chip: { texto: `Vence en ${diasCae} días`, tono: 'pronto' },
        kv: [{ k: 'Factura', v: numeroFactura(porVencer) }, { k: 'Total', v: pesos(porVencer.total) }],
      },
      creadaHace: 1,
    },
    {
      id: 'demo-tarjeta-manual-cinta', regla: null, entidadTipo: null, entidadId: null,
      texto: 'Comprar cinta aisladora y precintos antes de ir al gimnasio',
      categoria: 'tuyas', criticidad: 'sin_plazo', verbo: 'Borrar',
      presentacion: { prosa: 'Lo anotaste vos.', kv: [{ k: 'Anotado', v: 'Hoy, 08:10' }] },
      creadaHace: 0,
    },
  ];

  const haciendo: TarjetaDemo[] = [
    {
      id: 'demo-tarjeta-manual-gimnasio', regla: null, entidadTipo: null, entidadId: null,
      texto: 'Terminar la puesta a tierra del Gimnasio Impulso y medir la resistencia',
      categoria: 'tuyas', criticidad: 'sin_plazo', verbo: 'Borrar',
      presentacion: { prosa: 'Lo anotaste vos.', kv: [{ k: 'Anotado', v: 'Ayer, 18:40' }] },
      creadaHace: 1,
    },
    {
      id: 'demo-tarjeta-gasto-alto', regla: 'gasto_del_mes_alto', entidadTipo: null, entidadId: null,
      texto: `Este mes llevás ${pesos(materialesMes)} en materiales, contra ${pesos(materialesAntes)} del mes pasado.`,
      categoria: null, criticidad: 'sin_plazo', verbo: null,
      presentacion: {
        prosa: 'Casi todo es el cable del recableado de Laura Benítez, que ya está cobrado.',
        kv: [{ k: 'Este mes', v: pesos(materialesMes) }, { k: 'Mes pasado', v: pesos(materialesAntes) }],
      },
      creadaHace: 3,
    },
  ];

  const hechas: TarjetaDemo[] = [
    {
      id: 'demo-tarjeta-manual-laura', regla: null, entidadTipo: null, entidadId: null,
      texto: 'Llamar a Laura Benítez para coordinar la entrega del departamento',
      categoria: 'tuyas', criticidad: 'sin_plazo', verbo: 'Borrar', creadaHace: 8,
    },
    {
      id: 'demo-tarjeta-hecha-consorcio', regla: 'facturas_impagas_viejas', entidadTipo: 'comprobante', entidadId: '102',
      texto: 'El Consorcio Pellegrini 1250 te debía $480.000 del tablero nuevo. Ya te lo pagó.',
      cliente: 'Consorcio Pellegrini 1250', categoria: 'cobros', criticidad: 'pronto', verbo: 'Reclamar el pago',
      destino: { tipo: 'comprobante', id: '102' }, creadaHace: 12,
    },
    {
      id: 'demo-tarjeta-hecha-ferrero', regla: 'presupuestos_enfriandose', entidadTipo: 'presupuesto', entidadId: '23',
      texto: 'Estudio Ferrero no respondía el presupuesto del recableado de oficinas. Le escribiste y lo desestimó.',
      cliente: 'Estudio Ferrero', categoria: 'presupuestos', criticidad: 'pronto', verbo: 'Mandarle un recordatorio',
      destino: { tipo: 'presupuesto', id: '23' }, creadaHace: 10,
    },
    {
      id: 'demo-tarjeta-manual-luminarias', regla: null, entidadTipo: null, entidadId: null,
      texto: 'Pasar a buscar las luminarias de la panadería por Iluminación del Sur',
      categoria: 'tuyas', criticidad: 'sin_plazo', verbo: 'Borrar', creadaHace: 6,
    },
  ];

  return {
    solapas: [
      { id: 'para_hoy', titulo: 'Para hoy', tarjetas: paraHoy.map((t) => tarjetaCruda(t, 'para_hoy')) },
      { id: 'haciendo', titulo: 'Haciendo', tarjetas: haciendo.map((t) => tarjetaCruda(t, 'haciendo')) },
      { id: 'hecha', titulo: 'Hechas', tarjetas: hechas.map((t) => tarjetaCruda(t, 'hecha')) },
    ],
  };
}

function evento(
  id: string,
  titulo: string,
  enCuantosDias: number,
  hora: number,
  minuto: number,
  duracionMin: number,
  ubicacion: string | null,
): Record<string, unknown> {
  const dia = enDias(enCuantosDias);
  const f = fechaDe(dia);
  const inicio = new Date(f.getFullYear(), f.getMonth(), f.getDate(), hora, minuto);
  const fin = new Date(inicio.getTime() + duracionMin * 60_000);
  return {
    id,
    titulo,
    inicio: { dateTime: inicio.toISOString() },
    fin: { dateTime: fin.toISOString() },
    dia_completo: false,
    ubicacion,
  };
}

function eventosDeHoy(): Record<string, unknown>[] {
  return [
    evento('demo-evento-gimnasio', 'Gimnasio Impulso: terminar la puesta a tierra', 0, 8, 30, 120, 'Av. Francia 2105, Rosario'),
    evento('demo-evento-panaderia', 'Panadería La Espiga: revisar la luminaria del mostrador', 0, 11, 0, 45, 'San Martín 3310, Rosario'),
    evento('demo-evento-tomas', 'Tomás Ledesma: visita por el aire acondicionado', 0, 15, 0, 60, null),
    evento('demo-evento-compras', 'Retirar materiales en Electricidad Oroño', 0, 18, 30, 30, 'Bv. Oroño 1450, Rosario'),
  ];
}

/** `/mi-dia/calendario` sin rango: los eventos de hoy. */
function calendarioDeHoy(): unknown {
  return { conectado: true, eventos: eventosDeHoy() };
}

/** `/mi-dia/calendario?desde=&hasta=`: la agenda agrupada. */
function agenda(): unknown {
  return {
    conectado: true,
    grupos: [
      { id: 'hoy', titulo: 'Hoy', eventos: eventosDeHoy() },
      {
        id: 'manana',
        titulo: 'Mañana',
        eventos: [
          evento('demo-evento-consorcio', 'Consorcio Pellegrini 1250: entregar el certificado', 1, 9, 0, 45, 'Av. Pellegrini 1250, Rosario'),
          evento('demo-evento-kiosco', 'Kiosco El Faro: pasar a hablar del tablero', 1, 16, 30, 30, 'Bv. Oroño 780, Rosario'),
        ],
      },
      {
        id: 'semana',
        titulo: 'Esta semana',
        eventos: [
          evento('demo-evento-silvina', 'Silvina Ortiz: service del aire acondicionado', 3, 10, 0, 90, 'Pasco 1620, Rosario'),
          evento('demo-evento-ferrero', 'Estudio Ferrero: medición anual', 4, 14, 0, 60, 'Córdoba 1452, piso 6, Rosario'),
          evento('demo-evento-matricula', 'Curso de actualización de la matrícula', 5, 18, 0, 120, null),
        ],
      },
      {
        id: 'sin_hora',
        titulo: 'Sin hora',
        eventos: [
          {
            id: 'demo-evento-monotributo',
            titulo: 'Vence el monotributo',
            inicio: { date: enDias(5) },
            fin: { date: enDias(6) },
            dia_completo: true,
            ubicacion: null,
          },
        ],
      },
    ],
  };
}

function vencimientos(n: NegocioDemo, q: URLSearchParams): unknown {
  const pedido = Number(q.get('dias'));
  const ventana = Number.isFinite(pedido) && q.get('dias') != null ? pedido : 7;
  const caes = n.facturas
    .map((f) => {
      const vence = venceCae(f);
      return { f, vence, dias: -diasDesde(vence) };
    })
    .filter((x) => x.dias >= 0)
    .map((x) => ({
      tipo: 'cae',
      id: String(x.f.id),
      titulo: `CAE de la factura N° ${x.f.nro}`,
      fecha: x.vence,
      dias: x.dias,
      vencido: false,
    }));
  const certificado = {
    tipo: 'certificado',
    id: CUIT_DEMO,
    titulo: 'Certificado de ARCA',
    fecha: enDias(DIAS_CERTIFICADO),
    dias: DIAS_CERTIFICADO,
    vencido: false,
  };
  return {
    vencimientos: [...caes, certificado].filter((v) => v.dias <= ventana).sort((a, b) => a.dias - b.dias),
  };
}

// ---------------------------------------------------------------------------
// Inteligencia y contabilidad
// ---------------------------------------------------------------------------

function portada(n: NegocioDemo): unknown {
  const puntos = serie(n);
  const mes = totalesDelMes(n, 0);
  const saldo = sumar(puntos.map((p) => p.totales.entro - p.totales.salio));
  const saldoAnterior = saldo - (mes.entro - mes.salio);
  const facturasMes = delPeriodo(n.facturas, periodoHace(0));
  const deuda = impagas(n);
  return {
    caja: {
      saldo: plata(saldo),
      moneda: 'ARS',
      fecha_corte: enDias(0),
      variacion_pct: saldoAnterior > 0 ? (((saldo - saldoAnterior) / saldoAnterior) * 100).toFixed(1) : null,
      incompleta: false,
    },
    mes: {
      ingresos: plata(mes.entro),
      gastos: plata(mes.salio),
      rentabilidad: plata(mes.entro - mes.salio),
      facturado: plata(mes.facturado),
      cobrado: plata(sumar(facturasMes.map((f) => cobradoDe(n, f)))),
    },
    serie_mensual: puntos.map((p) => ({ mes: p.mes, ingresos: plata(p.totales.entro), gastos: plata(p.totales.salio) })),
    mejores_clientes: rankingClientes(n)
      .slice(0, 5)
      .map((c) => ({ cliente: c.nombre, total: plata(c.total), comprobantes: c.comprobantes })),
    por_cobrar: {
      total: plata(sumar(deuda.map((f) => saldoDe(n, f)))),
      // Vencido = lo que quedó sin cobrar de facturas de meses anteriores.
      vencido: plata(sumar(deuda.filter((f) => !f.fecha.startsWith(periodoHace(0))).map((f) => saldoDe(n, f)))),
    },
  };
}

function periodoDeLaSerie(): string {
  return `${periodoHace(MESES_DE_SERIE - 1)}..${periodoHace(0)}`;
}

function graficoFacturacion(n: NegocioDemo, q: URLSearchParams): unknown {
  const detalle = q.get('detalle');
  if (detalle != null && detalle !== '') {
    return {
      mes: detalle,
      filas: masNuevoPrimero(delPeriodo(n.facturas, detalle)).map((f) => ({
        id: f.id,
        numero: numeroFactura(f),
        fecha: f.fecha,
        cliente: nombreCliente(n, f.clienteId),
        total: plata(f.total),
      })),
    };
  }
  return {
    tipo: 'barras',
    periodo: periodoDeLaSerie(),
    serie: serie(n).map((p) => ({ mes: p.mes, total: plata(p.totales.facturado), cantidad: p.totales.facturas })),
  };
}

function graficoEntroVsSalio(n: NegocioDemo, q: URLSearchParams): unknown {
  const detalle = q.get('detalle');
  if (detalle != null && detalle !== '') {
    const [mes = '', lado = 'entro'] = detalle.split(':');
    if (lado === 'salio') {
      return {
        mes,
        filas: masNuevoPrimero(delPeriodo(n.gastos, mes)).map((g) => ({
          id: g.id,
          fecha: g.fecha,
          monto: plata(g.monto),
          categoria: g.categoria,
          detalle: `${g.descripcion} · ${g.proveedor}`,
        })),
      };
    }
    return {
      mes,
      filas: masNuevoPrimero(delPeriodo(n.ingresos, mes)).map((i) => ({
        id: i.id,
        fecha: i.fecha,
        monto: plata(i.monto),
        // El gráfico habla de «dictado» donde el listado de ingresos dice «voz».
        origen: i.origen === 'voz' ? 'dictado' : i.origen,
        detalle: `${i.concepto} · ${nombreCliente(n, i.clienteId)}`,
      })),
    };
  }
  return {
    tipo: 'barras_enfrentadas',
    periodo: periodoDeLaSerie(),
    serie: serie(n).map((p) => ({ mes: p.mes, entro: plata(p.totales.entro), salio: plata(p.totales.salio) })),
  };
}

function graficoCategorias(n: NegocioDemo, q: URLSearchParams): unknown {
  const mes = q.get('mes') ?? periodoHace(0);
  const delMes = delPeriodo(n.gastos, mes);
  const detalle = q.get('detalle');
  if (detalle != null && detalle !== '') {
    return {
      categoria: detalle,
      filas: masNuevoPrimero(delMes.filter((g) => g.categoria === detalle)).map((g) => ({
        id: g.id,
        fecha: g.fecha,
        monto: plata(g.monto),
        detalle: `${g.descripcion} · ${g.proveedor}`,
      })),
    };
  }
  return {
    tipo: 'torta',
    periodo: mes,
    serie: porCategoria(delMes).map((c) => ({ categoria: c.categoria, total: c.total })),
  };
}

interface TrabajoDemo {
  presupuesto: PresupuestoDemo;
  factura: FacturaDemo | undefined;
  cobrado: number;
  gastado: number;
  gastosImputados: number;
}

/** Un «trabajo» = un presupuesto con gastos imputados; lo cobrado sale de su factura. */
function trabajos(n: NegocioDemo): TrabajoDemo[] {
  return n.presupuestos
    .map((presupuesto) => {
      const suyos = n.gastos.filter((g) => g.presupuestoId === presupuesto.id);
      const factura = n.facturas.find((f) => f.id === presupuesto.facturaId);
      return {
        presupuesto,
        factura,
        cobrado: factura != null ? cobradoDe(n, factura) : 0,
        gastado: sumar(suyos.map((g) => g.monto)),
        gastosImputados: suyos.length,
      };
    })
    .filter((t) => t.gastosImputados > 0);
}

function graficoMargenTrabajo(n: NegocioDemo, q: URLSearchParams): unknown {
  const todos = trabajos(n);
  const etiqueta = (t: TrabajoDemo): string => `${nombreCliente(n, t.presupuesto.clienteId)} · ${t.presupuesto.concepto}`;
  const detalle = q.get('detalle');
  if (detalle != null && detalle !== '') {
    const [, ref = ''] = detalle.split(':');
    const t = todos.find((x) => x.presupuesto.id === Number(ref));
    if (t == null) return undefined;
    return {
      trabajo: {
        presupuesto: t.presupuesto.id,
        comprobante: t.factura?.id ?? null,
        cobros: n.ingresos.filter((i) => i.facturaId === t.factura?.id).map((i) => i.id),
      },
      cobrado: plata(t.cobrado),
      gastado: plata(t.gastado),
      margen: plata(t.cobrado - t.gastado),
      gastos_imputados: t.gastosImputados,
    };
  }
  return {
    tipo: 'barras',
    trabajos: todos
      .filter((t) => t.cobrado > 0)
      .map((t) => ({
        eslabon: 'presupuesto',
        ref: t.presupuesto.id,
        etiqueta: etiqueta(t),
        cobrado: plata(t.cobrado),
        gastado: plata(t.gastado),
        margen: plata(t.cobrado - t.gastado),
        gastos_imputados: t.gastosImputados,
      })),
    sin_ingreso: todos
      .filter((t) => t.cobrado <= 0)
      .map((t) => ({
        eslabon: 'presupuesto',
        ref: t.presupuesto.id,
        etiqueta: etiqueta(t),
        gastado: plata(t.gastado),
        gastos_imputados: t.gastosImputados,
      })),
  };
}

function resumenContabilidad(n: NegocioDemo, q: URLSearchParams): unknown {
  const periodo = q.get('periodo') ?? periodoHace(0);
  const atras = mesesAtras(periodo);
  const mes = totalesDelMes(n, atras);
  const anterior = totalesDelMes(n, atras + 1);
  const doceMeses = sumar(serie(n).map((p) => p.totales.facturado)) + FACTURADO_MESES_VIEJOS;
  const porcentaje = Math.round((doceMeses / TOPE_MONOTRIBUTO) * 100);
  // 🟡 Dato de EJEMPLO de un pedido al backend (ver `ProyeccionTope` en core): el ritmo del mes sostenido un año.
  const ritmoAnual = mes.facturado * 12;
  const mesesHastaElTope = mes.facturado > 0 ? Math.ceil((TOPE_MONOTRIBUTO - doceMeses) / mes.facturado) : Infinity;
  const proyeccion = {
    mes_alcance: ritmoAnual >= TOPE_MONOTRIBUTO && mesesHastaElTope <= 12 ? periodoHace(-Math.max(1, mesesHastaElTope)) : null,
    porcentaje: Math.max(porcentaje, Math.round((ritmoAnual / TOPE_MONOTRIBUTO) * 100)),
  };
  return {
    periodo,
    caja: {
      entro: plata(mes.entro),
      salio: plata(mes.salio),
      queda: plata(mes.entro - mes.salio),
      mes_anterior: {
        entro: plata(anterior.entro),
        salio: plata(anterior.salio),
        queda: plata(anterior.entro - anterior.salio),
      },
    },
    gastos: { por_categoria: porCategoria(delPeriodo(n.gastos, periodo)) },
    facturado: {
      periodo: plata(mes.facturado),
      doce_meses: plata(doceMeses),
      tope: {
        valor: plata(TOPE_MONOTRIBUTO),
        porcentaje,
        semaforo: porcentaje >= 90 ? 'rojo' : porcentaje >= 70 ? 'amarillo' : 'verde',
        proyeccion,
      },
    },
    clientes: rankingClientes(n)
      .slice(0, 5)
      .map((c) => ({ cliente_ref: c.clienteId, nombre: c.nombre, total: plata(c.total) })),
  };
}

function resumenGastos(n: NegocioDemo, q: URLSearchParams): unknown {
  const periodo = q.get('periodo') ?? periodoHace(0);
  const atras = mesesAtras(periodo);
  return {
    periodo,
    total: plata(totalesDelMes(n, atras).salio),
    por_categoria: porCategoria(delPeriodo(n.gastos, periodo)),
    mes_anterior: plata(totalesDelMes(n, atras + 1).salio),
  };
}

function resumenIngresos(n: NegocioDemo, q: URLSearchParams): unknown {
  const periodo = q.get('periodo') ?? periodoHace(0);
  const atras = mesesAtras(periodo);
  return {
    periodo,
    total: plata(totalesDelMes(n, atras).entro),
    mes_anterior: plata(totalesDelMes(n, atras + 1).entro),
  };
}

// ---------------------------------------------------------------------------
// Actividad
// ---------------------------------------------------------------------------

interface MovimientoDemo {
  id: string;
  tipo: 'factura' | 'presupuesto' | 'gasto' | 'ingreso' | 'cliente';
  fecha: string;
  titulo: string;
  detalle: string;
  monto: string | null;
  signo: 'entra' | 'sale' | 'neutro';
}

/** Mismo mapeo función → tipos que `apps/copiloto/actividad_store.py`. */
const TIPOS_POR_FUNCION: Readonly<Record<string, readonly string[]>> = {
  facturacion: ['factura', 'nota_credito'],
  gastos: ['gasto'],
  ingresos: ['ingreso'],
  presupuestos: ['presupuesto'],
};

const MOVIMIENTOS_POR_DEFECTO = 15;

const sinAcentos = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function movimientos(n: NegocioDemo): MovimientoDemo[] {
  const filas: MovimientoDemo[] = [
    ...n.facturas.map((f): MovimientoDemo => ({
      id: `factura:${f.id}`,
      tipo: 'factura',
      fecha: instante(f.fecha, 12, 5),
      titulo: `Factura C ${numeroFactura(f)}`,
      detalle: `${nombreCliente(n, f.clienteId)} · ${f.concepto}`,
      monto: plata(f.total),
      signo: 'entra',
    })),
    ...n.presupuestos.map((p): MovimientoDemo => ({
      id: `presupuesto:${p.id}`,
      tipo: 'presupuesto',
      fecha: instante(p.fecha, 11, 20),
      titulo: `Presupuesto N° ${p.numero}`,
      detalle: `${nombreCliente(n, p.clienteId)} · ${p.concepto}`,
      monto: plata(totalPresupuesto(p)),
      signo: 'neutro',
    })),
    ...n.gastos.map((g): MovimientoDemo => ({
      id: `gasto:${g.id}`,
      tipo: 'gasto',
      fecha: instante(g.fecha, 9 + (g.id % 9), 12),
      titulo: g.descripcion,
      detalle: g.proveedor,
      monto: plata(g.monto),
      signo: 'sale',
    })),
    ...n.ingresos.map((i): MovimientoDemo => {
      const f = n.facturas.find((x) => x.id === i.facturaId);
      return {
        id: `ingreso:${i.id}`,
        tipo: 'ingreso',
        fecha: instante(i.fecha, 13 + (i.id % 6), 45),
        titulo: f != null ? `Cobro de la factura ${numeroFactura(f)}` : i.concepto,
        detalle: nombreCliente(n, i.clienteId),
        monto: plata(i.monto),
        signo: 'entra',
      };
    }),
    ...n.clientes
      .filter((c) => c.creado.startsWith(periodoHace(0)))
      .map((c): MovimientoDemo => ({
        id: `cliente:${c.id}`,
        tipo: 'cliente',
        fecha: instante(c.creado, 10, 15),
        titulo: `Cliente nuevo: ${c.nombre}`,
        detalle: c.telefono ?? '',
        monto: null,
        signo: 'neutro',
      })),
  ];
  return filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

function actividad(n: NegocioDemo, q: URLSearchParams): unknown {
  const funcion = q.get('funcion');
  const texto = sinAcentos(q.get('q') ?? '').trim();
  const tipos = funcion != null && funcion !== '' ? (TIPOS_POR_FUNCION[funcion] ?? []) : null;
  const filtradas = movimientos(n)
    .filter((m) => tipos == null || tipos.includes(m.tipo))
    .filter((m) => texto === '' || sinAcentos(`${m.titulo} ${m.detalle}`).includes(texto));
  const limite = Number(q.get('limit'));
  const cuantas = q.get('limit') != null && Number.isFinite(limite) && limite > 0 ? limite : MOVIMIENTOS_POR_DEFECTO;
  return { items: filtradas.slice(0, cuantas), cursor: null };
}

// ---------------------------------------------------------------------------
// El despacho
// ---------------------------------------------------------------------------

/** El id numérico de una ruta `/base/{id}` (o `/base/{id}/sufijo`); `null` si no calza. */
function idDeRuta(ruta: string, base: string, sufijo = ''): number | null {
  if (!ruta.startsWith(`${base}/`) || !ruta.endsWith(sufijo)) return null;
  const medio = ruta.slice(base.length + 1, ruta.length - sufijo.length);
  return /^\d+$/.test(medio) ? Number(medio) : null;
}

/**
 * Cuerpo JSON crudo (tal como lo mandaría el backend) para un GET cubierto; `undefined` si no está cubierto.
 *
 * Un id que no existe en el ejemplo (`/clientes/999`) también es `undefined`: acá no hay forma de decir
 * «404», y quien envuelve el puerto decide qué hacer con lo no cubierto.
 */
export function respuestaDemo(peticion: PeticionHttp): unknown | undefined {
  if (peticion.metodo !== 'GET') return undefined;
  const corte = peticion.path.indexOf('?');
  const ruta = corte === -1 ? peticion.path : peticion.path.slice(0, corte);
  const q = new URLSearchParams(corte === -1 ? '' : peticion.path.slice(corte + 1));
  const n = negocio();

  switch (ruta) {
    case '/me':
      return me();
    case '/catalog':
      return catalogo();
    case '/mi-dia/tablero':
      return tablero(n);
    case '/mi-dia/calendario':
      // Con rango es la agenda agrupada (`leerAgenda`); sin rango, los eventos de hoy (`leerCalendario`).
      return q.has('desde') || q.has('hasta') ? agenda() : calendarioDeHoy();
    case '/mi-dia/vencimientos':
      return vencimientos(n, q);
    case '/inteligencia/portada':
      return portada(n);
    case '/inteligencia/graficos/facturacion':
      return graficoFacturacion(n, q);
    case '/inteligencia/graficos/entro-vs-salio':
      return graficoEntroVsSalio(n, q);
    case '/inteligencia/graficos/categorias':
      return graficoCategorias(n, q);
    case '/inteligencia/graficos/margen-trabajo':
      return graficoMargenTrabajo(n, q);
    case '/actividad':
      return actividad(n, q);
    case '/gastos': {
      const filas = masNuevoPrimero(n.gastos);
      return { gastos: recortar(filas, q.get('limit')).map((g) => gastoCrudo(n, g)), total: filas.length };
    }
    case '/gastos/resumen':
      return resumenGastos(n, q);
    case '/ingresos': {
      const filas = recortar(masNuevoPrimero(n.ingresos), q.get('limite'));
      return { ingresos: filas.map((i) => ingresoCrudo(n, i)), total: plata(sumar(filas.map((i) => i.monto))) };
    }
    case '/ingresos/resumen':
      return resumenIngresos(n, q);
    case '/contabilidad/resumen':
      return resumenContabilidad(n, q);
    case '/afip/estado':
      return estadoArca();
    case '/afip/perfil':
      return perfilFiscal();
    case '/afip/comprobantes':
      return { comprobantes: recortar(masNuevoPrimero(n.facturas), q.get('limite')).map((f) => comprobanteCrudo(n, f)) };
    case '/afip/comprobantes/impagos': {
      const deuda = [...impagas(n)].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      return {
        comprobantes: deuda.map((f) => ({
          ...estadoDeCobroCrudo(n, f),
          nro: f.nro,
          receptor_nombre: nombreCliente(n, f.clienteId),
          fecha_emision: f.fecha,
          dias: diasDesde(f.fecha),
        })),
        total_adeudado: plata(sumar(deuda.map((f) => saldoDe(n, f)))),
      };
    }
    case '/presupuestos': {
      const filas = masNuevoPrimero(n.presupuestos);
      return { presupuestos: recortar(filas, q.get('limit')).map((p) => presupuestoCrudo(n, p)), total: filas.length };
    }
    case '/clientes': {
      const texto = sinAcentos(q.get('q') ?? '').trim();
      const filas = n.clientes
        .filter((c) => texto === '' || sinAcentos(`${c.nombre} ${c.docNro ?? ''}`).includes(texto))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return {
        clientes: recortar(filas, q.get('limit')).map((c) => clienteCrudo(n, c)),
        total: filas.length,
        agregados_este_mes: n.clientes.filter((c) => c.creado.startsWith(periodoHace(0))).length,
      };
    }
    case '/conceptos':
      return {
        conceptos: CONCEPTOS.map((c) => ({ id: c.id, nombre: c.nombre, precio_referencia: plata(c.precio), activo: true })),
      };
    case '/perfil-negocio':
      return perfilNegocio();
    case '/perfil-negocio/ejemplo':
      return ejemploDeTono(q);
    case '/capacidades':
      return capacidades();
    case '/feedback':
      return { items: [] };
    case '/soporte/tickets':
      return { items: [], total: 0, respuesta_estimada: null };
    default:
      break;
  }

  const gastoId = idDeRuta(ruta, '/gastos');
  if (gastoId != null) {
    const g = n.gastos.find((x) => x.id === gastoId);
    return g != null ? gastoCrudo(n, g) : undefined;
  }

  const cobrosDe = idDeRuta(ruta, '/afip/comprobantes', '/cobros');
  if (cobrosDe != null) {
    const f = n.facturas.find((x) => x.id === cobrosDe);
    if (f == null) return undefined;
    return {
      cobros: masNuevoPrimero(n.ingresos.filter((i) => i.facturaId === f.id)).map((i) => ({
        id: i.id,
        monto: plata(i.monto),
        medio: i.medio,
        fecha: i.fecha,
        created_at: instante(i.fecha, 13 + (i.id % 6), 45),
      })),
      comprobante: estadoDeCobroCrudo(n, f),
    };
  }

  const comprobanteId = idDeRuta(ruta, '/afip/comprobantes');
  if (comprobanteId != null) {
    const f = n.facturas.find((x) => x.id === comprobanteId);
    return f != null ? { comprobante: comprobanteCrudo(n, f) } : undefined;
  }

  const presupuestoId = idDeRuta(ruta, '/presupuestos');
  if (presupuestoId != null) {
    const p = n.presupuestos.find((x) => x.id === presupuestoId);
    return p != null ? { presupuesto: presupuestoCrudo(n, p) } : undefined;
  }

  const clienteId = idDeRuta(ruta, '/clientes');
  if (clienteId != null) {
    const c = n.clientes.find((x) => x.id === clienteId);
    if (c == null) return undefined;
    return {
      cliente: clienteCrudo(n, c),
      presupuestos: masNuevoPrimero(n.presupuestos.filter((p) => p.clienteId === c.id)).map((p) => ({
        id: p.id,
        fecha: p.fecha,
        total: plata(totalPresupuesto(p)),
        concepto: p.concepto,
        numero: p.numero,
        detalle: `N° ${p.numero} · ${p.concepto}`,
      })),
      facturas: masNuevoPrimero(n.facturas.filter((f) => f.clienteId === c.id)).map((f) => ({
        id: f.id,
        fecha: f.fecha,
        total: plata(f.total),
        numero: f.nro,
        detalle: `Factura C ${numeroFactura(f)} · ${f.concepto}`,
      })),
    };
  }

  return undefined;
}
