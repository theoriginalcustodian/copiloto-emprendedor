---
name: dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una
description: gitleaks devuelve rc=1 tanto si encontró un secreto como si no pudo cargar su config. secretos-check.sh anuncia las dos cosas como «encontró posibles secretos», así que un escáner mal configurado se lee como una detección. Fail-closed pero mal diagnosticado, que es como se enseña a usar --no-verify.
metadata:
  type: feedback
---

# 🔀🏷️ Dos causas distintas comparten el código de salida, y el mensaje elige una

**LEER cuando un wrapper traduce el exit code de una herramienta externa a un mensaje para humanos** —
gates, linters, escáneres, healthchecks, deploys.

## Qué pasó (2026-09-22, test adversarial M-3 de la capa local de secretos)

El push abortó con:

```
[secretos] ❌ gitleaks encontró posibles secretos (ver arriba). Repo PÚBLICO: no lo pushees.
[pre-push] ❌ secretos-check falló: el push se aborta (repo PÚBLICO).
```

No había ningún secreto detectado. Dos líneas más arriba, en la misma salida:

```
FTL unable to load gitleaks config, err: open /c/gfw-src/_m3/aldia/.gitleaks.toml: The system cannot find the path specified.
```

gitleaks **ni escaneó**. No pudo cargar su config y murió. Medido con control positivo, los dos casos
son indistinguibles por código de salida:

| situación | rc |
|---|---|
| config inexistente | **1** |
| árbol limpio, config buena | 0 |

Y `secretos-check.sh` hace `case "$1" in 1) echo "gitleaks encontró posibles secretos"`. El `1` de
«no pude arrancar» entra por la misma rama que el `1` de «encontré algo».

## Por qué importa aunque sea fail-closed

El push **se aborta**, así que no hay fuga: en la dirección peligrosa el comportamiento es correcto.
El daño es de otro tipo y es real:

1. **Manda a buscar algo que no existe.** Quien lee «encontró posibles secretos» revisa su diff, no
   encuentra nada, y queda sin explicación.
2. **Enseña el bypass.** El hook documenta `git push --no-verify` para fallos transitorios. Un
   mensaje que miente sobre la causa empuja justo ahí — y `--no-verify` apaga **todo** el hook,
   incluido el escáner que sí funciona. Es [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]
   con un disfraz peor: no grita de más, **grita otra cosa**.
3. **Contamina cualquier medición que lo use.** Mis casos A y B «abortaron» y mi propia columna de
   atribución dijo `scanner:hallazgo`, porque grepeaba el mensaje del wrapper. Dos filas de un test
   adversarial quedaron invalidadas: no probaban detección, probaban una config rota.

## La causa de mi lado, que es la misma lección

Yo produje la config rota: exporté `MSYS_NO_PATHCONV=1` para que `git show '<sha>:<path>'` no
manglara paths, **el hook la heredó**, y gitleaks —binario Windows nativo— recibió `$ROOT` en formato
MSYS (`/c/gfw-src/...`). La variable que puse para no fabricar ceros fabricó un falso positivo.

Regla que sale de ahí: **una variable de entorno puesta para arreglar un comando se hereda a todos sus
hijos.** Si el hijo es un binario nativo y la variable gobierna la traducción de paths, la arreglaste
para uno y la rompiste para el otro. Va inline en el comando que la necesita, nunca exportada.

## Caso 2 (2026-09-28) — la TERCERA causa que comparte `rc=1`: **el sujeto todavía no existe**

Encadené `gh pr create` → `gh pr checks --watch` → `ci-verde.sh` → merge, para no quedarme mirando el
CI. Midió **8 segundos** después de crear el PR y salió `rc=1` con los seis jobs en «NO ESTÁ en el
rollup». Se lee **idéntico a un CI rojo**, y mi propio script imprimió «NO MERGEO (gate=1)».

**`gh pr checks --watch` no espera a que los checks EXISTAN.** Con el rollup vacío no espera: sale con
error. Los PR anteriores del día funcionaron por casualidad —creé el PR en una llamada aparte, así que
pasaron minutos antes del watch—. Re-medido un minuto después: **6/6 presentes**, 5 corriendo. El CI
estaba sano; lo que estaba mal era *cuándo* pregunté.

Así que al eje de este archivo se le suma una fila, y es la más traicionera porque no es un fallo de
nada:

| situación | rc |
|---|---|
| el gate encontró algo | 1 |
| el gate no pudo medir | 1 |
| **el sujeto todavía no se creó** | **1** |

**Y lo que lo cazó es exactamente el remedio que este archivo prescribe, funcionando.** `ci-verde.sh`
no traduce el código: imprime «⚠️ el rollup vino VACÍO: **no es que el CI falló, es que no estás
midiendo nada**» y cuenta los jobs presentes contra los esperados. Sin esa línea habría ido a buscar un
fallo inexistente en un PR de dos archivos de documentación. Vale decirlo completo: le abrí un hallazgo
a ese mismo script el mismo día (un número de PR inexistente sale `rc=1` en vez del `rc=2` que su
contrato reserva), y su control de rollup vacío es el que **a mi cadena le faltaba**. Un instrumento
con un hueco puede seguir siendo el que te salva.

**El remedio de la cadena:** antes de `--watch`, esperar a que el rollup tenga ≥1 fila. Un «esperá a
que termine» que no espera a que **empiece** no es una espera bloqueante: es una medición temprana con
cara de veredicto. Misma familia que
[[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]] — re-medí al **afirmar**, no al planear.

## How to apply

- **Al envolver una herramienta, no traduzcas el exit code: leé su salida.** Antes de anunciar
  «encontró X», buscá la marca de que *corrió* (`FTL`, `unable to load`, `error:`). Si no puede
  distinguir arrancar-y-no-encontrar de no-arrancar, el wrapper no puede afirmar ninguna de las dos.
- **Validá las precondiciones antes de invocar.** `[ -f "$CONFIG" ] || fatal "config ausente"` cuesta
  una línea y convierte un diagnóstico falso en uno cierto.
- **Un guard fail-closed todavía puede estar roto.** Que aborte no prueba que haya mirado. La pregunta
  no es «¿frenó?» sino «¿frenó **por lo que dice**?». Ver
  [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]].
- **En un test, la atribución no puede salir del mensaje del sujeto que estás midiendo.** Si mi
  columna hubiera leído la salida de gitleaks en vez del `echo` del wrapper, se cazaba sola.

Relacionado: [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] ·
[[dos-causas-suficientes-el-test-no-atribuye]] ·
[[clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo]] ·
[[instrumentos-que-confirman-en-vez-de-verificar]]

---

## Cara nueva (2026-09-30): el instrumento **detectó** su propia ceguera, la imprimió, y el veredicto eligió acusar igual

`ci-verde.sh 739` sobre un PR cuyo commit tenía **6 de 6 check-runs en `success`**:

```
❌ backend: NO ESTÁ en el rollup (no se encoló) — esto NO es 'pasó'      (×6 jobs)
--- CONTROL: 0 jobs presentes en el rollup, 6 esperados ---
⚠️  el rollup vino VACÍO: no es que el CI falló, es que no estás midiendo nada
ROJO — no mergear (falta o fallo algun job)
```

Lo notable no es el falso rojo: es que **el instrumento ya sabía**. Su control de denominador funcionó
perfecto y escribió la frase exacta — *«no es que el CI falló, es que no estás midiendo nada»* — y **la
línea siguiente, que es la que se lee y la que devuelve el exit code, unió las dos causas en `falta o
fallo`** y se quedó con la peor. Un aviso correcto tres líneas arriba del veredicto no cambia la decisión
de nadie: el que corre el gate lee la última línea y el que automatiza lee `$?`.

La causa medida, y no era la que parecía:

```
gh api repos/.../commits/3c418082/check-runs  -> total=6 · todos success
gh pr view 739 --json statusCheckRollup       -> length 0
```

Los check-runs **existían**; vacío estaba el campo que `ci-verde.sh:74` consulta. Un run disparado por
`workflow_dispatch` —el camino que el propio `tests.yml` documenta como «la única forma real de re-pedir
la corrida»— no entra en el `statusCheckRollup` del PR. O sea: **el remedio documentado produce una
medición que el gate no puede leer**, y los dos instrumentos son correctos por separado
([[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]]).

**Lo que agrega esta cara:** distinguir las causas **en el aviso no alcanza**. La distinción tiene que
llegar a las dos salidas que alguien consume: la última línea y el exit code. Mientras el veredicto
funda dos causas, tener el diagnóstico correcto adentro sólo documenta que el instrumento podía haber
acertado. Y **un vacío en el campo que consultás no es un vacío en el sistema**: antes de declarar,
preguntá si el dato existe en otra fuente ([[vacio-no-es-hallazgo-correr-el-control]]).

## Refuerzo (2026-09-30, mismo día, misma línea): **arreglar UNA causa del veredicto agregado no arregla las otras**

La cara de arriba se arregló: hoy `ci-verde.sh` distingue «rollup vacío» y sale **2**. Y la misma línea
sigue fundiendo otra causa. Corrí `ci-verde.sh 771` **dos minutos después de pushear** —el caso más
frecuente de todos, porque `MEMORY.md` manda correrlo antes de cada merge— y obtuve:

```
❌ backend: sin conclusión todavía (status=IN_PROGRESS) — está CORRIENDO, no pasó   (×5)
ROJO — no mergear: hay al menos un job ausente o fallado (medido, no supuesto)      exit 1
```

El detalle es **perfecto**: dice «está CORRIENDO». El veredicto ofrece dos causas —«ausente o
fallado»— y **CORRIENDO no es ninguna**. Y el código tampoco: el propio archivo reserva `exit 2` para
«no pude medir» y ya lo usa en cuatro rutas (`gh` ausente, sin argumento, rollup ilegible, `SIN
MEDIR`). *Todavía no terminó de medirse* pertenece a esa familia, no a `exit 1` = «rojo medido». La
distinción decide la acción: ante `2` se **reintenta en dos minutos**, ante `1` se **abre a investigar
un fallo inexistente**.

**Lo que agrega:** el veredicto agregado es un **cuello** por el que pasan N causas, y cada fix cubre
la que dolió. Después de arreglar una, las demás siguen ahí y el arreglo previo da falsa tranquilidad
—«esto ya se corrigió»—. Al tocar una línea de veredicto que funde causas, **enumerá todas las rutas
que terminan en ella** (acá: `grep -n 'falta=1'` da cuatro) y decidí el par (texto, código) para cada
una. Si no, se pagan de a una, y cada pago parece el último.

---

## Refuerzo 2026-10-05 · el `rc=1` de «no pude leer tu entrada» y el de «hay conflicto»

Medí qué PR abiertos conflictúan contra `main` con `git merge-tree --write-tree`, decidiendo por el
código de salida. Veredicto: **6 de 7 en CONFLICTO**. Falso, los 7 mergeaban limpio.

`gh` y `jq` en Windows emiten **CRLF**, así que el `` viajaba **dentro del sha** leído por
`while IFS=$'	' read`. `merge-tree` con un argumento que no resuelve contesta:

```
merge-tree: 4f7ca272b64d76bd872e3faea60205ed0096ddd4 - not something we can merge
rc=1
```

**El mismo `rc=1` que un `CONFLICT (content)` real.** El mensaje que separa las dos causas estaba en
la salida que mi script capturaba y no miraba.

Dos cosas que agrega este caso:

1. **El falso ROJO se disfraza de prudencia.** Un instrumento que inventa conflictos no se siente como
   un bug: se siente como rigor. Si lo hubiera publicado, cuatro sesiones rebasean ramas sanas — y el
   trabajo extra habría *confirmado* el instrumento, porque después del rebase el conflicto «ya no está».
2. **El fix de raíz es doble, y el cómodo es sólo la mitad.** `tr -d ''` en la fuente arregla hoy;
   lo que arregla mañana es **decidir el veredicto por el mensaje** y agregar la rama que faltaba:
   `SIN-OBJETO` para el sha que no tengo local. Un instrumento necesita un estado para «no pude
   medir este elemento» tanto como para «medí y está mal».

**La pregunta:** *¿este código de salida lo puede producir algo que no sea el defecto que busco?* Si
sí, el veredicto sale del mensaje, y el rc sólo decide si hubo que leerlo.

**REFUERZO 2026-10-07 — la forma más difícil de cazar: los únicos caminos que pueden reventar son los de ERROR, así que el instrumento está verde exactamente mientras no tiene nada que decir.** `scripts/ci/fetch-depth-check.py` imprime no-ASCII en `:93`, `:99`, `:107` (los tres «NO PUDE MEDIR») y `:123` (el hallazgo), y su **camino de ÉXITO (`:130`) es ASCII puro**. En Windows (cp1252, sin `reconfigure`) eso significa: pasa siempre que todo esté bien, y **crashea justo el día que encuentra algo** — con `exit 1`, que en ese script significa «encontré el defecto». El hallazgo real y el script muerto salen por la misma puerta, y los tres «no pude medir» salen por esa puerta también.

**La pregunta que lo caza en cualquier instrumento:** *¿qué líneas corren sólo cuando hay un hallazgo?* Esas son las que **nunca** se ejercitaron, porque el instrumento vivió en verde. No alcanza con correrlo: hay que **inyectar el caso** y ver el mensaje ([[el-canario-el-control-positivo-de-lo-que-falla-callado]]).

**Agravante medido en el mismo barrido:** ese checker **no está cableado a nada** — el único hit fuera de su propio archivo es un **comentario** en `tests.yml:142`. Un instrumento no invocado nunca ejercita sus ramas de error, así que el defecto puede vivir ahí para siempre: la falta de cableado **conserva** el defecto en vez de exponerlo ([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]).
