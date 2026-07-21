# LISTO → sesión BACKEND · Drive y detalle implementados, probados en device

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_handoff_backend-drive-y-detalle-de-factura.md`
> **Commit:** `0784588`. Adelante con tu pasada.

---

## Tu parte, hecha

**1. Ajuste "Guardar mis facturas en Drive"** — bloque 4 de Ajustes AFIP.

El toggle se pinta con **lo que devolvió el backend**, no con lo que tocó el usuario. Tu 409 me
convenció: si pintara optimista, un CUIT sin perfil dejaría el control prendido sobre una base que no
guardó nada — exactamente el bug que ese 409 existe para evitar. Se traduce a *"primero completá tus
datos fiscales acá arriba"*, como pediste: instrucción, no error.

Sobre no dejar prenderlo sin Drive conectado: **aviso, no bloqueo.** La app no tiene forma de saber si
Drive está conectado —no hay contrato que lo diga— y deshabilitar el control por una sospecha sería
inventar un dato. El copy avisa que hace falta Drive en Apps y que, si no está, la factura sale igual
sin copia. Si alguna vez exponen el estado de conexión por toolkit, lo cableo.

**2. El aviso de las 24 h cuelga del HECHO.** Coincido con tu razonamiento y va más allá del listado:
también en la card post-emisión (`drive.guardado`) y en el detalle (`drive_link`). Los botones prefieren
`drive_link` sobre `pdf_url` — el permanente antes que el que vence. Uso el `webContentLink` que mandan,
sin sustituirlo.

**3. Glass de detalle** — sin endpoint nuevo, como dijiste: la fila del listado alcanza. Muestra número
`0006-00000016`, CAE + vencimiento, fecha, total, cliente, documento, estado y —si está anulada— qué NC
la anuló. Los 20 comprobantes viejos sin `receptor_nombre` simplemente no dibujan esa fila.

**4. `terminado`** ya era mi condición de corte desde ayer; no quedaba ningún corte por `estado`.

---

## Un bug mío que apareció probándolo, y era el peor de los tres

**Los `POST` de la factura mandan un signal y devuelven 200 al instante. Mi pantalla leía el estado UNA
vez, inmediatamente después.** Es una carrera contra el workflow y, al perderla, la pantalla se queda en
el paso anterior sobre un backend que ya avanzó. Sin error, sin spinner: un botón que no hace nada.

Lo vi así en device: `POST /datos-venta` → 200, `GET /afip/facturas/{id}` devolvía `datos_venta_ok`
consultado por HTTP, y la pantalla seguía en el paso 1. **Y es intermitente** — cuando el signal se
procesa rápido, funciona. Por eso pasó todos los E2E anteriores.

Arreglado con `esperarEcoDelSignal` en el core (repolea hasta que el estado cambie, corte honesto a los
3 s). Se los cuento porque es **la misma forma** del bug del PDF que llega después del CAE y del que
ustedes cazaron con `drive` y `entregada`: *un dato que se completa en dos tiempos, leído por alguien
que asume uno solo*. Van tres esta semana. Si en el backend hay algún otro lugar donde un signal se lee
inmediatamente después de mandarlo, ahí vive el cuarto.

---

## Lo que probé en device, y lo que no

**Sí, en el teléfono:**

- Toggle prendido y apagado, **contrastado contra `GET /afip/perfil`** en cada paso (`guardar_en_drive`
  pasó a `False` y volvió a `True`). No me creí la pantalla.
- Detalle: abre al tocar la card, cierra tocando afuera y con "Cerrar".
- **Emisión completa desde cero**: factura **N° 16, CAE 86290622591064**, $750, consumidor final.

**El caso que más engaña quedó ejercitado sin que lo buscara.** El archivado falló:

```
archivado en Drive falló para 6-16: toolkit 'googledrive' no conectado para el user
(ConnectedAccountNotFound)
```

La cuenta de pruebas no tiene Drive vinculado. Resultado: la emisión **no se rompió** (como
prometieron) y mi UI mostró el aviso de las 24 h en vez de "guardada en tu Drive" — que es justo lo que
habría fallado si el aviso colgara del ajuste.

**No, en device:** la rama **con** `drive_link` presente (aviso "no vence" + descarga desde Drive). No
pude ejercitarla porque ningún comprobante de este tenant tiene copia. Está cubierta por tests contra
el contrato exacto que me pasaron, y ustedes la verificaron por HTTP — pero **no la vi en el teléfono**,
y prefiero decirlo antes que contarla como verde. Si conectan Drive en el tenant de pruebas, la corro
en dos minutos.

---

## Dos defectos más que sólo el device mostró

Los anoto porque son trampas de esta cáscara y le van a pasar a quien toque la UI después:

1. **Un overlay absoluto montado DENTRO del scroll** se posiciona contra el CONTENIDO, no contra la
   pantalla. Con 20 comprobantes eso son miles de píxeles: el panel existía, respondía, y estaba fuera
   de cuadro. El `onPress` llegaba —lo verifiqué con un log— así que el sospechoso obvio (el gesto)
   era inocente.
2. **`CristalVidrio` tiene `flex: 1` interno**, y `flex:1` implica `flexBasis: 0`. Envolviendo contenido
   dentro de un padre de altura automática, colapsa a una línea de 1px. Está hecho para LLENAR un
   contenedor con altura. Ahora va de fondo con `absoluteFill` y el contenido manda la altura.

Ninguno de los dos lo podía ver un test de jsdom: los 296 pasaban en verde con el panel invisible.

---

## Estado

Gates: **296 jest (app) · 108 vitest (core) · tsc limpio · cero-hex**. Commit `0784588` en
`feat/mobile-first-cascara-glass`.

De mi lado no queda nada del handoff. **Adelante con tu pasada por HTTP** — y si querés que la parte de
Drive quede verde en device también, lo único que falta es Drive conectado en el tenant de pruebas.
