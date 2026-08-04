/**
 * Tipos de los contratos de API confirmados vivos contra el backend (Task 7). Toda firma acá
 * debe reflejar EXACTO lo que el backend responde — no inventar campos no confirmados.
 */

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
// POST /auth/signup
// ---------------------------------------------------------------------------

export interface SignupRequest {
  email: string;
  password: string;
}

/** `apps/copiloto/web.py:767-773` -> `onboarding.signup_and_provision` — SIN tokens: el signup
 * sólo crea el user+tenant, no loguea. El caller encadena `POST /auth/login` con las mismas
 * credenciales para obtener sesión (ver `SignupScreen.tsx`). */
export interface SignupResponse {
  cliente_id: string;
  auth_user_id: string;
  email: string;
}

// ---------------------------------------------------------------------------
// GET /me
// ---------------------------------------------------------------------------

export interface MeResponse {
  cliente_id: string;
  mp_connected: boolean;
  composio_connected: string[];
}

// ---------------------------------------------------------------------------
// GET /catalog
// ---------------------------------------------------------------------------

export interface CatalogService {
  key: string;
  display_name: string;
  work_label: string;
  category: string;
  kind: string;
  description: string;
  capabilities: string[];
  connected: boolean;
  connect_path: string;
}

export interface CatalogResponse {
  services: CatalogService[];
}

// ---------------------------------------------------------------------------
// GET /mp/connect | GET /composio/connect?service=<key>
// ---------------------------------------------------------------------------

/**
 * Respuesta de CUALQUIER flujo de connect (Mercado Pago o Composio) — mismo shape para los dos,
 * es lo que hace que `getConnect`/`useConnections.connect` sean data-driven: reciben el
 * `connect_path` que ya trae cada `CatalogService` y no bifurcan por proveedor.
 */
export interface ConnectResponse {
  url: string;
}

// ---------------------------------------------------------------------------
// POST /chat
// ---------------------------------------------------------------------------

export type ChatMessageKind = 'text' | 'callback';

export interface ChatRequest {
  session_id: string;
  text: string;
  kind: ChatMessageKind;
  mode?: string | null;
}

export interface ChatResponse {
  wf_id: string;
  accepted: boolean;
}

// ---------------------------------------------------------------------------
// POST /chat/audio
// ---------------------------------------------------------------------------

/**
 * Respuesta de subir una nota de voz grabada en el browser para transcribir (Task 19, FASE 4). El
 * backend transcribe (Groq Whisper, Task 18) y el MISMO request dispara el pipeline de dispatch
 * normal server-side (igual que `POST /chat`) — el cliente solo necesita mostrar `transcript` como
 * mensaje de usuario y arrancar el mismo polling de `/reply` (ver `useChat.sendAudio`).
 */
export interface SendAudioResponse {
  wf_id: string;
  accepted: boolean;
  transcript: string;
}

// ---------------------------------------------------------------------------
// GET /reply
// ---------------------------------------------------------------------------

export interface ReplyChoice {
  label: string;
  value: string;
}

/**
 * Metadata OPCIONAL de presentación de un reply — QUÉ mostrar además del texto, unificada bajo UN
 * solo campo (`card`) para las 2 familias de uso (Task 17, resuelve minor #13 — se elimina el
 * campo `artifact` separado, nunca implementado):
 *  - **gate HITL** (Task 13): `kind:'confirm'` + `service`/`label` — QUÉ app real se va a usar en
 *    la acción a confirmar, para que `HitlCard` muestre ícono + nombre reales (Google Docs / Gmail /
 *    Mercado Pago / …) en vez de adivinarlos del texto. `kind` es OPCIONAL acá por compat: los
 *    replies HITL de antes de esta unificación mandan `card` sin `kind` — se tratan como 'confirm'.
 *  - **artefacto terminal** (Task 17): cualquier OTRO `kind` (`payment_link`/`email_draft`/`doc`/
 *    `sheet`/`file`/`calendar_event`) + `data` con el payload específico (`url`, `amount`,
 *    `fields`, …) que consume `ArtifactView`. `service`/`label` no aplican acá.
 * Ausente/null en replies que no traen ni gate ni artefacto.
 */
export interface ReplyCard {
  /** 'confirm' (gate HITL, default si ausente) | 'payment_link' | 'email_draft' | 'doc' | 'sheet' |
   * 'file' | 'calendar_event'. `string` (no unión cerrada) para no romper ante un kind nuevo del
   * backend que el frontend todavía no reconozca — `ArtifactView` degrada a no-render. */
  kind?: string;
  /** Payload específico del artefacto (url, amount, fields, …) — ausente cuando `kind` es 'confirm'. */
  data?: Record<string, unknown>;
  /** key del catálogo: googledocs/googlesheets/googledrive/gmail/googlecalendar/mercadopago/instagram/hubspot. */
  service?: string;
  /** Nombre humano de la app ("Google Docs", "Mercado Pago", …). */
  label?: string;
}

/**
 * Shape CRUDO que devuelve el backend (`reply_store`, confirmado vivo contra /reply): el texto viene
 * en `reply_text` (NO `text`) y trae `created_at`. `reply.ts` lo normaliza al shape interno.
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
 * Respuesta de precalentar la memoria de largo plazo del tenant (grafo del emprendedor). El front lo
 * dispara al abrir la app / volver a la pestaña de chat, ANTES del 1er mensaje, para que el grafo llegue
 * caliente (perceived latency). Best-effort: `warmed:false` si el backend no tiene memoria configurada o
 * Graphity falló — nunca es un error para el usuario, solo se pierde la optimización de latencia.
 */
export interface WarmResponse {
  warmed: boolean;
}

// ---------------------------------------------------------------------------
// Superficie común real|mock (index.ts elige la implementación)
// ---------------------------------------------------------------------------

/** Respuesta de `POST /auth/oauth/ensure-tenant` (first-login OAuth). Solo `cliente_id` es de interés. */
export interface OauthEnsureResponse {
  cliente_id: string;
}

export interface CopilotApi {
  login(email: string, password: string): Promise<LoginResponse>;
  /** Admin-mediado hoy (spec §5.1) — crea user+tenant, NO loguea (ver `SignupResponse`). */
  signup(email: string, password: string): Promise<SignupResponse>;
  /** First-login OAuth (Google): provisiona el tenant. Idempotente en el backend. */
  ensureOauthTenant(): Promise<OauthEnsureResponse>;
  me(): Promise<MeResponse>;
  catalog(): Promise<CatalogResponse>;
  /** Pide la URL de OAuth de un servicio vía su `connect_path` (viene de `CatalogService`). */
  connect(connectPath: string): Promise<ConnectResponse>;
  sendChat(payload: ChatRequest): Promise<ChatResponse>;
  /** Sube una nota de voz (multipart) para transcribir — ver `SendAudioResponse`. */
  sendAudio(sessionId: string, blob: Blob): Promise<SendAudioResponse>;
  getReply(sessionId: string, afterId: number): Promise<ReplyResponse>;
  /** Precalienta la memoria de largo plazo del tenant (best-effort) — ver `WarmResponse`. */
  warm(): Promise<WarmResponse>;
}
