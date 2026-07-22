---
name: dato-correcto-en-la-seccion-equivocada
description: "Escribi que el GET miente sobre rutas inexistentes y tres bloques mas abajo canonice una sonda por GET. El dato correcto vivia en otra seccion del mismo documento. LEER al escribir doctrina operativa: la advertencia va DENTRO del bloque que la necesita, no en la seccion tematica."
metadata:
  node_type: memory
  type: feedback
---

**Un dato correcto que vive en otra sección del documento es un dato que no existe en el momento de
usarlo.**

**El caso (2026-07-21).** En `COORDINACION.md` §3.bis escribí, con todas las letras, que el catch-all
del SPA es `@app.get` y devuelve **200 con HTML sobre cualquier ruta inexistente**. **Tres bloques más
abajo, en el mismo archivo, canonicé una sonda de despliegue por GET** — la que ese mismo párrafo
acababa de invalidar. Lo cazó FRONTEND, y era **la tercera vuelta del mismo error en un día, en tres
sesiones distintas**.

**El diagnóstico fácil es «me distraje». Es falso, y por eso importa.** El documento estaba
organizado por **temas** (los códigos de estado en un lado, las sondas en otro), y quien va a escribir
una sonda **lee la sección de sondas**. La información que la invalidaba estaba a quince líneas de
distancia, en una sección que no tenía por qué abrir. Un lector que hace lo correcto —ir al bloque que
le corresponde— **no ve la advertencia**.

**El fix que funcionó no fue reescribir la sonda: fue mover la advertencia ADENTRO del bloque de la
sonda**, pegada al comando, donde la lee alguien que sólo copia esas tres líneas:

```
POST /<coleccion> con body {}   → 400/422 = VIVO   ·   405 = NO desplegado
⛔ Por GET NO sirve: el catch-all del SPA es `@app.get` y devuelve 200 sobre CUALQUIER ruta.
```

Y después revisé **las otras reglas del documento buscando el mismo defecto** — porque si el modo de
falla es estructural, no es razonable que haya afectado a una sola.

**Regla para escribir doctrina operativa:** la advertencia que invalida un procedimiento va **pegada
al procedimiento**, no en la sección temática donde «corresponde». Organizar por temas es cómodo para
quien escribe; organizar por **momento de uso** es lo que sirve a quien ejecuta. Si un párrafo puede
hacer que otro sea peligroso, los dos tienen que estar a la vista al mismo tiempo.

**Corolario, medido el mismo día:** una regla que existe pero que el lector no encuentra **no protege
de nada, y encima da falsa tranquilidad** — «está documentado» pasa a contar como «está resuelto».
Es el primo documental de [[instrumentos-que-confirman-en-vez-de-verificar]]: el documento **dice la
verdad**, y el formato en que la dice la vuelve invisible. Vale igual para todo reporte de arranque
que embuta pendientes dentro de una línea que empieza con «OK».

[[coordinacion-tres-sesiones-buzon]] [[mensaje-entregado-donde-nadie-mira]]
