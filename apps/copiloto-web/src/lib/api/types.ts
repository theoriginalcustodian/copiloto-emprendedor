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
  sendChat(payload: ChatRequest): Promise<ChatResponse>;
  getReply(sessionId: string, afterId: number): Promise<ReplyResponse>;
}
