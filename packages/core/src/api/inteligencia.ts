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
 * Una fuente que respalda la respuesta del chat de IN (una factura, un gasto, un episodio del grafo).
 *
 * 🔴 **[PROVISIONAL — grafo].** La forma sale del §3.3 del `contrato_ADELANTAR`, marcado provisional
 * PORQUE depende del grafo (hito 5, en curso): `tipo`/`ref` pueden cambiar cuando el grafo defina qué
 * es una fuente. La cáscara del chat NO ramifica sobre estos campos todavía — los muestra tal cual.
 */
export interface FuenteInteligencia {
  tipo: string;
  ref: string;
}

export interface RespuestaInteligencia {
  /** El texto de la respuesta. Puede venir vacío mientras el grafo no tenga con qué responder. */
  respuesta: string;
  fuentes: readonly FuenteInteligencia[];
}

interface RespuestaInteligenciaRaw {
  respuesta?: unknown;
  fuentes?: unknown;
}

function fuente(v: unknown): FuenteInteligencia | null {
  if (typeof v !== 'object' || v === null) return null;
  const r = v as { tipo?: unknown; ref?: unknown };
  // Una fuente sin `ref` no direcciona a nada: se descarta en vez de pintar un chip que no lleva a
  // ningún lado. `tipo` puede faltar (default vacío) — es una etiqueta, no la identidad de la fuente.
  if (typeof r.ref !== 'string' || r.ref.trim() === '') return null;
  return { tipo: typeof r.tipo === 'string' ? r.tipo.trim() : '', ref: r.ref.trim() };
}

/**
 * **`POST /inteligencia/chat` — preguntarle al copiloto sobre el negocio en lenguaje natural.**
 *
 * 🔴 **[PROVISIONAL — grafo] — el ÚNICO punto que el connect toca.** Toda la cáscara del chat de IN
 * habla con esta función. La forma (request `{pregunta}`, response `{respuesta, fuentes}`) sale del
 * §3.3 del `contrato_ADELANTAR`, declarada **provisional** porque depende del grafo (hito 5). El día
 * que el grafo fije la forma real, se recablea acá y la pantalla no se toca.
 *
 * 🔴 **Un `POST` a una ruta no desplegada NO devuelve 200 con el SPA** (el catch-all del front-door es
 * `@app.get`): devuelve 405/501/503, que llegan como `ApiError` y degradan a `no_disponible`. Por eso
 * acá no hace falta la guarda de forma `esRespuestaDelEndpoint` que sí necesita el `GET` de la portada.
 */
export async function preguntarInteligencia(
  pregunta: string,
): Promise<ConDisponibilidad<{ respuesta: RespuestaInteligencia }>> {
  try {
    const raw = await apiClient.post<RespuestaInteligenciaRaw>('/inteligencia/chat', { pregunta });
    const fuentes = Array.isArray(raw?.fuentes) ? raw.fuentes : [];
    return {
      status: 'ok',
      respuesta: {
        // Texto: si no vino, cadena vacía (una respuesta sin texto es un caso real del grafo sin datos),
        // no `null` — la burbuja siempre muestra algo, aunque sea el vacío.
        respuesta: typeof raw?.respuesta === 'string' ? raw.respuesta : '',
        fuentes: fuentes.map(fuente).filter((f): f is FuenteInteligencia => f !== null),
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
