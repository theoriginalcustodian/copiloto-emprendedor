import type { HttpPort } from './http';
import type { AlmacenTokens } from './tokens';

/** Inyección de plataforma (ADR-010) — mata el `import.meta.env`/`localStorage` directo del core. */
export interface ConfigApi {
  http: HttpPort;
  tokens: AlmacenTokens;
}

let current: ConfigApi | null = null;

/**
 * Registra la plataforma activa (web/React Native) — se llama UNA vez al arrancar la app. El core
 * nunca asume una plataforma por default: si lo hiciera, colaría un `import.meta.env`/`localStorage`
 * implícito, exactamente lo que este paquete existe para prohibir (ver README, "la regla no está
 * escrita: está compilada").
 */
export function configurarApi(cfg: ConfigApi): void {
  current = cfg;
}

/** Lanza con un mensaje claro si `configurarApi` todavía no corrió — nunca un `undefined` mudo. */
export function config(): ConfigApi {
  if (!current) {
    throw new Error(
      '@copiloto/core api: configurarApi() no fue llamado todavía — ninguna plataforma se registró (ver configurarApi en packages/core/src/api/config.ts).',
    );
  }
  return current;
}
