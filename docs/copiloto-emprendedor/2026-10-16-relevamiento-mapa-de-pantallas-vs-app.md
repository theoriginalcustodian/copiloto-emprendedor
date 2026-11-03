# Relevamiento del mapa de pantallas contra la app (mobile)

> **Fecha:** 2026-10-16 · **Sesión:** frontend2 · **Complementa** `2026-10-16-relevamiento-concordancia-prototipo-vs-app-mobile.md` (misma fecha). **Sin cambios de código.**

**Qué es.** El mapa de pantallas (`Prototipo frontend/odobi-ui/mapa-pantallas/index.html`) lista 51 entradas (la portada dice «30»: ver N7). Este documento pone **cada una** contra lo que hay hoy en el teléfono y contra el código, con el veredicto, la diferencia exacta y lo que hay que corregir para que la app quede como el mapa. Además repasa las decisiones de los 14 mockups (`Prototipo frontend/odobi-ui/mockups/*/DECISIONES.md`).

**Cómo se midió.** Código = `origin/main` @`e024075b`, servido por Metro al dispositivo `RF8T318RN9T` (390 dp = 720×1600 px) con el usuario canónico. Prototipo = `?ver=<entrada>` a 393×852. Método por fila: **DEVICE** (capturado y mirado), **CÓDIGO** (leído en `apps/mobile` y `packages/core`), **NO-MEDIBLE** (exige audio real, un dato que no se puede fabricar o una acción irreversible). Un veredicto por CÓDIGO no prueba cómo se ve: dice qué texto y qué estructura hay.

## 1. Resumen

| Veredicto | Entradas |
|---|---|
| CONFORME | 7 |
| DIFERENTE | 37 |
| FALTA | 0 |
| NO-VERIFICABLE | 7 |
| **Total** | **51** |

De las 37 entradas que difieren: **31 son A** (falta o no hay decisión citable: se corrige la **app**) y **6 son B** (cambio deliberado con cita: se corrige el **mapa**). Método: CÓDIGO 3 · CÓDIGO+DEVICE 1 · DEVICE 38 · DEVICE+CÓDIGO 5 · NO-MEDIBLE 4.

Hallazgos nuevos de esta pasada (sección 4): 8 — 5 A, 1 D, 2 defectos del propio mapa o del prototipo.

Decisiones de mockups repasadas (sección 5): 28 — NO-VERIFICABLE 7, CONFORME 14, DIFERENTE 7.

**Lo que NO cubre.** Las entradas NO-VERIFICABLE (7) quedan sin medir por una razón escrita en cada fila: voz real, datos del tenant, acciones irreversibles, Google Calendar o un build de release. No se inventó ningún veredicto para ellas.

## 2. Las 51 entradas


### Arranque

**01 · `splash` — Splash** — **DIFERENTE · B** · CÓDIGO+DEVICE  
Prototipo: [splash](2026-10-16-relevamiento-capturas/proto-mapa-splash.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* La animación se midió en device (grabada, fotogramas a 1,5/s): estallido → círculo naranja → logo → «dobi» que se escribe → «Tu copiloto emprendedor» → «se dice o-DO-bi», unos 5 s; los botones aparecen antes de que termine. La variante de primera vez («Empecemos») no se vio: el teléfono ya tiene historial y muestra la de «volver». [app-reveal-animacion-fotogramas-1.5fps](2026-10-16-relevamiento-capturas/app-reveal-animacion-fotogramas-1.5fps.png)  
*Diferencia:* El prototipo lleva dos botones, «Empecemos» y «Crear una nueva cuenta». La app dibuja sólo el primero: no hay alta propia, el alta self-service es Google y «entrar» y «crear cuenta» son el mismo acto (`EntradaSesion.tsx:6-17`, decisión del operador #3, 2026-08-04). El copy y la marca coinciden (`TEXTOS_REVEAL.primeraVez`, `TAGLINE_MARCA`: «Tu copiloto emprendedor»). La animación de 6,8 s no se midió: exige cerrar la sesión del usuario canónico.  
*Corrección:* Quitar «Crear una nueva cuenta» del mapa (splash, reveal y volver) o reabrir la decisión #3.

**02 · `volver` — Volver a entrar** — **CONFORME** · DEVICE  
Prototipo: [volver](2026-10-16-relevamiento-capturas/proto-mapa-volver.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medido en device tras «Cerrar sesión»: «Entrar» y «Entrar con otra cuenta» (texto igual al mapa) con la animación del reveal. Detalle: el aviso de confirmación dice «volver a entrar con tu usuario y contraseña» aunque el operador entra con Google (B). [app-bienvenida-tras-cerrar-sesion](2026-10-16-relevamiento-capturas/app-bienvenida-tras-cerrar-sesion.png) · [app-cerrar-sesion-confirmacion](2026-10-16-relevamiento-capturas/app-cerrar-sesion-confirmacion.png)  
*Diferencia:* Los textos de las dos puertas salen de `TEXTOS_REVEAL.volver` («Entrar» / «Entrar con otra cuenta», `textosEntrada.ts:18`) y coinciden con el mapa. La animación no se midió (exige cerrar sesión).  
*Corrección:* Ninguna por copy. Falta medir la animación en device cuando haya un usuario descartable.

**03 · `ingresar` — Ingresar** — **DIFERENTE · A** · CÓDIGO  
Prototipo: [ingresar](2026-10-16-relevamiento-capturas/proto-mapa-ingresar.png) · App: [ingresar](2026-10-16-relevamiento-capturas/app-ingresar.png)  
*Diferencia:* Cambian el logo (con o sin cuadro), el relleno de campos y botones, y falta el aviso «Tu sesión se cerró por seguridad. Entrá otra vez y seguís donde estaba»: no aparece en ningún archivo de `apps/mobile` ni de `packages/core`.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El punto «falta el aviso de sesión cerrada» está VENCIDO: el aviso existe.** `MENSAJE_SESION_EXPIRADA` (`packages/core/src/api/sesion.ts:31`, «Tu sesión se cerró por seguridad. Entrá otra vez y seguís donde estabas.») lo arma `SessionProvider.tsx:89` y `PantallaLogin.tsx:280-285` lo pinta sólo si hubo cierre por seguridad y el form está en reposo; `EntradaSesion.tsx:17` fija que NO viaja al reveal (SM-N30 DoD 4). La corrección del corpus decía «ningún archivo de `apps/mobile` ni de `packages/core`»: era falso o ya dejó de serlo. **Lo que queda — logo con o sin cuadro, relleno de campos y botones — es sólo visual:** NO-VERIFICABLE-SIN-APP (device, SM-K6/SM-N30).  
*Re-medición 2026-11-03 (INSTRUMENTO: lectura de código sobre `origin/main` @61b684c2, contra `prototipo/index.html` `#ingresar` :2568; NO device, NO render):* el veredicto anterior se había medido ANTES de `ddccda38` (SM-N30), que cambió el lockup de esta pantalla, y se sostenía sólo en la ficha SM-K6 TERMINADO. Medido ahora, **sin usar el estado de la ficha:** **(a) CONFORME en el lockup:** símbolo desnudo terracota 38 (`PantallaLogin.tsx:137`, `index.html:2571` svg width 38) con `gap` 11 = 0,3×38 (`:132`, `.ig-marca gap:11px` :516); estructura, orden y copy de título / bajada / campos / error / botones / aviso / pie iguales al prototipo (`PantallaLogin.tsx:151-294` vs `index.html:2573-2600`). **(b) DIFERENTE en el wordmark «Odobi»:** el mapa lo pinta 32 px en `--terracota` #DE7250 (`.ig-marca .w` :517) y la app a `HERO = 34` (`PantallaLogin.tsx:25`) en `acentoTinta` #B04A2E (`:144`) — dos diferencias distintas, tamaño y color; el color además tiene un costo propio (#DE7250 como texto sobre crema es 2,86:1, así que alinearlo exige decidir si el wordmark cuenta como logotipo exento) y NO se toca acá. Es clase A (se corrige en la app) pero **es id nuevo, no reabre SM-N30 ni SM-K6.** **(c) Lo que queda sólo en device:** el relleno exacto de campos y botones, el borde rgba(26,21,18,.10) y el foco con halo (renderizado). Cuenta como DIFERENTE por (b), medido por código.  
*Exige del device:* captura de Login tras forzar un cierre por seguridad (token vencido) y del Login en reposo a 390 px, para ver logo con/sin cuadro, relleno de campos y botones contra `proto-mapa-login.png` (SM-K6/SM-N30).  
*Corrección:* Igualar la estructura del formulario al prototipo y agregar el aviso de sesión cerrada (el flujo de «sesión caída sola» ya va directo a este formulario, `EntradaSesion.tsx:25`).  
*Vínculo:* SM-K6 · F10 (padrón viejo)

**04 · `ingresar-error` — No coinciden** — **CONFORME** · DEVICE  
Prototipo: [ingresar-error](2026-10-16-relevamiento-capturas/proto-mapa-ingresar-error.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medido con contraseña mala a propósito: «Ese mail y esa contraseña no coinciden. Probá de nuevo.», igual al mapa; cambia el estilo (campos crema, logo con tile). [app-ingresar-error-clave-mala](2026-10-16-relevamiento-capturas/app-ingresar-error-clave-mala.png)  
*Diferencia:* El mensaje es idéntico: «Ese mail y esa contraseña no coinciden. Probá de nuevo.» (`textosEntrada.ts:7`), va entre los campos y los botones y en terracota profunda, como el mapa (`PantallaLogin.tsx:200-208`). No se provocó el error en device: habría fallado un ingreso del usuario canónico.  
*Corrección:* Ninguna por copy y posición. Falta ver el estado en device.

**05 · `entrada` — Entrada** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [entrada](2026-10-16-relevamiento-capturas/proto-mapa-entrada.png) · App: [mapa-entrada-arranque-1](2026-10-16-relevamiento-capturas/app-mapa-entrada-arranque-1.png) · [mapa-entrada-arranque-2](2026-10-16-relevamiento-capturas/app-mapa-entrada-arranque-2.png)  
*Diferencia:* El arranque en frío se grabó (60 cuadros): logo negro sobre crema, luego la carga del dev-client (fondo oscuro con el botón «Tools»), luego Mi día y, a los pocos segundos, **el chat sube solo** con el rótulo viejo («Escribile a Odobi»). El mapa dice que la entrada dura lo que tarda Mi día en cargar y aterriza en Mi día. La fase del dev-client contamina la medición: sólo un build de release da el tiempo real. Que el chat suba solo no se pudo atribuir a la app o a la restauración de estado del dev-client.  
*Corrección:* Medir con un build de release. Si el chat sube solo también ahí, es un defecto nuevo (se suma al R03).  
*Vínculo:* R03


### Capas

**06 · `base` — Mi día** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [base](2026-10-16-relevamiento-capturas/proto-mapa-base.png) · App: [midia-reposo](2026-10-16-relevamiento-capturas/app-midia-reposo.png) · [mapa-midia-caida](2026-10-16-relevamiento-capturas/app-mapa-midia-caida.png)  
*Diferencia:* Mi día en reposo: el prototipo muestra la cabecera dentro de una tarjeta («Odobi» + fecha) con avatar «M», la caja con el chip «−18% vs julio», la lista «Ahora» con la agenda y «Para hoy 4 cosas · Ver tablero ›». La app dibuja «Odobi» suelto, el chip de fecha, **el tablero embebido** (pestañas Para hoy / Haciendo / Hechas, filtros, «Anotar algo para hoy») y no tiene «Ver tablero ›» ni la tarjeta de cabecera. Además, los tres cuadros de la portada parten el monto en dos líneas (`$101.234,` / `00`): ver N1.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Los tres puntos estructurales del corpus ya están resueltos en código; lo que queda es visual.** El tablero ya NO va embebido: Mi día «resume, no gestiona» y lo manda a Tu día (`PantallaMiDia.tsx:37`); «Ver tablero ›» existe (`PantallaMiDia.tsx:301`, `testID` `midia-ver-tablero`); la tarjeta de cabecera `.stack` existe (`:247`) y la sección «Ahora» también (`:278`). El corte de los montos (N1) quedó resuelto en #1297. **No se puede afirmar por código** el chip «−18% vs julio», el avatar «M» ni que la cabecera asome como en el mapa: NO-VERIFICABLE-SIN-APP (device, SM-N1/SM-I1).  
*Medición 2026-11-03 16:40–16:43 (DEVICE, frontend1, SM-L4).* **Instrumento:** `adb` (`uiautomator dump` + `screencap`) sobre la app en el SM-M127F, cuenta `e2e-device@copiloto.test`, bundle de Metro `wt-fe1-h5` @`ef9c716b`; el código de `modules/midia` y `modules/apps` de ese bundle es idéntico a `origin/main` @`7fb1095e` (`git diff --stat` vacío). **Estructura: CONFORME en device.** Mi día muestra la cabecera en tarjeta («Odobi» + «Martes 3 de noviembre», `midia-cabecera`), la caja oscura («En caja $0,00», chip «Al 3 de noviembre», «Entró / Salió / Por cobrar» con «$205.000,00» en una línea), «Ahora 16:40» y «Para hoy 27 cosas · Ver tablero ›» (`midia-ver-tablero`); el tablero NO va embebido y el toque en «Ver tablero ›» abre `pantalla-tu-dia`. **Avatar «M»:** no hay avatar en Mi día — es decisión escrita, SM-N28 (#1435, `4376027d`: el avatar sale de Mi día y queda en Funciones), o sea B. **Sigue NO-VERIFICABLE por dos cosas que este tenant no puede mostrar:** (1) el chip «−18% vs mes anterior»: con Mercado Pago caído la app no dibuja variación a propósito (`PortadaNegocio.tsx:16`, test `:77`) y la caja avisa «Se cayó la conexión con Mercado Pago»; (2) la agenda de «Ahora» y «Ver agenda ›»: Google Calendar está caído y el bloque dice «Se cayó la conexión con Google Calendar». Ambas piden conexiones sanas y dos meses de historia; Calendar es OAuth de Composio, no se siembra. [app-l4-06-midia-base](2026-10-16-relevamiento-capturas/app-l4-06-midia-base.png)  
*Exige del device:* captura de Mi día a 390 px con los datos del canónico: chip «−18% vs julio», avatar «M» y cómo asoma la cabecera (SM-N1/SM-I1).  
*Corrección:* **DECIDIDO (operador, 2026-10-16, pregunta 4): gana el mapa.** Construir la tarjeta de cabecera, la lista «Ahora» y «Para hoy · Ver tablero ›» que abre una pantalla «Tu día». Pendiente de ficha (pedido a planificación).  
*Vínculo:* C1 · C3 · C5 · N1

**07 · `esc` — Funciones** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [esc](2026-10-16-relevamiento-capturas/proto-mapa-esc.png) · App: [escritorio](2026-10-16-relevamiento-capturas/app-escritorio.png) · [escritorio-dos-solapas](2026-10-16-relevamiento-capturas/app-escritorio-dos-solapas.png)  
*Diferencia:* El escritorio difiere en título, avatar y orden de la primera fila, y el estilo de los tiles; con el escritorio abierto la app muestra dos solapas apiladas, y esa segunda es deliberada (B, ver R02).  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El layout ya está implementado contra el mapa; lo que queda es la proporción visual.** `EscritorioFunciones.tsx:21` fija el layout `.esc` del prototipo (`index.html:1611-1631`, SM-I4): avatar a la altura de Mi día, título, grid de tiles y bloque negro con «Actividad reciente» tapeable. Las dos solapas apiladas con el escritorio abierto son deliberadas (B, R02). Etiquetarla A afirmaba una diferencia de título/orden/estilo que nadie midió contra el código actual. **Exige del device:** captura del escritorio abierto a 390 px, panel abierto y cerrado, para comparar orden de la primera fila y estilo de los tiles contra `proto-mapa-esc.png` (SM-I4).  
*Corrección:* Igualar título, orden y estilo de tiles (C1). Dejar R02 como está.  
*Vínculo:* C1 · R02

**08 · `chat` — Chat** — **DIFERENTE · B** · DEVICE  
Prototipo: [chat](2026-10-16-relevamiento-capturas/proto-mapa-chat.png) · App: [chat-abierto](2026-10-16-relevamiento-capturas/app-chat-abierto.png) · [mapa-chat-vacio](2026-10-16-relevamiento-capturas/app-mapa-chat-vacio.png)  
*Diferencia:* El contenido del estado en reposo coincide: «¿En qué te ayudo?», el ejemplo que gira («Gasté 15 lucas en nafta») y la línea fija «Antes de ejecutar algo importante, te lo muestro para que lo confirmes». Cambian la zona de entrada (botón de voz grande, más un «Pausar» que el mapa no tiene) y el botón de voz del campo.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **La zona de entrada ya es el dock del mapa; no queda botón de voz grande.** `ChatView.tsx:264` monta `DockEntrada` (campo + mic chico siempre visibles al pie, SM-I2 TERMINADO). «Pausar» ya no vive en reposo: sólo existe mientras se graba (`ControlesFlotantes.tsx:20,50`), que es el estado `grabando` (entrada 12), no éste. El contenido del estado en reposo ya coincidía según el propio corpus.  
*Corrección:* Mismo arreglo que R01: campo + mic chico siempre visibles al pie.  
*Vínculo:* SM-I2 · SM-J1 · R01 · C7 (padrón viejo)


### Estados

**09 · `tablero` — Tablero** — **DIFERENTE · A** · DEVICE  
Prototipo: [tablero](2026-10-16-relevamiento-capturas/proto-mapa-tablero.png) · App: [mapa-tablero-haciendo](2026-10-16-relevamiento-capturas/app-mapa-tablero-haciendo.png) · [mapa-tablero-hechas](2026-10-16-relevamiento-capturas/app-mapa-tablero-hechas.png) · [mapa-tablero-scroll](2026-10-16-relevamiento-capturas/app-mapa-tablero-scroll.png)  
*Diferencia:* Las pestañas Para hoy · Haciendo · Hechas, los contadores y la nota al pie («Las que detecta Odobi se cierran solas cuando hacés la acción real. Las que anotaste vos las movés vos.») existen y coinciden. Difieren: el tablero no es una pantalla propia («Tu día» con «Volver»), el título es «Mi día» y no «Tu día», y la app agrega filtros por categoría y un campo «Anotar algo para hoy».  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Tres de los puntos del corpus están vencidos; queda un agregado sin decisión escrita.** El tablero ya es pantalla propia «Tu día» (`PantallaTuDia.tsx:378`, `MarcoGlass titulo="Tu día"`) y vuelve al chat por el puente tarjeta → chat (`:272`). Los chips de categoría (`:114`) y «Anotar algo para hoy» (`:330`) existen en la app y el mapa no los cita: **no hay decisión escrita de que el mapa los incorpore**, por eso sigue A con la corrección nombrada (agregarlos al mapa o retirarlos, decisión del operador sobre alcance, ya prevista en la entrada).  
*Medición 2026-11-03 16:40–16:43 (DEVICE, frontend1, SM-L4).* **Instrumento:** `adb` (`uiautomator dump` + `screencap`) sobre la app en el SM-M127F, cuenta `e2e-device@copiloto.test`, bundle de Metro `wt-fe1-h5` @`ef9c716b`; el código de `modules/midia` y `modules/apps` de ese bundle es idéntico a `origin/main` @`7fb1095e` (`git diff --stat` vacío). **Los tres puntos del corpus quedan CONFORME en device:** es pantalla propia (`pantalla-tu-dia`), el título es «Tu día» y hay «‹ Volver» (`glass-volver`); también están el subtítulo «Lo que Odobi detectó y lo que anotaste vos.», «27 para hoy · 0 en curso», las pestañas «Para hoy 27 / Haciendo / Hechas» y los chips Todo · Cobros · ARCA · Presupuestos · Tuyas. **Sigue A:** hay un campo «Anotar algo para hoy» con «Agregar» que el mapa no tiene (`proto-mapa-tablero.png`) y no existe decisión escrita que lo avale. **No se vio:** el banner oscuro del certificado ARCA (exige un certificado por vencer) ni la nota al pie (no se desplazó la lista hasta el final). [app-l4-09-tablero-cargado](2026-10-16-relevamiento-capturas/app-l4-09-tablero-cargado.png)  
*Corrección:* **DECIDIDO (operador, 2026-10-16, pregunta 4): el tablero es pantalla propia, como en el mapa** («Tu día» con «Volver»). El resto (título «Tu día», filtros por categoría y «Anotar algo para hoy», que el mapa no cita) se decide al bajar la ficha.  
*Vínculo:* SM-I1 · C5 · F8 (padrón viejo)

**10 · `agenda` — Agenda** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [agenda](2026-10-16-relevamiento-capturas/proto-mapa-agenda.png) · App: [agenda](2026-10-16-relevamiento-capturas/app-agenda.png)  
*Medición 2026-11-02 (device):* Medida con Google Calendar reconectado (5 de 5 apps). Difiere del mapa; detalle en el doc de pendientes (00.bis). [app-agenda](2026-10-16-relevamiento-capturas/app-agenda.png) · [app-apps-conectadas-5-de-5](2026-10-16-relevamiento-capturas/app-apps-conectadas-5-de-5.png)  
*Diferencia:* La agenda sólo es comparable con Google Calendar conectado; en el canónico está caído (la app dice «Se cayó la conexión con Google Calendar» y oculta «Ver agenda», `PantallaMiDia.tsx:560-566`). Falta confirmar la línea del ahora (mockup 14).  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **La diferencia no es de contenido sino de ESTADO: sólo se compara con Google Calendar conectado** y en el usuario canónico está caído (`PantallaMiDia.tsx:560-566` oculta «Ver agenda» y dice «Se cayó la conexión con Google Calendar»). Etiquetarla A era afirmar una diferencia que nadie midió. NO-VERIFICABLE-SIN-APP hasta que haya Calendar conectado en el teléfono (SM-N34).  
*Exige del device:* Google Calendar conectado en el canónico y captura de la Agenda con la línea del ahora, contra el mockup 14 (SM-N34).  
*Corrección:* Reconectar Calendar en el usuario canónico y medir.  
*Vínculo:* SM-N34 · F9 (padrón viejo)

**11 · `detalle` — Detalle** — **CONFORME** · DEVICE  
Prototipo: [detalle](2026-10-16-relevamiento-capturas/proto-mapa-detalle.png) · App: [mapa-tarjeta-tocada](2026-10-16-relevamiento-capturas/app-mapa-tarjeta-tocada.png) · [mapa-tarjeta-manual-expandida](2026-10-16-relevamiento-capturas/app-mapa-tarjeta-manual-expandida.png)  
*Diferencia:* El mockup 14 deroga el sheet de detalle: la tarjeta se expande en su lugar. En la app, tocar «Presupuesto de Lucía» abre el detalle dentro de la fila (texto explicativo, Monto, Enviado y «Mandarle un recordatorio»). El sheet del prototipo quedó superado.  
*Corrección:* Ninguna en la app. Retirar el sheet del mapa si todavía figura.

**12 · `grabando` — Grabando** — **CONFORME** · DEVICE+CÓDIGO  
Prototipo: [grabando](2026-10-16-relevamiento-capturas/proto-mapa-grabando.png) · App: [grabando](2026-10-16-relevamiento-capturas/app-mapa-grabando.png) · [deslizando a la izquierda sin armar](2026-10-16-relevamiento-capturas/app-mapa-grabando-deslizando-izquierda-sin-armar.png)  
*Diferencia:* Medido en Gastos con un dedo sostenido (`adb shell input motionevent DOWN` sin `UP`, sin voz: no hace falta audio para ver la pantalla). Aparecen punto rojo, reloj «0:01» y «‹ Deslizá para cancelar» **debajo** del botón del micrófono, que se pone pálido; arriba, candado, flecha y una franja de onda. El prototipo lo dibuja como una barra al pie, «● 0:09 … deslizá para cancelar ‹», con el micrófono naranja a la derecha. Además el botón «Anotar un gasto» queda aplastado en columna y parte la palabra por sílabas («An/o/tar/un/ga/sto»), y el reloj choca con el chevron («0:01‹»). Causa: `BarraSostenida` se dibuja dentro de `MicFuncion` (`voz/MicFuncion.tsx:145`), en la columna angosta de la fila `filaConMic` (`PantallaGastos.tsx:262`, `:329`), en vez de reemplazar al campo; el comentario de `PistasVoz.tsx:85` dice que «no flota». Ver N8.  
*Medición 2026-11-03 (código en `origin/main`, SM-N31):* **La causa medida arriba ya no existe.** `PantallaGastos.tsx:317` monta `DockFuncion` → `DockEntrada` (SM-I2/J1), no `MicFuncion` con `BarraSostenida` en `filaConMic`. En `DockEntrada.tsx:42,150-152` la barra sostenida entra por `enLugarDelCampo` del `Composer`: reemplaza al campo en la misma fila, con el mic en su lugar; test `DockEntrada.test.tsx:108`. **Lo que el código NO puede decir** y por eso la etiqueta pasa de A a NO-VERIFICABLE y no a CONFORME: que en el teléfono la barra ocupe el ancho real al pie, que «Anotar un gasto» ya no se parta, y que el cancelar deslizando siga armando tras mover la zona del gesto (`BotonVoz.tsx`). Eso es una captura de device (`adb shell input motionevent` DOWN/MOVE).
*Corrección:* Que la barra de grabación ocupe el ancho al pie y reemplace al campo, como en el prototipo (N8). El cancelar al deslizar a la izquierda **sí funciona** (verificado en device con `adb`, ver N8: las corridas que no lo armaban medían en píxeles un umbral que está en dp).

> *Medición 2026-11-03 (device, bundle de Metro @ `ef9c716b`, SM-N31 DoD 4, capturas de frontend1 `b7-n31-grabando-sostenido-canonico` y `b7-n31-tras-cancelar-canonico`):* **CONFORME.** DOWN sostenido sobre el mic en Gastos: la barra (punto rojo, «0:02», «‹ Deslizá para cancelar») REEMPLAZA al campo al pie y ya no queda debajo del mic; "Anotar un gasto" no se parte. El cancelar deslizando (DOWN + MOVE izquierda + UP) vuelve al campo sin enviar. Límite declarado: sin voz real y sin comparar píxel a píxel con el prototipo.
**13 · `bloqueado` — Audio bloqueado** — **CONFORME** · DEVICE+CÓDIGO  
Prototipo: [bloqueado](2026-10-16-relevamiento-capturas/proto-mapa-bloqueado.png) · App: [bloqueado](2026-10-16-relevamiento-capturas/app-mapa-bloqueado.png)  
*Diferencia:* Con `DOWN` y seis `MOVE` hacia arriba (927 → 700 px) la grabación se fija: aparecen tacho, onda, reloj «0:02», pausa y enviar (círculo rojo). El prototipo los dibuja en una barra al pie con tacho, onda ancha, «0:09», pausa y enviar. En la app los controles flotan a media pantalla en lugar de ir en una barra al pie, la onda es angosta y el reloj la pisa, y «Anotar un gasto» colapsa a una tira vertical vacía a la derecha (mismo N8). Se descartó con el tacho: no se envió nada (la lista de gastos y el hilo del chat quedaron sin cambios).  
*Medición 2026-11-03 (código en `origin/main`, SM-N31):* Mismo cambio que `grabando`: ya no hay controles flotando a media pantalla en Gastos. Fijado, `DockEntrada.tsx:121-131` renderiza `ControlesFlotantes` (tacho, onda, reloj, pausa, enviar) y oculta el composer en vez de desmontarlo (`:134`, test `DockEntrada.test.tsx:128`). **NO-VERIFICABLE-SIN-APP:** si esa fila queda al pie a ancho completo con la onda ancha y sin que el reloj la pise exige captura de device.
*Corrección:* Mismo arreglo que «Grabando» (N8): barra al pie, de ancho completo.

> *Medición 2026-11-03 (device, bundle de Metro @ `ef9c716b`, SM-N31 DoD 4, captura de frontend1 `b7-n31-bloqueado-canonico`):* **CONFORME.** DOWN + 7 MOVE arriba + UP: barra al pie de ancho completo con tacho, onda ancha, «0:04», pausa y enviar; descartar con el tacho vuelve al campo sin enviar. Límite declarado: sin voz real y sin comparar píxel a píxel.
**14 · `card` — La card en la función** — **CONFORME** · DEVICE  
Prototipo: [card](2026-10-16-relevamiento-capturas/proto-mapa-card.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida por chat con un gasto de prueba: la card es editable con «Cancelar» y «Guardar»; el aviso coincide con la frase del código (decisión 8). [app-card-gasto-arriba](2026-10-16-relevamiento-capturas/app-card-gasto-arriba.png) · [app-card-gasto-abajo](2026-10-16-relevamiento-capturas/app-card-gasto-abajo.png) · [app-card-gasto-cancelada](2026-10-16-relevamiento-capturas/app-card-gasto-cancelada.png)  
*Diferencia:* La card de gasto aterrizando desde Gastos exige dictar o escribir un gasto: crea un dato en el tenant canónico. Por código, el aviso es «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.» (`TarjetaGastoPropuesto`); el mapa decía otra frase, corregida a la del código por la decisión 8 del operador (ver N3).  
*Corrección:* Medir con autorización explícita para generar el dato.  
*Vínculo:* K1

**15 · `vozchat` — Lo dictado, en el chat** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [vozchat](2026-10-16-relevamiento-capturas/proto-mapa-vozchat.png) · App: — (no capturada)  
*Diferencia:* Igual que «Grabando»: necesita una nota de voz real.  
*Corrección:* Medir con una persona.  
*Vínculo:* K1

**16 · `bi-vacio` — Sin ventas todavía** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [bi-vacio](2026-10-16-relevamiento-capturas/proto-mapa-bi-vacio.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida con el usuario descartable (tenant vacío): ceros, gráficos de 6 meses sin barras, «Sin gastos en este período.» y «Todavía no hay trabajos con presupuesto o factura para medir margen.». No hay mensaje global «Sin ventas todavía». [app-bi-vacio-arriba](2026-10-16-relevamiento-capturas/app-bi-vacio-arriba.png) · [app-bi-vacio-abajo](2026-10-16-relevamiento-capturas/app-bi-vacio-abajo.png)  
*Diferencia:* El estado sin ventas exige un tenant sin datos; el canónico tiene gastos. Fabricarlo sería borrar datos.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El estado «sin ventas» exige un tenant sin datos** y el canónico tiene gastos; fabricarlo sería borrar datos (regla del usuario canónico único). No hay diferencia medida: NO-VERIFICABLE-SIN-APP hasta que la tenencia provea un tenant vacío (SM-J3).  
*Exige del device:* un tenant SIN ventas (el canónico tiene gastos; fabricarlo borraría datos, prohibido por la regla del usuario único): lo provee backend/tenencia; después una captura del estado vacío (SM-J3).  
*Corrección:* Medir con un tenant vacío.  
*Vínculo:* F6

**17 · `bi-refresh` — Tirar para actualizar** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [bi-refresh](2026-10-16-relevamiento-capturas/proto-mapa-bi-refresh.png) · App: [mapa-bi-reposo](2026-10-16-relevamiento-capturas/app-mapa-bi-reposo.png) · [mapa-bi-tirando](2026-10-16-relevamiento-capturas/app-mapa-bi-tirando.png) · [mapa-bi-soltado](2026-10-16-relevamiento-capturas/app-mapa-bi-soltado.png)  
*Diferencia:* Tirar para actualizar funciona y muestra la línea «Actualizando…» como el mapa. Pero mientras se tira, el indicador nativo (círculo blanco con flecha) se dibuja encima del saldo; el prototipo sólo muestra la línea de texto.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **La causa medida está tratada en código; el efecto sólo lo ve un teléfono.** `PantallaInteligencia.tsx:181-189` saca el indicador nativo de pantalla (`progressViewOffset` negativo + `tintColor` transparente; el comentario documenta que `colors={['transparent']}` NO sirve en Android porque `CircularProgressDrawable` pisa el canal alfa). Que «la causa se fue» no prueba que el círculo ya no se dibuje sobre el saldo: eso es una captura de device (SM-N2).  
*Exige del device:* gesto de pull-to-refresh en Inteligencia con `adb input motionevent` DOWN/MOVE/UP (no `input tap`) y captura DURANTE el arrastre, para ver si el círculo del indicador nativo se dibuja sobre el saldo (SM-N2).  
*Corrección:* Ocultar el indicador nativo del `RefreshControl` (color transparente) y dejar la línea «Actualizando…».  
*Vínculo:* N2

**18 · `reveal` — El reveal** — **DIFERENTE · B** · CÓDIGO  
Prototipo: [reveal](2026-10-16-relevamiento-capturas/proto-mapa-reveal.png) · App: — (no capturada)  
*Diferencia:* **El punto «falta Crear una nueva cuenta» está VENCIDO:** el prototipo ya la oculta en el reveal (`.rv-ghost` con `display:none`, `index.html:2563`, «Sin alta propia (decisión #3)») y la app no la dibuja (`secundario === ''`, `RevealEntrada.tsx:219`). **El lockup es CONFORME:** símbolo desnudo 54 terracota + gap 16 + «Odobi» 46 px terracota con `letterSpacing -.02em` (`RevealEntrada.tsx:24,27,181-187,153` vs `index.html:468-469,2547-2554`), fondo en degradado (`:168-177` vs `:461`), «se dice o-DO-bi» y puerta «Empecemos». **Lo que difiere es el botón de altavoz:** el prototipo dibuja `.rv-say` (círculo blanco de 38 px con sombra, `index.html:2557-2559`) y la app no lo tiene — sólo el texto (`RevealEntrada.tsx:157-163`), porque el audio de la pronunciación está descartado (operador, 2026-11-03, `RevealEntrada.test.tsx:2,52`). La entrada decía que el altavoz «existe»: era falso.
*Corrección:* Quitar el botón de altavoz del reveal del mapa (`.rv-say`) — clase B, el mapa sigue a la decisión del operador.
*Re-medición 2026-11-03 (INSTRUMENTO: lectura de código sobre origin/main @809cc1fa, tras SM-Z2 `61b684c2`; NO device, NO render):* los píxeles (relleno, sombra, tipografía real) sólo se ven en device.

**19 · `onb-promesa` — La promesa** — **CONFORME** · DEVICE  
Prototipo: [onb-promesa](2026-10-16-relevamiento-capturas/proto-mapa-onb-promesa.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida con el usuario descartable: mismo copy («Laburo así…», «Tus servicios · 2 permisos»). El mapa asume Mercado Pago «Conectado ✓» y un solo CTA; la app muestra «Conectar Mercado Pago», «Conectar Google» y «Después». Hay un paso extra no mapeado («contame de tu negocio») con errores visibles antes de escribir. [app-onboarding-descartable-primer-ingreso](2026-10-16-relevamiento-capturas/app-onboarding-descartable-primer-ingreso.png) · [app-onboarding-paso-negocio-errores-prematuros](2026-10-16-relevamiento-capturas/app-onboarding-paso-negocio-errores-prematuros.png)  
*Diferencia:* Los 13 textos propios de la pantalla (incluida «Son dos minutos y te digo algo que no sabés.») están en `PantallaOnboarding.tsx` y `textosEntrada.ts`. No se vio en device: exige un usuario nuevo. La app suma un paso que el mapa no tiene (N4).  
*Corrección:* Ninguna por copy.  
*Vínculo:* N4

**20 · `onb-cumplida` — La promesa cumplida** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [onb-cumplida](2026-10-16-relevamiento-capturas/proto-mapa-onb-cumplida.png) · App: — (no capturada)  
*Diferencia:* El primer insight con plata real sólo se produce en la primera sesión de un tenant con datos de facturas. Los importes del mapa (`$147.000`, `$63.000`) son un ejemplo, no copy.  
*Corrección:* Medir con un usuario nuevo con facturas cargadas.  
*Vínculo:* N4

**21 · `consent` — Just-in-time consent** — **DIFERENTE · B** · DEVICE  
Prototipo: [consent](2026-10-16-relevamiento-capturas/proto-mapa-consent.png) · App: [chat-consent-gmail](2026-10-16-relevamiento-capturas/app-chat-consent-gmail.png)  
*Diferencia:* La hoja de permiso existe y no jerarquiza aceptar contra rechazar (deliberado, B). Faltan los íconos por capacidad y el banner «Apenas conectes sigo con lo tuyo».  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Los dos faltantes ya existen.** Banner «Apenas conectes sigo con lo tuyo:» en `SheetRequiereConexion.tsx:111`; ícono por capacidad en el mismo archivo (`testID` `sheet-requiere-conexion-icono-${i}`), con el comentario que fija que el nombre ya está en el texto y el glifo es acompañamiento. La no-jerarquía aceptar/rechazar es deliberada (B) según el propio corpus. Queda sólo la proporción visual (device, SM-I7).  
*Corrección:* Agregar íconos por capacidad y el banner de continuación.  
*Vínculo:* K6a · K6b

**22 · `caida` — Conexión caída** — **DIFERENTE · B** · DEVICE — **copy RESUELTO** (decisión del operador, 2026-10-16: gana la frase del código; se corrigió el mapa)  
Prototipo: [caida](2026-10-16-relevamiento-capturas/proto-mapa-caida.png) · App: [mapa-midia-caida](2026-10-16-relevamiento-capturas/app-mapa-midia-caida.png)  
*Diferencia:* La portada admite estar incompleta, como el mapa, pero el copy es otro: el mapa dice «faltan los cobros de hoy — Mercado Pago está caído» en una línea bajo el monto; la app dice «Se cayó la conexión con Mercado Pago: faltan los cobros de hoy, así que estos números pueden estar incompletos.» y agrega un segundo aviso de Google Calendar. Los montos de los tres cuadros se parten en dos líneas.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Todo lo que difería está resuelto o decidido por escrito.** El copy de Mercado Pago se alineó con la frase del código por decisión del operador (2026-10-16); el aviso de Google Calendar que la app agrega existe (`PantallaMiDia.tsx:384`, «Se cayó la conexión con Google Calendar. Reconectala en Ajustes → Apps…») y el operador decidió que **se agrega al mapa**; el corte de los montos (N1) quedó en #1297. No queda diferencia sin decidir.  
*Corrección aplicada:* el copy de Mercado Pago se alineó con la frase del código (prototipo, `specs/mobile-coherencia.md` y la nota del mockup 02; mismo criterio que la decisión 8); el corte de los montos (N1) quedó resuelto en #1297. *Decidido (operador, 2026-10-16):* el segundo aviso de Google Calendar que la app agrega **se agrega al mapa**.  
*Vínculo:* C3 · N1

**23 · `preg` — Pregunta libre** — **CONFORME** · DEVICE  
Prototipo: [preg](2026-10-16-relevamiento-capturas/proto-mapa-preg.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida por chat («cuánto facturé»): responde dentro del hilo. [app-preg-cuanto-facture](2026-10-16-relevamiento-capturas/app-preg-cuanto-facture.png)  
*Diferencia:* La pregunta libre se contesta con un mensaje real al agente: consume una acción del plan y escribe en el hilo del canónico (el clasificador de permisos lo denegó). Además la app resuelve «Preguntar» saliendo al chat (decisión del 2026-10-13), no con una respuesta dentro de Inteligencia.  
*Corrección:* Medir con autorización explícita.  
*Vínculo:* F6b

**24 · `recibo` — El comprobante** — **CONFORME** · DEVICE  
Prototipo: [recibo](2026-10-16-relevamiento-capturas/proto-mapa-recibo.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medido con un presupuesto de prueba: card «Presupuesto anotado — N° 2» con «Doc» y la meta «✓✓ recibido». [app-pres-guardado-y-card-calendar-confirmado](2026-10-16-relevamiento-capturas/app-pres-guardado-y-card-calendar-confirmado.png)  
*Diferencia:* El comprobante tras ejecutar exige confirmar una acción real. Por código el recibo existe (`chat/Recibo.tsx`) y la meta «✓✓ recibido» también (C8).  
*Corrección:* Medir con una acción de prueba autorizada.  
*Vínculo:* C8

**25 · `fact-voz` — Facturar por voz** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [fact-voz](2026-10-16-relevamiento-capturas/proto-mapa-fact-voz.png) · App: — (no capturada)  
*Diferencia:* Facturar por voz exige dictado y datos reales de un cliente.  
*Corrección:* Medir con una persona y un cliente de prueba.  
*Vínculo:* K2

**26 · `fact-hitl` — Segundo HITL — emitir** — **DIFERENTE · B** · DEVICE  
Prototipo: [fact-hitl](2026-10-16-relevamiento-capturas/proto-mapa-fact-hitl.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida con facturas reales en Producción (N° 10 y N° 11, $100): la card «Factura C · ARCA» es gate + handoff con un solo botón «Emitir la factura»; falta **Editar** (todos los datos) y **Cancelar**. Defecto grave: cancelar por chat no desactiva la card. [app-mapa-fact-hitl-sin-boton-editar](2026-10-16-relevamiento-capturas/app-mapa-fact-hitl-sin-boton-editar.png) · [app-fact-hitl-cancelada-por-chat-sigue-emitible](2026-10-16-relevamiento-capturas/app-fact-hitl-cancelada-por-chat-sigue-emitible.png)  
*Diferencia:* La confirmación para emitir (Segundo HITL) no se provocó: emitir es irreversible. Por código: «Esto entendí. Revisalo y tocá Emitir la factura — todavía no la mandé.» y encabezado «Factura C · ARCA» (`TarjetaFacturaPropuesta.tsx:187-202`). El mapa dice «Queda así. Revisala antes de emitir» y «Una factura emitida no se borra».  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Las diferencias medidas el 2026-11-02 ya no existen en el código.** La card ofrece Editar, Cancelar y «Emitir la factura» (`TarjetaFacturaPropuesta.tsx:499,506,515`, SM-H1 #1328; docstring `:43`). Cancelar por chat ya apaga la card: rama `estado === 'cancelada'` en `:196` (`testID` `-cancelada`, título «Factura cancelada.» `:201`) y `:53`; hasta la primera lectura no hay Emitir activo (`:120`). **Lo único pendiente es la recaptura en device** de la card (Editar/Cancelar visibles y la card cancelada): el código ya es conforme, por eso es B y no NO-VERIFICABLE.  
*Corrección:* Medir en homologación, nunca en producción.  
*Vínculo:* K2

**27 · `fact-cae` — Emitida — el CAE** — **DIFERENTE · B** · DEVICE  
Prototipo: [fact-cae](2026-10-16-relevamiento-capturas/proto-mapa-fact-cae.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida con las facturas reales N° 10/11: «Factura emitida.» sin cliente ni número formateado; Drive/Compartir sin mail. Detalle en el doc de pendientes (00.bis).  
*Diferencia:* El CAE sólo existe tras emitir una factura real.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Las diferencias medidas el 2026-11-02 ya no existen en el código.** El recibo móvil lista «Número · importe · cliente · CAE · vencimiento del CAE» (`comprobante.tsx:56`, `TarjetaComprobante.tsx:58`, SM-H5/H6 #1354). La acción de mail existe: `comprobante.tsx:145` llama `mailtoMandarFactura(numeroFormateado(...), link)` (la medición de «Drive/Compartir sin mail» es de 2026-11-02 y el código se movió después). El literal pelado «Factura emitida.» sobrevive sólo en `copiloto-web`, no en mobile. **Pendiente: recaptura en device del recibo** (no de una factura nueva: sirve una ya emitida).  
*Corrección:* Medir en homologación.  
*Vínculo:* K2

**28 · `pres-voz` — Presupuesto por voz** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [pres-voz](2026-10-16-relevamiento-capturas/proto-mapa-pres-voz.png) · App: — (no capturada)  
*Diferencia:* Igual que «Facturar por voz».  
*Corrección:* Medir con una persona.  
*Vínculo:* K3

**29 · `pres-hitl` — La tarjeta editable** — **DIFERENTE · A** · DEVICE  
Prototipo: [pres-hitl](2026-10-16-relevamiento-capturas/proto-mapa-pres-hitl.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida por chat: la app muestra un formulario editable (Concepto, Cliente, Tipo de documento, Contacto, Ítems, «Agregar ítem», «Guardar el presupuesto», «Cancelar»); el mapa, una vista de lectura con «Cambiar»/«Editar» por renglón y chip «Docs». [app-pres-hitl-tarjeta-editable](2026-10-16-relevamiento-capturas/app-pres-hitl-tarjeta-editable.png)  
*Diferencia:* Por código el aviso es «Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar el presupuesto — todavía no lo anoté. Al guardar, a tu cliente no le llega…» (`TarjetaPresupuestoPropuesto.tsx:126`): coincide con la idea del mapa («Todavía no lo anoté»). El botón difiere: «Guardar presupuesto» (mapa) contra «Guardar el presupuesto».  
*Corrección:* Medir con una propuesta real; igualar el rótulo del botón.  
*Vínculo:* K3

**30 · `pres-ciclo` — El ciclo** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [pres-ciclo](2026-10-16-relevamiento-capturas/proto-mapa-pres-ciclo.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medido: anotado → «Me aprobaron el de Mostrador Device Verify» → desambigua → «Marqué el presupuesto número 2 … como aprobado. ¿Te armo la factura para esto?». Difieren el rótulo del chip, el importe en formato inglés («$50,000.00») y que la card «anotado» no muestre «Pendiente». El último paso (armar la factura) no se ejecutó. [app-pres-ciclo-desambigua](2026-10-16-relevamiento-capturas/app-pres-ciclo-desambigua.png) · [app-pres-ciclo-aprobado](2026-10-16-relevamiento-capturas/app-pres-ciclo-aprobado.png)  
*Diferencia:* El ciclo anotado → aprobado → factura exige varios pasos reales.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El ciclo anotado → aprobado → factura exige varios pasos reales** con un presupuesto de prueba que escribe en la base. Nadie lo midió, así que «A» era una etiqueta de espera, no un hallazgo. NO-VERIFICABLE-SIN-APP (device + datos, SM-H5/SM-K3).  
*Exige del device:* recorrer anotado → aprobado → facturado con un presupuesto de prueba (escribe en la base: requiere autorización) y una captura por paso (SM-H5/SM-K3).  
*Corrección:* Medir con un presupuesto de prueba.  
*Vínculo:* K3

**31 · `limite` — El límite** — **DIFERENTE · B** · CÓDIGO — **RESUELTO** (decisión del operador, 2026-10-16: VISIÓN post-beta)  
Prototipo: [limite](2026-10-16-relevamiento-capturas/proto-mapa-limite.png) · App: — (no existe)  
*Diferencia:* Cambio deliberado con cita: «Plan y límites no entran en la beta» (DEC-8, operador, 2026-09-21, `2026-09-21-acta-decisiones-beta-odobi.md:18`; `BL-X9` → `BL-V2`; `plan` y `limite` son VISIÓN en `BL-P5`). La app no tiene pantalla de límite y no hay nada que medir en device; un test lo fija para «Mi plan» (`PantallaAjustes.test.tsx:54`, «no hay tile Mi plan»). El mapa sigue dibujándola.  
*Corrección aplicada:* el mapa la marca «VISIÓN post-beta» y cita DEC-8. El backlog ya la dejaba fuera de la beta (`BL-X9` → `BL-V2`); `PLAN.md` (carpeta de planificación) se pidió por el buzón.  
*Vínculo:* F7b

**32 · `vacio-visto` — Calma, ya conocida** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [vacio-visto](2026-10-16-relevamiento-capturas/proto-mapa-vacio-visto.png) · App: — (no capturada)  
*Diferencia:* En el prototipo `?ver=vacio-visto` no muestra su estado (hallazgo del propio mapa). Por código la app dibuja «Nada urgente por hoy.» y varía la calma por días (`PantallaMiDia.tsx:661`, `EstadoVacio.tsx`). El canónico tiene tarjetas, así que no se ve.  
*Corrección:* Corregir el deep link del prototipo para que muestre el estado.  
*Vínculo:* N5

**33 · `comousar` — Cómo usar la app** — **CONFORME** · DEVICE+CÓDIGO  
Prototipo: [comousar](2026-10-16-relevamiento-capturas/proto-mapa-comousar.png) · App: [comousar-0](2026-10-16-relevamiento-capturas/app-comousar-0.png)  
*Diferencia:* Sólo cambia el contenedor (tarjeta única contra una por fila) y el número en círculo contra numeral.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El círculo numerado ya está; queda el contenedor.** `PantallaComoUsarLaApp.tsx` pinta cada tema con su `Row` y el número en círculo (SM-K7, TERMINADO `926163a4`, captura `SM-K7-como-usar.webp`). Sigue A sólo por el contenedor: una tarjeta por fila contra la tarjeta única del mapa. Corrección nombrada: un único `MarcoGlass`/superficie para las filas, o llevar el mapa a una por fila (wording/estructura menor, lista única).  
*Medición 2026-11-03 (**instrumento: render jest + lectura de código, NO la app desplegada ni adb** · SM-L4, `origin/main` @ `a2ec0a02`; jest `PantallaComoUsarLaApp` 7/7):* **La línea anterior («queda el contenedor») está vencida:** SM-N42 p4 (#1516, `1fc5f281`) llevó la APP a la tarjeta única del prototipo (`s-comousar`, `.grupo`): `PantallaComoUsarLaApp.tsx:96-110` pinta los cinco temas en UNA `Row` con filetes hairline entre ellos, y el número en círculo está en `:117`. Test `SM-N42 p4: los cinco temas viven en UNA sola tarjeta`. Contenedor y numeración coinciden con el mapa.  
*Corrección:* Igualar contenedor y numeración.  
*Vínculo:* F11-comousar

**34 · `soporte` — Soporte técnico** — **DIFERENTE · B** · CÓDIGO  
Prototipo: [soporte](2026-10-16-relevamiento-capturas/proto-mapa-soporte.png) · App: [soporte](2026-10-16-relevamiento-capturas/app-soporte.png)  
*Diferencia:* Falta el clip de adjuntar; la app suma el botón de voz grande y párrafos de aclaración. La barra con campo y mic existe en ambos. El hilo es dato del tenant.  
*Corrección:* Agregar el clip; quitar el botón de voz grande si el mapa manda.  
*Medición 2026-11-03 (código, prototipo `prototipo/index.html:2154-2210` contra `PantallaSoporte.tsx`):* (1) **El clip YA existe**: `PantallaSoporte.tsx:168` pasa `onFoto` al dock y `Composer.tsx:76,145` lo dibuja; test `PantallaSoporte.test.tsx:514`. El «Falta el clip» de arriba quedó vencido (SM-K7). (2) Las divergencias que quedan son de **texto y están decididas por escrito**: sin «Antes de 4 h hábiles» porque no hay SLA vigente (`textosSoporte.ts:3-5`, `BL-O7`); «qué viaja» dice asunto + resumen y no «esta conversación» porque es lo único verificado (`textosSoporte.ts:7-9`); el avatar es el isotipo y no el escudo del prototipo, decisión del 2026-09-18 (`PantallaSoporte.tsx:111-120`). (3) **NO-VERIFICABLE-SIN-APP**: si el dock se ve como «botón de voz grande» (la queja del corpus) exige ver la app corriendo; por código el mic es el del `DockEntrada` común. No se marca conforme por las dudas.
*Vínculo:* F11-soporte-hilo · F11-soporte-ticket

**35 · `feedback` — Contanos qué tal** — **DIFERENTE · B** · CÓDIGO  
Prototipo: [feedback](2026-10-16-relevamiento-capturas/proto-mapa-feedback.png) · App: [feedback-0](2026-10-16-relevamiento-capturas/app-feedback-0.png)  
*Diferencia:* Estructura: campo dentro o fuera de tarjeta; «Mandar» sólido contra deshabilitado; el mes va a la derecha en el prototipo y debajo en la app.  
*Corrección:* Igualar estructura y posición del mes.  
*Medición 2026-11-03 (código, prototipo `prototipo/index.html:2181-2210` contra `PantallaFeedback.tsx`):* (1) **El mes ya va a la derecha** de cada fila (`LoPedisteVos.tsx:63-71`, `.cuando` del mapa; SM-K7 TERMINADO). (2) Bajada, pregunta «¿Qué le cambiarías?», placeholder, «Dictarlo»/«Mandar» y la nota de derivación a Soporte coinciden con el prototipo (`PantallaFeedback.tsx:111-133,151,181,222`). (3) **Diferencia que queda y es deliberada**: «Mandar» está deshabilitado con el campo vacío (`PantallaFeedback.tsx:184`, `deshabilitado: !puedeEnviarTexto`); el prototipo lo dibuja siempre sólido. Es un guard (no mandar vacío), no un descuido. (4) **NO-VERIFICABLE-SIN-APP**: si el `CampoTexto` queda dentro de una tarjeta blanca como `.redactar` o suelto exige ver el render; por código no se decide.
*Vínculo:* F11-feedback

**36 · `hitl` — Confirmación** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [hitl](2026-10-16-relevamiento-capturas/proto-mapa-hitl.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medida por chat: el pedido «Mandale un recordatorio por mail a Lucia para mañana» produjo una card de Google Calendar («agendar «Recordatorio para Lucía»») y no un mail Gmail con «Confirmar y mandar». Al cancelar, la card siguió con ambos botones y luego pasó a «✓ Confirmado» aunque no se creó evento (servidor verificado). [app-hitl-recordatorio-lucia](2026-10-16-relevamiento-capturas/app-hitl-recordatorio-lucia.png) · [app-hitl-cancelada-card-sigue-visible](2026-10-16-relevamiento-capturas/app-hitl-cancelada-card-sigue-visible.png)  
*Diferencia:* La confirmación de «Recordatorio a Lucía» (patrón madre, «Confirmar y mandar» / «Cancelar») exige un mensaje real que no se mandó: escribiría en el hilo del canónico y mandaría un mail. Mockup 04: el ícono del ojo y «Un solo mail, ahora. No se manda nada sin tu confirmación.»  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **La confirmación «Recordatorio a Lucía» exige mandar un mail real** desde la cuenta del canónico; no se provocó y por código no hay comparación posible sin ejecutarla. NO-VERIFICABLE-SIN-APP: necesita autorización explícita y un destinatario de prueba (SM-K1/SM-K5).  
*Exige del device:* autorización explícita del operador para mandar UN mail real desde la cuenta del canónico a un destinatario de prueba, y captura de la confirmación «Recordatorio a Lucía» (SM-K1/SM-K5).  
*Corrección:* Medir con autorización explícita y un destinatario de prueba.  
*Vínculo:* K1-K5

**37 · `vacio` — Mi día sin avisos** — **CONFORME** · DEVICE+CÓDIGO  
Prototipo: [vacio](2026-10-16-relevamiento-capturas/proto-mapa-vacio.png) · App: — (no capturada)  
*Medición 2026-11-02 (device):* Medido en device con el descartable: «Nada urgente por hoy. Cuando haya algo que mirar, te lo dejo…» con ilustración y aviso «Conectá Google Calendar en Ajustes → Apps». Sigue sin veredicto porque el prototipo `?ver=vacio` no muestra su estado (N5). [app-vacio-nada-urgente-por-hoy](2026-10-16-relevamiento-capturas/app-vacio-nada-urgente-por-hoy.png)  
*Diferencia:* En el prototipo `?ver=vacio` tampoco muestra su estado. Por código: «Nada urgente por hoy.» (`PantallaMiDia.tsx:661`).  
*Medición 2026-11-03 (**instrumento: SOLO lectura de código, sin ejercitar la app** · SM-L4, `origin/main` @ `a2ec0a02`):* **El motivo de NO-VERIFICABLE («el prototipo `?ver=vacio` no muestra su estado») está resuelto:** el prototipo implementa el deep link (`prototipo/index.html:3168-3171`, arranca sin tarjetas) y su estado `#vacio` dice «Nada urgente por hoy.» (`:1851`). La app dice lo mismo (`PantallaMiDia.tsx:327`, `PantallaTuDia.tsx:465`; test `PantallaTuDia.test.tsx:499`) y se midió en device el 2026-11-02 con ilustración y aviso de Calendar. Ambos lados con el mismo texto. No medí el prototipo renderizado (el navegador de la sesión bloquea `file:`): la afirmación sobre el prototipo es de código.  
*Corrección:* Corregir el deep link del prototipo.  
*Vínculo:* N5


### Funciones

**38 · `gastos` — Gastos** — **DIFERENTE · B** · DEVICE  
Prototipo: [gastos](2026-10-16-relevamiento-capturas/proto-mapa-gastos.png) · App: [gastos-top](2026-10-16-relevamiento-capturas/app-gastos-top.png) · [funcion-gastos](2026-10-16-relevamiento-capturas/app-funcion-gastos.png)  
*Diferencia:* Sin dock con campo y mic, sin «Ticket», sin rótulo «ÚLTIMOS»; campo BUSCAR que el prototipo no tiene.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Los tres faltantes ya están y BUSCAR es una enmienda fundada.** Dock con campo y mic: `PantallaGastos.tsx:317` (`DockFuncion` → `DockEntrada`, SM-I2/J1). «Ticket»: `FotoFuncion.tsx:101`. Rótulo «Últimos»: `PantallaGastos.tsx:290` (`rotuloLista`, `BuscadorActividad.tsx:45`). BUSCAR se queda: enmienda **E-1** del backlog (`2026-11-02-BACKLOG-sprint-correcciones-mapa.md:302`), que da el `path:línea` y el motivo. **Lo que queda es visual (SM-J1 captura a 390 px), no una diferencia de contenido.**  
*Corrección:* Agregar el dock y «Ticket»; decidir qué hacer con BUSCAR.  
*Vínculo:* F1 · F12

**39 · `ingresos` — Ingresos** — **DIFERENTE · B** · DEVICE  
Prototipo: [ingresos](2026-10-16-relevamiento-capturas/proto-mapa-ingresos.png) · App: [ingresos-top](2026-10-16-relevamiento-capturas/app-ingresos-top.png)  
*Diferencia:* Sin dock; la nota de Mercado Pago no se ve en la captura (puede estar bajo el pliegue). «Anotar que me pagaron» sí existe como verbo de alta.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Dock presente; la nota de Mercado Pago se retiró a propósito.** Dock: `PantallaIngresos.tsx:298` (`DockFuncion`). El aviso «los cobros por MercadoPago todavía no entran solos» lo retiró COBROMP (`9e4a70dc`): `ResumenIngresos.tsx:14-15`, porque un pago aprobado ya se vuelve Ingreso con `origen: 'mercadopago'`. Rótulo «Últimos»: `PantallaIngresos.tsx:236`. Si el mapa todavía la dibuja, el punto vencido es del mapa (el aviso decía algo que dejó de ser cierto), no de la app.  
*Corrección:* Agregar el dock.  
*Vínculo:* F2 · F12

**40 · `factura` — Facturación** — **DIFERENTE · B** · DEVICE  
Prototipo: [factura](2026-10-16-relevamiento-capturas/proto-mapa-factura.png) · App: [facturacion-top](2026-10-16-relevamiento-capturas/app-facturacion-top.png)  
*Diferencia:* Faltan «N facturas · N impaga», los chips por fila y el dock. «Te deben» no existe en el prototipo.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Cada punto del corpus está resuelto o decidido en contra por escrito.** Dock: `PantallaFacturacion.tsx:696` (`DockAlChat contexto="factura"`, #1456). «N facturas · N impaga» NO se agrega: enmienda **E-3** (backlog `:304`) y `ResumenFacturado.tsx:12-14` — la portada no trae conteos y derivarlos del listado paginado daría dos verdades para una pregunta. Chips por fila: SM-J2 TERMINADO `sin-codigo` — premisa refutada, existen en `TarjetaCliente.tsx` y los dos apagados lo están por decisión documentada. «Te deben» se queda: enmienda **E-2** (`SeccionMeDeben.tsx:39`).  
*Corrección:* Agregar chips y dock; retirar «Te deben» o documentarlo.  
*Vínculo:* F3 · F12

**41 · `presu` — Presupuestos** — **CONFORME** · DEVICE+CÓDIGO  
Prototipo: [presu](2026-10-16-relevamiento-capturas/proto-mapa-presu.png) · App: [presupuestos-top](2026-10-16-relevamiento-capturas/app-presupuestos-top.png)  
*Diferencia:* Sin dock ni chips de antigüedad.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El dock ya existe; queda el chip de antigüedad por fila.** Dock: `PantallaPresupuestos.tsx:339` (`DockFuncion`). La antigüedad aparece sólo en el resumen de arriba («Sin respuesta hace más de un mes», `resumenEspera.ts:74`) y en el detalle (`DetallePresupuesto.tsx:396`); **no hallé un chip por fila** al grepear `antig|hace|chip` en `presupuestos/`. Sigue A con la corrección acotada: chip de antigüedad por tarjeta de la lista.  
*Medición 2026-11-03 (**instrumento: render jest + lectura de código, NO la app desplegada ni adb** · SM-L4, `origin/main` @ `a2ec0a02`; jest `presupuestos/` 48/48):* **Las dos diferencias de la entrada ya no existen.** (1) Dock con campo y mic: `PantallaPresupuestos.tsx:339` (`DockFuncion`). (2) Antigüedad por fila: `TarjetaPresupuesto.tsx:40` pinta `etiquetaEstado(p)` (`resumenEspera.ts`), «Se enfría · N días» / «Esperando respuesta · N días» con los días de `fecha`, como el prototipo (`prototipo/index.html:2083`); test `TarjetaPresupuesto.test.tsx:31-34` («Se enfría · 31 días»). La medición anterior («no hallé un chip por fila») quedó vencida por SM-J4. Medido sobre el componente renderizado, no deducido de que SM-J1/J2/J4 estén TERMINADO.  
*Corrección:* Agregar chips de antigüedad y dock.  
*Vínculo:* F4 · F12

**42 · `bi` — Inteligencia de Negocio** — **NO-VERIFICABLE** · DEVICE  
Prototipo: [bi](2026-10-16-relevamiento-capturas/proto-mapa-bi.png) · App: [inteligencia-top](2026-10-16-relevamiento-capturas/app-inteligencia-top.png) · [mapa-bi-reposo](2026-10-16-relevamiento-capturas/app-mapa-bi-reposo.png)  
*Diferencia:* ⚠️ **Este resumen estuvo INCOMPLETO del 2026-10-16 al 2026-11-03** y la
corrección es la parte útil de la entrada: enumeraba **tres** faltantes cuando faltan **cuatro
secciones enteras** más detalles. Se había escrito mirando la captura del prototipo, que está
**recortada a la mitad de arriba**; reescrito el 2026-11-03 contra el **DOM del prototipo vivo**
(`?ver=bi`, contenedor `#bi-scroll`), que es completo por construcción. **Un corpus de comparación se
arma contra el DOM o contra la pantalla scrolleada entera, nunca contra una captura del tope**
— un inventario leído de un `.png` termina donde termina la imagen, y nada en el resultado delata
que faltó la mitad.
**Las ONCE secciones del mapa, en orden:** 1 «Tirá para actualizar» · 2 card blanca con nombre +
período · 3 card negra Saldo en caja / Entró / Salió · 4 **Este mes** (Ingresos·Gastos·Facturado·Cobrado)
· 5 **Rentabilidad** · 6 **Por cobrar** + «$X vencidos» · 7 **En qué se te va la plata** (desglose por
categoría) · 8 **Entró vs. salió** · 9 **Mejores clientes** (con «N comprobantes» y su vacío propio) ·
10 **Acumulado del año** + barra «68% del tope» + línea del monotributo · 11 **Margen por trabajo**;
más el dock, fuera del scroll.
**Faltan en la app:** las secciones **6, 7, 11**, la **barra del tope y la línea del monotributo** de
la 10, «N comprobantes» y el vacío propio de la 9 — además de la etiqueta de mes, los mosaicos y el
dock que esta entrada ya nombraba. La **7** no es decoración: el mockup 12 la declara el corazón de la
pantalla (*«el desglose por categoría con su porcentaje es lo que el repo define como resumen
mensual… es la respuesta a "en qué se me va la plata"»*).
**Sobran en la app:** una sección **«FACTURACIÓN»** con gráfico de barras que el mapa no dibuja, y los
montos en **verde/rojo**, paleta que el mockup 12 **derogó explícitamente** (*«traía una paleta
semántica que el sistema no tiene y competiría con el único acento»*) — fue considerada y rechazada,
no es un olvido.
→ **Ficha `SM-N32`**, dueño frontend2. El lado **app** de esta entrada sigue siendo del 2026-10-16:
re-verificar en device antes de implementar. El título está suelto con ícono, no dentro de una card blanca con período (mockup 12: «nombre y período en la card blanca»); «Volver» ya va a la izquierda con chevron (N6, decisión 7). La regla del dato faltante sí se cumple: Rentabilidad muestra «—» y la explicación, no «$0» (decisión del mockup 12). 🔴 **Los dos botones «Resumen»/«Preguntar»: esta entrada los clasificó `B` y con eso los
dio por BUENOS.** Decía *«La pestaña «Preguntar» es una salida al chat (B)»*, y `B` significa «gana
la app, se enmienda el mapa» — así que **nunca fueron tarea de nadie** y el operador los vio en
device el 2026-11-03, 18 días después. **Un elemento mal clasificado no genera trabajo y ningún
barrido lo levanta: los controles cazan lo NO clasificado, nunca lo clasificado MAL.** El mapa **no
los dibuja** y declara la baja en pasado: *«la misma duplicación que **sacamos** con la solapa
"Preguntar" de Inteligencia»* (`mapa-pantallas/index.html:240`). El veredicto de esta frase se
corrige a **`A`** (gana el mapa, se retiran) **midiendo la app en device**, que es el paso 1 del DoD
de `SM-N32`; antes de retirar «Preguntar» hay que medir a dónde va hoy, porque si es el único acceso
a ese camino se retira **junto con** el dock que lo reemplaza, no antes.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Las secciones que faltaban están implementadas (SM-N32, DOD-PARCIAL: `acdbff54` #1460 + backend `5928f837` #1459); lo único que falta es la captura.** La ficha lo dice en su `Falta:`: sólo la captura de device. **Exige del device:** la pantalla de Inteligencia SCROLLEADA entera (no el tope: el corpus ya pagó el error de medir contra una captura recortada) con el canónico, contra el DOM del prototipo `?ver=bi`; una sola pasada de scroll con 4 capturas.  
*Corrección:* Igualar cabecera, etiqueta de mes, mosaicos y dock («Volver» ya resuelto: N6).  
*Vínculo:* F6 · F6b · N6 · F12

**43 · `clientes` — Clientes** — **DIFERENTE · B** · DEVICE  
Prototipo: [clientes](2026-10-16-relevamiento-capturas/proto-mapa-clientes.png) · App: [clientes-top](2026-10-16-relevamiento-capturas/app-clientes-top.png)  
*Diferencia:* Falta la columna derecha (monto, comprobantes, chips) y el dock. Causa en el mapeo previo: `api/clientes.ts:31` no trae esos campos.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **La causa citada («`api/clientes.ts:31` no trae esos campos») está VENCIDA.** El cliente HTTP ya declara `montoFacturado` y `comprobantesCantidad` (`packages/core/src/api/clientes.ts:71,79`) y `TarjetaCliente.tsx:36` pinta «$importe · N comprobantes» en la columna derecha; sin CUIT dice «Sin CUIT cargado» y nunca un cero inventado. Dock: `PantallaClientes.tsx:408`. El chip `auto` está apagado por decisión escrita (`TarjetaCliente.tsx:47-48`, `:67`). Falta sólo la corrida con un cliente CON CUIT en el teléfono (SM-J4, frontend1).  
*Corrección:* Traer monto y comprobantes del backend y dibujarlos; agregar el dock.  
*Vínculo:* F5 · F12


### Ajustes

**44 · `ajustes` — Ajustes** — **DIFERENTE · B** · DEVICE  
Prototipo: [ajustes](2026-10-16-relevamiento-capturas/proto-mapa-ajustes.png) · App: [ajustes](2026-10-16-relevamiento-capturas/app-ajustes.png)  
*Diferencia:* Grilla de tiles en lugar de lista; «Cómo hablarle» no es entrada del grid; faltan subtítulos y encabezado de negocio (esos dos últimos, A).  
*Medición 2026-11-03 (mapa, SM-L5):* **El mapa seguía dibujando siete opciones con «Mi plan» y el código ya tiene seis.** Enmendado: la fila «Mi plan» salió de la lista de Ajustes del prototipo (`prototipo/index.html`, `SUBS` sin `s-plan`), «siete» pasó a «seis» en `mapa-pantallas/index.html` y `mockups/13-ajustes/index.html`, y «Cerrar sesión» se dibuja como botón. La pantalla de Mi plan se conserva como visión post-beta. **No se tocó** el chevron de «Como el teléfono» (escalado al operador) ni el wording de Gmail y de la clave fiscal (decisión del operador).  
*Corrección:* Agregar subtítulos y encabezado; actualizar el mapa por la grilla.  
*Vínculo:* F7 · F7c · F7d

**45 · `negocio` — Mi negocio** — **DIFERENTE · B** · DEVICE  
Prototipo: [negocio](2026-10-16-relevamiento-capturas/proto-mapa-negocio.png) · App: [negocio-1](2026-10-16-relevamiento-capturas/app-negocio-1.png)  
*Diferencia:* Estructura distinta (tarjeta única contra campos sueltos), selector en vez de texto, título duplicado y botón «Guardar» explícito.  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **Las tres diferencias de comportamiento son enmiendas fundadas en el código** (comentario de `PantallaPerfilNegocio.tsx:~493-499`): el selector de «A quién le vendés» sale del enum del backend; la validación de largo mínimo no se porta por ser cambio de contrato MAYOR; y «Guardar» es explícito por sección, no edición inline. La proporción visual del contenedor queda a la captura de device.  
*Corrección:* Igualar la estructura del formulario.  
*Vínculo:* F11-negocio

**46 · `afip` — Facturación ARCA** — **DIFERENTE · A** · DEVICE+CÓDIGO  
Prototipo: [afip](2026-10-16-relevamiento-capturas/proto-mapa-afip.png) · App: [afip-0](2026-10-16-relevamiento-capturas/app-afip-0.png)  
*Diferencia:* Faltan el subtítulo, «Necesito cambiarlo ›» y la nota de la clave fiscal en la forma del mapa; la condición de IVA es selector. La aclaración de la clave fiscal **sí existe** con otro texto («Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta.», `PantallaAfipSetup.tsx:840`); la aclaración de Homologación y Producción también (`:876`).  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El punto «Necesito cambiarlo ›» está vencido: existe** (`PantallaAfipSetup.tsx:573`, decisión BL-V27 del operador). La nota de la clave fiscal existe con otro texto (`:840`) y la de Homologación/Producción también (`:876`). Sigue A por dos cosas: la condición de IVA es selector (SM-E1: el selector no ofrece lo que el backend rechaza con 422, `PantallaAfipSetup.tsx:83-88`) y el texto de la clave fiscal sin decisión escrita — esto último va al `pedido_` del operador (texto visible).  
*Corrección:* Igualar subtítulo y «Necesito cambiarlo ›»; decidir el texto de la clave fiscal.  
*Vínculo:* F11-afip

**47 · `apps` — Apps conectadas** — **DIFERENTE · A** · DEVICE+CÓDIGO  
Prototipo: [apps](2026-10-16-relevamiento-capturas/proto-mapa-apps.png) · App: [apps-0](2026-10-16-relevamiento-capturas/app-apps-0.png)  
*Diferencia:* El grupo «Trabaja sola, de fondo» existe (`PantallaApps.tsx:111,124`). Falta la frase «No puede leerlos» en Gmail: la app dice «Enviá mails desde el chat.» (el comentario `:79` explica que `capacidades` decía «leer y buscar», que el conector no hace). El estado va como botón y no como etiqueta a la derecha; el mapa lista seis apps (con Google Sheets) y la app cinco. «Cada app por lo que habilita» sí se cumple.  
*Corrección:* Agregar «No puede leerlos» a Gmail (decisión del mockup 13); revisar Sheets; mover el estado a una etiqueta.  
*Medición 2026-11-03 (código, prototipo `prototipo/index.html:2332-2346` contra `PantallaApps.tsx` y `catalog.py`):* **Tres de los cuatro puntos de arriba están vencidos.** (1) «No puede leerlos» ya está en Gmail: `catalog.py:73` «Enviá mails desde el chat. No puede leerlos.» con test que lo ata a la capacidad real (`test_catalogo_descripcion_afirma_capacidad.py`). (2) El estado ya es etiqueta a la derecha «● Conectada» (`PantallaApps.tsx:317-334`, SM-K4). (3) El catálogo lista seis apps, Sheets incluida (`catalog.py:60-106`), y el contador «N conectadas de 6» existe (`PantallaApps.tsx:131,263`). **Lo que queda y por eso sigue A:** el texto de las descripciones del catálogo no es el del prototipo: Drive dice «Guardá tus facturas en tu Google Drive.» (`catalog.py:91`) y el prototipo «Archiva tus facturas automáticamente. No se usa por chat.» (`index.html:2344`); Gmail «Enviá mails desde el chat» contra «Mandar correos por vos» (`:2338`), y así las demás. No hay decisión escrita que avale la diferencia; el texto vive en `catalog.py` (backend), no en la app. Corrección: alinear `catalog.py` al mapa o ajustar el mapa a lo que el catálogo ya dice. **NO-VERIFICABLE-SIN-APP:** el render de la píldora y del logo en la fila.
*Medición 2026-11-03 16:40–16:43 (DEVICE, frontend1, SM-L4).* **Instrumento:** `adb` (`uiautomator dump` + `screencap`) sobre la app en el SM-M127F, cuenta `e2e-device@copiloto.test`, bundle de Metro `wt-fe1-h5` @`ef9c716b`; el código de `modules/midia` y `modules/apps` de ese bundle es idéntico a `origin/main` @`7fb1095e` (`git diff --stat` vacío). **Vencido en device:** Gmail dice «Enviá mails desde el chat. No puede leerlos.» y Google Sheets está en la lista. **Hallazgo que contradice la medición por código:** la pantalla muestra **cinco** apps (Mercado Pago, Gmail, Google Calendar, Google Docs, Google Sheets) bajo un único grupo «Para pedirle por chat» y el contador dice «0 conectadas de 5»; **no aparece «Trabaja sola, de fondo» ni Google Drive**, ni al final de la lista, aunque `PantallaApps.tsx:123` lo arma y `catalog.py:94` declara `googledrive`. La causa NO se investigó (¿el catálogo que sirve el backend desplegado no trae Drive, o el cliente lo filtra?): es id nuevo, no reapertura. **No medible hoy:** la etiqueta «● Conectada» a la derecha, porque el canónico tiene 0 conectadas (Mercado Pago y Calendar muestran «Reconectar: se cayó la conexión» y un botón). **Sigue A:** el orden difiere del mapa (mapa: Gmail, Calendar, Mercado Pago, Sheets, Docs) y el texto de las descripciones no es el del prototipo (p. ej. «Generá links de cobro y cobrá desde el chat.» contra «Generar links de cobro para tus clientes.»). [app-l4-47-apps](2026-10-16-relevamiento-capturas/app-l4-47-apps.png) · [app-l4-47-apps-fondo](2026-10-16-relevamiento-capturas/app-l4-47-apps-fondo.png)  
*Vínculo:* SM-K4 · F11-apps (padrón viejo)

**48 · `plan` — Mi plan** — **DIFERENTE · B** · CÓDIGO — **RESUELTO** (decisión del operador, 2026-10-16: VISIÓN post-beta)  
Prototipo: [plan](2026-10-16-relevamiento-capturas/proto-mapa-plan.png) · App: — (no existe)  
*Diferencia:* Cambio deliberado con cita: DEC-8 (operador, 2026-09-21, `2026-09-21-acta-decisiones-beta-odobi.md:18`): «Plan y límites no entran en la beta». La app no tiene «Mi plan» y hay un control negativo que lo exige (`PantallaAjustes.test.tsx:54-59`: sin tile `miPlan` ni texto «Mi plan»). No hay pantalla que medir.  
*Corrección aplicada:* el mapa la marca «VISIÓN post-beta» y cita DEC-8 (mismo cierre que `limite`).  
*Vínculo:* F7b

**49 · `cuenta` — Mi cuenta** — **DIFERENTE · B** · DEVICE  
Prototipo: [cuenta](2026-10-16-relevamiento-capturas/proto-mapa-cuenta.png) · App: [cuenta](2026-10-16-relevamiento-capturas/app-cuenta.png)  
*Diferencia:* Falta «Cambiar el mail» (`CambiarCredenciales.tsx:68-70`, diferido hasta que el backend confirme el cambio): deliberado. Faltan «desde marzo de 2021» y los chevrons, y «Cerrar sesión» pasa de fila a botón (A).  
*Corrección:* Agregar «desde …» y chevrons; decidir «Cambiar el mail» (pregunta 6).  
*Vínculo:* F11-cuenta · F11-cuenta-b

**50 · `apar` — Apariencia** — **DIFERENTE · B** · CÓDIGO  
Prototipo: [apar](2026-10-16-relevamiento-capturas/proto-mapa-apar.png) · App: [apariencia](2026-10-16-relevamiento-capturas/app-apariencia.png)  
*Diferencia:* Cambia el detalle del mosaico (mini-vista contra muestras) y se pierde el chevron; la nota de la app agrega una frase.  
*Corrección:* Igualar el mosaico y el chevron.  
*Medición 2026-11-03 (código, prototipo `prototipo/index.html:2393-2408` contra `PantallaSkins.tsx`):* Estructura, título, bajada, «Elegí el tema», dos tarjetas lado a lado y «Como el teléfono» en su fila coinciden (`PantallaSkins.tsx:149-197`). Las diferencias que quedan: (1) la muestra lleva 4 chips (fondo, superficie, acento, acento2) y no los 2 puntos del prototipo; es una **enmienda fundada con test** que fija esos 4 (`PantallaSkins.tsx:145-148`, `PantallaSkins.test`). (2) En «Como el teléfono» el chevron del prototipo (`index.html:2404`) lo ocupa el marcador «✓ Activo» (`PantallaSkins.tsx:125-132`): la fila elige una regla, no abre una pantalla, así que un chevron prometería una navegación que no existe. **Esa sustitución no tiene decisión escrita**: es mi lectura del código; si el operador quiere el chevron, vuelve a ser A. (3) La nota de la app agrega «Se aplica al instante y queda guardado para la próxima sesión.» (`PantallaSkins.tsx:190-193`). **NO-VERIFICABLE-SIN-APP:** el render del mosaico (proporción y peso de los chips).
*Vínculo:* F11-apariencia

**51 · `hablar` — Cómo hablarle** — **DIFERENTE · B** · DEVICE  
Prototipo: [hablar](2026-10-16-relevamiento-capturas/proto-mapa-hablar.png) · App: [tono](2026-10-16-relevamiento-capturas/app-tono.png)  
*Diferencia:* Copy de las opciones idéntico verbatim. Control de selección distinto (filas con radio contra opciones sueltas) y botones explícitos. El ejemplo vivo (mockup 13) existe y el nombre es editable en el mismo lugar (B).  
*Medición 2026-11-03 (código en `origin/main`, SM-L4):* **El control de selección ya es filas con radio.** `CampoSelect` con `descripcion` dibuja el ancho completo con radio a la derecha (`CampoSelect.tsx:39`, `testID` `${idOpcion}-radio` en `:102`); SM-K7 TERMINADO con captura `SM-K7-hablar.webp`. Los botones explícitos son la enmienda «Guardar es explícito por sección» (`PantallaPerfilNegocio.tsx:~493-499`).  
*Corrección:* Igualar el control de selección.  
*Vínculo:* F11-tono-a · F11-tono-b

## 3. Lista de correcciones

### 3.1 Se corrige en la app (clase A)

| # | Entrada | Qué hay que hacer |
|---|---|---|
| 1 | `ingresar` | Igualar la estructura del formulario al prototipo y agregar el aviso de sesión cerrada (el flujo de «sesión caída sola» ya va directo a este formulario, `EntradaSesion.tsx:25`). |
| 2 | `base` | **DECIDIDO (2026-10-16): gana el mapa.** Tarjeta de cabecera, lista «Ahora» y «Para hoy · Ver tablero ›» que abre una pantalla «Tu día». Ficha pendiente. |
| 3 | `esc` | Igualar título, orden y estilo de tiles (C1). Dejar R02 como está. |
| 4 | `chat` | Mismo arreglo que R01: campo + mic chico siempre visibles al pie. |
| 5 | `tablero` | **DECIDIDO (2026-10-16): pantalla propia, como el mapa.** Título «Tu día» y «Volver»; filtros y «Anotar algo para hoy» a decidir al bajar la ficha. |
| 6 | `grabando` | **RESUELTO (N8, 2026-10-16)** — la barra de grabación toma el lugar del botón de alta en la misma fila y el reloj ya no pisa al chevron. Capturas en N8. |
| 7 | `bloqueado` | **RESUELTO (N8, 2026-10-16)** — fijado, los controles ocupan toda la fila con la onda ancha. Capturas en N8. |
| 8 | `bi-refresh` | **RESUELTO (N2, 2026-10-16)** — el círculo nativo queda fuera de cuadro (`progressViewOffset`); sólo se ve «Actualizando…». Capturas en N2. |
| 9 | `consent` | Agregar íconos por capacidad y el banner de continuación. |
| 10 | `caida` | **RESUELTO (2026-10-16)** — copy de Mercado Pago = frase del código (mapa actualizado) y montos en una línea (N1). **Segundo aviso de Google Calendar: DECIDIDO (2026-10-16) — se agrega al mapa** (falta editar el prototipo/mapa). |
| 11 | `comousar` | Igualar contenedor y numeración. |
| 12 | `soporte` | Agregar el clip; quitar el botón de voz grande si el mapa manda. |
| 13 | `feedback` | Igualar estructura y posición del mes. |
| 14 | `gastos` | Agregar el dock y «Ticket»; decidir qué hacer con BUSCAR. |
| 15 | `ingresos` | Agregar el dock. |
| 16 | `factura` | Agregar chips y dock; retirar «Te deben» o documentarlo. |
| 17 | `presu` | Agregar chips de antigüedad y dock. |
| 18 | `bi` | Igualar cabecera, etiqueta de mes, mosaicos y dock («Volver» ya resuelto: N6). |
| 19 | `clientes` | Traer monto y comprobantes del backend y dibujarlos; agregar el dock. |
| 20 | `negocio` | Igualar la estructura del formulario. |
| 21 | `afip` | Igualar subtítulo y «Necesito cambiarlo ›»; decidir el texto de la clave fiscal. |
| 22 | `apps` | Agregar «No puede leerlos» a Gmail (decisión del mockup 13); revisar Sheets; mover el estado a una etiqueta. |
| 23 | `apar` | Igualar el mosaico y el chevron. |
| 24 | `hablar` | Igualar el control de selección. |
| 25 | N1 | **RESUELTO (2026-10-16)** — montos de la portada en una línea: `numberOfLines={1}` con `adjustsFontSizeToFit` en `PortadaNegocio.tsx`; captura en device. |
| 26 | N2 | **RESUELTO (2026-10-16)** — el círculo nativo del refresh queda fuera de cuadro; sólo se ve «Actualizando…». Ojo: el primer intento (color transparente) falló en device. |
| 27 | N3 | **Aviso de la card de gasto distinto del mapa.** Decidir cuál frase manda y alinear mapa, app y glosario. |
| 28 | N6 | **RESUELTO (decisión 7, 2026-10-16)** — «Volver» a la izquierda con chevron en `MarcoGlass`; capturas en device. |
| 29 | N8 | **RESUELTO (2026-10-16)** — `MicFuncion` arma la fila entera: la barra toma el lugar del botón de alta; fijado, los controles ocupan toda la fila. Medido en Gastos y Presupuestos; el cancelar deslizando también quedó verificado en device. |
| 30 | `hitl` | El pedido «mandale un recordatorio por mail» debe producir la card Gmail «Confirmar y mandar» / «Cancelar», no una de Calendar. **Cancelar** debe desactivar la card y el backend debe rechazar `confirmar` de una propuesta cancelada (test adversarial). La card de Calendar cancelada no puede pasar a «✓ Confirmado». |
| 31 | `fact-hitl` | Agregar **Editar** (todos los datos de la factura) y **Cancelar** a la card «Factura C · ARCA»; hoy sólo tiene «Emitir la factura». Cancelar por chat debe desactivar la card (mismo contrato que `hitl`). |
| 32 | `fact-cae` | Mostrar cliente y número formateado en «Factura emitida.»; Drive/Compartir sin mail. |
| 33 | `pres-hitl` | Decidir si manda el formulario editable de la app o la vista de lectura del mapa (con «Cambiar»/«Editar» por renglón y chip «Docs»). |
| 34 | `pres-ciclo` | Igualar el rótulo del chip, el formato del importe («$50.000» y no «$50,000.00») y mostrar «Pendiente» en la card «anotado». |
| 35 | `agenda` | Igualar con el mapa (detalle en el doc de pendientes, 00.bis). |
| 36 | `bi-vacio` | Agregar el mensaje global «Sin ventas todavía» al estado vacío de Inteligencia. |

### 3.2 Se corrige en el mapa (cambio deliberado o mapa rancio)

| # | Entrada | Qué hay que hacer |
|---|---|---|
| 1 | `splash` | Quitar «Crear una nueva cuenta» del mapa (splash, reveal y volver) o reabrir la decisión #3. |
| 2 | `detalle` | Ninguna en la app. Retirar el sheet del mapa si todavía figura. |
| 3 | `reveal` | Igual que «Splash». |
| 4 | `limite` | **RESUELTO (2026-10-16)** — marcada VISIÓN post-beta en el mapa. Cita: DEC-8 (acta 2026-09-21). |
| 5 | `ajustes` | Agregar subtítulos y encabezado; actualizar el mapa por la grilla. |
| 6 | `plan` | **RESUELTO (2026-10-16)** — marcada VISIÓN post-beta en el mapa. Cita: DEC-8 (acta 2026-09-21). |
| 7 | `cuenta` | Agregar «desde …» y chevrons; decidir «Cambiar el mail» (pregunta 6). |
| 8 | N5 | **`?ver=vacio` y `?ver=vacio-visto` no muestran su estado.** Corregir los dos deep links del prototipo. |
| 9 | N7 | **Portada del mapa dice «30 pantallas»; el mapa lista 51.** Corregir el encabezado del mapa. |

### 3.3 Falta medir (NO-VERIFICABLE)

| Entrada | Por qué no se midió | Qué hace falta |
|---|---|---|
| `entrada` | El arranque en frío se grabó (60 cuadros): logo negro sobre crema, luego la carga del dev-client (fondo oscuro con el botón «Tools»), luego Mi día y, a los pocos segundos, **el chat sube solo** con el rótulo viejo («Escribile a Odobi»). El mapa dice que la entrada dura lo que tarda Mi día en cargar y aterriza en Mi día. La fase del dev-client contamina la medición: sólo un build de release da el tiempo real. Que el chat suba solo no se pudo atribuir a la app o a la restauración de estado del dev-client. | Medir con un build de release. Si el chat sube solo también ahí, es un defecto nuevo (se suma al R03). |
| `vozchat` | Necesita una nota de voz real transcripta y enviada al hilo (la pantalla «Grabando» ya se midió sin voz, entrada 12). | Medir con una persona. |
| `onb-cumplida` | El primer insight con plata real sólo se produce en la primera sesión de un tenant con datos de facturas. Los importes del mapa (`$147.000`, `$63.000`) son un ejemplo, no copy. | Medir con un usuario nuevo con facturas cargadas. |
| `fact-voz` | Facturar por voz exige dictado y datos reales de un cliente. | Medir con una persona y un cliente de prueba. |
| `pres-voz` | Igual que «Facturar por voz». | Medir con una persona. |
| `vacio-visto` | En el prototipo `?ver=vacio-visto` no muestra su estado (hallazgo del propio mapa). Por código la app dibuja «Nada urgente por hoy.» y varía la calma por días (`PantallaMiDia.tsx:661`, `EstadoVacio.tsx`). El canónico tiene tarjetas, así que no se ve. | Corregir el deep link del prototipo para que muestre el estado. |
| `vacio` | En el prototipo `?ver=vacio` tampoco muestra su estado. Por código: «Nada urgente por hoy.» (`PantallaMiDia.tsx:661`). | Corregir el deep link del prototipo. |

## 4. Hallazgos nuevos de esta pasada

**N1 — Montos partidos en dos líneas en la portada** (**RESUELTO**, 2026-10-16: se corrigió la app). En los tres cuadros de Mi día (Entró · Salió · Por cobrar) un monto con centavos no entra y se corta en la coma: `$101.234,` y debajo `00` (y `$205.000,` / `00`). El prototipo no muestra centavos y cada monto va en una línea. El formateo con `,00` es deliberado y exacto (`formatoDinero.ts`); el corte, no. *Corrección:* Una línea por monto: `numberOfLines={1}` con `adjustsFontSizeToFit` en `PortadaNegocio.tsx`, o sin centavos en los cuadros chicos. Captura: [mapa-midia-caida](2026-10-16-relevamiento-capturas/app-mapa-midia-caida.png). *Corrección aplicada:* `PortadaNegocio.tsx` pone `numberOfLines={1}` + `adjustsFontSizeToFit` (`minimumFontScale` 0,6) en el valor de cada cuadro; el `,00` se conserva. Captura en device, con `$101.234,00` entero: [después](2026-10-16-relevamiento-capturas/n1-midia-montos-una-linea-despues.png).

**N2 — El indicador nativo de refresh tapa el saldo** (**RESUELTO**, 2026-10-16: se corrigió la app). Al tirar para actualizar en Inteligencia, un círculo blanco con flecha se dibuja encima del monto; el prototipo sólo muestra «Actualizando…». No encontré cita que lo justifique. *Corrección:* Dejar sólo la línea «Actualizando…» (color del indicador transparente). Captura: [mapa-bi-tirando](2026-10-16-relevamiento-capturas/app-mapa-bi-tirando.png). *Corrección aplicada:* el `RefreshControl` de `PantallaInteligencia.tsx` lleva `progressViewOffset={-1000}`, que deja el círculo nativo fuera de cuadro (se mantiene el `RefreshControl` de RNGH: es el árbitro del gesto). **El primer intento —`colors` transparentes— falló en device:** Android pisa el alfa del color y dibujó un arco negro; el test de jsdom estaba verde con el comportamiento real roto, y lo destapó la captura. Capturas en device: [arrastrando](2026-10-16-relevamiento-capturas/n2-inteligencia-arrastrando-sin-circulo-despues.png) · [actualizando](2026-10-16-relevamiento-capturas/n2-inteligencia-actualizando-sin-circulo-despues.png).

**N3 — Aviso de la card de gasto distinto del mapa** (**RESUELTO** por la decisión 8 del operador, 2026-10-16: la frase canónica es la del código; se corrigió el mapa, no la app). Mapa: una frase corta anterior (mockup 11), que `CONTEXT.md` citaba sin contenerla. App: «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.» (`TarjetaGastoPropuesto`). *Corrección aplicada:* mapa, prototipo, mockup 11 y `CONTEXT.md` alineados con la frase del código; cero cambios en `apps/mobile`.

**N4 — Paso de perfil de negocio en el onboarding** (D · no determinado). La app agrega, antes de entrar, «Antes de entrar, contame de tu negocio: qué vendés y cómo se llama.» (`PantallaOnboarding.tsx:292`), un paso que el mapa no tiene. Es un gate del backend (`perfilIncompleto`); el docstring cita BL-Q3 fila 3, y **esa cita es incorrecta**: el contrato que ordena el paso es `SM-C3 DoD 2-4` (`coordinacion/cerrado/2026-10-15/2026-10-14_contrato_planificacion-a-frontend1-y-frontend2_SM-C3-DoD-2-4-el-paso-del-perfil-minimo-…`, §1: el paso pide `queVende` y `nombreComercial` y no deja avanzar sin los dos). *Resuelto en SM-K8 (2026-11-02):* el paso se queda y está en el mapa como `onb-perfil`; los errores prematuros se quitaron (el error aparece al intentar avanzar).

**N5 — `?ver=vacio` y `?ver=vacio-visto` no muestran su estado** (defecto del mapa o del prototipo). En el prototipo las dos entradas del mapa se ven igual que la base; el estado vacío de Mi día no se puede mirar. *Corrección:* Corregir los dos deep links del prototipo.

**N6 — «Volver» a la derecha y sin chevron** (**RESUELTO** por la decisión 7 del operador, 2026-10-16: gana el prototipo; se cambió la app). Las funciones ponían «Volver» a la derecha, sin chevron ([antes](2026-10-16-relevamiento-capturas/app-inteligencia-top.png)); el mockup 12 decide «a la izquierda, con chevron» y el prototipo lo dibuja así. *Corrección aplicada:* `MarcoGlass.tsx` (único archivo que dibuja «Volver», 23 pantallas) lo ancla arriba a la izquierda con «‹» y el título dejó de reservar ancho a la derecha. Capturas en device: [gastos](2026-10-16-relevamiento-capturas/app-volver-izquierda-gastos.png) · [ingresos](2026-10-16-relevamiento-capturas/app-volver-izquierda-ingresos.png) · [tras tocar «Volver»](2026-10-16-relevamiento-capturas/app-volver-izquierda-tras-tocar-volver.png).

**N7 — Portada del mapa dice «30 pantallas»; el mapa lista 51** (defecto del mapa o del prototipo). Inconsistencia del propio mapa de pantallas: el encabezado cuenta 30 y la grilla muestra 51 entradas (5 + 3 + 29 + 6 + 8). *Corrección:* Corregir el encabezado del mapa.

**N8 — El botón «Anotar un gasto» se aplasta mientras se graba** (**RESUELTO**, 2026-10-16: se corrigió la app; el cancelar deslizando funciona — las corridas que no lo armaban eran un error de unidades del instrumento). En Gastos, al mantener apretado el micrófono, `BarraSostenida` (punto, reloj y «‹ Deslizá para cancelar») se dibuja dentro de `MicFuncion` y no en lugar del campo: queda en la columna angosta de la fila `filaConMic`, entre la foto y «Anotar un gasto», que se comprime hasta partir la palabra por sílabas («An/o/tar/un/ga/sto»). Con la grabación fijada, los controles (tacho, onda, reloj, pausa, enviar) flotan a media pantalla con una onda angosta que el reloj pisa, y el botón colapsa a una tira vertical vacía. El prototipo transforma la barra del composer en una barra al pie de ancho completo; el comentario de `PistasVoz.tsx:85` dice «no flota» y el chat (`ChatView.tsx:351`) y Soporte (`PantallaSoporte.tsx:266`) sí reemplazan el campo. Capturas: [grabando](2026-10-16-relevamiento-capturas/app-mapa-grabando.png) · [bloqueado](2026-10-16-relevamiento-capturas/app-mapa-bloqueado.png). *Alcance:* medido en Gastos; el mismo `MicFuncion` lo usan Clientes, Ingresos y Presupuestos, no medidos. *Corrección:* Que la barra de grabación reemplace al campo en la fila (o la fila se oculte mientras se graba). *Cancelar al deslizar a la izquierda — primero «no se arma», después explicado:* en dos corridas con `motionevent` (5 `MOVE` a −134 px y 12 `MOVE` a −119 px) nunca apareció «Soltá para cancelar» ([captura](2026-10-16-relevamiento-capturas/app-mapa-grabando-deslizando-izquierda-sin-armar.png)), mientras que deslizar hacia arriba sí fija; al soltar sin armar se transcribe. **Causa (medida el 2026-10-16): era el instrumento.** `UMBRAL_CANCELAR_PX = 70` está en **dp**, no en píxeles; en este teléfono 1 dp = 1,846 px, así que son ~129 px, y `translationX` de RNGH cuenta desde que el `Pan` se activa (unos 10 dp después de apoyar el dedo). Los −134, −119 y −104 px de las corridas eran 56–73 dp menos ese tramo: nunca llegaban a 70. Con 13 `MOVE` de 12 px (−157 px ≈ 85 dp) aparece «Soltá para cancelar» en rojo ([captura](2026-10-16-relevamiento-capturas/n8-gastos-deslizando-izquierda-cancelando-despues.png)), y al soltar **no se transcribe nada**, no se abre ningún formulario y la fila vuelve a su reposo (comprobado a 1,5 s y a 7 s). *Corrección aplicada:* `MicFuncion.tsx` pasa a ser la FILA entera (`antes` · mic · `alLado`): sosteniendo, la barra reemplaza al botón de alta en su misma ranura y la onda y el candado flotan encima del mic (absolutos), así que el botón no se mueve bajo el dedo; fijado, los controles ocupan toda la fila y `antes`/`alLado` se esconden sin desmontarse. Las cuatro pantallas (Gastos, Ingresos, Clientes, Presupuestos) le pasan `antes`/`alLado`. Capturas en device — Gastos: [sosteniendo](2026-10-16-relevamiento-capturas/n8-gastos-sosteniendo-barra-en-la-ranura-del-alta-despues.png) · [fijado](2026-10-16-relevamiento-capturas/n8-gastos-fijado-controles-fila-completa-despues.png) · [pausado](2026-10-16-relevamiento-capturas/n8-gastos-fijado-pausado-despues.png) · [descartado](2026-10-16-relevamiento-capturas/n8-gastos-descartado-fila-restaurada-despues.png); Presupuestos: [sosteniendo](2026-10-16-relevamiento-capturas/n8-presupuestos-sosteniendo-barra-en-la-ranura-del-alta-despues.png). Una tercera corrida corta (−104 px, en Presupuestos) tampoco armó la cancelación: al soltar se transcribió el audio ambiente y se abrió un formulario, que se canceló sin guardar. Ingresos y Clientes, con el mismo componente, no se midieron en device. **Contexto del operador (2026-10-16):** el botón grande del mic de las pantallas de función es transitorio; el destino, como en el prototipo, es la barra inferior de ingreso de texto con el botón del mic, no este botón. La función (grabar, fijar, cancelar deslizando) quedó verificada y es la que se reubica.

## 5. Decisiones de los mockups

| Mockup | Decisión | Veredicto | Evidencia |
|---|---|---|---|
| 04 · HITL | Confirmación con «Editá / Cambiá / Ver lista» y «Todavía…» en el aviso | NO-VERIFICABLE | Exige provocar una propuesta real. |
| 09 · Mi día | Detector de ocho reglas y tarjetas «Para hoy» | CONFORME | Las tarjetas de ARCA, cobro y presupuesto están en device (Para hoy 3). |
| 09 · Mi día | Tres pestañas inferiores | CONFORME | Superada por «sin tabbar» (mockup 10): la app no tiene barra de pestañas. |
| 09 · Mi día | Delta en negro, no en terracota | NO-VERIFICABLE | Depende de los datos del mes (el canónico no tiene variación). |
| 10 · Arranque | Sin tabbar | CONFORME | Ninguna captura de la app muestra barra de pestañas. |
| 10 · Arranque | Dos gestos verticales opuestos, con asidero propio | CONFORME | «Bajá para tus funciones» arriba y «Escribile a Odobi» abajo; los rótulos tienen el defecto R03. |
| 10 · Arranque | Escritorio de 6 funciones en grilla 3×2 | NO-VERIFICABLE | La captura del escritorio no cuenta los tiles; falta medir el orden (C1). |
| 10 · Arranque | Ajustes sale de la grilla y va al avatar con punto de estado | CONFORME | El avatar con punto existe en la cabecera; muestra «·» sin inicial porque el negocio del canónico no tiene nombre (`AvatarCuenta.tsx:51`). |
| 10 · Arranque | El composer es el borde visible del panel de conversación | DIFERENTE | La app muestra la tira «Escribile a Odobi», no un campo (R01). |
| 10 · Arranque | Estado vacío del chat con ejemplo que gira y contrato fijo | CONFORME | Medido en device (chat vacío). |
| 11 · Voz contextual | Card en la función y su aviso | NO-VERIFICABLE | Exige un gasto real; la frase del mapa ya es la del código (N3, decisión 8). |
| 12 · Funciones | Anatomía: card blanca con nombre + bloque negro + lista | DIFERENTE | El bloque negro existe; el nombre y el período no están en la card blanca (F6, N6). |
| 12 · Funciones | Dato faltante: «—», nunca «$0» | CONFORME | Rentabilidad muestra «—» con la explicación en Inteligencia. |
| 12 · Funciones | «Volver» a la izquierda, con chevron | CONFORME | Desde la decisión 7 (N6): «‹ Volver» arriba a la izquierda en las 23 pantallas con marco ([gastos](2026-10-16-relevamiento-capturas/app-volver-izquierda-gastos.png) · [ingresos](2026-10-16-relevamiento-capturas/app-volver-izquierda-ingresos.png)). |
| 12 · Funciones | Alta manual como pill en la fila del rótulo, con el verbo del repo | NO-VERIFICABLE | No se comparó el rótulo de cada función; «Anotar que me pagaron» existe como verbo en Ingresos. |
| 12 · Funciones | «Estás en Gastos» derogado (el placeholder lo dice) | CONFORME | El texto no existe en la app. |
| 12 · Funciones | Contabilidad absorbida por Inteligencia | CONFORME | Se fundió con Inteligencia (`EscritorioFunciones.tsx:77`). |
| 13 · Ajustes | Gmail dice «No puede leerlos» | DIFERENTE | La app dice «Enviá mails desde el chat.» |
| 13 · Ajustes | Google Drive en grupo aparte «Trabaja sola, de fondo» | CONFORME | `PantallaApps.tsx:111,124`. |
| 13 · Ajustes | Clave fiscal: aclaración textual al pie | DIFERENTE | Existe con otro texto (`PantallaAfipSetup.tsx:840`). |
| 13 · Ajustes | Cerrar sesión en grupo aparte, en terracota profunda | CONFORME | El mapa ya lo dibuja como botón (`prototipo/index.html`, `#cerrar-sesion`, `btn2 peligro`) como la app (`PantallaCuenta.tsx:224-226`, `variante: 'peligro'`). Enmienda del mapa aplicada 2026-11-03 (F11-cuenta-b). |
| 13 · Ajustes | «Mi plan» no está en la lista de Ajustes | CONFORME | DEC-8 (2026-09-21, `2026-09-21-acta-decisiones-beta-odobi.md:18`): «Plan y límites no entran en la beta». La lista del mapa tiene seis opciones; la pantalla `#s-plan` queda como VISIÓN post-beta (sólo por `?ver=plan`). Control negativo en la app: `PantallaAjustes.test.tsx:54-59`. Enmienda del mapa aplicada 2026-11-03. |
| 13 · Ajustes | Apariencia con muestras reales de los dos temas | DIFERENTE | Cambia el detalle del mosaico (F11-apariencia). |
| 13 · Ajustes | «Cómo hablarle» muestra una respuesta de ejemplo | CONFORME | Existe el ejemplo vivo (F11-tono-b). |
| 14 · Mi día 3V | Tablero en tres estados: Para hoy / Haciendo / Hechas | CONFORME | Las tres pestañas filtran su propia lista (medido). |
| 14 · Mi día 3V | Tarjeta expandible en su lugar | CONFORME | Medido en device con la tarjeta de Lucía y la manual. |
| 14 · Mi día 3V | «Borrar» dentro de la tarjeta expandida | CONFORME | Visible en la tarjeta manual expandida. |
| 14 · Mi día 3V | Skeleton de carga y barra de avance | NO-VERIFICABLE | Efímeros: no se capturaron. |
| 14 · Mi día 3V | Agenda con línea del ahora | NO-VERIFICABLE | Calendar caído en el canónico. |

Los mockups 01, 02, 03, 05, 06 y 08 se repasaron en las entradas de arranque, consent, chat, facturación, presupuestos y plan; sus decisiones que dependen de acciones reales están en la sección 3.3. El mockup 08 (plan y límites) quedó retirado por DEC-8.

## 6. Preguntas para el operador (siguen la numeración del relevamiento previo)

- **PREGUNTA 7 → RESUELTA (operador, 2026-10-16):** «Volver» va arriba a la izquierda con «‹» (gana el prototipo); se cambió `MarcoGlass.tsx` y se verificó en device en dos pantallas.
- **PREGUNTA 8 → RESUELTA (operador, 2026-10-16):** la frase del aviso de la card de gasto es la del código, «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.»; se corrigieron el mapa, el prototipo, el mockup 11 y `CONTEXT.md`.
- La corrección más grande de la lista es la estructura de Mi día y el tablero (entradas `base` y `tablero`): es la **pregunta 4** del relevamiento previo — **RESUELTA (operador, 2026-10-16): gana el mapa** (tablero como pantalla propia «Tu día»); falta la ficha de implementación.

## 7. Criterio de terminado

1. Las 51 entradas tienen veredicto, método y diferencia. ✔ (51 de 51, contadas con `collections.Counter` en `gen_mapa.py`.)
2. Cada diferencia cita `path:línea` o una captura de ambos lados. ✔
3. Lo no medido está declarado con su motivo, sin veredicto inventado. ✔ (17 entradas)
4. Capturas versionadas en `2026-10-16-relevamiento-capturas/`: 51 del prototipo + 12 nuevas del device. ✔
5. Sin cambios de código en `apps/` ni `packages/`. ✔
