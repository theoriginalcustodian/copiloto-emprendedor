---
name: tests-se-corren-en-vps
description: "Los tests se corren en el VPS, NO en la PC: la PC no tiene temporalio/psycopg2. Patron = sync + pytest en el venv del VPS. No declarar verde sin correrlo alla. Es la regla no negociable #2 del CLAUDE.md del repo."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**Todos los tests de este proyecto se corren en el VPS, NO en la PC del operador.** La PC (Windows, Python 3.14) no tiene las deps de runtime (`temporalio`, `fastmcp`), asi que cualquier modulo que las importe **falla al importar localmente**. Solo los tests 100% puros (sin esos imports, o con guards tipo `_ActivityStub`) corren en la PC.

**Comando por componente:**
- **Worker / la casa** (`deploy/worker/tests/`, FeatureWorkflow + micro-loop): `cd /opt/unreal-copilot && /opt/uc-worker-venv/bin/python -m pytest deploy/worker/tests/ -q`.
- **MCP** (`deploy/mcp/tests/`, FastMCP): el MCP vive en **`/opt/agentic/mcp/`** (dir SEPARADO de `/opt/unreal-copilot`), venv `/opt/agentic/mcp/.venv` → `cd /opt/agentic/mcp && .venv/bin/python -m pytest tests/ -q`.

**Patron de validacion:** editar local → `scp` el archivo + el test al VPS → `pytest` en el venv correspondiente → si verde, deploy (restart del service). **No declarar un test verde sin haberlo corrido en el VPS** (regla 5 del proyecto: evidencia, no autoeval). Casos reales cazados solo en el VPS: `pytest.approx` con `>=` (TypeError, SP6) · `object.__new__(WorkflowAlreadyStartedError)` no-safe (SP7) · `>= pytest.approx(0.60)` desactualizado. Relacionado:.

**`/opt/unreal-copilot` NO es un repo git (2026-06-23).** Es un **deployment sincronizado por scp manual**, no un clone — `git pull`/`git status`/`git fetch` ahi fallan con `fatal: not a git repository`. Para alinear el VPS con `main` tras un merge **no hay `git pull`: hay que `scp` los archivos cambiados** (y reiniciar el service si toca runtime). Corolario: solo se despliega lo que el runtime del VPS usa (worker, `deploy/skeleton_kit/archetypes/*` que `validate_kit` corre, `deploy/ops/*`). Lo que NO vive en el VPS: las **domain-cards** (`deploy/skeleton_kit/domain-cards/` ni existe alla) + docs (`MANUAL.md`, READMEs, `docs/*`), porque la skill `/generar-plano` corre en la **sesion de la PC** (lee del repo local), no headless en el VPS. Si algun dia la fabrica corre `/generar-plano` headless en el VPS (frente C), habra que desplegar las cards alli. Fuente de verdad de TODO = el repo (GitHub/local); el VPS es solo deployment.
