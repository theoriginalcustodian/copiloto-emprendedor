import { apiClient } from './client';
import { ApiError } from './errors';
import type { ConDisponibilidad } from './afip';

/**
 * `/presupuestos` — los presupuestos del emprendedor: alta, listado, detalle y el atajo a facturar.
 *
 * Contrato: `coordinacion/abierto/2026-07-21_contrato_backend-perfil-negocio-y-presupuestos.md` §2,
 * **con las correcciones del `addendum_backend-control-corregido-y-los-huecos-cerrados.md`**, que
 * cambió tres cosas del contrato original y hay que leerlas juntas:
 *   1. el `id` es un **entero**, no un uuid (la convención de `provision_tables.py` es `bigserial`),
 *   2. el objeto trae `reemplazado_por`, que el contrato no tenía,
 *   3. el listado devuelve **sólo los vigentes** salvo que se pida lo contrario.
 *
 * 🔴 **Los montos son STRINGS y no se convierten a número en ninguna parte de este archivo.** Son
 * plata: el `float` de JavaScript pierde precisión (`0.1 + 0.2 !== 0.3`), y un redondeo de un centavo
 * en un presupuesto que después se factura es un problema fiscal, no un detalle de formato. Se
 * transportan y se muestran como string. El backend garantiza **siempre 2 decimales** (`"45000.00"`,
 * nunca `"45000"` ni `"45000.0"`), así que formatear no requiere normalizar antes.
 *
 * 🔴 **El `total` lo calcula el BACKEND** (`Σ cantidad × precio_unitario`). No se manda al crear; si
 * se mandara, se ignora. Una sola fuente para la aritmética del dinero.
 *
 * 🔴 **`cliente_id` sale del JWT.** Nada de acá lo acepta ni lo manda. Pedir `/presupuestos/13`
 * cuando 13 es de otro tenant devuelve 404 — el backend no confirma la existencia de recursos ajenos,
 * y tiene test adversarial de eso.
 */

/** El receptor del presupuesto — a quién se le presupuesta. */
export interface ReceptorPresupuesto {
  nombre: string;
  /** 96=DNI · 80=CUIT · 99=sin identificar. */
  docTipo: number | null;
  docNro: string;
  /** 5 = consumidor final. */
  condicionIva: number | null;
  domicilio: string;
  /** Mail o teléfono — por dónde mandárselo. */
  contacto: string;
}

/** Un ítem del presupuesto. `cantidad` y `precioUnitario` son STRINGS decimales (ver el docstring). */
export interface ItemPresupuesto {
  orden: number;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  codigo: string;
}

export interface Presupuesto {
  /** 🔴 **Entero**, no uuid — corregido por el addendum del 2026-07-21. */
  id: number;
  /** Correlativo POR TENANT, lo asigna el backend. Un reemplazo **consume número nuevo**. */
  numero: number;
  /** ISO-8601 UTC. */
  fecha: string;
  /** Título corto — es lo que se lee en la card. */
  concepto: string;
  receptor: ReceptorPresupuesto;
  /**
   * 🔴 **Sólo viene en el DETALLE.** El listado lo omite a propósito (respuestas más chicas): ahí
   * llega `[]` y lo que hay que mostrar es `cantidadItems`, que sí viene siempre. Confundirlos haría
   * que toda card diga "0 ítems".
   */
  items: ItemPresupuesto[];
  /** SIEMPRE presente — en listado y en detalle. Es lo que va en la card. */
  cantidadItems: number;
  /** String decimal con 2 decimales. Ver el docstring del módulo. */
  total: string;
  moneda: string;
  /**
   * El Doc de Google generado, o `null`.
   *
   * 🔴 **`null` NO es un error.** El presupuesto se crea igual aunque el emprendedor no tenga
   * `googledocs` conectado o Google falle — misma decisión que el archivado en Drive de las facturas.
   * Y el link **puede morir después**: el Doc vive en el Drive del usuario, que lo puede borrar,
   * mover o renombrar. La card no depende del Doc; el Doc es una proyección, no la fuente.
   */
  docLink: string | null;
  docId: string | null;
  sheetFila: string | null;
  /** Id del presupuesto al que este reemplaza, o `null`. Sirve para decir "reemplaza al N° 7". */
  reemplazaA: number | null;
  /**
   * Id del presupuesto que reemplazó a este, o `null`.
   *
   * 🔴 **Es la mitad que faltaba, y la pidió esta sesión.** Con sólo `reemplazaA` —que apunta hacia
   * atrás— saber si a ESTE lo reemplazaron exigía escanear la lista entera buscando quién lo
   * referencia, y con paginación el que lo reemplaza puede no estar en la página pedida: una
   * respuesta que a veces acierta. El backend lo resuelve en SQL (`NOT EXISTS`), así que es correcto
   * sin importar la paginación.
   */
  reemplazadoPor: number | null;
  /** Id del **borrador** de factura, si alguien tocó Facturar. Ver `facturado`. */
  facturaId: string | null;
  /**
   * 🔴 **Este es el campo del badge, y NO es `facturaId != null`.** Son distintos a propósito: un
   * borrador que el usuario canceló deja `facturaId` puesto y `facturado: false`. Derivar el badge de
   * `facturaId` marcaría como facturados presupuestos cuya factura nunca se emitió.
   *
   * → badge: `facturado`. Link a la factura: `facturaId`.
   */
  facturado: boolean;
}

interface ReceptorCrudo {
  nombre?: string;
  doc_tipo?: number | null;
  doc_nro?: string | null;
  condicion_iva?: number | null;
  domicilio?: string | null;
  contacto?: string | null;
}

interface ItemCrudo {
  orden?: number;
  descripcion?: string;
  cantidad?: string;
  precio_unitario?: string;
  codigo?: string | null;
}

interface PresupuestoCrudo {
  id: number;
  numero?: number;
  fecha?: string;
  concepto?: string;
  receptor?: ReceptorCrudo | null;
  items?: ItemCrudo[] | null;
  cantidad_items?: number;
  total?: string;
  moneda?: string;
  doc_link?: string | null;
  doc_id?: string | null;
  sheet_fila?: string | null;
  reemplaza_a?: number | null;
  reemplazado_por?: number | null;
  factura_id?: string | null;
  facturado?: boolean;
}

function normalizarReceptor(r: ReceptorCrudo | null | undefined): ReceptorPresupuesto {
  return {
    nombre: r?.nombre ?? '',
    docTipo: r?.doc_tipo ?? null,
    docNro: r?.doc_nro ?? '',
    condicionIva: r?.condicion_iva ?? null,
    domicilio: r?.domicilio ?? '',
    contacto: r?.contacto ?? '',
  };
}

function normalizarItem(i: ItemCrudo, indice: number): ItemPresupuesto {
  return {
    orden: i.orden ?? indice,
    descripcion: i.descripcion ?? '',
    // `?? '0.00'` y no `?? ''`: un ítem sin cantidad es un dato roto, pero mostrar vacío donde va
    // plata se lee como "gratis". Un cero es visiblemente inconsistente con el total y se reporta.
    cantidad: i.cantidad ?? '0',
    precioUnitario: i.precio_unitario ?? '0.00',
    codigo: i.codigo ?? '',
  };
}

function normalizar(p: PresupuestoCrudo): Presupuesto {
  const items = (p.items ?? []).map(normalizarItem);
  return {
    id: p.id,
    numero: p.numero ?? 0,
    fecha: p.fecha ?? '',
    concepto: p.concepto ?? '',
    receptor: normalizarReceptor(p.receptor),
    items,
    // 🔴 `?? items.length` y NO `items.length` a secas: en el listado `items` viene vacío a
    // propósito, así que invertir la precedencia haría que toda card dijera "0 ítems".
    cantidadItems: p.cantidad_items ?? items.length,
    total: p.total ?? '0.00',
    moneda: p.moneda ?? 'ARS',
    docLink: p.doc_link ?? null,
    docId: p.doc_id ?? null,
    sheetFila: p.sheet_fila ?? null,
    reemplazaA: p.reemplaza_a ?? null,
    reemplazadoPor: p.reemplazado_por ?? null,
    facturaId: p.factura_id ?? null,
    facturado: p.facturado === true,
  };
}

/**
 * "Esta capacidad no está en este deploy" — **el 404 NO entra acá**.
 *
 * El backend declaró los códigos endpoint por endpoint: en `/presupuestos/{id}` el 404 es semántico
 * ("no existe para este tenant", que incluye el caso de un id ajeno). Tratarlo como "no desplegado"
 * le diría al usuario "todavía no está disponible" sobre un endpoint vivo contestando bien.
 *
 * El `405` sí: el front-door monta un catch-all `@app.get("/{full_path}")` para servir el SPA
 * (`apps/copiloto/web.py:141`), y una ruta no desplegada matchea ese handler → FastAPI contesta 405 a
 * todo verbo que no sea GET. **Para GET no hay 405** — de eso se ocupa `esRespuestaDelEndpoint`.
 */
function noDesplegado(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 405 || err.status === 501);
}

/**
 * 🔴 **Un `GET` a una ruta no desplegada devuelve `200` con `<!doctype html>`, no 404 ni 405.**
 *
 * Medido contra el servicio vivo el 2026-07-21 sobre las tres rutas de este contrato. El status por
 * sí solo diría "desplegado y todo bien" sobre una ruta que no existe — el instrumento que confirma
 * en vez de verificar. Por eso la respuesta se valida por su **forma**: si el 200 no trae la clave
 * que el contrato promete, no fue este endpoint el que contestó.
 *
 * (El propio backend cayó en esta trampa: propuso un control por GET tres párrafos después de
 * escribir la advertencia de que los GET no discriminan. Lo reconoció y adoptó el control por POST.)
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

export interface ListarPresupuestosParams {
  /** Default 50, máximo 200 del lado del backend. Sin cursor por ahora. */
  limit?: number;
  /**
   * `true` trae también los que ya fueron reemplazados — el historial.
   *
   * Por default el backend devuelve **sólo los vigentes**, y eso resuelve el caso común: corregir un
   * presupuesto tres veces dejaría cuatro cards del mismo trabajo sin forma de saber cuál vale.
   */
  incluirReemplazados?: boolean;
}

/**
 * El listado para las cards. **Sin `items`** — usar `cantidadItems`.
 *
 * Tenant sin presupuestos → `{ status: 'ok', presupuestos: [] }`. **Nunca 404, y `[]` no es un
 * error**: es el estado normal del primer día.
 */
export async function listarPresupuestos(
  params: ListarPresupuestosParams = {},
): Promise<ConDisponibilidad<{ presupuestos: Presupuesto[] }>> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.incluirReemplazados === true) query.set('incluir_reemplazados', 'true');
  const qs = query.toString();
  try {
    const raw = await apiClient.get<{ presupuestos: PresupuestoCrudo[] }>(
      qs ? `/presupuestos?${qs}` : '/presupuestos',
    );
    if (!esRespuestaDelEndpoint(raw, 'presupuestos')) return { status: 'no_disponible' };
    return { status: 'ok', presupuestos: (raw.presupuestos ?? []).map(normalizar) };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    // Un 200 con HTML (el catch-all sirviendo el SPA) explota en `res.json()`, no en `mapearError`:
    // llega acá como error de parseo, no como `ApiError`.
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * El detalle, **con `items`** — lo que se muestra en el glass.
 *
 * `{ status: 'no_encontrado' }` cubre el 404: no existe, **o es de otro tenant**. El backend no
 * distingue los dos casos a propósito (no confirma recursos ajenos), y esta capa tampoco inventa la
 * diferencia.
 */
export async function obtenerPresupuesto(
  id: number,
): Promise<ConDisponibilidad<{ presupuesto: Presupuesto }> | { status: 'no_encontrado' }> {
  try {
    const raw = await apiClient.get<{ presupuesto: PresupuestoCrudo }>(`/presupuestos/${id}`);
    if (!esRespuestaDelEndpoint(raw, 'presupuesto')) return { status: 'no_disponible' };
    return { status: 'ok', presupuesto: normalizar(raw.presupuesto) };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    throw err;
  }
}

/** Un ítem a presupuestar. `cantidad` y `precioUnitario` van como STRING — ver el docstring. */
export interface NuevoItemPresupuesto {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  codigo?: string;
}

export interface CrearPresupuestoRequest {
  /** Requerido, ≤120. */
  concepto: string;
  receptor: {
    /** Requerido. */
    nombre: string;
    docTipo?: number;
    docNro?: string;
    /** Default 5 (consumidor final) del lado del backend. */
    condicionIva?: number;
    domicilio?: string;
    contacto?: string;
  };
  /** Requerido, ≥1. */
  items: NuevoItemPresupuesto[];
  /** Default `'ARS'`. */
  moneda?: string;
  /**
   * Id del presupuesto que este reemplaza.
   *
   * 🔴 **Editar = crear de nuevo con esto puesto.** No hay `PUT` ni `PATCH`: es append, no mutación.
   * El reemplazo **consume correlativo nuevo** (el N° 7 corregido genera el N° 8), porque un
   * presupuesto ya enviado existe afuera del sistema y dos documentos distintos con el mismo número
   * circulando serían indistinguibles para el emprendedor.
   */
  reemplazaA?: number;
}

function aBodyCrudo(req: CrearPresupuestoRequest): Record<string, unknown> {
  const receptor: Record<string, unknown> = { nombre: req.receptor.nombre };
  if (req.receptor.docTipo !== undefined) receptor.doc_tipo = req.receptor.docTipo;
  if (req.receptor.docNro !== undefined) receptor.doc_nro = req.receptor.docNro;
  if (req.receptor.condicionIva !== undefined) receptor.condicion_iva = req.receptor.condicionIva;
  if (req.receptor.domicilio !== undefined) receptor.domicilio = req.receptor.domicilio;
  if (req.receptor.contacto !== undefined) receptor.contacto = req.receptor.contacto;

  const body: Record<string, unknown> = {
    concepto: req.concepto,
    receptor,
    // El `total` NO va: lo calcula el backend. Ver el docstring del módulo.
    items: req.items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
      ...(i.codigo !== undefined ? { codigo: i.codigo } : {}),
    })),
  };
  if (req.moneda !== undefined) body.moneda = req.moneda;
  if (req.reemplazaA !== undefined) body.reemplaza_a = req.reemplazaA;
  return body;
}

/**
 * Crea el presupuesto. 201 con el objeto completo (con `items`).
 *
 * ⚠️ **`docLink` puede volver `null` y eso NO es un fallo de la creación.** Si el emprendedor no
 * tiene `googledocs` conectado —o Google falla— el presupuesto se crea igual, sin Doc. Quien llame a
 * esto no puede tratar `docLink === null` como error.
 *
 * Lanza `ApiError` 400 (body inválido: ítems vacíos, número no numérico) o 422 (falta un requerido).
 */
export async function crearPresupuesto(
  req: CrearPresupuestoRequest,
): Promise<ConDisponibilidad<{ presupuesto: Presupuesto }>> {
  try {
    const raw = await apiClient.post<{ presupuesto: PresupuestoCrudo }>('/presupuestos', aBodyCrudo(req));
    if (!esRespuestaDelEndpoint(raw, 'presupuesto')) return { status: 'no_disponible' };
    return { status: 'ok', presupuesto: normalizar(raw.presupuesto) };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * Resultado de tocar "Facturar".
 *
 * 🔴 **`ok` NO significa "se emitió la factura".** Significa que hay un **borrador** armado con el
 * receptor y los ítems. Emitir es un acto fiscal y **el gate de confirmación no se saltea**: quien
 * llame tiene que llevar al usuario a la pantalla de confirmación que YA existe, con este
 * `facturaId` (`GET /afip/facturas/{id}` → `POST /afip/facturas/{id}/confirmar`). No hay pantalla
 * nueva de facturación que construir.
 */
export type ResultadoFacturar =
  | { status: 'ok'; facturaId: string }
  /** El presupuesto no existe para este tenant. */
  | { status: 'no_encontrado' }
  /** Ya fue facturado. Trae el `facturaId` de aquella vez, para poder ir a verla. */
  | { status: 'ya_facturado'; facturaId: string | null }
  /** El tenant todavía no cargó su perfil fiscal (CUIT) — hay que mandarlo a Ajustes → Facturación. */
  | { status: 'falta_perfil_fiscal' }
  | { status: 'no_disponible' };

/**
 * Los dos 409 de este endpoint se distinguen por **la presencia de `factura_id` en el body**, no por
 * el texto del `detail`.
 *
 * 🔴 Atarse a la redacción (`"el presupuesto ya fue facturado"`) sería depender de un string que el
 * backend puede reescribir sin que eso sea un cambio de contrato — y el día que lo haga, "ya
 * facturado" pasaría a mostrarse como "falta tu perfil fiscal", mandando al usuario a cargar un dato
 * que ya tiene. La presencia de un campo es estructura; el texto es copy.
 */
function facturaIdDelBody(body: unknown): string | null | undefined {
  if (typeof body !== 'object' || body === null || !('factura_id' in body)) return undefined;
  const valor = (body as { factura_id?: unknown }).factura_id;
  return typeof valor === 'string' ? valor : null;
}

/**
 * El botón "Facturar": arma un borrador de factura desde el presupuesto. **NO emite** — ver
 * `ResultadoFacturar`.
 *
 * Después de que el usuario confirme la emisión en la pantalla de factura, el `facturado` del
 * presupuesto pasa a `true` solo (no hay que avisarle nada al backend): hay que **re-consultar** el
 * presupuesto para refrescar el badge.
 */
export async function facturarPresupuesto(id: number): Promise<ResultadoFacturar> {
  try {
    const raw = await apiClient.post<{ factura_id: string }>(`/presupuestos/${id}/facturar`, {});
    if (!esRespuestaDelEndpoint(raw, 'factura_id')) return { status: 'no_disponible' };
    return { status: 'ok', facturaId: raw.factura_id };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (err instanceof ApiError && err.status === 409) {
      const facturaId = facturaIdDelBody(err.body);
      return facturaId !== undefined ? { status: 'ya_facturado', facturaId } : { status: 'falta_perfil_fiscal' };
    }
    throw err;
  }
}
