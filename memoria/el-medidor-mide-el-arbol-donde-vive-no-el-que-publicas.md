---
name: el-medidor-mide-el-arbol-donde-vive-no-el-que-publicas
description: Un instrumento que resuelve su raíz con Path(__file__).parents[1] emite un veredicto sobre el árbol donde está parado. Corrido en el checkout compartido sucio, su FALLA no es una falla de main — y "arreglarla" en main mete el defecto que no existía.
metadata:
  type: feedback
---

`scripts/medir-indice-memoria.py` reportó `FALLA: 5 entradas sin línea en MEMORY.md ni HISTORIA.md`.
Verifiqué, abrí el PR #885, salió **6/6 verde** y lo mergeé (`87c57cb1`). Después, midiendo en un
worktree **limpio de `origin/main`**, las cinco tenían exactamente **una línea de índice cada una** —
cuatro en `MEMORY.md`, la quinta en `HISTORIA.md:269`. O sea: el PR agregó **5 duplicados** y un
encabezado de 14 líneas que afirmaba lo contrario, *«nunca tuvieron línea en ningún índice»*.

**La cobertura de `main` ANTES de mi PR ya era 377/377.** El PR no arregló nada: empeoró.

## Por qué el instrumento no mintió

`RAIZ = Path(__file__).resolve().parents[1]`. El medidor mide **el árbol donde vive**, y yo lo corrí
en el checkout compartido, cuyo `memoria/HISTORIA.md` está **204 líneas atrás** de `main` y cuyo
`MEMORY.md` diverge en 162/149 líneas. Ahí las cinco **sí** estaban huérfanas. El veredicto era
correcto sobre un árbol que nadie publica. Es la forma de
[[metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree]]: no es el instrumento, es a quién
le preguntás.

## El control que corrí tapaba la mitad equivocada

Verifiqué con `git cat-file -e origin/main:memoria/<slug>.md` que las cinco **existían** en `main`, y
lo escribí como si eso acreditara el hallazgo. La afirmación era *«no tiene línea de índice»*; yo
verifiqué *«el archivo existe»*. Las dos eran verdad y sólo una contestaba la pregunta —
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

## Y mi réplica del instrumento inventó dos huérfanas

Al reconstruir el chequeo a mano grepeé `<slug>.md` y encontré **2 huérfanas** en `main`. No existen:
el medidor también cuenta **wikilinks** `[[slug]]`, que no llevan `.md`, y esas dos estaban
referenciadas sólo así. Su propio docstring lo dice —*«mirar sólo uno de los dos da falsos: la 1ª
versión de este control reportó 25 huérfanas donde había 24»*— y yo no lo había leído. Reimplementar
el criterio en una línea de `grep` es volver a pagar el bug que el autor ya documentó.

## Lo que el gate no podía cazar

Los 6 jobs pasaron porque **el diff era válido; la premisa era falsa**, y ningún test mira premisas.
Y el guard de duplicados del propio medidor sólo busca **líneas duplicadas exactas**: mis cinco pares
tienen título y emoji distintos, así que salió `[OK] líneas duplicadas exactas: 0` con los duplicados
ya adentro. Un verde no acredita el porqué del cambio.

**How to apply:**
1. Antes de llevar el veredicto de un instrumento a `main`, preguntá **qué árbol midió**. Si resuelve
   su raíz desde `__file__`, la respuesta es «el que lo contiene» — y acá eso es, de rutina, el
   checkout mezclado. Corrélo en un worktree fresco de `origin/main` y releé el veredicto ahí: el
   arreglo entero costó **un worktree**.
2. El control tiene que negar **la afirmación**, no la mitad que sospechás. Escribí la afirmación en
   una oración y preguntá qué observación la volvería falsa.
3. No reimplementes el criterio del instrumento en un `grep`: leé su extractor. El mío ignoraba los
   wikilinks que el original acepta.
4. Un gate verde no acredita la premisa. Si el hallazgo vino de una medición, la medición entra al
   cuerpo del PR con el árbol y el sha donde se tomó.
