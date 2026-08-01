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

## 3. PENDIENTE — el fix del camino de PR (rama `fix/autosanacion-pr-nunca-pudo-abrirse`, `5d0d781`)

**Estado: commiteado y verde, NO pusheado, NO mergeado, NO desplegado.**
Worktree: `C:/Proyectos/Claude/Claude code/_wt-fix-pr`.

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

## 4. Cambio pedido por el operador y NO implementado todavía

> *"no sé por qué está limitado a 5 acciones el autohealing"*

**El tope de 5/día es arbitrario** (lo puse yo, sin medir; el comentario dice *"acota el daño de un
ciclo que se vuelve loco"*) **y hoy no limita nada**: hay **1 disparo/día** y cada disparo repara
**1 bug**, así que el máximo real es 1/día. El 5 es decorativo.

**Acordado en la sesión, pendiente de implementar en el mismo deploy del fix:** subir la frecuencia
a **cada 2 h entre 00:00 y 08:00** (5 disparos) para que el tope pase a morder y la DLQ se drene en
una noche. **NO se saca el tope** — con el camino de PR recién arreglado y cero traumas reales, sacar
el freno sería codificar la esperanza. `COPILOTO_AUTOSANACION_HORA` ya existe; hay que agregarle el
intervalo en `deploy/worker/ensure_autosanacion_schedules.py`.

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
