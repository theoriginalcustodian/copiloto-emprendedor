---
name: rastro-del-intento-pisa-al-hecho
description: "Derivar el estado de un recurso de cómo terminó el último intento, en vez de mirar si el recurso existe — la UI dice 'desconectado' sobre una credencial activa"
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T18:38:13.832Z
---

**LEER al pintar cualquier estado de "¿está configurado / conectado / listo?".**

**Forma del bug:** hay un **hecho** (existe la credencial / el archivo / la suscripción) y un
**rastro** (cómo terminó el último intento de crearlo). Son cosas distintas y la UI lee el rastro.

**El caso (2026-07-21, alta ARCA).** `PantallaAfipSetup` decidía "¿está vinculado?" mirando
`onboarding.paso`, no `estado.conectado`. Dos fallos, uno más sutil que el otro:

1. El tenant vinculado **por script** nunca tuvo un onboarding — la app lo mostraba desconectado
   aunque `GET /afip/estado` devolvía `conectado: true`. **El dato estaba y no se usaba.**
2. Un re-alta fallido **tapaba** una vinculación sana: *"me figura como si estuviera desconectado
   de ARCA"*, con el certificado activo hacía dos horas. Y lo peor no es el susto: la pantalla lo
   empujaba a **reintentar un alta que no necesitaba**, y cada intento fallido gasta uno de los que
   ARCA tolera antes de bloquear la clave fiscal. Una UI que miente puede costar el acceso.

**How to apply:**
1. Preguntar por cada estado que se pinta: **¿esto es el hecho o el rastro de un intento?** Si el
   backend expone el hecho (`conectado`, `existe`, `activo`), ése manda — siempre.
2. El rastro no se esconde: baja a **nota secundaria**. Quien acaba de tipear su clave merece saber
   que no prendió. Esconderlo es el error espejo.
3. Test de regresión **en las dos direcciones**: con hecho + rastro-fallido gana el hecho; **sin**
   hecho, el rastro-fallido sí es el estado. Sin el segundo, un `!conectado` de más deja al usuario
   nuevo sin ver nunca su error.
4. Ojo con el orden de los ternarios en el render: acá el bug era literalmente que `fallido` se
   evaluaba **antes** que `conectado`.

Hermano de [[dato-en-dos-tiempos-lector-de-un-tiempo]] (leer un estado real pero prematuro) y de
[[validacion-de-mas-en-la-ui-enmascara-bugs]]. Los tres son la misma familia: **la UI afirmando algo
que el backend nunca dijo.** · [[copiloto-facturacion-afip]]
