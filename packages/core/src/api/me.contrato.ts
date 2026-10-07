import type { MeResponse } from './types';

// Fixtures del contrato de GET /me (MEDOBLE). Viven fuera de *.test.ts a propósito: tsconfig excluye los
// tests del typecheck, y estos literales tipados sólo sirven si tsc los compila. Payloads transcritos de
// apps/copiloto/web.py:1118-1137 (rama con `require_claims` trae `email`; rama sin claims NO lo trae).

export const CLAVES_DECLARADAS: Record<keyof MeResponse, true> = {
  cliente_id: true,
  email: true,
  cuenta_google: true,
  onboarding_completado: true,
  mp_connected: true,
  composio_connected: true,
  es_admin: true,
  legal_aceptado: true,
  legal_version_aceptada: true,
};

export const RAMA_CON_CLAIMS: MeResponse = {
  cliente_id: 'cli-1',
  email: 'x@example.com',
  es_admin: false,
  cuenta_google: true,
  mp_connected: false,
  composio_connected: [],
  onboarding_completado: true,
  legal_aceptado: false,
  legal_version_aceptada: null,
};

export const RAMA_SIN_CLAIMS: MeResponse = {
  cliente_id: 'cli-1',
  es_admin: false,
  cuenta_google: false,
  mp_connected: false,
  composio_connected: [],
  onboarding_completado: true,
  legal_aceptado: false,
  legal_version_aceptada: null,
};
