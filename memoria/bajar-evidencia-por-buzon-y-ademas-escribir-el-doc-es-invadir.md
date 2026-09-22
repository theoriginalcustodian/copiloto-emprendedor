---
name: bajar-evidencia-por-buzon-y-ademas-escribir-el-doc-es-invadir
description: "Si le pasaste evidencia a la sesión dueña por el buzón, el doc lo actualiza ELLA; escribirlo vos también produce un PR duplicado que hay que cerrar."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T19:26:12.897Z
---

Cuando planificación baja evidencia a la sesión dueña de un frente, **el buzón ya es la entrega**. La
dueña integra ese insumo en su propio documento. Escribir además el doc uno mismo produce trabajo
duplicado que termina cerrado sin mergear.

**Why:** el 2026-08-12 bajé un `dato_` a frontend con el barrido de Actions para D9 (`mobile` 39/39
verde en el runner, las 3 apariciones del flake todas en el gate local). Acto seguido escribí yo la
misma evidencia en el registro de deuda y abrí PR #405. Frontend ya había mergeado #404 con **ese
mismo contenido, citándome como fuente, y con más datos que los míos** — una corrida #5 relanzada
bajo carga real medida (26 procesos `node.exe`) que no reprodujo. El mecanismo funcionó exactamente
como debía; el que se salió del carril fui yo. Además de tirar el trabajo, duplicar el doc de otra
sesión **arriesga secciones repetidas y conflictos** en el archivo del que ella es dueña.

Segundo error encadenado, y es el que lo habilitó: la regla anti-colisión del DoD §3 pide
`git fetch && git log origin/main --oneline -10 && gh pr list` **antes** de abrir el frente, y la
corrí **después** de escribir. Es el mismo defecto que
[[el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main]], en el otro orden: no es que el buzón no me
mostrara lo de main — es que ni miré.

**REINCIDÍ el mismo día, y la segunda vez afina la regla.** ~19:15 bajé a backend un `urgente_` con
el diagnóstico de `main` roja (un aserto de PII que afirmaba 38 chars sobre un texto de 36) **y
además implementé el fix**. Frontend leyó ese mensaje, verificó el `len()` por su cuenta y mergeó
#410 citándome como fuente del diagnóstico. Mi PR #411 salió duplicado y lo cerré. El buzón hizo
exactamente lo que tiene que hacer; el que se salió del carril fui yo, otra vez.

**Lo que cambia respecto de la primera versión de esta lección:** acá **sí** corrí la anti-colisión
antes de abrir el frente — y no alcanzó, porque trabajé ~15 min y el mundo se movió en el medio. El
chequeo que importa es el de **justo antes de pushear**, que es el único que ve lo que pasó
*mientras* trabajabas. Corolario más fuerte: cuando bajás un hallazgo con diagnóstico completo,
estás **aumentando** la probabilidad de que otro lo implemente ya — si además lo implementás vos,
la colisión no es mala suerte, es consecuencia de haberlo bajado bien.

**How to apply:** tras bajar un `dato_`/`pedido_`/`urgente_` con evidencia, **la parte de
planificación terminó**. El seguimiento es verificar que la dueña lo integró, no integrarlo por ella
— y eso vale también para un fix de código P0, no sólo para docs. Si igual vas a tocarlo (porque no
hay dueño vivo y bloquea a la flota), decilo en el propio mensaje: *"lo tomo yo salvo que alguien lo
esté haciendo"*, y **re-verificá `git log origin/main` inmediatamente antes del push**. Si el
contenido ya está, **cerrar el PR propio** y conservar sólo lo que no existe — nunca mergear "por no
perder el trabajo".
