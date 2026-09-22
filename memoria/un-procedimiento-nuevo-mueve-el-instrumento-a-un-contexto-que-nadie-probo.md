---
name: un-procedimiento-nuevo-mueve-el-instrumento-a-un-contexto-que-nadie-probo
description: exigir "gate del SHA mergeado" llevó el gate a worktrees detached, donde la sesión no se infiere y el default legacy callado volvió compartido el stage — 3 gates se pisaron
metadata:
  type: feedback
---

El 2026-09-22 planificación exigió que cada merge cite el recibo de `gate.sh` **del SHA mergeado**
(no de la cabeza del PR). Las sesiones lo cumplieron con un worktree **detached**
(`_ctl/verify-<sha>`). Ahí `sesion-env.sh` no infiere la sesión (sin rama `backend/*`, sin dir
`wt-*`) y caía **callado** a la tríada legacy: backend ×2, FE2 y FE1 corrieron sobre el mismo stage
del VPS. El `rm -rf` del stage de uno pasó en medio de los tests de otro (18 ConnectionRefused), y una
corrida pudo testear el código de otro SHA — un verde atado al SHA equivocado. Arreglado en #632
(fail-closed sin tríada + candado por tríada + test con control negativo).
El mismo procedimiento dejó la EVIDENCIA en un recurso desechable: el recibo vivía en `.ci-recibos/`
del worktree de verificación, y el 5/5 de 107fdf61 se perdió al borrarlo. Arreglado de raíz en #634:
el recibo se compara por ÁRBOL (con la rama al día, el de la cabeza cubre al squash, sin segundo gate)
y gate.sh deja copia durable en `<git-common-dir>/ci-recibos/`.
Y un tercer efecto: gatear un SHA VIEJO corre SU gate.sh viejo, sin el candado de #632 — backend pisó
stage-be otra vez (6940a3fb en paralelo con de0aa6d6). Un arreglo del instrumento no protege a las
versiones anteriores de sí mismo. Un SHA viejo sin recibo propio se cubre por TRANSITIVIDAD: el
descendiente de main más cercano con recibo 5/5 (`merge-base --is-ancestor` + `recibo-cubre.sh`).

**Why:** el instrumento estaba probado en el contexto donde se lo usaba (worktree con rama de sesión).
El procedimiento nuevo lo movió a otro contexto, y el default "de compatibilidad" convirtió la falta
de dato en recurso compartido sin avisar. Misma familia que
[[git-stash-es-comun-a-todos-los-worktrees]] y
[[hookspath-absoluto-apaga-el-pre-push-de-todos-los-worktrees]]: lo que parece por-worktree no lo es.

**How to apply:** al exigir un procedimiento nuevo que usa un instrumento, correr el instrumento UNA
vez en el contexto que el procedimiento induce (detached, otro dir, otra sesión) antes de bajarlo
como regla. Un default que no puede inferir su dato debe fallar cerrado, no elegir uno compartido.
Y la evidencia no puede vivir en el mismo recurso desechable que la produjo.
