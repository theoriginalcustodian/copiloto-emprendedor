# Restar el merge-base no distingue «la rama escribió X» de «main reescribió X mejor»

**2026-10-07.** Clasifiqué 41 ramas `plan/*` con un criterio que ya restaba el merge-base —el fix del
falso positivo anterior, [[el-medidor-corrido-en-el-arbol-mezclado-acusa-al-repo]]— y quedaron 13 con
«WIP real». Adjudiqué **10 una por una**. Las **10 eran atraso.** Cero rescate.

El criterio de v4 es correcto y no alcanza:

    escrito_por_la_rama = lineas(rama:f)  -  lineas(merge_base:f)
    falta_en_main       = escrito_por_la_rama  -  lineas(main:f)

`falta_en_main` no vacío es **verdad**: la rama escribió esas líneas y `main` no las tiene. Lo que la
resta no puede ver es que `main` **reescribió la misma región después**, mejor, y lo que queda
pendiente es la **versión vieja** de ese mismo comentario, helper o caso de test.

## El único criterio que decidió: por FUNCIÓN, no por línea

La pregunta que resolvió los 10 casos no fue *«¿main tiene esta línea?»* sino **«¿main tiene este
MECANISMO, aunque con otro texto?»** — un grep del mecanismo. Las 10 veces: sí, y mejor.

| la rama aportaba | lo que tenía `main` |
|---|---|
| `cola-check.sh` reconoce `⏸` (congelado) | lo reconoce **y además** `🚦` — un estado más |
| `escaladores-buzon.sh` retira los `urgente_` con un glob literal | lo retira con el glob **parametrizado** (`URGENTE_ST_INFIJO`) |
| `medir-indice-memoria.py` avisa en el borde del presupuesto | avisa **y** mide bytes *y* chars |
| `dup-indice-check.py` rutea la excepción a exit 2 | mismo guard, ya cableado en `main_protegido()` |
| `test-a-todos-sin-cierre.sh` cierra con 9 casos | cierra con **10** |
| `test-mergear-pr…` stubea `gh` con un heredoc | stub **parametrizado por env**; su comentario dice que la versión del heredoc **corría el `gh` real** |
| `ci-verde.sh` dedup del rollup | el mismo `group_by/max_by`, más la nota de que el umbral envejeció |

En seis de los siete la línea pendiente era **un comentario** que `main` ya había reformulado. En uno
era peor que eso: la rama agregaba un `CERRADO=` que **duplicaba** uno existente dos líneas abajo.
**Rescatar esa línea habría metido un defecto.**

## La trampa del substring, que se cruzó en el medio

Para decidir una entrada de diccionario busqué su clave en `main` con `in` y me dio **presente**.
La comparación por **conjunto de claves exactas** decía que **faltaba**. Las dos eran ciertas: `main`
tiene la clave **más corta**, que es **prefijo** de la de la rama. Si hubiera parado en el substring,
descartaba por una coincidencia que no era la misma entrada. Y la que decidió no fue ninguna de las
dos: fue **leer cómo hace el lookup** (`p.name == k or p.name.startswith(k)`, admite prefijo) ⇒ la
clave corta sí cubre el documento largo. [[el-contrato-afirma-el-mecanismo-que-no-opero]]

## Y el control que cerró el caso: medir el EFECTO, no la presencia

La última candidata a rescate era una entrada que `main` no tenía **de ninguna forma**. Antes de
insertarla corrí el instrumento en `main` para ver si el documento aparecía como huérfano: **no
aparecía.** La entrada no cambiaba nada medible ⇒ atraso también. *Una línea ausente no es trabajo
pendiente hasta que mostrás el efecto de su ausencia.* El mismo control destapó, en cambio, **un
huérfano real y vivo de ese día** que no venía de ninguna rama.

## Qué quedó cableado, y lo que el cable NO cubre

`scripts/clasificar-ramas-wip.py` tiene un tercer veredicto **`WIP?`** (lo pendiente es < 10% de lo
escrito ⇒ probable reescritura), imprime **las líneas pendientes** en vez de una muestra, y trae el
**canario F** —rama vieja que toma el archivo de `main` y le suma una línea propia ⇒ debe dar `WIP?`—
como control positivo, con el canario A (ratio 1.0 ⇒ `WIP`) como negativo.

⚠️ **El flag no reemplaza la lectura, y el propio corpus lo demuestra:** dos de las 10 ramas de atraso
tenían ratio **21% y 37%**, muy por encima del umbral, así que salen `WIP`. Un umbral calibrado al
corpus de un día no puede ser un freno ([[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]]);
sí puede pedir lectura. **`WIP?` dice «leé esto primero»; `WIP` no dice «rescatá».**

**Cómo aplicarlo:** antes de rescatar una rama vieja, por cada archivo preguntá *¿existe el mecanismo
en `main`?* y recién después *¿existe esta línea?*. Si `main` tiene **más** líneas que la rama en ese
archivo, empezá asumiendo reescritura. Y si lo que vas a traer es prosa —comentarios, docstrings,
descripciones— el default es descartar: la prosa es lo primero que se reescribe y lo último que se
nota.

Relacionado: [[el-medidor-corrido-en-el-arbol-mezclado-acusa-al-repo]] ·
[[el-fix-ya-existe-en-otro-call-site]] · [[instrumento-que-no-mira-nunca-falla]]
