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
export { ApiError, DuplicadoProbableError, ForbiddenError, GeneroInvalidoError, UnauthorizedError } from './errors';
export type { MotivoDuplicado } from './errors';

// Contratos de request/response.
export * from './types';

// `/clientes` (adaptado del `/pacientes` de origen, decisión D7) — a diferencia del resto, NO forma
// parte de `CopilotApi`/`mockApi`: es una superficie sin equivalente en el flujo mock heredado del
// copiloto de emprendedores original.
export { actualizarCliente, crearCliente, listarClientes, obtenerOpcionesCliente, obtenerCliente } from './clientes';

// `/nota/formatos` — el catálogo de tipos de nota. Mismo criterio que `/clientes/opciones`:
// superficie aparte, sin equivalente en `CopilotApi`/`mockApi`.
export { obtenerFormatosNota } from './formatos';

// La enmienda. `listarEntradasCorregibles` trae SÓLO la punta de cada cadena (lo filtra el
// backend); `previewEnmienda` dice qué se va a INVALIDAR antes de firmar, sin escribir nada.
export { listarEntradasCorregibles, previewEnmienda } from './enmienda';

// `/actividad` — "Recientes": las entradas FIRMADAS del usuario, cross-cliente. Ver el docstring de
// `actividad.ts` para el criterio de `no_disponible` (404/501, endpoint aún sin desplegar).
export { listarActividad } from './actividad';
export type { ActividadItem, ActividadResult, ListarActividadParams } from './actividad';

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
