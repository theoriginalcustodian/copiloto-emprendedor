/**
 * Barrel de la capa API compartida — lógica de transporte sin plataforma. Cada plataforma (web,
 * React Native) inyecta su `HttpPort`/`AlmacenTokens` vía `configurarApi` (ver `config.ts`) y decide
 * ella misma real-vs-mock (`apiReal`/`mockApi`) — el core NO decide eso acá.
 *
 * 🔴 **`sendConsultaAudio`/`sendNotaAudio`/`uploadDocumento`/`reconciliarAudio` NO se portaron.**
 * Vivían en `clinical.ts` en el proyecto de origen (endpoints clínicos: consulta diarizada, dictado
 * de nota clínica, ingesta documental, autorización de purga de audio) — el manifest de puertos
 * móviles los clasificó `descartar`. `CopilotApi` (`types.ts`) ya NO declara esos tres métodos.
 */
import { sendAudio } from './audio';
import { login, loginWithGoogleIdToken } from './auth';
import { sendChat } from './chat';
import { sendFoto } from './foto';
import { me } from './me';
import { mockApi } from './mock';
import { ensureOauthTenant } from './oauth';
import { getReply } from './reply';
import type { CopilotApi } from './types';
import { warm } from './warm';

export const apiReal: CopilotApi = {
  login,
  loginWithGoogleIdToken,
  ensureOauthTenant,
  me,
  sendChat,
  sendAudio,
  sendFoto,
  getReply,
  warm,
};

export { mockApi };

// Aviso de sesión muerta (CTA5): la app se suscribe y lleva al login con un mensaje en castellano,
// en vez de mostrar el `detail` crudo del backend en la pantalla donde el usuario estaba.
export { alExpirarSesion } from './sesion';

// Inyección de plataforma (HttpPort/AlmacenTokens) — ver `config.ts`.
export { configurarApi, config } from './config';
export type { ConfigApi } from './config';

// Puertos — los tipos que cada plataforma implementa.
export type { ArchivoSubida, HttpPort, PeticionHttp, RespuestaHttp } from './http';
export { TIMEOUT_HTTP_MS } from './http';
export type { AlmacenTokens } from './tokens';

// Errores.
// ⚠️ `DuplicadoProbableError`, `GeneroInvalidoError` y `MotivoDuplicado` se exportaban acá y se
// BORRARON el 2026-07-22: eran de la app clínica y describían un `409` de `POST /clientes` con otro
// significado que el de este producto. Ver el epitafio en `errors.ts`.
export { ApiError, ForbiddenError, UnauthorizedError, codigoDeConflicto, mensajeDeConflicto, esDiferido } from './errors';
// Todo `409` del backend trae `codigo` desde el 2026-07-22 (`errores_web.CODIGOS`). Es lo que permite
// reconocer cada caso por algo que TRAE, en vez de por lo que le falta — ver el docstring allá.
export type { CodigoConflicto } from './errors';

// Contratos de request/response.
export * from './types';

// `/nota/formatos` — el catálogo de tipos de nota. Superficie aparte, sin equivalente en
// `CopilotApi`/`mockApi`.
export { obtenerFormatosNota } from './formatos';

// La enmienda. `listarEntradasCorregibles` trae SÓLO la punta de cada cadena (lo filtra el
// backend); `previewEnmienda` dice qué se va a INVALIDAR antes de firmar, sin escribir nada.
export { listarEntradasCorregibles, previewEnmienda } from './enmienda';

// `/catalog` + `/composio/connect` — las integraciones y su vinculación. El catálogo lo decide el
// BACKEND (policy real de toolkits), no una lista en el cliente: ver el docstring de `catalogo.ts`.
export { desconectarServicio, listarCatalogo, pedirLinkDeVinculacion } from './catalogo';
export type { ServicioCatalogo } from './catalogo';

// `/perfil-negocio` — qué vende el emprendedor y cómo quiere que le hable el copiloto. `perfil: null`
// NO es un error: es el estado normal del primer día. Ver el docstring de `perfilNegocio.ts`.
export { guardarPerfilNegocio, leerPerfilNegocio, LIMITE_CAMPO_CORTO, LIMITE_QUE_VENDE } from './perfilNegocio';
export type {
  AQuienVende,
  FormalidadCopiloto,
  GuardarPerfilNegocioRequest,
  LargoRespuesta,
  ModoCeremonia,
  PerfilNegocio,
  ResultadoGuardarPerfil,
  ResultadoPerfilNegocio,
} from './perfilNegocio';

// `/presupuestos` — alta, listado, detalle y el atajo a facturar. Los montos viajan como STRING
// (plata: el float pierde precisión) y el `total` lo calcula el backend. Ver `presupuestos.ts`.
export {
  cambiarEstadoPresupuesto,
  crearPresupuesto,
  facturarPresupuesto,
  listarPresupuestos,
  obtenerPresupuesto,
} from './presupuestos';
export type {
  CrearPresupuestoRequest,
  EstadoPresupuesto,
  ItemPresupuesto,
  ListarPresupuestosParams,
  NuevoItemPresupuesto,
  Presupuesto,
  ReceptorPresupuesto,
  ResultadoFacturar,
} from './presupuestos';

// `/gastos` — lo que sale: alta, listado, detalle y el resumen del mes. Mismo criterio de plata que
// presupuestos (STRING, nunca `Number`) y **la fecha la pone el backend en hora de Argentina**: ver
// el docstring de `gastos.ts` por qué omitir `fecha` importa. Sin `PATCH`/`DELETE` en Fase 1.
export {
  CATEGORIAS_GASTO,
  crearGasto,
  esCategoriaValida,
  ETIQUETA_CATEGORIA,
  listarGastos,
  obtenerGasto,
  obtenerResumenGastos,
} from './gastos';
export type {
  CategoriaGasto,
  CategoriaResumen,
  CrearGastoRequest,
  Gasto,
  ListarGastosParams,
  OrigenGasto,
  ResumenGastos,
} from './gastos';

// `/contabilidad/resumen` — caja y facturación, dos preguntas separadas (§2 del contrato). El endpoint
// todavía no existe: ver el docstring de `contabilidad.ts` para el estado de `[ASSUMED_PENDING_VERIFY]`.
export { obtenerResumenContabilidad } from './contabilidad';
export type {
  CajaMesAnterior,
  CategoriaResumenContabilidad,
  ClienteRanking,
  ResumenCaja,
  ResumenContabilidad,
  ResumenFacturado,
  ResumenGastosContabilidad,
  TopeMonotributo,
} from './contabilidad';

// `/clientes` — la cartera, DERIVADA de lo ya emitido. ⚠️ Archivo NUEVO: el anterior (cliente HTTP
// de la app clínica, apuntando a un backend que nunca existió acá) se borró en `8761d54`.
// `crearCliente`/`editarCliente` (hito 7) ya están MEDIDOS contra el vivo: el hito 3 se desplegó el
// 2026-07-22 (sonda propia: `POST /clientes` → 401 con token ausente, y una ruta inexistente → 405).
// La respuesta viene PELADA y el 409 trae la FICHA ENTERA del dueño bajo `cliente` — no un id, que
// era lo que yo había supuesto leyendo §3.4. Ver el detalle en `clientes.ts`.
export { listarClientes, obtenerCliente, crearCliente, editarCliente, cambiosDeCliente } from './clientes';
export type {
  Cliente,
  DatosCliente,
  DuplicadoCliente,
  FichaCliente,
  ListarClientesParams,
  MotivoDuplicadoCliente,
  OpcionesGuardarCliente,
  OperacionCliente,
  OrigenCliente,
  ResultadoGuardarCliente,
} from './clientes';

// `/actividad` — lo que el emprendedor HIZO, cruzando las tablas de negocio (facturas, presupuestos,
// gastos, clientes). ⚠️ Reescrito el 2026-07-22: el anterior modelaba "entradas firmadas" del proyecto
// clínico. `signo`/`titulo`/`detalle` los arma el backend — la app no compone texto de negocio ni
// deduce el color del tipo. El cursor es un token OPACO: se manda tal cual vía `URLSearchParams`.
export { listarActividad } from './actividad';
export type { ActividadItem, ActividadResult, ListarActividadParams, SignoActividad } from './actividad';

// Transporte de bajo nivel — necesario para que el adaptador de plataforma pueda montar su propio
// wrapper de tests de integración (para que sus tests sigan mockeando `fetch` directo, no el puerto).
export { apiClient, postMultipart } from './client';

// `/afip/*` — facturación AFIP/ARCA (F5 perfil fiscal + alta ARCA, F6 emisión/comprobantes). Mismo
// criterio que `/actividad`: superficie aparte, sin equivalente en `CopilotApi`/`mockApi`. Ver el
// docstring de `afip.ts` para por qué `no_disponible` sólo cubre las rutas SIN segmento dinámico.
export {
  agregarItem,
  anularComprobante,
  cambiarAmbiente,
  cancelarFactura,
  conectarArca,
  confirmarAnulacion,
  confirmarConTokenFresco,
  confirmarFactura,
  crearFactura,
  estadoAfip,
  estadoAnulacion,
  estadoFactura,
  ErrorValidacionFiscal,
  esperarEcoDelSignal,
  esperarEstadoEstable,
  guardarAjustesAfip,
  guardarPerfil,
  leerPerfil,
  listarComprobantes,
  obtenerComprobante,
  quitarItem,
  setCliente,
  setDatosVenta,
  SinCertificadoError,
} from './afip';
export type {
  AmbienteAfip,
  AnularComprobanteRequest,
  ArchivoDrive,
  Comprobante,
  ConDisponibilidad,
  ConectarArcaRequest,
  ConectarArcaResponse,
  CondicionIvaEmisor,
  ConfirmarResultado,
  DatosVentaInput,
  EcoDelSignalResultado,
  EsperarEstadoEstableOpts,
  EsperarEstadoEstableResultado,
  EstadoAfip,
  EstadoAnulacion,
  EstadoComprobante,
  EstadoFactura,
  EstadoFacturaResp,
  Faltante,
  GuardarPerfilRequest,
  ItemFactura,
  MotivoCodigo,
  NuevoItem,
  OnboardingProgreso,
  PasoAnulacion,
  PasoOnboarding,
  PerfilFiscal,
  ReceptorInput,
  ResultadoEmision,
} from './afip';

/**
 * Cobros de comprobantes (hito 3 del sprint de Inteligencia de Negocio) — lo que permite responder
 * *«¿quién me debe?»*. Forma declarada por backend ANTES de implementar; al exportarse, los endpoints
 * todavía no estaban vivos y el cliente degrada a `no_disponible`.
 */
export { registrarCobro, borrarCobro, listarCobros, listarImpagos } from './cobros';
/**
 * `/ingresos` — TODO lo que entró (facturas cobradas, MercadoPago, y lo dictado), distinguible por
 * `origen`. ⚠️ Se llamaba `POST /cobros` y **no hay alias**. Lo único obligatorio es el monto: la app
 * no puede exigir más. El 409 de duplicado es una PREGUNTA con su candidato, no un error.
 */
export { borrarIngreso, completarIngreso, listarIngresos, registrarIngreso } from './ingresos';
export type {
  FaltanteIngreso,
  Ingreso,
  OrigenIngreso,
  RegistrarIngresoRequest,
  ResultadoIngreso,
} from './ingresos';
/**
 * `/mi-dia/*` — el tablero del detector proactivo (hito 7): 3 solapas (para_hoy/haciendo/hecha, forma
 * CONFIRMADA por backend PR#96) pobladas por las reglas determinísticas del contrato, más las 3
 * mutaciones manuales (crear/cambiar estado/borrar). **[CONNECT]** — endpoint todavía no vivo (PR#96
 * con CI corriendo); degrada a `no_disponible`. Ver el docstring.
 */
export { IDS_SOLAPA, borrarTarjetaMiDia, cambiarEstadoTarjetaMiDia, crearTarjetaMiDia, leerTablero } from './miDia';
export type {
  IdSolapa,
  SolapaMiDia,
  TableroMiDia,
  TarjetaMiDia,
} from './miDia';
/**
 * `/inteligencia/portada` — el resumen del negocio (caja, mes, serie, mejores clientes, por cobrar).
 * **[CONNECT]** — construido contra el contrato §3.1, el endpoint todavía NO está publicado; degrada a
 * `no_disponible` hasta el connect. Plata como string, `ausente ≠ cero`. Ver el docstring.
 */
export {
  leerPortada,
  preguntarInteligencia,
  leerGraficoFacturacion,
  leerGraficoEntroVsSalio,
  leerGraficoCategorias,
  leerGraficoMargenTrabajo,
} from './inteligencia';
export type {
  CajaPortada,
  FuenteInteligencia,
  MejorCliente,
  MesPortada,
  Portada,
  PorCobrarPortada,
  PuntoSerie,
  RespuestaInteligencia,
  PuntoFacturacion,
  FilaFacturacionMes,
  ResultadoGraficoFacturacion,
  PuntoEntroVsSalio,
  OrigenEntroVsSalio,
  FilaEntro,
  FilaSalio,
  ResultadoGraficoEntroVsSalio,
  PuntoCategoria,
  FilaCategoria,
  ResultadoGraficoCategorias,
  EslabonTrabajo,
  TrabajoConMargen,
  TrabajoSinIngreso,
  DetalleMargenTrabajo,
  ResultadoGraficoMargenTrabajo,
} from './inteligencia';
/**
 * `/capacidades` — lo que el copiloto sabe hacer HOY, para la pantalla de «cómo hablarle». Es una
 * **proyección** de las tools vivas: una capacidad se publica sólo si su tool existe, así que la poda
 * y el alta de tools actualizan la guía solas. **Sin lista de respaldo** — ver el docstring.
 */
export { leerCapacidades } from './capacidades';
export type { CapacidadCopiloto, FechasQueEntiende, GuiaCapacidades } from './capacidades';
/**
 * `/conceptos` — el catálogo de lo que el emprendedor VENDE. ⚠️ No confundir con `catalogo.ts`, que
 * es el catálogo de *integraciones* de Composio: dos cosas distintas con el mismo nombre en
 * castellano. **Borrar es desactivar** (`desactivarConcepto`), y reactivar es
 * `editarConcepto(id, {activo:true})`. Ruta verificada desplegada por HTTP el 2026-07-22.
 */
export {
  cambiosDeConcepto,
  crearConcepto,
  desactivarConcepto,
  editarConcepto,
  listarConceptos,
} from './conceptos';
export type { Concepto, DatosConcepto, ResultadoGuardarConcepto } from './conceptos';
export type {
  Cobro,
  ComprobanteImpago,
  EstadoCobro,
  EstadoDeCobro,
  RegistrarCobroRequest,
  ResultadoCobro,
} from './cobros';

/** `/feedback` — BETA-1a, feedback in-app (voz + texto). Ver el docstring de `feedback.ts`. */
export { enviarFeedback, enviarFeedbackAudio } from './feedback';
