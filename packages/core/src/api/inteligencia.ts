import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * **`GET /inteligencia/portada` — el resumen del negocio: caja, mes, serie, mejores clientes, por
 * cobrar.**
 *
 * 🔴 **[CONNECT] — construido contra CONTRATO, todavía NO contra el endpoint vivo.** La forma sale del
 * `contrato_..._ADELANTAR-TODO-contra-contrato` §3.1, declarada **real** por planificación (las tablas
 * que la alimentan —ingresos, gastos, cobros, presupuestos— ya existen). El endpoint aún no está
 * publicado; hasta que lo esté, esta función degrada a `no_disponible` como cualquier otra ruta sin
 * desplegar. **El día del connect NO se toca la pantalla: se confirma esta forma contra el vivo y, si
 * cambió, se recablea acá.** Éste es el único punto que el connect toca.
 *
 * 🔴 **La plata viaja como STRING, y acá hay una costura con el contrato que marco en vez de tragar.**
 * El §3.1 escribe los importes como números JSON (`"saldo": 0`). Pero la regla del repo —cargada de
 * incidentes— es **plata como decimal string, nunca `Number()`**: el resto de la API (gastos,
 * presupuestos, cobros) ya lo hace así. Normalizo defensivo con `importe()` —acepta número **o**
 * string del wire y expone string— para no perder precisión si el backend manda números y no romper si
 * manda strings. **[CONNECT] a confirmar:** que el endpoint mande los importes como string, como el
 * resto. Si los manda como número grande, `importe()` ya lo cubre; sólo hay que verificar el caso.
 *
 * 🔴 **`ausente ≠ cero`.** Un importe que no vino vale `null`, jamás `"0"`: *«no hay dato»* y *«vale
 * cero»* se ven idénticos en un KPI y sólo uno es cierto. La pantalla decide qué mostrar con `null`
 * (un guion, un «—»), nunca un cero que miente.
 */

/** Un importe del wire como string, o `null`. Gemelo del de `conceptos.ts`/`cobros.ts`. */
function importe(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

/** La caja: saldo disponible hoy y su moneda. */
export interface CajaPortada {
  saldo: string | null;
  moneda: string;
}

/** El mes en curso: los cinco números que resumen cómo viene. */
export interface MesPortada {
  ingresos: string | null;
  gastos: string | null;
  rentabilidad: string | null;
  facturado: string | null;
  cobrado: string | null;
}

/** Un punto de la serie mensual (para el gráfico de barras/líneas). */
export interface PuntoSerie {
  /** `"2026-03"` — año-mes. Se usa tal cual como clave y etiqueta; la app no lo reformatea a ciegas. */
  mes: string;
  ingresos: string | null;
  gastos: string | null;
}

/** Una fila del ranking de clientes. */
export interface MejorCliente {
  cliente: string;
  total: string | null;
}

/** Lo que falta cobrar, y cuánto de eso ya está vencido. */
export interface PorCobrarPortada {
  total: string | null;
  vencido: string | null;
}

export interface Portada {
  caja: CajaPortada;
  mes: MesPortada;
  serieMensual: readonly PuntoSerie[];
  mejoresClientes: readonly MejorCliente[];
  porCobrar: PorCobrarPortada;
}

interface PortadaRaw {
  caja?: { saldo?: unknown; moneda?: unknown };
  mes?: { ingresos?: unknown; gastos?: unknown; rentabilidad?: unknown; facturado?: unknown; cobrado?: unknown };
  serie_mensual?: unknown;
  mejores_clientes?: unknown;
  por_cobrar?: { total?: unknown; vencido?: unknown };
}

/**
 * 🔴 Un `GET` a una ruta no desplegada devuelve `200` con el HTML del SPA (catch-all del front-door),
 * así que la ausencia del endpoint llega como éxito sin la clave, no como excepción. Sin este chequeo,
 * «la portada todavía no está» y «el negocio está en cero» serían la misma pantalla — y la segunda es
 * una afirmación falsa construida sobre la ausencia del dato.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

function puntoSerie(v: unknown): PuntoSerie | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { mes?: unknown; ingresos?: unknown; gastos?: unknown };
  // Sin `mes` el punto no se puede ubicar en el eje: se descarta, no se pinta en una posición inventada.
  if (typeof r.mes !== 'string' || r.mes.trim() === '') return null;
  return { mes: r.mes, ingresos: importe(r.ingresos), gastos: importe(r.gastos) };
}

function mejorCliente(v: unknown): MejorCliente | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { cliente?: unknown; total?: unknown };
  if (typeof r.cliente !== 'string' || r.cliente.trim() === '') return null;
  return { cliente: r.cliente.trim(), total: importe(r.total) };
}

export async function leerPortada(): Promise<ConDisponibilidad<{ portada: Portada }>> {
  try {
    const raw = await apiClient.get<PortadaRaw>('/inteligencia/portada');
    // La caja es el corazón de la portada: si no vino esa clave, no es una portada.
    if (!esRespuestaDelEndpoint(raw, 'caja')) return { status: 'no_disponible' };

    const caja = raw.caja ?? {};
    const mes = raw.mes ?? {};
    const porCobrar = raw.por_cobrar ?? {};
    const serie = Array.isArray(raw.serie_mensual) ? raw.serie_mensual : [];
    const mejores = Array.isArray(raw.mejores_clientes) ? raw.mejores_clientes : [];

    return {
      status: 'ok',
      portada: {
        caja: {
          saldo: importe(caja.saldo),
          // La moneda es una etiqueta, no plata; si no vino, ARS es el default del producto (mercado AR).
          moneda: typeof caja.moneda === 'string' && caja.moneda.trim() !== '' ? caja.moneda.trim() : 'ARS',
        },
        mes: {
          ingresos: importe(mes.ingresos),
          gastos: importe(mes.gastos),
          rentabilidad: importe(mes.rentabilidad),
          facturado: importe(mes.facturado),
          cobrado: importe(mes.cobrado),
        },
        serieMensual: serie.map(puntoSerie).filter((p): p is PuntoSerie => p !== null),
        // `mejores_clientes` degrada a `[]` si Clientes no está (lo dice el contrato §3.1): la card
        // muestra vacío, no rompe.
        mejoresClientes: mejores.map(mejorCliente).filter((c): c is MejorCliente => c !== null),
        porCobrar: { total: importe(porCobrar.total), vencido: importe(porCobrar.vencido) },
      },
    };
  } catch {
    return { status: 'no_disponible' };
  }
}

// ---------------------------------------------------------------------------
// Chat de IN — preguntar sobre el negocio en lenguaje natural (§3.3).
// ---------------------------------------------------------------------------

/**
 * De dónde salió la respuesta del chat de IN — **VIVO desde PR #73**
 * (`listo_backend-a-todos_IN-chat-VIVO-cierra-la-cadencia-completa`, verificado contra el server real
 * con un tenant efímero). `no-se` es el guardarraíl del DoD §5: nunca inventa, y es también lo que
 * sale cuando el usuario pide una ACCIÓN ("borrá la última factura") — el texto de `respuesta` ya trae
 * la redirección al copiloto, `fuente` es sólo metadata, la cáscara no ramifica sobre ella.
 */
export type FuenteInteligencia = 'grafo' | 'sql' | 'no-se';

function fuenteInteligencia(v: unknown): FuenteInteligencia {
  return v === 'grafo' || v === 'sql' || v === 'no-se' ? v : 'no-se';
}

export interface RespuestaInteligencia {
  /** El texto de la respuesta. Puede venir vacío mientras el grafo no tenga con qué responder. */
  respuesta: string;
  fuente: FuenteInteligencia;
}

interface RespuestaInteligenciaRaw {
  respuesta?: unknown;
  fuente?: unknown;
}

/**
 * **`POST /inteligencia/chat` — preguntarle al copiloto sobre el negocio en lenguaje natural.**
 *
 * Forma congelada y VIVA desde PR #73: request `{texto}`, response `{respuesta, fuente}` — reemplaza
 * la forma `[PROVISIONAL]` anterior (`{pregunta}`→`{respuesta,fuentes[]}`) del `contrato_ADELANTAR`
 * §3.3, que nunca llegó a estar desplegada. El filtro de vigencia (invalidaciones del grafo) lo aplica
 * el SERVIDOR — la app nunca consulta el grafo directo, sólo esta capa (decisión de planificación que
 * supersede el §3 "del lado del cliente" del contrato original: server-side es mejor, un solo punto
 * de verdad).
 *
 * 🔴 **Un `POST` a una ruta no desplegada NO devuelve 200 con el SPA** (el catch-all del front-door es
 * `@app.get`): devuelve 405/501/503, que llegan como `ApiError` y degradan a `no_disponible`. Por eso
 * acá no hace falta la guarda de forma `esRespuestaDelEndpoint` que sí necesita el `GET` de la portada.
 */
export async function preguntarInteligencia(
  texto: string,
): Promise<ConDisponibilidad<{ respuesta: RespuestaInteligencia }>> {
  try {
    const raw = await apiClient.post<RespuestaInteligenciaRaw>('/inteligencia/chat', { texto });
    return {
      status: 'ok',
      respuesta: {
        // Texto: si no vino, cadena vacía (una respuesta sin texto es un caso real del grafo sin datos),
        // no `null` — la burbuja siempre muestra algo, aunque sea el vacío.
        respuesta: typeof raw?.respuesta === 'string' ? raw.respuesta : '',
        fuente: fuenteInteligencia(raw?.fuente),
      },
    };
  } catch (err) {
    // 405/501/503 = la ruta no está montada → «todavía no está disponible».
    if (err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503)) {
      return { status: 'no_disponible' };
    }
    // Un `POST` a una ruta inexistente que devolviera 200 con el HTML del SPA explota en `res.json()`
    // como un error que NO es `ApiError`: eso también es "no está montada", no un fallo del chat.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    // Un `ApiError` desplegado-pero-fallando (500, 4xx) NO se disfraza de ausencia: se propaga, para
    // que la cáscara lo trate como error real y no como «la función todavía no existe».
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Gráficos de IN — la misma capa de §0, con y sin `?detalle=<segmento>` (§6 del
// `dato_backend-a-todos_IN-capa-de-queries-forma-final...`, VIVO desde PR #69).
//
// 🔴 **Un solo parámetro, agregado o detalle — nunca un segundo camino.** Sin `detalle`, la respuesta
// es la serie agregada; con él, las filas de ESE segmento. Es la MISMA query del lado del servidor —
// acá se modela como una unión discriminada por `modo` para que el llamador nunca confunda una cosa
// con la otra por accidente de tipos.
// ---------------------------------------------------------------------------

/** Un mes de la serie de facturación. */
export interface PuntoFacturacion {
  mes: string;
  total: string | null;
  cantidad: number;
}

/** Una factura del detalle de un mes (`?detalle=<mes>`). */
export interface FilaFacturacionMes {
  id: number;
  numero: string;
  fecha: string;
  cliente: string;
  total: string | null;
}

export type ResultadoGraficoFacturacion =
  | { modo: 'serie'; tipo: 'barras'; periodo: string; serie: readonly PuntoFacturacion[] }
  | { modo: 'detalle'; mes: string; filas: readonly FilaFacturacionMes[] };

function puntoFacturacion(v: unknown): PuntoFacturacion | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { mes?: unknown; total?: unknown; cantidad?: unknown };
  if (typeof r.mes !== 'string' || r.mes.trim() === '') return null;
  return {
    mes: r.mes,
    total: importe(r.total),
    cantidad: typeof r.cantidad === 'number' && Number.isFinite(r.cantidad) ? r.cantidad : 0,
  };
}

function filaFacturacion(v: unknown): FilaFacturacionMes | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { id?: unknown; numero?: unknown; fecha?: unknown; cliente?: unknown; total?: unknown };
  // Sin `id` la fila no se puede abrir (no hay a dónde navegar): se descarta, no se pinta huérfana.
  if (typeof r.id !== 'number') return null;
  return {
    id: r.id,
    numero: typeof r.numero === 'string' ? r.numero : '',
    fecha: typeof r.fecha === 'string' ? r.fecha : '',
    cliente: typeof r.cliente === 'string' ? r.cliente : '',
    total: importe(r.total),
  };
}

/** `GET /inteligencia/graficos/facturacion` — gráfico 1: facturación por mes. */
export async function leerGraficoFacturacion(
  params: { detalle?: string } = {},
): Promise<ConDisponibilidad<ResultadoGraficoFacturacion>> {
  const query = new URLSearchParams();
  if (params.detalle != null && params.detalle !== '') query.set('detalle', params.detalle);
  const qs = query.toString();
  const path = qs ? `/inteligencia/graficos/facturacion?${qs}` : '/inteligencia/graficos/facturacion';

  try {
    const raw = await apiClient.get<Record<string, unknown>>(path);
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    // El detalle-de-segmento devuelve `{mes, filas}`; el agregado, `{tipo, periodo, serie}`. Se
    // distinguen por forma, no por si se pidió `detalle` — la misma guarda que `/actividad`.
    if ('filas' in raw) {
      const filas = Array.isArray((raw as { filas?: unknown }).filas) ? (raw as { filas: unknown[] }).filas : [];
      return {
        status: 'ok',
        modo: 'detalle',
        mes: typeof raw.mes === 'string' ? raw.mes : '',
        filas: filas.map(filaFacturacion).filter((f): f is FilaFacturacionMes => f !== null),
      };
    }
    if (!('serie' in raw)) return { status: 'no_disponible' };
    const serie = Array.isArray((raw as { serie?: unknown }).serie) ? (raw as { serie: unknown[] }).serie : [];
    return {
      status: 'ok',
      modo: 'serie',
      tipo: 'barras',
      periodo: typeof raw.periodo === 'string' ? raw.periodo : '',
      serie: serie.map(puntoFacturacion).filter((p): p is PuntoFacturacion => p !== null),
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503)) {
      return { status: 'no_disponible' };
    }
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/** Un mes de la serie entró-vs-salió (§1.bis de la portada: los tres orígenes de «Entró»). */
export interface PuntoEntroVsSalio {
  mes: string;
  entro: string | null;
  salio: string | null;
}

/** El origen de una fila de "entró" — el mismo distingo que ya expone Ingresos. */
export type OrigenEntroVsSalio = 'factura' | 'dictado' | 'mercadopago';

/** Una fila del detalle de "entró" en un mes (`?detalle=<mes>:entro`). */
export interface FilaEntro {
  id: number;
  fecha: string;
  monto: string | null;
  origen: OrigenEntroVsSalio | null;
  detalle: string;
}

/** Una fila del detalle de "salió" en un mes (`?detalle=<mes>:salio`) — un gasto. */
export interface FilaSalio {
  id: number;
  fecha: string;
  monto: string | null;
  categoria: string;
  detalle: string;
}

export type ResultadoGraficoEntroVsSalio =
  | { modo: 'serie'; tipo: 'barras_enfrentadas'; periodo: string; serie: readonly PuntoEntroVsSalio[] }
  | { modo: 'detalle_entro'; mes: string; filas: readonly FilaEntro[] }
  | { modo: 'detalle_salio'; mes: string; filas: readonly FilaSalio[] };

function puntoEntroVsSalio(v: unknown): PuntoEntroVsSalio | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { mes?: unknown; entro?: unknown; salio?: unknown };
  if (typeof r.mes !== 'string' || r.mes.trim() === '') return null;
  return { mes: r.mes, entro: importe(r.entro), salio: importe(r.salio) };
}

function origenEntro(v: unknown): OrigenEntroVsSalio | null {
  return v === 'factura' || v === 'dictado' || v === 'mercadopago' ? v : null;
}

function filaEntro(v: unknown): FilaEntro | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { id?: unknown; fecha?: unknown; monto?: unknown; origen?: unknown; detalle?: unknown };
  if (typeof r.id !== 'number') return null;
  return {
    id: r.id,
    fecha: typeof r.fecha === 'string' ? r.fecha : '',
    monto: importe(r.monto),
    origen: origenEntro(r.origen),
    detalle: typeof r.detalle === 'string' ? r.detalle : '',
  };
}

function filaSalio(v: unknown): FilaSalio | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { id?: unknown; fecha?: unknown; monto?: unknown; categoria?: unknown; detalle?: unknown };
  if (typeof r.id !== 'number') return null;
  return {
    id: r.id,
    fecha: typeof r.fecha === 'string' ? r.fecha : '',
    monto: importe(r.monto),
    categoria: typeof r.categoria === 'string' ? r.categoria : '',
    detalle: typeof r.detalle === 'string' ? r.detalle : '',
  };
}

/** `GET /inteligencia/graficos/entro-vs-salio` — gráfico 2: entró vs salió por mes. */
export async function leerGraficoEntroVsSalio(
  params: { detalle?: string } = {},
): Promise<ConDisponibilidad<ResultadoGraficoEntroVsSalio>> {
  const query = new URLSearchParams();
  if (params.detalle != null && params.detalle !== '') query.set('detalle', params.detalle);
  const qs = query.toString();
  const path = qs ? `/inteligencia/graficos/entro-vs-salio?${qs}` : '/inteligencia/graficos/entro-vs-salio';

  try {
    const raw = await apiClient.get<Record<string, unknown>>(path);
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    if ('filas' in raw) {
      const filas = Array.isArray((raw as { filas?: unknown }).filas) ? (raw as { filas: unknown[] }).filas : [];
      const mes = typeof raw.mes === 'string' ? raw.mes : '';
      // `?detalle=<mes>:entro` trae `origen`; `?detalle=<mes>:salio` trae `categoria`. Se distinguen
      // mirando la primera fila con esas claves — si viene vacío, se asume `entro` (el lado por
      // defecto no cambia nada visible con 0 filas).
      const esSalio = filas.length > 0 && typeof filas[0] === 'object' && filas[0] !== null && 'categoria' in filas[0];
      if (esSalio) {
        return { status: 'ok', modo: 'detalle_salio', mes, filas: filas.map(filaSalio).filter((f): f is FilaSalio => f !== null) };
      }
      return { status: 'ok', modo: 'detalle_entro', mes, filas: filas.map(filaEntro).filter((f): f is FilaEntro => f !== null) };
    }
    if (!('serie' in raw)) return { status: 'no_disponible' };
    const serie = Array.isArray((raw as { serie?: unknown }).serie) ? (raw as { serie: unknown[] }).serie : [];
    return {
      status: 'ok',
      modo: 'serie',
      tipo: 'barras_enfrentadas',
      periodo: typeof raw.periodo === 'string' ? raw.periodo : '',
      serie: serie.map(puntoEntroVsSalio).filter((p): p is PuntoEntroVsSalio => p !== null),
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503)) {
      return { status: 'no_disponible' };
    }
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/** Una categoría de gasto en la torta (las 8 de `CATEGORIAS_GASTO`, siempre string abierto). */
export interface PuntoCategoria {
  categoria: string;
  total: string | null;
}

/** Un gasto del detalle de una categoría (`?detalle=<categoria>`). */
export interface FilaCategoria {
  id: number;
  fecha: string;
  monto: string | null;
  detalle: string;
}

export type ResultadoGraficoCategorias =
  | { modo: 'serie'; tipo: 'torta'; periodo: string; serie: readonly PuntoCategoria[] }
  | { modo: 'detalle'; categoria: string; filas: readonly FilaCategoria[] };

function puntoCategoria(v: unknown): PuntoCategoria | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { categoria?: unknown; total?: unknown };
  if (typeof r.categoria !== 'string' || r.categoria.trim() === '') return null;
  return { categoria: r.categoria, total: importe(r.total) };
}

function filaCategoria(v: unknown): FilaCategoria | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { id?: unknown; fecha?: unknown; monto?: unknown; detalle?: unknown };
  if (typeof r.id !== 'number') return null;
  return {
    id: r.id,
    fecha: typeof r.fecha === 'string' ? r.fecha : '',
    monto: importe(r.monto),
    detalle: typeof r.detalle === 'string' ? r.detalle : '',
  };
}

/** `GET /inteligencia/graficos/categorias` — gráfico 3: en qué se me va. `?mes=` cambia el período. */
export async function leerGraficoCategorias(
  params: { mes?: string; detalle?: string } = {},
): Promise<ConDisponibilidad<ResultadoGraficoCategorias>> {
  const query = new URLSearchParams();
  if (params.mes != null && params.mes !== '') query.set('mes', params.mes);
  if (params.detalle != null && params.detalle !== '') query.set('detalle', params.detalle);
  const qs = query.toString();
  const path = qs ? `/inteligencia/graficos/categorias?${qs}` : '/inteligencia/graficos/categorias';

  try {
    const raw = await apiClient.get<Record<string, unknown>>(path);
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    if ('filas' in raw) {
      const filas = Array.isArray((raw as { filas?: unknown }).filas) ? (raw as { filas: unknown[] }).filas : [];
      return {
        status: 'ok',
        modo: 'detalle',
        categoria: typeof raw.categoria === 'string' ? raw.categoria : '',
        filas: filas.map(filaCategoria).filter((f): f is FilaCategoria => f !== null),
      };
    }
    if (!('serie' in raw)) return { status: 'no_disponible' };
    const serie = Array.isArray((raw as { serie?: unknown }).serie) ? (raw as { serie: unknown[] }).serie : [];
    return {
      status: 'ok',
      modo: 'serie',
      tipo: 'torta',
      periodo: typeof raw.periodo === 'string' ? raw.periodo : '',
      serie: serie.map(puntoCategoria).filter((p): p is PuntoCategoria => p !== null),
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503)) {
      return { status: 'no_disponible' };
    }
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Gráfico 4 — cuánto me dejó cada trabajo. VIVO desde PR #70
// (`listo_backend-a-todos_IN-grafico4-margen-trabajo-VIVO`).
// ---------------------------------------------------------------------------

/** `presupuesto | comprobante | cobro` — el eslabón de la cadena por el que se referencia el trabajo. */
export type EslabonTrabajo = 'presupuesto' | 'comprobante' | 'cobro';

function eslabon(v: unknown): EslabonTrabajo | null {
  return v === 'presupuesto' || v === 'comprobante' || v === 'cobro' ? v : null;
}

/** Un trabajo CON ingreso registrado — entra al promedio del gráfico. */
export interface TrabajoConMargen {
  eslabon: EslabonTrabajo;
  ref: number;
  etiqueta: string;
  cobrado: string | null;
  gastado: string | null;
  margen: string | null;
  gastosImputados: number;
}

/**
 * Un trabajo SIN ingreso registrado (`cobrado == 0`) — **dato incompleto, no una pérdida** (contrato
 * §2/addendum §4). Nunca se promedia con `TrabajoConMargen`: por eso ni siquiera tiene el campo
 * `margen` en el tipo — mezclarlos por accidente de TypeScript queda imposible, no sólo prohibido por
 * convención.
 */
export interface TrabajoSinIngreso {
  eslabon: EslabonTrabajo;
  ref: number;
  etiqueta: string;
  gastado: string | null;
  gastosImputados: number;
}

/**
 * El detalle de un trabajo (`?detalle=<eslabon>:<ref>`) — **el mismo objeto** que
 * `GET /trabajos/{eslabon}/{ref}/margen` (§0, sin segundo camino; forma confirmada en
 * `avance_backend-a-todos_addendum-imputacion-VIVO-y-la-caja-que-mentia` §0).
 *
 * 🔴 **`trabajo` queda sin tipar en detalle — [PROVISIONAL].** El wire trae `{presupuesto, comprobante,
 * cobros}` pero esta capa nunca vio su forma interna (ningún cliente la consumió todavía). Se pasa tal
 * cual para no inventar una estructura no verificada; el día que una pantalla necesite navegar dentro
 * de `trabajo`, se tipa recién ahí, contra el wire real.
 */
export interface DetalleMargenTrabajo {
  trabajo: unknown;
  cobrado: string | null;
  gastado: string | null;
  margen: string | null;
  gastosImputados: number;
}

export type ResultadoGraficoMargenTrabajo =
  | { modo: 'lista'; tipo: 'barras'; trabajos: readonly TrabajoConMargen[]; sinIngreso: readonly TrabajoSinIngreso[] }
  | ({ modo: 'detalle' } & DetalleMargenTrabajo);

function trabajoConMargen(v: unknown): TrabajoConMargen | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  const esl = eslabon(r.eslabon);
  // Sin eslabón+ref no hay a dónde navegar (mismo criterio que el resto de las filas de detalle).
  if (esl === null || typeof r.ref !== 'number') return null;
  return {
    eslabon: esl,
    ref: r.ref,
    etiqueta: typeof r.etiqueta === 'string' ? r.etiqueta : '',
    cobrado: importe(r.cobrado),
    gastado: importe(r.gastado),
    margen: importe(r.margen),
    gastosImputados: typeof r.gastos_imputados === 'number' ? r.gastos_imputados : 0,
  };
}

function trabajoSinIngreso(v: unknown): TrabajoSinIngreso | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as Record<string, unknown>;
  const esl = eslabon(r.eslabon);
  if (esl === null || typeof r.ref !== 'number') return null;
  return {
    eslabon: esl,
    ref: r.ref,
    etiqueta: typeof r.etiqueta === 'string' ? r.etiqueta : '',
    gastado: importe(r.gastado),
    gastosImputados: typeof r.gastos_imputados === 'number' ? r.gastos_imputados : 0,
  };
}

/**
 * `GET /inteligencia/graficos/margen-trabajo` — gráfico 4: cuánto me dejó cada trabajo.
 *
 * 🔴 **Sin filtro de período** (contrato §2 ítem 4: un trabajo puede abarcar cualquier fecha) — a
 * diferencia de los otros tres gráficos, esta función no acepta `mes`.
 */
export async function leerGraficoMargenTrabajo(
  params: { detalle?: string } = {},
): Promise<ConDisponibilidad<ResultadoGraficoMargenTrabajo>> {
  const query = new URLSearchParams();
  if (params.detalle != null && params.detalle !== '') query.set('detalle', params.detalle);
  const qs = query.toString();
  const path = qs ? `/inteligencia/graficos/margen-trabajo?${qs}` : '/inteligencia/graficos/margen-trabajo';

  try {
    const raw = await apiClient.get<Record<string, unknown>>(path);
    if (typeof raw !== 'object' || raw === null) return { status: 'no_disponible' };
    // El detalle de un trabajo puntual no trae `trabajos`/`sin_ingreso` — los trae la lista.
    if (!('trabajos' in raw) && !('sin_ingreso' in raw)) {
      if (!('cobrado' in raw)) return { status: 'no_disponible' };
      return {
        status: 'ok',
        modo: 'detalle',
        trabajo: (raw as { trabajo?: unknown }).trabajo,
        cobrado: importe(raw.cobrado),
        gastado: importe(raw.gastado),
        margen: importe(raw.margen),
        gastosImputados: typeof raw.gastos_imputados === 'number' ? raw.gastos_imputados : 0,
      };
    }
    const trabajos = Array.isArray((raw as { trabajos?: unknown }).trabajos) ? (raw as { trabajos: unknown[] }).trabajos : [];
    const sinIngreso = Array.isArray((raw as { sin_ingreso?: unknown }).sin_ingreso)
      ? (raw as { sin_ingreso: unknown[] }).sin_ingreso
      : [];
    return {
      status: 'ok',
      modo: 'lista',
      tipo: 'barras',
      trabajos: trabajos.map(trabajoConMargen).filter((t): t is TrabajoConMargen => t !== null),
      sinIngreso: sinIngreso.map(trabajoSinIngreso).filter((t): t is TrabajoSinIngreso => t !== null),
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 405 || err.status === 501 || err.status === 503)) {
      return { status: 'no_disponible' };
    }
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}
