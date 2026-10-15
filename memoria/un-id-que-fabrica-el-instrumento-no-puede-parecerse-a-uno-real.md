---
name: un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real
description: Cuando un script normaliza una celda que no es un identificador, fabrica un id que no existe en la fuente. Si lo bautiza casi igual que un id real, el lector no puede saber cuál salió del documento y cuál del script — y no tiene forma de resolverlo sin preguntar
metadata:
  type: feedback
---

**El caso (2026-09-29, criterio 3).** La spec BL-P5 lista los 54 ids en una tabla, y su primera celda
no es un id: es `*(vacío)* Mi día` — la **home**, la pantalla Mi día cuando `?ver=` va sin valor. La
spec **sí la cuenta** dentro de los 54 (27 filas × 2 columnas = 54 celdas; §3 declara «54 ids»), así
que mi `criterio3-padron.sh` la normalizaba a un id sintético. **La bauticé `(vacio)`.**

En el mismo padrón existe `vacio` (BL-W5, spec `:43`), que es **otro id**: el estado vacío de Mi día.
Y también `vacio-visto` y `tablero`.

**Costo medido:** frontend2 tomó la fila de los 9 ids de su población, resolvió 8 y **frenó en el
noveno para preguntar**, porque no podía repartirlo con confianza. Un turno entero de otra sesión. Y su
razonamiento era correcto: las dos salidas disponibles eran malas — *medirlo dos veces por las dudas*
o *dejarlo sin ver por las dudas*.

## Por qué no se podía resolver leyendo

El lector tiene el padrón (salida del script) y la spec (fuente). En el padrón ve `(vacio)` y `vacio`.
**Nada en el texto dice cuál de los dos nombres es del documento y cuál lo inventó el script.** Para
saberlo hay que leer el `sed` de normalización — es decir, auditar el instrumento. Ningún lector
razonable hace eso antes de tomar una fila de trabajo.

## La regla

**Un identificador que el instrumento fabrica tiene que VERSE fabricado**, y no puede colisionar
visualmente con uno real. `(home)` se distingue; `(vacio)` con paréntesis junto a `vacio` sin
paréntesis no — los paréntesis leen como una convención de notación, no como «esto es sintético».

Y el comentario que explica el nombre va **en el script, en la línea que lo fabrica**, diciendo que el
string no sale de la fuente. El renombre sin la explicación deja al próximo lector con la misma duda en
otra forma.

## Lo que esto NO era

**El conteo estaba bien.** La tentación era leer «id fabricado» como «el padrón de 54 tiene un
fantasma y en realidad son 53». Medido: la spec cuenta la home dentro de los 54, y el control de
conteo daba 54 = 54 legítimamente. **Un defecto de nomenclatura no es un defecto de aritmética** — y
confundirlos habría tirado un entregable correcto. La medición separa las dos cosas; el reflejo, no.

Emparentado con [[el-nombre-es-una-hipotesis-sobre-el-contenido]] (el nombre no describe el contenido) y
con [[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]] (el mismo problema, del lado del
parser: un texto que no distingue roles no se arregla con más ingenio del extractor).

## Refuerzo 2026-10-15 — y el inverso: el id inventado ENTRA al corpus y se encuentra a sí mismo

Esta entrada decía «un id que fabrica el instrumento no puede parecerse a uno real». Hoy mordió
la cara B: **un id que NO se parece a ninguno real igual rompe, si el archivo que lo escribe vive
adentro del corpus que el instrumento busca.**

`existe-en-main.py` tenía un control negativo sano: grepea un símbolo inventado
(`Zanahoria…Inexistente`) y exige **0 hits**. Verde en su propio PR. **El literal estaba escrito en
`scripts/evidencia/existe-en-main.py`, y `scripts` es uno de los `AMBITOS` que el script grepea** —
con `git grep … origin/main`. Mientras el archivo vivía sólo en la rama, `origin/main` no lo tenía y
el control daba 0. **En el instante del merge (#1226) el instrumento pasó a ser parte del corpus que
mide**, su propio literal se volvió un hit, y el canario enrojeció el lint de **todas** las ramas de
las tres sesiones — no sólo las mías. El PR que lo destapó (#1227) era de docs: ni una línea de
código, rojo igual.

**Lo que lo hace difícil de ver:** el control es correcto, el token es correcto, el PR que lo embarca
sale verde, y el rojo aparece **después del merge, en PRs ajenos y sin relación**. El que lo recibe
lee «CANARIO ROJO 4» en su rama de docs y no tiene motivo para sospechar de un merge de otra sesión.

**La pregunta que lo caza, antes de embarcar cualquier control negativo:** *¿el archivo que escribe
este literal está dentro de lo que el instrumento busca?* Si sí, el literal **no puede estar en el
disco**: se arma en tiempo de corrida (`"Beren" + "jena" + …`) y se agrega un control que verifica que
siga armado — porque «simplificarlo» de vuelta a un literal reintroduce el defecto en silencio.

**Y el corolario del deadlock:** el control grepea `origin/main`, así que mientras el literal esté en
main **ninguna rama puede salir verde, ni la que trae el fix** si reusa el mismo token. El fix tiene
que cambiar el token *además* de dejar de escribirlo literal. Un gate que mide `origin/main` puede
quedar trabado contra sí mismo, y ahí no hay rama que lo arregle sin cambiar el sujeto medido.

Diferencial de atribución: mismo árbol, misma cwd, sólo la versión del script → viejo **ROJO 4**,
nuevo **OK 9 controles**. Emparentado con [[el-artefacto-que-genera-el-instrumento-no-tiene-dueno]] y
con [[el-guard-se-satisface-con-su-propio-comentario]], que es el mismo error con el signo invertido.
