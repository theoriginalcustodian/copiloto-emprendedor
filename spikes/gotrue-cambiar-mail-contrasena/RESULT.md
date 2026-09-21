# K-12 — GoTrue: cambiar contraseña / cambiar email / cuenta_google (spike desechable)

**Fecha:** 2026-09-21 · **GoTrue:** `supabase/gotrue:v2.186.0` (la misma de prod) · **Stack:** `gotrue-k12-test`,
loopback `127.0.0.1:9971` (+ mailpit `axllent/mailpit:v1.21` para capturar SMTP en `:8971`), secretos generados al vuelo
(`openssl rand`, `chmod 600`, sólo en `/tmp/gotrue-k12` del VPS, nunca en el repo). **Teardown: HECHO** (`down -v`, stage borrado,
0 contenedores/volúmenes/redes `k12` verificado; `copiloto-auth-*` de prod intactos, jamás tocados).

Reproducir: `run-remote.sh up|matrix|extra|sinsmtp|down` (corre en el VPS; ver "Scripts"). Salidas crudas: `matrix-output.txt`,
`extra-output.txt`, `sinsmtp-output.txt`. `matrix-output-run1-INVALIDO.txt` es un primer run con un bug del script
(el shell exportaba el env-file y compose le da precedencia al entorno → `AUTOCONFIRM=false` nunca se aplicó); se conserva sólo
como registro, **no usar**.

## Tabla pregunta → evidencia → decisión

| # | Pregunta | Evidencia (HTTP real, sin secretos) | Decisión |
|---|---|---|---|
| 1a | `PUT /auth/v1/user {"password"}` Bearer, `REAUTH=false` | **200**, body = user completo (`id,email,app_metadata,identities,updated_at…`). Login con la vieja → 400, con la nueva → 200. No manda mail. | Éxito = 200. El backend ignora el body (no reenviarlo: trae `identities`). |
| 1b | `REAUTH=true`, sesión fresca (<24 h) | **200 sin nonce** (GoTrue exime a sesiones recientes; escenario B). | Con sesión fresca da igual el flag. |
| 1c | `REAUTH=true`, sesión vieja (3 d, retrocedida por SQL en la DB descartable) | Sin nonce → **400 `reauthentication_needed`** "Password update requires reauthentication". `GET /reauthenticate` → 200 `{}` + mail "Confirm reauthentication" con nonce de 6 dígitos. `PUT {password,nonce}` → 200; nonce inválido → **422 `reauthentication_not_valid`**. | **Prod NO setea el flag** (default false) → el flujo simple alcanza. Si algún día se activa, mapear 400 `reauthentication_needed` a un error propio. |
| 1d | Contraseña corta (`"abc"`) | **422** `{"code":422,"error_code":"weak_password","msg":"Password should be at least 6 characters.","weak_password":{"reasons":["length"]}}` | Mapear 422 `weak_password` → 422 propio `contrasena_debil`. Mínimo GoTrue = 6 (default; prod no lo setea). **Validar el mínimo en el backend ANTES** de llamar a GoTrue. |
| 1e | Misma contraseña que la actual | **422 `same_password`** "New password should be different from the old password." | Mapear → 422 `contrasena_igual`. |
| 2 | Password actual incorrecta: `POST /token?grant_type=password` | **400** `{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}`. Idéntico para email inexistente (no filtra existencia). | Confirmado **400** (no 401). `password_grant` (`_INVALID_GRANT_STATUSES=(400,401)`, onboarding.py:51) lo mapea a `InvalidCredentials`. `POST /auth/cambiar-contrasena` debe **verificar la actual con `password_grant(email, actual)`** y devolver 401 propio; nunca reenviar el msg de GoTrue. |
| 3a | `PUT /user {"email"}` con `AUTOCONFIRM` true/false × `SECURE_EMAIL_CHANGE` true/false (matriz A–E) | **Siempre 200 y NUNCA instantáneo**: `email` sigue siendo el viejo y aparece `new_email` + `email_change_sent_at` (shape `{email,new_email,email_change_sent_at,email_confirmed_at,updated_at,…}`). Login con el viejo → 200, con el nuevo → 400 hasta confirmar. `AUTOCONFIRM` **no afecta** el cambio de email. | El cambio es **siempre de 2 pasos**: responder "pendiente", nunca "cambiado". |
| 3b | ¿A qué mail va la confirmación? | `SECURE=true` → **2 mails** ("Confirm Email Change": viejo y nuevo). `SECURE=false` → **1 mail sólo al nuevo**. | — |
| 3c | Confirmar por el link | Ver H1 (el link crudo NO funciona con el proxy/`API_EXTERNAL_URL` actual). Con el link reescrito a `/auth/v1/verify`: **303** → `redirect_to#access_token…`; `GET /user` → `email` = nuevo, sin `new_email`; login viejo 400 / nuevo 200. Con `SECURE=true` el click en el link **del mail nuevo** ya completó el cambio (no se probó click sólo en el del viejo). | — |
| 3d | Email ya en uso por otra cuenta | **422** `{"error_code":"email_exists","msg":"A user with this email address has already been registered"}` — revela existencia de la otra cuenta. | Mapear a 409 `email_en_uso` (o respuesta neutra anti-enumeración: decisión de producto). |
| 3e | Email con formato inválido | **400** `validation_failed` "Unable to validate email address: invalid format". | Validar formato antes en el backend → 422 propio. |
| 3f | Config real de prod: `SMTP_HOST` vacío + `AUTOCONFIRM=true` | **200**, `new_email` pendiente, `email_change_sent_at` seteado, **sin error visible** (`sinsmtp-output.txt`). No se verificó si GoTrue loguea el fallo de envío. | Con la config de prod de hoy el cambio de email quedaría **pendiente para siempre sin avisar**. |
| 4a | `app_metadata` en el access token (email/password) | Claims: `{"iss","aud":"authenticated","role":"authenticated","email","app_metadata":{"provider":"email","providers":["email"]},"user_metadata":{"email_verified":true},"amr":[{"method":"password",…}],"is_anonymous":false}` → **sí viaja `app_metadata.provider/providers` en el JWT**. | Fuente barata: los `claims` que `GET /me` ya tiene (`require_claims`). |
| 4b | `GET /auth/v1/user` (Bearer) | Devuelve `app_metadata:{provider,providers}` **e** `identities:[{provider:"email",identity_id,…}]`. | Ver decisión `cuenta_google`. |
| 4c | Cuenta Google | **NO verificado** (no se puede crear en el test; Google OAuth OFF acá). Por diseño de GoTrue: `provider` = el del primer alta, `providers` acumula, `identities[].provider=="google"`. | Ver abajo. |
| 5 | Config de prod hoy | Sección siguiente. | — |

## Hallazgos que cambian el diseño

- **H1 — el link de confirmación de email NO es alcanzable en prod tal como está.** GoTrue arma el link como
  `API_EXTERNAL_URL + "/verify?token=…"` (**sin** `/auth/v1`). En prod `COPILOTO_API_EXTERNAL_URL=https://copilotoemprendedor.duckdns.org`
  (sin `/auth/v1`) y el Caddy público sólo proxya `/auth/v1/authorize*` y `/auth/v1/callback*`
  (`deploy/copiloto/Caddyfile.snippet:39-40`). En el spike el link crudo devolvió 200 vacío; reescrito a `/auth/v1/verify` confirmó (303).
  Para habilitar cambio de email hay que: (a) que el link apunte a `…/auth/v1/verify` (`API_EXTERNAL_URL` con `/auth/v1`; cuidado con
  el `callback` de Google, que hoy usa `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` explícito) y (b) exponer `handle /auth/v1/verify*` en el vhost público.
  Cambio de infra en prod = **MAYOR / decisión del operador**.
- **H2 — prod no tiene SMTP** (slot vacío) → sin mail no hay confirmación. Prerrequisito: cargar SMTP (BETA-2.b/2.c).
- **H3 — el cambio de email es siempre asíncrono** (`new_email` pendiente) aunque `AUTOCONFIRM=true`; `/me` sigue devolviendo el viejo hasta confirmar.
- **H4 — `PUT /user?redirect_to=`**: con un host fuera de allow-list GoTrue devolvió 200; **no se verificó** a dónde apuntaba el link. No pasar `redirect_to` desde el cliente sin validarlo.

## Config de prod HOY (de `docker-compose.gotrue.yml` + `.env.gotrue.template`; sin leer secretos)

| Variable | Valor en prod | Fuente |
|---|---|---|
| `GOTRUE_MAILER_AUTOCONFIRM` | `true` (default del compose y del template) | compose, template |
| `GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED` | **no seteada** → default de GoTrue | el compose no la expone |
| `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION` | **no seteada** → default `false` | idem |
| `GOTRUE_PASSWORD_MIN_LENGTH` | no seteada → default 6 | idem |
| `GOTRUE_DISABLE_SIGNUP` | `true` | compose |
| `GOTRUE_SMTP_HOST/USER/PASS` | vacíos en el template (slot); el env real server-side **no se leyó** | template |
| `API_EXTERNAL_URL` | `https://copilotoemprendedor.duckdns.org` (sin `/auth/v1`) | template L37 |
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | `true` en el env real (según comentario del template); no verificado en vivo | template |

**No verificado:** el env server-side real (sólo template/compose); el default exacto de `SECURE_EMAIL_CHANGE_ENABLED` sin setear
(en el spike siempre se fijó explícito).

## Decisión de shape final (propuesta, sin implementar)

**`POST /auth/cambiar-contrasena`** (Bearer del usuario) — body `{"actual": str, "nueva": str}`.
1. Validar `nueva` en backend (len ≥ 6, ≠ `actual`) → 422 `{"error":"contrasena_debil"|"contrasena_igual"}`.
2. Verificar `actual` con `password_grant(email_del_claim, actual)`; `InvalidCredentials` → **401** `{"error":"contrasena_actual_incorrecta"}` (rate-limit por tenant: es un oráculo de contraseña).
3. `PUT /auth/v1/user {"password": nueva}` con el **Bearer del usuario** → 200 ⇒ `{"ok":true}`. Mapear 422 `weak_password`/`same_password` a los códigos propios; 400 `reauthentication_needed` → 409 `reautenticacion_requerida` (hoy inalcanzable: flag off).
4. Cuenta sólo-Google (sin password local) → 409 `cuenta_sin_contrasena` **[UNVERIFIED: qué hace GoTrue]**.
No reenviar body/msg de GoTrue.

**`POST /auth/cambiar-email`** — body `{"nuevo_email": str, "contrasena": str}` (re-verificar con `password_grant`).
Respuesta **202** `{"pendiente": true, "nuevo_email": …}` (nunca "cambiado"). Errores: 422 formato · 409 `email_en_uso` (GoTrue 422 `email_exists`) · 401 password incorrecta · 409 `cuenta_sin_contrasena` para Google.
**Bloqueado por H1+H2** (infra + SMTP): no habilitar en prod hasta resolverlos, o la confirmación es inalcanzable y el usuario queda con `new_email` pendiente sin aviso.

**`cuenta_google` en `GET /me`:** derivar de los claims que ya llegan: `cuenta_google = "google" in claims["app_metadata"]["providers"]`
(y `solo_google = providers == ["google"]` para saber si tiene contraseña). Alternativa más fuerte: `GET /auth/v1/user` → `identities[].provider`.
Shape verificado sólo para email; para Google **[UNVERIFIED]** — verificar con una cuenta Google real en el go-live antes de cerrar.

## Scripts (idempotentes, con teardown)

- `run-remote.sh` — en el VPS: `up` (crea stage/env con secretos aleatorios y levanta), `matrix`, `extra`, `sinsmtp`, `down` (`down -v` + borra stage + verifica).
- `docker-compose.k12-override.yml` — mailpit + las vars de GoTrue que el compose de prod no expone (reusa `deploy/copiloto/gotrue/docker-compose.gotrue.yml` sin modificarlo).
- `matrix.py` (escenarios A–E), `extra.py` (reauth con sesión vieja, links de confirmación, redirect_to), `sinsmtp.py`.
- Lanzamiento: `ssh unreal-copilot 'mkdir -p /tmp/gotrue-k12'`; `scp` de `docker-compose.gotrue.yml`, `Caddyfile`, `init-auth-schema.sql` (de `deploy/copiloto/gotrue/`) y de los archivos de este directorio a `unreal-copilot:/tmp/gotrue-k12/`; luego `ssh unreal-copilot 'cd /tmp/gotrue-k12 && sed -i "s/\r$//" *.sh *.py *.yml && bash run-remote.sh up && bash run-remote.sh matrix; bash run-remote.sh down'`.

## NO verificado (explícito)

Cuenta Google real (4c) · click sólo en el link del mail viejo con `SECURE=true` · destino real del link con `redirect_to` ajeno (H4) ·
si GoTrue loguea el fallo de envío sin SMTP · env real de prod · default de `SECURE_EMAIL_CHANGE_ENABLED` sin setear ·
`PUT /user {password}` sobre cuenta sólo-Google · rate limits de GoTrue sobre `PUT /user`.
