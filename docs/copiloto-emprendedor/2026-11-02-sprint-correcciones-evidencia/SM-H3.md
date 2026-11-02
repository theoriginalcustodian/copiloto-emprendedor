# SM-H3: el pedido de mail produce la card de Gmail

**Device:** Android físico, **cuenta del operador** (el canónico no tiene Gmail), dev-client con Metro sobre `origin/main`. Fecha: 2026-11-02. No salió ningún mail.

| DoD | Medido | Captura |
|---|---|---|
| El pedido de mail produce la card de Gmail | «Mandale un recordatorio por mail a prueba@example.com…» da la card de Gmail | `SM-H3-card-gmail.webp` |
| Aclara que sale al confirmar | «El mail sale desde tu Gmail cuando confirmes, no antes.» | ídem |
| Cancelada no muestra «Confirmado» | «No lo hicimos» | `SM-N19-4-descartada-y-H3-cancelada-tras-recargar.webp` |
| Tampoco al recargar | Sigue «No lo hicimos» tras recargar y tras `force-stop`. Ningún nodo con «Confirmado» en pantalla | ídem |

El botón dice «Confirmar» y no «Confirmar y mandar». Ese texto estaba en el `Medido:`, no en el DoD.
