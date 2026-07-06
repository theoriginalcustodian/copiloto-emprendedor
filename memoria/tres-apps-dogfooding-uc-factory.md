---
name: tres-apps-dogfooding-uc-factory
description: Sprint de 3 apps de dogfooding (feedback/mini-crm/alerting) E2E heal=0 + el sustrato multi-tenant uc_factory pagado one-time + lecciones del gate-agent. 2026-06-23.
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Sprint 3 apps de dogfooding por flujo C, 100% autónomo (`/goal` condición = 3 apps E2E).** 2026-06-23. Elegidas por cobertura de primitiva × instancia faltante (ROADMAP-apps): **feedback-form** (modo sin-backend + form/detalle P4), **mini-crm** (multi-entidad P1: contacts/deals/activities + FK + pipeline policy + dep cross-unit), **alerting-monitor** (Temporal durable + notifier P6). Las 3: **heal_turns=0, PR #1 MERGED** (verificado `gh pr view` MERGED, no solo el status del workflow). Materialización por wave de 3 Sonnet (skeletons flujo C); builds secuenciales (SeniorWorkflow + gate-agent autónomo firma los merge-gates, el operador no clickeó).

**El frente real del sprint NO fue el plano (dio heal=0) — fue el SUSTRATO multi-tenant, pagado ONE-TIME.** El operador eligió multi-tenant (convención fusion `cliente_id` uuid + RLS por `auth.jwt()`, igual que [[asistente-generar-plano]]/trial-tracker) → reinventé NADA: leí la convención del `account_store.py` ya construido de trial-tracker (add_*/list_* toman `cliente_id` 1er arg + insert/filtra; get/update por id; service_role bypassa RLS → aislamiento app-level). El acceso nuevo: rol dedicado **`uc_factory`** en fusion (schema propio, bloqueado en public/ARCA) + connection string Postgres directa en **`/etc/unreal-copilot/fusion-pg.env`** (VPS, chmod 600; el password viajó server-a-server, NUNCA por el chat).

**3 bloqueantes cazados por spike-first ANTES de quemar los builds (no codificar la esperanza):**
1. **El REST (PostgREST) no exponía `uc_factory`** → `validate.py` (supabase-py REST) no veía las tablas. Lo resolvió el agente de fusion (`PGRST_DB_SCHEMAS += uc_factory` + event-trigger que fuerza RLS en toda tabla nueva del schema). Sin el spike, los 3 `validate_real` reventaban.
2. **El rol no podía crear policies `auth.jwt()`** (permission denied schema auth) — primero quedaron tablas con RLS deny-default (seguro igual); tras el grant de fusion, las 6 policies `tenant_isolation` quedaron ok.
3. **El client REST necesita `schema=uc_factory` explícito** (`create_client(url, key, options=ClientOptions(schema="uc_factory"))`) — el default es `public`. Los 3 `validate.py` usan `os.environ.get("PGSCHEMA","uc_factory")`. Spike `REST_OK ... select=ok` confirmó que **service_role bypassa RLS** (insert+select sin policy) → multi-tenancy app-level, no por RLS para la fábrica.

DDL aplicado con psycopg2 desde el VPS (`apply_ddl.py`, idempotente, search_path uc_factory). **La próxima app multi-tenant NO repaga esto.**

**El gate-agent (juicio senior > tests) se ganó el sueldo:** cazó (a) bug REAL en mini-crm — `render_detail` lee `act.get('description')/('date')`, campos inexistentes (el modelo es `kind`/`notes`) → actividades renderizan vacío; los tests pasaban porque solo asertan la fila por `id` (**test laxo = lección del plano**); (b) drift doc: los 3 `REGLAS_NEGOCIO.md` dicen single-tenant (los escribió el sub-agente antes del cambio) mientras el código es multi-tenant. Ambos NO-bloqueantes → deuda gestionada → **✅ SALDADA 2026-06-23 (PR #69): la RAÍZ era el contrato del plano ("el contrato son los data-testid") que invitaba a tests de solo-presencia → endurecido (card frontend §2/§3 + README + test_stub: el test DEBE asertar CONTENIDO, no solo `.count()`); `validate_kit` 6/6. Síntomas D-1 (mini-crm `92d5bed`) + D-2 (feedback `fd43a4d`) fixeados en las apps.**

**Cosecha de arquetipos = NO disparada aún (regla de tres, anti premature-abstraction):** P4 form/detalle **2/3** (feedback+mini-crm), P6 notification **1/3** (alerting). El sprint avanzó instancias; las próximas apps (más P4/P6) completan. Confirma [[costo-incertidumbre-precision-ratchet]]: el senior trabajó al mínimo (heal=0) porque el plano fiel colapsó la incertidumbre upstream; su `validate_real`+gate sí corrieron (el airbag heal no se desplegó porque no hizo falta). Relacionado: [[apps-lifecycle-hitl-autonomo]] · [[stack-canonico-real-sdk]] · [[flujo-c-economia-baseline]]. Repos: `theoriginalcustodian/{feedback-form,mini-crm,alerting-monitor}`.
