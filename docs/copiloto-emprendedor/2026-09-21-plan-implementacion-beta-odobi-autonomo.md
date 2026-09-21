# Plan de implementación autónomo — beta Odobi, de hoy al DoD de todo

**Fecha:** 2026-09-21 · **Base:** `main @ 904dbb5a` · **Autor:** planificación
**Fuente única de alcance:** [`2026-09-21-backlog-beta-odobi-con-dod.md`](2026-09-21-backlog-beta-odobi-con-dod.md) (70 ítems, 193 casillas de DoD). Este plan **no repite** los DoD: los cita por ID. Si un DoD de acá y uno del backlog se contradicen, gana el backlog y planificación corrige este archivo.

**Qué es:** quién hace cada ítem, en qué orden, con qué recursos compartidos, cómo se verifica y cuándo se da por terminado, para que **cuatro sesiones trabajen sin el operador** hasta cerrar todo lo que la beta necesita.
**Qué no es:** un cronograma con fechas. El avance se mide por ítems cerrados con evidencia, no por calendario.

---

## 1. Resumen ejecutivo

- **4 sesiones de ejecución** —BACKEND, FRONTEND-1, FRONTEND-2, AUDITORÍA— y **planificación** (esta sesión), que dirige, emite contratos y no escribe código de `apps/**`.
- **FRONTEND-1 y FRONTEND-2 se reparten por dominio, no por plataforma**: cada una hace su dominio en web **y** en mobile. La paridad queda dentro de una sola cabeza, y los archivos no se pisan (§4.2).
- **BACKEND es dueña exclusiva del teléfono, de los builds EAS y de los deploys de backend.** Es el camino crítico, así que sus colas van primero en cada ola y la verificación en device se hace **por tandas**.
- **AUDITORÍA (Fable) entra 4 veces**, una al cierre de cada ola, con el inventario ya armado por planificación. No lleva cron de 3 minutos: lleva un cron por hora que, si no hay pedido, termina en una línea.
- **Builds EAS: como máximo 2.** El #1 sólo si el dev-client instalable no trae `expo-web-browser` (lo decide un spike en la primera hora). El #2 es el `preview` final. **Congelamiento nativo** durante todo el plan (§6).
- **Dos cierres.** El **Cierre A**, técnico, llega sin intervención del operador: todo el código, desplegado, con evidencia y re-medido. El **Cierre B**, la apertura a testers, son interruptores que decidiste **no encender todavía** (lista de testers, OAuth, backups, legal, SLA, reescritura de historia). Quedan con su runbook listo para que sea una acción tuya y no un proyecto (§13).

---

## 2. Decisiones vigentes (acta del 2026-09-21)

El operador respondió el 21/09. Estas respuestas son **vinculantes** para el plan y reemplazan la columna «Depende de» del backlog donde la citan. Planificación las formaliza en el acta `BL-P3` en la Ola 0.

| DEC | Decisión | Efecto en el plan |
|---|---|---|
| DEC-1 | Mobile lo implementan FRONTEND-1 y FRONTEND-2 por el buzón. **Martín sólo diseña.** | Ningún PR de código nace fuera del buzón. `BL-B4` (gate en bash 3.2) **sale de la beta** → post-beta `BL-V16`. |
| DEC-2 | **Web sigue a mobile**: capas, 6 funciones, 2 temas, ARCA, bloque negro. | Se destraban `BL-X1`–`BL-X5` y `BL-X11`. La traducción a escritorio de las capas la decide FRONTEND-2 en el PR de `BL-X1` y la audita la Ola 2 (§8.3). |
| DEC-3 | Splash con **Reanimated** (spec `Prototipo frontend/odobi-ui/specs/splash-port-reanimated.md`). | `BL-X10` entra sin dependencias nativas nuevas (Reanimated 4.5.0, `react-native-svg`, `expo-audio` ya están). |
| DEC-4 | Los builds EAS los hace **BACKEND**, y se planifican para gastar pocos (≈ 4 h cada uno). | §6. |
| DEC-5 | Neue Einstellung **sale del árbol**. La reescritura de la historia (`filter-repo` + force push) queda como **paso del operador**. | `BL-X6`: la fuente pasa a Plus Jakarta Sans + Inter, como mobile. Los 10 `.otf` salen del árbol por PR. La historia va al runbook de Cierre B (§13.2). |
| DEC-6 | «Cómo hablarle» = **editor de tono con ejemplo**, como el prototipo. | `BL-X7` entra. |
| DEC-7 | **Onboarding entra** en la beta. | `BL-X8` entra (contrato K-14). |
| DEC-8 | Plan y límites **no entran**. | `BL-X9` → `BL-V2`. `BL-P5` marca `plan` y `limite` como VISIÓN. |
| DEC-9 | El CUIT **se puede cambiar**, pero el backend **sólo acepta un CUIT vinculado**. | `BL-C6` con salida: la UI muestra el rechazo del backend. |
| DEC-10 | Se aceptan **todas** las decisiones de Martín ya aplicadas en mobile. Calma = **3 días**. | `BL-W5` con N = 3. `BL-X11` las porta a web. Ninguna se revierte en mobile. |
| DEC-11 | Los dos contrastes que fallan **se corrigen**; no quedan como excepción firmada. | `BL-Q4` los corrige con tokens computados. Martín recibe el valor nuevo en el acta. |
| DEC-12 | Google OAuth y lista de testers: **después**. | `BL-O1` y `BL-O2` → Cierre B. |
| DEC-13 | **Sin iOS.** | `BL-O3` sólo para Android. |
| — | «Nada se enciende todavía»: ni backups, ni legal propio, ni horario de soporte. | `BL-O5`, `BL-O6` y `BL-O7` → Cierre B. `BL-W10` sale **sin número** de horas (su propio DoD lo permite). |
| — | La carpeta `odobi-ui/` de Martín llega el 21/09. | `BL-P2` es disparador del lote B de contratos (§7), con un plan alternativo si se atrasa. |
| — | Hay un teléfono por USB, **distinto** del A16 anterior. | `BL-O9` (nuevo): hay que ponerlo en marcha en la primera hora de BACKEND. |

---

## 3. Alcance

### 3.1 Entra: se cierra de forma autónoma (Cierre A)

Todos los ítems del backlog salvo los de §3.2 y §3.3. Son **62 ítems del backlog** más **4 nuevos** que este plan agrega porque, sin ellos, la ejecución paralela se rompe:

| ID nuevo | Qué | Por qué es necesario |
|---|---|---|
| **BL-O9** | Poner en marcha el teléfono nuevo: dev-client instalado, Metro conectado, `e2e-device` logueado, spike del módulo nativo `ExpoWebBrowser`. | Sin él no hay evidencia de device para ningún ítem de mobile. Decide si hace falta el build EAS #1. |
| **BL-B6** | `gate.sh` aislado por sesión: base de tests, puerto y *stage* del VPS propios. | **Medido:** `test-db.sh` usa un contenedor fijo (`copiloto-test-db`, puerto `55432`) y `sync-test-backend.sh` un *stage* fijo (`/opt/uc-copiloto-cliente-stage`). Tres sesiones corriendo el gate a la vez se pisan la base y el código bajo test, y producen rojos y verdes falsos. Las tres variables ya son parametrizables (`UC_TESTDB_NAME`, `UC_TESTDB_PORT`, `UC_TEST_STAGE`). |
| **BL-B7** | Todo deploy sale de `origin/main`, desde un worktree de deploy dedicado y con un candado. | `sync-web.sh` y `deploy.sh` suben el árbol **local**. Si FRONTEND-1 despliega desde su rama, **revierte en prod** lo que FRONTEND-2 mergeó un minuto antes. Es la misma falla que `memoria/un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado.md`. |
| **BL-P8** | Comando de arranque de la sesión AUDITORÍA con un cron barato. | No existe `.claude/commands/monitoreo-auditoria.md`. Un cron de 3 minutos sobre Fable quema tokens sin trabajo (§9.4). |

**DoD de los nuevos:**
- **BL-O9:**
  - [ ] `adb devices` lista el teléfono nuevo.
  - [ ] El dev-client abre el bundle de Metro servido desde `origin/main`.
  - [ ] Hay captura de Mi día logueado con `e2e-device@copiloto.test`.
  - [ ] Hay un `RESULT.md` del spike con el veredicto `ExpoWebBrowser` presente / ausente en el binario instalado, obtenido con `requireOptionalNativeModule` **y** con un control positivo sobre un módulo que se sabe presente (`ExpoAudio`).
- **BL-B6:**
  - [ ] Cada sesión corre el gate con su triada propia (§5.4).
  - [ ] Control: se lanzan dos gates simultáneos, de dos sesiones distintas, y los dos terminan verdes con recibos distintos.
  - [ ] La triada queda documentada en `COORDINACION.md` §2.
- **BL-B7:**
  - [ ] Existe `C:/gfw-src/wt-deploy`, en *detached* sobre `origin/main`.
  - [ ] Tanto `sync-web.sh` como `deploy.sh` abortan si el árbol no está limpio o si `HEAD` ≠ `origin/main`.
  - [ ] El candado es `mkdir` atómico con TTL y ninguno de los dos deploys corre a la vez.
  - [ ] Control negativo: correr el deploy desde una rama es rechazado.
  - [ ] Después de cada deploy web, el hash del bundle servido coincide con el del build.
- **BL-P8:**
  - [ ] Existe el comando con cron `17 * * * *`.
  - [ ] Si el tick no encuentra ningún `pedido_…-a-auditoria_`, termina en una línea, sin leer nada más.

### 3.2 Sale de la beta por decisión (acta)

| Ítem | Pasa a | Motivo |
|---|---|---|
| `BL-X9` Plan, medidor y tope | `BL-V2` | DEC-8 |
| `BL-B4` Gate en bash 3.2 | `BL-V16` (nuevo post-beta) | DEC-1: Martín no commitea código. Vuelve si eso cambia. |
| `BL-P1` Respuestas del operador | **se cierra** con el acta | Las respuestas ya existen (§2). |

### 3.3 Cierre B: queda listo, pero lo enciende el operador

`BL-O1` (lista de testers) · `BL-O2` (OAuth) · la mitad de distribución de `BL-O3` · `BL-O5` (backups) · `BL-O6` (legal) · `BL-O7` (SLA) · `BL-O8` (rotaciones y ARCA de `341lin`) · reescritura de la historia (DEC-5) · punto 5 del §13 del backlog (el tester externo en su teléfono). El plan **deja preparado** cada interruptor (runbook, texto, script), pero no lo acciona (§13).

---

## 4. Organización

### 4.1 Sesiones y dominios

| Sesión | Modelo | Dominio | Escribe en | Recursos exclusivos |
|---|---|---|---|---|
| **PLANIFICACIÓN** | Opus | Dirección, contratos, acta, `docs/**`, `PLAN.md`, `COORDINACION.md`, inventarios para auditoría | `docs/**`, `coordinacion/**`, `scripts/{vigilancia,cola,…}*.sh`, `.claude/commands/**` | Numeración de contratos `K-*` |
| **BACKEND** | Opus | Todo `apps/copiloto/**`, `motor/**`, `deploy/**`, `scripts/**` (salvo los de planificación), ADRs | idem | **Teléfono (todo `adb`)**, **builds EAS**, **deploy de backend**, **migraciones**, base de tests compartida, Metro para evidencia |
| **FRONTEND-1** «Conversación y sistema» | Opus | Chat, voz, cards y HITL, `Recibo`, artefactos, Inteligencia, Ayuda (soporte, feedback, cómo usar), temas, tipografía, contraste, splash, paridad CI | Sus módulos en `apps/copiloto-web/src/**` y `apps/mobile/**` (§4.2) | `design-system/` web y `theme/` mobile · `apps/mobile/app/_layout.tsx` |
| **FRONTEND-2** «Superficies» | Opus | Armazón web, Mi día (portada, tablero, vacío, agenda), funciones de negocio (gastos, ingresos, presupuestos, clientes), Apps/conexiones, Ajustes (cuenta, negocio, ARCA, tono), onboarding, marca web | Sus módulos (§4.2) | Router y *shell* web (`App.tsx`, navegación) |
| **AUDITORÍA** | **Fable** | Re-medición de la matriz, verificación adversarial **ejecutada**, criterio de cierre | `docs/copiloto-emprendedor/Auditorias/**` | Ninguno. **Presupuesto: 4 entradas + 1 de reserva** (§9) |

**MANEJO DE ERRORES no participa.** Sus archivos (`interceptor_errores.py`, `handler_errores_web.py`, `taxonomia_errores.py`, `trauma_store.py`, `deposito_traumas.py`, `fingerprint.py`, `autosanacion_*.py`) quedan **congelados**. Si un ítem necesita tocarlos, BACKEND emite `hallazgo_` y planificación le reasigna el archivo **moviendo el contrato** (`COORDINACION.md` §4.2.nonies). Una sesión par no se lo auto-asigna.

### 4.2 Propiedad de archivos compartidos (leases)

«Cero solapamiento» se cumple por archivo. Estos son los puntos calientes, con dueño único:

| Archivo o carpeta | Dueño | Cómo lo toca la otra |
|---|---|---|
| `apps/copiloto-web/src/modules/chat/**` · `apps/mobile/src/modules/chat/**` · `…/voz/**` | FE1 | `pedido_` |
| `…/modules/inteligencia/**` · `…/modules/soporte/**` · `…/modules/feedback/**` · cómo usar | FE1 | `pedido_` |
| `apps/copiloto-web/src/design-system/**` · `apps/mobile/src/theme/**` · `fonts.css` · `PantallaApariencia` / `skinsCatalogo` | FE1 | FE2 **consume** tokens; un token nuevo se pide |
| `apps/mobile/app/_layout.tsx` | FE1 | FE2 entrega el *hook* de onboarding como módulo propio; FE1 agrega **una línea** que lo monta |
| `apps/copiloto-web/src/App.tsx` · router · navegación web | FE2 | FE1 pide una ruta nueva con `pedido_` (una línea) |
| `…/modules/midia/**` · `gastos/**` · `ingresos/**` · `presupuestos/**` · `clientes/**` · `connections/**`/`apps/**` · `ajustes/**` · `cuenta` · `negocio/**` · `onboarding/**` | FE2 | `pedido_` |
| `packages/core/src/api/<modulo>.ts` | El dueño del módulo que lo consume | `packages/core/src/api/index.ts`: **sólo se agregan líneas**; el conflicto se resuelve con merge de `main` en la rama, nunca con `rebase` |
| Componente `MicFuncion` de `BL-J7` | FE1 lo construye en `modules/voz/` | FE2 lo **monta** en la fila del rótulo de sus pantallas (una línea por pantalla) |
| `scripts/ci/lint.sh` | BACKEND | FE1 entrega `scripts/ci/paridad-testid.sh` (de su propiedad); la línea que lo invoca la agrega BACKEND a pedido |
| `docs/Imagen de marca/**` · `Prototipo frontend/**` | PLANIFICACIÓN | — |
| `apps/copiloto/kb-usuario/**` y textos del agente | BACKEND | — |

### 4.3 Recursos únicos y su protocolo

| Recurso | Dueño | Protocolo |
|---|---|---|
| **Teléfono** (USB, dev-client) | BACKEND | Las FRONTEND nunca corren `adb`. Piden evidencia con `pedido_<fe>-a-backend_device-<ítem>`, que lista pantallas, gestos (`adb input motionevent`) y el `?ver=` de referencia. BACKEND trabaja **por tandas** (§5.6) y devuelve `respuesta_` con las rutas de evidencia. |
| **Metro** | BACKEND | Sirve desde `C:/gfw-src/wt-metro`, en *detached* sobre `origin/main`. Para iterar un gesto **antes** del merge (p. ej. `BL-D2`), la FRONTEND pide `device-previo`, nombra su rama, y BACKEND sirve esa rama durante la tanda y **vuelve a `main`** al terminar. |
| **Builds EAS** | BACKEND | §6. |
| **Deploy de backend** (`deploy.sh`) | BACKEND | Desde `wt-deploy` (`BL-B7`). |
| **Deploy web** (`sync-web.sh`) | La FRONTEND que mergeó | **Sólo** desde `wt-deploy`, en *detached* sobre `origin/main` recién traído, **con el candado**. Nunca desde su worktree. Así, el deploy de una lleva también lo que mergeó la otra: es el comportamiento buscado. |
| **Base de prod** | BACKEND | Toda escritura hecha desde el device o el PWA va al tenant `e2e-device`. Los residuos se limpian con `deploy/copiloto/limpiar_residuos_test.py`. Toda consulta de conteo se hace **con claims** (FORCE RLS). |
| **VPS de tests** | cada sesión con su triada | `BL-B6`. |

---

## 5. Protocolo de ejecución autónoma (lo cumple toda sesión, en cada ítem)

### 5.1 Ciclo de un ítem

1. **Tomar.** Si el ítem tiene contrato, se hace `mv abierto/→en-curso/` **pegado** al acuse. Si no lo tiene, alcanza con la cola de la sesión (§8): no hace falta pedir permiso.
2. **Preparar.** Invocar `/ejecutar-con-eficiencia` y las skills del dominio **antes de la primera edición** (§5.3). Después, inventario: grafo (`graphity-code`, `group_id=code-copiloto-emprendedor`) → `Grep` → leer el archivo citado en la evidencia del backlog. Si hay algo de cáscara, gesto o animación, se lee primero el equivalente en documed.
3. **Rama.** Desde `origin/main` recién traído, en el **worktree propio de la sesión**: `backend/bl-<id>-<slug>`, `frontend1/bl-<id>-<slug>`, `frontend2/bl-<id>-<slug>`.
4. **Test primero** donde tenga sentido. Integración antes que mocks. Si el ítem toca tenant, el adversarial se escribe **antes** del código.
5. **Implementar.** Se puede agrupar en un solo PR un par de ítems chicos del mismo dominio (`memoria/batch-cambios-no-pr-por-tweak.md`), pero **nunca** uno de backend con uno de frontend, ni dos contratos distintos.
6. **Gate.** `bash scripts/gate.sh` con la triada de la sesión. La salida va **completa a archivo** (nunca por `tail`) y el recibo queda en `.ci-recibos/<sha>.json`.
7. **PR.** El body lleva:
   - causa raíz o motivación;
   - plan de rollback;
   - DoD del ítem copiado del backlog con cada casilla marcada y su evidencia;
   - el recibo.
8. **Merge** con checks verdes. Está autorizado; no se pregunta. Antes de mergear varios PR en lote, verificar la base de cada uno.
9. **Deploy**, desde `wt-deploy` (§4.3), y **sonda contra el vivo**, que tiene que poder dar negativo: HTTP público, o el hash del bundle.
10. **Evidencia:**
    - Web: Playwright contra el PWA, con `serviceWorker.unregister()` + `caches.delete` antes de medir, lado a lado con `?ver=`.
    - Mobile: `pedido_` de device a BACKEND. **La sesión no espera**: toma el ítem siguiente. El ítem queda «desplegado, espera device».
11. **Cierre.** `cierre_` con las casillas del DoD y la evidencia; el contrato va a `cerrado/<fecha>/`. Un ítem sin evidencia de device **no se cierra**, aunque esté mergeado (`COORDINACION.md` §6).

### 5.2 Qué decide la sesión sola y qué escala

**La sesión decide y ejecuta lo TÁCTICO**, y lo anota en el PR:
- nombres;
- forma interna de un componente;
- elegir gesto o botón en `BL-W6`;
- qué otros `kind` de artefacto porta `BL-F2`;
- la traducción a escritorio de las capas (`BL-X1`) **dentro** de la regla «web sigue a mobile»;
- el botón Aprobar de `BL-J9`;
- el orden dentro de su cola;
- partir un ítem L en PR sucesivos.

**Se escala a planificación con `pedido_`**, que responde o reasigna sin frenar a la sesión:
- un contrato que no cierra con la realidad del código;
- un archivo de otra sesión;
- un ítem bloqueado más de un ciclo.

**Se escala al operador (MAYOR)**, siempre vía planificación, que avisa por `/avisar-telegram`. Mientras tanto, la sesión **sigue con otro ítem**:
- force push o reescritura de historia;
- borrar datos de prod fuera del tenant de prueba;
- `DROP COLUMN` (`BL-V9`);
- una dependencia paga nueva;
- una dependencia **nativa** nueva (rompe el congelamiento, §6);
- encender algo de §3.3;
- contradecir un DEC.

### 5.3 Skills obligatorias por dominio

| Toca | Skill (antes de escribir) |
|---|---|
| Cualquier cosa en `apps/mobile/` | `swmansion-react-native-best-practices` |
| Gestos (`BL-D2`, `BL-W1`) | `swmansion-rn-gestures` |
| Animación (`BL-W4`, `BL-X10`, rodillo, splash) | `swmansion-rn-animations` · `swmansion-rn-multithreading` |
| Audio (`BL-W1`, pronunciación del splash, `BL-J7`) | `swmansion-rn-audio` |
| SVG (isotipo, splash, íconos) | `swmansion-rn-svg` |
| TTI y re-renders (`BL-X10`, `BL-F1`) | `callstack-react-native-performance` |
| Navegación (`BL-X1` mobile, onboarding) | `callstack-react-navigation` |
| **Workflow, activity, worker o dispatcher** (`BL-B2`, `BL-J7`, `BL-J8`, `BL-J9`, `BL-J13`, `BL-X8`) | `temporal-developer` + `temporal-ai-patterns` |
| Grafo | `graphity` |
| Cambio de UI de web | Playwright con SW purgado |

**La regla del tercer intento:** dos intentos fallidos sobre un gesto, una animación o el rendimiento hacen que el tercero sea **leer la skill**, no otro fix.

### 5.4 Git y entorno por sesión

| Sesión | Worktree | Triada del gate (`BL-B6`) |
|---|---|---|
| BACKEND | `C:/gfw-src/wt-backend` | `UC_TESTDB_NAME=copiloto-test-db-be` · `UC_TESTDB_PORT=55432` · `UC_TEST_STAGE=/opt/uc-copiloto-cliente-stage-be` |
| FRONTEND-1 | `C:/gfw-src/wt-fe1` (hoy en `fix/recording-overlay-sin-scrim`: ver §14.1) | `…-fe1` · `55433` · `…-stage-fe1` |
| FRONTEND-2 | `C:/gfw-src/wt-fe2` (nuevo) | `…-fe2` · `55434` · `…-stage-fe2` |
| Deploys | `C:/gfw-src/wt-deploy` (*detached*) | — |
| Metro | `C:/gfw-src/wt-metro` (*detached*) | — |

Reglas duras, sin excepción:
- `git add` con rutas explícitas.
- Nunca `-A`, `.`, `--amend`, `rebase`, `reset`, `checkout` en el checkout compartido, `pull`, `stash` ni `clean`.
- `git status` antes de cada commit, y un grep de formas de credencial en lo que se va a subir. **El repo es público.**
- `coordinacion/` nunca se versiona.
- En su **propio** worktree, una sesión sí puede hacer `switch -c` desde `origin/main`. La prohibición de §1 protege el checkout compartido.

### 5.5 Cero ocio

Cuando termina un ítem, la sesión toma el siguiente de su cola **sin avisar**. Si el siguiente está bloqueado, salta al primero que no lo esté. Con toda la cola bloqueada, emite `pedido_<sesion>-a-planificacion_sin-cola`, y planificación responde en el mismo ciclo con trabajo adelantable. «Esperando device» o «esperando contrato» **no** cuenta como ocio si la sesión sigue con otro ítem; sí cuenta si se queda parada.

### 5.6 Tandas de device (BACKEND)

- **Cuándo:** con ≥ 3 pedidos de device acumulados, o cuando el más viejo cumple 3 h. Se cumple lo primero.
- **Qué:** en una tanda, todos los pedidos pendientes, en orden de llegada.
- **Protocolo:**
  - `dato_backend-a-todos_tomo-device` al empezar y `…_suelto-device` al terminar;
  - `force-stop` + limpiar caché de la app entre ítems que tocan la misma pantalla;
  - `adb input motionevent` DOWN/MOVE/UP para gestos;
  - `uiautomator dump` **no** vale como prueba si hay animación;
  - video con `screenrecord` para gestos y animaciones.
- **Salida:** `respuesta_backend-a-<fe>_device-<ítem>` con las rutas en `_evidencia/<fecha>/<ítem>/` y el veredicto por casilla. Si falla, dice qué se vio: la FRONTEND abre el fix y **el ítem no se cierra**.

---

## 6. Estrategia de builds EAS

**Principio:** mientras no cambie el binario, todo se itera por Metro. Un build EAS (≈ 4 h) se paga sólo cuando un cambio nativo lo exige, y los cambios nativos se juntan.

| Build | Perfil | Cuándo | Disparador | Qué incluye |
|---|---|---|---|---|
| **#0 (no es un build)** | — | Hora 0 de BACKEND | `BL-O9` | Se instala en el teléfono nuevo el APK `development` **existente** (`eas build:list --platform android --profile development --limit 1 --json` → `artifacts.buildUrl`). El último es del ciclo del 10/08, y `expo-web-browser` entró al `package.json` el 04/08 (#236): lo más probable es que el binario ya traiga el módulo. **No se asume: el spike de `BL-O9` lo mide.** |
| **#1** | `development` | **Sólo si** el spike da `ExpoWebBrowser` ausente, o si no se puede descargar el APK existente | Veredicto del spike | Todo lo nativo de `main` en ese momento. Se lanza en *background* desde `wt-deploy` y no bloquea nada: mientras compila, Metro sigue sirviendo sobre el dev-client viejo, y sólo `BL-C5` espera. |
| **#2** | `preview` | Ola 4, cuando el código de las Olas 1–3 está mergeado | Todos los ítems con mobile de las Olas 1–3 cerrados o «espera device» | El APK de distribución (`BL-O3`) y el binario sobre el que se hace el barrido final `BL-Q3`. |

- **Congelamiento nativo:** desde la Ola 0 hasta el build #2, **ningún PR agrega ni sube de versión una dependencia con código nativo**: nada de `expo-*` nuevo, ni `react-native-*` nuevo, ni plugins de `app.json`. La regla se hace cumplir con una sección de `scripts/ci/mobile.sh`, a cargo de BACKEND en `BL-B6`: si `apps/mobile/package.json` o `app.json` cambian en la rama, el PR falla salvo que su body tenga `NATIVO-APROBADO: <contrato>`. Una excepción la aprueba planificación con el operador y entra en el build #2.
- **Rebuild siempre desde `origin/main`** (`wt-deploy`), nunca desde una rama: un build desde otra base revierte fixes ya cerrados.

---

## 7. Contratos de junta

Planificación los emite con la plantilla de `COORDINACION.md`:
- inventario de lo existente (§4.2.septies);
- sección `/ejecutar-con-eficiencia` + skills (§4.quater);
- endpoint, request, response, códigos;
- DoD por lado, citando el del backlog;
- un campo nuevo es **aditivo y opcional**, con test de compatibilidad.

**Ningún lado implementa una junta sin su contrato en `abierto/`.** Mientras tanto, se hace el resto de la cola.

| K | Ítems | Lados | Lote | Disparador de emisión |
|---|---|---|---|---|
| K-01 | `BL-D1` + `BL-J1` idempotencia de presupuesto | BE + FE1 | **A** | Ola 0 |
| K-02 | `BL-C6` CUIT validado (DEC-9) | BE + FE2 | **A** | Ola 0 |
| K-04 | `BL-J6` cartera en `/clientes` | BE + FE2 | **A** | Ola 0 |
| K-05 | `BL-J10` teléfono y email del negocio | BE + FE2 | **A** | Ola 0 |
| K-07 | `BL-J9` acciones tras guardar/aprobar presupuesto | BE + FE1 | **A** | Ola 0 |
| K-08 | `BL-J12` «Lo pediste vos» | BE + FE1 | **A** | Ola 0 |
| K-11 | `BL-J8` gate `requiere_conexion` | BE + FE1 | **A** | Ola 0 |
| K-12 | `BL-J11` mail y contraseña (GoTrue) | BE + FE2 | **A** | Ola 0 |
| K-15 | `BL-X7` editor de tono con ejemplo | BE + FE2 | **A** | Ola 0 |
| K-03 | `BL-J2` + `BL-J3` fecha de corte y variación (MC-H2) | BE + FE2 | **B** | `BL-P2` en el repo (formas de Martín) |
| K-06 | `BL-J5` verbo y criticidad (MC-B3) | BE + FE2 | **B** | `BL-P2` |
| K-09 | `BL-J4` salud por conexión (MC-H3) | BE + FE2 (+ FE1 para el badge del chat si aplica) | **B** | `BL-P2` |
| K-10 | `BL-J7` voz dentro de las funciones | BE + FE1 (componente) + FE2 (montaje) | **B** | Cierre del contrato K-01 (el dispatcher ya estabilizado) |
| K-13 | `BL-J13` agenda de varios días + ADR | BE + FE2 | **B** | ADR redactado por BACKEND (numeración suya) |
| K-14 | `BL-X8` onboarding: 2 permisos + primer insight | BE + FE2 | **B** | `BL-P2` + lectura de `mockups/01-onboarding` |

**Plan alternativo si `BL-P2` se atrasa:** si 48 h después de emitido el lote A la carpeta de Martín no está en el repo, planificación redacta K-03, K-06, K-09 y K-14 desde el prototipo del 07/09 y desde el código de mobile. Los marca `[RECONCILIAR-CON-P2]` y, cuando llegue la carpeta, emite un `dato_` con el diff de formas. Como todo campo es aditivo y opcional, reconciliar después no rompe clientes.

**Idempotencia de planificación:** antes de emitir un `K-*`, se busca en `abierto/`, `en-curso/` y `cerrado/` por su ID, y no se emite dos veces.

---

## 8. Olas y colas por sesión

**Una ola no es una barrera para las sesiones.** Es un **punto de control** para la auditoría y el smoke. Una sesión que termina su parte de la Ola N sigue con la N+1 sin esperar a las demás, siempre que las dependencias del ítem estén cumplidas. La ola **cierra** cuando todos sus ítems tienen `cierre_`. En ese momento, planificación arma el inventario y lo pasa a auditoría.

**Orden dentro de cada cola:**
1. defectos;
2. lo que destraba a otra sesión;
3. S antes que M antes que L.

Cada fila dice qué la bloquea. Si no dice nada, arranca ya.

### 8.0 Ola 0 — Preparación (planificación; empieza al publicar este plan)

| # | Qué | Salida verificable |
|---|---|---|
| 0.1 | `BL-P3` acta de decisiones (§2), que cierra `BL-P1` | Doc `docs/copiloto-emprendedor/2026-09-21-acta-decisiones-beta-odobi.md` en `main` |
| 0.2 | `BL-P4`: el contrato del 16/09 va a `cerrado/2026-09-21/` con nota de reemplazo | `ls cerrado/2026-09-21/` |
| 0.3 | `BL-P7`: los 8 mensajes viejos de `abierto/` van a `cerrado/<fecha-original>/` | `abierto/` sólo con trabajo vivo |
| 0.4 | Un `contrato_` de cola por sesión (backend, frontend1, frontend2), con la tabla de §8.1–8.4 que le toca | 3 archivos en `abierto/` que pasan `lint-contratos-eficiencia.sh` |
| 0.5 | Contratos del lote A (K-01, K-02, K-04, K-05, K-07, K-08, K-11, K-12, K-15) | 9 archivos en `abierto/` |
| 0.6 | `BL-P8` comando de arranque de auditoría | `.claude/commands/monitoreo-auditoria.md` en `main` |
| 0.7 | `PLAN.md` COLA-VIVA reescrita con las olas de este plan | Diff en `main` |
| 0.8 | `BL-X6` (mitad docs): los 10 `.otf` salen del árbol (`docs/Imagen de marca/Neue_Einstellung/` y `Prototipo frontend/odobi-ui/assets/fonts/`) | PR mergeado + `git ls-files '*.otf'` vacío |
| 0.9 | Mensaje para Martín, que va **por el operador**: `BL-P6` (corregir `fact-sinarca`), valores nuevos de contraste (DEC-11, cuando `BL-Q4` los fije) y el aviso de que su carpeta no traiga `.otf` | Texto listo en el acta, §Para Martín |

### 8.1 BACKEND

| Ola | # | Ítem | Depende de | Nota operativa |
|---|---|---|---|---|
| 1 | 1 | **BL-O9** poner en marcha el teléfono nuevo + spike `ExpoWebBrowser` | — | Primera hora. El veredicto decide el build #1 (§6). |
| 1 | 2 | **BL-B6** gate aislado por sesión + control de congelamiento nativo en `mobile.sh` | — | Destraba a las dos FRONTEND. **Sale antes que cualquier otro PR.** |
| 1 | 3 | **BL-B7** `wt-deploy` + candado + guard `HEAD==origin/main` | — | Destraba los deploys web de las FRONTEND. |
| 1 | 4 | **BL-Q2** smoke E2E de línea base contra prod | — | Salida completa a archivo. Las fallas pasan a ítem nuevo, no se arreglan acá. |
| 1 | 5 | **BL-D1/BL-J1** idempotencia de `presupuesto_store.crear` | K-01 | Conteo de duplicados **con claims**, antes y después. |
| 1 | 6 | **BL-B1** durabilidad E3 | El deploy de D1 (reinicia el worker) | Se corre `scripts/e2e_g6_durabilidad_worker_restart.py` **en ese deploy**, con una conversación y un HITL en vuelo. Se cablea a `deploy.sh` como paso opcional `--durabilidad`. |
| 1 | 7 | **BL-C6** (backend) CUIT sólo vinculado + adversarial A→B | K-02 | |
| 1 | 8 | **BL-B2** timeout del `FacturaWorkflow` con `workflow.patched` + replay | — | `temporal-developer` primero. |
| 1 | 9 | **BL-B3** gitleaks fijado en `pre-push` + `lint.sh` + pasada por toda la historia | — | Control positivo y negativo. La allowlist nombra los fixtures conocidos. |
| 1 | 10 | **BL-B5** ADR-001: dice una sola cosa | — | Recomendado: aceptar por escrito que en la beta el gate sigue siendo manual, porque probar el mirror es trabajo sin usuario. |
| 1 | 11 | **BL-X5** (backend) «AFIP» → «ARCA» en textos del agente al usuario y en `kb-usuario` | — | Los identificadores internos no se tocan. |
| 1 | — | **Tandas de device** para lo que piden FE1 y FE2 | pedidos | Continuo (§5.6). |
| 1 | — | **Build #1** si el spike lo pide | BL-O9 | En *background*. |
| 2 | 12 | **BL-J6** cartera total | K-04 | Adversarial. |
| 2 | 13 | **BL-J10** teléfono y email del negocio (migración + RLS) | K-05 | Adversarial. BACKEND es dueña de la migración. |
| 2 | 14 | **BL-J9** sugerencias tras guardar/aprobar | K-07 | Toca la respuesta de la tool: `temporal-ai-patterns`. |
| 2 | 15 | **BL-J12** feedback propio con estado | K-08 | Adversarial + marca «escuchado» desde admin. |
| 2 | 16 | **BL-X7** (backend) el tono llega al prompt; test que arma el prompt con cada combinación | K-15 | |
| 2 | 17 | **BL-J11** cambio de mail y contraseña | K-12 | Tests de integración contra una GoTrue **de test** con cuentas efímeras. En prod, sólo `e2e-device`: se cambia la contraseña y se **restaura** con un script, y el mail llega hasta «confirmación enviada». Ver §12, R-9. |
| 2 | 18 | **BL-J2 + BL-J3** fecha de corte y variación | K-03 | Test con un tenant de un solo mes. |
| 2 | 19 | **BL-J5** `categoria`/`criticidad`/`verbo` por regla del detector | K-06 | |
| 3 | 20 | **BL-J8** gate estructurado `requiere_conexion` que reanuda el pedido | K-11 | `temporal-developer`: cambio de workflow con `patched`. |
| 3 | 21 | **BL-J7** contexto de función opcional en el dispatcher | K-10 | El test de regresión del dispatcher en el VPS se corre **antes** de tocar nada. |
| 3 | 22 | **BL-J4** salud por conexión + regla del detector | K-09 | L. Adversarial. |
| 3 | 23 | **BL-J13** ADR + agenda de varios días + escribir eventos con HITL | K-13 | L. Adversarial. |
| 3 | 24 | **BL-X8** (backend) primer insight del onboarding | K-14 | |
| 3 | 25 | **BL-O4** observabilidad: alertas a Telegram | — | Se vendorea `obs-*` de `fleet-platform` con `sync-fleet-platform.sh` (nunca se edita `platform/`). Cada alerta se dispara una vez a propósito. |
| 4 | 26 | **Build #2** `preview` desde `wt-deploy` | Olas 1–3 con mobile cerrado o «espera device» | Se instala en el teléfono. |
| 4 | 27 | **BL-O3** (mitad técnica) APK `preview` instalado + instructivo de instalación para testers | Build #2 | La prueba por alguien de afuera del equipo es Cierre B. |
| 4 | 28 | **BL-Q3** (device) barrido de las pantallas spec sobre el build #2 | Build #2, BL-P5 | Tandas; video de gestos. |
| 4 | 29 | **BL-Q2** smoke final + **BL-B1** corrido otra vez con el último deploy | — | Sobre el SHA del Cierre A. |

### 8.2 FRONTEND-1 — Conversación y sistema

| Ola | # | Ítem | Plataformas | Depende de | Nota |
|---|---|---|---|---|---|
| 1 | 1 | **BL-D2** deslizar a la izquierda cancela + descarte < 350 ms en mobile | web + mobile | BL-B6 (para el gate) | Pide `device-previo` para iterar el gesto. `swmansion-rn-gestures`. |
| 1 | 2 | **BL-D3** HITL genérico de mobile completo | mobile | — | Referencia: `HitlCard.tsx` de web. |
| 1 | 3 | **BL-D1** (mobile) estado terminal persistido de la card de presupuesto | mobile | K-01 | La guarda local no espera al backend; el test de remount, sí. |
| 1 | 4 | **BL-C2** CAE, número, vencimiento y PDF en la card de web | web | — | Factura real en homologación con `e2e-device`. |
| 1 | 5 | **BL-C3** separadores de fecha | web + mobile | — | Test del borde de medianoche en `America/Argentina/Buenos_Aires`. |
| 1 | 6 | **BL-W1** Pausar/Reanudar/Eliminar/Enviar | web | — | |
| 1 | 7 | **BL-W4** rodillo de ejemplos con pausa y movimiento reducido | web + mobile (deuda) | — | |
| 1 | 8 | **BL-F2** tarjeta `payment_link` en mobile + share sheet | mobile | — | `Share` de RN (no es nativo nuevo). |
| 1 | 9 | **BL-W9** «Cómo usar» abre el chat principal | web | — | Porta `mensajePendiente.ts`. |
| 1 | 10 | **BL-W3** pantalla de feedback | web | — | |
| 1 | 11 | **BL-W10** textos de soporte + encabezado con isotipo, **sin número de horas** | web + mobile | — | Acta: sin SLA todavía. |
| 1 | 12 | **BL-W6** textos del refresco | web + mobile | — | La decisión gesto/botón va en el PR. |
| 2 | 13 | **BL-F1** `Recibo` compartido: absorbe `comprobante.tsx` y los textos terminales | web + mobile | BL-C2 mergeado | Grep de verificación: ninguna card con texto terminal propio. |
| 2 | 14 | **BL-X4** 2 temas con muestras + «Como el teléfono»; web retira `nocturno` | web + mobile | — | |
| 2 | 15 | **BL-X6** (código) Plus Jakarta Sans + Inter en web; ningún `@font-face` roto | web | Ola 0.8 | Test que resuelve cada `src`. |
| 2 | 16 | **BL-Q4** contrastes: se computan todos los pares **pintados** y se **corrigen** los dos que fallan | web + mobile | BL-X4, BL-X6 | DEC-11. El valor nuevo va al acta para Martín. |
| 2 | 17 | **BL-X2** 6 funciones + fusión Contabilidad → Inteligencia | web | — | Retira `ContabilidadScreen`. |
| 2 | 18 | **BL-X3** «Preguntar» abre el chat principal; se borra el mini-chat | web + mobile | BL-W9 (el puente) | |
| 2 | 19 | **BL-J9** (FE) chips «Mandalo por mail» / «¿Te armo la factura?» | web + mobile | K-07 | |
| 2 | 20 | **BL-J12** (FE) sección «Lo pediste vos» | web + mobile | K-08 | |
| 3 | 21 | **BL-J8** (FE) *sheet* de consentimiento en contexto | web + mobile | K-11 | |
| 3 | 22 | **BL-J7** (FE) componente `MicFuncion` + hook + chip «Por voz · duración» | web + mobile | K-10 | Lo entrega a FE2 con `dato_` para el montaje. |
| 3 | 23 | **BL-X10** splash, entrada y reveal con Reanimated (y equivalente en web) | web + mobile | — | Medir el TTI antes y después (`callstack-react-native-performance`). Video del primer y del segundo arranque. |
| 3 | 24 | **BL-Q1** control de paridad de `testID` en CI | repo | Pantallas de las Olas 1–2 mergeadas | Control positivo: se borra un id en una sola app y el gate da rojo. |
| 4 | 25 | **BL-Q3** (web) barrido de las pantallas de su dominio en el PWA | web | — | SW purgado, lado a lado. |

### 8.3 FRONTEND-2 — Superficies

| Ola | # | Ítem | Plataformas | Depende de | Nota |
|---|---|---|---|---|---|
| 1 | 1 | **BL-C1** desconectar una app | web | — | Composio **y** MercadoPago. |
| 1 | 2 | **BL-W2** descripción por capacidad | web | — | |
| 1 | 3 | **BL-C4** origen de la propuesta en el formulario | web + mobile | — | |
| 1 | 4 | **BL-C5** login de apps con `expo-web-browser` | mobile | Veredicto de BL-O9 (o build #1) | Si el módulo está, se cierra por Metro. Si no, espera el build #1. |
| 1 | 5 | **BL-C6** (FE) «Cambiar CUIT» con el rechazo del backend visible | web + mobile | K-02 | |
| 1 | 6 | **BL-W8** portada financiera como componente autocontenido | web | — | «—», nunca «$0». |
| 1 | 7 | **BL-W5** vacío + Calma con **N = 3** en una constante única para las dos apps | web | — | Test con reloj simulado. |
| 1 | 8 | **BL-W7** chips de categoría + contador (módulo derivable y borrable) | web | — | Se borra en BL-J5. |
| 1 | 9 | **BL-X5** (web) «AFIP» → «ARCA» en todo string visible | web | — | Grep = 0. |
| 1 | 10 | **BL-X11** decisiones de Martín en web: logos reales, cinco íconos, trazo 1,3, lockup en el login | web | Assets de `BL-P2` para los logos | El isotipo de Soporte va en BL-W10 (FE1). Licencia de uso de marca anotada. |
| 2 | 11 | **BL-X1** armazón en capas en web: aterriza en Mi día y Ajustes se abre sólo por el avatar | web | — | L. La traducción a escritorio queda escrita en el PR y la mira la auditoría de la Ola 2. |
| 2 | 12 | **BL-X7** (FE) editor de tono con ejemplo; Mi negocio queda con una fila-resumen | web + mobile | K-15 | |
| 2 | 13 | **BL-J6** (FE) chip de cartera independiente de la paginación | web + mobile | K-04 | |
| 2 | 14 | **BL-J10** (FE) teléfono y email del negocio | web + mobile | K-05 | |
| 2 | 15 | **BL-J11** (FE) cambiar mail y contraseña; la fila se oculta o explica para cuentas de Google | web + mobile | K-12 | |
| 2 | 16 | **BL-J2 + BL-J3** (FE) fecha de corte y variación en la portada | web + mobile | K-03 | |
| 2 | 17 | **BL-J5** (FE) tablero desde el detector; se borran `categoriaTarjeta.ts` y su gemelo | web + mobile | K-06 | Grep vacío. |
| 3 | 18 | **BL-J4** (FE) portada incompleta que lo dice + punto del avatar + badge «Reconectar» | web + mobile | K-09 | |
| 3 | 19 | **BL-J7** (FE) monta `MicFuncion` en Gastos, Ingresos, Presupuestos y Clientes; foto directa desde Gastos | web + mobile | Entrega de FE1 (K-10) | |
| 3 | 20 | **BL-J13** (FE) pantalla Agenda + «Nuevo evento» | web + mobile | K-13 | |
| 3 | 21 | **BL-X8** (FE) onboarding: hilo de 2 permisos + recibo del primer insight | web + mobile | K-14 | En device se prueba **reseteando el flag de onboarding de `e2e-device`** (no se crea otro usuario). En mobile se monta con la línea de FE1 en `_layout.tsx`. |
| 4 | 22 | **BL-Q3** (web) barrido de las pantallas de su dominio en el PWA | web | — | |

### 8.4 AUDITORÍA

| Entrada | Cuándo | Qué recibe | Qué entrega |
|---|---|---|---|
| **A1** | Cierre de la Ola 1 | Inventario de planificación: lista de PR con SHA, filas de la matriz tocadas, controles de tenant nuevos (C6, D1) con el comando exacto del test adversarial, evidencias | Filas re-medidas (`BL-Q5`), adversariales **corridos**, no leídos, y lista de hallazgos con severidad |
| **A2** | Cierre de la Ola 2 | Idem + la traducción a escritorio de `BL-X1` + la tabla de contrastes de `BL-Q4` | Idem + veredicto sobre la paridad web↔mobile de las capas + **recomputación independiente** de 5 pares de contraste elegidos por ella |
| **A3** | Cierre de la Ola 3 | Idem + los cambios Temporal (`BL-J7`, `BL-J8`, `BL-B2`) con sus tests de replay | Idem + determinismo verificado (replay corrido) |
| **A4** | Candidato a Cierre A | SHA único + evidencias de `BL-Q3` + smoke final + `BL-B1` | **Matriz completa** re-medida contra el prototipo final + veredicto binario de los criterios 1–4 del §13 del backlog |
| Reserva | Sólo si un cierre queda en disputa o hay un incidente de aislamiento | El hallazgo puntual | Veredicto |

---

## 9. Auditoría: uso con criterio

### 9.1 Por qué 4 entradas y no una por ítem

Fable es la sesión más cara. Su valor es **independencia** y **re-medición contra el prototipo**, no revisar cada PR: esa verificación ya la dan el gate, los tests adversariales y la evidencia de device. Una entrada por ola junta ~15–25 ítems en una sola lectura del prototipo y de la matriz.

### 9.2 Qué hace planificación antes de cada entrada (script-first)

1. Genera `Auditorias/<fecha>-inventario-ola-N.md` con:
   - PR, SHA mergeado, recibo del gate;
   - filas de la matriz (`?ver=`) que tocó;
   - controles de tenant nuevos con **el comando exacto** que los ejercita;
   - rutas de evidencia.
2. Emite `pedido_planificacion-a-auditoria_ola-N` que apunta a ese archivo. **No dice «explorá»:** apunta a paths (`memoria/sesion-con-modelo-caro-se-le-entrega-el-inventario-hecho.md`).

### 9.3 Cómo gasta la auditoría

- Usa sub-agentes **sonnet/haiku** para capturas, barridos y greps. El modelo caro queda para juzgar.
- Corre los adversariales, no los lee: el control negativo estático no caza una constante equivocada.
- Una entrada termina con `cierre_auditoria-a-planificacion_ola-N` + el doc en `Auditorias/`. No abre trabajo nuevo por su cuenta: cada hallazgo es una fila para que planificación la asigne.

### 9.4 Cron

`17 * * * *`, una vez por hora. Primer paso del prompt: `ls coordinacion/abierto/ | grep -- '-a-auditoria_'`. Si da vacío, responde `sin pedido` y **termina el turno**, sin leer nada más. Lo instala `/monitoreo-auditoria` (`BL-P8`).

---

## 10. Planificación durante la ejecución

- **Crones:** los tres de `/monitoreo` (parálisis `*/3`, vigía `7,27,47`, ociosas `1-58/3`). Si una sesión aparece «gira en vacío», se le reasigna algo **en el mismo ciclo**.
- **Contratos:**
  - lote B (§7) con sus disparadores;
  - una respuesta a todo `pedido_` en el mismo ciclo;
  - una corrección de un contrato ya acusado va siempre con aviso al buzón.
- **Tablero:** `PLAN.md` COLA-VIVA con una fila por ítem. El estado **es** la ubicación del archivo; no se lleva un tablero paralelo.
- **Ola:** cuando todas sus filas tienen `cierre_`, planificación corre `BL-Q2` (smoke, lo ejecuta BACKEND a pedido), arma el inventario y abre la entrada de auditoría.
- **Hallazgos:** cada hallazgo de auditoría pasa a una fila nueva en la cola de la sesión dueña, con prioridad de defecto si rompe una garantía.
- **Escalamiento al operador:** sólo lo MAYOR de §5.2, por `/avisar-telegram`.
- **Memoria:** al cerrar cada ola, una entrada en `memoria/` por lección que costó algo real y puede volver. Nunca inflar el índice.

---

## 11. Criterios de cierre

### 11.1 Ítem

DoD base del backlog §0.4 (1–9) + DoD propio del ítem. **Nada menos.** Un ítem «mergeado y desplegado, espera device» **no** está cerrado.

### 11.2 Ola

- [ ] Todos sus ítems tienen `cierre_` en `cerrado/`.
- [ ] `BL-Q2` smoke contra prod: 0 fallas, o cada falla con ítem nuevo asignado.
- [ ] Entrada de auditoría cerrada, con sus hallazgos asignados.

### 11.3 Cierre A: beta técnica completa (autónomo)

Medido sobre **un mismo SHA** de `main`:

- [ ] Todos los DEC con acta (§2).
- [ ] Todos los ítems de §3.1 cerrados con su DoD.
- [ ] Matriz re-medida por A4: ✅ en web **y** mobile para toda pantalla marcada **spec** en `BL-P5`, contra el prototipo final (`BL-P2`).
- [ ] `smoke_beta_e2e.py` verde contra prod y `BL-B1` verde sobre el último deploy.
- [ ] APK `preview` (build #2) instalado en el device, con el barrido `BL-Q3` hecho sobre él.
- [ ] `git ls-files '*.otf'` vacío; gitleaks verde sobre `HEAD`.
- [ ] Runbook de Cierre B (§13) en `main`, con cada interruptor listo.

### 11.4 Cierre B: apertura a testers (lo enciende el operador)

Coincide con el §13.5 del backlog más los ítems de §3.3. **No es parte de la ejecución autónoma.** Planificación avisa por Telegram cuando se alcanza el Cierre A.

---

## 12. Registro de riesgos

| R | Riesgo | Prob. | Impacto | Mitigación | Dueño |
|---|---|---|---|---|---|
| R-1 | **BACKEND es el cuello de botella** (juntas + device + builds + deploys) | Alta | Alto | Su cola va primero en cada ola. Tandas de device (§5.6). Las FRONTEND nunca esperan paradas. Los L de la Ola 3 arrancan apenas existe su contrato, sin esperar el cierre de la Ola 2. Sub-agentes para barridos. | Planificación vigila el backlog de `pedido_` a backend; si pasa de 6, se repriorizan las tandas. |
| R-2 | **Un deploy desde un árbol viejo revierte el trabajo de otra sesión** | Alta sin BL-B7 | Crítico | `BL-B7`: `wt-deploy` + guard `HEAD==origin/main` + candado + verificación del hash. | BACKEND |
| R-3 | **Gates concurrentes se pisan la base y el stage** | Alta sin BL-B6 | Alto (verdes y rojos falsos) | `BL-B6` + triada por sesión (§5.4). | BACKEND |
| R-4 | El binario instalado no trae un módulo nativo | Media | Medio | Spike en `BL-O9` con control positivo + congelamiento nativo con guard en CI (§6). | BACKEND |
| R-5 | No-determinismo en Temporal (`BL-B2`, `BL-J7`, `BL-J8`, `BL-J9`, `BL-J13`) | Media | Crítico (workflows en vuelo) | `temporal-developer` antes de tocar, `workflow.patched`, replay con fixtures (ADR-003), `BL-B1` después del deploy. | BACKEND |
| R-6 | Conflictos en archivos compartidos entre FE1 y FE2 | Media | Medio | Leases (§4.2); `index.ts` sólo crece; merge de `main`, nunca rebase. | Planificación resuelve dudas de propiedad |
| R-7 | Fable consume tokens sin trabajo | Alta sin BL-P8 | Medio | 4 entradas + cron por hora con salida en una línea + inventario hecho + sub-agentes baratos. | Planificación |
| R-8 | La carpeta de Martín (`BL-P2`) se atrasa o trae `.otf` o credenciales | Media | Medio | Plan alternativo a 48 h (§7). Revisión de `git status` + grep de credenciales + `git ls-files '*.otf'` antes del PR. | Planificación |
| R-9 | Romper `e2e-device` (cambio de contraseña o de mail, onboarding) | Media | Alto (sin usuario canónico, no hay device) | Tests de integración con cuentas efímeras contra una GoTrue **de test**. En prod, la contraseña se cambia y se restaura con un script idempotente, y el onboarding se prueba reseteando su flag. **No se crean usuarios E2E nuevos** (regla del operador). | BACKEND |
| R-10 | El device escribe datos falsos en prod | Alta | Medio | Sólo el tenant `e2e-device`; `limpiar_residuos_test.py` al final de cada tanda; conteos con claims. | BACKEND |
| R-11 | Una sesión agota su contexto a mitad de un ítem | Media | Medio | `/checkpoint` al cerrar cada ítem; el estado vive en el buzón y en las ramas, no en la conversación. | Cada sesión |
| R-12 | El clasificador bloquea una mutación de prod como script suelto | Media | Bajo | Las mutaciones van dentro de `deploy.sh` y scripts versionados; lo que igual queda bloqueado se documenta y se pide puntual. | BACKEND |
| R-13 | El service worker del PWA sirve un bundle viejo durante la evidencia | Alta | Medio (falso rojo o falso verde) | Unregister + `caches.delete` antes de medir; se verifica el hash del bundle. | FE1/FE2 |
| R-14 | Corregir contrastes (DEC-11) se aparta del diseño de Martín | Media | Bajo | Cambio mínimo de token computado; el valor nuevo va al acta y a Martín por el operador. | FE1 |
| R-15 | `BL-X1` (capas en escritorio) se traduce distinto de lo que esperaba el operador | Media | Medio | Regla «web sigue a mobile» + decisión escrita en el PR + revisión en A2. Si A2 la objeta, fila nueva, no revert ciego. | FE2 |

---

## 13. Runbook del operador: Cierre B

Lo redacta planificación durante la Ola 4. Cada interruptor queda preparado para que sea **una acción**, no un proyecto.

### 13.1 Interruptores

| # | Interruptor | Qué deja listo el plan | Qué hacés vos |
|---|---|---|---|
| 1 | Lista de testers (`BL-O1`) | Procedimiento de alta de la allowlist + control negativo escrito | Pasás los emails; BACKEND despliega |
| 2 | OAuth (`BL-O2`) | Captura de qué pantalla de consentimiento ve el tester + pasos de «test users» vs verificación | Elegís el modo (DEC-12) |
| 3 | Distribución del APK (`BL-O3`) | APK `preview` + instructivo | Se lo pasás a un tester de afuera del equipo |
| 4 | Backups (`BL-O5`) | WAL-G + B2 ya construidos; checklist de restore con conteo con claims | Das la orden de encender |
| 5 | Legal (`BL-O6`) | Borrador que nombra a los terceros (Composio, ARCA, MercadoPago, proveedor LLM, Graphity) y dice que la clave fiscal no se guarda | Aprobás el texto |
| 6 | Soporte (`BL-O7`) | Lugar donde va el SLA en `BL-W10` | Fijás responsable y horario |
| 7 | Rotaciones (`BL-O8`) | Recordatorio: token de 60fps.design y `DATABASE_URL` de fusion; ARCA de `341lin` | Las ejecutás |
| 8 | Historia sin `.otf` (DEC-5) | §13.2 | Lo corrés vos (el force push está bloqueado para los agentes por diseño) |

### 13.2 Reescritura de la historia (DEC-5)

**Precondiciones:**
- 0 PR abiertos.
- Las 4 sesiones detenidas.
- Todas las ramas locales empujadas o descartadas.

**Pasos** (los scripts quedan en `scripts/operador/`, versionados y sin secretos):
1. Backup espejo: `git clone --mirror`, guardado **fuera** del repo.
2. En un clon fresco: `git filter-repo --path-glob '*.otf' --invert-paths`. Si decidís también sacar el token de 60fps de la historia: `--replace-text` con un archivo de patrones que **no** se commitea.
3. Verificación: `git log --all -- '*.otf'` vacío; gitleaks sobre toda la historia verde.
4. `git push --force --mirror` (lo hacés vos).
5. Borrar y volver a crear todos los worktrees locales (`wt-*`) y el checkout compartido. `memoria/`, `coordinacion/` y los `.env` locales se preservan fuera del árbol antes de hacerlo.
6. Pedido a GitHub Support para purgar las vistas cacheadas y las referencias de PR viejos.

**Lo que no resuelve:** los clones y forks que ya existen conservan los archivos. Contra un secreto, sólo la **rotación** garantiza algo. Contra la licencia de la fuente, esto es reducción del daño, no una garantía.

---

## 14. Arranque

### 14.1 Antes de lanzar las sesiones (planificación, Ola 0)

- Ola 0 completa (§8.0).
- `wt-fe1` está en `fix/recording-overlay-sin-scrim` (`e08690d4`): antes de reutilizarlo, planificación mide `git log origin/main..HEAD` y **no borra nada que no esté en `main`** (`memoria/la-alarma-de-worktree-huerfano-sugiere-borrar-lo-que-hay-que-salvar.md`). Si tiene trabajo sin mergear, se preserva la rama y FE1 arranca en un worktree nuevo.
- `wt-fe2-tokens` (`fix/quita-token-mcp-prototipo`) no se toca: su destino depende de la rotación del token (Cierre B).

### 14.2 Qué escribís en cada ventana (una sola vez)

| Ventana | Mensaje |
|---|---|
| BACKEND | `/monitoreo-backend` y después: «Ejecutá de forma autónoma tu cola de docs/copiloto-emprendedor/2026-09-21-plan-implementacion-beta-odobi-autonomo.md §8.1 y el contrato de cola en el buzón, hasta el DoD de todo. Empezá por BL-O9.» |
| FRONTEND-1 | `/monitoreo-frontend1` y después: «Ejecutá de forma autónoma tu cola de …-autonomo.md §8.2 y el contrato de cola, hasta el DoD de todo.» |
| FRONTEND-2 | `/monitoreo-frontend2` y después: «Ejecutá de forma autónoma tu cola de …-autonomo.md §8.3 y el contrato de cola, hasta el DoD de todo.» |
| AUDITORÍA | `/monitoreo-auditoria` y después: «Atendé sólo los pedido_ dirigidos a auditoría según §8.4 y §9 del plan.» |

Desde ahí, **nadie espera al operador**: la próxima vez que planificación te escriba será para algo MAYOR de §5.2, o para avisarte del Cierre A.

---

## 15. Trazabilidad: los 70 ítems del backlog

| Ítem | Sesión | Ola | Contrato | | Ítem | Sesión | Ola | Contrato |
|---|---|---|---|---|---|---|---|---|
| BL-P1 | PLAN | 0 | — (acta) | | BL-J6 | BE + FE2 | 2 | K-04 |
| BL-P2 | PLAN | 0–1 | — (Martín) | | BL-J7 | BE + FE1 + FE2 | 3 | K-10 |
| BL-P3 | PLAN | 0 | — | | BL-J8 | BE + FE1 | 3 | K-11 |
| BL-P4 | PLAN | 0 | — | | BL-J9 | BE + FE1 | 2 | K-07 |
| BL-P5 | PLAN | 1 (tras P2) | — | | BL-J10 | BE + FE2 | 2 | K-05 |
| BL-P6 | PLAN → Martín | 0 | — | | BL-J11 | BE + FE2 | 2 | K-12 |
| BL-P7 | PLAN | 0 | — | | BL-J12 | BE + FE1 | 2 | K-08 |
| BL-D1 | BE + FE1 | 1 | K-01 | | BL-J13 | BE + FE2 | 3 | K-13 |
| BL-D2 | FE1 | 1 | — | | BL-X1 | FE2 | 2 | — |
| BL-D3 | FE1 | 1 | — | | BL-X2 | FE1 | 2 | — |
| BL-C1 | FE2 | 1 | — | | BL-X3 | FE1 | 2 | — |
| BL-C2 | FE1 | 1 | — | | BL-X4 | FE1 | 2 | — |
| BL-C3 | FE1 | 1 | — | | BL-X5 | BE + FE2 | 1 | — |
| BL-C4 | FE2 | 1 | — | | BL-X6 | PLAN (árbol) + FE1 (código) | 0 / 2 | — |
| BL-C5 | FE2 (código) + BE (binario) | 1 | — | | BL-X7 | BE + FE2 | 2 | K-15 |
| BL-C6 | BE + FE2 | 1 | K-02 | | BL-X8 | BE + FE2 | 3 | K-14 |
| BL-W1 | FE1 | 1 | — | | BL-X9 | → BL-V2 | — | DEC-8 |
| BL-W2 | FE2 | 1 | — | | BL-X10 | FE1 | 3 | — |
| BL-W3 | FE1 | 1 | — | | BL-X11 | FE2 (+ FE1 isotipo en W10) | 1 | — |
| BL-W4 | FE1 | 1 | — | | BL-B1 | BE | 1 y 4 | — |
| BL-W5 | FE2 | 1 | — | | BL-B2 | BE | 1 | — |
| BL-W6 | FE1 | 1 | — | | BL-B3 | BE | 1 | — |
| BL-W7 | FE2 | 1 | — | | BL-B4 | → BL-V16 | — | DEC-1 |
| BL-W8 | FE2 | 1 | — | | BL-B5 | BE | 1 | — |
| BL-W9 | FE1 | 1 | — | | BL-O1 | Operador | Cierre B | DEC-12 |
| BL-W10 | FE1 | 1 | — | | BL-O2 | Operador | Cierre B | DEC-12 |
| BL-F1 | FE1 | 2 | — | | BL-O3 | BE (técnica) / Operador (distribución) | 4 / B | — |
| BL-F2 | FE1 | 1 | — | | BL-O4 | BE | 3 | — |
| BL-J1 | BE | 1 | K-01 | | BL-O5 | Operador | Cierre B | — |
| BL-J2 | BE + FE2 | 2 | K-03 | | BL-O6 | Operador | Cierre B | — |
| BL-J3 | BE + FE2 | 2 | K-03 | | BL-O7 | Operador | Cierre B | — |
| BL-J4 | BE + FE2 | 3 | K-09 | | BL-O8 | Operador | Cierre B | — |
| BL-J5 | BE + FE2 | 2 | K-06 | | BL-Q1 | FE1 | 3 | — |
| BL-Q2 | BE | 1, cada ola, 4 | — | | BL-Q3 | BE (device) + FE1/FE2 (PWA) + AUD | 4 | — |
| BL-Q4 | FE1 | 2 | — | | BL-Q5 | AUD | cada ola | — |

**Nuevos de este plan:** BL-O9 (BE, 1) · BL-B6 (BE, 1) · BL-B7 (BE, 1) · BL-P8 (PLAN, 0) · BL-V16 (post-beta, ex BL-B4).

**Carga por sesión** (ítems con código):

| Sesión | Ola 1 | Ola 2 | Ola 3 | Ola 4 |
|---|---|---|---|---|
| BE | 11 + tandas | 8 | 6 | 4 |
| FE1 | 12 | 8 | 4 | 1 |
| FE2 | 10 | 7 | 4 | 1 |

Los L están repartidos: BE lleva J4, J7 y J13; FE1, J7 (FE) y X10; FE2, X1, J4 (FE), J13 (FE) y X8.
