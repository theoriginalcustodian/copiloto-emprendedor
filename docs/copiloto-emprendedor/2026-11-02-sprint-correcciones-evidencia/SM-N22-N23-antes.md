# SM-N22 y SM-N23 — el ANTES, medido en device (sin código tocado)

**Medido:** 2026-11-02 21:02–21:12 · teléfono RF8T318RN9T · 720×1600 px · dev-client + Metro local desde `main`.
**Usuario:** cuenta del **operador** (la que estaba puesta; estructura, no datos: cualquiera sirve). Capturas **recortadas**: sin saldos ni mensajes.
**Pantalla:** **Mi día** (la que pidió el operador). Un fix verificado en otra pantalla no acredita N22.

## SM-N22 — el tirador queda debajo del campo
- Mi día con el panel abajo: composer en `dock-entrada-composer [0,1300][720,1450]` y el tirador (barra + «Escribile a Odobi») en la tira de abajo, **debajo** del campo (barra a y≈1527 vs campo y 1319–1416). → `SM-N22-1-…webp`.
- Campo enfocado con teclado: tocar el campo abre el chat (el panel sube), el composer queda sobre el teclado (`dock-entrada [0,778][720,928]`) y el tirador pasa arriba (`panel-handle [0,47][720,152]`), **no tapado**. La tira de abajo no existe en ese estado. → `SM-N22-2-…webp`.
- **Control (gestos que SÍ responden, `adb input motionevent` DOWN→MOVE→UP):** bajar el chat desde y=130 → `panel-handle` pasa a tamaño 0 y aparece el avatar (Mi día); subirlo desde la tira (y=1555→300) → `panel-handle` vuelve a `[0,47][720,152]`. O sea, el ADB ejercita el Pan: un «no se mueve» futuro no es del instrumento.

## SM-N23 — tirador de arriba pegado al borde
- Baseline numérico, arrastre DOWN→MOVE→UP de 1350 px, **N=6 por condición**, app al frente, chat arriba:
  - **desde y=50** (dentro de la zona del handle, que empieza en y=47): **6/6 mueven el panel, 0 sombra**.
  - **desde y=30** (encima de esa zona, sobre la barra de estado): **0/6 mueven el panel, 4/6 abren la sombra de notificaciones**, 2/6 nada.
- Lectura: el borde es exacto —`handle_top = insets.top = 47 px`, margen cero (`PanelDeslizable.tsx:434`)—; por encima gana el sistema, desde 47 gana la app. **El ADB inyecta el punto de partida que yo elijo**, así que **no reproduce el temblor de un dedo** que cae unos px encima del borde: lo que mide es dónde está la frontera, no cuántas veces falla una persona. El DoD «≥5 seguidas todas mueven, ninguna abre la sombra» se corre **después** del fix con el punto de partida en la zona nueva.
- → `SM-N23-1-…webp` (tirador de Mi día pegado al borde, barra a y≈20) y `SM-N23-2-…webp` (chat arriba, barra a y≈77).
- Número a reportar al mover el margen: px de margen quedados bajo `insets.top` (hoy **0**).

## Instrumento
Errores míos que invalidaron una corrida (descartada): mandé `keyevent 4` en bucle y la app salió al launcher; con la app fuera, cualquier arrastre desde y=30 abre la sombra. Las cifras de arriba son de la corrida con `mCurrentFocus` = app verificado antes de cada serie.
