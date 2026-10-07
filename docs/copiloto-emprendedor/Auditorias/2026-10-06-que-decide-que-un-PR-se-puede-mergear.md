# ¿Qué decide que un PR se puede mergear? — y el guard que no está en ningún script

**Auditoría · 2026-10-06** · tercera pasada de la misma lente, sobre `scripts/ci-verde.sh` +
`scripts/recibo-cubre.sh` · **SHA medido: `origin/main` = `97dcb35a`**, worktree `wt-aud-criterio3`.

---

## 0 — Veredicto: los dos scripts resisten. El agujero está **afuera** de ellos.

Fui a buscar un fail-open en la cadena que autoriza los merges y encontré **lo contrario**: los dos
scripts son los más defendidos del repo —`ci-verde.sh` lleva seis incidentes con fecha y número de PR
escritos en sus comentarios— y **tres de mis cuatro candidatos se cayeron al medirlos.**

Lo que sí encontré no es un bug de código: **la regla más citada del proyecto —«prohibido push directo a
`main`»— no tiene ningún mecanismo que la haga cumplir**, ni en el servidor ni en el cliente. Y el día
que se mecanice, **el gate empieza a decir VERDE sobre PRs que GitHub bloquea.** Los dos hechos son uno:
el riesgo vive en el cruce.

| hipótesis | resultado |
|---|---|
| el rollup trae checks de un **commit viejo** y el gate los acepta | ❌ **REFUTADA** (4 PRs medidos, uno con 9 commits) |
| un recibo **sin `.detalle`** cubre sin el aviso | ❌ **REFUTADA** (el aviso aparece) |
| `pr list` y `pr view` **discrepan** en `mergeable` | ❌ **REFUTADA** (el `UNKNOWN` era de PRs ya mergeados) |
| `ci-verde.sh` acepta **cualquier** `mergeStateStatus` | ✅ confirmada · **inofensiva hoy, se activa con la protección** |
| lista de jobs vacía ⇒ **VERDE con 0 medidos** | ✅ confirmada · no alcanzable (nadie pasa `$2`) |
| **la regla «sin push directo a `main`» no tiene guard** | ✅ **confirmada · es el hallazgo** |

## 1 — Los tres refutados, porque evitar un falso positivo también es resultado

**«El rollup acumula los check-runs de todos los runs del PR»** — eso dice el comentario de
`ci-verde.sh:102-104`, medido el 2026-10-05 sobre el PR #778 (12 entradas para 6 jobs). Si fuera así
**permanentemente**, el `max_by(.startedAt)` tomaría el run más reciente **que exista**, no el del HEAD, y
un push cuyo CI no se encoló dejaría pasar el verde del push anterior. Es el agujero más grave que podía
tener este gate, y `statusCheckRollup` **no trae ningún campo con el sha** (medido: los 8 campos son
`__typename, completedAt, conclusion, detailsUrl, name, startedAt, status, workflowName`), así que el
script **no podría** filtrar por commit aunque quisiera.

**Lo medí resolviendo el `head_sha` de cada run citado por el rollup:**

| PR | commits | entradas | runs citados | `head_sha` del run vs `headRefOid` |
|---|---|---|---|---|
| #778 | — | 6 | 1 | `199122c6` **== HEAD** |
| #838 | **9** | 6 | 1 | `7779e008` **== HEAD** |
| #846 | 2 | 6 | 1 | `d5b65615` **== HEAD** |
| #845 | 1 (**2 runs del mismo sha**) | 6 | 1 | `efcf57ce` **== HEAD** |

⇒ **el rollup viene anclado al HEAD commit.** Un PR de 9 commits devuelve 6 entradas de un solo run, y el
de mi rama —que tiene **dos** runs completados del mismo sha (`pull_request` + `workflow_dispatch`)—
también devuelve 6. **El gate no necesita comparar `headRefOid`: la API ya le entrega el rollup del HEAD**,
y si el HEAD no tiene runs el rollup viene vacío ⇒ `exit 2` *«ROJO — SIN MEDIR»*. Fail-closed.

> **Lo que se retira es la CAUSA, no la observación** —
> `memoria/una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira.md`. Las 12 entradas se
> midieron, y el `group_by/max_by` **sigue siendo correcto y necesario**. Lo que no se sostiene es la
> explicación escrita: el duplicado no es «todos los runs del PR» acumulados para siempre, sino
> **transitorio** — mientras hay más de un run del HEAD en vuelo, el job aparece una vez por run. La
> diferencia es operativa: la redacción actual sugiere que el duplicado es permanente, y quien la lea
> para decidir si el filtro sigue haciendo falta puede concluir mal. Fila `CIVERDECOMENTARIO`.

**El recibo sin `.detalle`.** El barrido marcó que `recibo-cubre.sh:70` lleva `2>/dev/null`, así que un
recibo sin el bloque `.detalle` dejaría `suc` vacío —ni `"true"` ni `"sin-dato"`— y **cubriría sin el
aviso ⚠️**, que es justo el mecanismo que avisa de recibos viejos. Lo probé con recibos fabricados:
`sin-detalle` y `detalle-null` **sí imprimen el aviso**. El barrido lo había marcado como «lectura del
código, no ejecutado» — y por eso se podía refutar en treinta segundos.

**`pr list` vs `pr view`.** Medí los 12 PRs más recientes y **todos** dieron `UNKNOWN/UNKNOWN`, lo que
parecía decir que el valor del que depende el gate no se puede leer. **Lo malinterpreté yo:** 11 de esos
12 estaban **MERGED**, y un PR mergeado no tiene merge que calcular. El único abierto (#845) da
`MERGEABLE/CLEAN` por los **dos** caminos. Mi propio instrumento acusó al gate por una pregunta mal hecha
(`memoria/el-instrumento-tambien-CONDENA-no-solo-absuelve.md`).

## 2 🔴 El hallazgo: la regla más citada del proyecto no tiene guard

`CLAUDE.md:65` dice **«PR + rama — sin push directo a `main`»**; `docs/.../2026-07-20-DoD-sprint-autonomo-e2e.md:46`
la repite; el `CLAUDE.md` global la pone como no negociable y exige *«gobernanza el Día 0 (G-2), no como
afterthought»*. **Medido hoy, nada la hace cumplir:**

```
servidor:  GET /repos/.../branches/main/protection  -> 404 "Branch not protected"
           GET /repos/.../rulesets                  -> NINGUNO
           (control positivo del token: visibility=public default_branch=main allow_squash=true)

cliente:   core.hooksPath = .githooks   -> UN hook: pre-push (139 lineas)
           'refs/heads'     -> 0 hits      <- no mira el ref de DESTINO
           'protegida|protected|prohibido' -> 0 hits
           CONTROL POSITIVO en el mismo archivo: 'exit 1' -> 3 · 'origin/main' -> 7 · 'graph-sync' -> 7
```

El `pre-push` **sí** consume el stdin de git (`REFS_STDIN`, `:9`), pero sólo para pasárselo al
`secretos-check`; nunca compara el ref de destino contra `refs/heads/main`.

**Y acá está el filo, que no es el 404:** el repo **mecanizó con fail-closed el riesgo que temía** —un
secreto en un repo público (`pre-push:13-16`, *«hallazgo o escáner roto ⇒ el push aborta»*)— y dejó **sin
mecanizar el que da por disciplinado.** Es `memoria/disenar-contra-el-riesgo-temido-ciega-al-caso-normal.md`
aplicado a la gobernanza: el guard existe donde se tuvo miedo, no donde se confió.

**Por qué nadie lo notó: porque la regla se cumple.** Control de efecto sobre `origin/main`, últimos 7
días: **140 commits, 104 con `(#NNN)` de squash-merge y el resto merge-commits de PR** — ni un push
directo detectable. **Un guard ausente hacia el NO no da síntoma mientras todos cooperan**
(`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`). Con **38 worktrees**, tres sesiones autónomas
y autorización permanente de merge, «todos cooperan» es una propiedad del día, no del sistema.

Busqué si **fue decidido** no proteger `main`: `grep -liE 'branch.?protection|protección de rama|ruleset'`
sobre `docs/`, `memoria/`, `CLAUDE.md` y `HANDOFF.md` da 4 archivos, **ninguno** sobre esta decisión (tres
son de `copiloto-disney`, uno es metodología de errores). **No hay decisión escrita: hay un hueco.**

**Fila `MAINSINGUARD`** · dueño **planificación** (es gobernanza, no código) · DoD: un ruleset en `main`
que exija pull request. **Control positivo, y es el punto:** `git push origin main` directo debe ser
**rechazado por el remoto**. Hoy ese control **saldría permitido** — no lo ejercité porque pushear a
`main` está prohibido por canon; lo corre quien active la protección, y sin ese control el fix es
indistinguible de no hacerlo.

## 3 🔀 El acoplamiento: aplicar el fix de §2 **sin** tocar el gate abre un falso verde

`ci-verde.sh:242-276` decide con `case "$ms"` sobre `"<mergeable>/<mergeStateStatus>"`, y las ramas son
`MERGEABLE/*`, `CONFLICTING/*` y `*)`. **El comodín ignora el `mergeStateStatus` entero.** Canario con
`gh` stubeado, sobre el script real:

| `mergeable/mergeStateStatus` | rc | veredicto |
|---|---|---|
| A) `MERGEABLE/CLEAN` · 6/6 SUCCESS *(control +)* | **0** | VERDE ✅ |
| B) `backend: FAILURE` *(control +)* | **1** | ROJO ✅ |
| G) `CONFLICTING/DIRTY` *(control −)* | **4** | ROJO ✅ |
| H) `UNKNOWN/UNKNOWN` *(control −)* | **2** | ROJO — SIN MEDIR ✅ |
| **D) `MERGEABLE/BLOCKED`** | **0** | **VERDE — se puede mergear** |
| **E) `MERGEABLE/BEHIND`** | **0** | **VERDE — se puede mergear** |
| **F) `MERGEABLE/DIRTY`** | **0** | **VERDE — se puede mergear** |

Los cuatro controles dan lo esperado, así que las tres filas de abajo miden el script y no mi arnés.

**Hoy es inofensivo, y lo medí en vez de suponerlo:** sin branch protection, `BLOCKED` y `BEHIND` **no son
alcanzables**, y `DRAFT` tampoco (**0 PRs en draft sobre 100 leídos**, control positivo: 100). Por eso
**no** es una fila urgente por sí sola.

**Lo que la vuelve urgente es el orden.** `BLOCKED` es exactamente lo que GitHub devuelve cuando un
ruleset exige PR o reviews. Entonces:

> **Activar la protección de `main` (§2) sin tocar este `case` convierte un guard ausente en un FALSO
> VERDE.** Antes: el gate no miraba y nada bloqueaba — coherente. Después: GitHub bloquea el merge y el
> gate sigue diciendo «se puede mergear», con el agravante de que `mergear-pr.sh:46` **delega en él** y no
> reimplementa la decisión. El defecto no está en ninguna de las dos decisiones: **está en el cruce**
> (`memoria/dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md`).

**Fila `CIVERDEMERGESTATE`** · dueño **planificación** · **va en el MISMO PR que `MAINSINGUARD`, no
después.** DoD: `DRAFT|BLOCKED|BEHIND|DIRTY` salen por un exit propio (no fundido con el 1 ni el 2, como
ya hace `CONFLICTING` con el 4), y `CLEAN|HAS_HOOKS|UNSTABLE` siguen pasando — `UNSTABLE` es el caso
normal cuando falla un check no requerido, y un guard que grita en el caso normal se desarma solo.
**Control positivo:** el canario de esta tabla, que ya existe y hoy sale `rc=0` en D/E/F.

## 4 — La fila chica: lista de jobs vacía ⇒ VERDE habiendo medido cero

```
C) ESPERADOS=' '  ->  rc=0   "VERDE — se puede mergear (merge=MERGEABLE/CLEAN · 6/0 jobs del rollup)"
                             "--- CONTROL: 6 jobs presentes en el rollup del PR, 0 esperados ---"
```

`for j in $ESPERADOS` no itera, `falta` queda en 0, y nada compara `esperados_n` contra cero. **Es la
misma lección que el propio script ya aprendió un nivel más arriba** y escribió en `:244-250`: hasta #772
el veredicto era *«indistinguible entre "medí el merge" y "no miré"»*, y se arregló **haciendo que el
texto declare lo que midió**. El texto acá **también** lo declara (`6/0`), y otra vez **el exit code no**
(`memoria/instrumento-que-no-mira-nunca-falla.md`).

**No es alcanzable hoy:** el único call-site real es `mergear-pr.sh:46`, `ci-verde.sh "$PR"` **sin `$2`**
(el resto de los 20 hits son los tests y los comentarios). **Fila `CIVERDEDENOM`** · dueño
**planificación** · severidad baja · fix de una línea:
`[ "$esperados_n" -eq 0 ] && { echo "ROJO — no pude medir: la lista de jobs está vacía"; exit 2; }`.
**Es la tercera aparición del mismo defecto en un día** —`SMOKEDENOM` (smoke), `LINTDENOM` (`lint.sh:44`) y
ésta—: **un denominador que no se asere contra un esperado.** Tres instrumentos distintos, una sola línea
de código escrita tres veces.

## 5 — Lo que no audité

**No corrí `mergear-pr.sh`** (mergea de verdad) ni activé la protección (no es mi decisión ni mi estado
compartido). El canario de §3 corre contra el script real con `gh` stubeado, reutilizando el mecanismo de
`scripts/tests/test-ci-verde-gh-presente.sh`; el de §1 y §4 son mediciones contra la API de GitHub, de
lectura. **Las 6 filas de control positivo de las dos tablas son lo que hace que las confirmadas
signifiquen algo.**

Queda fuera `scripts/lib/gh-stub.sh`, que su propio comentario (`:17`) declara como deuda conocida: *«hoy
no mienten; mentirán el día que `ci-verde.sh` pida un campo»* más de los que el stub simula.

🤖 auditoría · Opus 5 (1M context)
