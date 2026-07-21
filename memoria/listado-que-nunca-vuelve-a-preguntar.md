---
name: listado-que-nunca-vuelve-a-preguntar
description: Un listado que carga al montar y nunca recarga miente en silencio; el remonte lo disfraza de intermitente
metadata: 
  node_type: memory
  type: project
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T21:00:27.813Z
---

**LEER al poner un listado en pantalla.** Cargar en `useEffect` al montar y no cablear ningún otro
disparador deja la pantalla mostrando el mundo del momento en que se abrió. No hay error, no hay
spinner: el dato viejo se ve idéntico al dato fresco.

**Cómo se presentó (2026-07-21, copiloto):** el operador *"no tengo ninguna factura 18, solo veo
hasta la 15"*. Dos causas eran compatibles con eso —el listado no refresca, o el comprobante es de
otro tenant— y una me daba por inocente. El control por HTTP/DB las separó en un minuto: un solo
tenant, 24 filas, la 18 primera en la respuesta. El backend estaba sano.

**Por qué se escapa del gate.** Salir de la pantalla y volver a entrar SÍ recarga (remonte), así que
el síntoma parece intermitente en vez de roto, y cualquiera —incluido el usuario— lo atribuye a otra
cosa. Ningún test de jsdom lo ve: montan, cargan una vez, y esa es exactamente la única vez que el
código funciona bien.

**Los disparadores son tres y ninguno sustituye a otro:**
1. **Remonte** — sale gratis, sólo cubre "salí y volví".
2. **Después de la acción local que cambia el dato** — cubre emitir/crear/borrar EN esa pantalla. Cortar
   por `terminado`, no por el primer estado que parece final ([[dato-en-dos-tiempos-lector-de-un-tiempo]]).
3. **Tirón-para-actualizar** — el ÚNICO que cubre lo que cambió AFUERA (otro dispositivo, la web, el
   agente, un script). Ningún *"recargar después de X"* alcanza cuando la app nunca hizo X.

**Antes de poner un pull-to-refresh en esta cáscara:** verificar contra quién compite el arrastre
hacia abajo. Acá no colisiona porque el `Pan` de `MarcoGlass` está montado sólo sobre la zona del
handle, no sobre el contenido — pero eso se leyó en el código, no se asumió.

**Es el reverso de la serie de bugs de "afirmar antes de tiempo".** Aquellos leían un dato antes de
que el hecho estuviera completo; éste no vuelve a leer después de que el hecho cambió. Mismo error de
fondo: confundir una lectura con el estado del mundo. Ver [[rastro-del-intento-pisa-al-hecho]] y
[[instrumentos-que-confirman-en-vez-de-verificar]].

**Cierre del aprendizaje:** los dos tests se corrieron contra el código SIN el arreglo y fallan. El
del tirón prueba el cableado, no el arrastre — jsdom no tiene gesto táctil
([[gate-jsdom-no-ve-gestos-tactiles]]), y eso queda escrito en el propio test.
