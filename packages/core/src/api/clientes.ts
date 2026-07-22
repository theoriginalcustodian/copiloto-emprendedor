import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * `/clientes` — la cartera. **Se DERIVA de lo que ya se emitió**, no es una agenda que arranca vacía.
 *
 * Contrato: `coordinacion/abierto/2026-07-21_contrato_planificacion-a-todos_clientes.md`, con las
 * cuatro correcciones del `hallazgo_frontend-...-clientes-ya-hay-un-cliente-muerto-...`. La forma está
 * **medida contra el servicio vivo por HTTP público** el 2026-07-22, no leída del contrato.
 *
 * ⚠️ **Este archivo es NUEVO. El anterior se borró** (`8761d54`): llamaba a `/clientes/opciones` y a un
 * `ClienteDetalle` con `genero`/`dni_parcial` — un cliente HTTP de la app clínica, apuntando a un
 * backend que en este repo **nunca existió**. Si alguien encuentra ese código en la historia, no es
 * una versión anterior de esto: es otra cosa con el mismo nombre.
 *
 * 🔴 **`doc_tipo` de un cliente NUNCA vale 99.** El 99 es "consumidor final" de AFIP, y el sistema
 * emite a consumidor final sin nombre ni documento. Si esas ventas generaran cliente, la
 * deduplicación por documento las colapsaría **todas** en un registro fantasma con el grueso de la
 * facturación adentro — que además encabezaría el ranking de mejores clientes. Una venta a consumidor
 * final es una venta sin cliente, que es exactamente lo que es.
 *
 * 🔴 **La ficha devuelve SECCIONES, no un objeto plano.** `{cliente, presupuestos, facturas}`, y las
 * dos listas llegan **vacías y declaradas** hasta el hito 3 — que es distinto de no estar. Sumar
 * "sus gastos" después no rompe a ningún consumidor.
 */

/** De dónde salió el cliente. `derivado` = lo armó el backfill de lo ya facturado. */
export type OrigenCliente = 'derivado' | 'manual' | 'voz';

export interface Cliente {
  id: number;
  /** Lo único que no puede faltar. */
  nombre: string;
  /** 80=CUIT · 96=DNI · `null` si no se sabe. **Nunca 99** — ver el docstring del módulo. */
  docTipo: number | null;
  /** Sin puntos ni guiones. `null` si no se sabe. */
  docNro: string | null;
  /** Código de AFIP, o `null`. Los mismos que usa el WSFE — no hay catálogo paralelo. */
  condicionIva: number | null;
  domicilio: string | null;
  /** Teléfono o mail, texto libre. */
  contacto: string | null;
  notas: string | null;
  origen: OrigenCliente;
  /**
   * ⚠️ **`creado_en`, no `creado_at`.** El contrato decía `creado_at` y se corrigió antes de que
   * existiera el código: `creado_en` es el único deletreo de "timestamp de creación" en toda la API
   * (gastos), y dos deletreos del mismo concepto es cómo el normalizador lee la clave que no vino,
   * cae al default, y el dato desaparece **sin error**.
   */
  creadoEn: string;
}

interface ClienteCrudo {
  id: number;
  nombre?: string;
  doc_tipo?: number | null;
  doc_nro?: string | null;
  condicion_iva?: number | null;
  domicilio?: string | null;
  contacto?: string | null;
  notas?: string | null;
  origen?: string;
  creado_en?: string;
}

function normalizar(c: ClienteCrudo): Cliente {
  const origen = c.origen;
  return {
    id: c.id,
    nombre: c.nombre ?? '',
    docTipo: c.doc_tipo ?? null,
    docNro: c.doc_nro ?? null,
    condicionIva: c.condicion_iva ?? null,
    domicilio: c.domicilio ?? null,
    contacto: c.contacto ?? null,
    notas: c.notas ?? null,
    origen: origen === 'manual' || origen === 'voz' ? origen : 'derivado',
    creadoEn: c.creado_en ?? '',
  };
}

/**
 * "Esta capacidad no está en este deploy" — **el 404 NO entra acá**: en `/clientes/{cliente}` es
 * semántico ("no existe para este tenant", que incluye el id ajeno; el backend no confirma recursos
 * de otros y tiene test adversarial de eso).
 */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501);
}

/**
 * 🔴 **Un `GET` a una ruta no desplegada devuelve `200` con el HTML del SPA**, no 404 ni 405 — el
 * front-door monta un catch-all `@app.get("/{full_path}")`. Medido otra vez el 2026-07-22 sobre
 * `/clientes-que-no-existe-jamas`: `200 <!doctype html>`. Por eso los GET se validan por **forma**.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

export interface ListarClientesParams {
  /** Búsqueda por nombre. El backend ignora tildes y mayúsculas — no normalizar acá. */
  q?: string;
  limit?: number;
}

/**
 * La cartera. Tenant sin clientes → `{status:'ok', clientes: [], total: 0}` — **`[]` no es un error**.
 *
 * `total` es el conteo del tenant, no el largo de la página.
 */
export async function listarClientes(
  params: ListarClientesParams = {},
): Promise<ConDisponibilidad<{ clientes: Cliente[]; total: number }>> {
  const query = new URLSearchParams();
  if (params.q !== undefined && params.q !== '') query.set('q', params.q);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  const qs = query.toString();
  try {
    const raw = await apiClient.get<{ clientes: ClienteCrudo[]; total: number }>(
      qs ? `/clientes?${qs}` : '/clientes',
    );
    if (!esRespuestaDelEndpoint(raw, 'clientes')) return { status: 'no_disponible' };
    const clientes = (raw.clientes ?? []).map(normalizar);
    return { status: 'ok', clientes, total: raw.total ?? clientes.length };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // Un 200 con HTML explota en `res.json()`, no en `mapearError`.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/** Una operación del historial del cliente. Llega vacío hasta el hito 3 del backend. */
export interface OperacionCliente {
  id: number;
  fecha: string;
  /** String decimal — **nunca `Number()`**. Es plata. */
  total: string;
  /** Título corto de la operación (el concepto del presupuesto, el número de la factura). */
  detalle: string;
}

export interface FichaCliente {
  cliente: Cliente;
  presupuestos: OperacionCliente[];
  facturas: OperacionCliente[];
}

interface OperacionCruda {
  id?: number;
  fecha?: string;
  total?: string;
  detalle?: string;
  concepto?: string;
  numero?: number;
}

function normalizarOperacion(o: OperacionCruda, indice: number): OperacionCliente {
  return {
    id: o.id ?? indice,
    fecha: o.fecha ?? '',
    total: o.total ?? '0.00',
    // El backend todavía no fijó el nombre del título (las listas llegan vacías hasta el hito 3), así
    // que se aceptan los dos candidatos del resto de la API. Si manda otro, la ficha muestra el
    // número en vez de un renglón en blanco — visiblemente pobre, no invisiblemente vacío.
    detalle: o.detalle ?? o.concepto ?? (o.numero != null ? `N° ${o.numero}` : ''),
  };
}

/**
 * La ficha: datos + qué compró. `no_encontrado` cubre el 404 semántico.
 *
 * ⚠️ **`presupuestos` y `facturas` llegan `[]` hasta el hito 3 del backend, y eso NO es un error ni
 * un "todavía no disponible"**: son secciones declaradas y vacías. Pintarlas como error haría que la
 * ficha parezca rota durante todo el tiempo que dure el hito.
 */
export async function obtenerCliente(
  id: number,
): Promise<ConDisponibilidad<{ ficha: FichaCliente }> | { status: 'no_encontrado' }> {
  try {
    const raw = await apiClient.get<{
      cliente: ClienteCrudo;
      presupuestos?: OperacionCruda[] | null;
      facturas?: OperacionCruda[] | null;
    }>(`/clientes/${id}`);
    if (!esRespuestaDelEndpoint(raw, 'cliente')) return { status: 'no_disponible' };
    return {
      status: 'ok',
      ficha: {
        cliente: normalizar(raw.cliente),
        presupuestos: (raw.presupuestos ?? []).map(normalizarOperacion),
        facturas: (raw.facturas ?? []).map(normalizarOperacion),
      },
    };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}
