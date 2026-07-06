---
name: stack-canonico-real-sdk
description: Stack canónico 4 plataformas + app real-SDK validada E2E contra instancias vivas + doctrina flujo C para contratos externos
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**2026-06-22.** La fábrica genera y valida E2E apps del **stack canónico de 4 plataformas** (Temporal backend + Supabase + Graphity + frontend), con gate multi-jaula (router por cage: python `:2` / temporal `:1` test-server / browser `:1` Playwright), layout no-flat (`backend/clients/frontend`, cage DERIVADO del path), frontend done-by-test (Chromium real + data-testid). `loop_core` intacto.

**Doctrina canonizada por el operador (feedback fuerte):** **flujo C es el workflow por defecto para apps con contratos externos precisos** (SDK/API reales). Nosotros (senior) diseñamos el contrato — stubs+tests FIELES validados por spikes — y la fábrica solo RELLENA. *Dale el plano, no la orden.* El flujo default (Claude andamia los tests) sirve para apps auto-contenidas pero **deriva/rompe** para contratos externos (en el e2e real-SDK Claude escribió un test imposible: `assert headers["x-api-key"]` case-sensitive vs urllib que capitaliza + contrato `from_id` inventado en vez del real `name`/`episode_body`). El gate solo vale lo que vale el test. Ver [[localizacion-estructurada-feedback-agentes]] y [[no-codificar-la-esperanza-principio-raiz]].

**Mejora de fábrica:** `read_skeleton` extendido a layout canónico (`skeleton/{backend,clients,frontend}/*.py` recursivo → cage por path, test junto al módulo, deps dotted, copia + `__init__.py`). flat byte-idéntico. Commit `1d6e486`. Es el modo correcto que destraba "flujo C + multi-jaula".

**Fix de raíz (`7665bb4`):** `_integrate` canónico corría el test dotted crudo del repo contra `solution.py` flat → ModuleNotFoundError → 4 capas ROJA (`integration_failed`, e2e3). Fix DRY: `patch_test_imports` extraído a `factory_kit` (fuente única, consumido por `build_unit` Y `_integrate`). Review ultracode 0 bloqueantes. → e2e4 COMPLETED + PR real merged.

**La validación POST-gate caza bugs cross-capa que los fakes del gate enmascaran** (valida la división del operador): en e2e4 la activity hacía `await` sobre un método sync del store (el fake era async) → falló en cluster real → auto-healing por rama → verde. Es la deuda gestionada m3 (ninguna jaula tiene las 4 plataformas → integración real = POST-gate por Claude/control-plane).

**Flujo completo logrado E2E (`uc-stack-real`, PR #1 merged):** generar (flujo C, esqueleto fiel, 4/4 flash ~$0.005) → sacar de la jaula → **validar contra instancias REALES: Supabase fusion (fila Postgres real) + Graphity API real (uuid real) + Temporal cluster real (workflow COMPLETED, cross-layer con Supabase) + frontend Chromium → ALL PASS, cero auto-heal** → el código en GitHub ES la app validada. Frontera intacta: clients usan SDKs reales por INYECCIÓN → la jaula nunca importa el SDK ni ve la key; SDK+creds solo en la validación POST-gate (control-plane).

**Accesos:** fusion Supabase self-host VPS `89.167.20.226:8000` (Kong HTTP), tabla `public.tasks`, creds en `~/.claude/secrets/fusion_supabase.env` + `/etc/unreal-copilot/fusion-supabase.env`. Graphity `graphitymt.duckdns.org/api/v2/graph/{episodes,search}`, header `x-api-key`, creds en `deepseek-worker.env`. Venv de validación `/opt/uc-val-venv` (supabase 2.31 + temporalio 1.28).

**Deuda gestionada LOW:** `patch_test_imports` solo cubre `from X import` (no `import pkg.module` self-ref) — latente, pagar si una app lo usa. Owner: operador. **Pendiente:** rotar las keys que pasaron por sesiones (PATs, OpenRouter) sigue vigente.

Reporte completo: `docs/Implementaciones terminadas/2026-06-22-stack-canonico-4-plataformas-real-sdk_reporte.md`. Rama `feat/stack-canonico-4-plataformas` (commits `7665bb4`·`1d6e486`·`e8ef608`).
