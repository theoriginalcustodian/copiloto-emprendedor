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
> ➕ **La auditoría de secretos buscaba CREDENCIALES, y eso es lo único que su «0» acredita.** Medido el 2026-10-12: la historia también tiene **10 cortes de la fuente comercial Neue Einstellung** (Hanken Design Co., 0,7 MB, alta en `b7fae2e2`) — cero en el árbol y cero alcanzables desde `main`, pero descargables de la historia. **No es un secreto** (nada que rotar, ningún acceso que revocar); es **licencia de terceros en un repo público**, otra pregunta con otro barrido. **Decisión del operador: dejarlo** — `filter-repo` no cerraría el agujero porque GitHub sigue sirviendo los blobs por los **1006** `refs/pull/*` hasta que haga GC, y la reescritura sí costaría cierto: invalida todas las citas `medido @ <sha>` de los docs y los 51 worktrees activos. Medición completa y disparador para reabrir → `docs/copiloto-emprendedor/Auditorias/2026-10-12-fonts-comerciales-en-la-historia-publica-decision-A-dejarlo.md`.
> ⚠️ **Esa atestación tiene FECHA y ya fue superada: el 2026-08-19 entró un token real** (PR#464,
> `Prototipo frontend/odobi-ui/.mcp.json`, `Authorization: Bearer` de **60fps.design**), estuvo **24
> días** expuesto en repo público y se sacó de HEAD el 2026-09-08 (#505). **El blob sigue siendo
> recuperable desde la historia de `main`** (`git show 39decb95:…`, 259 bytes), así que sacarlo de HEAD
> cortó la exposición futura, no la pasada — lo dice el propio `.gitignore:20-24`: «el token sigue vivo
> en el historial y TIENE QUE rotarse igual». **No estaba en `memoria/deuda-secretos-rotar.md`**, porque
> ese inventario clasifica por «secretos que pasaron por chat» y éste se filtró por la otra vía (medido
> 2026-09-28). **Leé «0 secretos» como «al 2026-08-06», nunca como estado vigente:** una atestación sin
> fecha de vencimiento se cita como si fuera de hoy, y es lo que pasó acá.
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
│   └── Auditorias/         # 🔍 TODO lo de auditorías vive ACÁ (loop Fable, mapas de clases, re-verificaciones)
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

9. **NINGUNA SESIÓN APAGA EL EQUIPO. NUNCA.** Orden del operador del 2026-10-16: *"nunca se
   apaga el ordenador salvo orden expresa mía....el apagado automátic solo se ejecuta con orden
   expresa del operador"*. Prohibido `shutdown`, `Stop-Computer`, un reinicio, o una tarea
   programada que apague — tampoco "para liberar recursos", ni al cerrar un sprint, ni porque la
   cola quedó vacía. Si creés que corresponde apagar: **pedíselo y seguí trabajando.**
   - **Una orden de apagado NO se propaga ni se hereda.** Vale sólo en la **sesión que la recibe**,
     del operador, y para **el trabajo que nombra**; se **consume** con ese apagado. No viaja por el
     buzón, ni por un `dato_`, ni por memoria, ni a otra sesión, ni al día siguiente.
   - **Por qué es regla y no criterio** (medido el 2026-10-16, Event Log + 3,1 GB de transcripts con
     control negativo): la PC se apagó **dos** veces. A las **00:25:53** la apagó planificación con
     orden textual de las **00:02:09** («cuando termines el trabajo apaga la pc», referida al cierre
     del sprint). Pero planificación escribió esa orden puntual en el buzón como un **título general
     y sin vencimiento** —`urgente_…LA-PC-SE-APAGA-POR-ORDEN-DEL-OPERADOR…`— y a las **08:13:52** la
     sesión **backend** lo leyó y a las **08:14:27** apagó la máquina citándolo, para **otro**
     trabajo. El operador volvió y la encontró apagada: *«y porue apagaste la pc?? yo nunca te lo
     pedí»*. **La falla fue de propagación, no de desobediencia:** las dos sesiones creyeron tener
     autorización, y la segunda la tenía por escrito. Ese archivo está retractado en
     `cerrado/2026-10-16/2026-10-16_RETRACTADO_planificacion-a-todos_NINGUNA-SESION-APAGA-LA-PC-*`.
   - **Esto NO contradice la regla 8.** Merge y deploy están autorizados de forma permanente porque
     son **reversibles y propios del trabajo**; apagar la máquina **mata las otras sesiones, los
     crones y Metro**, y no lo decide quien no es dueño de la máquina. Una autorización amplia sobre
     el trabajo no se extiende al host.
   - Si encontrás un apagado **pendiente**: abortalo con `shutdown /a` (exit `1116` = no había
     ninguno; `0` = había uno y lo abortaste) y decilo.

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
auto-memory del harness: divergen, y lo versionado es lo que sobrevive al clon.
⚠️ **Hasta 2026-09-22 acá decía que `scripts/seed-memory.sh` «espeja con `--delete`». Era falso desde
el 2026-07-31**, cuando se pagó esa deuda: hoy hace `rsync -a --update` (verificado en
`scripts/seed-memory.sh:131`), es **bidireccional** —rescata al repo lo que sólo vive en el slug
antes de reconciliar— y reporta `rescatados / purgados / divergentes`. **Correrlo es seguro; no
correrlo es lo que deja divergir las dos memorias.** Medido el 2026-09-22: 34 entradas sólo en el slug
y 23 sólo en el repo, justamente por el miedo que sembraba esta línea. El único merge que NO hace solo
es el del índice `MEMORY.md` (lo marca `divergente` y lo deja a mano). Ver
`memoria/memoria-repo-vs-slug-drift.md`.

## 3.quater.bis Marcar lo TERMINADO — el registro único y los cuatro estados

**Un solo registro de verdad: el backlog del sprint**, con su tabla-índice al principio generada
por `scripts/sprint-estado.py`. `PLAN.md` (la cola viva) y los issues de GitHub son **vistas**: no
se citan como estado. Si las tres fuentes discrepan, manda el backlog.

**Por qué existe esta sección.** Medido el 2026-10-14 sobre el buzón completo (460 `cierre_`,
control negativo 0): **18 de las 26 fichas nunca fueron nombradas por ninguna sesión**. No era
descuido al marcar — era que el id de la ficha **no circulaba**: las sesiones citaban ids propios
(`KVCAIDASALE`, `EXHAUSTIVEDEPSON`, `DRIVECERO`, `A7`), así que la casilla del backlog nunca entraba
al circuito de cierre y el mismo sprint se leía con tres porcentajes incompatibles. El reclamo del
operador (*«¿para qué carajo tenemos un backlog?»*) tenía esta causa, no una de disciplina.

**Los ids son `SM-<letra><nº>`** (`SM-B3`), nunca `B-3`. Dos razones medidas: `A-1` como token da 14
falsos positivos de grep (matchea cualquier prosa), y el padrón del mapeo **ya usa** `D2`/`D3`/`D7`
para otras cosas — el commit `45a57eb5` los cita y **no** son las fichas `D-2`/`D-3`/`D-7`. Un nombre
con dos referentes hace que se pruebe A y se concluya B.

### Los cuatro estados

| Estado | Qué significa | Qué EXIGE para ser válido |
|---|---|---|
| `PENDIENTE` | nadie la tomó | — |
| `EN-CURSO` | tomada | `Dueno-activo:` (una ficha tomada sin dueño es una ficha parada que nadie reclama) |
| `DOD-PARCIAL` | **código en main, DoD incompleto** | `Falta:` nombrando lo que falta |
| `TERMINADO` | **DoD completo, punto por punto** | `Cierre:` con ≥1 sha **ancestro de `origin/main`** + la evidencia de cada punto; o `sin-codigo` + motivo |

**El criterio de TERMINADO es el DoD COMPLETO, no el merge commit** (orden del operador,
2026-10-14: *«las tareas se marcan como terminadas cuando el dod está hecho completo»*). El merge
commit es **una** de las evidencias. `DOD-PARCIAL` existe precisamente para el caso que este repo ya
pagó: código mergeado y declarado listo sin la evidencia de device. Un `DOD-PARCIAL` sin `Falta:` es
un `TERMINADO` disfrazado, y el gate lo rechaza.

### Quién marca: nadie a mano

1. **La sesión que termina aporta la EVIDENCIA** en su `cierre_`, con tres campos fijos al principio
   del cuerpo: `FICHA: SM-XX` · `SHA: <merge commit en main>` · `DOD:` una línea por punto del DoD
   con su evidencia (test y dónde corrió, `path:línea`, corrida en device con usuario y fecha). Un
   `cierre_` sin esos tres campos no acredita nada: planificación lo devuelve.
2. **El commit o el PR cita el id** (`SM-B3`) en el cuerpo. Sin eso el trabajo vuelve a ser
   inatribuible y estamos donde estábamos.
3. **El estado lo escribe el script, no una persona:**
   `python -I -X utf8 scripts/sprint-estado.py --marcar SM-B3 --estado TERMINADO --cierre "…"`.
   El script **rechaza** el marcado que no cumple su propia regla y **no escribe** en ese caso
   (verificado el 14-10 con control positivo: `"listo, funciona"` y un sha de rama → ambos rechazados).
4. **Nadie edita la tabla-índice a mano.** Es generada; el gate la regenera y compara.

**Por qué el script y no cada sesión:** con el checkout compartido y 80+ worktrees, tres sesiones
editando la misma tabla es edit-race garantizada; y ordenar a mano ya fracasó en este repo —el buzón
pasó de 32 a 136 archivos abiertos hasta que lo tomó un janitor
(`memoria/buzon-se-ordena-por-janitor-no-por-disciplina.md`). Lo que una sesión aporta es **evidencia**;
derivar y escribir el estado es mecánico, y lo mecánico no se delega a la disciplina.

### El conflicto de merge en la tabla: se regenera, no se elige un lado

Cada sesión corre `--marcar` en **su** worktree: quien tiene la evidencia escribe el estado, sin
cuello de botella en planificación. El costo es que dos ramas pueden tocar la **tabla generada** y
dar conflicto. **No se resuelve tomando un lado** (`--ours`/`--theirs` descarta la mitad del otro y
nunca converge): la tabla es una **función del cuerpo del doc**, así que se resuelve

```bash
git checkout --ours docs/copiloto-emprendedor/2026-10-11-BACKLOG-sprint-mobile-beta.md   # o --theirs, da igual
# traé a mano los bullets Estado/Cierre/Falta de la OTRA rama (son bloques distintos del doc)
python -I -X utf8 scripts/sprint-estado.py --tabla    # la tabla se deriva de nuevo
python -I -X utf8 scripts/sprint-estado.py --check
```

Lo que **no** da igual es el cuerpo: los bullets de cada ficha viven en bloques separados, así que un
conflicto ahí se resuelve conservando **los dos** (cada ficha tiene un solo dueño; si dos sesiones
marcaron la misma, eso es el hallazgo, no el conflicto).
### El gate

`scripts/ci/lint.sh` corre `sprint-estado.py --check` y verifica que la tabla esté regenerada. Rechaza
un `TERMINADO` sin `Cierre:`, un sha que no sea ancestro de `origin/main`, un `DOD-PARCIAL` sin
`Falta:`, una ficha sin `Estado:` y una tabla desincronizada. Su corpus es **el doc versionado**: un
gate que leyera `coordinacion/` mediría al equipo y no al commit, y en CI daría vacío.

**Lo que el gate NO puede verificar es lo táctil** (device). Ahí no hay automatización posible: lo que
hace es obligar a que la evidencia esté **escrita** y el sha **exista**, para que lo no mecanizable
quede visible en `Falta:` en vez de implícito en un ✅.
## 3.quinquies La ORDEN DE TRABAJO activa: `/goal`

Un trabajo largo arranca con **`/goal <ID>`** y no con una charla. `scripts/goal.sh set <ID>`
resuelve el id contra el padrón (los docs versionados de backlog / acta / ARRANQUE, working tree
**y** `origin/main`), guarda su **DoD tal como está en el doc** en `.goal` (gitignored, por
worktree) y **rechaza** un id que no exista: un goal que el agente se inventa no es una orden.

Desde ahí, `scripts/hooks/goal_activo.mjs` lo inyecta en cada turno y el gate `scripts/ci/atribucion.sh`
del `pre-push` marca **`FUERA-GOAL`** todo commit que cite **otro** id, aunque esté autorizado —
cambiar de orden es un comando, no un hecho consumado. Con goal activo el umbral de desvío no se
intuye: es 0, y por eso recién ahí es seguro poner `UC_ATRIBUCION_BLOQUEA=1`.

**Quién está en qué, con tres sesiones:** `.goal` vive en el worktree de cada sesión, así que
`scripts/goal-barrido.sh` barre todos los worktrees y dice quién declaró qué orden. Se adosa al
reporte de `scripts/vigilancia-check.sh` **sólo cuando ya hay alarma** (cero ruido en el caso
normal). Hoy "sesión viva sin orden declarada" **no** es alarma por sí sola: se calibra con la
adopción medida, porque un guard que grita en el caso normal se desarma solo. La bajada operativa
para las tres sesiones está en `coordinacion/COORDINACION.md §0.quinquies` — **esa carpeta no está
versionada**, así que la norma canónica es ésta, no aquélla.

**Por qué no es un cron que me obligue a leer el plan:** el día del desvío medido (forense 2026-10-08:
64 PRs, 4 del backlog firmado) los crones **estaban prendidos** y los ids se citaban de pasada. El
problema no era la falta de recordatorio sino la falta de **un sujeto único** contra el que comparar.
Detalle en `memoria/cero-tiempo-ocioso-tres-estados.md` §Refuerzo 2026-10-08.

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
- **Arranque / init cero-fricción → [`HANDOFF.md`](HANDOFF.md)** (raíz). **Memoria del proyecto → `memoria/`** (índice `MEMORY.md`; 256 entradas en el repo y 267 en el slug al 2026-09-22 — la cifra se mide, no se cita de memoria); sembrala en el slug de Claude Code con `scripts/seed-memory.sh` (idempotente).
- **🔍 Auditorías → [`docs/copiloto-emprendedor/Auditorias/`](docs/copiloto-emprendedor/Auditorias/)** (regla del operador, 2026-08-06). **TODO lo relacionado con auditorías se guarda ACÁ**, nunca suelto en `docs/`: el loop Fable (`eval-fable5-*`), los mapas de clases de error, las re-verificaciones, los handoffs de auditoría. Índice + estado vigente en su `README.md`. **Doc maestro actual: `Auditorias/2026-10-15-registro-sprint-mobile-estado-vigente.md`** — estado de cierre del **sprint mobile**, que es el sprint en curso: las DOS cifras con su pregunta, su instrumento y su SHA (citar una por la otra es el error más repetido del sprint). El de la beta Odobi —`Auditorias/2026-09-22-registro-A4-estado-vigente.md`, con el re-check A5 adentro— sigue siendo el maestro de **aquel** sprint, que cerró el 2026-10-08 (`DEC-14`, 7/7 @`92fd8a06`); hasta el 2026-10-15 esta línea lo citaba como el actual. *(Hasta el 2026-09-23 esta línea apuntaba a `2026-08-04-listado-problemas-fixes-reverificado.md`, que sigue siendo el maestro de **aquella** ronda — 11 problemas re-verificados con sus fixes de raíz — pero dejó de ser el actual hace seis semanas.)* Loop reutilizable: `memoria/loop-auditoria-fable-analisis-opus-contratos-e2e.md`.
- Plan de graduación (Fase 0/1/2): `docs/copiloto-emprendedor/2026-07-06-graduacion-plan-fase0-fase1.md`.
- Dominio propio + auth Google: `docs/copiloto-emprendedor/` + config en `deploy/copiloto/`.
- Assets de diseño/voz (fuera del repo): `docs/ASSETS-EXTERNAL.md`.
