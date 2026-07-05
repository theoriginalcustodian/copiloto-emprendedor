/// <reference types="vite/client" />

// Env vars propias del cliente (Task 7 — capa de integración). Vite solo expone `VITE_*` al
// bundle; sin esta declaración `import.meta.env.VITE_API_BASE`/`VITE_API_MOCK` no tipan.
interface ImportMetaEnv {
  /** Base URL del backend. Vacío/ausente = mismo-origen (la SPA se sirve desde el backend). */
  readonly VITE_API_BASE?: string;
  /** '1' => usar `lib/api/mock.ts` en vez del transporte real (dev local sin backend). */
  readonly VITE_API_MOCK?: string;
  /**
   * Base pública del vhost de auth (ej https://auth.178-105-191-1.sslip.io) para el flujo OAuth del
   * browser (Google). Vacío/ausente ⇒ botón "Entrar con Google" OCULTO (feature-flag por build).
   */
  readonly VITE_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
