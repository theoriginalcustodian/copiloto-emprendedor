---
name: un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar
description: El positivo acredita sensibilidad, nunca pertinencia del sujeto ni completitud del universo; lo que caza esos dos errores es un control de denominador — cuántos elementos examiné contra cuántos esperaba.
metadata:
  type: feedback
---

> «Un control positivo prueba la sensibilidad del instrumento, nunca la pertinencia del sujeto.»
> — auditoría, 2026-09-29, después de medir el sujeto equivocado con el control en verde.

Tres errores el mismo día, en dos sesiones distintas, **todos con el control positivo en verde**:

1. **Sujeto equivocado.** Una afirmación decía «coincide con **el proto**» y la verificación buscó el
   elemento en **la app**. Lo encontró (`SeccionMeDeben.tsx:87`, sección fija desde agosto) y estuvo a
   punto de dar la cita por legítima. El positivo confirmaba que el instrumento veía archivos y
   encontraba strings — y eso era cierto, sobre el universo equivocado.
2. **Universo incompleto.** Un recuento leyó **2 documentos** de medición cuando había **6**, porque
   filtró por el **nombre** de los archivos. Produjo dos cifras sucesivas —«8 de 10», después «5 de
   10»— y la medida con el universo completo era **0 de 10**. El positivo seguía verde en las dos
   corridas.
3. **Árbol equivocado.** Mi medidor de índice dio `332/332` sobre un worktree atrasado respecto de
   `main`; el árbol mergeado tenía `341` con 9 huérfanas. El control interno del medidor estaba bien y
   no tenía nada que decir al respecto.

## Lo que sí los caza: el control de DENOMINADOR

En los tres casos, lo que destapó el error **no fue un positivo**: fue preguntar **cuántos elementos
examiné y cuántos esperaba examinar**.

- El error del universo lo destapó un `assert` que decía «se esperaban 2 documentos del 22/09» y
  encontró **5**. Nadie lo estaba buscando: el control gritó solo.
- El del árbol lo destapó CI contando **341 entradas** donde yo había contado 332.

**Son dos controles distintos y no se sustituyen:**

| | pregunta que responde | qué error caza |
|---|---|---|
| **control positivo** | ¿el instrumento **detecta** cuando el caso está presente? | falso verde por instrumento sordo |
| **control de denominador** | ¿examinó **todos** los elementos que debía, y sobre el sujeto correcto? | sujeto equivocado · universo incompleto · árbol viejo |

**El positivo es sobre la sensibilidad; el denominador es sobre el alcance.** Un instrumento
perfectamente sensible sobre el universo equivocado da un resultado limpio, reproducible y falso — y
el positivo en verde lo hace **más** creíble, no menos. Eso es lo peligroso: el verde del positivo
**aumenta** la confianza en una medición cuyo defecto no puede ver.

## La pregunta operativa, antes de afirmar

**«¿Cuántos elementos miró mi instrumento, y cuántos debería haber mirado?»** Si la respuesta no es un
número contra otro número, no hay control de denominador — y es donde viven los tres errores de
arriba. Es la versión medible de [[instrumento-que-no-mira-nunca-falla]]: ahí la pregunta era cuántos
elementos miró; acá es **cuántos de los que había**.

⚠️ **Y el corolario sobre el sujeto**, que ningún conteo arregla: el universo se elige **antes** de
medir, y esa elección no la valida ningún control interno del instrumento. La afirmación a verificar
**nombra su propio sujeto** —«coincide con el proto» dice *proto*— y leerlo de ahí es más barato que
cualquier control. [[el-instrumento-respondio-sobre-otro-sujeto]] es la misma raíz vista desde el
resultado; esta entrada es la vista desde el control que no lo iba a atajar.
