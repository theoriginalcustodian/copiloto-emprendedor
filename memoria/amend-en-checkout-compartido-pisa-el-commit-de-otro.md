---
name: amend-en-checkout-compartido-pisa-el-commit-de-otro
description: git commit --amend (y rebase/reset) en un checkout compartido reescribe HEAD, que puede ser el commit de OTRA sesión — y lo pisa
metadata:
  type: project
---

**LEER antes de tocar git en la rama compartida por las tres sesiones.**

Con tres sesiones sobre el **mismo checkout y la misma rama**, **HEAD se mueve** cada vez que
cualquiera commitea. Un **`git commit --amend`** reescribe HEAD conservando su árbol: si HEAD es el
commit de **otra sesión**, el amend lo **reemplaza** — su código queda con TU mensaje, y su commit
original sale de la línea.

**El incidente (2026-07-22):** PLANIFICACIÓN commiteó la poda de memoria (`1cda817`, con un `@` colgado
en el subject por un heredoc de PowerShell). Para corregir ESE mensaje corrió `git commit --amend`.
Pero entre el commit y el amend, FRONTEND había commiteado su item #5 (`345bb12`), que quedó como HEAD.
**El amend reescribió el commit de frontend:** `086a5d6` terminó con el árbol de frontend y el mensaje
de memoria. El código de todos sobrevivió (amend conserva el árbol), pero la historia quedó cruzada y
el PR de frontend chocó en `MEMORY.md` contra main.

**La corrección de diagnóstico importa:** frontend lo reportó como *«un `reset` que tiró mi commit»*.
El reflog mostró que **no hubo reset — fue el amend**. Un vacío/síntoma se explica leyendo el reflog,
no deduciendo ([[una-espera-sin-disparador-nombrable-es-paralisis]] hermana: leé el instrumento real).

**Reglas (también en `coordinacion/COORDINACION.md §1`):**
- En checkout compartido: **nunca `--amend`, `rebase` ni `reset`**. No sabés si el commit de encima es
  tuyo.
- Un **mensaje feo se arregla con un commit `docs:` nuevo**, no reescribiendo. La deuda cosmética de un
  mensaje malo es infinitamente más barata que pisar el trabajo de otro.
- **Recuperación:** el `reflog` reconstruye la secuencia real; el árbol sobrevive al amend. El dueño del
  estado compartido (acá, memoria) **reconcilia el archivo en conflicto** y da la instrucción de merge
  de una línea (`--theirs` la versión autoritativa). [[coordinacion-tres-sesiones-buzon]]
