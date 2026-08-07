# HANDOFF — Copiloto del Emprendedor

> **Punto de entrada del repo.** Todo lo necesario para arrancar una sesión limpia con **cero fricción**
> y seguir trabajando como si nunca hubieras salido. Si es tu primera vez acá, leé §1 y §2 y ejecutá el init.
> Idioma: instrucciones/comentarios en español; código e identificadores en inglés.

---

## 0. Qué es (30 segundos)

**Copiloto del Emprendedor** = un **agente conversacional durable multi-tenant** para emprendedores: chatea por
web/PWA (y voz), conecta sus servicios (MercadoPago, Gmail, Google Calendar/Sheets/Docs/Drive, HubSpot,
Instagram…) vía gateways, y ejecuta tareas concatenadas con confirmación humana (HITL) sobre un motor **ReAct**
corriendo en **Temporal** (durable: sobrevive cortes, reintenta, no pierde estado). Tiene memoria conversacional
(Graphity), auth propia (GoTrue dedicada) y BI básica de pagos.

**Origen:** se **graduó a repo propio el 2026-07-06** desde la fábrica `unreal-copilot` (driver: separación
comercial/producto). El motor conversacional agnóstico se **vendorizó** en `motor/` (patrón vendorizar-con-sync);
todo lo demás es la capa producto.

**Moat / identidad:** automatización + agentes-IA **durables** (orquestación Temporal). Frontend fino de gestión,
sí; frontend-pesado-como-producto, no.

---

## 1. Estado actual (2026-08-07)

> **El tablero de frentes vivo es `coordinacion/PLAN.md`** (COLA-VIVA + `scripts/cola-check.sh`), no
> esta tabla: acá va lo estructural, que cambia poco. Si los dos discrepan, **gana el tablero**.

| Frente | Estado |
|---|---|
| **🌐 El repo es PÚBLICO** | Desde el **2026-08-06**, por decisión del operador (Actions gratis e ilimitado; el CI se había vuelto cuello de botella). **Cambia el costo de un error, no la regla:** un `.env` mal commiteado es público en el instante del push. Auditoría de toda la historia: **0 secretos**. Ver `CLAUDE.md` §cabecera. |
| **Sprint BETA + sprint M-WEB** | ✅ **Cerrados el 2026-08-05**, verificados independientemente. Los dos gates de BETA-5 satisfechos — falta sólo que el operador mande las invitaciones a los 10-15 testers. |
| **CI propio (ADR-001)** | ✅ **Cerrado 2026-08-06**, ADR `ACCEPTED`. La definición de la suite ya **no vive en GitHub**: `scripts/ci/{backend,core,web,mobile,lint}.sh` + `scripts/gate.sh` (escribe recibo `.ci-recibos/<sha>.json`) + guard `no-drift.sh`. Actions es respaldo/atestación. Nació de un outage `critical` de 5 h con los webhooks al 15%. **Deuda PAGADA el 2026-08-07 por backend**, con control positivo: el bare del VPS existía pero `main` nunca había llegado (`does not have any commits yet`). Tras `setup-vps-mirror.sh main`, verificado por SSH en `8d040e4`, idéntico a `origin/main`. |
| **Sprint CONSOLA DE OPERADOR** | 🔥 **En curso.** CONS0a/0b/1/2/3/4 y CONS5 cerrados; CONS6 arrancable; CONS7 con contrato bajado. Estado real → `coordinacion/PLAN.md`. |
| **Graduación Fase 0+1+2** | ✅ Hecha. Repo propio `github.com/theoriginalcustodian/copiloto-emprendedor`, 123 commits con historia preservada (filter-repo). Motor vendorizado en `motor/` (**fork duro** desde 2026-07-07: no se sincroniza más con la fábrica). |
| **Copiloto vivo (prod-beta)** | ✅ Desplegado en el VPS, multitenant real, smoke E2E 10/10 (BETA-READY). Corre desde `/opt/uc-repos/copiloto`, **deployado desde ESTE repo** (cutover hecho 2026-07-06). |
| **Fase 2.5 — cutover del deploy** | ✅ **Hecho (2026-07-06).** El servicio vivo corre desde este repo (layout `motor/`; PYTHONPATH del proceso verificado en `/proc/PID/environ`; `reference` viejo eliminado). Smoke E2E **10/10 BETA-READY** post-switch. Backup del origen previo: `/opt/uc-repos/copiloto.bak-pre-graduacion-20260706T141252Z`. |
| **Fase 3 — infra 3 nodos dedicados** | ⏳ Diferida (hoy comparte VPS con la fábrica). Ver `memoria/copiloto-arquitectura-prod-3-nodos.md`. |

**Deudas abiertas relevantes:** secretos a rotar pre-prod (`memoria/deuda-secretos-rotar.md`) · passwords temporales de GoTrue · `dispatcher_emprendedor` divergente del genérico R1 (deuda visible, registrada).

> ⚠️ **Si trabajás en el checkout compartido de las tres sesiones, leé esto antes de commitear.**
> Esa rama (`docs/production-readiness-brief`) tiene merge-base con `main` en el **24 de julio**: 237
> commits y 697 archivos de retraso. Pierde en las dos direcciones — lo que commiteás ahí **no llega
> a `main`** (ni al grafo de código, que ingesta `main`), y las herramientas que sirve el cwd (hooks,
> slash commands, scripts) son las de entonces. **Docs y memoria: escribilos en un worktree desde
> `origin/main` y abrí PR.** Detalle y controles en
> `memoria/el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama.md`.

---

## 2. Init cero-fricción (primera vez en este checkout)

```bash
# 1) Cloná (si no lo tenés) — checkout esperado: sibling de unreal-copilot
git clone git@github.com:theoriginalcustodian/copiloto-emprendedor.git
cd copiloto-emprendedor

# 2) Sembrá la memoria del proyecto en el slug de auto-memory de Claude Code
#    (idempotente; deja el índice + las ~163 entradas vivas donde el harness las levanta)
./scripts/seed-memory.sh

# 3) Apuntá a la fábrica para poder sincronizar el motor vendorizado (ver §4)
#    (dejalo en tu shell profile si trabajás seguido con ambos repos)
export UC_FABRICA_PATH="../unreal-copilot"     # checkout de la fábrica; ajustá si está en otro path

# 4) Abrí el repo en Claude Code → la memoria y este HANDOFF cargan solos.
#    Los tests/deploy corren EN EL VPS (la PC no tiene temporalio/psycopg2): ver §5.
```

Requisitos de la PC: `git`, `bash` (Git Bash en Windows), `ssh` con el alias **`unreal-copilot`** configurado
(`~/.ssh/config` → root@178.105.191.1). **No** necesitás Python/deps en la PC: todo lo que importa el stack
corre en el venv del VPS.

---

## 3. Arquitectura de 1 vistazo

```
Usuario (web/PWA, voz)
      │  HTTPS  copilotoemprendedor.duckdns.org  (Caddy → 127.0.0.1:8099)
      ▼
apps/copiloto  ── front-door FastAPI multitenant (serve.py / web.py)
      │           · auth JWT (GoTrue dedicada, docker `copiloto-auth`)
      │           · /chat /chat/audio /catalog /connect /me /signup /mp/*
      ▼
Temporal (127.0.0.1:7233)  ── ConversationWorkflow (motor ReAct DURABLE) + MpRefreshWorkflow
      │           worker_b.py registra workflows+activities, atado al tenant
      ▼
motor/  (VENDORIZADO)  ── backend/agent (runtime, workflow, activities, router)
      │                   clients/agent (channels/web, providers: llm, composio_gateway,
      │                   mercadopago_gateway, stt, crypto, datetime_resolver)
      ▼
Servicios: MercadoPago (gateway directo, OAuth) · Composio (Gmail/Calendar/Sheets/Docs/Drive/HubSpot/IG)
Memoria:   Graphity (aislada por tenant) · Persistencia: Postgres (fusion) · STT: Groq Whisper
```

**Boundary del motor:** `apps/copiloto/_paths.py` es la **fuente única** del mount — resuelve `motor/` (o el env
`UC_MOTOR_REF_PATH`) y lo agrega a `sys.path` vía `ensure_paths()`, que llaman los 4 entry points
(`serve`, `web`, `worker_b`, `provision`). En el VPS el systemd además setea `PYTHONPATH=.../motor:.../deploy/worker`
(doble cinturón). **Graduar/mover el repo NO toca los 56 archivos del backend** — solo el default de `_paths.py`.

---

## 4. Mapa del repo

```
copiloto-emprendedor/
├── HANDOFF.md              ← este archivo (punto de entrada)
├── CLAUDE.md               ← constitución del producto
├── apps/
│   ├── copiloto/           ← backend front-door + worker (serve.py, web.py, worker_b.py, provision.py,
│   │                          services/, tool_catalog.py, context_factory.py, _paths.py, conftest.py, tests/)
│   └── copiloto-web/       ← cliente PWA (Vite; build servido mismo-origen por _mount_spa)
├── motor/                  ← MOTOR VENDORIZADO (arquetipo conversational_agent de la fábrica)
│   ├── backend/agent/      ← runtime durable, conversation_workflow, activities, inbound_router
│   └── clients/agent/      ← channels/web, providers (llm, composio_gateway, mercadopago_gateway, stt…)
├── deploy/
│   ├── copiloto/           ← deploy.sh, uc-copiloto-{web,worker}.service, smoke_beta_e2e.py,
│   │                          sync-web.sh, sync-test-backend.sh, fetch-fonts.sh, Caddyfile.snippet,
│   │                          gotrue/ (GoTrue dedicada: deploy-gotrue.sh, migrate-and-cutover.sh, compose…)
│   └── worker/             ← provision_tables.py (infra-fábrica compartida)
├── scripts/
│   ├── seed-memory.sh      ← siembra memoria/ en el slug de auto-memory (init)
│   └── sync-motor.sh       ← reconcilia motor/ con la fábrica (check|sync)
├── docs/                   ← diseño, planes, decisiones (incl. copiloto-emprendedor/)
├── memoria/                ← memoria del proyecto (MEMORY.md ~163 vivas + HISTORIA.md 66 bajadas + checkpoints)
├── requirements.txt        ← pin de deps del venv de prod (fuente: pip freeze del VPS)
└── .github/workflows/      ← CI (backend: colección+unit; frontend: build)
```

---

## 5. Cómo trabajar (todo server-side; la PC solo edita)

> **Regla dura:** los tests corren **EN EL VPS** (`/opt/uc-copiloto-venv`, Python 3.12) — la PC no tiene
> temporalio/psycopg2. No declarar "verde" sin haberlo corrido en el VPS. `memoria/tests-se-corren-en-vps.md`.

### 5.1 Tests
```bash
# Dev-loop: sincroniza a un STAGE aislado del VPS y corre pytest (NO toca el vivo). Idempotente.
bash deploy/copiloto/sync-test-backend.sh                 # default: "tests -q"
bash deploy/copiloto/sync-test-backend.sh tests --co -q   # solo colección (valida imports/mount del motor)
bash deploy/copiloto/sync-test-backend.sh tests/test_dispatcher.py -v
```

### 5.2 Deploy (backend + frontend, idempotente, desde la PC)
```bash
bash deploy/copiloto/deploy.sh        # sync worktree→VPS + build PWA + provision + units + Caddy + smoke [7/7]
bash deploy/copiloto/sync-web.sh      # SOLO frontend (sync+build del PWA; correr DESPUÉS de deploy.sh)
```
Parametrizable sin editar (cero hardcoding): `UC_DEPLOY_HOST`, `UC_DEPLOY_PATH`, `UC_ENV_DIR`, `UC_VENV`,
`COPILOTO_WEB_PORT`, `UC_BASE_DOMAIN`, `UC_AUTH_URL`. Secretos viven server-side en `/etc/unreal-copilot/*.env`,
nunca bajan a la PC ni al repo.

### 5.3 Cutover del servicio vivo a ESTE repo (Fase 2.5 — ✅ EJECUTADO 2026-07-06, 10/10 verde)
Ya ejecutado: el copiloto vivo corre desde este repo graduado. El runbook queda documentado como referencia
(re-deploy o repetir en otra instancia; una sola instancia, mismo dominio/DB/usuarios — solo cambia el origen):
```bash
# 0) backup del vivo (rollback instantáneo)
ssh unreal-copilot "cp -a /opt/uc-repos/copiloto /opt/uc-repos/copiloto.bak-pre-graduacion-$(date +%Y%m%dT%H%M%SZ)"
# 1) deploy desde este repo al mismo path vivo (units ya apuntan a motor/, verificado por spike)
bash deploy/copiloto/deploy.sh
# 2) smoke E2E extendido (evidencia real)
ssh unreal-copilot "/opt/uc-copiloto-venv/bin/python /opt/uc-repos/copiloto/deploy/copiloto/smoke_beta_e2e.py"
# ROLLBACK si algo falla: restaurar el .bak + systemctl restart uc-copiloto-{web,worker}
```

### 5.4 Smoke / verificación
```bash
ssh unreal-copilot "/opt/uc-copiloto-venv/bin/python /opt/uc-repos/copiloto/deploy/copiloto/smoke_beta_e2e.py"  # 36/36 = BETA-READY
```

> El `10/10` que decía acá quedó viejo en CONS8: el smoke incorporó el bloque `consola` (6 adversariales
> con control positivo + los dos ciclos mutar→auditar), y pasó a **30 checks**. CTA4 (2026-08-07) sumó
> el bloque 11 (artefacto de la web servida, 4 checks) → **36**. Un número esperado que envejece es
> peor que ninguno — te hace leer `26/30` como "sobran 20" en vez de "faltan 4".

### 5.5 Entrar a la Consola de operador

**La consola NO tiene URL propia**: es un tab dentro de la app web (`Consola`), que sólo aparece si tu
token trae el claim de administrador. No existe en mobile.

```bash
# 1) Otorgar el claim (idempotente — PUT que MERGEA app_metadata, no un toggle).
#    Requiere que la cuenta YA exista en GoTrue: esto otorga el claim, no crea usuarios.
bash deploy/copiloto/asignar-claim-admin.sh <tu-email>

# 2) RE-LOGIN OBLIGATORIO en https://copilotoemprendedor.duckdns.org
#    El JWT es un snapshot del momento en que se emitió: el token viejo NO refleja el claim nuevo.
#    Sin este paso el grant parece haber fallado, y no falló.

# 3) Aparece el tab «Consola» (TabBar.tsx, único con `soloAdmin: true`).
```

**Por qué el claim vive en `app_metadata` y no en `user_metadata`** (CONS0b, `auth.py:171`): se verificó
contra la GoTrue real que `user_metadata` es auto-editable por el propio usuario vía `PUT /auth/v1/user`
— un claim ahí sería **auto-otorgable**. `app_metadata` sólo se escribe con la Admin API, y los 3 intentos
de escalada probados fallaron los 3.

**Esconder el tab es cosmética, no es el control.** El gate real es `require_admin` server-side: 401 sin
Bearer, **403** con token válido sin el claim, en los 6 endpoints. Por eso el shell igual valida
`activeTab === 'admin' && esAdmin` al renderizar — si el claim se pierde, el contenido no queda colgado.

Para auditar quién es admin hoy (read-only, no muta nada):

```bash
ssh unreal-copilot 'set -a; . /etc/unreal-copilot/fusion-supabase.env; set +a; \
  curl -s "$SUPABASE_URL/auth/v1/admin/users?per_page=100" -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" | python3 -c "
import sys,json
for u in json.load(sys.stdin).get(\"users\",[]):
    if (u.get(\"app_metadata\") or {}).get(\"copiloto_admin\"): print(u[\"email\"])
"'
```

---

## 6. El motor (fork duro desde 2026-07-07)

`motor/` **nació** como copia vendorizada del arquetipo `conversational_agent/reference/` de la fábrica
`unreal-copilot` (patrón vendorizar-con-sync). El **2026-07-07 se declaró el FORK DURO**: el primer cambio
divergente fue `fix(motor-react)` — el copiloto arregló el bug del buffer de corto plazo del motor react (el
turno react no inyectaba `self._history` al prompt → amnesia entre turnos), fix que NO existe en la fábrica.

Desde entonces el copiloto **evoluciona el motor por su cuenta**: todo fix del motor se hace **acá**.
`scripts/sync-motor.sh` quedó **retirado** (fail-closed) — un `rsync --delete` desde la fábrica pisaría la
divergencia. Si algún día se quiere traer algo puntual de la fábrica, es a mano con un diff dirigido y revisado,
nunca un sync ciego.

---

## 7. Infra viva y accesos (punteros — el detalle en memoria/)

- **VPS:** alias SSH `unreal-copilot` → `178.105.191.1` (Hetzner, CX33 8GB). Copiloto vivo `/opt/uc-repos/copiloto`,
  venv `/opt/uc-copiloto-venv` (py3.12). `memoria/plataforma-agentica-estado.md`, `memoria/copiloto-deploy-multitenant-vivo.md`.
- **Dominio:** `copilotoemprendedor.duckdns.org` (Caddy → :8099). Legacy `copiloto.178-105-191-1.sslip.io` sigue vivo
  para callbacks de MercadoPago. `memoria/copiloto-dominio-duckdns.md`.
- **Auth:** GoTrue **dedicada**, docker-compose project `copiloto-auth` (gotrue+caddy+pg, :9997 loopback), Google
  OAuth live. `memoria/copiloto-gotrue-dedicada-cutover.md`.
- **Temporal:** `127.0.0.1:7233`, ns `default`. **Memoria:** Graphity (aislada por tenant, [VERIFIED]).
  `memoria/copiloto-memoria-provider-ladrillo.md`, `memoria/graphity-aislamiento-cross-tenant-verificado.md`.
- **EnvironmentFiles (secretos, server-side):** `/etc/unreal-copilot/{copiloto,fusion-pg,fusion-supabase}.env`.

---

## 8. Relación con la fábrica `unreal-copilot`

- **De dónde salió:** extraído con `git filter-repo` preservando historia. La fábrica sigue siendo la **fuente del
  motor** (vía `sync-motor.sh`) hasta el fork duro.
- **Qué comparte hoy:** el motor (vendorizado), el **VPS** (hasta Fase 3), y la **doctrina universal** — que NO se
  duplicó acá: vive en el `CLAUDE.md` **global** del operador y carga en toda sesión (incluida esta). Por eso la
  memoria migrada incluye entradas de la fábrica como *referencia histórica*, pero la doctrina de trabajo la trae
  el global, no `memoria/`.
- **Qué NO comparte:** la lógica del producto (apps/copiloto, deploy/copiloto, auth dedicada, dominio propio).

---

## 9. Qué sigue

1. **Fase 2.5 — ✅ hecha.** El vivo corre desde este repo (smoke 10/10 post-switch). Pendiente menor: tras
   confirmar estabilidad unos días, borrar el backup `/opt/uc-repos/copiloto.bak-pre-graduacion-*` del VPS.
2. **Fase 3** — infra de prod en 3 nodos dedicados (app+temporal / clon fusion / clon graphity) + load test.
   `memoria/copiloto-arquitectura-prod-3-nodos.md`.
3. **Producto** — retomar los frentes vivos del roadmap (voz, automatizaciones recurrentes, trazabilidad/BI).
   Índice completo en `docs/` y `memoria/copiloto-emprendedor-roadmap.md`.
```
