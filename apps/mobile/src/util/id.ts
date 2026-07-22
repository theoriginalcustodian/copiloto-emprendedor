/**
 * Un identificador único del lado del cliente.
 *
 * Vivía **privado dentro de `useChat`** y se movió acá cuando apareció el segundo consumidor: la
 * `idem_key` de un cobro. Es exactamente el caso de `etiquetasComprobante` —un helper encerrado en un
 * componente no se puede reusar sin moverlo, y mover cuesta más que escribirlo de nuevo, así que el
 * segundo consumidor escribe su propia versión—. Dos generadores de id no se ven distinto hasta que
 * uno de los dos colisiona.
 *
 * 🔴 **Para una `idem_key` esto NO es un detalle cosmético.** El fallback es `Math.random()`, que no
 * es criptográfico: si dos gestos distintos generaran la misma clave, el backend deduplicaría dos
 * cobros **reales** y el emprendedor vería la mitad de su plata. Con 122 bits de aleatoriedad la
 * colisión es despreciable incluso con `Math.random`, pero el orden importa: `crypto.randomUUID`
 * primero, siempre; el fallback existe sólo para entornos sin Web Crypto (jsdom viejo, algún runtime
 * de test), no como camino normal.
 */
export function generarId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin Web Crypto.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
