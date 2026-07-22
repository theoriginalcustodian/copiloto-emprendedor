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
import { login } from './auth';
import { sendChat } from './chat';
import { me } from './me';
import { mockApi } from './mock';
import { ensureOauthTenant } from './oauth';
import { getReply } from './reply';
import type { CopilotApi } from './types';
import { warm } from './warm';

export const apiReal: CopilotApi = {
  login,
  ensureOauthTenant,
  me,
  sendChat,
  sendAudio,
  getReply,
  warm,
};

export { mockApi };

// Inyección de plataforma (HttpPort/AlmacenTokens) — ver `config.ts`.
export { configurarApi, config } from './config';
export type { ConfigApi } from './config';

// Puertos — los tipos que cada plataforma implementa.
export type { ArchivoSubida, HttpPort, PeticionHttp, RespuestaHttp } from './http';
export type { AlmacenTokens } from './tokens';

// Errores.
// ⚠️ `DuplicadoProbableError`, `GeneroInvalidoError` y `MotivoDuplicado` se exportaban acá y se
// BORRARON el 2026-07-22: eran de la app clínica y describían un `409` de `POST /clientes` con otro
// significado que el de este producto. Ver el epitafio en `errors.ts`.
export { ApiError, ForbiddenError, UnauthorizedError } from './errors';

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
  PerfilNegocio,
  ResultadoPerfilNegocio,
} from './perfilNegocio';

// `/presupuestos` — alta, listado, detalle y el atajo a facturar. Los montos viajan como STRING
// (plata: el float pierde precisión) y el `total` lo calcula el backend. Ver `presupuestos.ts`.
export {
  crearPresupuesto,
  facturarPresupuesto,
  listarPresupuestos,
  obtenerPresupuesto,
} from './presupuestos';
export type {
  CrearPresupuestoRequest,
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
