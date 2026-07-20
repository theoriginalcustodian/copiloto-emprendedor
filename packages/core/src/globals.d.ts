/**
 * Globals permitidos DENTRO de `packages/core`, pese al `lib: ["ES2022"]` + `types: []` del
 * `tsconfig.json` (el gate de "cero DOM" de ADR-010 — ver `README.md`). Cada global de acá está
 * PROBADO contra el runtime real de las plataformas consumidoras (nunca asumido): la prohibición
 * queda AJUSTADA (una lista corta y explícita) en vez de ABIERTA (todo `lib.dom.d.ts`, que también
 * dejaría pasar `document`/`window`/`localStorage`/etc. sin querer).
 *
 * No agregar un global acá sin verificar antes que el runtime real (no un polyfill de test) lo
 * provee — ese es exactamente el gap que este archivo existe para cerrar.
 */

/**
 * `URLSearchParams` — usado en `api/clientes.ts` (`listarClientes`) y `api/reply.ts`
 * (`getReply`) para armar querystrings. Verificado en el proyecto de origen: React Native
 * (Expo/Hermes) trae el polyfill global con percent-encoding correcto; los navegadores lo proveen
 * nativo. Firma mínima (no la sobrecarga completa de lib.dom) — sólo lo que este paquete usa.
 */
declare class URLSearchParams {
  constructor(init?: Record<string, string> | string[][] | string);
  toString(): string;
  append(name: string, value: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  delete(name: string): void;
  forEach(callback: (value: string, key: string, parent: URLSearchParams) => void): void;
}

/**
 * `setTimeout` — usado en `api/mock.ts` para simular la latencia/asincronía del backend real
 * (dev local sin backend). Presente como global tanto en Node (tests) como en Hermes/JSC (runtime
 * móvil) y en el navegador (runtime web). Firma mínima: este paquete nunca lee el valor de retorno
 * ni llama `clearTimeout`, así que no hace falta declarar ese par.
 */
declare function setTimeout(callback: (...args: unknown[]) => void, ms?: number): number;
