# SM-I1 — Mi día resume, Tu día gestiona

Device físico, usuario canónico, dev-client contra Metro, 2026-11-02. Las tarjetas de prueba se crearon y se
borraron en la misma corrida: el canónico quedó con las 2 tarjetas que tenía.

| Captura | Qué acredita |
|---|---|
| `SM-I1-mi-dia.webp` | Cabecera con wordmark y fecha + portada, «Ahora» con hora y «Ver agenda ›», «Para hoy · 3 cosas · Ver tablero ›», primera tarjeta abierta, con «Borrar» como botón |
| `SM-I1-tu-dia.webp` | Pantalla propia con «Volver», bajada, contador, banner crítico, solapas, filtros por categoría, «Anotar algo para hoy» y lista |
| `SM-I1-hechas-vacia.webp` | Solapa vacía: el alta queda pegada a los filtros (antes el `ScrollView` de chips crecía y abría un hueco de 200 px) |

## Recorrido hecho en device

- «Ver tablero ›» abre Tu día y «Volver» baja a Mi día, que relee: pasó de `2 cosas` a `3 cosas` tras anotar.
- Anotar con teclado abierto: el botón «Agregar» queda a la vista y crea la tarjeta.
- Swipe real con `motionevent`: revela «Empezar» y «Borrar»; «Borrar» saca la tarjeta tras releer.
- «Borrar» de la tarjeta expandida, desde Mi día: de `3 cosas` a `2 cosas`.
- «Revisarla» abre la factura; «Ver agenda ›» abre Agenda.
- La hora de «Ahora» acompañó al reloj del sistema con la pantalla abierta.

## Lo que NO se ejerció en device

- **Verbo → chat desde Tu día.** Las dos tarjetas del canónico traen `accion` con destino propio, así que
  ninguna usa el puente. Lo cubre `PantallaPrincipal.avisoDesdeTuDia.test.tsx`, que monta las dos puntas reales
  (ruta y shell) sin dibujar la navegación: no reemplaza el toque en device. Queda para cuando el canónico tenga
  un presupuesto enfriándose.
- **Calendario con un evento hoy** en Mi día: el canónico no tenía ninguno.

## Diferencias con la maqueta, declaradas

- **Sin resaltado del evento en curso, sin «Termina en 20 min» y sin línea de progreso:** `EventoCalendario` sólo
  trae `id`, `titulo` e `inicioCrudo`; sin la hora de fin no hay de dónde calcularlo.
- **«Volver al tablero» en una charla abierta desde Tu día baja a Mi día:** Tu día ya se cerró al llevar el aviso.

## Observado, sin tocar

- Tocar un botón dentro de la tarjeta (`Revisarla`, `Borrar`) también dispara el toque de la tarjeta: al volver,
  queda cerrada. No rompe nada y viene de antes de esta ficha.
- El engranaje que aparece en las capturas es el botón de herramientas del dev-client: no existe en release.
