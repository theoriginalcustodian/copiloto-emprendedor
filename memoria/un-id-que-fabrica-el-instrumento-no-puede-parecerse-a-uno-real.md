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
