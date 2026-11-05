# HALLAZGOS — auditoría de hardening (F2, corrida 2026-11-04)

> Ids `SEC-<frente>-<n>`. Severidad P0–P3 (plan §3). **Cada fila cita su evidencia** (carpeta
> `evidencia/2026-11-04/`). Estado: `ABIERTO` → `EN-FIX` → `CERRADO (verificado)` / `DIFERIDO` / `ACEPTADO`.
> Un hallazgo CERRADO exige re-medición con el MISMO instrumento (F4), no la afirmación del fix.
> Candidatos de Opus/Fable headless NO entran acá sin re-verificar con `path:línea`.

## Medido (F1)

| Id | Sev | Frente | Hallazgo | Evidencia | Estado |
|---|---|---|---|---|---|
| SEC-A1-1 | **P1** | A1 | `ufw` **inactivo** y `INPUT ACCEPT`; el host expone `0.0.0.0:3000` (clinic-frontend), `:8090` (uvicorn `clinic_bff` en 0.0.0.0) y un socat `s6port` que publica Postgres (`55444→5432`). 3000 y 8090 **alcanzables desde internet** (probado con TCP connect). | `vps/C1_ufw.txt`, `vps/C1_puertos_escuchando.txt`, conexión directa | ABIERTO |
| SEC-A1-2 | **P1** | A1 | sshd con `PasswordAuthentication yes` (hay 2 llaves en root), `X11Forwarding yes`, `MaxAuthTries 6`, `ClientAliveInterval 0`. Mitiga fail2ban (jail sshd) — control compensatorio, no sustituto. | `vps/A1_sshd.txt` | ABIERTO |
| SEC-A1-3 | P2 | A1 | Las 3 unidades `uc-copiloto-{web,worker,worker-soporte}` corren como `root`, `NoNewPrivileges=no`, sin `ProtectSystem/Home/PrivateTmp`, todas las capabilities. `systemd-analyze security` = **9.6 UNSAFE** las tres. | `vps/A1_systemd_security.txt` | ABIERTO |
| SEC-B1-1 | **P1** | B1 | Kernel en ejecución `6.8.0-52`; instalado `6.8.0-147` (≈95 versiones de kernel sin reiniciar). `reboot-required` presente (libc6 + linux-image). **125 paquetes** pendientes (5 de seguridad directos). `unattended-upgrades` activo pero sin reinicio → parches instalados no aplicados. | `vps/B1_os.txt`, `B1_apt_pendientes*.txt`, `B1_needrestart.txt` | ABIERTO |
| SEC-C3-1 | P2 | C3 | `/docs` (Swagger UI) y `/openapi.json` **públicos** en el front-door: expone los **97 paths** de la API. (Verificado por contenido: JSON OpenAPI 3.1 real.) | `externo/` + curl | ABIERTO |
| SEC-C2-1 | P2 | C2 | El front-door no envía **ninguna** cabecera de seguridad (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy). Sí redirige 80→443 (308). `Server: uvicorn` visible. | `curl -I` en `externo/` | ABIERTO |
| SEC-C3-2 | P3 | C3 | El HTML expone `data-build-sha` (versión exacta del build). | curl `/` | ABIERTO |
| SEC-A2-1 | P2 | A2 | Postgres 17.6 con `ssl=off` y `listen_addresses=*`; `log_connections=off`. El tráfico copiloto→DB viaja por red privada (`10.0.0.3`), pero sin TLS. | `vps/A2_postgres.txt` | ABIERTO |
| SEC-A2-2 | P2 | A2 | En `public`: 11 tablas → 1 sin RLS (`tasks`), 7 con RLS **sin FORCE**, 3 con FORCE. Roles `copiloto_consola` y `copiloto_autosanacion` con `BYPASSRLS` (verificar si es por diseño y si el path de la consola está acotado). Aislamiento sin test adversarial = `[UNVERIFIED]` (regla dura global). | `vps/A2_postgres.txt` | ABIERTO (clasificar por tabla en F2) |
| SEC-A5-1 | **P1** | A5 | **Dependabot alerts y security updates DESACTIVADOS** en el repo público → ningún CVE de dependencias llega al equipo. Explica que el estado de CVE nunca se midiera. | `repo/repo-settings.json`, `repo/dependabot.err` | ABIERTO |
| SEC-B1-2 | **P1** | B1 | Dependencias Python: 27 vulnerabilidades en 6 paquetes (`pyjwt`, `cryptography` tocan auth/cripto fiscal; `PYSEC-2026-4146` de pyjwt sin versión de fix). | `deps/pip-audit.json` | ABIERTO — **condicionado** (ver §Condiciones) |
| SEC-B1-3 | P1 | B1 | npm, instrumento `npm audit` en la **raíz** (lock de la raíz, cubre workspaces `apps/mobile`+`packages/*`; 1267 deps): 3 críticas/15 altas (`--omit=dev`: 1 crítica/14 altas; dev-only: `vitest`, `tinypool`, `vite`). `apps/copiloto-web` (lock propio): 2 críticas/7 altas. Directa que viaja a mobile: `expo-router`; resto transitivas de `expo`/`@expo/cli` (tooling de build, no bundle). **CORRECCIÓN 2026-11-04:** una cifra previa «1113 paquetes, 2c/5a» salió de un árbol temporal armado sólo con `apps/mobile/package.json` (resuelto contra el registro, SIN el lock de la raíz) → mide otro árbol; **descartada**. Un bump en mobile exige regenerar el `package-lock.json` de la raíz y verificar el `version` resuelto dentro del lock. | `deps/npm-audit-_.json`, `deps/npm-audit-raiz-omit-dev.json` | ABIERTO |
| SEC-C6-1 | 📄 | C6 | `gitleaks` por defecto **no detecta** el token real de 60fps (Bearer en `.mcp.json`, `39decb95`): el único hit de 4004 commits es un canario sintético (`secreto-sintetico-descartable-2.txt`). Instrumento ciego a `Authorization: Bearer`. Token ya aceptado como riesgo por el operador. | `repo/gitleaks-all.json` | ABIERTO (regla custom) |
| SEC-A5-2 | P3 | A5 | `delete_branch_on_merge=false`; un colaborador con `write` (`martinacairo`). Ruleset activo `main-exige-pull-request`; `branch protection` clásica ausente (el ruleset cubre PR). Secret scanning + push protection **activos**. Actions: permisos por defecto `read`. | `repo/*.json` | ACEPTADO/MEJORA |
| SEC-A6-1 | P2 | A6 | ~30 contenedores `copiloto-test-*` (gotrue/db/mailpit por sesión) conviven con el stack vivo en el mismo host, `restart=unless-stopped`, sin usuario no-root en las DB. Aumentan superficie y se reinician tras un reboot. | `vps/A6_docker_inspect.txt` | ABIERTO |
| SEC-C11-1 | OK | C11 | `/etc/unreal-copilot` 700 y los 11 `.env` 600 `root:root`. Sin hallazgo. | `vps/C11_permisos_secretos.txt` | CERRADO (medido) |
| SEC-C3-3 | OK | C3 | `/.env`, `/.git/config`, `/admin`, `/debug`, `/metrics` devuelven el **fallback de la PWA** (mismo largo que una ruta inventada), no contenido sensible. | curl con ruta aleatoria de control | CERRADO (medido) |

## Decisiones / aclaraciones de alcance
- Hosts sslip: `mp.*` 0 requests/14 d (el operador confirma: sin tráfico de MP en beta) → **se conserva**; `copiloto.*` es `GOTRUE_SITE_URL`, retirarlo rompe auth → **se conserva**. Ambos a `DECISIONES-OPERADOR.md`.
- Otras apps del VPS (documed, clinic-agent, wa-sender…): el operador confirmó que **no están activas ni en producción** → cerrar sus puertos no afecta a nadie.

## Condiciones para el bump de deps (peer planificación, 2026-11-04)
`pyjwt`/`cryptography`: no se bumpean sin test adversarial de auth **corriendo después**; rollback escrito; smoke 39/39 + durabilidad 8/8 posteriores; no leer `cert_enc`/`key_enc` ni imprimir `DATABASE_URL`; coordinar con la sesión backend (`requirements.txt` y venv del VPS son suyos).

## Actualización 2026-11-05
- **SEC-A2-2 (ratchet 42→0):** `test_adversarial_frontdoor_por_ruta.py` ejercita las 42 rutas tenant-scoped con dos tokens y factories espía: sin identidad → 401/403 sin tocar datos; con el token de A y el `cliente_id` de B inyectado (query/header/path) → B jamás aparece. Gate local en VPS: 76 passed. **Control negativo:** con la identidad leída del query, 6 tests fallan (mutación detectada). **LÍMITE:** 40 de las 42 rutas cortan en 422 antes de la capa de datos (sin body válido), así que para ellas sólo queda probada la mitad «sin identidad»; la mitad cross-tenant profunda exige fixtures con body por ruta → ficha `SM-S` pendiente. Estado: PARCIAL (no CERRADO).
- **nmap -p- desde la PC (C1): INVÁLIDO.** Reportó 25/110/119/143/465/563/587/993/995 «open» sin banner y con 1,2 ms de latencia hacia Hetzner, y NO vio 22/80/443; el control positivo (443 visible) falló y el host no escucha ninguno de esos puertos (`ss -ltn`). Es un proxy local de correo de la PC. Cierre externo: probado por conexión TCP directa (3000/8090/55444 cerrados). Repetir el escaneo desde otra red queda como mejora.
- **SEC-A6-1:** borrados 21 contenedores `copiloto-test-*` de septiembre (4 `auth` en bucle de restart). Volúmenes intactos.

## Clasificación RLS (SEC-A2-2, medido 2026-11-05)
- **Esquema `public` (11 tablas):** `accounts customers employees expenses invoices subscriptions tickets tasks` son de OTRA app de la instancia compartida (dueño `postgres`); el rol del copiloto (`uc_factory`) recibe `permission denied` al leerlas → fuera del límite de confianza del copiloto, inalcanzables desde su runtime. `tenants`, `user_tenants`, `_internal_api_keys` ya tienen FORCE. `tasks` sin RLS: tabla ajena, **decisión del operador** (FORCE/retiro exige superuser = MAYOR).
- **Esquema `uc_factory` (86 tablas):** las 21 `copiloto*` tienen RLS+FORCE. De las 52 con RLS sin FORCE, sólo DOS las usa código del copiloto: `tenants` (sin FORCE POR DISEÑO: es la tabla que resuelve el tenant, no puede estar sujeta al control) y `mp_link_dedup`, que estaba con RLS **sin policy** y sin FORCE → el owner la bypasseaba. **CERRADO (verificado por efecto en prod + test adversarial real con control negativo NO FORCE → 2 fallan).** El resto (`clinic_*`, `documed_*`, `billing_*`, …) pertenece a otras apps no activas.
- **Roles `copiloto_consola` / `copiloto_autosanacion` con BYPASSRLS:** el rol del runtime es `uc_factory` (`rolbypassrls=false`); estos dos son de los paths de consola/autosanación → sigue pendiente verificar que su acceso esté acotado (ficha).

