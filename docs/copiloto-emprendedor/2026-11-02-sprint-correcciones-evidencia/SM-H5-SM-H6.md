# SM-H5 y SM-H6 · Evidencia de device

**Device:** Android físico, usuario canónico, dev-client con Metro desde la rama `frontend1/sm-h5-h6-cards`. Fecha: 2026-11-02.

## SM-H6 · La factura emitida dice de quién y con qué número

Sobre una factura real ya emitida; no se emitió ninguna nueva.

| Punto del DoD | Medido en device |
|---|---|
| Número formateado | `N° 0006-00000011` |
| Cliente | `consumidor final`, en la misma línea, con el importe `$100` |
| Título | `Factura C emitida.` |
| Opción de mail | «Mandala por mail», junto a «Abrir en Drive» y «Compartir» |
| El botón funciona | Abre el redactor de Gmail con el asunto `Factura N° 0006-00000011`, el link de Drive en el cuerpo y el destinatario vacío. El borrador se descartó sin enviar |

La captura del redactor no se versiona porque muestra una cuenta y un contacto reales.

Captura: `SM-H6-1-factura-emitida-con-cliente-y-mail.webp`.

## SM-H5 · Las cards de presupuesto

| Entrada | Punto | Medido en device | Captura |
|---|---|---|---|
| `pres-hitl` | Sigue siendo formulario editable (D5) | Concepto, cliente, documento e ítems editables | `SM-H5-1-formulario-total-y-botones.webp` |
| `pres-hitl` | Botones | «Guardar el presupuesto» y «Descartar» | ídem |
| `pres-hitl` | Total | `Total aproximado: $50.000` | ídem |
| `pres-hitl` | «Descartar» funciona | `No lo guardamos.` | `SM-H5-3-descartado.webp` |
| Recibo | Importe | `$50.000 · Mostrador Device Verify` | `SM-H5-2-recibo-con-importe-y-pendiente.webp` |
| Recibo | Estado | `Pendiente · Doc listo para mandar` | ídem |

**Mapa corregido por D5:** el formulario editable reemplaza a la vista de solo lectura, y la app conserva «Guardar el presupuesto».

**«Pendiente» se muestra solo en la sesión viva, a propósito.** Al recargar, el mensaje guarda únicamente el número y el presupuesto pudo aprobarse después. Mostrarlo ahí sería afirmar un estado que no se conoce. La misma recarga también borra el importe y el cliente; eso quedó pedido a planificación.

## Lo que falta de SM-H5 y es de backend

Se ve en `SM-H5-2`, arriba del recibo:

- El chip dice `¿Te armo la factura?` y el mapa dice «Armá la factura».
- El texto del asistente dice `$50,000.00`.

Hasta que se despliegue ese arreglo no se puede capturar `pres-ciclo` como pide el DoD.
