/**
 * Tipos de los contratos de API. Adaptados desde el core de DocuMed (el copiloto clínico del que este
 * paquete se forkeó): la forma general del transporte (auth, chat durable, polling de replies) es
 * agnóstica de dominio y se preserva; los tipos que modelan el negocio (`Cliente`, antes `Paciente`) se
 * renombraron acá (decisión D7 del plan de puertos móviles) y las rutas puramente clínicas (corrección
 * de nota firmada con invalidación en grafo, consulta diarizada, ingesta documental) se dejaron
 * estructuralmente pero SIN wire-verificar contra un backend propio — no inventar campos no
 * confirmados contra el backend real de `copiloto-emprendedor`.
 */

import type { ModoCopiloto } from '../chat/modo';

import type { ArchivoSubida } from './http';

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

/** El shape exacto de `user` no está confirmado más allá de existir — no inventar campos. */
export type LoginUser = Record<string, unknown>;

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: LoginUser;
}

// ---------------------------------------------------------------------------
// GET /me — identidad del tenant.
// `cliente_id` y `email` los deriva el backend del JWT (`require_tenant` + claims) — el cliente no
// puede falsearlos. `email` puede ser `null` si el token no lo trae (OAuth sin scope de email): la
// UI muestra la identidad sin inventar el dato.
// ---------------------------------------------------------------------------

export interface MeResponse {
  cliente_id: string;
  email: string | null;
}

// ---------------------------------------------------------------------------
// POST /chat
// ---------------------------------------------------------------------------

export type ChatMessageKind = 'text' | 'callback';

/**
 * Contenido de negocio FIRMADO por el emprendedor en el GATE 1 (patrón heredado del origen: "el
 * copiloto decide, no transporta") — viaja en `ChatRequest.contenido`, un campo de PRIMER NIVEL del
 * body: el front-door lo lee de la raíz y lo mueve al `context`, el carril que el LLM conversacional
 * NO ve (no es un `argument`: no lo puede inventar, falsear, ni re-emitir). El executor lo lee directo
 * del canal, byte por byte — nunca de lo que el modelo "recuerde" haber generado. `tipo` distingue el
 * origen (dictado corto / transcript diarizado / extracción documental); el frontend nunca interpreta
 * este valor, sólo lo transporta intacto desde el gate de revisión hasta acá.
 */
export interface ChatContenido {
  tipo: 'dictado' | 'transcript_consulta' | 'documento';
  texto: string;
  /**
   * El `codigo` de `GET /nota/formatos` (ej. una plantilla del catálogo) que el usuario eligió con un
   * botón ANTES de grabar. Viaja acá, adentro del carril `contenido` que el LLM conversacional no ve,
   * por la MISMA razón que `texto`: en el proyecto de origen, un smoke e2e encontró que sin este campo
   * el copiloto no podía inferir el tipo de nota, lo preguntaba en el chat, y la nota firmada se
   * evaporaba en el turno siguiente. El backend además caía en silencio a un default sin el dato — una
   * plantilla se redactaba con la equivocada.
   *
   * `undefined` sólo para `tipo === 'transcript_consulta'` (el backend ya mapea el resumen sin que el
   * usuario elija nada) o `'documento'` (Document AI clasifica). Para `tipo === 'dictado'` es
   * OBLIGATORIO en la práctica: sin él, se repite el bug que esto arregla.
   */
  tipo_nota?: string;
  /**
   * Sólo para `tipo === 'documento'`: el `codigo` de `GET /nota/formatos` que clasifica el documento
   * ingestado. Mismo carril que `tipo_nota` — el LLM conversacional no lo ve ni lo negocia, viaja
   * intacto desde la extracción hasta acá. `undefined` para los otros `tipo`.
   */
  tipo_documento?: string;
}

export interface ChatRequest {
  session_id: string;
  text: string;
  kind: ChatMessageKind;
  mode?: string | null;
  /** El confirm de un gate de negocio (GATE 2, el informe editable): `{markdown}` — el motor
   * (`conversation_workflow.py::_run_react_turn`, rama `confirm`) lo mergea sobre los `arguments`
   * ORIGINALES del tool_call parqueado. `null`/ausente en cualquier otro turno — backward-compat
   * con el copiloto de emprendedores original, que nunca manda este campo.
   *
   * ⚠️ **`contenido` NO va acá adentro** — es su hermano de primer nivel (abajo). El front-door lee
   * `ChatIn.contenido` de la RAÍZ del body; anidado en `payload` le llega `None` y el executor le
   * vuelve a abrir el panel de grabación al usuario. Ver `construirEnvioClinico`. */
  payload?: Record<string, unknown> | null;
  /** El contenido de negocio firmado en el GATE 1 (ver `ChatContenido`) — campo de PRIMER
   * NIVEL, hermano de `payload`. El front-door lo mueve a `context.contenido`; el executor lo lee
   * de ahí, byte por byte, sin pasar jamás por el LLM conversacional. */
  contenido?: ChatContenido | null;
  /**
   * ⚠️ **Deuda GESTIONADA, no invisible.** Este campo se llama `cliente_id` acá y `MeResponse.cliente_id`
   * (arriba) TAMBIÉN se llama `cliente_id` — pero son dos conceptos DISTINTOS heredados sin resolver
   * del port: `MeResponse.cliente_id` es el TENANT (el emprendedor dueño de la cuenta, deriva del JWT);
   * ESTE `cliente_id` es el CLIENTE ACTIVO dentro del CRM del tenant (equivalente al `paciente_id` del
   * origen clínico — "de quién es esta interacción"), y viaja SIEMPRE en el contrato, NUNCA en `text`
   * ni en los `arguments` de una tool. Ninguna interfaz de este archivo los mezcla en el mismo objeto,
   * así que hoy no hay colisión de tipos — pero el nombre compartido es una trampa de lectura real.
   * Revisar al diseñar el CRM (D7 lo difiere a "después"): lo más probable es renombrar uno de los dos
   * (candidato: el tenant a `tenant_id`, dejando `cliente_id` sólo para el CRM).
   * `null`/ausente = sin cliente activo.
   */
  cliente_id?: string | null;
  /**
   * A qué memoria va esta consulta (patrón heredado, D11 del origen). **Lo elige el USUARIO con un
   * botón, nunca el LLM.**
   *
   * `cliente` = el registro del cliente activo. `general` = el conocimiento del emprendedor que no es
   * de ningún cliente en particular (criterios propios, protocolos). Que lo decida un modelo sería
   * dejar que una inferencia decida en qué registro termina un dato.
   */
  alcance?: Alcance | null;
  /**
   * El modo del hilo único: `'copiloto'` (general, puede escribir) o `'negocio'` (razona sobre el
   * registro longitudinal del cliente activo y **sólo lee**, nunca genera borradores). 🔴
   * **Lo elige el USUARIO con el toggle correspondiente, jamás el LLM** — mismo principio que
   * `alcance`/`cliente_id`, pero es un eje ORTOGONAL, no un sinónimo: `alcance` decide a qué memoria
   * va lo que se ESCRIBE; `modo` decide QUÉ MODELO razona y con qué permisos (el modo negocio no
   * escribe nunca). Confundirlos haría que elegir dónde guardar algo cambiara quién lo piensa. Ver
   * `chat/modo.ts` (`modoEfectivo`/`impedimentoParaModo`) — la lógica de si el modo negocio se puede
   * activar (exige cliente) vive ahí, no acá ni en la vista.
   *
   * El backend TODAVÍA no lo consume — mandarlo igual es correcto: un campo que el servidor ignora no
   * rompe nada, y el contrato ya queda armado para cuando lo empiece a leer. `null`/ausente = el
   * default del backend.
   */
  modo?: ModoCopiloto | null;
  /** Esta entrada corrige o amplía una anterior. Ver `Enmienda`. */
  enmienda?: Enmienda | null;
}

/** El destino de lo que se escribe. Lo elige el usuario, no el modelo. */
export type Alcance = 'cliente' | 'general';

/**
 * El usuario declara que esta entrada **corrige** o **amplía** una anterior.
 *
 * 🔴 Por qué existe: una entrada firmada **no se edita nunca**. Si la entrada A dice un dato (error) y
 * el usuario escribe la entrada B corrigiéndolo, sin esta declaración el sistema **no sabe que B
 * corrige a A**: el grafo queda con los dos datos vigentes a la vez, y el copiloto reporta información
 * contradictoria donde hay una sola verdad.
 *
 * - `correccion` → el backend **invalida** en el grafo los hechos que nacieron de A.
 * - `ampliacion` → **no invalida nada**. A sigue vigente, B agrega.
 *
 * **Los dos campos van juntos o no va ninguno** (el backend responde 422 si va uno solo, y la base
 * tiene un `CHECK` que lo fuerza): una referencia sin tipo no dice si hay que invalidar, y un tipo sin
 * referencia no apunta a nada. Un caso ambiguo **se rechaza, no se adivina**.
 */
export interface Enmienda {
  /** La entrada que esta nota corrige/amplía. Tiene que ser la PUNTA de su cadena — una entrada ya
   *  corregida se rechaza (4xx): sólo la última versión de una entrada es corregible. El backend
   *  devuelve ya filtradas las corregibles; el cliente **no calcula** cuál es la punta. */
  corrige_entrada_id: string;
  tipo_referencia: 'correccion' | 'ampliacion';
}

/**
 * Una entrada del cliente que el usuario **puede corregir** (`GET /clientes/{id}/entradas?corregibles=true`).
 *
 * El backend devuelve **sólo la punta de cada cadena** de correcciones: una entrada ya corregida se
 * rechaza con 4xx. El cliente **no calcula** cuál es la punta — ver `listarEntradasCorregibles`.
 */
export interface EntradaCorregible {
  entrada_id: string;
  /** ISO-8601 con timezone. */
  fecha: string;
  tipo_nota: string;
  /**
   * ~140 caracteres del markdown, en texto plano. **No es decorativo:** sin él el usuario elige entre
   * dos entradas del mismo tipo y fecha cercana **sin saber cuál tiene el error**.
   */
  extracto: string;
  /** A qué entrada corrige ésta, si corrige a alguna. Sirve para dibujar el hilo. */
  corrige_entrada_id: string | null;
  /**
   * 🔴 La corrección de esta entrada **quedó pendiente de aplicarse al grafo** y se está reconciliando
   * sola. Intentar corregirla ahora la rechaza con 4xx. Con este flag la UI lo dice **antes**, en vez
   * de que el usuario se coma un error que parece un bug.
   */
  grafo_pendiente: boolean;
}

/** Un hecho que la corrección va a **retirar** de la memoria. */
export interface HechoInvalidado {
  /** La entidad de la ontología. */
  tipo: string;
  descripcion: string;
  /**
   * 🔴 Lo decide el BACKEND, nunca la UI. Inferir la gravedad desde el `tipo` sería **decidir negocio
   * en la UI** — y una corrección menor que retira una alerta importante como efecto colateral es
   * exactamente el caso que este flag existe para nombrar en voz alta.
   */
  critico: boolean;
}

/**
 * Una entrada que **amplía** a la que se está por corregir, y que va a quedar **colgando**: hoy la
 * invalidación NO cae en cascada sobre las ampliaciones. Si el usuario corrige la entrada madre, lo que
 * agregó en éstas sigue vigente en la memoria, colgado de un hecho que ya no existe.
 */
export interface AmpliacionColgante {
  entrada_id: string;
  /** ISO-8601 con timezone. */
  fecha: string;
  tipo_nota: string;
  extracto: string;
}

/** `POST /enmienda/preview` — qué se invalida si el usuario firma. **Cero escrituras.** */
export interface PreviewEnmienda {
  invalida: HechoInvalidado[];
  /**
   * 🔴 **La enumeración de `invalida` puede ser PARCIAL.** `false` = el backend no pudo leer todo el
   * grafo y **puede faltar algo por invalidar** que no está en la lista. La UI NO puede presentar la
   * lista como cerrada en ese caso: decir *"esto es lo que se retira"* cuando la enumeración es
   * incompleta es la mentira tranquilizadora que el fail-closed existe para evitar.
   */
  completo: boolean;
  /** Por qué la enumeración quedó incompleta. Se muestran **textuales**; no se resumen ni se cuentan. */
  avisos: string[];
  /** Ampliaciones que van a quedar huérfanas — ver `AmpliacionColgante`. Vacío si no hay. */
  ampliaciones_colgando: AmpliacionColgante[];
  /** La entrada tiene un hueco abierto en la cola de reconciliación — se está aplicando sola. */
  grafo_pendiente: boolean;
}

export interface ChatResponse {
  wf_id: string;
  accepted: boolean;
}

// ---------------------------------------------------------------------------
// /clientes — identidad de cliente (adaptado del `/pacientes` de origen, decisión D7: "pacientes pasa
// a Clientes, el CRM va adentro después" — el shape se preservó estructuralmente; el diseño real del
// CRM es trabajo futuro, no de este port).
// ---------------------------------------------------------------------------

/*
 * 🪦 **Acá vivían seis tipos de la app CLÍNICA — `Cliente`, `ClienteDetalle`, `OpcionGenero`,
 * `OpcionesCliente`, `ActualizarClienteRequest`, `CrearClienteRequest`. Se borraron el 2026-07-22.**
 *
 * Sobrevivieron al borrado del cliente HTTP viejo (`8761d54`) porque aquella limpieza apuntó al
 * archivo `clientes.ts` y estos vivían acá. **Nadie los usaba** salvo `errors.ts` — medido.
 *
 * 🔴 **Por qué no eran residuo inofensivo:** el `Cliente` de arriba y el `Cliente` de `clientes.ts`
 * se exportaban los DOS desde el barril, y el explícito tapaba en silencio al del `export *`. Peor:
 * `CrearClienteRequest` describía el body de `POST /clientes` con `fecha_nacimiento`, `dni`, `genero`
 * y `forzar`. Quien fuera a implementar el alta iba a importar de `@copiloto/core` el tipo que se
 * llama exactamente como lo que necesita — y escribir el request de OTRA aplicación, con el
 * compilador conforme.
 *
 * La forma buena vive en `api/clientes.ts`, medida contra el servicio vivo. No revivir esto.
 */

// ---------------------------------------------------------------------------
// GET /nota/formatos — el catálogo de plantillas es decisión del USUARIO, nunca del LLM
// ---------------------------------------------------------------------------

/** Una opción del catálogo de formatos de nota (`GET /nota/formatos`). */
export interface FormatoNota {
  codigo: string;
  etiqueta: string;
}

/**
 * `GET /nota/formatos` — el catálogo lo DERIVA el backend de sus plantillas de redacción (no de una
 * tabla: un formato es dato + plantilla, y su fuente de verdad es la plantilla, para que no
 * drifteen). El shape de wire es el mismo que el de cualquier catálogo del sistema: envoltorio +
 * `{codigo, etiqueta}`.
 *
 * 🔴 Por qué existe esta ruta: en el proyecto de origen, un smoke e2e contra producción encontró que
 * el frontend nunca mandaba `tipo_nota` en `ChatRequest.contenido` — el LLM (que por diseño NO ve el
 * contenido de negocio) no podía inferirlo, lo preguntaba en el chat, y la entrada firmada se
 * evaporaba en el turno siguiente. El backend además tenía un default silencioso sin el tipo — una
 * plantilla se redactaba con la equivocada.
 *
 * El tipo de nota es una decisión DEL USUARIO: viaja por el mismo carril que `cliente_id`, `alcance` y
 * `enmienda` — el LLM NO lo negocia.
 */
export interface FormatosNota {
  formatos: FormatoNota[];
}

// ---------------------------------------------------------------------------
// POST /chat/audio (voz-comando, Groq Whisper)
// ---------------------------------------------------------------------------

/**
 * Respuesta de subir una nota de voz corta grabada en el dispositivo para transcribir
 * (grabar_nota). El backend transcribe (Groq Whisper) y el MISMO request dispara el pipeline de
 * dispatch normal server-side (igual que `POST /chat`) — el caller solo necesita mostrar
 * `transcript` como mensaje de usuario y arrancar el mismo polling de `/reply`.
 */
export interface SendAudioResponse {
  wf_id: string;
  accepted: boolean;
  transcript: string;
}

// ---------------------------------------------------------------------------
// POST /chat/foto (Gastos Fase 2 — OCR de tickets, gpt-4o)
// ---------------------------------------------------------------------------

/**
 * Respuesta de subir la foto de un ticket para que el motor la lea (OCR, `gpt-4o`) y arme la tool
 * call `registrar_gasto` con `origen:'foto'` directamente — a diferencia de `/chat/audio`, **no hay
 * transcript**: la vision call no pasa por texto libre, así que no hay nada legible que mostrar como
 * mensaje del usuario. El caller arranca el mismo polling de `/reply` que espera un `gasto_propuesto`.
 *
 * Contrato: `coordinacion/abierto/2026-08-03_contrato_planificacion-a-backend_POST-chat-foto-gastos-fase2.md`.
 */
export interface SendFotoResponse {
  wf_id: string;
  accepted: boolean;
}

// ---------------------------------------------------------------------------
// GET /reply
// ---------------------------------------------------------------------------

export interface ReplyChoice {
  label: string;
  value: string;
}

/**
 * Metadata OPCIONAL de presentación de un reply — QUÉ mostrar además del texto, en UN solo campo
 * (`card`, heredado del copiloto de emprendedores original):
 *  - **gate de negocio** (`kind:'confirm'`): el motor manda `{kind:'confirm', service:'', label:''}` —
 *    `service`/`label` quedan vacíos si el producto no tiene toolkits externos propios. El markdown A
 *    EDITAR NO viaja acá — viaja en `reply.text`; `markdown`/`cliente_id` abajo son un fallback
 *    defensivo por si un reply futuro los empieza a incluir en la card, NUNCA la fuente primaria hoy.
 *  - **artefacto terminal** (`kind:'clinical_saved'`, nombre heredado del origen — la entrada YA se
 *    ingestó a Graphity): trae `markdown` (el MD final, posiblemente editado) y `pdf_b64` (PDF
 *    renderizado, base64, para descarga on-device — "procesamos, no almacenamos": el binario nunca
 *    vive en el backend más allá de esta respuesta). También trae `entrada_clinica_id` (ver abajo).
 */
export interface ReplyCard {
  /** 'confirm' (gate de negocio) | 'clinical_saved' (entrada ya ingestada, nombre heredado del
   * origen). `string` (no unión cerrada) para no romper ante un kind nuevo del backend que el
   * frontend todavía no reconozca. */
  kind?: string;
  /** Heredado del copiloto de emprendedores original (HITL genérico) — vacío (`''`) si el producto
   * no tiene toolkits externos propios todavía. */
  service?: string;
  label?: string;
  /** Fallback defensivo del markdown del gate — la fuente PRIMARIA es `reply.text` (ver arriba). */
  markdown?: string;
  cliente_id?: string;
  /** PDF renderizado en base64 (solo `kind:'clinical_saved'`) — se ofrece como descarga on-device
   * vía data URI, nunca se persiste server-side (principio "procesamos, no almacenamos"). */
  pdf_b64?: string;
  /**
   * Sólo `kind==='clinical_saved'` — el id de la fila que el log de actividad acaba de escribir en su
   * tabla de origen. Es lo que ata el `.md`/PDF cacheados on-device a la entrada FIRMADA del lado del
   * servidor. `undefined` sólo si el backend todavía no lo manda; nunca inventar un valor en su lugar.
   */
  entrada_clinica_id?: string;
  /** Sólo `kind==='start_recording'` (launch-card): qué acción abrir — `'nota'` o `'consulta'`.
   * Cualquier otro valor (o ausente) degrada en silencio — ver `ArtifactView`. */
  accion?: string;
  /**
   * Sólo `kind==='gasto_propuesto'` — el gasto que el motor entendió del dictado. Es **exactamente el
   * body de `POST /gastos`**: la app manda lo que el emprendedor dejó en la card, sin transformar.
   *
   * `unknown` y no un tipo cerrado: lo llenó un LLM y lo valida `leerGastoPropuesto` (`chat/
   * gastoPropuesto.ts`), que es el único lugar que sabe qué hacer con un campo sucio. Tiparlo acá
   * daría una garantía que nadie verificó.
   */
  data?: unknown;
  /** Sólo `kind==='start_recording'` con `accion==='nota'`: categoría que el copiloto ya infirió
   * al llamar la tool correspondiente — puramente informativo en el front, NUNCA contenido de
   * negocio. */
  tipo_nota?: string;
}

/**
 * Shape CRUDO que devuelve el backend (`reply_store`): el texto viene en `reply_text` (NO `text`) y
 * trae `created_at`. `reply.ts` lo normaliza al shape interno.
 */
export interface RawReplyItem {
  id: number;
  reply_text: string;
  choices?: ReplyChoice[] | null;
  card?: ReplyCard | null;
  created_at?: string;
}

export interface RawReplyResponse {
  replies: RawReplyItem[];
  next_id: number;
}

/** Shape INTERNO normalizado que consumen `useChat` y el mock (`reply.ts` mapea `reply_text` -> `text`). */
export interface ReplyMessage {
  id: number;
  text: string;
  choices?: ReplyChoice[];
  card?: ReplyCard;
}

export interface ReplyResponse {
  replies: ReplyMessage[];
  next_id: number;
}

// ---------------------------------------------------------------------------
// POST /warm
// ---------------------------------------------------------------------------

/**
 * Respuesta de precalentar la memoria de largo plazo del tenant (grafo del negocio). El caller lo
 * dispara al abrir la app / volver a la pestaña de chat, ANTES del 1er mensaje, para que el grafo
 * llegue caliente (perceived latency). Best-effort en el CUERPO (`warmed:false` si Graphity no está
 * configurado o falló). El probe de sesión es `GET /me`, no esta ruta.
 * El auth-gate (401/403) sigue corriendo ANTES del handler vía `require_tenant` en ambos.
 */
export interface WarmResponse {
  warmed: boolean;
}

// ---------------------------------------------------------------------------
// Superficie común real|mock (cada plataforma elige la implementación — el core NO decide)
// ---------------------------------------------------------------------------

/** Respuesta de `POST /auth/oauth/ensure-tenant` (first-login OAuth). Solo `cliente_id` es de interés. */
export interface OauthEnsureResponse {
  cliente_id: string;
}

export interface CopilotApi {
  login(email: string, password: string): Promise<LoginResponse>;
  /** First-login OAuth (Google): provisiona el tenant. Idempotente en el backend. */
  ensureOauthTenant(): Promise<OauthEnsureResponse>;
  me: () => Promise<MeResponse>;
  sendChat(payload: ChatRequest): Promise<ChatResponse>;
  /** Sube una nota de voz corta (multipart) para transcribir (voz-comando, Groq) — ver
   * `SendAudioResponse`. `clienteId` viaja como campo `Form` — el backend lo exige (falta → 422) ANTES
   * de gastar cómputo de STT. `audio` es OPACO al core (`ArchivoSubida`, ver `http.ts`): en web es un
   * `Blob`, en React Native un `{uri, ...}` — el core no lo inspecciona.
   *
   * 🔴 `modo` viaja acá TAMBIÉN, no sólo en `sendChat`: este es un copiloto **de voz**, así que éste es
   * el camino principal. Sin él, el modo negocio sólo regiría cuando el usuario ESCRIBE — el camino
   * minoritario — y hablando iría en silencio al modelo general. Un modo que rige a veces es peor que
   * uno que no existe. */
  sendAudio(
    sessionId: string,
    audio: ArchivoSubida,
    clienteId: string,
    modo?: ModoCopiloto | null,
  ): Promise<SendAudioResponse>;
  /** Sube la foto de un ticket (multipart) para OCR — ver `SendFotoResponse`. Mismo criterio de
   * `cliente_id` que `sendAudio`: se manda SIEMPRE, aunque venga vacío. `imagen` es OPACO al core
   * (`ArchivoSubida`) — el adaptador de cada plataforma sabe cómo adjuntarla. */
  sendFoto(sessionId: string, imagen: ArchivoSubida, clienteId: string): Promise<SendFotoResponse>;
  /** Long-poll de las respuestas del agente. Chat único `(session_id)` a secas — sin partición por
   * cliente en este hilo de lectura (el `cliente_id` de cada acción de negocio sigue viajando en
   * `/chat`/`/chat/audio` según corresponda). */
  getReply(sessionId: string, afterId: number): Promise<ReplyResponse>;
  /** Precalienta la memoria de largo plazo del tenant (best-effort) — ver `WarmResponse`. El probe de
   * sesión es `GET /me()`, no esta ruta. */
  warm(): Promise<WarmResponse>;
}
