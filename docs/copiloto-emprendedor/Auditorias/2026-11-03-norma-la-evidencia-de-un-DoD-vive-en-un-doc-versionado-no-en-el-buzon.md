# NORMA — la evidencia que acredita un DoD vive en un doc VERSIONADO, nunca sólo en el buzón

**Fecha:** 2026-11-03 · **Emite:** planificación · **Origen:** auditoría del sprint de correcciones
del mapa (lotes 2a–2i; 33 de 67 fichas `TERMINADO` leídas a mano al momento de escribir esto).

---

## La norma, en una línea

**Un `TERMINADO` se acredita con evidencia que sobreviva a un clon del repo.** Eso significa: en el
`Cierre:` de la ficha, en un doc versionado que el `Cierre:` cite, o en un script versionado que
cualquiera pueda volver a correr. **El buzón no cuenta.**

## Por qué el buzón no cuenta, y no es una cuestión de prolijidad

`coordinacion/` está en `.gitignore` **a propósito** y eso no va a cambiar: si se versionara,
`git worktree add` la duplicaría por worktree y el mensaje de una sesión no existiría para la otra
(`CLAUDE.md §3.quater`). La consecuencia estructural es la que nadie había escrito:

> **La evidencia que vive sólo en el buzón DESAPARECE EN UN CLON.**

Es la misma clase que `memoria/la-cita-de-procedencia-muere-en-el-merge.md`, un piso más abajo: ahí
moría la **cita**; acá muere la **prueba**. Un `✅` cuya prueba no existe en el repo es
indistinguible de un `✅` que nadie probó — y la diferencia entre esas dos cosas es justamente lo
único que un registro de sprint existe para conservar.

## Las cinco formas medidas que esta norma cubre

Todas salen de la auditoría, con su instrumento y su control:

| Clase | Qué se midió | Cota |
|---|---|---|
| **H6** — evidencia sólo en el buzón | fichas `TERMINADO` con `cierre_` en el buzón que **no** citan doc versionado | **cota superior 40 de 67** @`f038b989`. **No es una cifra**: de 6 leídas a mano, 3 son H6 reales (N1, N8, N2) y 3 no (N3, H4, N7). Controles: N1/N8/N2 adentro, N9/I2/H7 afuera. |
| **H9** — la sonda no está versionada | `git ls-tree` de `probe_*` da **0**; el patrón sí existe (`sonda_cobro_llm_sm_n21.py` **sí** está versionada) | `probe_h4.py` (N2, H4), `probe_n13.py` y el probe de N1 **no se pueden re-correr**, y sus DoD exigen «la MISMA sonda» |
| **H13** — la captura de device no está en el repo | ≥**10** `TERMINADO` (I3, J4, K1, K9, N5, N17, N25, N26, N35, N43, N24) citan capturas `b1-*`/`n*-canonico` que **no existen** en `origin/main`. Control: las `SM-H7-1` del 02-11 **sí** están | cota **inferior** |
| **H8/H12/H10/H14** — el DoD pide un dato que no está en ninguna parte | el conteo del VPS de `SM-N13`; la captura del caso `facturas_atribuibles:false` de `SM-J4`; el paso CORREGIR de `SM-N19`; la barra del tope de `SM-N32` | 4 confirmados, cada uno con su control de ceguera |

**Las cotas se citan como cotas.** `40` no es «40 fichas están mal»: es «hasta 40 pueden estarlo, y
de las leídas a mano la precisión fue 3 de 6». Citar una cota como cifra es el error que
`memoria/una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta.md` ya cobró en este sprint.

## Lo exigible desde ahora

1. **El `Cierre:` se escribe autosuficiente.** Si la prueba es una corrida, el conteo va **en el
   `Cierre:`**, no en un «ver el `cierre_`».
2. **La sonda se versiona, no sólo su resultado.** Un DoD que diga «la MISMA sonda» y cuya sonda no
   esté en `main` no es re-corrible: es una afirmación.
3. **La captura de device se sube a `evidencia/`.** Sin la imagen, el DoD táctil se acredita con la
   descripción de quien cerró — que es exactamente lo que `CLAUDE.md §3.quater.bis` dice que el gate
   no puede verificar y por eso obliga a dejar **escrito**.
4. **Un punto que sale por DECISIÓN no es un punto cumplido.** Se marca `DOD-PARCIAL` con su
   `Falta:`, o se retira **explícitamente** citando la decisión en un doc versionado. Es la
   distinción que ya se pagó en `SM-L3` y que `SM-N32` repitió.

## Lo que esta norma NO hace

**No reabre ningún `TERMINADO` por sí sola.** `DEC-18` manda: un hallazgo no revierte un ✅ y sólo
un lugar mide. Lo que hace es (a) fijar el criterio para los que vengan y (b) dar a auditoría el
corpus que está leyendo. Cada ficha baja a `DOD-PARCIAL` **una por una, con su hallazgo confirmado**
— como se hizo con `SM-J1`, `SM-N13`, `SM-N19`, `SM-J4` y `SM-N32` en el lote 17.

## Procedencia

Auditoría corrigió **dos veces** sus propias cifras antes de que esto se escribiera: el «no hay
`cierre_` de `SM-N2`» era un grep roto leído como vacío, y el «34» de H6 tenía dos bugs de
instrumento (el punto final pegado al path y la asociación por nombre de archivo en vez de por el
campo `FICHA:`). **Las dos correcciones llegaron antes de que yo aplicara la conclusión**, y por eso
`SM-N2` no quedó marcada por un hallazgo que no existía. Eso es el instrumento funcionando, no
ruido.

---

## ➕ Refuerzo (mismo día, lote 19) — el gate mide ANCESTRÍA, no PERTINENCIA

`sprint-estado.py --check` verifica que el sha del `Cierre:` sea **ancestro de `origin/main`**. Eso
no verifica que el sha sea **de esta ficha**: un commit de **otra** ficha pasa el control sin
síntoma. Medido por auditoría (H15): de **92** shas ancestros citados, **21** no nombran su ficha
—casi todos cruces deliberados y rotulados como tales—, **4** fichas no tienen ningún sha propio, y
**una sola** es un error real: `SM-N25` citaba `a6600880`, que es el commit de `SM-N45`.

**Por qué el falso positivo es tan plácido:** el gate verde dice «el sha existe en la historia», y
eso se lee como «el trabajo está acreditado». Lo primero es cierto y lo segundo no se midió. Es la
misma forma que [[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]: se verifica A y se concluye B.

**Lo exigible mientras el gate no lo mida:** el `Cierre:` cita el sha **y** dice qué hizo ese commit
en una línea. Un sha desnudo no se puede contrastar; con la línea, la discrepancia salta al leerlo.
**Un cruce deliberado se rotula** («la evidencia de N20 vive en el `Cierre:` de N21»), que es lo que
hicieron 20 de los 21 casos y por eso no son hallazgos.

**No se intenta automatizar la pertinencia acá.** Un gate que exigiera que el commit nombre la ficha
rechazaría los cruces legítimos, y el 20/21 dice que el cruce es la norma, no la excepción — un
guard que grita en el caso normal se desarma solo
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]).
