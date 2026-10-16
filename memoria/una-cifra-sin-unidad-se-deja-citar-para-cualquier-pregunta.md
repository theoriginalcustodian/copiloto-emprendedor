---
name: una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta
description: Tres cifras del mismo criterio circulando a la vez; ganó la más alta y la única sin calificador. Cuando el instrumento cambia de unidad, la cifra vieja no envejece: pasa a medir otra magnitud.
metadata:
  type: feedback
---

**Medido el 2026-10-05.** Del mismo criterio circulaban **tres cifras a la vez**: el tablero citaba
«**54 de 54 (100%)**», el índice de memoria «53 de 54, falta `(home)`», y el instrumento publicaba
«**web 50 de 54 (92%) · mobile 13 de 54 · indeterminada 4**». La que más circulaba era **la más alta
y la única sin calificador**.

**Ninguna estaba «mal».** El `54 de 54` se midió el 30/09 con el instrumento de ese día, que todavía
no separaba plataforma ni filtraba por vocabulario cerrado. O sea: **no es una cifra vieja, es una
cifra de otra magnitud**. Reemplazar una por otra, o compararlas, es un error de categoría — y
«actualizar» la vieja con la nueva esconde que respondían preguntas distintas.

**El daño concreto, que es lo que lo saca de la estética:** ese `54 de 54` sostuvo la afirmación «el
criterio 3 ya no es el motivo por el que el Cierre A no cierra» frente a un criterio del acta que
exige el veredicto ✅ en **web y mobile** para los 54 ids. Con mobile en **13 de 54**, eso sigue en
❌. La cifra no mentía sobre web; mentía por omisión sobre la pregunta que se le estaba haciendo.

**Y la atribución correcta de la culpa importa para el fix.** Otra sesión citó mi cifra fuera de
contexto y se retractó. Pero la causa no fue su cita: **fue que mi cifra no declaraba su unidad.**
Una cifra sin unidad *invita* a esa cita — cualquiera puede usarla para cualquier pregunta de buena
fe, porque nada en ella dice a qué responde.

**Lo que el instrumento ya hacía bien y hay que copiar:** imprime la unidad **en la misma línea que el
número** —«ids únicos de los 54 con veredicto DEL VOCABULARIO CERRADO, **POR PLATAFORMA**»— y marca
explícitamente cuál se cita este sprint («el criterio 3 acotado a web»). El instrumento era más
honesto que su propia cita.

**La regla:** toda cifra en el tablero o en el índice lleva **unidad + fecha + instrumento**; sin eso
no se cita en un veredicto de cierre. Y cuando un instrumento cambia de unidad, las cifras anteriores
no se actualizan: se **marcan** con la unidad que tenían.

## Refuerzo 2026-10-12 — la resta entre dos COMANDOS que parecen medir lo mismo

La entrada de arriba es sobre una cifra que **envejece de magnitud**. Esta variante es peor porque
nace mal: **dos comandos distintos, corridos el mismo día, restados entre sí.**

Midiendo cuántas entradas de memoria eran invisibles en un checkout atrasado, escribí **37**:

```
ls memoria/*.md | wc -l                                    → 366   (sólo el nivel RAÍZ)
git ls-tree -r origin/main -- memoria | grep -c '\.md$'    → 403   (RECURSIVO)
```

`memoria/` tiene dos subdirectorios (`checkpoints/`, `Ideas de implementacion/`). Con la **misma**
unidad en los dos árboles: **308 vs 404 = 96**. Mi cifra subestimaba el efecto **2,6×**.

**Por qué no salta a la vista:** las dos cifras responden a la frase «archivos `.md` de `memoria/`».
Ninguna es falsa. Lo falso es **la resta**, y una resta no tiene unidad visible — hereda la de sus
términos sin avisar que eran dos. La regla de arriba («unidad + fecha + instrumento») se cumplía por
separado en cada término y **no** alcanzó: faltaba la regla del **par**.

**Y el contexto que lo hace útil:** la cometí en la evidencia de un `pedido_` cuyo tema **era**
instrumentos que miden mal. Tener el defecto en la cabeza no protege de cometerlo en la propia
evidencia — hermano de [[el-fix-de-razonamiento-no-viaja-con-el-codigo-copiado]] y del corolario de
[[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]].

**How to apply:** toda comparación de dos cifras se corre con **un solo comando parametrizado por el
sujeto**, nunca con dos comandos distintos:

```bash
for ref in "$RANCIO" origin/main; do
  printf '%s: %s
' "$ref" "$(git ls-tree -r --name-only "$ref" -- memoria | grep -c '\.md$')"
done
```

Si no se puede unificar el comando, la resta **no se publica**: se publican los dos números con su
comando al lado y se dice que no son comparables. Y el control que lo caza en un segundo: **el total
conocido**. Acá `ls` daba 391 en el árbol al día y `find` 404 — una discrepancia de 13 sobre el
*mismo* árbol, que es la señal de que los comandos no miden lo mismo, disponible **antes** de restar
nada.

Relacionadas: [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]] ·
[[un-orden-de-magnitud-que-coincide-no-confirma-la-causa]] ·
[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]] ·
[[un-contrato-define-que-declarar-no-asigna-anclas-que-no-medi]].

### Refuerzo (2026-10-14): un veredicto sobre `main` sin su ref en el TITULAR no vence nunca

frontend2 bajó un `dato_` titulado **«`avisoAlChat` y `onAviso` NO están en `main`: son un comentario
y un substring»**. Dos horas después yo medí lo contrario —definición en `PantallaMiDia.tsx:325`,
cableado en `:601`, call-site en `PantallaPrincipal.tsx:236`— y por un momento pareció que uno de los
dos había medido mal.

**Ninguno.** Su cuerpo decía «medido contra `origin/main` `b1a9a22c`» y era exacto contra ese ref;
entre las dos mediciones entraron #1138 (`974355ff`) y #1140 (`eec1498d`), y el puente llegó. Lo
curioso: #1140 era **de ella**. Su propio trabajo invalidó su propio `dato_` en dos horas.

La trampa no fue la medición, fue **dónde vive el ref**: el cuerpo lo citaba, el **nombre del archivo
no**. Y en un buzón lo que circula es el nombre — igual que
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]. Un titular en presente sobre un
repo que avanza («X NO está en main») se lee como estado vigente cada vez que alguien lo encuentra,
mientras el SHA que lo acotaba queda enterrado adentro.

→ **Un veredicto sobre una rama viva lleva su ref en el titular, no sólo en el cuerpo.** Y al leer
uno ajeno que contradice tu medición, el primer chequeo no es «quién se equivocó» sino **¿contra qué
ref midió cada uno?** — ver [[el-instrumento-respondio-sobre-otro-sujeto]]. Dos verdades sobre
sujetos distintos no se refutan: se fechan.

---

## Refuerzo 2026-10-14 — una LISTA sin el estado de cada ítem se lee entera en el estado más alarmante

La entrada trata de una **cifra** sin unidad. La misma falla aplica a una **lista**, y es peor porque cada
renglón parece un dato completo.

Corrí `mi-buzon.sh planificacion --todo` —como el cron prescribe, para no perder los `avance_` que nacen
archivados— y leí sus **24 renglones** como «lo que tengo sin resolver». Sólo **5** estaban en `abierto/`:
los otros 19 vivían en `cerrado/2026-10-14/`. El flag lo dice en el propio docstring del script
(`mi-buzon.sh:12`: *«`--todo` incluye `en-curso/` y `cerrado/<hoy>/`»*) y aun así lo leí mal, porque la
**salida no marca la ubicación de cada ítem**: 24 nombres de archivo, todos con la misma forma.

**Cómo me enteré, y es la parte útil:** archivé 4 de esos hallazgos y volví a correr el instrumento — **los
4 seguían listados**. Ahí el modelo se rompió. Sin ese control accidental, habría cerrado el ciclo
afirmando «quedan 7 hallazgos+urgentes dirigidos a mí» cuando eran 2. El control correcto, que debí correr
primero, es trivial: por cada nombre de la salida, `dirname` del `find` — y eso **se puede pedir al
instrumento**, no reconstruir a mano.

**La regla:** cuando un instrumento devuelve una lista de ítems que pueden estar en **estados distintos**,
el estado va **en cada renglón** o la lista no es medición. Un listado homogéneo de cosas heterogéneas
induce el estado por el **contexto de la pregunta** —yo pregunté «¿qué me queda?» y leí 24 pendientes— y
el sesgo siempre empuja al estado más alarmante, porque ése es el que justifica el trabajo que uno ya
quería hacer.

**Corolario sobre el flag:** `--todo` es el flag correcto para ese cron (sin él se pierden los `avance_`),
así que el arreglo **no** es dejar de usarlo. Es que la salida distinga. Un flag que amplía el universo sin
etiquetar lo que agrega convierte una mejora de cobertura en una pérdida de precisión.

→ [[el-instrumento-respondio-sobre-otro-sujeto]] · [[una-fila-por-valor-de-una-variable-no-es-una-fila]] · [[instrumento-que-no-mira-nunca-falla]]

## Refuerzo 2026-10-15 — la unidad que faltaba era el ARBOL, y la etiqueta existia a 76 renglones de la cifra

**Medido hoy, 2026-10-15.** Las tres sesiones citaron **«46 de 54, faltan 8»** durante horas como el
estado del sprint. Con el **mismo script** y **una sola variable movida** —el arbol donde se lo
corre— `origin/main` daba **52 de 54, faltan 2** (`reveal` `soporte`). Los otros seis ya estaban
mergeados.

**La unidad que faltaba no era la plataforma: era el arbol.** `RAIZ` sale de
`git rev-parse --show-toplevel` (linea 79 de `medir-mapeo-implementacion.py`), o sea **el arbol desde
donde lo ejecutas**, y el checkout compartido —el `cwd` por defecto de las tres sesiones— esta **106
commits atras**. Ninguna cifra era falsa: median arboles distintos y ninguna lo decia.

**Y acá esta el golpe, porque es contra el texto de arriba.** Este mismo archivo ya traia la receta
escrita: *«Lo que el instrumento ya hacia bien y hay que copiar: imprime la unidad en la misma linea
que el numero»*. El instrumento la aplico a la plataforma (web/mobile) y **al arbol no**: para el
arbol imprimia una etiqueta `ARBOL MEDIDO` en la **linea 1 de 77**, mientras las cifras salen en las
**70-77**. La regla estaba; el caso que faltaba no estaba cubierto por ella.

**Por qué una etiqueta que EXISTE no alcanza:**

- **El resumen se lee con `tail`.** `tail -5` fue literalmente el comando de la verificacion, y es el
  mismo corte que borraba la etiqueta. Una etiqueta **a 76 renglones** de la cifra que etiqueta no
  esta puesta: esta **archivada**.
- **Decia *donde*, no *cuan atras*.** Una ruta (`C:/Proyectos/.../copiloto-emprendedor`) no le dice
  nada a nadie sobre si ese arbol esta al dia. `+106 comm DETRAS de origin/main 7450e2f4` si.
- **Y el `grep` no la rescata**, porque nadie grepea una etiqueta que no sabe que existe.

**El fix de raiz, y por qué NO es un gate.** `_procedencia()` va pegada a los **tres renglones que
varian** — `  @origin/main 7450e2f4` o `  @arbol +106 comm DETRAS de origin/main 7450e2f4`. No falla
y no bloquea, igual que el `corpus_divergente()` que ya vivia en ese mismo archivo y lo declara «A
PROPOSITO»: trabajar sobre un arbol atrasado **es legitimo** (es exactamente lo que hace una sesion
que todavia no rebaseo), lo ilegitimo es que la cifra salga sin decirlo. Un guard que grita en el
caso normal se desarma solo → [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]].

**El test que lo caza la proxima:** no «¿declara su unidad?» sino **«¿la declara en el renglon que
alguien va a copiar y pegar?»**. Si la etiqueta y la cifra se pueden separar con un `tail`, un
`| grep`, un copy-paste de una linea o una captura de pantalla, **estan separadas ya**.

Relacionado: [[el-instrumento-versionado-difiere-por-rama]] (ahi la variable era el *script*, aca el
*arbol* — la medicion honesta fija una y mueve la otra) · [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]
· [[la-cita-de-procedencia-muere-en-el-merge]] · [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].

## Refuerzo 2026-10-16 — «el gate tardaba 23 min»: la unidad que falta es la PLATAFORMA

Arreglé el gate de lint en dos iteraciones y reporté **«1399 s → ~12 min»**. La cifra es cierta y el
sujeto estaba nombrado en el commit (`scripts/ci/lint.sh`, corrido a mano), pero le falta la unidad
que más importa: **en qué plataforma**. Medido después de mergear, sobre el job `lint` de GitHub
Actions en los PRs previos a cualquiera de los dos fixes:

```
ANTES   #1270 2m04s · #1272 2m18s · #1273 2m24s · #1271 2m47s · #1269 2m53s
DESPUES #1289 2m52s · #1291 2m37s
```

**En CI el lint nunca tardó 23 minutos**, y mis dos fixes no lo movieron fuera de esa varianza. Los
1399 s son del gate **local en Windows**, que es otro sujeto con otra física: el fork cuesta ~15-20 ms
(≈1 ms en Linux) y `psycopg2.connect(None)` tarda **4,07 s** (en Linux falla al instante, por socket
unix). Las dos causas que encontré son reales y el trabajo rinde donde se paga —el `pre-push` corre
esto en cada push y los crones corren `vigilancia-check` cada 3 min—, pero **«el gate tardaba 23 min»
se va a citar para responder «¿por qué tarda el CI?», y para esa pregunta es falso**.

**La regla, afilada:** una cifra de rendimiento necesita la plataforma en la misma línea que el
número, no en el párrafo que la rodea. «El gate tardaba 23 min» y «el gate local en Windows tardaba
23 min; en CI Linux, 2 min siempre» son la misma medición y afirmaciones distintas — y la primera es
la que sobrevive al copiado.

**Lo que lo hubiera cazado antes de reportar:** medir el MISMO instrumento en las dos plataformas
antes de escribir la mejora, que acá costaba un `gh pr checks` de un PR viejo. La asimetría no era
sospechable desde la máquina: en Windows el síntoma era enorme y en Linux no existía.

### La cifra corregida, y por qué la que publiqué no era defendible

En el PR #1289 publiqué **«corpus 1313 → 650 s, −50,5%»**. No es defendible, y el defecto no es el
número: es el **instrumento**. Esa cifra sale de **una** corrida de `tests-coordinacion.sh`, y el
mismo corpus dio **650 / 752 / 677 s** en tres corridas del mismo día. Su dispersión (±50 s) es del
orden de la mejora que yo quería medir con él (108 s), así que una corrida no puede separar la señal
del ruido — y la que cité era, previsiblemente, la más favorable de las tres.

Lo que sí es citable son las **partes**, cada una medida más de una vez y con un control propio:

| | antes | ahora | control |
|---|---|---|---|
| `lint.sh` completo (el sujeto original) | 1399,9 s | **788,2 s (−43,7%)** | misma corrida a mano, mismo instrumento |
| `test-smoke-veredicto.sh` | 110,9 s | **2,3 s** | salida del smoke equivalente: 2 líneas de 44 |
| corrida del smoke bajo stub | 6,79 s | **0,12 s** | 3 corridas |
| `goal-barrido.sh` | 9,61 s | **0,45 s** | salida `--tsv` byte-idéntica |
| `vigilancia-check` (fixture / real) | 11,5 / 67 s | **1,6 / 18,9 s** | 2 corridas cada uno |

**La regla:** antes de publicar un porcentaje, medí la **varianza del instrumento** con el que lo
sacás. Si no corriste el medidor dos veces sobre el mismo sujeto, no sabés si tu mejora cabe dentro
de su ruido — y una sola corrida siempre produce un número que *parece* una medición. Donde la mejora
es grande frente al ruido (110,9 → 2,3 s) una corrida basta; donde es del tamaño del ruido, hay que
cambiar de sujeto: medir la parte que tocaste, o el total que de verdad importa.
