# SM-N19: el presupuesto N° 4 fue una prueba por ADB y la card no desaparece

**Device:** Android físico, cuenta del operador, dev-client con Metro sobre `origin/main`. Fecha: 2026-11-02.

## Quién guardó

Los tres presupuestos con clave `presupuesto:assistant-<id>` salieron de pruebas por ADB de sesiones de este sprint. La asignación del N° 2 y del N° 3 es por ventana de tiempo: el transcript no tiene la hora de la fila, y las demoras que midió backend (49 s, 70 s y 115 s) encajan.

| Card | Presupuesto | Sesión | Pedido (UTC) | Guardar (UTC) |
|---|---|---|---|---|
| 1524 | N° 2 | frontend2 | 14:32:00 | 14:32:57 |
| 1662 | N° 3 | frontend1 | 18:39:48 | 18:41:11 |
| 1767 | N° 4 | frontend1 | 20:59:49 | 21:02:08 |

El N° 4 es el único con su fila cruzada al segundo: backend midió el `INSERT` a las 21:02:09 y el `POST` de `okhttp`, uno solo, en la misma ventana. `h5_guardar.sh` tocó «Guardar el presupuesto» por DOWN/MOVE/UP.

Lo que el operador contó («solo figuraba un mensaje de presupuesto generado») encaja con el recibo que la card pinta al guardar. Qué vio no se puede medir.

## Quién escribe la card y quién la pisa

- La escribe un solo lugar: `packages/core/src/chat/chatMachine.ts:410`, desde `GET /reply`.
- Se persiste con el mensaje entero: `apps/mobile/src/modules/chat/useChat.ts:119`.
- Se rehidrata de ese almacén: `useChat.ts:272-276`. El cliente no tiene endpoint de historial: `/reply` sólo agrega mensajes nuevos (`chatMachine.ts:400-418`), no reemplaza los que ya están.

La hipótesis «el re-pintado desde el servidor la reemplaza por el `reply_text`» no tiene camino de código.

## Corrida en device

Card sin resolver de «Prueba SM19», pedida por texto. No se guardó nada.

| Paso | Resultado | Captura |
|---|---|---|
| Aparece | Formulario editable, con su aviso | `SM-N19-1-card-visible.webp` |
| Bajar el chat a Mi día y volver | Igual | `SM-N19-2-tras-salir-y-volver.webp` |
| HOME y volver | Igual, testIDs presentes | no versionada |
| `force-stop`, pid nuevo, reabrir | Igual: datos y botones Guardar y Descartar | `SM-N19-3-tras-cierre-forzado.webp` |
| Descartar | «No lo guardamos.» | `SM-N19-4-descartada-y-H3-cancelada-tras-recargar.webp` |

## Qué queda en el hilo cuando la card YA se guardó

Control pedido por planificación: la card del N° 4 (guardada a las 18:02, antes de #1401), vista en el hilo del operador tras recargar, sin guardar nada nuevo. Queda el recibo `Presupuesto anotado — N° 4` **sin importe ni cliente** (`SM-N19-5-card-guardada-N4-rehidratada.webp`). Es lo que el operador describió.

La causa es la de SM-N5, no una card que se reemplaza por texto: el mensaje se guardó sin el campo `id`, y `TarjetaPresupuestoPropuesto.tsx:75-77` lo declara: «un mensaje anterior a ese campo… deja el recibo con el título y el N°». Desde #1401 (b64856dc) un presupuesto guardado persiste el `id` y la card relee importe y cliente al rehidratar. La captura de ese caso queda en la `Falta:` de SM-N5, para la cuenta canónica.

## Lo que esto no cubre

- Un teléfono nuevo o una reinstalación pierden el hilo entero, porque vive en el almacén local. No es este defecto: no se pierde la card, se pierde todo.
- `MAX_MENSAJES_HISTORIAL` (300) poda los mensajes más viejos.
