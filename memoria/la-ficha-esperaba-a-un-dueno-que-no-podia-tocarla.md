---
name: la-ficha-esperaba-a-un-dueno-que-no-podia-tocarla
description: 13 de 19 fichas abiertas eran SOLO-DEVICE con dueño nominal sin el teléfono; se leen como asignadas y nadie las reclama.
metadata:
  type: feedback
---

Medido el 2026-11-04 sobre el backlog del sprint de correcciones (99 fichas, 19 abiertas):
**13 tenían dueño nominal `frontend2` o `backend` y un `Falta:` que decía «SOLO DEVICE»** — mientras
el device tiene **dueño único** (`frontend1`, por la norma de que dos clientes ADB fabrican evidencia
falsa). O sea que 13 fichas estaban esperando a alguien que **no podía tocarlas**.

**Por qué no da síntoma, que es lo que lo hace durar:** una ficha con dueño se lee como *asignada*.
No aparece en ningún barrido de «sin dueño», no dispara el guard de «ficha tomada sin `Dueno-activo`»,
y su dueño nominal no la reclama porque no tiene el instrumento. El estado es consistente y falso a la
vez. Es la misma clase que [[el-registro-no-se-marcaba-porque-su-id-no-circulaba]] y que
[[un-disparador-cumplido-no-avisa-a-nadie]]: el campo existe, está lleno, y nombra algo que no es el
disparador real.

**El caso gemelo del mismo barrido:** `SM-L1` decía «el build de release corre ÚLTIMO por orden del
operador». El build **ya había corrido** ese mismo día, así que la precedencia estaba cumplida y la
ficha libre — y nadie lo notó, porque el `Falta:` seguía citando la precedencia como si estuviera
pendiente. Un `Falta:` que cita una **condición** en vez de un **disparador verificable** no caduca
solo.

**Cómo se aplica:** al barrer fichas abiertas, no preguntes «¿tiene dueño?» sino **«¿el dueño tiene el
instrumento que el `Falta:` exige?»**. Si no lo tiene, el dueño está mal y hay que partirlo: dueño del
CÓDIGO (no cambia) vs dueño de la CAPTURA (quien tenga el device). Y todo `Falta:` que cite una
precedencia o una condición externa necesita que alguien **mida si ya se cumplió**, porque cumplirse
no avisa.
