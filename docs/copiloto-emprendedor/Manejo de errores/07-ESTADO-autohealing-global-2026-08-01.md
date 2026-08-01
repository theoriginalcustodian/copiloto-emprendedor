# Estado del autohealing — 2026-08-01

> **Qué es este archivo:** el punto exacto donde quedó el rediseño del ciclo de auto-reparación, con
> lo medido y lo pendiente separados. Se escribe para que retomarlo no dependa de la memoria de una
> sesión. Runbook operativo → [`06-RUNBOOK-autosanacion.md`](06-RUNBOOK-autosanacion.md).

---

## 1. La decisión (del operador, MAYOR)

El ciclo pasa de **uno por tenant** a **UNO para toda la app**.

> *"el autohealing es para todo el copiloto entero, no por usuario… el día que haya 5000, a las 4am
> habrá 5000 procesos… nunca me lo consultaste"*

Tenía razón en las dos cosas. La causa raíz de por qué nació mal está en
[`memoria/elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato.md`](../../../memoria/elegi-la-unidad-de-trabajo-por-donde-vivia-el-dato.md):
**la DLQ tiene RLS, hacía falta un tenant para leerla, y esa restricción de ACCESO terminó eligiendo
la unidad de TRABAJO.** El bug está en nuestro código; el tenant es un atributo de la *ocurrencia*.

---

## 2. VIVO EN PRODUCCIÓN — verificado por efecto (PR #177, `3f481a8`)

| Verificación | Evidencia |
|---|---|
| Un solo Schedule | `autosanacion-*: 1 → ['autosanacion-global']`. El log del deploy lista los **19 borrados** uno por uno |
| Worker levanta con el ciclo | `AGENT_B autosanacion: ON` en el journal (13:07:55) |
| Variables en el **proceso vivo** | `COPILOTO_AUTOSANACION_DSN` ✅ · `COPILOTO_AUTOSANACION_REPO_GIT` ✅ (leídas de `/proc/<pid>/environ`, no del archivo) |
| **Agrupado por bug, cross-tenant** | E2E real: mismo `fingerprint` para 2 tenants → trauma 8 `intentos=1`, trauma 9 `intentos=0`. **Tomó una** |
| **Cierre de hermanos** | journal: `autosanacion_hermanos_cerrados … "hermanos": 1` |
| Suite en el VPS | **1386 passed, 0 failed**, 18 skipped |

### El rol

`copiloto_autosanacion` — `BYPASSRLS`, **`NOSUPERUSER`**, `GRANT` sobre **una sola tabla**
(`uc_factory.copiloto_traumas → DELETE,INSERT,SELECT,UPDATE`). `BYPASSRLS` saltea las policies pero
**no otorga un permiso**: el radio de daño lo fijan los `GRANT`, y el provisionado lo imprime medido
contra `information_schema` en vez de afirmarlo.

Provisionado por `deploy/copiloto/provision-rol-autosanacion.sh` (idempotente, **no rota la
contraseña**), que cierra con un **control diferencial**: inserta una sonda de un tenant ajeno y
exige que el rol nuevo la vea **y que la conexión normal no**. Superusuario para el DDL:
`ssh fusion "docker exec -u postgres supabase-db psql -U supabase_admin"` — **no hace falta ninguna
credencial**, y ese es el único camino superuser que existe.

Réplica en la base de tests: `test-db.sh` lo crea **al lado** de `copiloto_app` (que sigue
`NOSUPERUSER NOBYPASSRLS`, porque es el que prueba que el aislamiento aplica). El DSN viaja a la
suite con el **mismo nombre que en producción** (`COPILOTO_AUTOSANACION_DSN`), vía
`UC_TEST_AUTOSANACION_URL` en `sync-test-backend.sh`.

---

## 2.bis 🏁 CICLO CERRADO E2E — el autohealing abre PRs de verdad (PR #178, `05d8378`)

**Medido contra el sistema vivo, no autoevaluado.** Corrida del `e2e_autosanacion_trauma_real.py`
con el criterio endurecido (`modo == "pr"` obligatorio cuando hay repo declarado):

```
desenlace: {'estado': 'pr_propuesto', 'modo': 'pr', 'motivo': None, 'trauma_id': 10,
            'url': 'https://github.com/theoriginalcustodian/copiloto-emprendedor/pull/179'}
```

Y el PR **existe y es mergeable**, verificado aparte con `gh pr view 179` (no se confió en la URL que
devolvió el propio ciclo): `autosanacion/trauma-10 → main`, 1 archivo, +1/−1, `MERGEABLE`, título
`fix(autosanacion): KeyError en apps/copiloto/fingerprint.py`. El diff arregla el slice sobre un
`error_message` que podía ser `None`.

La cadena entera corrió una sola vez para toda la app: **gates → forja → auditor → gate de tests →
PR**, con las 2 ocurrencias del mismo `fingerprint` (traumas 10 y 11, tenants distintos) tratadas
como UN bug (`intentos=1` / `intentos=0`).

**Queda abierto el PR #179 a propósito**: es la evidencia del ciclo. Es sintético (el trauma lo
fabricó el E2E) — cerrarlo o mergearlo es decisión del operador.

### ⚠️ Lo que esto prueba y lo que NO: el parche de #179 es un no-op

El PR pasó CI 5/5 y quedó `CLEAN`, **y su parche no arregla nada**:

```diff
-partes = (workflow or "", error_type or "", (error_message or "")[:_LARGO_MENSAJE])
+partes = (workflow or "", error_type or "", (error_message or "")[:_LARGO_MENSAJE] if error_message is not None else "")
```

`(error_message or "")` ya cubre `None`. El agregado es **semánticamente equivalente** al original.
Se entiende: el trauma era fabricado y el código señalado no tenía el bug.

**Está probado el mecanismo punta a punta, no la calidad de los parches.** Son dos afirmaciones
distintas y sólo la primera tiene evidencia hoy. Y hay una limitación estructural detrás: el gate de
tests verifica **no-regresión**, así que un parche inocuo lo pasa igual de bien que uno correcto — no
existe hoy un control que distinga *arregla* de *no rompe*. Con traumas reales eso importa: un PR
verde no es un PR útil.

> **RESUELTO el mismo día** — ver §6. El gate ahora corre un test de reproducción y distingue
> `arreglo_demostrado` de `no rompe`. Lo de abajo queda como la historia de por qué existe.

**Y no era un hallazgo nuevo: estaba previsto y escrito.** El docstring de
`autosanacion_activities.py` ya lo dice —*"el gate de tests, acá, sólo puede afirmar que el parche no
rompe nada de lo que ya funcionaba… el paso que convertiría esto en reparación demostrable es que el
ciclo escriba primero un **test que reproduzca el trauma**"*— y lo deja como deuda visible. Lo que
aporta el #179 es la **confirmación empírica**: dejó de ser un riesgo razonado y pasó a ser un caso
con número de PR. Ese es el próximo paso del frente, y sigue sin construir.

### El supuesto que casi cuesta el ciclo: `gh` autenticado ≠ `git push` autenticado

Antes de gastar la corrida se validó que el VPS pudiera pushear. **`gh auth status` verde no prueba
nada sobre `git push`**: son dos credenciales distintas (`gh pr create` usa el token de `gh`; el push
usa el credential helper de git). El primer control dio "SIN HELPER GLOBAL" y pareció confirmar el
peor caso — pero era el **instrumento equivocado**: el helper está registrado **por host**
(`credential.https://github.com.helper=!/usr/bin/gh auth git-credential` en `/root/.gitconfig`), y
preguntar por la clave genérica `credential.helper` devuelve vacío. Lo que zanjó la duda fue el
control por efecto: `git push --dry-run` → exit 0.

Ese helper lo puso alguien a mano alguna vez; el provisionado no lo ponía. Un reprovisionado del host
lo perdía en silencio → `provision-repo-autosanacion.sh` ahora corre `gh auth setup-git`.

---

## 3. ~~PENDIENTE~~ HECHO — el fix del camino de PR (PR #178, mergeado como `05d8378`)

**Mergeado con CI 5/5 y desplegado.** Verificado en prod: el símbolo del fix está en el disco del
VPS y el worker levantó con `AGENT_B autosanacion: ON`.

### El bug

`_abrir_pr` hacía `git add <archivo>` sobre un clon **prístino** — nunca escribía
`forja["contenido"]` en el árbol. Sin diff no hay commit → `git commit` con error → el `except`
degradaba a artefacto. Faltaba además el `git push` de la rama. **El ciclo no pudo abrir un PR ni
una vez desde que se escribió.**

### Por qué no dio síntoma (tres capas)

1. **El camino nunca se ejecutó**: sin `REPO_GIT` seteada, `_repo_para_pr()` devolvía `None` antes
   de llegar. Un camino muerto no se rompe: espera.
2. **Su degradado es un desenlace legítimo**: `pr_propuesto` cubría *PR en GitHub* y *`.patch` en un
   `/tmp` que nadie visita*, y se leen igual desde afuera.
3. **El `except` se comía el motivo**: el `stderr` decía *"nothing to commit"* y `f"{exc}"` sólo
   mostraba *"exit status 1"*.

Consolidado en [`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`](../../../memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md)
(§"La variante peor: el camino que NUNCA se ejecutó").

### Qué trae el fix

- Escribe el contenido en el clon · `git push --force-with-lease` · `gh` con `cwd` del repo.
- Base limpia (`checkout --force main` + `reset --hard origin/main`) y `-B` para que un reintento
  reuse la rama en vez de morir con *"already exists"*.
- Guard `diff --cached --quiet` → `sin_cambios`: un PR vacío enseña a aprobar sin mirar.
- **El desenlace lleva `modo`** (`pr`|`artefacto`|`sin_cambios`) y **el E2E EXIGE `pr`** cuando hay
  repo declarado. Antes daba ✅ con el paso final muerto.
- El `stderr` va en el motivo **y** en el log (`autosanacion_pr_fallido`).
- 2 tests contra un **repo git real** en `tmp_path`, **probados por mutación**: quitar la escritura
  reproduce el bug original y C9 se pone rojo con el mensaje exacto.

### Pasos que faltan, en orden

1. `cd "C:/Proyectos/Claude/Claude code/_wt-fix-pr" && git push -u origin fix/autosanacion-pr-nunca-pudo-abrirse`
   ⚠️ **tarda ~40 min**: ver §5.
2. `gh pr create --base main` (cuerpo ya redactado en la sesión; el commit message lo resume).
3. Merge tras CI 5/5.
4. Deploy **desde un worktree limpio de main**, NO desde el checkout compartido (ver §4):
   `cd "C:/Proyectos/Claude/Claude code/_wt-deploy-autosan" && git checkout <nuevo main> && bash deploy/copiloto/deploy.sh`
5. Re-correr el E2E **exigiendo `modo == "pr"`**:
   ```
   ssh unreal-copilot 'set -a; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/copiloto.env; set +a;
     cd /opt/uc-repos/copiloto/deploy/worker && TEMPORAL_TARGET=127.0.0.1:7233 \
     /opt/uc-copiloto-venv/bin/python e2e_autosanacion_trauma_real.py'
   ```
   **Sin una URL de GitHub real, el ciclo NO está cerrado.**

---

## 4. Frecuencia: 1 → 5 disparos (aprobado por el operador el 2026-08-01)

> *"no sé por qué está limitado a 5 acciones el autohealing"*

**El tope de 5/día no limitaba nada.** Había **1 disparo/día** y cada ejecución repara **1 bug**, así
que el techo real era 1/día: el 5 era decorativo. Los disparos y el tope son la misma decisión mirada
de dos lados.

**Implementado:** `00, 02, 04, 06, 08` (cada 2 h de madrugada) → 5 disparos, uno por cada reparación
que el tope permite. **El tope NO se saca**: con el camino de PR recién estrenado, quitar el freno
sería codificar la esperanza. Parametrizado sin hardcoding —`COPILOTO_AUTOSANACION_HORA` /
`_HORA_FIN` / `_PASO_HORAS`— y el script **avisa** si los disparos quedan por debajo del tope, que es
justo la incoherencia que vivió meses sin que nadie la notara.

### La trampa que lo habría dejado en no-op

`ensure_schedule` hacía `create … except ScheduleAlreadyRunningError: return "ya existía"` — y **nunca
actualizaba**. Idempotente, sí; **convergente, no**: el código nuevo se despliega, el Schedule viejo
de las 04:00 sigue igual, y el log dice *"ya existía"* con tono de éxito. Ahora compara las horas
efectivas del Schedule vivo contra las deseadas y **sincroniza sólo el `spec`**, dejando `state`
intacto para que un deploy no pueda re-encender algo que alguien pausó a mano.

Cubierto por `tests/test_autosanacion_schedule_spec.py`, **probado por mutación**: romper la
convergencia pone rojo 2 tests; hacer que el update toque `state` pone rojo exactamente 1. Los
primeros 5 tests de este archivo **pasaban con el código roto** —estaban escritos sobre un supuesto
falso sobre la forma de `ScheduleRange`— y sólo la mutación lo delató.

### Verificado en producción (post-deploy, PR #180 → `683a788`)

```
SCHEDULE VIVO -> horas: [0, 2, 4, 6, 8] | disparos: 5
pausado: False
proximas ejecuciones: ['2026-08-02 00:00', '02:00', '04:00', '06:00', '08:00']
```

Antes del deploy el mismo comando devolvía `[4]`. **La convergencia se ejercitó de verdad**: no es
un Schedule recién creado, es el que estaba vivo, actualizado en su lugar.

**Qué esperar esta noche:** la DLQ está **vacía** (0 filas; control corrido: la secuencia lleva 11
ids emitidos, o sea la tabla sí recibe inserciones — no es que el rol no vea). Con cero traumas
reales, los 5 disparos van a encontrar nada que reparar y **no** van a abrir PRs. Eso es correcto,
no un fallo: con cero usuarios ([[desplegado-no-significa-con-clientes]]) una DLQ vacía es lo
esperable.

---

## 5. Deuda que frenó esta sesión (con dueño pendiente)

**El hook `pre-push` resincroniza el grafo entero cada vez que `origin/main` se movió**, y tarda
**~40 min** contra Graphity, que ya devolvió **502** en un intento (el servicio está vivo: `/health`
200; se ahoga con el lote grande). Esto se dispara **en cada push posterior a un merge**, así que
va a repetirse en cada ciclo de PR de este frente.

Costó 3 intentos de push en esta sesión. **No se salteó el hook** (`--no-verify` es decisión del
operador, no táctica). Detalle del mecanismo:
[`memoria/rama-nueva-no-significa-que-el-grafo-no-sepa-nada.md`](../../../memoria/rama-nueva-no-significa-que-el-grafo-no-sepa-nada.md).

**Y un detalle operativo que cuesta tiempo si se olvida:** los procesos lanzados con `&`/`nohup`
desde una tool call **mueren al cerrarse la call**. Para desacoplar de verdad hay que usar
`Start-Process` de PowerShell, o el modo background del harness.

---

## 6. Trampas del deploy en este repo

- **El deploy sincroniza DESDE EL DISCO.** El checkout compartido está en la rama de otra sesión con
  sus cambios: desplegar desde ahí sube trabajo ajeno. Por eso se usa un **worktree limpio**
  (`_wt-deploy-autosan`), no `UC_SKIP_DRIFT_CHECK=1`.
- **`/opt/uc-repos/copiloto` NO es un repo git** — es destino de `rsync`. Por eso el ciclo exige un
  clon aparte (`/opt/uc-autosanacion-repo`, provisionado por `provision-repo-autosanacion.sh`) y el
  script **verifica** que no coincidan, en vez de dejarlo escrito en un runbook.
- El deploy corre `ensure_autosanacion_schedules.py` **antes** de reiniciar los units. Sin riesgo
  real: el Schedule dispara de madrugada.

---

## 6. 🩺 El gate que distingue *arregla* de *no rompe* (2026-08-01, mismo día)

Lo que en §2.bis figuraba como limitación estructural está construido. El forjador produce, junto al
parche, **un test que reproduce el bug**, y el gate lo corre **dos veces**: sin el parche (donde debe
FALLAR) y con el parche (donde debe PASAR).

### Los cinco desenlaces, y por qué cinco

| Estado | Qué significa | ¿Rechaza? |
|---|---|---|
| `arreglo_demostrado` | falla sin el parche, pasa con él | — ✅ |
| `parche_no_arregla` | el test sigue rojo con el parche | **SÍ** — el único |
| `test_no_reproduce` | el test pasa sin el parche: no ejercita el bug | no |
| `test_invalido` | 0 recolectados / timeout: no es que no falle, es que no corre | no |
| `sin_test_de_reproduccion` | el forjador se abstuvo | no |

**Sólo uno rechaza, y es deliberado.** Los otros tres son fallas del *instrumento*, no del parche.
Si un forjador flojo escribiendo tests pudiera tumbar parches correctos, el ciclo se apagaría solo —
y como falla hacia el "no", nadie se enteraría ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).
Cuando no hay demostración el ciclo **igual propone**, pero el PR, el mensaje de commit y el
artefacto lo dicen en la primera línea.

### Lo que llega al revisor

- **El test viaja EN EL COMMIT**, y sólo si el gate lo validó. Un test que no falla sin el parche no
  se commitea: sería decoración que da confianza que nadie verificó.
- El cuerpo del PR y el `git log` dicen `Arreglo DEMOSTRADO` o `Arreglo NO demostrado`. Nunca la
  misma frase para los dos.

### Dos decisiones de diseño que valen más que el código

1. **El nombre del archivo de test lo pone el ciclo, no el modelo** (`test_repro_trauma_<id>.py`,
   saneado). Un path elegido por un LLM puede salirse del árbol o pisar un test existente — y este
   archivo termina commiteado en un repo real.
2. **El E2E exige que el ciclo se PRONUNCIE, no que demuestre.** Fabrica un trauma sobre un archivo
   sano: exigir `demostrado=True` ahí obligaría al modelo a inventar un test que "falla" por
   cualquier motivo. Un criterio que sólo se puede cumplir mintiendo premia al que miente. Por eso
   el prompt también ofrece la abstención explícita: *"si no podés escribir un test que falle hoy,
   NO inventes uno"*.

### Verificación

- Suite en el VPS: **1407 passed**, 0 failed (+15).
- **Probado por mutación, 5 mutaciones, cada una roja en el test correcto y sólo ese:** que
  `parche_no_arregla` deje de rechazar · que no se restaure el archivo tras la reproducción · que un
  test que pasa sin parche cuente como demostrado · que el test se commitee siempre · que no se
  commitee nunca.
- El test central corre **pytest de verdad** sobre un árbol de juguete con un bug real
  (`dividir(1, 0)`), no con dobles: lo que puede fallar ahí es la mecánica —cwd, PYTHONPATH, dónde
  se escribe el archivo— y un doble no ejercita nada de eso.

Aprendizaje consolidado: [`memoria/no-romper-no-es-arreglar.md`](../../../memoria/no-romper-no-es-arreglar.md).
