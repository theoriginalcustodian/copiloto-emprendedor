/**
 * El puerto de persistencia clave-valor del chat. **Cero DOM, cero plataforma.**
 *
 * Es la abstracción detrás de la que en el origen de este código vivía `localStorage` directo — el
 * `session_id` activo y el historial de mensajes (keyed por sesión) se guardan/leen a través de esto,
 * nunca tocando `window.localStorage` directo desde la lógica del chat: un puerto, cada plataforma lo
 * implementa con lo que tenga (`localStorage` en web, `AsyncStorage` en React Native — que en web usa
 * `localStorage` por debajo).
 *
 * Best-effort por contrato: si el storage falla (cuota llena, modo privado), degradar en silencio
 * es responsabilidad del ADAPTADOR — el chat no debe romperse porque no pudo persistir un historial.
 * Este puerto sólo declara la forma; no decide qué pasa cuando falla.
 */
export interface AlmacenClave {
  leer(clave: string): Promise<string | null>;
  guardar(clave: string, valor: string): Promise<void>;
  borrar(clave: string): Promise<void>;
}
