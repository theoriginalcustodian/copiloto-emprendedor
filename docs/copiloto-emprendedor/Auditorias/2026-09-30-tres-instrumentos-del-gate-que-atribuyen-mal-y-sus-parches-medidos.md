# Tres instrumentos del gate que **atribuyen mal**, y sus parches medidos

**Fecha:** 2026-09-30 · **Sesión:** auditoría · **Rama:** `auditoria/rev-parse-ecoa-el-arg` (PR #771)
**Para:** quien mantenga los gates de este repo — planificación (dueña de `scripts/`) y cualquier
sesión que lea un rojo de `gate.sh` y tenga que decidir si es suyo.

**Por qué está acá y no sólo en el buzón:** `coordinacion/` **no está versionada**. Los dos pedidos
con estos parches desaparecen del repo cuando se limpie el buzón, y los parches todavía no están
aplicados. Esto es el registro que sobrevive al clon.

---

## 0. El patrón común, que es el hallazgo de verdad

Los tres defectos tienen la **misma forma** y ninguno es de detección:

| | ¿frena cuando debe? | ¿nombra bien la causa? |
|---|---|---|
| A · corpus fuera del repo | sí (local) / **no** (CI: saltea) | no — el rojo aparece en la rama de quien corre, no de quien lo causó |
| B · `lint.sh` cadena | sí | no — reporta **un** defecto y oculta el resto |
| C · `ci-verde.sh` corriendo | sí | no — dice «ausente o fallado» cuando nada falló |

**Los tres son fail-closed y los tres mienten sobre el por qué.** Un gate que frena bien y atribuye
mal no es «casi correcto»: es el que enseña a ignorarlo. Los tres empujan al mismo sitio —el bypass,
la investigación de un bug inexistente, o el hábito de leer el rojo como ruido— y el costo no se cobra
el día que aparece, sino el día en que el rojo **era real**.

---

## A · `contar-veredictos.py`: el corpus vive **fuera del repo**, así que el gate mide al equipo

**Dos líneas:** `scripts/evidencia/contar-veredictos.py:57` resuelve el buzón por **ruta absoluta al
checkout compartido**; `scripts/tests/test-contar-veredictos-padron.sh:44-56` saltea «no hay buzón»
por código de salida (`rc == 2`).

| dónde corre | ve el corpus | resultado |
|---|---|---|
| cualquier worktree de la máquina | **sí** (por la ruta absoluta, incluso sin `coordinacion/` propia) | corre contra el corpus **vivo** |
| clon sin esa ruta (CI de GitHub) | no | **se saltea → verde** |

Verificado en el log del run 36789216566: `⏭️ sin coordinacion/ en este checkout — salteado (el
contador aborta por diseño)`.

**Consecuencia medida:** escribir un mensaje al buzón pone rojo el gate de **las cuatro sesiones** sin
que ningún commit lo toque. El 30/09 fueron 3 documentos (dos míos, uno de planificación); **cuatro
horas después eran 4** — el sujeto del gate se mueve solo. Y está declarado ocho renglones más arriba
en el propio `lint.sh` («en CI sólo se lo puede ejercitar contra **fixtures**»): la norma existía y el
mecanismo la contradecía.

**Dueño:** planificación. **Salidas honestas (elegir una, no dejarlo implícito):**
1. el gate mira **fixtures**, y el corpus vivo se audita con un comando aparte; o
2. el gate sigue mirando el corpus vivo, y entonces **«dejar el corpus clasificado» pasa a ser parte
   del DoD de emitir un mensaje**, escrito en `COORDINACION.md`.

### ⚠️ REFUTADO el mismo día: mi «verde partido» comparaba **instrumentos**, no ramas

Había medido el rc del criterio 3 en cada rama y concluido que **cada una tenía la mitad** del verde
(`main` 6 · auditoría 8 · #770 6 · las dos juntas **0**), y de ahí derivé que hacía falta el par.
**Planificación lo refutó y la refutación es correcta.** Lo verifiqué sin correr nada, con los blobs
del propio instrumento:

| ref | blob de `scripts/evidencia/criterio3-matriz.mjs` | ocurrencias de `preg` |
|---|---|---|
| `origin/main` | `f5e0c834` | 0 |
| `origin/plan/lector-cuenta-por-plataforma` (#770) | `f5e0c834` | 0 |
| `auditoria/rev-parse-ecoa-el-arg` (#771) | **`e79cbee5`** | **5** |

Control positivo del método: `CLAUDE.md`, que ninguna de las dos ramas toca, da el **mismo** blob
(`7a2acddb`) en ambas — así que la diferencia de blobs de arriba no es un artefacto de la comparación.

**Por qué mi medición no medía lo que yo creía.** Extraer cada versión a su propio directorio resolvió
las rutas del script (`parents[2]`) y **garantizó al mismo tiempo que cada rama corriera su propia
versión del instrumento**. Entonces cada celda de mi tabla varía **dos** cosas a la vez —el corpus vivo
y el código que lo mide— y una comparación así **no atribuye nada**: el 0 del par no prueba
complementariedad, prueba que esa combinación de script y corpus da 0. Mi nota metodológica era
insuficiente justo donde parecía prolija.

**Lo que se retira es la causa, no la observación.** El orden de merge sobrevive, y por una medición
independiente de planificación que coincide: #771 **sola** sale `rc=8`; con #770 ya en `main`, verde
(`git merge-tree` del par → `03a796e5`, `rc=0`, stderr vacío). Sigue siendo **#770 primero, #771
segundo** — lo que cae es el relato de las dos mitades, no el orden.

**Y el hallazgo de §A sale reforzado, no debilitado:** al corpus fuera del repo hay que sumarle que el
**instrumento está versionado por rama**. Un rc comparado entre ramas mueve las dos variables, así que
para atribuir hay que **fijar el instrumento** (un solo blob, corriendo contra los distintos corpus) o
fijar el corpus. Cualquier tabla rama-por-rama que no diga cuál de las dos fijó está midiendo la suma
de las dos.

---

## B · `lint.sh` no es una suite: es una **cadena**

`scripts/ci/lint.sh:4` es `set -euo pipefail` y el bucle (`:44-48`) corre `bash "$t"` **sin capturar el
código**, así que el primer test rojo mata el script entero.

Tres corridas del **mismo** `lint.sh`, contadas con `grep -c '▶'`:

| corrida | suites ejecutadas | murió en |
|---|---|---|
| local 08:55 (antes del control 0 del medidor) | **47** | — (verde) |
| local 19:51 (rama de auditoría) | **8** | `test-contar-veredictos-padron.sh` (8ª, letra «c») |
| CI de GitHub 23:06 UTC | **33** | `test-medidor-avisa-en-el-borde.sh` (33ª, letra «m») |

**Dos propiedades lo vuelven una trampa.** El orden del glob es **alfabético**, sin relación con la
importancia de lo que cada suite prueba: qué defecto es observable es arbitrario y **estable**, el
mismo rojo tapa a los mismos 39 en cada corrida. Y **un rojo ajeno se vuelve escudo del propio**: el
rojo de A cae en la «c» y oculta todo lo posterior; en CI ese test se saltea, la corrida llega a la
«m», y ahí apareció un defecto real de esta rama (el fixture del medidor, arreglado en `5b728689`).

**Los dos alcances del gate no difieren sólo en el veredicto: difieren en qué defectos son visibles.**
Costo concreto: el cuerpo de #771 afirmaba «el único fallo es el padrón, todo lo demás está verde».
El log estaba completo; **la suite estaba truncada al 17 %**. La afirmación quedó corregida a la vista
en el PR.

**Parche**, con los cuatro controles corridos sobre un corpus sintético de 4 suites (**2 rojas
separadas por una verde** — con una sola, las dos variantes reportan lo mismo y el control no separa
nada):

```diff
+fallos_suites=0; suites=0
 for t in "$ROOT"/scripts/tests/test-*.sh; do
   [ -e "$t" ] || continue
+  suites=$((suites+1))
   echo "▶ $(basename "$t")"
-  bash "$t"
+  bash "$t" || fallos_suites=$((fallos_suites+1))
 done
+[ "$fallos_suites" -eq 0 ] || { echo "❌ $fallos_suites suite(s) en rojo de $suites examinadas"; exit 1; }
```

| control | resultado |
|---|---|
| variante actual | reporta **1 de 2** rojas · 2 suites nunca corrieron · no llega al final |
| variante propuesta | reporta **2 de 2** · 0 sin correr · llega al final |
| positivo (¿sigue roja?) | ✅ `rc=1` con 2 rojas — no apaga el gate |
| negativo (todo verde) | ✅ `rc=0` — no fabrica rojos |

**El costo de aplicarlo, medido: no hay cascada.** Corriendo las **48** suites una por una, fuera del
bucle: **1 sola roja**, la de A. Con el parche, `lint.sh` diría «❌ 1 suite(s) en rojo de 48
examinadas» en vez de abortar en la 8ª — mismo veredicto, 40 suites más de cobertura real.

**Dueño:** planificación. Es un cambio al **criterio de falla del gate compartido**, no un bugfix, así
que no se aplicó desde auditoría.

---

## C · `ci-verde.sh` dice «**fallado**» cuando el CI está **CORRIENDO**

Encontrado usándolo, no leyéndolo: `scripts/ci-verde.sh 771` **dos minutos después de pushear**, que
es el caso normal —`MEMORY.md` manda correrlo antes de cada merge—. Salida real, sin fixtures:

```
❌ backend: sin conclusión todavía (status=IN_PROGRESS) — está CORRIENDO, no pasó   (×5 jobs)
✅ drift: SUCCESS
--- CONTROL: 6 jobs presentes en el rollup del PR, 6 esperados ---
ROJO — no mergear: hay al menos un job ausente o fallado (medido, no supuesto)      exit 1
```

**El detalle es perfecto y el veredicto miente.** Los renglones dicen «está CORRIENDO»; la última
línea —la que se lee y la que se cita— ofrece dos causas, «ausente o fallado», y CORRIENDO **no es
ninguna de las dos**. Ningún job había fallado ni faltaba.

**Y el exit code también.** El propio archivo separa las familias en su cabecera (`:24`): `exit 1` =
«ROJO medido», `exit 2` = «no pude medir», y ya usa el 2 en cuatro rutas (`gh` ausente, sin argumento,
rollup ilegible, `SIN MEDIR`). *Corriendo* es **todavía no medido**. Hoy cae en `:161` con `falta=1` y
sale por el `exit 1` de `:187`, junto a los fallos reales. Lo dice el comentario del caso 5 de su
propio test, sobre el defecto gemelo ya arreglado: *«lo que mentía era el CÓDIGO, que es lo que un
script consumidor lee para decidir si reintentar, avisar o mirar el CI»*. Ante `2` se reintenta en dos
minutos; ante `1` se abre a investigar un fallo inexistente.

**Forma sugerida**, que no rompe el invariante {VERDE, ROJO} ni el fail-closed: contar los corriendo
aparte y, cuando todos los faltantes sean `IN_PROGRESS`, emitir

```
ROJO — TODAVÍA CORRIENDO (5 de 6 sin conclusión): no mergear, pero NADA falló. Re-medí en ~2 min.
```

y salir **2**. **El caso 12 que lo protege:** rollup con un job `IN_PROGRESS` y el resto `SUCCESS` →
`ROJO` único, **exit 2**, y el texto **no** contiene «fallado». Sin ese caso el fix es indistinguible
de un apagador (alguien podría mandar los corriendo a `exit 0` y los casos 3 y 4 seguirían pasando).

**Alcance medido por lectura, no por ejecución:** `origin/main`,
`plan/ci-verde-distingue-sin-medir-de-rojo` y `plan/ci-verde-mide-mergeable` tienen las mismas dos
líneas (`:161`, `:187`), así que ninguna rama en vuelo lo cubre. La corrida comparada de las tres
versiones **no se hizo**: el clasificador de permisos de la sesión denegó fabricar un `gh` en el PATH y
no se buscó otra vía. Se declara el límite en vez de presentar la lectura como si fuera una corrida.

**Dueño:** planificación, con dos ramas activas sobre ese archivo y su test — tocarlo desde auditoría
garantizaba conflicto.

---

## Evidencia citable

| archivo | qué prueba |
|---|---|
| `gh run view 36789216566 --log-failed` (607 líneas) | el salteo del padrón en CI, las 33 suites, el fallo del caso 1 |
| run 36790824158 sobre `3af42a6e` | 6/6 `success` tras el fix del fixture; `ci-verde.sh 771` → `VERDE`, exit 0 |
| barrido de las 48 suites una por una | **1 sola roja** en todo el gate local |
| medición de las dos variantes del bucle | 1 de 2 vs 2 de 2, con control positivo y negativo |
| `ci-verde.sh 771` a las 20:10 | el caso vivo de C, sin fixtures |

## Lo que queda abierto, y de quién es

1. **A** — planificación elige salida (1) fixtures o (2) DoD en `COORDINACION.md`. Mientras no se
   elija, el rojo vuelve con el próximo mensaje sin clasificar.
2. **B** — planificación decide si el bucle acumula. Parche y costo medidos arriba.
3. **C** — planificación decide el par (texto, código) para `IN_PROGRESS`, y agrega el caso 12.
4. **Merge del criterio 3** — **#770 primero, #771 después**, y por `merge-tree` del par (`rc=0`,
   stderr vacío, árbol `03a796e5`), no por el relato de las dos mitades que quedó refutado arriba.
   **No lo mergeo hoy:** la orden de parada del operador (20:28) lo prohíbe explícitamente —«hoy,
   ninguno»— y el monitor que tenía armado para disparar ese merge lo apagué al parar.

## Aprendizajes asociados (en `memoria/`)

- `un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit.md` — A, y la prueba de
  no-atribución que «cualquier fallo satisface».
- `el-primer-test-rojo-mata-la-suite-y-el-rojo-ajeno-se-vuelve-escudo-del-propio.md` — B, y la
  pregunta de denominador aplicada a la **corrida**: `grep -c '▶'` contra las suites que existen.
- `dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md` (refuerzo del 30/09)
  — C, y por qué arreglar **una** causa del veredicto agregado no arregla las otras.

---

## Re-verificación 2026-10-05 (parada levantada): el cuarto instrumento, y C sigue vivo

### El rojo de #772 no era su script: era el **stub** del test

`plan/ci-verde-mide-mergeable` llegó al reinicio con el job `lint` en rojo. El fallo es el caso 2 de
`scripts/tests/test-ci-verde-gh-presente.sh`: «2 gh presente dio rc=2, salida: …VERDE».

**Mecánica.** Ese stub responde el **mismo** array de 6 jobs a *cualquier* invocación de `gh`. La
versión de #772 agregó una pregunta nueva —`gh pr view --json mergeable,mergeStateStatus`— y el stub le
devuelve el array de jobs; el script no puede leer `mergeable`, repregunta una vez (su propio
reintento ante `UNKNOWN`), sigue sin poder, y sale **exit 2** fail-closed. **El script se comporta
bien; el fixture quedó viejo.** Atribuir ese rojo al script habría mandado a buscar un bug inexistente
—el mismo costo que §C— y por eso la atribución se midió antes de reportarla.

**Un stub que contesta lo mismo a toda invocación no es un doble: es un comodín.** Mientras el script
pregunta una sola cosa, no se nota. En cuanto aprende a preguntar otra, el comodín responde con la
respuesta vieja y el fallo aparece del lado del script.

### Su feature nueva **sí** funciona, probada contra datos vivos

La versión de #772 se extrajo a un scratchpad (sin tocar su worktree) y se corrió con el `gh` **real**
contra tres PR con esperados distintos:

| PR | estado real | salida | exit | esperado |
|---|---|---|---|---|
| **#776** | CI 6/6 `pass` pero **CONFLICTING** | «el CI pasó, pero el PR tiene CONFLICTOS (CONFLICTING/DIRTY) — resolvé el merge, no busques un bug» | **4** | 4 ✅ |
| **#772** | `lint` FAILURE real | «hay al menos un job ausente o fallado» | 1 | 1 ✅ |
| **#770** | CI `IN_PROGRESS` | «ausente o fallado» | 1 | — (ver abajo) |

**El control positivo del `exit 4` sólo existe fuera del CI:** el stub no puede fabricar un
`CONFLICTING`, así que ese camino únicamente se ejercita contra un PR realmente conflictivo. Hoy #776
es ese PR. Un gate cuyo caso nuevo no es alcanzable por su propio fixture depende de que alguien lo
corra a mano — y eso no sobrevive a una semana.

### §C sigue vivo, y se midió en el minuto

Corriendo la versión de #772 contra #770 **mientras su CI estaba `IN_PROGRESS`**: cuatro renglones
«está CORRIENDO, no pasó» y después «ROJO — no mergear: hay al menos un job ausente o fallado», con
`exit 1`. Así que **#772 no cubre §C** (queda para `plan/ci-verde-distingue-sin-medir-de-rojo`): el
detalle dice CORRIENDO, el veredicto ofrece dos causas que no son ésa, y el código sale por la familia
«ROJO medido» en vez de «no pude medir».

### Estado del tronco al reanudar, medido del rollup y no del badge

`origin/main` seguía en `148f9639` del 30/09 — **cero merges en cinco días** con 8 PR abiertos: 7
`MERGEABLE` + #776 `CONFLICTING`; CI 6/6 en #773, #774, #775, #776 y #777; #772 en rojo por el stub;
#771 verde. **Seis PR listos y el cuello de botella no es el código.**

Y un recibo que venció mientras se medía: el rollup de #770 daba `pass:6` a las ~10:50 sobre
`5344b393`; a las 10:55:55Z su head pasó a `a8d73c51` con el CI corriendo de nuevo. Un recibo vale
para **un** SHA, y el merge toma el HEAD remoto.
