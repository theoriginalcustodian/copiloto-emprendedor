# ADR-007 — La factura propuesta se edita dentro de la card

- **Fecha:** 2026-11-02
- **Estado:** `ACCEPTED`. La decisión es del operador (D7 del sprint de correcciones). Lo que falta para
  cerrar la ficha SM-H1 es la evidencia de device, y eso vive en el backlog, no acá.
- **Decide:** operador. Esta ADR registra el diseño de frontend1.
- **Ficha:** SM-H1

## Contexto

La card del chat ofrecía «Emitir la factura» o «Completar a mano». Lo segundo llevaba a
`PantallaFacturacion`, así que para corregir un dato había que salir del hilo. Su docstring lo defendía
como gate + handoff: el miedo era tener una segunda implementación de la carga y de la firma.

El operador pidió otra cosa: «el agente cancela definitivamente pero tambien hay que agregar los botones
de editar factura antes de emitir y el botón de cancelar...para poder hacerlo manual y no solamente por
comando de voz».

## Decisión

La card tiene **Editar · Cancelar · Emitir la factura**. Con datos faltantes no hay Emitir, y Editar abre
directo el dato que falta.

1. **Se revierte el handoff, no la razón que lo justificaba.** `PasoDatosVenta`, `PasoItems` y
   `PasoCliente` son los mismos componentes de `PantallaFacturacion`, y las señales son las mismas, sobre
   el mismo workflow. No hay una segunda implementación.
2. **Emitir tiene una sola puerta:** `confirmarConTokenFresco`.
3. **Lo que se muestra sale del workflow.** El artifact del mensaje es una foto del momento en que el
   agente armó la propuesta, y el borrador puede cambiar por la card, el chat o la voz. La card relee al
   montar y cada 5 segundos. Usa el artifact sólo hasta la primera lectura o si esa lectura falla. Los
   botones siguen apagados hasta que termina la primera lectura.
4. **Emitir compara antes de emitir.** Relee el estado y, si `firmaDeEstado` difiere de la última lectura,
   no emite: repinta y pide revisar. Lo que está en pantalla es lo que se emite.
5. **Un ítem se edita agregando el nuevo y quitando el viejo, en ese orden.** No hay señal de editar. Así
   el borrador nunca queda sin ítems; si falla lo segundo, quedan los dos a la vista.

## Por qué no alcanzaba el token

`FacturaWorkflow._token()` sólo ve cantidad de ítems, total, documento y fecha. Cambiar un nombre o una
descripción no lo mueve. Por eso la comparación se hace contra `firmaDeEstado`, que ahora cubre todo lo
editable.

Esto significa que el guard vive en el cliente. Un cliente que no lo aplique puede emitir un borrador con
otro nombre o descripción usando un token válido. No se cambió el backend en esta ficha.

## Alternativas descartadas

- **Mantener el handoff y sumar sólo Cancelar.** No cumple D7, que pide editar antes de emitir.
- **Pasar el estado leído desde `ListaMensajes`.** Rompe el `memo` de `FilaMensaje`, porque cada fila se
  volvería a dibujar con cada lectura. La card relee por su cuenta.

## Consecuencias

- **Web no entra.** En duplicados web/mobile manda `apps/mobile/`. `apps/copiloto-web` conserva Emitir y
  «Completar a mano». Si Emitir se toca sobre una factura cancelada, el backend responde 409
  `factura_cancelada`.
- Cada card sin estado final hace una lectura cada 5 segundos mientras está montada. La relectura se apaga
  con un estado final.
- Un ítem editado queda al final de la lista, por el punto 5.
- La letra del encabezado sigue saliendo del artifact. Editar el cliente no la recalcula. Hoy no cambia el
  resultado, porque un emisor monotributista o exento siempre emite C; deja de ser cierto cuando se soporte
  Responsable Inscripto (SM-E1).
