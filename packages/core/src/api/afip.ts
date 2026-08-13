import { apiClient, mapearError as mapearErrorGenerico, safeJson } from './client';
import { config } from './config';
import { ApiError, codigoDeConflicto, mensajeDeConflicto } from './errors';
import type { PeticionHttp } from './http';

/**
 * `/afip/*` — cliente de los 13 endpoints de facturación AFIP/ARCA (capa CLIENTE, `afip_web.py`,
 * verificado línea por línea el 2026-07-21). Molde: `actividad.ts` (mismo criterio `no_disponible`
 * para 404/501) — con una diferencia deliberada, documentada abajo.
 *
 * 🔴 **Por qué `no_disponible` NO se aplica a los 13 endpoints por igual.** `actividad.ts` puede
 * tratar CUALQUIER 404 como "la ruta no existe todavía" porque `/actividad` no tiene segmento
 * dinámico en el path — un 404 ahí SÓLO puede significar eso. Acá no es tan simple: rutas como
 * `GET /afip/facturas/{factura_id}` SÍ tienen un id dinámico, y el backend define un 404 propio y
 * legítimo para "esta factura no existe" (`afip_web.py::estado_factura`) — indistinguible por status
 * code de "la app de AFIP todavía no está montada". Colapsar los dos casos en `no_disponible`
 * escondería un id mal armado (bug real del caller) detrás de un mensaje que dice "probá más tarde".
 * Por eso el wrapper `ConDisponibilidad` se aplica SÓLO a las rutas SIN segmento dinámico (perfil,
 * conectar, estado, crear factura, listar/anular comprobantes) — ahí un 404/501 sólo puede leerse como
 * "la app de AFIP no está desplegada", que es exactamente el estado real hoy (spike del plan de UI:
 * `/afip/estado` devuelve la SPA, ruta inexistente). Las rutas con id dinámico dejan que el `ApiError`
 * suba tal cual, mismo criterio que `obtenerCliente`/`actualizarCliente` en `clientes.ts`.
 *
 * `crearFactura`/`anularComprobante` además tratan el 503 (`afip_web.py` lo lanza explícito cuando la
 * fábrica correspondiente no fue inyectada — "facturación no disponible"/"anulación no disponible")
 * como `no_disponible`: es el mismo estado ("esta capacidad no está armada en este deploy") expresado
 * con otro status code, no un error transitorio del servidor.
 *
 * 🔴 **La clave fiscal.** `conectarArca` es la ÚNICA función que la toca. Viaja en el `cuerpoJson` del
 * POST y en NINGÚN otro lugar: no hay variable de módulo que la retenga, ningún objeto que esta capa
 * devuelva la incluye, y no se loguea (ni siquiera en un `throw` — los errores de `conectarArca` nunca
 * interpolan el body de la request). El backend la trata igual (`ClaveFiscal.__repr__` la enmascara,
 * `AfipSecretHandoff` la cifra con TTL de 15 min y la consume una sola vez) — ver `afip_credential_store.py`.
 *
 * **Importes.** Siempre `string` (centavos; `float` los rompe — `afip_rules.a_decimal` rechaza `float`
 * crudo del lado del backend por la misma razón). Ninguna función de acá hace aritmética con `cantidad`
 * ni `precio_unitario`: el total lo calcula el backend, nunca esta capa.
 *
 * **Uniones de estado abiertas.** `EstadoFactura`, `PasoOnboarding`, `PasoAnulacion`, `EstadoComprobante`
 * se tipan `Conocido | (string & {})` — mismo criterio que `ReplyCard.kind` en `types.ts`: un estado
 * nuevo del backend no debe romper el bundle del front. `CondicionIvaEmisor` es la excepción a
 * propósito: NO es una máquina de estados, es un catálogo fijo (`CondicionEmisor` en `afip_rules.py`,
 * 3 valores) que el backend valida con 422 ante cualquier otro texto — cerrarlo acá refleja esa validación.
 */

// ---------------------------------------------------------------------------
// Catálogos y estados.
// ---------------------------------------------------------------------------

/** Catálogo FIJO del emisor (`CondicionEmisor` en `afip_rules.py`) — el backend rechaza con 422
 * cualquier otro valor, así que la unión se tipa CERRADA (a diferencia de las de estado, ver arriba). */
export type CondicionIvaEmisor = 'monotributo' | 'responsable_inscripto' | 'exento';

type EstadoFacturaConocido =
  | 'borrador'
  | 'datos_venta_ok'
  | 'items_ok'
  | 'cliente_ok'
  | 'esperando_confirmacion'
  | 'emitiendo'
  | 'emitida'
  | 'entregada'
  | 'rechazada'
  | 'cancelada';
/** Máquina de estados de `FacturaWorkflow.estado()` (`afip_rules.EstadoFactura`). Unión ABIERTA. */
export type EstadoFactura = EstadoFacturaConocido | (string & {});

type PasoOnboardingConocido = 'iniciado' | 'dando_de_alta' | 'verificando' | 'habilitado' | 'fallido';
/** Pasos de `AfipOnboardingWorkflow.progreso()`. Unión ABIERTA. */
export type PasoOnboarding = PasoOnboardingConocido | (string & {});

type PasoAnulacionConocido =
  | 'iniciado'
  | 'esperando_confirmacion'
  | 'emitiendo_nota_credito'
  | 'anulada'
  | 'fallida'
  | 'cancelada';
/** Pasos de `AnulacionWorkflow.estado()`. Unión ABIERTA. */
export type PasoAnulacion = PasoAnulacionConocido | (string & {});

/** `estado` de un `Comprobante` (`AfipComprobanteStore`, las 3 constantes `ESTADO_*`). Unión ABIERTA. */
export type EstadoComprobante = 'emitida' | 'anulada' | 'nota_credito' | (string & {});

// ---------------------------------------------------------------------------
// Shapes compartidos.
// ---------------------------------------------------------------------------

/** Un error estructurado del backend (`ErrorValidacion` en `afip_rules.py`) — `codigo` es lo que la UI
 * usa para resaltar el campo; `mensaje` es para el humano. Mismos nombres en snake y camel: sin normalizar. */
export interface Faltante {
  codigo: string;
  campo: string;
  mensaje: string;
}

/** Un ítem YA cargado en el borrador (`FacturaWorkflow._item_dict`) — trae `subtotal`, que lo calcula
 * el backend. Distinto de `NuevoItem` (lo que el caller manda para AGREGAR un ítem). */
export interface ItemFactura {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  subtotal: string;
}

/** Resultado de la emisión (`_emitir_sync` en `afip_factura_activities.py`) — el backend tiene 3 ramas
 * (duplicado por idem_key / adoptado de AFIP / emisión nueva) que no comparten exactamente las mismas
 * claves; acá se normaliza el subconjunto común a las 3. `caeVto` puede faltar según la rama. */
export interface ResultadoEmision {
  ok: boolean;
  duplicado: boolean;
  cae: string;
  caeVto: string | null;
  nro: number;
  tipoCbte: number;
  puntoVenta: number;
  /**
   * 🔴 **[CONNECT] Id de FILA del comprobante recién emitido — el que `SeccionCobro` necesita para
   * ofrecer «¿ya la cobraste?» en la card de éxito.** Es el mismo `id` que expone `GET
   * /afip/comprobantes` (`Comprobante.id`) y el que referencia `copiloto_ingresos.comprobante_id`
   * (contrato de Contabilidad §2.1) — backend lo confirmó en su respuesta al `hallazgo_frontend`.
   *
   * `null` hasta que el backend lo agregue al payload de `resultado` (hoy éste trae `cae`/`nro` pero
   * no el id de fila). **`ausente ≠ 0`, y sin id la card de éxito NO dibuja la sección de cobro** —
   * un botón que apunta a `/undefined/cobros` sería un 404 sobre algo que no se intentó. Se conecta
   * solo: el día que `resultado.id` llegue con número, el toque aparece sin tocar la card.
   */
  id: number | null;
}

/** `GET /afip/facturas/{id}` — el shape completo que `FacturaWorkflow.estado()` devuelve, normalizado. */
/**
 * Los códigos ESTABLES de `motivo`, para ramificar. Los agregó el backend el 2026-07-21 a pedido de
 * esta capa, porque `motivo` mezclaba dos vocabularios: siete frases en español listas para mostrar y
 * un código de máquina (`sin_certificado_afip`). Mezclado, cada motivo nuevo del backend era una
 * ramificación nueva que sólo se descubría en producción.
 *
 * 🔴 **`motivoCodigo` es para RAMIFICAR, `motivo` es para MOSTRAR.** No al revés: comparar contra la
 * frase la ata al copy del backend, y el copy cambia.
 *
 * Los dos que más importan en la UI:
 *   - `token_desactualizado` — la confirmación no correspondía a los datos actuales. NO es un error:
 *     hay que volver a mostrar el resumen.
 *   - `emitida_sin_pdf` — **hay CAE válido y el comprobante quedó registrado en AFIP.** Se muestra
 *     como ÉXITO con advertencia. Confirmado por backend, que lo vivió en producción: si la UI dice
 *     "falló", el usuario factura de nuevo y duplica un comprobante fiscal real.
 *   - `rechazo_afip` — este SÍ es un rechazo fiscal de verdad.
 */
export type MotivoCodigo =
  | 'datos_venta_invalidos'
  | 'item_invalido'
  | 'cliente_invalido'
  | 'faltan_datos'
  | 'token_desactualizado'
  | 'sin_certificado_afip'
  | 'rechazo_afip'
  | 'emitida_sin_pdf'
  | (string & {});

/**
 * Resultado del archivado en el Drive del emprendedor.
 *
 * 🔴 **`guardado` es el HECHO, no la intención.** Con el ajuste prendido y el archivado fallado
 * (Drive sin conectar, por ejemplo) esto viene `guardado: false` y la factura sale igual. Colgar el
 * aviso de las 24 h del ajuste en vez de este campo le haría creer al usuario que su factura está a
 * salvo cuando no lo está — peor que no avisar nunca. Misma forma que el bug de `estado === 'emitida'`.
 */
export interface ArchivoDrive {
  guardado: boolean;
  fileId?: string | null;
  /** `webContentLink`: descarga directa. No vence, a diferencia de `pdf.url`. */
  link?: string | null;
  compartido?: boolean;
  /** Por qué no se guardó: `desactivado` · `error_drive: …` · `sin_pdf_para_archivar`. */
  motivo?: string | null;
}

export interface EstadoFacturaResp {
  estado: EstadoFactura;
  faltantes: Faltante[];
  items: ItemFactura[];
  total: string;
  tokenConfirmacion: string | null;
  resultado: ResultadoEmision | null;
  pdf: { url: string; nombre: string; expiraAt: string | null } | null;
  /** `null` mientras el workflow todavía no llegó a la etapa de archivado. */
  drive: ArchivoDrive | null;
  /** `null` mientras el borrador no tiene cliente cargado (ni por signal ni desde el presupuesto). */
  receptor: ReceptorInput | null;
  /** La frase redactada, para MOSTRAR. */
  motivo: string | null;
  /** El código estable, para RAMIFICAR. Ver `MotivoCodigo`. */
  motivoCodigo: MotivoCodigo | null;
  /**
   * 🔴 **Flag EXPLÍCITO del workflow ("no voy a escribir nada más"), no una lista de estados.**
   * Cortar el polling por `estado` falla en los dos bordes y el backend ya los pagó: la factura se
   * marca `entregada` ANTES de archivarse en Drive (cortar ahí deja `drive` en `null` para siempre
   * sobre una factura que segundos después sí tenía copia), y una factura sin PDF queda en `emitida`,
   * que no figuraba entre los terminales — el cliente poleaba eternamente un workflow ya cerrado.
   * Cortar SIEMPRE por acá: garantiza que `pdf` y `drive` ya están.
   */
  terminado: boolean;
}

/** Perfil fiscal del EMISOR (`AfipPerfilStore.get`), normalizado. */
export interface PerfilFiscal {
  cuit: string;
  razonSocial: string;
  domicilioComercial: string;
  condicionIva: CondicionIvaEmisor;
  ingresosBrutos: string;
  /** ISO `YYYY-MM-DD`. */
  inicioActividades: string;
  puntoVenta: number;
  /** Archivar cada factura en el Drive del emprendedor. **Default `false`** — ver `normalizarPerfil`. */
  guardarEnDrive: boolean;
}

/** Progreso del alta ante ARCA (`AfipOnboardingWorkflow.progreso()`), normalizado. */
export interface OnboardingProgreso {
  paso: PasoOnboarding;
  motivo: string | null;
  wsAutorizados: string[];
  terminado: boolean;
  ok: boolean;
}

/** `GET /afip/estado` — lo que Ajustes pinta: si ya puede facturar y en qué paso del alta está. */
/**
 * Los dos ambientes de AFIP. **`'dev'`/`'prod'` y no `'homologacion'`/`'produccion'`**: son los
 * valores literales que usa el backend (`AfipCredentialStore.save(ambiente="dev")`, y el
 * `POST /afip/conectar {ambiente}` que confirmó la sesión de backend el 2026-07-21). Tiparlos con los
 * nombres "lindos" fue un error real de la primera versión de este archivo: el lado de LECTURA nunca
 * habría matcheado y el de ESCRITURA habría mandado un valor que el backend no reconoce — un defecto
 * silencioso, porque pydantic ignora las claves que no entiende. El copy humano ("Homologación",
 * "Producción") es cosa de la UI; acá viaja el valor del contrato.
 */
export type AmbienteAfip = 'dev' | 'prod';

export interface EstadoAfip {
  /**
   * El CUIT del emprendedor, resuelto por el backend con `primer_cuit()` cuando la llamada va sin
   * parámetro (desplegado el 2026-07-21).
   *
   * 🔴 **`null` es un valor legítimo, no un error**: es el estado inicial de un tenant que todavía no
   * vinculó nada, y el backend lo devuelve con 200. La app cachea el CUIT localmente como
   * OPTIMIZACIÓN, pero la fuente de verdad es esta — si viviera sólo en el cliente, cambiar de
   * teléfono mostraría "cargá tus datos fiscales" sobre un perfil que existe.
   */
  cuit?: string | null;
  conectado: boolean;
  wsAutorizados: string[];
  perfilCompleto: boolean;
  puedeFacturar: boolean;
  onboarding: OnboardingProgreso | null;
  /** ⚠️ Opcional hasta que el backend lo mande (pedido §3). El ambiente de la credencial vigente. */
  ambiente?: AmbienteAfip;
  /**
   * ⚠️ Opcional hasta que el backend lo mande (pedido §3). Los ambientes que YA tienen credencial.
   *
   * 🔴 Es el dato que decide la UI del selector, y por eso no se puede inventar: un ambiente en esta
   * lista es un toggle instantáneo; uno que no está exige el alta (con clave fiscal) para ESE
   * ambiente. `undefined` significa "no sé", y la pantalla tiene que decirlo — asumir que está
   * vinculado llevaría al usuario a tocar un switch que después falla.
   */
  ambientesVinculados?: AmbienteAfip[];
  /**
   * ¿El toolkit de Drive está vinculado y utilizable para este tenant? (desplegado 2026-07-21).
   *
   * 🔴 **Son TRES estados y el `null` NO se colapsa a `false`.** `true` = vinculado y ACTIVE.
   * `false` = no hay conexión **o está EXPIRED** (existe pero no sirve para subir, así que prometer
   * archivado sería mentir). `null` = **el backend no pudo averiguarlo** porque Composio no
   * respondió.
   *
   * Tratar `null` como "desconectado" reproduce exactamente el bug del alta fallida: una caída
   * ajena le diría *"conectá tu Drive"* a alguien que lo tiene conectado hace meses — el rastro de
   * un intento pisando el hecho. Con `null` la pantalla no afirma nada sobre Drive.
   *
   * `undefined` = backend viejo que todavía no manda el campo; se trata igual que `null`.
   */
  driveConectado?: boolean | null;
}

/** Una fila de "Mis comprobantes" (`AfipComprobanteStore._fila`), normalizada. */
export interface Comprobante {
  /**
   * Id de FILA de `afip_comprobantes`. Es lo que permite **direccionar** un comprobante desde afuera
   * —la lista de actividad, un link— sin pasar el objeto entero.
   *
   * 🔴 **No confundirlo con el `factura_id` del workflow** (`presu-12`, un uuid): son dos espacios de
   * ids y **los dos son legítimos**. El del workflow sirve MIENTRAS se emite
   * (`/afip/facturas/{factura_id}`); éste sirve DESPUÉS (`/afip/comprobantes/{id}`). No hay que
   * unificarlos: hay que saber cuál usar cuándo.
   *
   * Opcional porque las consultas que alimentan activities de Temporal **no** lo traen a propósito —
   * el shape de ese payload es parte del historial de ejecución del workflow y no se toca por
   * comodidad. Las dos que consume la app sí (verificado en `afip_comprobante_store.py:117,140`).
   */
  id?: number;
  cuit: string;
  tipoCbte: number;
  puntoVenta: number;
  nro: number;
  cae: string;
  caeVto: string | null;
  fechaEmision: string | null;
  total: string;
  /**
   * ⚠️ **No es el mismo vocabulario que el estado del workflow.** Esto sale de la base
   * (`emitida`/`anulada`/`nota_credito`); `entregada` es un estado del `FacturaWorkflow` y NUNCA
   * aparece acá. Comparar una card del listado contra `'entregada'` no matchea jamás.
   */
  estado: EstadoComprobante;
  /** Link de AfipSDK. **Vence a las 24 h** y no se re-hostea. */
  pdfUrl: string | null;
  cbteAsocNro: number | null;
  /** Copia permanente en el Drive del emprendedor. `driveLink` es el `webContentLink` (DESCARGA el
   *  archivo); el `webViewLink` de Drive abre el visor y deja al usuario en una página en vez de con
   *  su PDF — el backend manda el correcto, no sustituirlo por el que muestra la UI de Drive. */
  driveFileId: string | null;
  driveLink: string | null;
  /** A quién se le facturó. `null` en comprobantes anteriores al 2026-07-21 — el dato no existía. */
  receptorNombre: string | null;
  docTipo: number | null;
  docNro: string | null;
}

/** `GET /afip/anulaciones/{id}` — `AnulacionWorkflow.estado()`, normalizado. */
export interface EstadoAnulacion {
  paso: PasoAnulacion;
  original: Comprobante | null;
  errores: Faltante[];
  resultado: ResultadoEmision | null;
  motivo: string | null;
  terminado: boolean;
  /**
   * ¿La factura original quedó marcada como anulada en el libro propio? **No es lo mismo que "se
   * anuló"**: la anulación la define el CAE de la nota de crédito ante AFIP. Puede venir `false` con
   * `paso: 'anulada'` — la NC existe y es válida, pero el listado va a seguir mostrando la factura
   * como vigente hasta que se reconcilie. Cuando pase, mostrar el `motivo`, no un error.
   */
  marcada: boolean;
}

/**
 * Resultado uniforme para las rutas SIN segmento dinámico (ver docstring del módulo): `no_disponible`
 * cubre 404/501 (la app de AFIP no está montada) y, en `crearFactura`/`anularComprobante`, también el
 * 503 explícito del backend cuando esa capacidad puntual no fue inyectada.
 */
export type ConDisponibilidad<T> = ({ status: 'ok' } & T) | { status: 'no_disponible' };

// ---------------------------------------------------------------------------
// Requests (camelCase — se convierten a snake_case en cada función).
// ---------------------------------------------------------------------------

export interface GuardarPerfilRequest {
  cuit: string;
  razonSocial: string;
  domicilioComercial: string;
  condicionIva: CondicionIvaEmisor;
  ingresosBrutos: string;
  /** ISO `YYYY-MM-DD`. */
  inicioActividades: string;
  puntoVenta: number;
}

export interface ConectarArcaRequest {
  cuit: string;
  usuario: string;
  /** 🔴 Sólo vive en el `cuerpoJson` de este POST. Ver el docstring del módulo. */
  claveFiscal: string;
  /**
   * ⚠️ [ASSUMED_PENDING_VERIFY] `ConectarBody` en `afip_web.py` (verificado contra el backend vivo el
   * 2026-07-21) todavía NO declara este campo — pydantic ignora claves extra por default, así que
   * mandarlo no rompe nada, pero hoy el backend lo IGNORA en silencio y el alta queda en el default
   * (`dev`). La sesión de backend confirmó que va a aceptarlo con estos mismos valores; hasta
   * entonces, la pantalla de Ajustes muestra el selector en solo-lectura.
   */
  ambiente?: AmbienteAfip;
}

export interface ConectarArcaResponse {
  ok: boolean;
  workflowId: string;
  mensaje: string;
}

export interface AnularComprobanteRequest {
  cuit: string;
  tipoCbte: number;
  puntoVenta: number;
  nro: number;
}

/** Payload de `cargar_datos_venta` (signal). `concepto`: 1 productos · 2 servicios · 3 ambos — con 2/3
 * el backend exige las 3 fechas de servicio (R6 de `afip_rules.py`); acá no se validan de antemano,
 * eso es responsabilidad del backend (fuente única de las reglas fiscales). */
export interface DatosVentaInput {
  /** ISO `YYYY-MM-DD`. */
  fecha: string;
  concepto: 1 | 2 | 3;
  condicionVenta: string;
  fechaServicioDesde?: string | null;
  fechaServicioHasta?: string | null;
  fechaVtoPago?: string | null;
}

/** Payload de `agregar_item` (signal). Sin `subtotal`: lo calcula el backend. */
export interface NuevoItem {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  codigo?: string;
}

/** Payload de `cargar_cliente` (signal). `condicionIva`/`tipoDoc` son los códigos numéricos de AFIP
 * (`CondicionIVA`/`TipoDoc` en `afip_rules.py`) — esta capa no reexpone ese catálogo; el backend valida
 * y, si el valor no matchea el enum, deja `motivo` en el estado (no lanza 4xx acá, ver `cargar_cliente`). */
export interface ReceptorInput {
  condicionIva: number;
  tipoDoc: number;
  nroDoc: string;
  nombre: string;
  domicilio: string;
}

// ---------------------------------------------------------------------------
// Excepción tipada del 422 de `POST /afip/perfil` y `POST /afip/conectar`.
// ---------------------------------------------------------------------------

/**
 * 422 de `POST /afip/perfil` (`condicion_iva` inválida, o la lista de `ErrorValidacion` de
 * `validar_perfil`) y `POST /afip/conectar` (CUIT inválido / falta la clave fiscal). El backend manda
 * el `detail` en DOS formas distintas según el caso — ver `faltantesDeDetail` — y esta clase las
 * normaliza SIEMPRE a `Faltante[]`, para que el caller no tenga que ramificar por tipo de `detail`.
 */
export class ErrorValidacionFiscal extends ApiError {
  readonly faltantes: Faltante[];

  constructor(faltantes: Faltante[]) {
    super(422, faltantes[0]?.mensaje ?? 'datos fiscales inválidos');
    this.name = 'ErrorValidacionFiscal';
    this.faltantes = faltantes;
  }
}

/** Extrae el `detail` CRUDO (cualquier tipo) de un body de error — a diferencia de `stringDetail` de
 * `client.ts`, que sólo devuelve algo cuando `detail` es un string. Acá necesitamos el array también. */
function detailCrudo(body: unknown): unknown {
  if (body && typeof body === 'object' && 'detail' in body) {
    return (body as { detail?: unknown }).detail;
  }
  return undefined;
}

/**
 * Normaliza el `detail` de un 422 fiscal a `Faltante[]`, sea cual sea su forma real:
 * - `[{codigo, campo, mensaje}, ...]` (`validar_perfil`, HTTPException(422, detail=[...])).
 * - Un STRING suelto (`"condicion_iva inválida: X"` / `"CUIT inválido"` / `"falta la clave fiscal"`) →
 *   se envuelve en un `Faltante` con `campo: ''` (no hay campo específico que resaltar) y `codigo: ''`
 *   (el backend no manda un código estable para estos dos casos, a diferencia de `validar_perfil`).
 * `null` si `detail` no es ninguna de las dos formas (no debería pasar contra el backend real, pero un
 * 422 con `detail` ausente/objeto no se inventa un `Faltante` fantasma).
 */
function faltantesDeDetail(detail: unknown): Faltante[] | null {
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      const o = d && typeof d === 'object' ? (d as Record<string, unknown>) : {};
      return {
        codigo: typeof o.codigo === 'string' ? o.codigo : '',
        campo: typeof o.campo === 'string' ? o.campo : '',
        mensaje: typeof o.mensaje === 'string' ? o.mensaje : '',
      };
    });
  }
  if (typeof detail === 'string' && detail.trim()) {
    return [{ codigo: '', campo: '', mensaje: detail }];
  }
  return null;
}

/** Un 404/501 (siempre) o 503 (sólo si `incluirServicioNoDisponible`) es "esta capacidad no está
 * disponible en este deploy" — ver el docstring del módulo para por qué sólo aplica a rutas sin id. */
function esNoDisponible(err: unknown, incluirServicioNoDisponible = false): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404 || err.status === 501) return true;
  return incluirServicioNoDisponible && err.status === 503;
}

/**
 * POST/PATCH directo al `HttpPort` (no vía `apiClient`) — mismo motivo que `crearCliente`/
 * `actualizarCliente` en `clientes.ts`: `client.ts::mapearError` sólo preserva `detail` cuando es un
 * STRING, y acá necesitamos también la forma ARRAY del 422 fiscal.
 */
async function enviarAutenticado(peticion: Omit<PeticionHttp, 'headers'>) {
  const { http, tokens } = config();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await tokens.leerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return http.enviar({ ...peticion, headers });
}

// ---------------------------------------------------------------------------
// Perfil fiscal.
// ---------------------------------------------------------------------------

function normalizarPerfil(raw: {
  cuit: string;
  razon_social: string;
  domicilio_comercial: string;
  condicion_iva: string;
  ingresos_brutos: string;
  inicio_actividades: string;
  punto_venta: number;
  guardar_en_drive?: boolean;
}): PerfilFiscal {
  return {
    cuit: raw.cuit,
    razonSocial: raw.razon_social,
    domicilioComercial: raw.domicilio_comercial,
    condicionIva: raw.condicion_iva as CondicionIvaEmisor,
    ingresosBrutos: raw.ingresos_brutos,
    inicioActividades: raw.inicio_actividades,
    puntoVenta: raw.punto_venta,
    // `?? false` y no `?? true`: subir los datos fiscales de alguien a una cuenta de Drive no puede
    // pasar por defecto. Si el backend no manda la clave, el ajuste está APAGADO.
    guardarEnDrive: raw.guardar_en_drive ?? false,
  };
}

/** `GET /afip/perfil?cuit=` — Bearer requerido. `perfil: null` si el tenant todavía no cargó nada para
 * ese CUIT (200 real, no un error: `AfipPerfilStore.get` devuelve `None` sin 404). */
export async function leerPerfil(cuit: string): Promise<ConDisponibilidad<{ perfil: PerfilFiscal | null }>> {
  try {
    const raw = await apiClient.get<{
      perfil: Parameters<typeof normalizarPerfil>[0] | null;
    }>(`/afip/perfil?cuit=${encodeURIComponent(cuit)}`);
    return { status: 'ok', perfil: raw.perfil ? normalizarPerfil(raw.perfil) : null };
  } catch (err) {
    if (esNoDisponible(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * `POST /afip/perfil` — Bearer requerido. Valida con las MISMAS reglas que la emisión (`validar_perfil`
 * del lado del backend) — si se validara sólo al facturar, el usuario vería un tilde verde en Ajustes y
 * recién descubriría el problema en su primera factura. 422 → `ErrorValidacionFiscal` con `Faltante[]`
 * (lista estructurada, o `condicion_iva inválida: X` como string suelto — ver `faltantesDeDetail`).
 */
export async function guardarPerfil(perfil: GuardarPerfilRequest): Promise<ConDisponibilidad<{ ok: true }>> {
  const cuerpo = {
    cuit: perfil.cuit,
    razon_social: perfil.razonSocial,
    domicilio_comercial: perfil.domicilioComercial,
    condicion_iva: perfil.condicionIva,
    ingresos_brutos: perfil.ingresosBrutos,
    inicio_actividades: perfil.inicioActividades,
    punto_venta: perfil.puntoVenta,
  };
  const res = await enviarAutenticado({ metodo: 'POST', path: '/afip/perfil', cuerpoJson: cuerpo });
  if (res.ok) return { status: 'ok', ok: true };

  if (res.status === 404 || res.status === 501) return { status: 'no_disponible' };

  const body = await safeJson(res);
  if (res.status === 422) {
    const faltantes = faltantesDeDetail(detailCrudo(body));
    if (faltantes) throw new ErrorValidacionFiscal(faltantes);
  }
  return mapearErrorGenerico(res.status, body);
}

// ---------------------------------------------------------------------------
// Alta ante ARCA.
// ---------------------------------------------------------------------------

/**
 * `POST /afip/conectar` — Bearer requerido. 🔴 Ver el docstring del módulo para el tratamiento de
 * `claveFiscal`. 422 → `ErrorValidacionFiscal` (CUIT inválido / falta la clave fiscal, siempre string
 * suelto de este lado — `afip_web.py::conectar` nunca manda la forma array acá).
 */
export async function conectarArca(
  params: ConectarArcaRequest,
): Promise<ConDisponibilidad<ConectarArcaResponse>> {
  // 🔴 `claveFiscal` vive ÚNICAMENTE en este objeto, que se manda tal cual como cuerpoJson y se
  // descarta acto seguido. No se asigna a ninguna variable de módulo, no entra en el valor de retorno
  // (ver el `return` de abajo — no la incluye), y no se interpola en ningún mensaje de error.
  const cuerpo: Record<string, unknown> = { cuit: params.cuit, usuario: params.usuario, clave_fiscal: params.claveFiscal };
  if (params.ambiente) cuerpo.ambiente = params.ambiente; // ver la nota de divergencia en el tipo

  const res = await enviarAutenticado({ metodo: 'POST', path: '/afip/conectar', cuerpoJson: cuerpo });
  if (res.ok) {
    const raw = (await res.json()) as { ok: boolean; workflow_id: string; mensaje: string };
    return { status: 'ok', ok: raw.ok, workflowId: raw.workflow_id, mensaje: raw.mensaje };
  }

  if (res.status === 404 || res.status === 501) return { status: 'no_disponible' };

  const body = await safeJson(res);
  if (res.status === 422) {
    const faltantes = faltantesDeDetail(detailCrudo(body));
    if (faltantes) throw new ErrorValidacionFiscal(faltantes);
  }
  return mapearErrorGenerico(res.status, body);
}

/** `GET /afip/estado?cuit=` — Bearer requerido. Lo que Ajustes pinta. ⚠️ `cuit` se tipa opcional acá
 * (pedido §2 del plan de UI: descubrir el CUIT sin que el caller lo mande), pero `afip_web.py::estado`
 * hoy lo EXIGE (`cuit: str` sin default) — [ASSUMED_PENDING_VERIFY] mandar sin `cuit` da un 422 de
 * FastAPI, no `no_disponible`, hasta que el backend agregue el descubrimiento. */
export async function estadoAfip(cuit?: string): Promise<ConDisponibilidad<EstadoAfip>> {
  const query = cuit ? `?cuit=${encodeURIComponent(cuit)}` : '';
  try {
    const raw = await apiClient.get<{
      conectado: boolean;
      ws_autorizados: string[];
      perfil_completo: boolean;
      puede_facturar: boolean;
      onboarding: { paso: string; motivo: string | null; ws_autorizados: string[]; terminado: boolean; ok: boolean } | null;
      // ⚠️ Los tres de abajo todavía NO los manda el backend (pedidos §2 y §3, verificado contra el
      // servicio vivo el 2026-07-21). Se leen igual, opcionales: cuando los suba, esta función los
      // propaga sola y la pantalla de Ajustes sale del modo degradado sin tocar una línea de UI.
      // Sin esto, `estadoAfip` armaba un objeto literal con 5 claves fijas y los DESCARTABA en
      // silencio — el selector de ambiente habría quedado degradado para siempre, incluso con el
      // backend ya arreglado, y el síntoma ("no anda") no habría apuntado nunca acá.
      cuit?: string;
      ambiente?: AmbienteAfip;
      ambientes_vinculados?: AmbienteAfip[];
      /** Ver `EstadoAfip.driveConectado`: `null` significa "no se pudo averiguar", NO "desconectado". */
      drive_conectado?: boolean | null;
    }>(`/afip/estado${query}`);
    return {
      status: 'ok',
      cuit: raw.cuit,
      conectado: raw.conectado,
      wsAutorizados: raw.ws_autorizados,
      perfilCompleto: raw.perfil_completo,
      puedeFacturar: raw.puede_facturar,
      ambiente: raw.ambiente,
      ambientesVinculados: raw.ambientes_vinculados,
      driveConectado: raw.drive_conectado,
      onboarding: raw.onboarding
        ? {
            paso: raw.onboarding.paso as PasoOnboarding,
            motivo: raw.onboarding.motivo,
            wsAutorizados: raw.onboarding.ws_autorizados,
            terminado: raw.onboarding.terminado,
            ok: raw.onboarding.ok,
          }
        : null,
    };
  } catch (err) {
    if (esNoDisponible(err)) return { status: 'no_disponible' };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Facturación — la máquina de estados de UNA factura.
// ---------------------------------------------------------------------------

/** Shape crudo de `resultado` (`_emitir_sync` en `afip_factura_activities.py`) — compartido por
 * `EstadoFacturaResp.resultado` y `EstadoAnulacion.resultado` (la NC pasa por la misma activity
 * `emitir_comprobante`). `cae_vto` es opcional porque una de las 3 ramas del backend no lo manda. */
interface ResultadoEmisionRaw {
  ok: boolean;
  duplicado: boolean;
  cae: string;
  cae_vto?: string | null;
  nro: number;
  tipo_cbte: number;
  punto_venta: number;
  /** Opcional: el payload del workflow todavía no lo trae. Ver `ResultadoEmision.id`. */
  id?: number | null;
}

function normalizarResultadoEmision(raw: ResultadoEmisionRaw): ResultadoEmision {
  return {
    ok: raw.ok,
    duplicado: raw.duplicado,
    cae: raw.cae,
    caeVto: raw.cae_vto ?? null,
    nro: raw.nro,
    tipoCbte: raw.tipo_cbte,
    puntoVenta: raw.punto_venta,
    // `ausente ≠ 0`: sin id la card de éxito no ofrece cobrar. Ver `ResultadoEmision.id`.
    id: typeof raw.id === 'number' ? raw.id : null,
  };
}

interface EstadoFacturaRaw {
  estado: string;
  faltantes: Faltante[];
  items: { descripcion: string; cantidad: string; precio_unitario: string; subtotal: string }[];
  total: string;
  token_confirmacion: string | null;
  resultado: ResultadoEmisionRaw | null;
  pdf: { url: string; nombre: string; expira_at: string | null } | null;
  drive?: {
    guardado: boolean;
    file_id?: string | null;
    link?: string | null;
    compartido?: boolean;
    motivo?: string | null;
  } | null;
  receptor?: {
    condicion_iva: number;
    tipo_doc: number;
    nro_doc: string;
    nombre: string;
    domicilio: string;
  } | null;
  motivo: string | null;
  motivo_codigo?: string | null;
  terminado: boolean;
}

function normalizarEstadoFactura(raw: EstadoFacturaRaw): EstadoFacturaResp {
  return {
    estado: raw.estado,
    faltantes: raw.faltantes,
    items: raw.items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precio_unitario,
      subtotal: i.subtotal,
    })),
    total: raw.total,
    tokenConfirmacion: raw.token_confirmacion,
    resultado: raw.resultado ? normalizarResultadoEmision(raw.resultado) : null,
    pdf: raw.pdf ? { url: raw.pdf.url, nombre: raw.pdf.nombre, expiraAt: raw.pdf.expira_at } : null,
    // Se copia campo por campo y NO con un spread: si el backend agrega una clave, entra por acá
    // deliberadamente. Al revés —armar el objeto y olvidarse de una clave— ya costó un bug mudo
    // (`ambiente` y `ambientes_vinculados` descartados en `estadoAfip`, ver el docstring del módulo).
    drive: raw.drive
      ? {
          guardado: raw.drive.guardado,
          fileId: raw.drive.file_id ?? null,
          link: raw.drive.link ?? null,
          compartido: raw.drive.compartido ?? false,
          motivo: raw.drive.motivo ?? null,
        }
      : null,
    receptor: raw.receptor
      ? {
          condicionIva: raw.receptor.condicion_iva,
          tipoDoc: raw.receptor.tipo_doc,
          nroDoc: raw.receptor.nro_doc,
          nombre: raw.receptor.nombre,
          domicilio: raw.receptor.domicilio,
        }
      : null,
    motivo: raw.motivo,
    motivoCodigo: raw.motivo_codigo ?? null,
    terminado: raw.terminado,
  };
}

/** `POST /afip/facturas` — Bearer requerido. Abre un borrador durable; 503 (`iniciar_factura` no
 * inyectado) → `no_disponible`, mismo criterio que `anularComprobante`. */
export async function crearFactura(cuit: string): Promise<ConDisponibilidad<{ ok: true; facturaId: string }>> {
  try {
    const raw = await apiClient.post<{ ok: boolean; factura_id: string }>('/afip/facturas', { cuit });
    return { status: 'ok', ok: true, facturaId: raw.factura_id };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) throw new SinCertificadoError(err.detail);
    if (esNoDisponible(err, true)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * `POST /afip/facturas` devolvió 409: el tenant no tiene certificado de ARCA vinculado.
 *
 * 🔴 **La UI NUNCA debe mostrar esto como un rechazo fiscal.** Antes del 2026-07-21 este caso abría un
 * workflow que nacía muerto (`{estado:"rechazada", terminado:true, motivo:"sin_certificado_afip"}` en el
 * primer poll — medido contra el backend vivo), y un usuario nuevo leía **"rechazada"**, que en este
 * dominio significa *"AFIP te rechazó la factura"* y no *"todavía no configuraste nada"*. A pedido de
 * esta capa el backend lo convirtió en un 409 antes de abrir nada.
 *
 * El camino correcto sigue siendo NO llegar hasta acá: la pantalla chequea `puedeFacturar` de
 * `estadoAfip` antes de crear el borrador. Este error es la red de atrás, no el mecanismo.
 */
export class SinCertificadoError extends ApiError {
  constructor(detail?: string) {
    super(409, detail ?? 'Todavía no vinculaste tu cuenta de ARCA.', detail);
    this.name = 'SinCertificadoError';
  }
}

/**
 * `POST /afip/ambiente` — cambia el ambiente ACTIVO entre credenciales **ya vinculadas**.
 *
 * No es un re-alta: homologación y producción son WSAA distintos, así que el backend guarda una
 * credencial POR ambiente y las dos conviven para el mismo CUIT. Cambiar entre las que ya existen es
 * instantáneo.
 *
 * 🔴 El 409 `ambiente_no_vinculado` **no es un error a mostrar como falla**: es el caso donde la UI
 * tiene que ofrecer el alta para ESE ambiente (una vez por ambiente, no una vez por cambio).
 */
export async function cambiarAmbiente(
  cuit: string,
  ambiente: AmbienteAfip,
): Promise<{ ok: true } | { ok: false; ambienteNoVinculado: AmbienteAfip; mensaje: string }> {
  try {
    await apiClient.post<{ ok: boolean }>('/afip/ambiente', { cuit, ambiente });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return {
        ok: false,
        ambienteNoVinculado: ambiente,
        mensaje: err.detail ?? `Todavía no vinculaste tu cuenta de ARCA en ${ambiente === 'prod' ? 'producción' : 'homologación'}.`,
      };
    }
    throw err;
  }
}

/**
 * `POST /afip/ajustes` — prende/apaga el archivado de las facturas en el Drive del emprendedor.
 *
 * 🔴 **El 409 vuelve como VALOR, no como excepción**, y significa algo muy concreto: *ese CUIT
 * todavía no tiene perfil fiscal*. Existe porque sin él el bug sería mudo — un `UPDATE` sobre cero
 * filas "funciona" en SQL, así que el toggle quedaría prendido en pantalla y la base sin nada
 * guardado. La UI tiene que traducirlo a "primero completá tus datos fiscales", nunca a un error
 * genérico: es una instrucción, no una falla.
 *
 * Mismo criterio que `cambiarAmbiente`: un caso esperado del producto no se modela como excepción.
 */
export async function guardarAjustesAfip(
  cuit: string,
  guardarEnDrive: boolean,
): Promise<{ ok: true; guardarEnDrive: boolean } | { ok: false; sinPerfil: true; mensaje: string }> {
  try {
    const raw = await apiClient.post<{ ok: boolean; guardar_en_drive: boolean }>('/afip/ajustes', {
      cuit,
      guardar_en_drive: guardarEnDrive,
    });
    return { ok: true, guardarEnDrive: raw.guardar_en_drive };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return {
        ok: false,
        sinPerfil: true,
        mensaje: err.detail ?? 'Todavía no cargaste tus datos fiscales para ese CUIT.',
      };
    }
    throw err;
  }
}

/** `GET /afip/facturas/{id}` — Bearer requerido. Tiene id dinámico: un 404 acá es "factura no
 * encontrada" (`afip_web.py::estado_factura`), un caso REAL que no se colapsa en `no_disponible` — ver
 * el docstring del módulo. Sube como `ApiError` tal cual. */
export async function estadoFactura(facturaId: string): Promise<EstadoFacturaResp> {
  const raw = await apiClient.get<EstadoFacturaRaw>(`/afip/facturas/${encodeURIComponent(facturaId)}`);
  return normalizarEstadoFactura(raw);
}

/** `POST /afip/facturas/{id}/datos-venta` — manda el signal `cargar_datos_venta`. El backend no lanza
 * 4xx si algo es inválido: deja `motivo` en el siguiente `estadoFactura()` — releer después de mandar. */
export async function setDatosVenta(facturaId: string, datos: DatosVentaInput): Promise<{ ok: true }> {
  const cuerpo = {
    fecha: datos.fecha,
    concepto: datos.concepto,
    condicion_venta: datos.condicionVenta,
    fecha_servicio_desde: datos.fechaServicioDesde ?? undefined,
    fecha_servicio_hasta: datos.fechaServicioHasta ?? undefined,
    fecha_vto_pago: datos.fechaVtoPago ?? undefined,
  };
  return apiClient.post<{ ok: true }>(`/afip/facturas/${encodeURIComponent(facturaId)}/datos-venta`, cuerpo);
}

/** `POST /afip/facturas/{id}/items` — signal `agregar_item`. Sin `subtotal`: lo calcula el backend. */
export async function agregarItem(facturaId: string, item: NuevoItem): Promise<{ ok: true }> {
  const cuerpo = {
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precioUnitario,
    codigo: item.codigo ?? '',
  };
  return apiClient.post<{ ok: true }>(`/afip/facturas/${encodeURIComponent(facturaId)}/items`, cuerpo);
}

/** `DELETE /afip/facturas/{id}/items/{indice}` — signal `quitar_item`. Sin body: el índice viaja en el
 * path (único uso de `apiClient.del` en el core hoy, junto con éste). */
export async function quitarItem(facturaId: string, indice: number): Promise<{ ok: true }> {
  return apiClient.del<{ ok: true }>(`/afip/facturas/${encodeURIComponent(facturaId)}/items/${indice}`);
}

/** `POST /afip/facturas/{id}/cliente` — signal `cargar_cliente`. */
export async function setCliente(facturaId: string, receptor: ReceptorInput): Promise<{ ok: true }> {
  const cuerpo = {
    condicion_iva: receptor.condicionIva,
    tipo_doc: receptor.tipoDoc,
    nro_doc: receptor.nroDoc,
    nombre: receptor.nombre,
    domicilio: receptor.domicilio,
  };
  return apiClient.post<{ ok: true }>(`/afip/facturas/${encodeURIComponent(facturaId)}/cliente`, cuerpo);
}

/**
 * `POST /afip/facturas/{id}/confirmar` — gate HITL. Preferir `confirmarConTokenFresco` desde la UI:
 * éste es el primitivo de bajo nivel que no releva el token.
 *
 * ⚠️ **Desde 2026-07-28 esto puede fallar con 409, y ese 409 es la respuesta útil.** Antes iba por
 * signal (fire-and-forget) y contestaba `200 {"ok": true}` aunque el token estuviera vencido y no se
 * emitiera nada — el único modo de enterarse era releer el estado. Ahora va por Workflow Update: si
 * la confirmación no se tomó, el backend contesta **409** con `{motivo, motivo_codigo}` en `detail`.
 */
export async function confirmarFactura(
  facturaId: string,
  token: string,
): Promise<{ ok: true; aceptado?: boolean }> {
  return apiClient.post<{ ok: true; aceptado?: boolean }>(
    `/afip/facturas/${encodeURIComponent(facturaId)}/confirmar`, { token });
}

/**
 * Extrae el motivo de un 409 `confirmacion_no_tomada`, o `null` si el error es otra cosa — y "otra
 * cosa" hay que repropagarla, no traducirla a "revisá el resumen".
 *
 * Discrimina por `codigo`, no por forma: es la misma máquina que ya usan `presupuestos.ts` y
 * `perfilNegocio.ts` (`errores_web.CODIGOS` del lado del backend valida el código al construir el
 * error). Mantiene el fallback por status para el caso que documenta `codigoDeConflicto`: un deploy
 * viejo del backend que todavía no mande el código.
 */
function motivoDeRechazo(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const codigo = codigoDeConflicto(error.body);
  if (codigo !== null && codigo !== 'confirmacion_no_tomada') return null;   // otro conflicto: no es lo nuestro
  return mensajeDeConflicto(error.body) ?? 'los datos cambiaron, revisá el resumen antes de confirmar';
}

/** `POST /afip/facturas/{id}/cancelar` — signal `cancelar`. Sin vuelta atrás: el workflow termina en
 * `cancelada`, un estado TERMINAL (`ESTADOS_TERMINALES` en `afip_rules.py`). */
export async function cancelarFactura(facturaId: string): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`/afip/facturas/${encodeURIComponent(facturaId)}/cancelar`);
}

// ---------------------------------------------------------------------------
// Comprobantes ("Mis facturas") + anulación.
// ---------------------------------------------------------------------------

interface ComprobanteRaw {
  /** Ausente en las consultas que alimentan Temporal — ver `Comprobante.id`. */
  id?: number;
  cuit: string;
  tipo_cbte: number;
  punto_venta: number;
  nro: number;
  cae: string;
  cae_vto: string | null;
  fecha_emision: string | null;
  total: string;
  estado: string;
  pdf_url: string | null;
  cbte_asoc_nro: number | null;
  /** Copia permanente en el Drive del emprendedor. `null` si no se archivó (ajuste apagado, Drive sin
   *  conectar, o la factura no tuvo PDF que guardar). */
  drive_file_id: string | null;
  drive_link: string | null;
  /** A quién se le facturó. `null` en los comprobantes anteriores al 2026-07-21: el dato no existía
   *  entonces, no es un error — la UI tiene que tolerar el vacío sin romper. */
  receptor_nombre: string | null;
  doc_tipo: number | null;
  doc_nro: string | null;
}

function normalizarComprobante(raw: ComprobanteRaw): Comprobante {
  return {
    id: raw.id,
    cuit: raw.cuit,
    tipoCbte: raw.tipo_cbte,
    puntoVenta: raw.punto_venta,
    nro: raw.nro,
    cae: raw.cae,
    caeVto: raw.cae_vto,
    fechaEmision: raw.fecha_emision,
    total: raw.total,
    estado: raw.estado,
    pdfUrl: raw.pdf_url,
    cbteAsocNro: raw.cbte_asoc_nro,
    driveFileId: raw.drive_file_id ?? null,
    driveLink: raw.drive_link ?? null,
    receptorNombre: raw.receptor_nombre ?? null,
    docTipo: raw.doc_tipo ?? null,
    docNro: raw.doc_nro ?? null,
  };
}

/** `GET /afip/comprobantes?cuit=&limite=` — Bearer requerido. ⚠️ `pdfUrl` expira a las 24 h de
 * emitida y NO se re-hostea (decisión del operador) — la UI tiene que avisarlo, no reintentar en
 * silencio. Si el backend no tiene `comprobante_store_factory` inyectado devuelve `{comprobantes:[]}`
 * con 200 (no un error) — eso NO es `no_disponible`, es "todavía no facturaste nada" indistinguible a
 * propósito del lado del backend; `no_disponible` acá sólo cubre la ruta sin montar. */
export async function listarComprobantes(cuit: string, limite = 50): Promise<ConDisponibilidad<{ comprobantes: Comprobante[] }>> {
  const query = new URLSearchParams({ cuit, limite: String(limite) });
  try {
    const raw = await apiClient.get<{ comprobantes: ComprobanteRaw[] }>(`/afip/comprobantes?${query.toString()}`);
    return { status: 'ok', comprobantes: raw.comprobantes.map(normalizarComprobante) };
  } catch (err) {
    if (esNoDisponible(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/**
 * `GET /afip/comprobantes/{id}` — un comprobante por su id de FILA.
 *
 * Es la puerta que permite abrir una factura desde la lista de actividad: hasta el 2026-07-22 el
 * detalle sólo se abría pasando el objeto entero, así que **nada externo podía direccionar una
 * factura**. `no_encontrado` cubre el 404 semántico — no existe, **o es de otro tenant** (el backend
 * no confirma recursos ajenos y tiene test adversarial).
 */
/**
 * El comprobante de un detalle, venga **pelado** o envuelto.
 *
 * ✅ **MEDIDO el 2026-07-22 leyendo el handler** (`afip_web.py:275`, `return fila`): viene **PELADO**.
 * Yo exigía `{comprobante: …}` y por eso el detalle **no abría nunca**.
 *
 * 🔴 **Y lo que importa del bug es cómo se veía.** El `GET` daba `200`, el id viajaba bien, y la app
 * simplemente no mostraba nada — así que en el device se leyó como *«falta resaltar la fila»*: una
 * explicación razonable, que encaja con lo observado, y falsa. Es el mismo patrón que el `409` de
 * clientes: **un supuesto de forma que falla pareciendo una función a medio hacer**. Nada grita.
 *
 * Por eso acepta las dos formas: la regla del sistema —*un `GET` de ficha devuelve secciones*— vale
 * para `/clientes/{id}`, y acá el mismo verbo devuelve el recurso pelado. Mientras no haya una sola
 * regla, tolerar es más barato que acertar.
 */
function comprobanteDeLaRespuesta(raw: unknown): ComprobanteRaw | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const envuelto = (raw as { comprobante?: unknown }).comprobante;
  const candidato = (typeof envuelto === 'object' && envuelto !== null ? envuelto : raw) as ComprobanteRaw;
  // El control de que esto es un comprobante y no otra cosa (el HTML del SPA, un `{detail}`): sin
  // `tipo_cbte` no hay nada que pintar.
  return candidato.tipo_cbte != null ? candidato : null;
}

export async function obtenerComprobante(
  id: number,
): Promise<ConDisponibilidad<{ comprobante: Comprobante }> | { status: 'no_encontrado' }> {
  try {
    const raw = await apiClient.get<unknown>(`/afip/comprobantes/${id}`);
    const fila = comprobanteDeLaRespuesta(raw);
    if (fila == null) return { status: 'no_disponible' };
    return { status: 'ok', comprobante: normalizarComprobante(fila) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'no_encontrado' };
    if (esNoDisponible(err)) return { status: 'no_disponible' };
    throw err;
  }
}

/** `POST /afip/comprobantes/anular` — Bearer requerido. Arranca la nota de crédito que neutraliza la
 * factura (NO es un borrado — ver `AnulacionWorkflow`). 503 → `no_disponible`, mismo criterio que
 * `crearFactura`. */
export async function anularComprobante(
  params: AnularComprobanteRequest,
): Promise<ConDisponibilidad<{ ok: true; anulacionId: string }>> {
  const cuerpo = { cuit: params.cuit, tipo_cbte: params.tipoCbte, punto_venta: params.puntoVenta, nro: params.nro };
  try {
    const raw = await apiClient.post<{ ok: boolean; anulacion_id: string }>('/afip/comprobantes/anular', cuerpo);
    return { status: 'ok', ok: true, anulacionId: raw.anulacion_id };
  } catch (err) {
    if (esNoDisponible(err, true)) return { status: 'no_disponible' };
    throw err;
  }
}

/** `GET /afip/anulaciones/{id}` — Bearer requerido. Id dinámico: un 404 es "anulación no encontrada"
 * real (`afip_web.py::estado_anulacion`), sube como `ApiError` — mismo criterio que `estadoFactura`. */
export async function estadoAnulacion(anulacionId: string): Promise<EstadoAnulacion> {
  const raw = await apiClient.get<{
    paso: string;
    original: ComprobanteRaw | null;
    errores: Faltante[];
    resultado: ResultadoEmisionRaw | null;
    motivo: string | null;
    terminado: boolean;
    marcada?: boolean;
  }>(`/afip/anulaciones/${encodeURIComponent(anulacionId)}`);
  return {
    paso: raw.paso,
    original: raw.original ? normalizarComprobante(raw.original) : null,
    errores: raw.errores,
    resultado: raw.resultado ? normalizarResultadoEmision(raw.resultado) : null,
    motivo: raw.motivo,
    // `?? true` porque el campo es nuevo: una anulación anterior al cambio no lo trae, y en esas el
    // marcado sí había ocurrido (si fallaba, el workflow moría antes de contestar). Default `false`
    // pintaría de advertencia todas las anulaciones viejas.
    marcada: raw.marcada ?? true,
    // Sin `motivoCodigo`: el backend documentó `motivo_codigo` para `FacturaWorkflow.estado()`, NO
    // para la anulación (`2026-07-21_respuesta2_backend-a-frontend-afip.md` §4). Agregarlo acá "por
    // simetría" sería inventar un campo del contrato y dejar a la UI ramificando sobre `null`
    // permanente, que es peor que no tenerlo: parece que funciona.
    terminado: raw.terminado,
  };
}

/** `POST /afip/anulaciones/{id}/confirmar` — mismo gate HITL que facturar (`AnulacionWorkflow`:
 * "anular es tan irreversible como facturar") y el mismo contrato: **409 con `{motivo, motivo_codigo}`
 * si la confirmación no se tomó** (por ejemplo, si la validación ya dejó la anulación en `fallida`). */
export async function confirmarAnulacion(anulacionId: string): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`/afip/anulaciones/${encodeURIComponent(anulacionId)}/confirmar`);
}

// ---------------------------------------------------------------------------
// Helpers que resuelven trampas del contrato — viven ACÁ, no en la UI (ver el plan de UI §3).
// ---------------------------------------------------------------------------

const BACKOFF_MS = [50, 100, 200, 400, 800];

function dormir(ms: number): Promise<void> {
  // `setTimeout(resolve, ms)` a secas no tipa contra la firma ambiental de `globals.d.ts`
  // (`(...args: unknown[]) => void`) — mismo ajuste que `api/mock.ts`.
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

function tienePerfilAusente(estado: EstadoFacturaResp): boolean {
  return estado.faltantes.some((f) => f.codigo === 'perfil_ausente');
}

export interface EsperarEstadoEstableOpts {
  /** Tope total del backoff, en ms. Default 3000. */
  topeMs?: number;
}

export interface EsperarEstadoEstableResultado {
  estado: EstadoFacturaResp;
  /** `false` = se agotó el tope sin que `perfil_ausente` desapareciera — el caller muestra el error
   * REAL en vez de girar para siempre. Nunca se lanza una excepción por esto. */
  convergio: boolean;
}

/**
 * Repolea `estadoFactura` con backoff (50/100/200/400/800 ms, repite el último tramo si el tope no se
 * agotó) hasta que `faltantes` deje de traer `perfil_ausente` — el primer estado tras `crearFactura`
 * puede traerlo mientras el workflow todavía está cargando el contexto (`afip_web.py::estado_factura`,
 * "típicamente <1s"). Vive en el core porque es una propiedad del CONTRATO, no de una pantalla: la
 * próxima pantalla que cree facturas hereda el arreglo sin repetirlo.
 *
 * **Corte honesto:** si a los `topeMs` (default 3000) sigue con `perfil_ausente`, devuelve el último
 * estado leído con `convergio:false`. Nunca gira para siempre, nunca lanza por esto — un `estadoFactura`
 * que sí falla (red, 404 real) SÍ se propaga, porque esa es una falla distinta de "no convergió".
 */
export async function esperarEstadoEstable(
  facturaId: string,
  opts: EsperarEstadoEstableOpts = {},
): Promise<EsperarEstadoEstableResultado> {
  const { topeMs = 3000 } = opts;
  let transcurrido = 0;
  let intento = 0;
  let estado = await estadoFactura(facturaId);

  while (tienePerfilAusente(estado) && transcurrido < topeMs) {
    const espera = BACKOFF_MS[Math.min(intento, BACKOFF_MS.length - 1)]!;
    await dormir(espera);
    transcurrido += espera;
    intento += 1;
    estado = await estadoFactura(facturaId);
  }

  return { estado, convergio: !tienePerfilAusente(estado) };
}

/**
 * Firma de lo que un signal puede cambiar: el estado de la máquina, los ítems y el total. Se compara
 * esto y no sólo `estado` porque hay signals que NO mueven el estado — agregar un segundo ítem deja
 * `items_ok` igual pero cambia la lista. Sin mirar los ítems, esos casos esperarían el tope entero.
 */
function firmaDeEstado(e: EstadoFacturaResp): string {
  return `${e.estado}|${e.items.length}|${e.total}|${e.faltantes.length}|${e.tokenConfirmacion ?? ''}`;
}

export interface EcoDelSignalResultado {
  estado: EstadoFacturaResp;
  /** `false` = se agotó el tope sin que nada cambiara. El caller decide qué hacer; nunca se lanza. */
  cambio: boolean;
}

/**
 * Espera el ECO de un signal: repolea hasta que el estado deje de ser el que era antes de mandarlo.
 *
 * 🔴 **Por qué hace falta, y por qué no alcanza con leer una vez.** `POST /afip/facturas/{id}/…` no
 * ejecuta nada: manda un **signal** a Temporal y devuelve 200 al instante. El workflow lo procesa
 * después — típicamente en decenas de ms, a veces más. Leer el estado inmediatamente después del POST
 * es una carrera: si se pierde, se lee el estado ANTERIOR y, sin reintento, **la pantalla se queda
 * congelada sobre un backend que sí avanzó.**
 *
 * Cazado en device el 2026-07-21: el usuario cargaba los datos de venta, tocaba "Continuar", el
 * backend pasaba a `datos_venta_ok` (verificado por HTTP) y la pantalla seguía mostrando el paso 1.
 * Sin error, sin spinner: sólo un botón que parecía no hacer nada. Peor todavía, es INTERMITENTE —
 * cuando el signal se procesa rápido, funciona, y el bug parece no existir.
 *
 * Es la misma forma que `esperarEstadoEstable` (que espera otra cosa: que aparezca el perfil) y la
 * misma que el bug del PDF que llega después del CAE: **un dato que se completa en dos tiempos, leído
 * por alguien que asume uno solo.**
 *
 * **Corte honesto:** si a los `topeMs` (default 3000) nada cambió, devuelve el último estado leído
 * con `cambio:false`. Un signal puede legítimamente no cambiar nada, así que esto no es un error —
 * pero el caller se entera en vez de creer que sí pasó algo.
 */
export async function esperarEcoDelSignal(
  facturaId: string,
  estadoPrevio: EstadoFacturaResp | null,
  opts: EsperarEstadoEstableOpts = {},
): Promise<EcoDelSignalResultado> {
  const { topeMs = 3000 } = opts;
  const firmaPrevia = estadoPrevio ? firmaDeEstado(estadoPrevio) : null;
  let transcurrido = 0;
  let intento = 0;
  let estado = await estadoFactura(facturaId);

  // Sin estado previo no hay con qué comparar: la primera lectura ES el resultado.
  while (firmaPrevia !== null && firmaDeEstado(estado) === firmaPrevia && transcurrido < topeMs) {
    const espera = BACKOFF_MS[Math.min(intento, BACKOFF_MS.length - 1)]!;
    await dormir(espera);
    transcurrido += espera;
    intento += 1;
    estado = await estadoFactura(facturaId);
  }

  return { estado, cambio: firmaPrevia === null || firmaDeEstado(estado) !== firmaPrevia };
}

export interface ConfirmarResultado {
  emitida: boolean;
  /** Presente cuando `emitida:false` — por qué no se pudo. */
  motivo?: string;
  /** El estado releído después del intento (o antes, si nunca se llegó a confirmar). */
  estado?: EstadoFacturaResp;
}

/**
 * Confirma con el `tokenConfirmacion` FRESCO (lo relee del estado, nunca uno que la UI tenía guardado)
 * y VERIFICA el resultado releyendo de nuevo. Si el borrador cambió después de que la UI leyó el
 * token, la confirmación NO se toma (fail-closed de `FacturaWorkflow.confirmar`) y el backend lo dice
 * con un **409**. La relectura posterior se mantiene igual: cubre el caso en que la confirmación se
 * tomó pero la emisión no prosperó, que el 409 no reporta porque ocurre después.
 *
 * Si `tokenConfirmacion` es `null` (la factura no llegó a `esperando_confirmacion`), NO llama al
 * backend — no tiene sentido mandar un `confirmar` que el signal va a rechazar igual.
 */
export async function confirmarConTokenFresco(facturaId: string): Promise<ConfirmarResultado> {
  const previo = await estadoFactura(facturaId);
  if (!previo.tokenConfirmacion) {
    return { emitida: false, motivo: 'la factura no está lista para emitir', estado: previo };
  }

  try {
    await confirmarFactura(facturaId, previo.tokenConfirmacion);
  } catch (error) {
    const motivo = motivoDeRechazo(error);
    if (motivo === null) throw error;   // 401, 503, red: no es "no se tomó", es un fallo real
    // El backend ya nos dijo POR QUÉ no se tomó. Se relee igual el estado para devolverlo: la UI lo
    // usa para repintar el resumen actualizado, que es lo que el usuario tiene que volver a mirar.
    return { emitida: false, motivo, estado: await estadoFactura(facturaId) };
  }
  const posterior = await estadoFactura(facturaId);

  if (posterior.estado === 'esperando_confirmacion') {
    // No-op silencioso del backend: el token ya no correspondía a los datos actuales.
    return {
      emitida: false,
      motivo: posterior.motivo ?? 'los datos cambiaron, revisá el resumen antes de confirmar',
      estado: posterior,
    };
  }

  return { emitida: true, estado: posterior };
}
