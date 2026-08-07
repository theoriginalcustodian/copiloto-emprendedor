---
name: copiloto-google-signin-nativo-credential-manager
description: Login Google en mobile pasó de browser (Custom Tabs) al selector nativo de Android (Credential Manager) — nuevo endpoint /auth/google/id-token con GoTrue id_token grant, y los 3 bugs reales que salieron al migrar
metadata:
  type: project
---

# 🔑 Google Sign-In NATIVO — Credential Manager (BETA-4b, cerrado 2026-08-05)

**No confundir con [[copiloto-oauth-google-propio]]** — aquella entrada es sobre conectar apps de
terceros (Gmail/Drive/Docs/Sheets/Calendar) vía Composio, un problema completamente distinto que
comparte sólo el mismo proyecto GCP (`copiloto-emprendedor`, `890375505063`). Esta entrada es sobre
**cómo el usuario inicia sesión** en la app.

## Qué cambió

El login Google del mobile pasó de un flujo browser (Custom Tabs, redirect) al **selector de cuenta
nativo de Android** vía `@react-native-google-signin/google-signin`, que envuelve el Credential Manager
del sistema — pedido explícito del operador: *"selector de cuenta del sistema, no un navegador"*.

- **Mobile:** `apps/mobile/src/modules/auth/oauth.ts` reescrito; `SessionProvider.tsx` con fix del
  gap de `ensure-tenant` (ver abajo).
- **Backend:** endpoint nuevo `POST /auth/google/id-token` (PR#261, `630d91f3`) — intercambia el
  `idToken` nativo por el token propio vía GoTrue **`id_token` grant** (`GoTrueAdmin.id_token_grant()`
  en `onboarding.py`, mismo patrón que `password_grant`/`refresh_grant` ya existentes: no se inventó un
  mecanismo nuevo, se extendió el ya usado).
- **VPS/GoTrue:** `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` pasó a multi-audiencia (web + Android) +
  `SKIP_NONCE_CHECK=true` — el sign-in nativo no expone un hook de nonce custom en la librería
  free-tier.

## Los 3 bugs reales que salieron al migrar (no hipotéticos — todos con evidencia de device o deploy)

1. **Gap de arquitectura:** el primer login por Google nunca llamaba `ensure-tenant` → un usuario nuevo
   quedaba en `no-habilitada` para siempre. Fix: `SessionProvider.tsx` se auto-cura ante un 403 de
   `/me` reintentando `ensure-tenant`. **No ejercitado en device con cuenta genuinamente nueva** (la
   cuenta de prueba ya tenía tenant de una sesión web previa) — cubierto sólo por unit test
   (`PantallaLogin.test.tsx`), deuda de cobertura visible, no bloqueante.
2. **`DEVELOPER_ERROR` (code 10)** del selector nativo: el `webClientId` pertenecía a **otro proyecto
   GCP** que el client Android registrado. Gotcha reusable: el prefijo numérico de cualquier
   `client_id` de Google **ES el número de proyecto** — si no coincide con el proyecto del client
   Android, el selector nativo falla con code 10 sin mensaje más claro. Fix: usar un client Web del
   MISMO proyecto (`890375505063`).
3. **405 en el intercambio:** el endpoint se había probado contra STAGE (`sync-test-backend.sh`) pero
   nunca desplegado a producción (`deploy.sh`) — no existía en el servicio vivo. **Casi un near-miss
   serio en el fix**: un `git checkout <rama vieja> -- archivo` casi pisó ~10 features independientes
   ya mergeadas a `main`; se detectó antes de deployar por el diff-stat implausible, se descartó y se
   reaplicó quirúrgicamente sobre el `main` real. Ver [[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]]
   y [[el-checkout-compartido-sirve-comandos-viejos]] — mismo patrón de riesgo, van juntas.

## Evidencia E2E — servidor, no autoevaluación

Device físico `RF8R50N2WGR`: tap "Entrar con Google" → selector nativo (`SignInHubActivity`, logcat) →
cuenta real → login `200` (log de auditoría de GoTrue, `grant_type=id_token`) → `GET /me` 200 → pantalla
principal. Deploy verificado: `main` @ `630d91f3`, smoke 7/7, `curl -X POST .../auth/google/id-token`
pasó de `405` a `401` (endpoint vivo) antes del test en device.

## Deferido, no bloqueante

- Client Web **dedicado** en el proyecto GCP — hoy reusa el de Composio (TODO documentado en
  `oauth.ts`; requiere GCP Console, fuera del alcance de un agente).
- Self-heal de `ensure-tenant` sin ejercitar en device con cuenta genuinamente nueva (ver bug 1).
