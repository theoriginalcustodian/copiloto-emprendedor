# Copiloto del Emprendedor — Constitución Técnica

> **Repo:** `copiloto-emprendedor` — **🌐 PÚBLICO** (decisión del operador, 2026-08-06: los repos
> públicos tienen GitHub Actions **gratis e ilimitado**, y el CI se había vuelto un cuello de botella).
> **Owner:** David Lin / Agencia HyC.
> ⚠️ **Esto cambia el COSTO de un error, no la regla.** «Cero secretos en repo» (§3.1) pasa de buena
> práctica a crítico: un `.env` mal commiteado es **público en el instante del push**, y el historial
> queda aunque después se borre el archivo. Auditoría del 2026-08-06 sobre **toda** la historia
> (incluida la graduación con `filter-repo`): **0 secretos** — claves privadas 0, `ghp_` 0, `sk-ant-` 0,
> `.env` reales 0; los hits de `gphy_`/`SERVICE_ROLE_KEY` son **nombres** de variable, docs con elipsis
> o fixtures (`gphy_test`), y los `eyJ…` de dos fixtures **no decodifican como JWT**. Cada pasada con
> control positivo. Nada que rotar. **Antes de commitear algo nuevo con forma de credencial, asumí que
> lo estás publicando.**
> **Idioma:** instrucciones y comentarios en español; código, scripts e identificadores en inglés.
> **Origen:** graduado de `unreal-copilot` el 2026-07-06 vía `git filter-repo` (historia/blame preservada). El copiloto era la app-estrella del arquetipo `conversational_agent` de la fábrica; se extrajo a repo propio para separación comercial/producto.
> **Arranque de sesión → [`HANDOFF.md`](HANDOFF.md)** (init cero-fricción: seed de memoria, accesos, flujos de trabajo).

---

## 0. Qué es

Agente conversacional **durable** para emprendedores: chatea por web (PWA), integra sus apps (Composio: Gmail, Drive, Sheets, Docs, HubSpot, Instagram, Calendar), cobra por MercadoPago, y recuerda su actividad (memoria de grafo Graphity). El moat es la **orquestación durable con Temporal** (sobrevive cortes, reintenta, sesión permanente vía continue-as-new).

---

## 1. Estructura

```
copiloto-emprendedor/
├── apps/copiloto/          # backend (capa CLIENTE): worker Temporal, web front-door FastAPI,
│                           #   dispatcher, servicios Composio, MercadoPago, memoria, auth
├── apps/copiloto-web/      # frontend PWA (Vite + React + TS), autocontenido (HTTP + JWT)
├── motor/                  # MOTOR VENDORIZADO (capa PLATAFORMA): backend/agent + clients/agent
│                           #   — el ConversationWorkflow ReAct, gateways, canales, providers
├── deploy/copiloto/        # scripts de deploy (deploy.sh, sync-web.sh, GoTrue, Caddy snippet)
├── deploy/worker/          # provision_tables.py (infra de tablas, RLS + policy)
├── docs/copiloto-emprendedor/
├── scripts/sync-motor.sh   # RETIRADO (fork duro 2026-07-07) — el motor ya no se sincroniza con la fábrica
└── requirements.txt        # deps python pinneadas (del venv de prod)
```

## 2. El motor vendorizado (boundary clave)

`apps/copiloto/**` importa el motor con `from backend.agent... / from clients.agent...`. El path se resuelve en **un solo lugar**: `apps/copiloto/_paths.py` → `MOTOR_REF` = `UC_MOTOR_REF_PATH` (env) o el default `motor/`. `conftest.py` corre `ensure_paths()` una vez por sesión de pytest. **NUNCA volver a esparcir `sys.path.insert` por los módulos** (se colapsaron 92 a este mecanismo en la Fase 1 de graduación).

El motor **nació** como copia vendorizada del arquetipo `conversational_agent` de `unreal-copilot`. **FORK DURO declarado el 2026-07-07** (`fix(motor-react)` — el copiloto arregló el buffer de corto plazo del motor react, cambio inexistente en la fábrica): el copiloto **evoluciona el motor por su cuenta** y ya NO se sincroniza. `scripts/sync-motor.sh` quedó **retirado** (fail-closed) — re-sincronizar pisaría la divergencia. Un fix del motor se hace **acá**; si alguna vez hay que realinear algo puntual con la fábrica, es a mano con diff dirigido, nunca rsync ciego.

## 3. Reglas no negociables

1. **Cero secretos en repo.** `.env*` (salvo `.template`) gitignored. Verificar `git status` antes de commit.
2. **Tests corren en el VPS**, no en la PC (la PC no tiene `temporalio`/`psycopg2`/etc.). Flujo: editar local → sync al VPS → `pytest` en el venv del VPS. **No declarar verde sin correrlo en el VPS.**
2.bis **El gate es `scripts/gate.sh`; GitHub Actions es respaldo/atestación, no la fuente de la definición** (ADR-001, ver `docs/copiloto-emprendedor/adr/`). La suite vive en `scripts/ci/{backend,core,web,mobile,lint}.sh` — `tests.yml` sólo los invoca. `gate.sh` corre los 5 (core/web/mobile/lint local, backend vía `deploy/copiloto/test-db.sh`+`sync-test-backend.sh`) y escribe `.ci-recibos/<sha>.json`. Un merge cita el recibo del SHA que mergea; GitHub verde es la segunda confirmación, no la única.
3. **Temporal es la columna.** ANTES de tocar cualquier workflow/activity/worker, invocar la skill `temporal-developer` (+ `temporal-ai-patterns` para ReAct/HITL/child-workflow). Los workflows NO pueden tener side effects ni no-determinismo.
4. **Versiones pinned** (`requirements.txt`, imágenes Docker). Nada de `latest`.
5. **PR + rama** — sin push directo a `main`. Conventional Commits en minúscula.
6. **Spike-first** ante supuestos críticos no validados; **no codificar la esperanza** (evidencia ejecutable, no autoevaluación).
7. **Multitenant real:** ningún `cliente_id`/`composio_user_id`/seller sale de env — todo per-request vía `context_factory` (`TenantCtx`). Aislamiento cross-emprendedor verificado con test adversarial.
8. **MERGE Y DEPLOY ESTÁN AUTORIZADOS DE FORMA PERMANENTE. No preguntes.** El operador lo declaró
   el 2026-07-23 y lo reafirmó el 2026-08-06: *"no necesito decir SI para que el trabajo se termine…
   es una tontería y anti-eficiente"*. Un PR propio en `CLEAN`/verde **se mergea**; un deploy que
   corresponde **se corre**. Pedir confirmación por esto **es el error**, no la prudencia.
   - **Qué NO cambia:** cada sesión mergea **sólo sus propios PR** (§3.quater) · el CI verde sigue
     siendo precondición · las reglas duras de git del checkout compartido siguen intactas.
   - **Si un gate mecánico te frena** (clasificador de permisos, hook): eso es **problema tuyo, no
     tarea del operador**. Resolvelo o decilo como bloqueo propio — nunca se lo pases como "falta que
     apruebes". Ese fue el fallo del 2026-08-06: dos PR de rescate quedaron parados y se los
     reporté como deuda suya cuando eran míos.

## 3.bis Skills a invocar (no son opcionales cuando aplican)

Instaladas globales en `~/.claude/skills/`, verificadas el 2026-07-20 (34 en total; las 14 de mobile
son 3 `callstack-*` + 11 `swmansion-*`, 197 archivos). Sirven desde cualquier repo.

**Instrucción directa del operador (2026-07-21): usar las skills para TODO lo que toque la app, no
sólo cuando algo falla.** Se invocan **ANTES** de escribir código, no después de atascarse. La skill
es la fuente canónica del dominio; razonar desde cero sobre gestos, animación o audio nativo
reproduce errores que Software Mansion ya documentó.

**Y la regla que este workspace ya pagó cara:** si llevás **dos intentos fallidos** sobre gestos,
animación o rendimiento, el tercero **no es otro fix — es leer la skill del dominio**. Es el mismo
gate que V-EXT, aplicado al frontend nativo: apilar un fix sobre un fix rara vez converge.

*Caso real de esta sesión:* el `ScrollView` de Apps no scrolleaba; la skill `swmansion-rn-gestures`
da el criterio de contenedores de scroll y composición Pan/scroll en un párrafo, y evitó dos
iteraciones a ciegas sobre el gesto del panel — que no era la causa.

| Cuándo | Skill |
|---|---|
| Cualquier código en `apps/mobile/` | `swmansion-react-native-best-practices` (New Architecture) |
| Gestos: pan, tap, drag, swipe del panel | `swmansion-rn-gestures` |
| Reanimated, worklets, `useSharedValue`, animación del glass | `swmansion-rn-animations` · `swmansion-rn-multithreading` |
| Jank, FPS, TTI, re-renders, tamaño del bundle | `callstack-react-native-performance` |
| SVG / íconos del escritorio | `swmansion-rn-svg` |
| **F6 — captura de dictado** | `swmansion-rn-audio` (`react-native-audio-api`) |
| Navegación, headers, safe areas | `callstack-react-navigation` |
| Subir Expo SDK / RN | `callstack-upgrading-react-native` |
| **Cualquier workflow / activity / worker** | `temporal-developer` (+ `temporal-ai-patterns` para ReAct/HITL) |
| Memoria de grafo | `graphity` |

**Lo que estas skills NO cubren, y manda igual:** la orquestación **durable** con Temporal (el moat),
el **aislamiento multitenant** (regla 7) y el contrato del backend —`POST /chat` fire-and-forget +
polling de `/reply`, ver [`HANDOFF`](docs/copiloto-emprendedor/2026-07-20-HANDOFF-sprint-mobile-first.md) §4.bis.
Ninguna skill de frontend sabe de eso; si una sugiere algo que choca con estas reglas, ganan estas.

⚠️ Al instalar skills en Windows: `git clone` puede dejar carpetas **incompletas y silenciosas** por
el `MAX_PATH` de 260 — exit 0, `SKILL.md` legible, y faltando la mitad de los archivos. Contar
archivos contra el origen, no confiar en que la carpeta exista.

## 3.ter documed-front es la app CANÓNICA de UI/UX — consultarla SIEMPRE primero

`C:\Proyectos\Claude\Claude code\Agencia_IA_HyC\documed-front\apps\mobile`

**Antes de implementar cualquier cosa de cáscara, gesto, animación, barra de sistema, scroll o
card: abrir el archivo equivalente en documed y leerlo.** No es una sugerencia — es la instrucción
repetida del operador: *"documed ya tiene todo implementado, no reinventes la rueda"*.

Por qué rinde: documed pagó estos errores **en device** y dejó el porqué en sus docstrings. Cada vez
que acá se implementó de cero algo que allá existía, se volvió a pagar el mismo peaje. Ejemplos ya
cobrados: ocultar la barra de botones de Android es `<NavigationBar hidden />` de
`expo-navigation-bar` (documed `app/_layout.tsx:213` — v57 ya no expone `setBehaviorAsync`, y el
módulo nativo exige rebuild EAS); el doble render del encabezado se mata con
`SafeAreaProvider initialMetrics={initialWindowMetrics}`. Nada de eso se deduce: está escrito allá.

**Portar adaptando, no copiar ciego.** El copiloto no tiene el caso clínico (dictado largo,
retención de audio, huérfanos): traer esa maquinaria es el error espejo.

**Lo que documed NO cubre y manda igual:** Temporal durable (el moat), aislamiento multitenant
(regla 7) y el contrato `POST /chat` + polling `GET /reply`. Si algo de documed choca con eso,
ganan las reglas de este repo.

## 3.quater Tres sesiones paralelas — el buzón manda

El repo se trabaja con **tres sesiones simultáneas**: **planificación**, **backend** y
**frontend/app**. Las reglas vivas —quién es dueño de qué, git, estado compartido, tipos de mensaje,
prompts de los crones— están en **`coordinacion/COORDINACION.md`**, y se leen **al arrancar la sesión
y antes de cualquier commit**. Diseño y razonamiento:
`docs/superpowers/specs/2026-07-21-formato-coordinacion-tres-sesiones-design.md`.

⚠️ **`coordinacion/` NO es parte del repo** (`.gitignore`). Es una carpeta física única apuntada por
los crones vía ruta absoluta. Si se versionara, `git worktree add` la duplicaría por worktree y el
mensaje de una sesión no existiría para la otra. **No la vuelvas a versionar.**

Lo que hay que saber sin abrir nada más:

1. **La junta backend↔app tiene dueña: PLANIFICACIÓN.** Todo trabajo de capas `ambas` baja como
   `contrato_` —endpoint, request, response, códigos, DoD binario por lado— **antes** de que ninguna
   implemente. Si para avanzar tenés que inventar la forma de un endpoint, eso es codificar la
   esperanza: emitís `pedido_` y marcás `[ASSUMED_PENDING_VERIFY]`.
   *Por qué existe:* los cuatro incidentes del 2026-07-21 fueron la misma falla — cada lado verificó
   su mitad y la costura no era de nadie.
2. **El estado es la ubicación del archivo**, no un tablero: `abierto/` → `en-curso/` →
   `cerrado/<fecha>/`. Quien toma un trabajo lo mueve; quien lo termina, también. Un tablero que hay
   que acordarse de actualizar se desincroniza y **miente**; un `mv` no puede.
3. **Nadie edita la carpeta de otra sesión. Se pide.** Y con checkout compartido: `git add` con rutas
   explícitas, nunca `-A`; jamás `checkout` / `pull` / `stash` / `reset --hard`.

**Memoria:** escribí las entradas nuevas en **`memoria/` del repo**, no sólo en el directorio de
auto-memory del harness — divergen, y `scripts/seed-memory.sh` espeja con `--delete`. Ver
`memoria/memoria-repo-vs-slug-drift.md` antes de correrlo.

---

## 4. Deploy y cutover (Fase 2.5)

El deploy (`deploy/copiloto/deploy.sh`, idempotente, corre desde la PC y orquesta el VPS por SSH) ya está **reconciliado al layout graduado**: el path del motor pasó de `deploy/skeleton_kit/.../reference` a `motor/` en `deploy.sh`, ambos units `uc-copiloto-{web,worker}.service` (PYTHONPATH), `sync-test-backend.sh` y `gotrue/deploy-gotrue.sh`. Mount verificado en el VPS (spike: **333 colección VERDE** con `motor/`).

**Cutover HECHO (2026-07-06):** el servicio vivo corre desde ESTE repo (layout `motor/`, PYTHONPATH del proceso verificado, `reference` viejo eliminado); smoke E2E **10/10 BETA-READY** post-switch. **Una sola instancia**, mismo dominio/DB/usuarios. Backup del origen previo en `/opt/uc-repos/copiloto.bak-pre-graduacion-*` (borrar tras confirmar estabilidad). Runbook en [`HANDOFF.md`](HANDOFF.md) §5.3. Runtime: Caddy (`copilotoemprendedor.duckdns.org` → :8099) + GoTrue dedicada (`copiloto-auth`) + Postgres (fusion) + Temporal (`127.0.0.1:7233`) + Graphity. Fase 3 (infra 3 nodos dedicados) = diferida.

## 5. Referencias

- **🗣️ Cómo se llaman las cosas → [`CONTEXT.md`](CONTEXT.md)** (raíz). Glosario del dominio: qué **es**
  cada término del negocio y de la app, y cuál gana en cada colisión de nombres. **Leerlo antes de
  nombrar una entidad, un endpoint o un campo nuevo** — sus `_Avoid_` no son estética: son ambigüedades
  medidas contra el código. Las que más muerden: `ingreso`/`cobro`/`pago` son hoy casi la misma cosa
  con tres nombres · `actividad` nombra **dos sistemas sin relación** (el feed SQL de negocio y la
  memoria conversacional) · `cliente` es a quien le vende el emprendedor, **nunca** el tenant.
- **Arranque / init cero-fricción → [`HANDOFF.md`](HANDOFF.md)** (raíz). **Memoria del proyecto → `memoria/`** (índice `MEMORY.md` + 113 entradas); sembrala en el slug de Claude Code con `scripts/seed-memory.sh` (idempotente).
- Plan de graduación (Fase 0/1/2): `docs/copiloto-emprendedor/2026-07-06-graduacion-plan-fase0-fase1.md`.
- Dominio propio + auth Google: `docs/copiloto-emprendedor/` + config en `deploy/copiloto/`.
- Assets de diseño/voz (fuera del repo): `docs/ASSETS-EXTERNAL.md`.
