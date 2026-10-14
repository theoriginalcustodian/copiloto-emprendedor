# SM-F1 — las 6 cadenas de negocio ejercitadas en device (2026-10-14)

`medido_contra:` main@`ea810b7a` servido por Metro (reiniciado tras dejar el código en disco) · prod
`9e536c38` · device RF8T318RN9T · usuario `e2e-device@copiloto.test`. Capturas leídas por mí
(`uiautomator dump` falla con animaciones normales); no se versionan.

| # | Cadena | Veredicto | Evidencia |
|---|---|---|---|
| 1 | Emitir factura y ver CAE | **REQUIERE_TRIAGE** | El flujo Datos de venta → Ítems → Cliente → Resumen llega a «Confirmar y emitir» y el emisor responde **«El token proporcionado es invalido.»** (token ARCA de la cuenta de prueba). Nunca llega a CAE: no se puede decir si la cadena completa funciona sin un token vigente. Además el mensaje al usuario sale crudo («Activity task failed» / «rechazada»). |
| 2 | Anular / nota de crédito | **COHERENTE** (camino de error) · **NO_MEDIBLE** (éxito) | Con emisión imposible no hay comprobante emitido que anular con éxito; el camino de error de «Anular» ahora muestra el texto (SM-D7 ✔). |
| 3 | Cobrar (incl. MercadoPago) | **COHERENTE** (manual) · **NO_MEDIBLE** (MP) | Ingreso manual de $7.777 creado y borrado: aparece en Ingresos y mueve «Entró» de Mi día. El cobro MP real necesita un pago externo. |
| 4 | Registrar gasto | **COHERENTE** | Por chat: «gaste 1234 en libreria» → card HITL → «Guardar el gasto» → «Gasto anotado: $1.234,00» → aparece en Gastos con detalle «Lo dictaste» y la cabecera suma $51.234,00 (= $50.000 + $1.234). |
| 5 | Ver mis números | **COHERENTE** | Mi día: Entró $0 · Salió $51.234,00 · En caja −$51.234,00 coincide con Gastos e Ingresos del mes. |
| 6 | Chat, voz y card HITL | **COHERENTE** (texto + card) · **NO_MEDIBLE** (voz sin audio) | Chat abre por arrastre; la card propuesta aparece con Cancelar/Guardar y el efecto queda en Gastos y Mi día. «cuanto vendi esta semana» responde con el bloque agregado coincidente con Mi día (id `preg`). |

## Hallazgos no bloqueantes

- Mensaje crudo en la falla de emisión (cadena 1): el usuario lee «Activity task failed».
- Los tiles de Mi día parten dígitos («$51.234,0 / 0»).
- Cabecera de Gastos dice «Gastado en 1 oct» donde Ingresos dice «Octubre».
- El detalle de un gasto no ofrece «Borrar» (el ingreso manual sí): asimetría de la app.
- `preg`: la prosa dice «esta semana» y el bloque es «Este mes» (mismos números).
- Un deep link con el chat abierto encola la navegación: la pila queda desordenada.
