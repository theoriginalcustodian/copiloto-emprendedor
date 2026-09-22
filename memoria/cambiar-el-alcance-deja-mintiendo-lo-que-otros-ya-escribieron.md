---
name: cambiar-el-alcance-deja-mintiendo-lo-que-otros-ya-escribieron
description: Cuando el coordinador cambia el alcance, los artefactos que otras sesiones ya escribieron citando el alcance viejo quedan falsos en el acto — y nadie los revisa porque son trabajo terminado, no trabajo en curso.
metadata:
  node_type: memory
  type: feedback
---

El 2026-09-22 le bajé a FE2 el fix de Agenda con una restricción explícita: *«nada de móvil: si la
misma falta existe en `apps/mobile`, anotala y no la toques»*. FE2 la cumplió y, para que su PR pasara
el gate de paridad testID en soledad, agregó una entrada en
`scripts/ci/testid-paridad-excepciones.json` con el motivo **«mobile no se toca este sprint»**.

Veinte minutos después le asigné a FE1 exactamente ese trabajo en mobile. La excepción quedó
**falsa en el acto**, y no por un error de FE2: era la transcripción fiel de una instrucción mía que
yo mismo invalidé. Lo destapó el gate de FE1 (`lint FAIL`, legítimo), no yo.

**Why:** cuando cambio el alcance, reviso el **trabajo en curso** —a quién reasigno, quién espera a
quién— y no reviso el **trabajo terminado**, que es justamente donde el alcance viejo quedó escrito y
congelado. Un artefacto que cita una decisión (una excepción de gate, un comentario que explica por
qué algo no se hace, una nota de DoD, una entrada de baseline) no se revisa nunca más: está cerrado.
Y los artefactos que más duelen son los que **apagan un control**, porque su motivo falso es lo único
que justifica que el control siga apagado.

Distinto de [[una-cifra-en-un-comentario-es-un-cache-sin-invalidacion]] y de la advertencia que
sobrevivió a su peligro: allá la afirmación **envejece sola** con el tiempo y el remedio es revisarla
cada tanto. Acá **hay un acto puntual y datable** —mi cambio de alcance— que la invalida, y el remedio
es un barrido en ese mismo momento.

**How to apply:** al cambiar un alcance que ya bajaste, **en el mismo turno** preguntá qué escribió la
otra sesión *citando* la restricción vieja, y hacé que lo corrija antes de que mergee. Grepear el
texto de la restricción suele encontrarlo. Y cuando una excepción de gate es necesaria para que un PR
pase solo, su motivo debe nombrar **quién** trae el par y **qué merge** la da de baja — no el estado
del sprint, que cambia. Un trinquete ayuda pero no alcanza: el de este archivo («sólo puede
achicarse») mata la excepción cuando el par **existe**, y no cubre el caso de que el par nunca llegue.
