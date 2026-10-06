# ADR-006 — Protección de `main`: la regla más citada del proyecto no tenía guard

- **Fecha:** 2026-10-06
- **Estado:** 🟡 **`PROPOSED`** — 🔴 **y BLOQUEADO en la activación: ver ENMIENDA 2 arriba.** `main` sigue sin protección; el permiso para crear el ruleset lo tiene el operador — y **no puede pasar a `ACCEPTED` sin el test adversarial del §7**.
  Esto es un **control de autorización**, y la regla dura del `CLAUDE.md` global es explícita:
  *«Control de autorización sin test adversarial = control no verificado»*. El control acá no es
  «el ruleset existe en la API» (eso es configuración): es **un push directo a `main` que el
  remoto RECHAZA**. Hasta que eso esté medido, el control queda `[UNVERIFIED]`.
- **Decide:** planificación (es **ejecución de una regla que el operador ya escribió**, no una
  decisión nueva — ver §5 para lo que sí habría sido MAYOR y por eso **no** se hizo)
- **Hallazgo:** sesión de auditoría, 2026-10-06, tercera pasada sobre la cadena de merge

---

> ## ⚠️ **ENMIENDA 2 — 2026-10-06: el guard NO se pudo activar desde esta sesión, y el motivo no es técnico**
>
> La precondición del §7 **se cumplió**: el `case` del `mergeStateStatus` ya está en `main`
> (PR #854 mergeado, `d69d244a`), así que activar el ruleset ya no fabricaba un falso verde.
> Con eso hecho, **las dos mitades del guard quedaron fuera del alcance de esta sesión**, cada
> una por un gate distinto:
>
> | mitad | acción intentada | resultado |
> |---|---|---|
> | **servidor** | `POST /repos/:owner/:repo/rulesets` | 🔴 **denegada** por el clasificador: *«Account & Standing-Rule Changes»* |
> | **cliente** | leer `.githooks/pre-push` para que mire el ref de destino | 🔴 **denegada** — y no se edita a ciegas un hook por el que pushean las tres sesiones |
>
> 🔑 **La clasificación del primero es CORRECTA, no un falso positivo que haya que rodear.**
> Un ruleset es una **regla permanente de la cuenta del operador**: sobrevive a la sesión y aplica
> a las tres sesiones y a cualquier clon. La autorización permanente que el operador firmó
> (`CLAUDE.md` §3.8) nombra **merges y deploys**, no cambios de gobernanza de la cuenta. Que el
> mismo `CLAUDE.md` diga *«si un gate mecánico te frena, es problema tuyo»* **no convierte esto en
> un gate mecánico**: el límite coincide con el reparto de roles que el proyecto ya declara
> — *«el humano decide lo MAYOR»*. Rodearlo sería ejecutar lo MAYOR sin el humano.
>
> 🛑 **LO QUE NO SE HIZO, A PROPÓSITO: el control adversarial del §7.**
> Con **0 rulesets medidos**, un push directo a `main` **habría tenido ÉXITO**. Correr el control
> en ese estado no mide un guard: **comete exactamente el daño que el guard existe para impedir**,
> y deja en `main` un commit que no pasó por PR. El control adversarial **sólo tiene sentido
> DESPUÉS** de que el ruleset exista. Se diseñó con tree idéntico (`git commit-tree` sobre el
> árbol de `origin/main`) para que, si el ruleset falla abierto, el daño sea un commit **vacío**
> — pero ni así se corre sin ruleset.
>
> **Estado real, sin maquillaje:** `main` **sigue sin protección**. El hallazgo de auditoría **no
> está cerrado**: está *decidido, diseñado, con blast radius medido y sin aplicar*. No lo marco
> `ACCEPTED` ni lo bajo a «hecho» — sería la aprobación-ritual que este mismo ADR denuncia.
>
> ### Qué falta exactamente, y quién lo tiene
>
> **Dueno: el operador.** Una de dos, y las dos son de un paso:
> 1. **Darle el permiso a esta sesión** (regla de `Bash` para `gh api … /rulesets`) y lo activo yo
>    con los tres controles en la misma corrida; o
> 2. **Activarlo él**, con el payload ya escrito y el blast radius ya medido.
>
> Payload listo para pegar — `gh api repos/:owner/:repo/rulesets --method POST --input ruleset-main.json`:
>
> ```json
> { "name": "main-exige-pull-request", "target": "branch", "enforcement": "active",
>   "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
>   "bypass_actors": [],
>   "rules": [
>     { "type": "pull_request", "parameters": {
>         "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
>         "require_code_owner_review": false, "require_last_push_approval": false,
>         "required_review_thread_resolution": false,
>         "allowed_merge_methods": ["merge", "squash", "rebase"] } },
>     { "type": "non_fast_forward" },
>     { "type": "deletion" } ] }
> ```
>
> **`non_fast_forward` y `deletion` son una extensión sobre lo que el §6 declaró, y la declaro
> acá con su medición** — no se cuelan sin registro. Blast radius **0**, con control positivo:
> `git push` da **15** hits en `scripts/` + `.githooks/` + `.github/`; de los dos hits de
> force/delete, uno es una **lista de denegación** que ya prohíbe force-push
> (`autorizar-acciones.sh:59`) y el otro borra la **rama de feature** (`mergear-pr.sh:73`,
> `$RAMA`), nunca `main`; **cero** pushes apuntan a `main`. Las dos reglas cubren los dos
> accidentes peores de un checkout compartido con 43 worktrees: borrar `main` y force-pushearla.
>
> ### Los tres controles, en este orden y sin saltear el 2
>
> 1. **Adversarial (§7):**
>    `sha=$(git commit-tree $(git rev-parse origin/main^{tree}) -p origin/main -m "control adversarial ADR-006")`
>    y `git push origin $sha:refs/heads/main` → **tiene que ser RECHAZADO por el remoto**. Un
>    ruleset que existe en la API y no rechaza es indistinguible de ninguno.
> 2. 🔴 **Caso NORMAL, con CI CERRADO EN VERDE** (enmienda 1, sigue vigente): un PR verde tiene
>    que seguir leyendo `CLEAN`, **no `BLOCKED`**. Si sale `BLOCKED`, el enumerado nuevo lo manda a
>    exit 5 y **congela los merges de las tres sesiones** — en ese caso se **borra el ruleset en el
>    acto**. Con CI en vuelo el PR está en `UNSTABLE`, que `ci-verde.sh` trata como verde: el
>    control **pasa en los dos mundos** y no mide nada.
> 3. **Consulta de precedencia del enum** (no bloquea `ACCEPTED`, pero su respuesta entra acá).
>
> ⚠️ **El orden importa en los dos sentidos.** El 1 sin ruleset comete el daño; el ruleset sin
> el 2 medido puede frenar a todos. → [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]

---

## 1. Contexto — el guard existe donde hubo miedo, no donde hubo confianza

`CLAUDE.md:65` dice **«PR + rama — sin push directo a `main`»**. El `CLAUDE.md` global la pone como
no negociable y exige *«gobernanza el Día 0 (G-2), no como afterthought»*. Es, por lejos, la regla
más citada del repo.

**Medido el 2026-10-06, nada la hacía cumplir:**

```
servidor:  /repos/<owner>/<repo>/branches/main/protection -> 404 "Branch not protected"
           /repos/<owner>/<repo>/rulesets                 -> NINGUNO
           (control positivo del token: visibility=public default_branch=main allow_squash=true)
cliente:   core.hooksPath=.githooks -> UN hook, pre-push, 139 líneas
           'refs/heads'              -> 0 hits   <- nunca mira el ref de DESTINO
           'protegida|protected|prohibido' -> 0 hits
           control positivo en el MISMO archivo: 'exit 1' -> 3 · 'origin/main' -> 7
```

El `pre-push` **sí** consume el stdin de git (`:9`, `REFS_STDIN`) pero sólo se lo pasa al
`secretos-check`: nunca compara el ref de destino.

**Por qué nadie lo notó: porque la regla se cumple.** Control de efecto sobre `origin/main` a 7
días: **140 commits, 104 con `(#NNN)` de squash y el resto merge-commits de PR — ni un push
directo.** Y ahí está la trampa: **un guard ausente hacia el «no» no da síntoma mientras todos
cooperan.** Con 39 worktrees y tres sesiones autónomas con merge permanentemente autorizado,
«todos cooperan» es una propiedad **del día**, no del sistema.

🔴 **El filo que convierte esto en decisión y no en prolijidad:** el repo **mecanizó con
fail-closed el riesgo que temía** —un secreto en un repo público (`pre-push:13-16`: *«hallazgo o
escáner roto ⇒ el push aborta»*)— y dejó **sin mecanizar el que da por disciplinado**.

Se buscó si la ausencia era deliberada: `grep -liE 'branch.?protection|protección de rama|ruleset'`
sobre `docs/`, `memoria/`, `CLAUDE.md` y `HANDOFF.md` da 4 archivos y **ninguno es sobre esto** (3
son de otro proyecto). **No había decisión: había un hueco.** Este ADR lo cierra en un sentido o en
el otro, y deja de ser implícito.

## 2. El cruce que hace que esto NO se pueda hacer solo

`ci-verde.sh` decidía con `case "$ms" in MERGEABLE/*)`, y el comodín **ignoraba el
`mergeStateStatus` entero**. Medido por auditoría con `gh` stubeado sobre el script real, con cuatro
controles positivos que dieron 0/1/4/2 como se esperaba:

| `mergeable/mergeStateStatus` | rc viejo | |
|---|---|---|
| `MERGEABLE/CLEAN` + 6/6 SUCCESS *(control +)* | 0 | VERDE ✅ |
| `backend: FAILURE` *(control +)* | 1 | ROJO ✅ |
| `CONFLICTING/DIRTY` *(control −)* | 4 | ROJO ✅ |
| `UNKNOWN/UNKNOWN` *(control −)* | 2 | SIN MEDIR ✅ |
| **`MERGEABLE/BLOCKED`** | **0** | **«VERDE — se puede mergear»** |
| **`MERGEABLE/BEHIND`** | **0** | **«VERDE — se puede mergear»** |
| **`MERGEABLE/DIRTY`** | **0** | **«VERDE — se puede mergear»** |

**`BLOCKED` es exactamente lo que GitHub devuelve cuando un ruleset exige PR.** Entonces: activar la
protección **sin tocar ese `case`** convertía un guard ausente en un **falso verde** — y peor que no
tener nada, porque `mergear-pr.sh:46` **delega** en ese gate y no reimplementa la decisión.

> **El defecto no vivía en ninguna de las dos decisiones. Vivía en el CRUCE.** Las dos eran
> correctas por separado: proteger `main` es la regla del repo, y tratar `MERGEABLE` como mergeable
> era razonable mientras `BLOCKED` fuera inalcanzable. El agujero aparece en el par.
> → `memoria/dos-decisiones-correctas-que-se-cruzan-en-un-agujero.md`

Por eso el enumerado del `case` **va en el mismo commit** que este ADR, y la activación del ruleset
va **después de que ese commit esté en `main`** (§7).

## 3. Decisión

**Un ruleset en `main` que exija pull request, con esta configuración exacta:**

| parámetro | valor | por qué |
|---|---|---|
| `deletion` / `non_fast_forward` | bloqueados | borrar `main` o reescribir su historia no tiene caso de uso legítimo acá |
| `pull_request` | requerido | **es la regla**: nada entra a `main` sin PR |
| `required_approving_review_count` | **0** | ver §5: pedir aprobaciones **deadlockea** tres sesiones autónomas sin revisor humano disponible |
| `required_status_checks` | **ninguno** | ver §5: contradice ADR-001 y choca con un bug medido de `tests.yml` |
| `bypass_actors` | **ninguno** | 🔴 **lo más importante del ADR** — ver abajo |

🔴 **Sin actores de bypass, y esto no es rigor decorativo: las tres sesiones usan la MISMA
credencial de `gh`, que es la del dueño del repo.** Si se agregara «Repository admin» como bypass,
el ruleset **no protegería a nadie** — justo a los actores que puede equivocarse. Un guard que
exime a todos los que lo pueden violar es un guard que no existe. El operador conserva el control
real: puede desactivar el ruleset desde la UI en treinta segundos, que es una acción **visible y
deliberada**, no un bypass silencioso.

**Y el cambio de código que la habilita** (mismo PR): `ci-verde.sh` enumera
`MERGEABLE/CLEAN|HAS_HOOKS|UNSTABLE` como verde, manda `BLOCKED|BEHIND|DIRTY|DRAFT` a un **exit 5
propio**, y un `mergeStateStatus` **desconocido** a exit 2 — porque el enum es de GitHub, no
nuestro, y lo que no se reconoce no se declara verde.

## 4. Blast radius — medido antes, no después

**Nada en la automatización pushea a `main`.** `grep -rn "git push" scripts/ .githooks/` da **12
hits** (control positivo: el patrón existe), y los 12 son patrones de permiso en
`autorizar-acciones.sh`, texto de ayuda de `setup-hooks.sh` o la sugerencia de `--no-verify` del
`pre-push`. **Cero scripts pushean a `main` directo.** O sea: el ruleset **no bloquea nada que
alguien haga hoy**, que es la definición de un guard que no grita en el caso normal.

## 5. Alternativas rechazadas, con su costo

- ❌ **Exigir aprobaciones (`required_approving_review_count >= 1`).** Las tres sesiones mergean sus
  propios PR con autorización permanente del operador y **no hay revisor humano en el loop**. Cada
  PR quedaría `BLOCKED` para siempre, la cola se detiene, y el resultado previsible es que alguien
  desactive el ruleset entero. **Un guard que grita en el caso normal se desarma solo** —
  `memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md`.
- ❌ **Exigir status checks de GitHub.** Dos motivos medidos. (1) **Contradice ADR-001**: la
  definición de la suite **no sale de GitHub**, sale de `scripts/gate.sh` con recibo por SHA;
  GitHub es respaldo y atestación. Hacer que GitHub sea el que autoriza invierte esa decisión por
  la puerta de atrás. (2) Abrir un PR sobre una rama **ya pusheada no dispara `tests.yml`** (medido
  dos veces el 2026-10-06; el workaround es `gh workflow run tests.yml --ref <rama>`): con checks
  requeridos, esos PR quedarían `BLOCKED` sin que nada los pueda desbloquear.
- ❌ **Sólo un guard en el `pre-push` que mire el ref de destino.** Se saltea con `--no-verify`
  —que el propio repo documenta como escape ante fallos del bridge de Graphity— y **no existe en
  otro clon**. Un control del lado del cliente es una convención con mejor marketing. Puede
  agregarse **además**, como mensaje temprano; no **en vez de**.
- ❌ **No hacer nada y anotarlo** (la regla `CONGELAINSTR` del sprint, que congela hallazgos de
  instrumento). No aplica: esto no es un instrumento de medición, es **el control de acceso al
  branch que define el producto**, en un repo **público**, con tres actores autónomos. Y el costo
  medido de cerrarlo es un `case` enumerado más una llamada a la API.

## 6. Consecuencias

- Un push directo a `main` **falla en el remoto**, para cualquiera, incluido quien tiene admin.
- `gh pr merge` sigue funcionando igual: mergear un PR **no es** un push directo.
- `ci-verde.sh` gana el exit 5. Los consumidores que hoy sólo distinguen 0 vs no-0 **no cambian de
  comportamiento** (siguen sin mergear); el que lee el texto recibe una causa accionable en vez de
  un rojo genérico.
- Si GitHub devolviera `BLOCKED` para **todo** PR con este ruleset, el gate lo dirá en voz alta con
  el exit 5 en vez de mentir — y eso es el disparador para revisar la config (§7, control 2).

## 7. DoD — qué tiene que estar medido para pasar a `ACCEPTED`

> ⚠️ **ENMIENDA 2026-10-06 — la medición de auditoría GANA sobre el DoD que escribí.** El control 2
> («un PR normal sigue leyendo `MERGEABLE/CLEAN`») **no atribuía**, y el defecto es el mismo que este
> ADR denuncia en `ci-verde.sh`. Medido: `UNSTABLE` es el estado **normal** de un PR *mientras el CI
> corre* — el mismo #853 leía `CLEAN` con 6 jobs en SUCCESS y pasó a `UNSTABLE` al pushear un tercer
> commit. Como `ci-verde.sh` trata `UNSTABLE` como verde, **el control saldría «pasa» en los dos
> mundos**: no distingue «el ruleset no me bloqueó» de «el ruleset me bloqueó pero el CI en vuelo gana
> en el enum». Dos causas suficientes para el mismo resultado. Y es justo el estado en que uno está
> tentado de medir, porque es el estado en que están los PR casi todo el tiempo.
>
> **Corrección, y sale más barata que lo que escribí:** el control 2 se corre **con el CI CERRADO
> VERDE** — la única condición en que `CLEAN` y `BLOCKED` son distinguibles, porque sin checks
> pendientes `UNSTABLE` no tiene de dónde salir. Y se agrega una **consulta** (no un experimento) que
> ninguno de los dos sabía: con el ruleset puesto, qué lee un PR con el CI **corriendo**. Si lee
> `BLOCKED`, el bloqueo gana sobre el pendiente y el gate lo ve; si lee `UNSTABLE`, **el bloqueo queda
> invisible mientras el CI corre**, y ésa es exactamente la ventana en la que `ci-verde.sh` diría verde
> sobre un PR bloqueado. El enum es de GitHub, no nuestro — el mismo argumento con el que este ADR
> manda un estado desconocido a exit 2.
>
> → `memoria/dos-causas-suficientes-el-test-no-atribuye.md`

- [x] `ci-verde.sh` enumerado + exit 5 + desconocido a exit 2, con canario de **11 casos** en
      `scripts/tests/test-ci-verde-gh-presente.sh`.
- [x] **Control positivo del canario:** contra el `ci-verde.sh` **viejo**, los casos BLOCKED/BEHIND/
      DIRTY/desconocido/denominador salen **ROJOS** y `UNSTABLE` (el caso normal) sigue verde. Sin
      esto, el canario verde no distinguiría «lo arreglé» de «no mido nada».
- [ ] El commit del `case` **mergeado a `main` ANTES** de activar el ruleset. ⚠️ Estaba marcado `[x]` sin estarlo: el PR es **#854** y al 2026-10-06 sigue abierto. Un `[x]` adelantado en un DoD es la misma falla que el ADR denuncia, un nivel más arriba.
- [ ] 🔴 **Test adversarial (el que decide este ADR):** `git push` directo a `main` desde un clon con
      la credencial habitual ⇒ **rechazado por el remoto**. Un ruleset que existe en la API y no
      rechaza es indistinguible de ninguno.
- [ ] **Control 2, el del caso normal, SÓLO con el CI cerrado verde** (ver enmienda): un PR abierto
      después de activar el ruleset lee `MERGEABLE/CLEAN` y `ci-verde.sh` da **exit 0**. Si diera
      exit 5, el ruleset está mal configurado y **se revierte** — el guard no puede frenar el camino
      que todos usan. **Medido con CI en vuelo no vale:** `UNSTABLE` pasa en los dos mundos.
- [ ] **Consulta de precedencia del enum:** con el ruleset puesto, qué lee un PR con el CI
      **corriendo**. `BLOCKED` ⇒ el bloqueo gana y el gate lo ve. `UNSTABLE` ⇒ **el bloqueo es
      invisible mientras el CI corre**, y hay que escribirlo acá y en `ci-verde.sh`, porque es la
      ventana en que el gate diría verde sobre un PR bloqueado. Esto NO bloquea el `ACCEPTED`, pero
      su respuesta sí entra al ADR: es la única parte del mecanismo que no controlamos nosotros.
- [ ] **Línea base, registrada ANTES por auditoría** (2026-10-06, contra la que se compara):
      `0 rulesets` · `main` → `404 Branch not protected` · #853 y #854 en `MERGEABLE/UNSTABLE` con CI
      en vuelo. Sin línea base, un `CLEAN` posterior no prueba que algo cambió.

🤖 planificación
