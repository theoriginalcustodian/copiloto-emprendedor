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

## 1. Estado actual (2026-07-06)

| Frente | Estado |
|---|---|
| **Graduación Fase 0+1+2** | ✅ Hecha. Repo propio `github.com/theoriginalcustodian/copiloto-emprendedor` (privado), 123 commits con historia preservada (filter-repo). Motor vendorizado en `motor/`. CI verde. |
| **Copiloto vivo (prod-beta)** | ✅ Desplegado en el VPS, multitenant real, smoke E2E 10/10 (BETA-READY). Corre **desde `/opt/uc-repos/copiloto`** (scp-seeded desde la fábrica, **no** desde este repo todavía). |
| **Fase 2.5 — cutover del deploy** | 🟡 **Preparado y verificado** (path del motor reconciliado `reference→motor` en deploy/units/scripts; spike de mount **333 colección VERDE** en el VPS). **Falta el switch final** del servicio vivo a este repo (runbook en §5.3). |
| **Fase 3 — infra 3 nodos dedicados** | ⏳ Diferida (hoy comparte VPS con la fábrica). Ver `memoria/copiloto-arquitectura-prod-3-nodos.md`. |

**Deudas abiertas relevantes:** secretos a rotar pre-prod (`memoria/deuda-secretos-rotar.md`) · passwords temporales de GoTrue · `dispatcher_emprendedor` divergente del genérico R1 (deuda visible, registrada).

---

## 2. Init cero-fricción (primera vez en este checkout)

```bash
# 1) Cloná (si no lo tenés) — checkout esperado: sibling de unreal-copilot
git clone git@github.com:theoriginalcustodian/copiloto-emprendedor.git
cd copiloto-emprendedor

# 2) Sembrá la memoria del proyecto en el slug de auto-memory de Claude Code
#    (idempotente; deja las 113 entradas + índice donde el harness las levanta)
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
├── memoria/                ← memoria del proyecto migrada (índice MEMORY.md + 113 entradas + checkpoints)
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

### 5.3 Cutover del servicio vivo a ESTE repo (Fase 2.5 — runbook)
Hoy el copiloto vivo corre desde `/opt/uc-repos/copiloto` (scp-seeded desde la fábrica). Para que corra desde
este repo graduado (una sola instancia, mismo dominio/DB/usuarios — solo cambia el origen del código):
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
ssh unreal-copilot "/opt/uc-copiloto-venv/bin/python /opt/uc-repos/copiloto/deploy/copiloto/smoke_beta_e2e.py"  # 10/10 = BETA-READY
```

---

## 6. El motor vendorizado (boundary con la fábrica)

`motor/` es una **copia** del arquetipo `conversational_agent/reference/` de la fábrica `unreal-copilot`. Se
mantiene alineado con `sync-motor.sh` hasta el **fork duro** (cuando el copiloto evolucione el motor por su cuenta):
```bash
./scripts/sync-motor.sh check    # reporta drift vs la fábrica (dry-run) — necesita UC_FABRICA_PATH
./scripts/sync-motor.sh sync     # trae cambios de la fábrica → motor/ (revisá el git diff y commiteá)
```
Regla: mientras el motor sea compartido, un fix del **motor** se hace en la fábrica y se sincroniza acá; un fix de
la **capa producto** (apps/copiloto, deploy) se hace acá. Cuando el copiloto diverja el motor deliberadamente,
documentar el fork duro y retirar el sync.

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

1. **Cerrar Fase 2.5** — ejecutar el cutover (§5.3) y confirmar el vivo corriendo desde este repo (smoke 10/10).
   Después, retirar el `/opt/uc-repos/copiloto` scp-seeded y actualizar este HANDOFF a "vivo desde el repo nuevo".
2. **Fase 3** — infra de prod en 3 nodos dedicados (app+temporal / clon fusion / clon graphity) + load test.
   `memoria/copiloto-arquitectura-prod-3-nodos.md`.
3. **Producto** — retomar los frentes vivos del roadmap (voz, automatizaciones recurrentes, trazabilidad/BI).
   Índice completo en `docs/` y `memoria/copiloto-emprendedor-roadmap.md`.
```
