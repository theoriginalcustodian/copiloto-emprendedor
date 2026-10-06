import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from './client';
import { me } from './me';
import { mockApi } from './mock';
import { LEGAL_VERSION } from '@copiloto/core';

afterEach(() => vi.restoreAllMocks());

/**
 * LEGALNOOPERA parte 1 — **el wire de `legal_aceptado`, sin ninguna decisión de UX de por medio.**
 *
 * El backend lo produce en las DOS ramas de `/me` (`apps/copiloto/web.py:1073-1074` y `:1088-1089`)
 * como `TenantLegalStore(...).version_aceptada() == LEGAL_VERSION_VIGENTE` — de ahí que sea `boolean`
 * y no la versión: `version_aceptada()` devuelve `Optional[str]`
 * (`apps/copiloto/tenant_legal_store.py:28`) y la comparación lo colapsa a booleano.
 *
 * Y está verificado contra prod de punta a punta: `scripts/e2e_bl_o6_legal_aceptacion.py` (PR #681)
 * midió `GET /me canónico -> legal_aceptado=True` y `GET /me adversario -> legal_aceptado=False`,
 * o sea que el aislamiento cross-tenant del campo también está ejercitado.
 *
 * Lo que faltaba no era el productor: era que **el front no conociera el campo**. Cero referencias a
 * `legal_aceptado` en `apps/copiloto-web`, `apps/mobile` y `packages/core` antes de este commit — el
 * front no lo ignoraba, su propio contrato no lo declaraba.
 *
 * ⚠️ **Qué hace la app cuando el tenant NO aceptó la versión vigente es la parte 2, y NO está acá:**
 * es decisión del operador (el texto legal definitivo no existe todavía y el aviso de plantilla
 * genérica sigue puesto a propósito). Este archivo cubre que el dato LLEGUE; nadie decide acá qué
 * hacer con él.
 */
describe('GET /me — el wire de `legal_aceptado` (LEGALNOOPERA parte 1)', () => {
  /** El cuerpo tal como lo arma `web.py:1069-1074`, con el campo que motivó este test. */
  const cuerpoReal = {
    cliente_id: 'c-1',
    email: 'emprendedor@test.com',
    mp_connected: false,
    composio_connected: [] as string[],
    es_admin: false,
    cuenta_google: false,
    onboarding_completado: true,
    legal_aceptado: true, legal_version_aceptada: LEGAL_VERSION,
  };

  it('🔴 `legal_aceptado` del backend llega al consumidor sin perderse en el camino', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(cuerpoReal);

    const r = await me();

    expect(r.legal_aceptado).toBe(true);
  });

  it('🔴 y `false` viaja como `false`, no como ausente', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ ...cuerpoReal, legal_aceptado: false, legal_version_aceptada: null });

    const r = await me();

    // `toBe(false)` y no `toBeFalsy()`: `undefined` también es falsy, y `undefined` es exactamente el
    // bug que este test existe para cazar — un contrato que no declara el campo lo deja indistinguible
    // de "el tenant no aceptó".
    expect(r.legal_aceptado).toBe(false);
  });

  /**
   * 🔴 El mock es el doble que usan los tests y el modo demo. Un doble que no produce un campo que el
   * backend real SÍ manda deja a cualquier UI construida contra él leyendo `undefined`, y `undefined`
   * se lee igual que «no aceptó» — el bug aparecería recién contra prod.
   *
   * Va en `true` porque es el estado normal: la aceptación se registra en el alta
   * (`apps/copiloto-web/src/auth/SignupScreen.tsx:71` → `POST /me/legal/aceptar`), así que un
   * emprendedor que ya usa la app tiene la versión vigente aceptada.
   */
  it('🔴 el MOCK produce el campo, no lo deja en `undefined`', async () => {
    const r = await mockApi.me();

    expect(r.legal_aceptado).toBe(true);
  });

  /**
   * CONTROL POSITIVO del instrumento, en la MISMA corrida que los de arriba.
   *
   * Sin esto, los tres tests anteriores no distinguen «el campo no está cableado» de «el stub de
   * `apiClient.get` no funciona» ni de «`me()` está roto»: las dos causas dan el mismo rojo. `es_admin`
   * ya estaba cableado y es obligatorio en el contrato desde 2026-08-07, así que si ESTE test falla, el
   * roto es el test, no `legal_aceptado`.
   */
  it('control positivo: el mismo camino ya propaga un campo cableado (`es_admin`)', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ ...cuerpoReal, es_admin: true });

    const r = await me();

    expect(r.es_admin).toBe(true);
    expect(r.cliente_id).toBe('c-1');
  });
});
