/**
 * Un identificador único del lado del cliente.
 *
 * Port de `apps/mobile/src/util/id.ts` — extraído de `modules/chat/useChat.ts` (tenía su propio
 * `generateId` privado, idéntico) cuando apareció el segundo consumidor (`idem_key` del alta de
 * cliente en `FormularioCliente`). Mismo caso que motivó el original en mobile: un generador
 * encerrado en un componente no se reusa sin moverlo, y dos generadores no se ven distinto hasta
 * que uno colisiona.
 *
 * 🔴 Para una `idem_key` esto no es cosmético — ver el docstring de la versión mobile para el
 * porqué de `crypto.randomUUID` primero, siempre, con el fallback sólo para entornos sin Web
 * Crypto (no debería pasar en browsers modernos ni en jsdom reciente).
 */
export function generarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
