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

/* ---------------------------------------------------------------------------
 * Alta y edición — hito 7 del contrato (§6.bis). Precondición: el hito 3 de BACKEND.
 * ------------------------------------------------------------------------- */

/**
 * Lo que se manda a dar de alta. **Sólo `nombre` es obligatorio** — §6.bis.2, y no es una comodidad:
 * exigir el CUIT para poder guardar traba el caso más común (el cliente de mostrador del que sólo se
 * sabe el nombre) **y esconde bugs de las dos capas**, porque el formulario nunca llega a mandar el
 * body que el backend rechazaría.
 *
 * Las claves ausentes **no se mandan**. En la edición eso es la diferencia entre no tocar un campo y
 * borrarlo.
 */
export interface DatosCliente {
  nombre?: string;
  /** 80=CUIT · 96=DNI · `null` para "sin documento". **Nunca 99** — ver el docstring del módulo. */
  docTipo?: number | null;
  docNro?: string | null;
  condicionIva?: number | null;
  domicilio?: string | null;
  contacto?: string | null;
  notas?: string | null;
}

/**
 * Traduce a las claves del wire **omitiendo lo que no vino**.
 *
 * 🔴 **`undefined` (no tocar) y `null` (borrar) NO son lo mismo, y ésta es la función donde esa
 * diferencia se conserva.** `POST /clientes/{cliente}` es parcial: mandar el objeto entero con los
 * campos vacíos **borra** lo que había — incluido el domicilio que vino de las facturas de AFIP, que
 * el emprendedor nunca tipeó y no sabe que puede perder. Un `for...in` sobre el formulario completo
 * sería exactamente ese bug, y se ve idéntico a un guardado exitoso.
 */
function aWire(datos: DatosCliente): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  if (datos.nombre !== undefined) wire.nombre = datos.nombre;
  if (datos.docTipo !== undefined) wire.doc_tipo = datos.docTipo;
  if (datos.docNro !== undefined) wire.doc_nro = datos.docNro;
  if (datos.condicionIva !== undefined) wire.condicion_iva = datos.condicionIva;
  if (datos.domicilio !== undefined) wire.domicilio = datos.domicilio;
  if (datos.contacto !== undefined) wire.contacto = datos.contacto;
  if (datos.notas !== undefined) wire.notas = datos.notas;
  return wire;
}

/**
 * El cliente que devuelve un alta/edición, venga envuelto o pelado.
 *
 * ✅ **MEDIDO el 2026-07-22** (backend, `avance_..._clientes-hito3`): la respuesta viene **PELADA** —
 * `201 {"id": 7, "nombre": …}` en el alta, `200` con la ficha ya actualizada en la edición.
 *
 * Se conserva la tolerancia a la forma envuelta, y no por indecisión: el sistema **no es consistente**
 * — aunque la regla que sí lo sostiene es más limpia de lo que yo había leído: **un `POST` que crea o
 * edita devuelve el recurso pelado; un `GET` de ficha devuelve SECCIONES** (`{cliente, presupuestos,
 * facturas}` no envuelve un recurso: `cliente` es una de las tres). Aun así la envoltura es el detalle
 * que alguien cambia sin pensar que rompe algo. Errar acá **no daría error**: el
 * normalizador leería `undefined` y el alta mostraría un cliente en blanco con id `NaN` — que se lee
 * como bug del backend. Tolerar las dos cuesta tres líneas.
 */
function clienteDeLaRespuesta(raw: unknown): Cliente | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const envuelto = (raw as { cliente?: unknown }).cliente;
  const candidato = (typeof envuelto === 'object' && envuelto !== null ? envuelto : raw) as ClienteCrudo;
  // El control de que esto es un cliente y no otra cosa: sin `id` no hay a dónde navegar después.
  return typeof candidato.id === 'number' ? normalizar(candidato) : null;
}

/**
 * Contra qué chocó el alta.
 *
 * 🔴 **`nombre` NO estaba en la tabla de errores del contrato (§7) — lo agregó el backend** y es un
 * caso real: repetir un nombre normalizado **sin documento** también choca, porque el índice parcial
 * por nombre lo impide (§3.3). Importa para el texto: decir *"ese documento ya es de X"* a alguien
 * que **no tipeó ningún documento** es una explicación falsa de algo que sí pasó — el usuario busca
 * un documento que no puso y concluye que la app se equivocó.
 *
 * `desconocido` cubre un `por` que el backend agregue mañana: se avisa igual, en genérico.
 */
export type MotivoDuplicadoCliente = 'documento' | 'nombre' | 'desconocido';

export interface DuplicadoCliente {
  por: MotivoDuplicadoCliente;
  /**
   * El dueño **entero**, no su id.
   *
   * ✅ **MEDIDO el 2026-07-22.** El `409` llega como
   * `{detail, por, cliente: {…ficha completa…}}` — el backend manda la ficha a propósito, porque el
   * mensaje que pide el contrato (*"ese documento ya es de Juan Pérez, ¿querés abrirlo?"*) **necesita
   * el nombre**, y con el id pelado haría falta un `GET` extra sólo para poder escribir la frase.
   *
   * `null` si el body no trae nada reconocible: la UI avisa igual, sin el botón de abrirlo.
   */
  dueno: Cliente | null;
}

/**
 * Lee el dueño del `409`.
 *
 * ⚠️ **Acá me equivoqué y vale dejarlo escrito.** Mientras el `POST` daba 405 supuse que el id venía
 * como `cliente_id`/`id` en la raíz o bajo `detail`, porque §3.4 decía *"con su id en el body"*. Venía
 * la ficha entera bajo `cliente`. **La suposición no habría dado error**: `duenoId` quedaba `null`, el
 * aviso salía sin el botón, y eso se ve como *"el backend no manda el id"* — un bug atribuido al otro
 * lado, indistinguible de la realidad hasta que alguien leyera el body. Los fallbacks siguen porque
 * son baratos; lo que cambió es cuál se prueba primero y por qué.
 */
function duplicadoDelBody(body: unknown): DuplicadoCliente {
  if (typeof body !== 'object' || body === null) return { por: 'desconocido', dueno: null };
  const raiz = body as Record<string, unknown>;
  const detalle =
    typeof raiz.detail === 'object' && raiz.detail !== null
      ? (raiz.detail as Record<string, unknown>)
      : {};

  const porCrudo = raiz.por ?? detalle.por;
  const por: MotivoDuplicadoCliente =
    porCrudo === 'documento' || porCrudo === 'nombre' ? porCrudo : 'desconocido';

  // La forma medida: la ficha completa bajo `cliente`.
  for (const nivel of [raiz, detalle]) {
    const c = nivel.cliente;
    if (typeof c === 'object' && c !== null && typeof (c as ClienteCrudo).id === 'number') {
      return { por, dueno: normalizar(c as ClienteCrudo) };
    }
  }

  // Fallbacks: un id suelto alcanza para navegar, aunque no para nombrarlo.
  for (const clave of ['cliente_id', 'id', 'duplicado_id']) {
    for (const nivel of [raiz, detalle]) {
      const v = nivel[clave];
      const id = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null;
      if (id != null) return { por, dueno: normalizar({ id }) };
    }
  }
  return { por, dueno: null };
}

/**
 * Resultado de guardar. **El `409` no es un error**: es el resultado útil de §6.bis.3 —ese cliente ya
 * existe— y la UI lo pinta como *"ya lo tenés en la cartera"*, no en rojo.
 */
export type ResultadoGuardarCliente =
  | { status: 'ok'; cliente: Cliente }
  | { status: 'no_disponible' }
  | { status: 'duplicado'; duplicado: DuplicadoCliente };

async function guardar(ruta: string, datos: DatosCliente): Promise<ResultadoGuardarCliente> {
  try {
    const raw = await apiClient.post<unknown>(ruta, aWire(datos));
    const cliente = clienteDeLaRespuesta(raw);
    // Un 200 con el HTML del SPA llega hasta acá como string: no es un cliente, y decirlo "no
    // disponible" es más cierto que fabricar uno vacío.
    return cliente != null ? { status: 'ok', cliente } : { status: 'no_disponible' };
  } catch (err) {
    if (noDesplegado(err)) return { status: 'no_disponible' };
    if (err instanceof ApiError && err.status === 409) {
      return { status: 'duplicado', duplicado: duplicadoDelBody(err.body) };
    }
    if (!(err instanceof ApiError)) return { status: 'no_disponible' };
    // 400/422 (falta el nombre, doc_tipo 99, un campo largo) sube: son accionables y el formulario
    // los muestra tal cual los explica el backend.
    throw err;
  }
}

/**
 * Alta a mano. **Se escribe nueva y NO copiando el `crearCliente` del archivo borrado** (§2.ter): aquél
 * llamaba al `HttpPort` directo para poder leer el body del error y por eso **se salteaba el refresh de
 * token** — un token vencido justo en el alta desloguea al emprendedor en el peor momento. Ese rodeo
 * ya no hace falta: `ApiError.body` existe desde el 2026-07-21 para esto.
 */
export function crearCliente(datos: DatosCliente): Promise<ResultadoGuardarCliente> {
  return guardar('/clientes', datos);
}

/**
 * Edición parcial. **Pasar sólo lo que cambió** — ver `aWire`: lo que no se manda no se toca, y
 * mandar todo borra lo que el usuario no tipeó nunca.
 */
export function editarCliente(id: number, cambios: DatosCliente): Promise<ResultadoGuardarCliente> {
  return guardar(`/clientes/${id}`, cambios);
}

/**
 * Qué cambió entre el cliente que se está editando y lo que quedó en el formulario. **El corazón de
 * la edición parcial**: si esto devolviera todas las claves, guardar sin tocar nada reescribiría el
 * cliente entero.
 *
 * Devuelve `{}` cuando no cambió nada — y ese caso vale la pena mirarlo antes de mandar el request.
 */
export function cambiosDeCliente(original: Cliente, editado: DatosCliente): DatosCliente {
  const cambios: DatosCliente = {};
  if (editado.nombre !== undefined && editado.nombre !== original.nombre) cambios.nombre = editado.nombre;
  if (editado.docTipo !== undefined && editado.docTipo !== original.docTipo) cambios.docTipo = editado.docTipo;
  if (editado.docNro !== undefined && editado.docNro !== original.docNro) cambios.docNro = editado.docNro;
  if (editado.condicionIva !== undefined && editado.condicionIva !== original.condicionIva) {
    cambios.condicionIva = editado.condicionIva;
  }
  if (editado.domicilio !== undefined && editado.domicilio !== original.domicilio) {
    cambios.domicilio = editado.domicilio;
  }
  if (editado.contacto !== undefined && editado.contacto !== original.contacto) {
    cambios.contacto = editado.contacto;
  }
  if (editado.notas !== undefined && editado.notas !== original.notas) cambios.notas = editado.notas;
  return cambios;
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
