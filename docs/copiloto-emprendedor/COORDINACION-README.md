# Cómo se opera este repo con varias sesiones en paralelo

> **Para quién:** cualquier persona o agente que vaya a trabajar sobre `copiloto-emprendedor` y
> tenga que convivir con las otras sesiones. Si es tu primera vez acá, **este es el documento de
> entrada**; leelo completo antes de tocar un archivo.

## 0. Precedencia — leé esto o vas a confundir el manual con la ley

| Artefacto | Qué es | Dónde |
|---|---|---|
| `coordinacion/COORDINACION.md` | **La NORMA canónica.** 94 KB, ~1.370 líneas, 60+ secciones. Gana siempre. | **no versionado** |
| **este README** | **Manual de operación.** Explica el sistema y te deja operar sin leer los 94 KB. | versionado |
| `CLAUDE.md` (raíz) | Constitución técnica del proyecto (reglas de producto, deploy, seguridad). | versionado |

**Si este README y `COORDINACION.md` discrepan, gana `COORDINACION.md` y el README es el que está
mal** — reportalo como hallazgo. La regla existe porque entre dos artefactos con distinta precisión
gana el que circula, y el que circula es el corto: sin esta línea, el resumen se vuelve la ley de
hecho.

⚠️ **`coordinacion/` NO está en el repo** (`.gitignore`). Es una carpeta física única apuntada por
ruta absoluta. **No la versiones:** `git worktree add` la duplicaría por worktree (hay decenas
activos) y el mensaje de una sesión dejaría de existir para la otra. Por eso este README vive en
`docs/`, que sí se clona.

---

## 1. El modelo, en diez líneas

- Hay **varias sesiones de Claude Code trabajando a la vez** sobre el mismo repo, cada una con un
  **rol** fijo y su propio **git worktree**.
- Comparten **un solo checkout** (`copiloto-emprendedor/`) y **un solo buzón de archivos**
  (`coordinacion/`).
- La comunicación es **archivos `.md` con nombre convencionado**, no un chat ni un tablero.
- **El estado de un trabajo ES la ubicación de su archivo:** `abierto/` → `en-curso/` →
  `cerrado/<fecha>/`. Quien lo toma lo mueve; quien lo termina, también.
- Un tablero que hay que acordarse de actualizar **se desincroniza y miente**. Un `mv` no puede.
- Lo mecánico (archivar, limpiar, marcar estado) **lo hacen scripts**, no la disciplina de nadie.
- Nadie edita el worktree ni la carpeta de otra sesión: **se pide**.

---

## 2. Los roles

Cada sesión arranca invocando **la skill de su rol** (`/monitoreo…`). Son distintas; usar la de otro
rol instala los crones equivocados.

| Rol | Skill de arranque | Posee | NO toca |
|---|---|---|---|
| **planificación** | `/monitoreo` | La junta backend↔frontend: emite `contrato_`, arbitra, mide, marca el registro del sprint | No implementa código de producto |
| **backend** | `/monitoreo-backend` | `apps/copiloto/**`, `motor/**`, workflows/activities Temporal, deploy, DB | UI |
| **frontend-1** | `/monitoreo-frontend1` | `apps/mobile/**` · **dueña única del device físico** | Backend |
| **frontend-2** | `/monitoreo-frontend2` | `apps/mobile/**` (hitos disjuntos de fe1) | El device, salvo handoff explícito |
| **auditoría** | `/monitoreo-auditoria` | `docs/copiloto-emprendedor/Auditorias/**`, re-verificaciones | Implementar los fixes que audita |
| **manejo de errores** | `/monitoreo-manejo-errores` | Clases de error, DLQ, recuperadores | — |

> ⚠️ **Drift conocido:** `COORDINACION.md:1` todavía dice «3 sesiones paralelas». Las skills de rol
> instaladas son **6**. La cifra del encabezado está vieja; la tabla de acá es lo medido
> (2026-11-09). No está arreglado en la norma: es un hallazgo abierto.

---

## 3. Arranque de sesión — cinco pasos, en este orden

```bash
# 1. ORDEN DE TRABAJO. Sin esto no se trabaja.
bash scripts/goal.sh set <ID>      # el id tiene que existir en el padrón, o el comando RECHAZA

# 2. La skill de TU rol (ver tabla §2) — instala los crones del heartbeat
/monitoreo            # ← la que corresponda a tu rol

# 3. CONFIRMAR los crones. Sin verlos, no están.
CronList

# 4. Tu buzón
bash scripts/vigia.sh mi-buzon.sh <tu-rol> --todo

# 5. Decir en una línea qué vas a hacer primero, y arrancar.
```

**Por qué el paso 3 no es ritual.** Una sesión de Claude Code **termina su turno y queda idle para
siempre**: no tiene bucle propio. Sin crones trabajás bien y después te apagás hasta que alguien te
escriba. El 2026-11-03 eso dejó **4 sesiones paradas entre 7 y 22 horas con 38 fichas pendientes**.
No faltó contrato: faltó algo que las volviera a invocar. Los crones **mueren con la sesión**,
sobreviven a `--continue`/`--resume` **pero no a una sesión nueva**, y auto-expiran a los 7 días.

**Por qué el paso 1 es primero.** `goal.sh` guarda el DoD **tal como está en el doc** y rechaza un id
inventado: un goal que el agente se inventa no es una orden. Desde ahí, el gate de atribución marca
`FUERA-GOAL` cualquier commit que cite otro id. El forense del 2026-10-08 midió el costo de no
tenerlo: **64 PRs en un día, 4 del backlog firmado**, con los crones prendidos — el problema no era
falta de recordatorio sino falta de **un sujeto único** contra el que comparar.

---

## 4. El buzón

### 4.1 Ciclo de vida — el estado es la ubicación

```
coordinacion/
├── abierto/            trabajo disponible, nadie lo tomó
├── en-curso/           tomado (quien lo toma, lo mueve acá)
├── cerrado/<fecha>/    terminado o archivado por TTL
├── Contexto/           handoffs y contexto de sesión (no son mensajes)
├── evidencia/          capturas, outputs y pruebas citadas por los cierres
├── entregas/           artefactos entregados
├── Antigravity/        canal auxiliar BAJO DEMANDA (no es una sesión más)
├── Supabase fusion Rag/  canal cross-repo con el proyecto fusion
├── COORDINACION.md     la norma
├── PLAN.md             la cola viva (es una VISTA, no el registro de verdad)
└── CRONES.md           los prompts de los crones
```

### 4.2 Nombre del archivo

```
<fecha>_<tipo>_<de-quién>-a-<a-quién>_<asunto-en-kebab>.md
2026-11-09_contrato_planificacion-a-backend_endpoint-de-presupuestos.md
```

- **El destinatario puede ser compuesto** (`-a-planificacion-y-backend_`). Por eso **no escribas el
  filtro a mano**: un `find '*planificacion_*'` parece correcto y dejaba **7 de 12 invisibles**
  (medido 2026-10-12) porque exige `planificacion` pegada al `_`. Usá `mi-buzon.sh`, que delega en la
  misma definición que el gate de vigilancia.
- **El nombre puede mentir sobre a quién le toca responder.** Un archivo dirigido a otro puede
  interrogarte a vos en una sección del final. El cuerpo manda, no el nombre.
- Hay **tope de largo** del nombre, medido y no estético (ver `COORDINACION.md`, última sección).

### 4.3 Archivado: lo hace un janitor, no vos

```bash
bash scripts/vigia.sh archivar-buzon.sh
```

Es determinista e idempotente: las obligaciones (`contrato_`, `pedido_`, `urgente_`) **nunca** se
tocan — son el ancla; el resto con `mtime` > TTL va a `cerrado/<fecha>/`.

**No archives a mano.** Ordenar a mano fue la regla escrita el 2026-07-22 y **empeoró**: `abierto/`
pasó de **32 a 136** archivos. El `mv` cae en el hueco entre tareas y los broadcasts `-a-todos_`
nunca tienen un acuse que los cierre.

---

## 5. Los tipos de mensaje — y cuál se persigue

Hay **22 prefijos en uso real** (medidos el 2026-11-09 sobre 3.873 archivos). Lo que importa no es
la lista: es que **el tipo decide si alguien persigue el mensaje**.

| Tipo | Vol. | Qué es | ¿Alguien lo persigue? |
|---|---|---|---|
| `contrato_` | 360 | Obligación con DoD binario por lado. Lo emite planificación. | **SÍ** — es ancla, el janitor no lo archiva |
| `pedido_` | 305 | Pedís algo que te bloquea | **SÍ** — el escalador lo reclama por antigüedad |
| `urgente_` | 245 | Interrumpe la cola | **SÍ** — ancla |
| `avance_` | 967 | Reporte de progreso. **Su `mtime` ES la medición de silencio.** | No, y no hace falta |
| `dato_` | 803 | Información para quien la necesite | **NO escala.** Si querés reclamo, es `pedido_` |
| `cierre_` | 679 | El trabajo terminó, con evidencia | Lo valida planificación |
| `hallazgo_` | 161 | Algo que encontraste y no es tu tarea | No |
| `respuesta_` / `decision_` / `addendum_` / `regla_` / `correccion_` / `listo_` / … | resto | variantes | según el caso |

**El error más repetido:** mandar un `dato_` esperando que alguien actúe. Nadie lo persigue — el
escalador no lo mira. Si necesitás una acción, el tipo es `pedido_`.

> ⚠️ **27 archivos del buzón no tienen prefijo de tipo** (medido 2026-11-09): son invisibles para
> cualquier filtro que clasifique por tipo. Hallazgo abierto.

### 5.bis No escribas una línea de acuse sobre un `avance_`

Su `mtime` es el instrumento. Un acuse encima lo renueva y **borra la medición de silencio**.

---

## 6. La junta backend↔frontend tiene dueña: planificación

Todo trabajo que toque **las dos capas** baja como `contrato_` —endpoint, request, response, códigos
de error, DoD binario por lado— **antes** de que ninguna implemente.

**Si para avanzar tenés que inventar la forma de un endpoint, eso es codificar la esperanza:** emitís
`pedido_` y marcás `[ASSUMED_PENDING_VERIFY]`.

Existe porque los cuatro incidentes del 2026-07-21 fueron **la misma falla**: cada lado verificó su
mitad y **la costura no era de nadie**.

Y todo `contrato_` abre con el **inventario de lo que ya existe** (`path:línea`) y qué extender. «No
existe» vale sólo si buscaste y escribiste dónde.

---

## 7. Git con checkout compartido — la regla que más daño hace si se ignora

**Hay trabajo sin commitear de otras sesiones en el mismo working tree.** Todo lo que opere sobre
«todos los cambios» o reescriba el índice se lleva puesto el trabajo ajeno.

```bash
git add ruta/explicita/al/archivo.ts      # ✅ así, siempre
```

**PROHIBIDO, sin excepción por urgencia:**

| Comando | Qué rompe |
|---|---|
| `git add -A` / `.` | Commitea lo de otras sesiones, y en repo PÚBLICO publica secretos sueltos |
| `git commit --amend` | Pisa el commit de otro |
| `git rebase` / `reset` | Reescribe historia compartida |
| `git checkout <ref> -- .` | **Pisa lo que sólo existe en el working tree** |
| `git pull` / `stash` / `clean` | Mueven o borran trabajo ajeno |

**Trabajo nuevo ⇒ worktree propio.** Rama por hito es incumplible sin él:

```bash
git fetch origin main
git worktree add /c/gfw-src/wt-<rol>-<hito> -b <rol>/<hito> origin/main
```

**Dos filos medidos:**
- **`??` ≠ nuevo.** El checkout compartido está mezclado en los **dos** sentidos: hay archivos
  **atrasados** (commitearlos revierte fixes) y trabajo real sin respaldo. Medí el **signo** contra
  `main`, por archivo, antes de commitear.
- **El VPS y el dev-server no corren la rama que ves.** Metro y Vite sirven el **checkout
  compartido**, no tu worktree. Si vas a medir algo servido, pedile al server que se identifique.

---

## 8. Estado compartido: una sola sesión es dueña

**Los worktrees aíslan el código. NO aíslan la DB, los servicios vivos, el device ni el buzón.**

| Recurso | Quién puede tocarlo |
|---|---|
| Migraciones y DB | **sólo la sesión dueña** |
| Servicios vivos / deploy | **sólo la sesión dueña** |
| Numeración global (ADRs) | **sólo la sesión dueña** |
| Device físico | **frontend-1**, dueña única |
| Memoria del proyecto | excepción acordada: ver `COORDINACION.md §2.1` |

Una sesión no-dueña que necesite tocar estado compartido **escala**; nunca asume exclusividad.

**Dos ADB fabrican evidencia falsa**, y el device además **escribe en la base**: por eso tiene dueño
único y los gestos se corren con **receta escrita**, no con una ventana viva.

---

## 9. «Terminado» tiene una sola definición

### 9.1 El registro único

**El registro de verdad es el backlog del sprint**, con su tabla-índice generada por
`scripts/sprint-estado.py`. `PLAN.md` y los issues de GitHub son **vistas**: no se citan como estado.
Si las tres discrepan, manda el backlog.

### 9.2 Los cuatro estados

| Estado | Significa | Qué EXIGE |
|---|---|---|
| `PENDIENTE` | nadie la tomó | — |
| `EN-CURSO` | tomada | `Dueno-activo:` |
| `DOD-PARCIAL` | código en main, DoD incompleto | `Falta:` nombrando qué falta |
| `TERMINADO` | **DoD completo, punto por punto** | `Cierre:` con ≥1 sha **ancestro de `origin/main`** + evidencia de cada punto |

**El criterio de `TERMINADO` es el DoD COMPLETO, no el merge commit** — el merge es *una* de las
evidencias. Un `DOD-PARCIAL` sin `Falta:` es un `TERMINADO` disfrazado, y el gate lo rechaza.

### 9.3 El estado lo escribe el script

```bash
python -I -X utf8 scripts/sprint-estado.py --marcar SM-B3 --estado TERMINADO --cierre "…"
```

Rechaza el marcado que no cumple su regla y **no escribe** en ese caso. **Nadie edita la tabla-índice
a mano**: es generada, y `scripts/ci/lint.sh` la regenera y compara.

**Por qué el script y no cada sesión:** con el checkout compartido y decenas de worktrees, tres
sesiones editando la misma tabla es edit-race garantizada. Lo que una sesión aporta es **evidencia**;
derivar el estado es mecánico, y lo mecánico no se delega a la disciplina.

### 9.4 El id tiene que CIRCULAR

Los ids son `SM-<letra><nº>` (`SM-B3`), nunca `B-3` (`A-1` como token da 14 falsos positivos de
grep). **El commit o el PR cita el id en el cuerpo.**

Medido el 2026-10-14 sobre 460 `cierre_`: **18 de 26 fichas nunca fueron nombradas por ninguna
sesión**. No era descuido al marcar — era que el id **no circulaba**: cada sesión citaba ids propios,
la casilla del backlog nunca entraba al circuito de cierre, y el mismo sprint se leía con tres
porcentajes incompatibles.

### 9.bis 🔴 CIERRE DE TAREA: housekeeping obligatorio

**Una tarea no está terminada cuando se mergea. Está terminada cuando además no dejó basura ni
documentos que mientan.** Son dos listas, las dos binarias.

#### A. Lo que se BORRA al mergear

- [ ] **el worktree** — `git worktree remove <ruta>`
- [ ] **la rama local** — `git branch -D <rama>`
- [ ] **la rama remota** — `git push origin --delete <rama>`
- [ ] **el `.goal`** — `bash scripts/goal.sh clear` (se va con el worktree)
- [ ] **los temporales del trabajo** — scripts de scratch, `.bak`, capturas, outputs, logs. Nada de
      eso sobrevive al merge commit.

```bash
bash scripts/housekeeping.sh              # reporta, no borra
bash scripts/housekeeping.sh --aplicar    # borra lo que YA es ancestro de origin/main
```

#### B. Lo que se ASIENTA al terminar

- [ ] **mover los archivos del buzón:** `en-curso/` → `cerrado/<fecha>/`
- [ ] **emitir el `cierre_`** con los tres campos fijos: `FICHA: SM-XX` · `SHA: <merge commit>` ·
      `DOD:` una línea por punto con su evidencia. Sin los tres, no acredita nada.
- [ ] **marcar la ficha** con `sprint-estado.py --marcar`
- [ ] **propagar al doc maestro** del sprint
- [ ] **ningún documento queda diciendo `EN-CURSO` sobre algo ya hecho**

**Por qué la lista B importa más que la A.** La basura ensucia; **un documento desactualizado hace
que el sistema RETOME trabajo ya terminado**. Una receta con premisa vencida produce un falso verde:
el defecto pasa a ser lo esperado, y nadie revisa un verde.

#### Por qué esto es un script y no una regla

La regla ya existía en `COORDINACION.md` y **no se cumplió**. Medido el **2026-11-09**, con la regla
vigente: **35 worktrees vivos · 1.220 ramas locales · 77 `.bak` en `coordinacion/` (28 MB)**. Es el
mismo patrón del buzón (32 → 136 hasta que lo tomó un janitor): **el `rm` cae en el hueco entre
tareas y nadie lo reclama.** Lo mecánico no se delega a que alguien se acuerde.

El gate (`scripts/ci/housekeeping-check.sh`, en `pre-push`) está **calibrado**: bloquea sólo el caso
sin falso positivo posible —estás sentado en un worktree cuyo trabajo ya entró— y **avisa** sobre el
pasivo heredado. Un guard que grita en el caso normal se desarma solo, y con 35 worktrees vivos un
bloqueo general se saltearía con `--no-verify` el primer día. Sube a bloqueo con
`UC_HOUSEKEEPING_BLOQUEA=1` cuando el pasivo esté saldado.

---

## 10. Los instrumentos

🔧 **Corré los instrumentos con `vigia.sh`, nunca por path relativo.** El path relativo resuelve
contra tu **cwd**, que es el checkout compartido, cuyo HEAD está viejo — y esa versión **miente**:
reportó 15 ids con «estado no reconocido» y `999999min` de antigüedad en 4 escaladores (medido
2026-10-08). `vigia.sh` corre el instrumento desde un **pin de `origin/main`** y, si no puede
refrescarlo, **grita en stderr** en vez de caer callado al árbol viejo.

| Instrumento | Qué mide / hace | Cómo se corre |
|---|---|---|
| `vigilancia-check.sh` | **El gate de los crones.** Compone cola + escaladores + mtime de transcripts. `rc=0` sin novedades, `rc=1` alarma y su stdout **es** el reporte | `bash scripts/vigia.sh vigilancia-check.sh --quiet` |
| `mi-buzon.sh` | Lo que te interpela en `abierto/`+`en-curso/`+`cerrado/<hoy>/`, descartando lo que vos emitiste | `bash scripts/vigia.sh mi-buzon.sh <rol> --todo` |
| `archivar-buzon.sh` | El janitor del buzón (idempotente) | `bash scripts/vigia.sh archivar-buzon.sh` |
| `sprint-estado.py` | Marca y valida el registro del sprint; genera la tabla-índice | `python -I -X utf8 scripts/sprint-estado.py --check` |
| `goal.sh` | Fija/lee/limpia la orden de trabajo activa | `bash scripts/goal.sh set <ID>` |
| `goal-barrido.sh` | Quién declaró qué orden, en todos los worktrees | `bash scripts/goal-barrido.sh` |
| **`housekeeping.sh`** | **Barre lo que sobra de trabajo ya mergeado** | `bash scripts/housekeeping.sh [--aplicar]` |
| **`ci/housekeeping-check.sh`** | **Mide la basura. En `pre-push`; en CI se autodeclara no-aplicable** | automático |
| `gate.sh` | **El gate real** (ADR-001). Corre los 5 jobs y escribe `.ci-recibos/<sha>.json` | `bash scripts/gate.sh` |
| `ci-verde.sh` | ¿El PR está verde? Antes de mergear | `bash scripts/ci-verde.sh <PR#>` |
| `seed-memory.sh` | Sincroniza `memoria/` del repo con el slug del harness. **Bidireccional** (`rsync -a --update`): correrlo es seguro; **no** correrlo es lo que las diverge | `bash scripts/seed-memory.sh` |
| `ultimas-acciones.sh` | Producción real por sesión (último `Write`/`Edit`) | `bash scripts/ultimas-acciones.sh` |

**VIDA ≠ PRODUCCIÓN.** El `mtime` del transcript lo renueva **también el cron**: medido el
2026-07-24, la sesión **ociosa** tuvo **42** disparos y la que implementaba **5**. Transcript fresco +
producción vieja = `🌀 GIRA EN VACÍO` (ocio), no dead-man.

---

## 11. Los errores que este equipo ya pagó

No son anécdotas: son la causa de que cada regla de arriba sea como es.

| Fecha | Qué pasó | Qué dejó como regla |
|---|---|---|
| 2026-07-21 | 4 incidentes, la misma falla: cada lado verificó su mitad y **la costura no era de nadie** | §6 — la junta tiene dueña y baja como `contrato_` |
| 2026-07-22 | Archivar «con disciplina»: `abierto/` pasó de **32 a 136** | §4.3 — el janitor, nunca a mano |
| 2026-07-24 | «Backend muerto 8½ h» … mientras escribía código | §10 — VIDA ≠ PRODUCCIÓN |
| 2026-10-08 | Instrumento corrido del working tree viejo: 15 ids mal, `999999min` | §10 — siempre por `vigia.sh` |
| 2026-10-08 | **64 PRs en un día, 4 del backlog firmado**, con los crones prendidos | §3 — `/goal` como sujeto único |
| 2026-10-12 | `find '*planificacion_*'` dejaba **7 de 12** mensajes invisibles | §4.2 — no escribas el filtro a mano |
| 2026-10-14 | **18 de 26 fichas** nunca nombradas en 460 cierres: el id no circulaba | §9.4 — el id va en el commit/PR |
| 2026-11-03 | **4 sesiones paradas 7–22 h** con 38 fichas pendientes, por falta de crones | §3 — `CronList` y confirmarlos |
| 2026-11-09 | **35 worktrees · 1.220 ramas · 77 `.bak` (28 MB)** con la regla ya escrita | §9.bis — housekeeping con script y gate |

---

## 12. Lo mínimo que tenés que recordar

1. **`/goal <ID>` o no trabajás.** Y confirmá los crones con `CronList`.
2. **`git add` con rutas explícitas.** Nunca `-A`, `--amend`, `rebase`, `reset`, `checkout`, `pull`,
   `stash`, `clean`.
3. **Worktree propio** por hito, y **se borra al mergear**.
4. **El repo es PÚBLICO.** Antes de commitear algo con forma de credencial, asumí que lo estás
   publicando.
5. **Mové el archivo del buzón** cuando tomás y cuando terminás. El estado es la ubicación.
6. **`dato_` no se persigue.** Si necesitás acción, es `pedido_`.
7. **«Terminado» = DoD completo con evidencia**, marcado por `sprint-estado.py`. Tu autoevaluación no
   cuenta.
8. **Al cerrar: borrá la basura y actualizá los documentos.** Un doc que dice `EN-CURSO` sobre algo
   hecho hace que el sistema lo retome.
