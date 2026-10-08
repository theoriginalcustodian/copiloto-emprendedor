---
name: medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero
description: Medir contra un ref equivocado falla en CUATRO modos — omite (el vacío se lee como 0), inventa (el squash deja la distancia alta para siempre) y ECOA el argumento (rev-parse devuelve lo que le pasaste y cut lo disfraza de hash), y NUNCA TUVO UN REF (el else de un guard de existencia asigna prosa y el pipe se come el rc, asi que un ref basura imprime el mismo '0 archivos' que un delta vacio legitimo); el control es el EFECTO más el rc de cada consulta.
metadata:
  type: feedback
---

**2026-09-29, reconstruyendo el estado después de que un corte de créditos matara las sesiones.** Dos
mediciones del mismo hecho —«¿qué trabajo quedó sólo en disco?»— dieron resultados opuestos, y **las
dos estaban mal por la misma raíz: comparar contra una referencia que no era la que respondía la
pregunta.**

| quién | midió | dijo | era |
|---|---|---|---|
| backend | `git rev-list --count origin/<rama>..HEAD` | **0 sin pushear** | **7 ramas** que no existían en el remoto |
| yo | `git rev-list --count origin/main..HEAD` | **13 commits en riesgo** | **0** — ya estaban en `main` por squash |

## Por qué ninguno de los dos falla ruidosamente

**El de backend omite.** Si `origin/<rama>` **no existe**, `git rev-list` no imprime nada. Ese vacío,
metido en `$(...)` y leído como número, **es `0`** — y `0` en esa columna significa «no hay nada sin
pushear». O sea **«no puedo ver» se imprimió como «no hay»**, que es exactamente
[[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]] en versión git. Y el caso en que la
rama nunca se pusheó —el único que el barrido existe para cazar— es **precisamente** el caso en que
el ref no existe: el instrumento es ciego justo donde tiene que ver.

**El mío inventa.** Con **squash-merge**, los commits de la rama **nunca** entran a `main` por hash.
`origin/main..HEAD` los sigue contando para siempre, aunque su contenido esté mergeado hace una
semana. Una rama cerrada y una rama nunca pusheada se ven **idénticas** con esa medida.

## El control que cierra los dos, y es uno solo

No es «usar el otro ref»: es **dejar de preguntarle a un ref y preguntar por el EFECTO**.

```bash
git ls-remote origin "refs/heads/$rama"        # ¿existe allá? (no: ¿tengo yo una copia del ref?)
git cat-file -e "origin/main:$artefacto"       # ¿el efecto está en main? (no: ¿está el commit?)
git merge-base --is-ancestor HEAD origin/main
```

`ls-remote` **habla con el remoto**; `origin/<rama>` es una copia local que puede no existir por no
haberse traído nunca. Y el artefacto en `origin/main` responde «¿esto ya llegó?» sin depender de
cómo se mergeó.

> **La pregunta que separa las dos familias:** *¿mi medición interroga al sistema, o a mi copia de lo
> que creo del sistema?* Es el mismo eje que [[el-instrumento-respondio-sobre-otro-sujeto]].

## Y el corolario que más cuesta ver

Mi falso positivo apareció **mientras le señalaba a backend el suyo**, con el mismo tipo de error, en
el mismo turno. Saber que existe la clase no te saca de ella: lo que me sacó fue **correr el control
de efecto sobre mi propio resultado antes de reportarlo**, no la advertencia que acababa de escribir.

El caso espejo —dos errores opuestos que **se cancelan** y el total confirma— está en
[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]]. Acá
divergieron y ninguno de los dos totales servía; allá coincidieron y el total mentía. Misma familia:
**un número no dice contra qué se midió.**

## Tercer modo, y es PEOR que el vacío: `rev-parse` **ecoa el argumento** en vez de callarse

**2026-09-30, verificando por blob que un squash-merge preservó mi contenido.** El método era
`git rev-parse "<ref>:<path>"` en dos commits y comparar. Sobre un path que **no existía** en ese ref:

```bash
$ b=$(git rev-parse "e04cfcbe:scripts/evidencia/test-vigencia-canario.sh" 2>/dev/null | cut -c1-8)
$ echo "$b"
e04cfcbe          # ← NO es un blob: es el argumento ecoado, recortado a 8 chars
```

`git rev-parse` no resuelve y **devuelve lo que le pasaste**. Pasado por `cut -c1-8` sale
`e04cfcbe`: largo de hash, forma de hash, **y coincide con el commit que nombré en la consulta**. El
guard de este archivo —«¿puede este `0` significar *no medí*?»— **no dispara**, porque no hay ningún
cero: hay un valor que parece una medición.

**Cómo se ve el daño:** ese valor era el **control negativo** de mi verificación. Salió «distinto» del
otro blob, o sea el control dijo *el método discrimina*… por la razón equivocada. Un control negativo
que pasa por accidente deja los ✅ de al lado sin respaldo — y yo ya tenía 6 ✅ escritos
([[un-guard-que-acierta-por-accidente-no-da-sintoma]]).

**Lo que lo cazó:** que el valor **coincidiera con el nombre del commit**. No fue rigor: fue que el
eco era visible porque el argumento empezaba con un hash. Si el path hubiera estado consultado con un
ref simbólico (`origin/main:...`), el eco habría sido `origin/m` y tampoco se habría distinguido de
un blob a simple vista.

**Y el contrato ya decía el comando correcto, en este mismo archivo, arriba:** `git cat-file -e
"<ref>:<path>"` — que **sale rc≠0 y no imprime nada**. Lo tenía escrito y medí con `rev-parse` igual.
Es [[vacio-no-es-hallazgo-correr-el-control]] en su forma más barata: leer el contrato propio antes de
elegir el comando.

**Control que cierra este modo:** capturar el rc de **cada** consulta y declarar `SIN MEDIR` si alguna
falla, en vez de comparar los dos valores.

```bash
a=$(git rev-parse "$r1:$p"); rca=$?
b=$(git rev-parse "$r2:$p"); rcb=$?
[ $rca -eq 0 ] && [ $rcb -eq 0 ] || { echo "SIN MEDIR: una consulta falló"; exit 2; }
```

Con eso corrido, el control negativo dio `eac365c3` vs `2dfa8ce5`, **dos rc=0** y distintos: el método
discrimina **y ahora se sabe por qué**.


## Cuarto modo, y lo cometí **en el turno siguiente** a escribir el punto (3) de acá arriba

**2026-09-30, midiendo si mi propio push ya podía pasar.** Los tres modos de arriba son variantes de
*un ref que no resuelve*. Este es peor, porque **no hay ningún ref**: la variable nunca tuvo uno.

```bash
MARC="C:/gfw-src/copiloto-grafo/.bridge/last-synced-copiloto-emprendedor.sha"   # ruta SUPUESTA
if [ -f "$MARC" ]; then ULT=$(cat "$MARC"); else ULT="(marcador NO esta en la ruta supuesta)"; fi
...
echo "delta: $(git diff --name-only "$ULT".."$MAIN" | wc -l) archivos"
```

El archivo no estaba ahí (vive en `graphify-graphity-bridge`, que el hook declara en su `L30`; yo lo
busqué en tres árboles y no incluí ese). Entonces `$ULT` quedó con **la prosa del `else`**, y esa prosa
entró como ref a un `git diff`. Salida:

```
delta que el incremental habria mandado: 0 archivos          <= es PROSA restada contra un commit
el marcador es ancestro de main? NO (divergente o invalido)  <= no es un veredicto: es "no pude medir"
```

Con la ruta correcta y los dos refs verificados, el número real era **7**.

**Son dos mecanismos compuestos, y cada uno ya tiene su propia entrada acá:**

1. **El `else` de un guard de existencia produce un dato.** Puse un mensaje de error donde el resto del
   script esperaba un SHA. El guard hizo su trabajo —detectó la ausencia— y en el mismo gesto **fabricó
   el valor que la hizo invisible**. Un `else` de un chequeo de existencia tiene que **cortar**
   (`exit 2`, «SIN MEDIR»), nunca asignar.
2. **El `| wc -l` se comió el rc.** `git diff` con un ref basura sale rc≠0, y el pipe devuelve el rc del
   `wc` ([[el-pipe-se-come-el-exit-code]]). Sin el pipe habría gritado.

Ninguno de los dos solo alcanza para el falso dato: **el primero fabrica el argumento y el segundo
silencia la queja.** Es [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] — el guard es correcto,
el conteo es correcto, y el hueco vive en el par.

**Y el mensaje del `else` eligió la lectura equivocada por mí:** «NO (divergente o invalido)» ofrece dos
causas —una grave, una de instrumento— y yo leí la grave
([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]). El texto que escribí para
cubrirme fue el que me desvió.

**La forma que lo cierra**, corrida en el mismo turno:

```bash
[ -f "$MARC" ] || { echo "SIN MEDIR: el marcador no esta en la ruta declarada"; exit 2; }
ULT=$(tr -d ' \r\n' < "$MARC")
git cat-file -e "${ULT}^{commit}" 2>/dev/null || { echo "SIN MEDIR: el marcador no es un commit"; exit 2; }
git cat-file -e "${MAIN}^{commit}" 2>/dev/null || { echo "SIN MEDIR: main no resolvio"; exit 2; }
n=$(git diff --name-only "$ULT".."$MAIN" | wc -l)      # recien ahora el numero significa algo
```

Y el **control positivo del método**, que es lo que faltaba las dos veces: pasarle a propósito un ref
inventado y exigir que se vea distinto de un delta vacío legítimo.

```
c1e91870          => ES commit (rc=0)
5330e0602ee4      => ES commit (rc=0)
texto-basura...   => NO es commit (rc!=0) · SIN MEDIR
git diff con el ref basura => "0 archivos"    <= identico a un delta vacio de verdad
```

**Esa última línea es el hallazgo entero:** un delta vacío legítimo y un ref inexistente imprimen **el
mismo texto**. Sin el rc, no hay forma de distinguirlos mirando la salida.

**Why:** porque un reporte de riesgo es lo que decide si alguien puede borrar un worktree. Un `0`
por ceguera hace perder trabajo real —acá había un `test(RATCH)` de aislamiento cross-tenant sólo en
disco—, y un «13 en riesgo» inventado gasta el turno de otra sesión en rescatar lo que ya está
guardado. Y un valor **ecoado** es peor que los dos: no activa ninguna sospecha, porque no se ve como
un vacío ni como un cero.

**How to apply:** ante cualquier barrido de «qué falta / qué está en riesgo», antes de reportar:
(1) preguntá si cada `0` puede significar «no medí» y no «no hay» — probá el caso que el barrido
existe para cazar y exigí que se vea; (2) para «¿ya llegó?», medí el EFECTO en `origin/main`, nunca
la distancia en commits, porque el squash la deja alta para siempre; (3) corré el control sobre tu
propio resultado **aunque acabes de escribir la advertencia** — el turno en que detectás la clase es
el turno en que más confiado estás; (4) **nunca leas un hash sin el rc de la consulta que lo produjo**
— `git rev-parse` ecoa el argumento cuando no resuelve, y `cut -c1-8` lo disfraza de blob; para
«¿existe este path en este ref?» usá `git cat-file -e`, que no imprime nada y sale rc≠0. **(5)** el `else` de un chequeo de existencia **corta** (`exit 2`, «SIN MEDIR»), nunca asigna: un mensaje de error guardado en una variable se convierte en el argumento de la medición siguiente, y el `| wc -l` se come la queja. Y el control positivo del barrido es pasarle **a propósito** un ref inventado: si su salida no se distingue de un resultado vacío legítimo, el barrido no está midiendo.

---

## Refuerzo (2026-09-30): imprimir la DISTRIBUCIÓN en vez del agregado es lo que lo caza

Mismo defecto, en un parser propio de quince líneas, y el detalle que lo salvó es replicable.

Estaba desglosando 1404 aristas de un `zombies.json` por tipo de relación:

```python
c = collections.Counter(a.get("relacion") or a.get("tipo") or a.get("type") or "?" for a in ar)
...
print(f"  zombies co_change MEDIDOS: {c.get('CO_CHANGES_WITH', 0)}")   # -> 0
```

La clave real era **`name`**. Ninguno de los tres nombres que probé existía, así que las 1404 cayeron en
`"?"` y el `.get('CO_CHANGES_WITH', 0)` devolvió **0**. Mi aritmética siguió adelante sola e imprimió
*«el medido (0) no es 1404 ni 1400: la diferencia es 1404, no 4 → ninguna hipótesis cuadra»* — una
conclusión entera, con su razonamiento, **fabricada por la clave equivocada**.

**Lo cacé porque imprimí el Counter crudo al lado:** `{'?': 1404}`. Ese `?` es imposible de leer como
un resultado. Si hubiera impreso sólo el número agregado —que es lo natural cuando lo que querés es la
cifra— el `0` se lee como un dato y la conclusión sale publicada.

**Why:** porque el `or "?"` fue *mi* red de seguridad, puesta para que nada explotara, y por eso mismo
convirtió un fallo de lectura en un valor plausible. El `.get(clave, 0)` hace lo mismo un paso después:
**los dos defaults defensivos, encadenados, transforman «no sé leer esto» en «medí cero»**. Y cero es
un número con el que se puede razonar.

**How to apply:** (1) todo agregado se imprime **con su distribución al lado** — un `{'?': N}` o un
`{None: N}` salta a la vista y un `0` no; (2) antes de contar por un campo, imprimí las **claves reales
de un elemento** (`sorted(items[0].keys())`), que cuesta una línea; (3) desconfiá del `or` de fallback en
un extractor: hace que la ausencia se vea como una categoría; (4) si el denominador de tu conteo no
coincide con el total conocido, el parser miente antes que los datos — acá 1404 objetos, 1404 en `?`, y
el total correcto estaba impreso por el propio dry-run treinta líneas más arriba.

---

## Refuerzo 2026-10-05 · una lista FIJA de delimitadores hace que el cuerpo salga vacío, y el clasificador premia el vacío

Barriendo los 48 tests del repo para contar «stubs comodín» (dobles de un comando que contestan lo
mismo a toda invocación), extraje el cuerpo de cada heredoc con una lista **fija** de terminadores
—`STUB|FAKE|SH|EOF`—. El repo también usa `MUERE`, `SHIM` y `NPX`: para **4 de 6** el cuerpo salió
**vacío**. Y el clasificador preguntaba *¿este cuerpo despacha por `$1`?* — un cuerpo vacío **no
despacha**, así que los clasificó como el defecto que estaba buscando. Reporté «6 comodines» y había 5,
en otro reparto: dos de los que acusé estaban **sanos**, y uno que contaba como uno eran **cuatro**.

**Lo que lo vuelve de esta familia y no de otra:** no es que el dato faltara, es que la **ausencia de
dato satisface el predicado**. `vacío` → «no encuentro la marca de sano» → «es el caso malo». El
instrumento no distingue *medí y no está* de *no pude medir*, exactamente como un ref inexistente que
devuelve vacío y se parsea como `0`.

**How to apply (se suma a las de arriba):**
- **Si el extractor usa una lista fija de tokens, el corpus la va a desbordar.** Leé el token del propio
  dato (acá: el delimitador está escrito en el `<<'DELIM'` de la misma línea), en vez de enumerar los
  que conocés hoy — es un caso de [[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]] aplicado a
  un parser.
- **Todo clasificador binario necesita un tercer veredicto: NO MEDIDA.** Si el predicado de «malo» es
  la negación del de «bueno», el vacío cae siempre del lado malo. Con la tercera clase, el vacío se
  vuelve visible y contable (acá: «no medida: 0» es parte del reporte).
- **El denominador por elemento, no sólo por archivo:** la v1 contaba suites; la v2 contó **dobles**, y
  ahí apareció que una sola suite tenía 4. Un archivo con N instancias del defecto cuenta como N.

## Refuerzo 2026-10-08 — `A..B` EXCLUYE A, y la base natural es justo donde vive el fix

Declaré en el doc del operador: *«medido sobre `origin/main` (ventana `e6144ab7`..`2cd29750`)»*, y de ahí
salió el veredicto de que la fila `H-A7SINTEST` seguía **sin dueño y sin tomar**: `git log --grep` daba
**0 commits** citando el id.

**El 0 era real y el veredicto era falso.** Medido hoy:

| control | resultado |
|---|---|
| `git log --grep=H-A7SINTEST e6144ab7..2cd29750` | **0** |
| `git log --grep=H-A7SINTEST e6144ab7~1..2cd29750` | **1** |
| commits en `e6144ab7..2cd29750` | **1** |
| commits en `e6144ab7~1..2cd29750` | **2** |

El commit que faltaba era **`e6144ab7` mismo**: `fix(H-A7SINTEST): TOOL_INDEX nunca ejercitado contra
Drive, ahora con control positivo (#940)`. Citaba mi id **en el asunto**, traía el test **y su control
positivo**, y estaba cableado al gate (`scripts/ci/backend.sh:33`) con el job `backend` de `main` en
SUCCESS. Es decir: el trabajo estaba hecho, firmado con mi propio id, y mi instrumento no lo vio.

> **`A..B` es «lo alcanzable desde B, menos lo alcanzable desde A», y A queda AFUERA.** Eso es
> conocido. Lo que lo vuelve una trampa es **cómo se elige A**: uno pone como base *el commit más
> reciente que ya conocía* — el último que leyó, el que cerró la ronda anterior, el que aparece en el
> handoff. Y ese es, por construcción, **el más probable candidato a contener el trabajo recién hecho**.
> La forma de elegir la base concentra el punto ciego exactamente donde está la novedad.

**Y la señal no se distingue de la verdad.** «0 commits citan el id» se lee como «nadie la tomó», que
es un estado perfectamente normal de una fila diferida. No hay nada raro que mirar: ni un error, ni un
vacío sospechoso, ni un path que no resuelve. **La mitad de mi ventana no existía y el reporte salió
sin un solo síntoma.**

**El control, y es de una línea:** correr el rango con `A~1..B` **al lado** del `A..B` y comparar el
conteo. Si difieren, la pregunta pasa a ser cuál de los dos es el denominador que querías — y la
respuesta casi siempre es `A~1..B`, porque lo que uno quiere decir es «desde A, incluido». Un control
más fuerte, cuando hay un id en juego: grepear el id **sin rango** (`git log --grep=<id> origin/main`)
y después acotar. Un hit global que desaparece al acotar es el defecto del rango, no la ausencia del
trabajo.

**La lección que generaliza más allá de git:** toda afirmación de la forma «medí el intervalo X y no
encontré nada» tiene dos partes falsables, y yo venía verificando sólo una. Verificaba *que la búsqueda
estuviera bien hecha* (grep correcto, control positivo, id exacto) y daba por buena *la definición del
intervalo*. **El denominador también es una hipótesis.** Hermana de
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] y de
[[el-veredicto-no-dice-cuantas-veces-lo-miraron]]; y es la razón concreta por la que
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]] volvió a pasar hoy con la misma forma.
