import { configurarApi } from '@copiloto/core';

import { almacenTokensWeb } from './almacenTokens';
import httpWeb from './http';

/**
 * Registra `copiloto-web` ante `@copiloto/core` (ADR-010) -- se llama UNA vez al arrancar la app,
 * mismo patrón que `apps/mobile/src/adapters/plataforma.ts`. Import por side-effect desde `main.tsx`
 * (antes de que cualquier módulo llame una función de `@copiloto/core` -- si no corrió, `config()`
 * lanza un error explícito en vez de fallar en silencio, ver `packages/core/src/api/config.ts`).
 *
 * Necesario para el primer módulo de negocio portado a web (M-WEB spike 1, `gastos`) -- hasta ahora
 * ningún módulo de `copiloto-web` importaba `@copiloto/core` (chat/connections/account tienen su
 * propio cliente en `lib/api/`, sin relación con este paquete compartido con mobile).
 */
configurarApi({ http: httpWeb, tokens: almacenTokensWeb });
