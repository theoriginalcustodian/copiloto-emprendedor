---
name: frontend-clinic-plantilla-base
description: "Frontend de clinic-management construido A MANO (no por la fábrica) como primer caso real para cosechar la plantilla de frontend de la fábrica — Next.js 14, E2E 24/24, fiel al backend post-hardening"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6784837f-d1f4-4fa0-ba69-0620e24abcf0
---

**Frontend de `clinic-management` construido a mano (2026-06-25)** como **primer ladrillo del objetivo de doble nivel del operador:** (1) generar el frontend de la clínica nosotros, NO la fábrica; (2) de ese caso real **cosechar la plantilla de frontend de la fábrica** para que todo desarrollo futuro salga con frontend terminado E2E y probado. El objetivo #1 está CERRADO; el #2 es el frente siguiente.

**Ubicación:** `C:\Proyectos\Claude\Claude code\clinic-frontend` (proyecto Next.js **standalone**, autónomo, **modo mock** sin backend). NO commiteado aún (se sube a GitHub al cerrar). Insumo de diseño: `FRONTEND_BLUEPRINT.md` (967 líneas) del repo `clinic-management`.

**Stack (del blueprint §1.1):** Next.js 14 App Router + TS strict + Tailwind + shadcn/ui (new-york) + TanStack Query + react-hook-form/zod + date-fns + sonner + Playwright. Diseño = teal médico + modo oscuro (operador aprobó "básico pero suficiente para plantilla"); tokens centralizados (cambiar marca = 1 archivo).

**Arquitectura clave (lo cosechable):**
- **`lib/api.ts`** = contrato único que las pantallas consumen vía TanStack Query; hoy sirve un **store mock en memoria** (`lib/mocks/data.ts`), mañana apunta al BFF real **sin tocar las pantallas** (`USE_MOCKS`).
- **Contrato `data-testid`** = puente con el gate Playwright de la fábrica (`title`/`record-row-{id}`/`record-{field}`/`record-detail`/`item-row-{id}`/`item-{field}` + específicos del §10). El gate asersa CONTENIDO real.
- Capas: `lib/types` (espejo `uc_tables.json`) · `lib/schemas` (zod) · `lib/query-keys` · `components/shared` (StatusBadge §2.1, states) · `components/shell` (sidebar nav flag-aware) · `app/(app)/<entidad>`.
- Pantallas construidas por **wave de 3 sub-agentes Sonnet** (file-ownership exclusiva por entidad) + dashboard/barrier por el parent.

**Evidencia:** build prod verde (14 rutas type-safe) · **E2E Playwright headless 24/24** (smoke 9 + pacientes 5 + turnos 5 incl. wizard compuesto + facturación 2 + inventario 3 incl. stock insuficiente). Fiel al contrato backend post-hardening (PR #3): `reminder_opt_in`/consent (F7), booking consent-gated, pricing real, flag Documed per-tenant.

**Gotchas cosechables a la plantilla de fábrica (gate-only, NO músculo):**
- zod `coerce`/`default` rompe `useForm<T>` (input≠output) → patrón **3 genéricos** `useForm<z.input<typeof S>, unknown, T>` para campos numéricos; y NO usar `.default()` en el schema (poner default en `defaultValues` del form).
- pnpm 11 bloquea build scripts → `onlyBuiltDependencies` (msw, unrs-resolver, esbuild) — y nota: pnpm warnea que el campo migró de lugar.
- seed de fechas **relativo a hoy** para que la agenda E2E sea robusta cualquier día.
- flag gating: navegación **client-side** (Link) para que el estado mock persista entre vistas.

**Decisión MAYOR pendiente (antes de conectar real):** la facade `ClinicSystem` es **Python**; Next (Node) no la llama directo → puente correcto = servicio **FastAPI** que envuelve `ClinicSystem` (identity-binding por JWT + RPCs atómicos ya listos) y el frontend lo consume. Es parte de lo que la plantilla debe definir.

**Spike-first pendiente para el objetivo #2 (S1, el más riesgoso):** ¿el cage browser del sandbox de la fábrica (Docker + Chromium, hoy corre funciones Python con `http.server`) puede correr una app **Next.js** —Node runtime + build + server— para gatearla? Si NO, el frontend de producción no es relleno por músculo sino **arquetipo FIJO parametrizado** (paralelo de R1 workflows ricos). Resolver ANTES de cerrar el diseño de la plantilla.

**DESPLEGADO E2E REAL EN EL VPS (2026-06-25, /goal del operador):** la app completa corre en el VPS `unreal-copilot`, accesible por IP — **http://178.105.191.1:3000**. Arquitectura: **frontend Next.js en contenedor Docker** (`clinic-frontend:demo`, `0.0.0.0:3000`, restart unless-stopped) + **BFF FastAPI** (`/opt/clinic-management/clinic_bff.py`, systemd `clinic-bff`, `0.0.0.0:8090`) que envuelve `ClinicSystem` (service-role + cliente_id fijo demo, igual que `validate.py`) sobre fusion `uc_factory` + Temporal. Firewall Hetzner `unreal-copilot-fw` (11142751): abiertos 3000+8090. **E2E real verificado con Playwright MCP** (browser→frontend→BFF→fusion): read (dashboard datos reales) + write (alta de paciente desde la UI persistió en fusion). 

**Gotchas del deploy (cosechables a la plantilla de fábrica):**
- **pnpm 11 rompe el build en Docker** (`ERR_PNPM_IGNORED_BUILDS`, ni packageManager pin ni onlyBuiltDependencies en pnpm-workspace lo arreglaron en el contenedor) → **usar `npm install --legacy-peer-deps` en el Dockerfile**.
- El host no filtra (ufw inactive) pero **Hetzner Cloud Firewall SÍ** bloquea puertos custom → abrir vía MCP `hetzner_set_firewall_rules` (preservando SSH 22).
- `create-next-app` minimal **no genera `public/`** → el `COPY public` del Dockerfile estándar falla; quitarlo o crear public/.
- **BFF Python como systemd en el host** (no contenedor): accede a fusion/Temporal del host directo + env via `EnvironmentFile`/bash source de `/etc/unreal-copilot/fusion-supabase.env`. `uc-val-venv` tiene supabase+temporalio; agregar fastapi+uvicorn.
- `NEXT_PUBLIC_*` se inlinean en **build-time** → pasar como `--build-arg` al docker build.
- **E2E del VPS vía Playwright MCP** navegando a la IP — prueba la app del VPS sin instalar Playwright allá ni montar local (respeta [[apps-deploys-siempre-vps]]).

**Gotcha de UX cosechado (bug real del operador, fixeado E2E):** una vista filtrada por día (agenda) hace que un item creado para OTRA fecha "desaparezca" → el operador cree que "no se generó". Fix de raíz: tras crear (onSuccess del wizard), **saltar la vista a la fecha del item creado** (`onBooked → setSelectedDate`). Regla para la plantilla: toda vista filtrada-por-fecha debe navegar a la fecha del recién-creado, o mostrar dónde quedó. Validado por Playwright MCP en vivo (agendar 15/09 → la agenda saltó a 15/09 y mostró el turno).

**Deuda gestionada del deploy:** worker Temporal diferido (composite usa RPC atómico; reschedule/cancel vía store directo) · BFF expuesto sin auth (tenant demo, data sintética; cerrar post-demo) · lint off en el build del contenedor (type-check sí) · data de demo en el tenant demo (purgable).

**Aclaración (2026-06-26) — hay DOS frontends, no confundir:**
- **`clinic-frontend` (ESTE, el de esta memoria)** — Next.js, conectado vía BFF FastAPI, **VIVO en el VPS** (`http://178.105.191.1:3000`, verificado por curl 2026-06-26), E2E real. Es el **alineado con la intención del operador**: su propio stack Next.js.
- **`Frontend-Clinica` (repo GitHub `theoriginalcustodian/Frontend-Clinica`)** — **Vite + React, datos mock, SIN conectar al backend**. Fue **una PRUEBA** que hizo el operador (NO canónico). La intención es reimplementar la consola en el stack **Next.js propio respetando las MISMAS funciones/componentes** — solo cambia el stack de programación.
- **Documentación del repo `clinic-management` (PR #4, 2026-06-26):** se dejó **AGNÓSTICA de frontend** (sin referencias a ningún front) — `README.md` + `docs/MANUAL_DE_USUARIO.md` + `docs/CARACTERISTICAS.md`, basada en las capacidades del **backend**, con eje **automatización + IA** + robustez de Temporal. Roadmap asentado: **agentes de voz** + agente conversacional de agenda.

[[clinica-medica-2do-sistema-compuesto]] [[r5-generar-plano-unico-generador]] [[r1-workflow-templates-fixed-mount]] [[apps-deploys-siempre-vps]] [[factory-identidad-automatizacion-ia]]
