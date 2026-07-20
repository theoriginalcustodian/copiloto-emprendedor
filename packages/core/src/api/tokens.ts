/**
 * El almacén de tokens (ADR-010) — **ASYNC** aunque en web se resuelva sobre `localStorage`
 * (síncrono): en React Native el equivalente es `AsyncStorage`, que NO lo es. El puerto tiene que
 * ser async en todas las plataformas por igual para que el panel/cliente compartido no le importe
 * cuál corre debajo.
 */
export interface AlmacenTokens {
  leerToken(): Promise<string | null>;
  guardarToken(token: string): Promise<void>;
  leerRefresh(): Promise<string | null>;
  guardarRefresh(token: string): Promise<void>;
  limpiar(): Promise<void>;
}
