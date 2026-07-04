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
// GET /reply
// ---------------------------------------------------------------------------

export interface ReplyChoice {
  label: string;
  value: string;
}

/**
 * Shape CRUDO que devuelve el backend (`reply_store`, confirmado vivo contra /reply): el texto viene
 * en `reply_text` (NO `text`) y trae `created_at`. `reply.ts` lo normaliza al shape interno.
 */
export interface RawReplyItem {
  id: number;
  reply_text: string;
  choices?: ReplyChoice[] | null;
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
}

export interface ReplyResponse {
  replies: ReplyMessage[];
  next_id: number;
}

// ---------------------------------------------------------------------------
// Superficie común real|mock (index.ts elige la implementación)
// ---------------------------------------------------------------------------

export interface CopilotApi {
  login(email: string, password: string): Promise<LoginResponse>;
  me(): Promise<MeResponse>;
  catalog(): Promise<CatalogResponse>;
  /** Pide la URL de OAuth de un servicio vía su `connect_path` (viene de `CatalogService`). */
  connect(connectPath: string): Promise<ConnectResponse>;
  sendChat(payload: ChatRequest): Promise<ChatResponse>;
  getReply(sessionId: string, afterId: number): Promise<ReplyResponse>;
}
