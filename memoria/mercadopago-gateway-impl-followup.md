---
name: mercadopago-gateway-impl-followup
description: "MercadoPagoGateway — 2º boundary de pagos del Copiloto. E2E VIVO (connect vendedor + cobro real + webhook, probado por el operador 2026-07-04). LEER al retomar pagos/cobros/BI."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**`MercadoPagoGateway` = impl real de cobros del Copiloto — 2º boundary de integración externa, hermano del `ComposioGateway`.**

**✅ E2E VIVO — confirmado por el operador (2026-07-04):** connect del vendedor (OAuth) + **cobro real** + webhook x-signature probados end-to-end en prod; **lo implementó y probó el operador él mismo**. El flujo de cobros del Copiloto está OPERATIVO (no "cableado pero sin E2E" como decía este archivo). Único posible pendiente = **homologación** go-live de MP (proceso externo de MP, `[ASSUMED_PENDING_VERIFY]`) — no bloquea el flujo funcional. Los ítems de "FALTA cablear" de abajo quedan **RESUELTOS** (referencia histórica).

**✅ CONSTRUIDO (2026-07-03, rama `feat/mercadopago-gateway`, PR #110, sprint SDD 8 tasks TDD).** Suite VPS **69 passed / 0 failed**; live smoke con secretos reales OK (crypto + credential store cifrado vs DB real + connect_url + verify_webhook). Review opus = APPROVE WITH FIXES (0 critical; H1 fail-open de `mp_charge` sin MP + M1 `expires_at` absoluto + L2/L3 ya fixeados). **Fix de raíz clave:** `mp_charge` debe estar en `ACTIONS` de `types.py` o `Intent.from_dict` lo degrada a `clarify` (el path real usa from_dict; los tests que arman `Intent(...)` directo NO lo cazan) — se registró espejando a `book` (capacidad de 1ra clase con gateway propio, NO Composio-`tool_action`).
- **Archivos:** plantilla `.../reference/clients/agent/providers/{crypto,mercadopago_gateway,mp_refresh_workflow,mp_refresh_activities}.py`; cliente `apps/copiloto/{mp_credential_store,mp_payment_store,mp_web,mp_connect}.py` + `uc_tables.json` + `mp_indexes.sql` + dispatcher/system_prompt/worker_b. Tablas `uc_factory.mp_credentials`/`mp_payments` provisionadas (RLS + índices únicos). `copiloto.env` poblado (MP_* + MP_FERNET_KEY).
- **FALTA cablear (deploy, NO código) → `uc-copiloto-b/docs/Follow up/2026-07-03-mercadopago-gateway-post-sprint-open-items.md`:** uvicorn+Caddy sirviendo `create_mp_app` · registrar `MpRefreshWorkflow`+`refresh_credential` en un worker **llamando `set_refresh_deps`** · poblar `MP_SELLER_USER_ID` al conectar · plegar `mp_indexes.sql` al provisioning (M2) · OAuth authorize interactivo del vendedor · homologación go-live dinero real `[ASSUMED_PENDING_VERIFY]`.
- **Loop de dev del sprint:** `scratchpad/mp_sync_test.sh` (sync worktree→`/opt/uc-copiloto-stage`→pytest en `/opt/uc-copiloto-venv`). Tests SOLO en el VPS.

**Follow-up de decisiones (previo):** `uc-copiloto-b/docs/Follow up/2026-07-02-mercadopago-gateway-impl-followup.md`.

**Por qué MAYOR:** boundary/contrato nuevo + **storage cifrado de tokens por vendedor** (multi-tenant + RLS) + ciclo de refresh **rotante** (persistencia atómica o se desvincula el vendedor) + activities Temporal + endpoint webhook productivo. Irreversible con costo bajo una vez que hay tokens de vendedores reales.

**Fundación ya validada (no rehacer):** el spike (PR #106, [[mercadopago-integracion-research]]) probó E2E: OAuth **sin homologación bloqueante** (onboarding = 1 clic "Conectar"), token 180 días, **refresh rota single-use**, firma webhook (manifest SIN `.lower()`, vía SDK), dos apps (sandbox 6186… vs prod 8344…).

**Contrato tentativo del boundary:** `connect_url` · `exchange_code` · `refresh` · `create_payment_link`→init_point · `get_payment` · `search_payments` (BI, ventana 12m) · `verify_webhook` (SDK). Fail-closed, per-tenant.

**✅ DECISIONES CERRADAS (2026-07-02, doc `uc-copiloto-b/docs/copiloto-emprendedor/2026-07-02-mercadopago-gateway-decisiones-diseno.md`, fundadas en investigación de precedentes):**
- **Cifrado en reposo = App-level Fernet** (operador). Token no es columna-clave → RLS-safe; **descarta pgcrypto** (regla existente `hardening_reference.sql`: rompe RLS). No hay helper de cifrado hoy → se crea uno mínimo.
- **Refresh = loop durable proactivo Temporal** (operador), molde del arquetipo `recurring_charge` (NO hay Temporal Schedules en el repo). Persiste par rotado atómico.
- **RLS = patrón `uc_factory`** (`cliente_id`+RLS+namespacing `mp_`) PERO barrera real = **filtro `cliente_id` explícito en cada query** (worker=owner **bypassa RLS**, ver `reply_store.py`) + **test adversarial** (regla dura).
- **Tácticas:** onboarding MVP=hand-link (como Composio); webhook prod vía SDK idempotente por `payment_id`; BI por `external_reference` (12m). Tabla `mp_credentials`.
- **Hallazgo raíz:** NO hay precedente de guardar tokens propios (Composio los custodia) → 1er boundary que persiste credenciales.
- **`[ASSUMED_PENDING_VERIFY]`:** ¿go-live real exige homologación? (OAuth no; alta de marketplace productivo puede tener paso aparte).

**Condición de arranque del BUILD:** cuando se priorice pagos/BI → `superpowers:writing-plans` con el doc de decisiones como input (brainstorming YA no hace falta — decisiones cerradas). Propietario: operador.

**Deuda relacionada:** `tokens.json` prod vivo en el VPS → [[deuda-secretos-rotar]].

[[composio-gateway-ladrillo]] [[mercadopago-integracion-research]] [[copiloto-emprendedor-roadmap]] [[billing-system-sistema-compuesto]]
