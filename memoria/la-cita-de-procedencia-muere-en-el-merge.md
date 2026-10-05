---
name: la-cita-de-procedencia-muere-en-el-merge
description: Un «medido @ sha» de rama deja de resolver en el instante del squash-merge, justo cuando el documento empieza a circular. Medido: 26% de las citas de SHA del repo no sobrevive a un clon nuevo.
metadata:
  type: feedback
---

Un documento que declara con qué versión del instrumento midió —«medido @ `527e5408`»— cita un
commit **de rama**. El merge es por **squash**: crea un commit nuevo y borra la rama. La cita se
vuelve no-resoluble **en el momento exacto del merge**, que es cuando el documento deja de ser
borrador y empieza a circular. Resuelve en los checkouts que ya tenían el objeto —por eso nadie lo
nota— y falla en un clon limpio, que es donde se audita.

**Medido el 2026-10-05** sobre 564 `.md` (`docs/` + `memoria/` + el buzón): **835 citas de SHA** →
585 OK · 26 OK-blob · 4 OK-tree · **136 ZOMBI** (resuelve acá, no es ancestro de `main`) ·
**84 FANTASMA** (no resuelve ni acá). **220 de 835 = 26% no sobrevive a un clon**, repartidas en 65
archivos. Controles positivos en la misma corrida, los tres en su clase: `origin/main` = OK ·
`deadbee1` = FANTASMA · `527e5408` = ZOMBI.

**Hay progresión temporal, y es lo que lo vuelve irreversible:** el `gc` acaba borrando el objeto, así
que **el ZOMBI de hoy es el FANTASMA de mañana**. Se ve en la distribución: los FANTASMA se concentran
en checkpoints de junio/julio y los ZOMBI en documentos de septiembre/octubre. Mientras es zombi
todavía se puede resolver a mano desde un checkout que lo tenga; después, no.

**La raíz, y es barata:** la procedencia se cita con el **merge commit** del PR
(`gh pr view <N> --json mergeCommit` — verificado: #770 → `515d50f6`), que es lo único que sobrevive
al squash. Mientras el PR está **abierto no existe un SHA citable estable**, así que se cita el PR
(`#770`) o el **blob** del archivo, que el squash preserva si el contenido llegó.

**El gate que esto pide nace con falsos positivos si no se diseña con cuidado, y la medición lo
predice:** tras corregir el tablero quedaron **2** menciones del sha muerto y las dos son legítimas —
el relato de la corrección, y el **control positivo**, que necesita nombrar un zombi para
acreditarse. Un gate de «todo sha resuelve» las marca igual: la FORMA no codifica el ROL. **El patrón
de solución ya existe en este repo:** para ilustrar un mecanismo se usa un valor **fuera del padrón**
(el delimitador ficticio de los ejemplos internos; el id fuera del padrón en el ejemplo del formato).
Aplicado: **para ILUSTRAR, un sha imposible** (`deadbee1`); **para PROCEDENCIA, el merge commit**.

**Y la decisión de alcance, que no es cosmética:** el **tablero vivo se corrige** (circula, y es lo que
se lee para decidir) y los **documentos fechados se dejan** — reescribir la cita de un doc fechado es
reescribir lo que midió ese día. Para ellos vale la regla nueva de ahí en adelante; el gate mide el
**incremento** (las citas que un PR agrega), no el stock, porque un umbral sobre el stock sería una
foto del corpus del día.

Relacionadas: [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]] (el mismo
ref inexistente, del lado del instrumento) ·
[[un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real]] (un sello que parece referencia y
no lo es) · [[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]] (por qué el gate no puede
distinguir ilustrar de citar) · [[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]].
