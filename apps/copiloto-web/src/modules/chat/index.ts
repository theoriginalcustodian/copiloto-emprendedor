// Barrel del módulo Chat (header, burbujas, HITL, chips, composer). El mic/voz llega en FASE 4
// (Task 19) — el Composer ya deja el slot, sin lógica todavía.
export { ChatScreen } from './ChatScreen';
export { useChat, type ChatMessage, type ChatRole, type SendStatus, type SendOptions, type UseChatResult } from './useChat';
