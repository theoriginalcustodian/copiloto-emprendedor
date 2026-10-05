---
name: push-es-el-ultimo-paso-no-el-primero
description: Un squash-merge toma el HEAD REMOTO de la rama, no tu último commit local — si arreglás algo DESPUÉS de pushear y no repusheás, el merge reintroduce lo que ya habías corregido
metadata:
  type: project
---

# 🔀📤 `push` es el ÚLTIMO paso antes de mergear, no el primero

**Medido el 2026-08-12** (Lote B, PR #407). Corregí un assert mal hardcodeado (`chars: 38`→`36`,
commit `121e271`) EN MI WORKTREE LOCAL y corrí `scripts/gate.sh` ahí mismo → 5/5 verde. Pero nunca
volví a pushear antes de `gh pr create` + `gh pr merge --squash`. El squash tomó el HEAD REMOTO real
de la rama — que seguía en el commit viejo, con el assert roto — y lo mergeó a `main` tal cual.

Verifiqué localmente algo que después NO fue lo que se publicó. Es
[[git-push-puede-salir-exit-0-sin-haber-pusheado]] con el signo cambiado: ahí el `push` miente sobre
haber pusheado; acá el `push` fue honesto la PRIMERA vez, y el error fue confiar en que seguía
siendo cierto después de un commit nuevo encima.

## El control

`git push` es el ÚLTIMO paso antes de `gh pr create`/`gh pr merge`, nunca antes de un fix posterior
al primer push. Si corregís algo después de pushear, repusheá y confirmá con
`git log origin/<rama> -1` (o `git rev-parse HEAD` contra `git ls-remote origin refs/heads/<rama>`)
antes de tocar el PR — "ya pusheé" deja de ser cierto en cuanto hay un commit nuevo encima.

## Costo real

`main` quedó roja en Actions; dos sesiones distintas arreglaron el MISMO bug por separado sin verse
(un PR ajeno y uno propio), y el propio quedó redundante y en conflicto contra el que ya había
mergeado. El gate no mentía — medía un árbol que no era el que se publicó.

## ADENDA 2026-09-29 — el control de un squash es el CONTENIDO, y `--is-ancestor` puede acertar por casualidad

`git merge-base --is-ancestor <commit> origin/main` da **rojo aunque el contenido esté mergeado**: en un
squash-merge el contenido viaja y el commit no. Rojo correcto de un hecho falso.

Dos casos el mismo día, y el segundo es el que enseña:

- **Auditoría:** el `--is-ancestor` frenó el borrado de una rama ya mergeada. Correcto por accidente.
- **Planificación:** midió los commits de FE2 (`4a9f4f7c`, `f9ee1ec9`) con `--is-ancestor` → rojo; pero
  midió **además** el contenido (`grep -c dc.html` sobre `origin/main:docs/ASSETS-EXTERNAL.md`) y ahí se
  vio lo que pasaba. **Quedándose en el `--is-ancestor` habría llegado a la conclusión correcta por
  casualidad** — y la próxima vez, con el mismo método, a la equivocada.

**La regla:** después de un squash-merge, el control es el **contenido, archivo por archivo**
(`grep` de una marca del cambio sobre `origin/main:<path>`, o `git show origin/main:<path> | diff -`),
nunca la pertenencia del commit. Y el corolario más caro: **un instrumento que acierta por casualidad
no se distingue de uno que funciona** hasta que falla — por eso el control de contenido va igual cuando
el `--is-ancestor` ya te dio la respuesta que esperabas.

Ver también [[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]] (ejercitá la función, no el log).

**El espejo, y conviene leer los dos juntos:** acá el squash produce un falso **ROJO** (dice «falta» y
no falta). El caso inverso —un merge que sale **verde sin aportar nada**: PR `MERGED`, `--json files`
poblado, y el árbol del merge idéntico al de su padre— está en
[[el-instrumento-respondio-sobre-otro-sujeto]], caso 12, con su control propio (comparar
`git rev-parse <merge>^{tree}` contra el del padre). Mismo mecanismo, direcciones opuestas: uno niega
trabajo hecho, el otro acredita trabajo que no existió.

---

## Refuerzo 2026-10-05 · un recibo que no registra el SHA **parece** un recibo, y el que lo invalida sos vos

Dejé un script esperando a que terminaran los checks del PR para medir el veredicto. Volvió
**`VERDE 6/6 · exit 0`**. Era falso: entre que arrancó (11:31) y midió (11:32:40) yo había pusheado otro
commit, así que ese verde era del **SHA anterior**. El rollup del SHA nuevo recién arrancaba (11:33:59,
5 jobs `pending`). Nada en el log permitía notarlo, porque **el log no escribía el SHA**.

Dos cosas que lo hacen peligroso y no sólo incorrecto:
- **El falso verde vino de mi propio push**, no de un tercero. El riesgo clásico es «otro movió el head»;
  acá el que lo movió fui yo, en el mismo turno, haciendo trabajo legítimo (commit + push de otra cosa).
- **Un recibo sin SHA no se puede refutar.** Con el SHA, la contradicción salta sola; sin él, el verde es
  citable y nadie puede decir que no corresponde. Es la forma más limpia de fabricar una atestación.

**How to apply:**
- **Todo medidor asincrónico ancla su sujeto al arrancar y lo re-verifica antes de concluir.** Si el
  sujeto se movió: **abortar con un código de «no pude medir»**, nunca medir el sujeto nuevo como si
  fuera el pedido ([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]).
- **El recibo imprime PR + SHA + rc + timestamp en la misma línea.** Un veredicto sin sujeto no es
  evidencia; es una opinión con formato.
- **Mientras un medidor corre sobre tu rama, no pushees a esa rama** — ni siquiera algo inocuo. El trabajo
  paralelo que invalida tu propia medición es el caso normal, no el raro.

---

## Refuerzo 2026-10-05 · una rama derivada de una rama squash-mergeada conflictúa consigo misma

Mergeé un PR con **squash** y seguí trabajando en mi worktree desde el head local. La rama siguiente
salió `CONFLICTING`/`DIRTY`: `main` tenía mi contenido en **un commit nuevo** mientras mi rama
arrastraba los commits **originales** desde una base previa al squash, así que git intentaba aplicar
dos veces lo mismo — y conflictuó justo en los archivos que el PR anterior ya había tocado.

No lo resolví a mano: **resolver tomando un lado descarta una mitad**
([[resolver-tomando-un-lado-nunca-converge]]). El control que lo vuelve mecánico:

```bash
# ¿el contenido de main es idéntico al del PADRE de mi commit en los archivos tocados?
for f in $(git diff --name-only origin/main...HEAD); do
  [ "$(git rev-parse "<padre>:$f")" = "$(git rev-parse "origin/main:$f")" ] && echo IDENTICO || echo DIVERGE
done
```

Seis IDENTICO ⇒ el squash preservó el contenido byte a byte ⇒ `git cherry-pick <mi commit>` sobre
`main` aplica **limpio por construcción**. Control del efecto: el diff dio exactamente los 3 archivos
y +73 medidos antes, y `merge-tree --write-tree` pasó de `rc=1` a `rc=0`.

**La regla:** después de un squash-merge, la rama siguiente **nace de `origin/main`**, no del head que
tenías. Y si ya nació mal, se rebasa comparando blobs antes de tocar un solo marcador de conflicto.

---

## Refuerzo 2026-10-05 · 35 commits sin pushear y **cero** contenido nuevo: contá archivos, no commits

Una rama propia acumuló **35 commits** sin pushear (1938 inserciones, 29 archivos: 24 entradas de memoria,
un doc de auditoría de 427 líneas y 5 scripts). El bloqueo que los retenía —un pre-push que abortaba—
cayó, y el disparador para empujarlos quedó cumplido. Antes de abrir el PR, medí archivo por archivo contra
`origin/main`:

```
ya-en-main=27 · falta-entero=0 · parcial=2   (de 29)
```

Y los 2 «parciales» también eran falsos: en el `.md`, las *113 líneas mías ausentes* desaparecían al
comparar sin CR (**CRLF**) y mi cambio real eran 24 líneas, con las 19 no vacías presentes en main; en el
`.py`, mi cambio real era **una** línea, también presente. El contenido había llegado por **otras ramas**
que sí se pushearon. Abrir el PR habría sido 1938 inserciones que **no agregan una sola línea**, con 3
conflictos a resolver a mano y el riesgo de pisar 207 líneas ajenas en un script compartido.

**Por qué engaña:** `git log origin/main..mi-rama` cuenta **commits**, y un commit cuyo contenido ya está en
`main` por otro camino (cherry-pick, un PR hermano, un squash) **sigue apareciendo**. El contador mide
*historia divergente*, no *contenido faltante*: en un repo con ramas que se cruzan, los dos números no se
parecen.

**El control, una línea por archivo:** comparar el blob (`git rev-parse <ref>:<path>`); si difiere,
re-comparar **sin CR**; si todavía difiere, extraer *tu* diff contra la `merge-base` y preguntar si esas
líneas están en `main`. Recién si faltan, hay trabajo. Corolario: **un disparador cumplido no implica que el
trabajo que custodiaba siga existiendo** — medí el objeto antes de ejecutar la acción que esperaba.

Hermana de [[un-disparador-cumplido-no-avisa-a-nadie]] y de
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]].

---

## Refuerzo (2026-10-05, auditoría): la asimetría también existe al LEER — `master` nombra DOS cosas y los dos controles obvios miran la local

Esta entrada avisa que el squash toma el **HEAD remoto**. El mismo desajuste muerde al revés, cuando
alguien **lee** el repo para declarar un estado.

**Medido en `graphify-graphity-bridge`.** Un aviso me decía «el bridge ya está en `master` con la
entrada `copiloto-emprendedor`», con dos mediciones correctas al lado: `git status --short` limpio y
`git log --oneline master..HEAD` vacío. Fui a usar ese estado y encontré:

| | |
|---|---|
| `copiloto-emprendedor` en `HEAD:config/repos.toml` | **4** ✅ |
| `copiloto-emprendedor` en **`origin/master`**`:config/repos.toml` | **0** 🔴 |
| `repos.toml` | `HEAD` 200 líneas / 7 repos · `origin/master` **32 / 1** |
| divergencia | **12** commits sin pushear · **3** sin traer · 7 archivos |

**Por qué los dos controles no lo ven, y son verdaderos igual:** `status` no mira el remoto, y
`master..HEAD` compara **la rama local consigo misma** — da vacío siempre que estés en `master`. El
que mide publicación es `origin/master..HEAD`. **Un repo puede estar impecablemente limpio y tener 12
commits sin publicar**, y entonces «está en master» es cierto para la rama local y falso para lo que
cualquier otro clon ve.

**El control que no se deja engañar es el EFECTO, no el SHA:**
`git show origin/master:<archivo> | grep -c <lo que necesitás>` ≥ 1. En ese repo un SHA ya había
demostrado que no sobrevive: el `ae850b3c` del aviso no existía ni como objeto suelto, descartado por
un `reset` previo ([[git-push-puede-salir-exit-0-sin-haber-pusheado]]).

**Y el control positivo que vuelve creíble al cero:** el mismo `grep` contaba 7 repos en `HEAD` y 1 en
`origin/master`. Sin eso, un `0` no se distingue de un lector que no mira
([[instrumento-que-no-mira-nunca-falla]]).
