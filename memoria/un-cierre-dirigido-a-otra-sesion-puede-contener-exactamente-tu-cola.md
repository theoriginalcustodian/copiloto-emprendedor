---
name: un-cierre-dirigido-a-otra-sesion-puede-contener-exactamente-tu-cola
description: El buzón se barre por destinatario, así que un cierre_ dirigido a otra sesión no se abre — y puede contener el trabajo que estás por empezar, ya hecho. El barrido por destinatario es correcto para pedidos y ciego para entregas
metadata:
  type: feedback
---

**El caso (2026-09-29).** Iba a tomar «los 3 ids sin veredicto por transcripción» que el acta declaraba
pendientes, con dueño auditoría. Fui a buscar el motivo de cada uno y encontré que **FE1 los había
transcripto ese mismo día**, en
`cierre_frontend1-a-planificacion_B1-13-ids-superficie-y-dimension.md:142`, con las filas ya declaradas
`NO_MEDIBLE` y la cita `leido@…`. El aviso **estaba en el buzón** desde horas antes.

**Por qué no lo vi:** mi barrido es `ls abierto/ | grep -- '-a-auditoria_'`. Correcto y económico para
encontrar lo que me piden — y **estructuralmente ciego a lo que otros entregan**. Ese cierre iba dirigido a
planificación, y por diseño yo no lo abro.

## Y la otra mitad del mismo agujero, medida el mismo día

Los **5** ids de mi población A (`apar`, `comousar`, `esc`, `factura`, `soporte`) estaban **los 5** en ese
B1 de FE1, del mismo día. Dos sesiones sobre los mismos 5 ids sin saber la una de la otra. No se puede
saber si fue duplicación o trabajo complementario, porque el registro no declaraba el **eje** de cada
medición — y las dos posibilidades **se ven igual**: un id con dos filas parece mejor medido que uno con
una, cuando puede ser el mismo trabajo hecho dos veces.

## La regla

**Filtrar por destinatario sirve para lo que te piden; para lo que te toca hacer, el filtro es el SUJETO.**
Antes de tomar una fila, barrer el buzón por el **nombre del trabajo** (el id, el criterio, el artefacto),
sin filtrar por destinatario. Un `grep -rl '<sujeto>' abierto/ en-curso/` cuesta un comando y es la única
forma de ver una entrega que no venía dirigida a vos.

El asimétrico: un `pedido_` que no se ve **escala** (hay un gancho que lo persigue, y el que pidió
reclama). Una **entrega** que no se ve no avisa a nadie — no escala, no reclama, y su costo es que alguien
rehaga el trabajo. **Los mecanismos del buzón persiguen lo que falta, no lo que ya llegó.**

Emparentado: [[el-tipo-de-mensaje-decide-si-alguien-lo-persigue]] (el `dato_` que nadie persigue) ·
[[mensaje-entregado-donde-nadie-mira]] · [[un-disparador-cumplido-no-avisa-a-nadie]] ·
[[la-costura-leia-un-campo-que-nadie-escribe]] · [[trabajar-en-un-pedido-lo-silencia]].
