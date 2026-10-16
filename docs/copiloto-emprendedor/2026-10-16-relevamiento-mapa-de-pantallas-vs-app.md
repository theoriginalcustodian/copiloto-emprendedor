# Relevamiento del mapa de pantallas contra la app (mobile)

> **Fecha:** 2026-10-16 · **Sesión:** frontend2 · **Complementa** `2026-10-16-relevamiento-concordancia-prototipo-vs-app-mobile.md` (misma fecha). **Sin cambios de código.**

**Qué es.** El mapa de pantallas (`Prototipo frontend/odobi-ui/mapa-pantallas/index.html`) lista 51 entradas (la portada dice «30»: ver N7). Este documento pone **cada una** contra lo que hay hoy en el teléfono y contra el código, con el veredicto, la diferencia exacta y lo que hay que corregir para que la app quede como el mapa. Además repasa las decisiones de los 14 mockups (`Prototipo frontend/odobi-ui/mockups/*/DECISIONES.md`).

**Cómo se midió.** Código = `origin/main` @`e024075b`, servido por Metro al dispositivo `RF8T318RN9T` (390 dp = 720×1600 px) con el usuario canónico. Prototipo = `?ver=<entrada>` a 393×852. Método por fila: **DEVICE** (capturado y mirado), **CÓDIGO** (leído en `apps/mobile` y `packages/core`), **NO-MEDIBLE** (exige audio real, un dato que no se puede fabricar o una acción irreversible). Un veredicto por CÓDIGO no prueba cómo se ve: dice qué texto y qué estructura hay.

## 1. Resumen

| Veredicto | Entradas |
|---|---|
| CONFORME | 4 |
| DIFERENTE | 30 |
| FALTA | 0 |
| NO-VERIFICABLE | 17 |
| **Total** | **51** |

De las 30 entradas que difieren: **24 son A** (falta o no hay decisión citable: se corrige la **app**) y **6 son B** (cambio deliberado con cita: se corrige el **mapa**). Método: CÓDIGO 7 · DEVICE 25 · DEVICE+CÓDIGO 9 · NO-MEDIBLE 10.

Hallazgos nuevos de esta pasada (sección 4): 8 — 5 A, 1 D, 2 defectos del propio mapa o del prototipo.

Decisiones de mockups repasadas (sección 5): 28 — NO-VERIFICABLE 7, CONFORME 14, DIFERENTE 7.

**Lo que NO cubre.** Las entradas NO-VERIFICABLE (17) quedan sin medir por una razón escrita en cada fila: voz real, datos del tenant, acciones irreversibles, Google Calendar o un build de release. No se inventó ningún veredicto para ellas.

## 2. Las 51 entradas


### Arranque

**01 · `splash` — Splash** — **DIFERENTE · B** · CÓDIGO  
Prototipo: [splash](2026-10-16-relevamiento-capturas/proto-mapa-splash.png) · App: — (no capturada)  
*Diferencia:* El prototipo lleva dos botones, «Empecemos» y «Crear una nueva cuenta». La app dibuja sólo el primero: no hay alta propia, el alta self-service es Google y «entrar» y «crear cuenta» son el mismo acto (`EntradaSesion.tsx:6-17`, decisión del operador #3, 2026-08-04). El copy y la marca coinciden (`TEXTOS_REVEAL.primeraVez`, `TAGLINE_MARCA`: «Tu copiloto emprendedor»). La animación de 6,8 s no se midió: exige cerrar la sesión del usuario canónico.  
*Corrección:* Quitar «Crear una nueva cuenta» del mapa (splash, reveal y volver) o reabrir la decisión #3.

**02 · `volver` — Volver a entrar** — **CONFORME** · CÓDIGO  
Prototipo: [volver](2026-10-16-relevamiento-capturas/proto-mapa-volver.png) · App: — (no capturada)  
*Diferencia:* Los textos de las dos puertas salen de `TEXTOS_REVEAL.volver` («Entrar» / «Entrar con otra cuenta», `textosEntrada.ts:18`) y coinciden con el mapa. La animación no se midió (exige cerrar sesión).  
*Corrección:* Ninguna por copy. Falta medir la animación en device cuando haya un usuario descartable.

**03 · `ingresar` — Ingresar** — **DIFERENTE · A** · DEVICE  
Prototipo: [ingresar](2026-10-16-relevamiento-capturas/proto-mapa-ingresar.png) · App: [ingresar](2026-10-16-relevamiento-capturas/app-ingresar.png)  
*Diferencia:* Cambian el logo (con o sin cuadro), el relleno de campos y botones, y falta el aviso «Tu sesión se cerró por seguridad. Entrá otra vez y seguís donde estaba»: no aparece en ningún archivo de `apps/mobile` ni de `packages/core`.  
*Corrección:* Igualar la estructura del formulario al prototipo y agregar el aviso de sesión cerrada (el flujo de «sesión caída sola» ya va directo a este formulario, `EntradaSesion.tsx:25`).  
*Vínculo:* F10

**04 · `ingresar-error` — No coinciden** — **CONFORME** · CÓDIGO  
Prototipo: [ingresar-error](2026-10-16-relevamiento-capturas/proto-mapa-ingresar-error.png) · App: — (no capturada)  
*Diferencia:* El mensaje es idéntico: «Ese mail y esa contraseña no coinciden. Probá de nuevo.» (`textosEntrada.ts:7`), va entre los campos y los botones y en terracota profunda, como el mapa (`PantallaLogin.tsx:200-208`). No se provocó el error en device: habría fallado un ingreso del usuario canónico.  
*Corrección:* Ninguna por copy y posición. Falta ver el estado en device.

**05 · `entrada` — Entrada** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [entrada](2026-10-16-relevamiento-capturas/proto-mapa-entrada.png) · App: [mapa-entrada-arranque-1](2026-10-16-relevamiento-capturas/app-mapa-entrada-arranque-1.png) · [mapa-entrada-arranque-2](2026-10-16-relevamiento-capturas/app-mapa-entrada-arranque-2.png)  
*Diferencia:* El arranque en frío se grabó (60 cuadros): logo negro sobre crema, luego la carga del dev-client (fondo oscuro con el botón «Tools»), luego Mi día y, a los pocos segundos, **el chat sube solo** con el rótulo viejo («Escribile a Odobi»). El mapa dice que la entrada dura lo que tarda Mi día en cargar y aterriza en Mi día. La fase del dev-client contamina la medición: sólo un build de release da el tiempo real. Que el chat suba solo no se pudo atribuir a la app o a la restauración de estado del dev-client.  
*Corrección:* Medir con un build de release. Si el chat sube solo también ahí, es un defecto nuevo (se suma al R03).  
*Vínculo:* R03


### Capas

**06 · `base` — Mi día** — **DIFERENTE · A** · DEVICE  
Prototipo: [base](2026-10-16-relevamiento-capturas/proto-mapa-base.png) · App: [midia-reposo](2026-10-16-relevamiento-capturas/app-midia-reposo.png) · [mapa-midia-caida](2026-10-16-relevamiento-capturas/app-mapa-midia-caida.png)  
*Diferencia:* Mi día en reposo: el prototipo muestra la cabecera dentro de una tarjeta («Odobi» + fecha) con avatar «M», la caja con el chip «−18% vs julio», la lista «Ahora» con la agenda y «Para hoy 4 cosas · Ver tablero ›». La app dibuja «Odobi» suelto, el chip de fecha, **el tablero embebido** (pestañas Para hoy / Haciendo / Hechas, filtros, «Anotar algo para hoy») y no tiene «Ver tablero ›» ni la tarjeta de cabecera. Además, los tres cuadros de la portada parten el monto en dos líneas (`$101.234,` / `00`): ver N1.  
*Corrección:* Decidir una sola estructura (pregunta 4). Si gana el mapa: tarjeta de cabecera, lista «Ahora» y «Para hoy · Ver tablero ›» que abre una pantalla «Tu día».  
*Vínculo:* C1 · C3 · C5 · N1

**07 · `esc` — Funciones** — **DIFERENTE · A** · DEVICE  
Prototipo: [esc](2026-10-16-relevamiento-capturas/proto-mapa-esc.png) · App: [escritorio](2026-10-16-relevamiento-capturas/app-escritorio.png) · [escritorio-dos-solapas](2026-10-16-relevamiento-capturas/app-escritorio-dos-solapas.png)  
*Diferencia:* El escritorio difiere en título, avatar y orden de la primera fila, y el estilo de los tiles; con el escritorio abierto la app muestra dos solapas apiladas, y esa segunda es deliberada (B, ver R02).  
*Corrección:* Igualar título, orden y estilo de tiles (C1). Dejar R02 como está.  
*Vínculo:* C1 · R02

**08 · `chat` — Chat** — **DIFERENTE · A** · DEVICE  
Prototipo: [chat](2026-10-16-relevamiento-capturas/proto-mapa-chat.png) · App: [chat-abierto](2026-10-16-relevamiento-capturas/app-chat-abierto.png) · [mapa-chat-vacio](2026-10-16-relevamiento-capturas/app-mapa-chat-vacio.png)  
*Diferencia:* El contenido del estado en reposo coincide: «¿En qué te ayudo?», el ejemplo que gira («Gasté 15 lucas en nafta») y la línea fija «Antes de ejecutar algo importante, te lo muestro para que lo confirmes». Cambian la zona de entrada (botón de voz grande, más un «Pausar» que el mapa no tiene) y el botón de voz del campo.  
*Corrección:* Mismo arreglo que R01: campo + mic chico siempre visibles al pie.  
*Vínculo:* R01 · C7


### Estados

**09 · `tablero` — Tablero** — **DIFERENTE · A** · DEVICE  
Prototipo: [tablero](2026-10-16-relevamiento-capturas/proto-mapa-tablero.png) · App: [mapa-tablero-haciendo](2026-10-16-relevamiento-capturas/app-mapa-tablero-haciendo.png) · [mapa-tablero-hechas](2026-10-16-relevamiento-capturas/app-mapa-tablero-hechas.png) · [mapa-tablero-scroll](2026-10-16-relevamiento-capturas/app-mapa-tablero-scroll.png)  
*Diferencia:* Las pestañas Para hoy · Haciendo · Hechas, los contadores y la nota al pie («Las que detecta Odobi se cierran solas cuando hacés la acción real. Las que anotaste vos las movés vos.») existen y coinciden. Difieren: el tablero no es una pantalla propia («Tu día» con «Volver»), el título es «Mi día» y no «Tu día», y la app agrega filtros por categoría y un campo «Anotar algo para hoy».  
*Corrección:* Decidir con el mapa si el tablero es pantalla propia o parte de Mi día (pregunta 4); el resto es copy y filtros extra sin cita.  
*Vínculo:* C5 · F8

**10 · `agenda` — Agenda** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [agenda](2026-10-16-relevamiento-capturas/proto-mapa-agenda.png) · App: [agenda](2026-10-16-relevamiento-capturas/app-agenda.png)  
*Diferencia:* La agenda sólo es comparable con Google Calendar conectado; en el canónico está caído (la app dice «Se cayó la conexión con Google Calendar» y oculta «Ver agenda», `PantallaMiDia.tsx:560-566`). Falta confirmar la línea del ahora (mockup 14).  
*Corrección:* Reconectar Calendar en el usuario canónico y medir.  
*Vínculo:* F9

**11 · `detalle` — Detalle** — **CONFORME** · DEVICE  
Prototipo: [detalle](2026-10-16-relevamiento-capturas/proto-mapa-detalle.png) · App: [mapa-tarjeta-tocada](2026-10-16-relevamiento-capturas/app-mapa-tarjeta-tocada.png) · [mapa-tarjeta-manual-expandida](2026-10-16-relevamiento-capturas/app-mapa-tarjeta-manual-expandida.png)  
*Diferencia:* El mockup 14 deroga el sheet de detalle: la tarjeta se expande en su lugar. En la app, tocar «Presupuesto de Lucía» abre el detalle dentro de la fila (texto explicativo, Monto, Enviado y «Mandarle un recordatorio»). El sheet del prototipo quedó superado.  
*Corrección:* Ninguna en la app. Retirar el sheet del mapa si todavía figura.

**12 · `grabando` — Grabando** — **DIFERENTE · A** · DEVICE  
Prototipo: [grabando](2026-10-16-relevamiento-capturas/proto-mapa-grabando.png) · App: [grabando](2026-10-16-relevamiento-capturas/app-mapa-grabando.png) · [deslizando a la izquierda sin armar](2026-10-16-relevamiento-capturas/app-mapa-grabando-deslizando-izquierda-sin-armar.png)  
*Diferencia:* Medido en Gastos con un dedo sostenido (`adb shell input motionevent DOWN` sin `UP`, sin voz: no hace falta audio para ver la pantalla). Aparecen punto rojo, reloj «0:01» y «‹ Deslizá para cancelar» **debajo** del botón del micrófono, que se pone pálido; arriba, candado, flecha y una franja de onda. El prototipo lo dibuja como una barra al pie, «● 0:09 … deslizá para cancelar ‹», con el micrófono naranja a la derecha. Además el botón «Anotar un gasto» queda aplastado en columna y parte la palabra por sílabas («An/o/tar/un/ga/sto»), y el reloj choca con el chevron («0:01‹»). Causa: `BarraSostenida` se dibuja dentro de `MicFuncion` (`voz/MicFuncion.tsx:145`), en la columna angosta de la fila `filaConMic` (`PantallaGastos.tsx:262`, `:329`), en vez de reemplazar al campo; el comentario de `PistasVoz.tsx:85` dice que «no flota». Ver N8.  
*Corrección:* Que la barra de grabación ocupe el ancho al pie y reemplace al campo, como en el prototipo (N8). El cancelar al deslizar a la izquierda **sí funciona** (verificado en device con `adb`, ver N8: las corridas que no lo armaban medían en píxeles un umbral que está en dp).

**13 · `bloqueado` — Audio bloqueado** — **DIFERENTE · A** · DEVICE  
Prototipo: [bloqueado](2026-10-16-relevamiento-capturas/proto-mapa-bloqueado.png) · App: [bloqueado](2026-10-16-relevamiento-capturas/app-mapa-bloqueado.png)  
*Diferencia:* Con `DOWN` y seis `MOVE` hacia arriba (927 → 700 px) la grabación se fija: aparecen tacho, onda, reloj «0:02», pausa y enviar (círculo rojo). El prototipo los dibuja en una barra al pie con tacho, onda ancha, «0:09», pausa y enviar. En la app los controles flotan a media pantalla en lugar de ir en una barra al pie, la onda es angosta y el reloj la pisa, y «Anotar un gasto» colapsa a una tira vertical vacía a la derecha (mismo N8). Se descartó con el tacho: no se envió nada (la lista de gastos y el hilo del chat quedaron sin cambios).  
*Corrección:* Mismo arreglo que «Grabando» (N8): barra al pie, de ancho completo.

**14 · `card` — La card en la función** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [card](2026-10-16-relevamiento-capturas/proto-mapa-card.png) · App: — (no capturada)  
*Diferencia:* La card de gasto aterrizando desde Gastos exige dictar o escribir un gasto: crea un dato en el tenant canónico. Por código, el aviso es «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.» (`TarjetaGastoPropuesto`); el mapa decía otra frase, corregida a la del código por la decisión 8 del operador (ver N3).  
*Corrección:* Medir con autorización explícita para generar el dato.  
*Vínculo:* K1

**15 · `vozchat` — Lo dictado, en el chat** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [vozchat](2026-10-16-relevamiento-capturas/proto-mapa-vozchat.png) · App: — (no capturada)  
*Diferencia:* Igual que «Grabando»: necesita una nota de voz real.  
*Corrección:* Medir con una persona.  
*Vínculo:* K1

**16 · `bi-vacio` — Sin ventas todavía** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [bi-vacio](2026-10-16-relevamiento-capturas/proto-mapa-bi-vacio.png) · App: — (no capturada)  
*Diferencia:* El estado sin ventas exige un tenant sin datos; el canónico tiene gastos. Fabricarlo sería borrar datos.  
*Corrección:* Medir con un tenant vacío.  
*Vínculo:* F6

**17 · `bi-refresh` — Tirar para actualizar** — **DIFERENTE · A** · DEVICE  
Prototipo: [bi-refresh](2026-10-16-relevamiento-capturas/proto-mapa-bi-refresh.png) · App: [mapa-bi-reposo](2026-10-16-relevamiento-capturas/app-mapa-bi-reposo.png) · [mapa-bi-tirando](2026-10-16-relevamiento-capturas/app-mapa-bi-tirando.png) · [mapa-bi-soltado](2026-10-16-relevamiento-capturas/app-mapa-bi-soltado.png)  
*Diferencia:* Tirar para actualizar funciona y muestra la línea «Actualizando…» como el mapa. Pero mientras se tira, el indicador nativo (círculo blanco con flecha) se dibuja encima del saldo; el prototipo sólo muestra la línea de texto.  
*Corrección:* Ocultar el indicador nativo del `RefreshControl` (color transparente) y dejar la línea «Actualizando…».  
*Vínculo:* N2

**18 · `reveal` — El reveal** — **DIFERENTE · B** · CÓDIGO  
Prototipo: [reveal](2026-10-16-relevamiento-capturas/proto-mapa-reveal.png) · App: — (no capturada)  
*Diferencia:* Es el mismo reveal que «Splash»: «se dice o-DO-bi» y el botón de altavoz existen (`PRONUNCIACION_MARCA`, `RevealEntrada.tsx`); falta «Crear una nueva cuenta» por la decisión #3.  
*Corrección:* Igual que «Splash».

**19 · `onb-promesa` — La promesa** — **CONFORME** · CÓDIGO  
Prototipo: [onb-promesa](2026-10-16-relevamiento-capturas/proto-mapa-onb-promesa.png) · App: — (no capturada)  
*Diferencia:* Los 13 textos propios de la pantalla (incluida «Son dos minutos y te digo algo que no sabés.») están en `PantallaOnboarding.tsx` y `textosEntrada.ts`. No se vio en device: exige un usuario nuevo. La app suma un paso que el mapa no tiene (N4).  
*Corrección:* Ninguna por copy.  
*Vínculo:* N4

**20 · `onb-cumplida` — La promesa cumplida** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [onb-cumplida](2026-10-16-relevamiento-capturas/proto-mapa-onb-cumplida.png) · App: — (no capturada)  
*Diferencia:* El primer insight con plata real sólo se produce en la primera sesión de un tenant con datos de facturas. Los importes del mapa (`$147.000`, `$63.000`) son un ejemplo, no copy.  
*Corrección:* Medir con un usuario nuevo con facturas cargadas.  
*Vínculo:* N4

**21 · `consent` — Just-in-time consent** — **DIFERENTE · A** · DEVICE  
Prototipo: [consent](2026-10-16-relevamiento-capturas/proto-mapa-consent.png) · App: [chat-consent-gmail](2026-10-16-relevamiento-capturas/app-chat-consent-gmail.png)  
*Diferencia:* La hoja de permiso existe y no jerarquiza aceptar contra rechazar (deliberado, B). Faltan los íconos por capacidad y el banner «Apenas conectes sigo con lo tuyo».  
*Corrección:* Agregar íconos por capacidad y el banner de continuación.  
*Vínculo:* K6a · K6b

**22 · `caida` — Conexión caída** — **DIFERENTE · A** · DEVICE — **copy RESUELTO** (decisión del operador, 2026-10-16: gana la frase del código; se corrigió el mapa)  
Prototipo: [caida](2026-10-16-relevamiento-capturas/proto-mapa-caida.png) · App: [mapa-midia-caida](2026-10-16-relevamiento-capturas/app-mapa-midia-caida.png)  
*Diferencia:* La portada admite estar incompleta, como el mapa, pero el copy es otro: el mapa dice «faltan los cobros de hoy — Mercado Pago está caído» en una línea bajo el monto; la app dice «Se cayó la conexión con Mercado Pago: faltan los cobros de hoy, así que estos números pueden estar incompletos.» y agrega un segundo aviso de Google Calendar. Los montos de los tres cuadros se parten en dos líneas.  
*Corrección aplicada:* el copy de Mercado Pago se alineó con la frase del código (prototipo, `specs/mobile-coherencia.md` y la nota del mockup 02; mismo criterio que la decisión 8); el corte de los montos (N1) quedó resuelto en #1297. *Sin decidir:* el segundo aviso de Google Calendar que la app agrega y el mapa no tiene.  
*Vínculo:* C3 · N1

**23 · `preg` — Pregunta libre** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [preg](2026-10-16-relevamiento-capturas/proto-mapa-preg.png) · App: — (no capturada)  
*Diferencia:* La pregunta libre se contesta con un mensaje real al agente: consume una acción del plan y escribe en el hilo del canónico (el clasificador de permisos lo denegó). Además la app resuelve «Preguntar» saliendo al chat (decisión del 2026-10-13), no con una respuesta dentro de Inteligencia.  
*Corrección:* Medir con autorización explícita.  
*Vínculo:* F6b

**24 · `recibo` — El comprobante** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [recibo](2026-10-16-relevamiento-capturas/proto-mapa-recibo.png) · App: — (no capturada)  
*Diferencia:* El comprobante tras ejecutar exige confirmar una acción real. Por código el recibo existe (`chat/Recibo.tsx`) y la meta «✓✓ recibido» también (C8).  
*Corrección:* Medir con una acción de prueba autorizada.  
*Vínculo:* C8

**25 · `fact-voz` — Facturar por voz** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [fact-voz](2026-10-16-relevamiento-capturas/proto-mapa-fact-voz.png) · App: — (no capturada)  
*Diferencia:* Facturar por voz exige dictado y datos reales de un cliente.  
*Corrección:* Medir con una persona y un cliente de prueba.  
*Vínculo:* K2

**26 · `fact-hitl` — Segundo HITL — emitir** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [fact-hitl](2026-10-16-relevamiento-capturas/proto-mapa-fact-hitl.png) · App: — (no capturada)  
*Diferencia:* La confirmación para emitir (Segundo HITL) no se provocó: emitir es irreversible. Por código: «Esto entendí. Revisalo y tocá Emitir la factura — todavía no la mandé.» y encabezado «Factura C · ARCA» (`TarjetaFacturaPropuesta.tsx:187-202`). El mapa dice «Queda así. Revisala antes de emitir» y «Una factura emitida no se borra».  
*Corrección:* Medir en homologación, nunca en producción.  
*Vínculo:* K2

**27 · `fact-cae` — Emitida — el CAE** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [fact-cae](2026-10-16-relevamiento-capturas/proto-mapa-fact-cae.png) · App: — (no capturada)  
*Diferencia:* El CAE sólo existe tras emitir una factura real.  
*Corrección:* Medir en homologación.  
*Vínculo:* K2

**28 · `pres-voz` — Presupuesto por voz** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [pres-voz](2026-10-16-relevamiento-capturas/proto-mapa-pres-voz.png) · App: — (no capturada)  
*Diferencia:* Igual que «Facturar por voz».  
*Corrección:* Medir con una persona.  
*Vínculo:* K3

**29 · `pres-hitl` — La tarjeta editable** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [pres-hitl](2026-10-16-relevamiento-capturas/proto-mapa-pres-hitl.png) · App: — (no capturada)  
*Diferencia:* Por código el aviso es «Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar el presupuesto — todavía no lo anoté. Al guardar, a tu cliente no le llega…» (`TarjetaPresupuestoPropuesto.tsx:126`): coincide con la idea del mapa («Todavía no lo anoté»). El botón difiere: «Guardar presupuesto» (mapa) contra «Guardar el presupuesto».  
*Corrección:* Medir con una propuesta real; igualar el rótulo del botón.  
*Vínculo:* K3

**30 · `pres-ciclo` — El ciclo** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [pres-ciclo](2026-10-16-relevamiento-capturas/proto-mapa-pres-ciclo.png) · App: — (no capturada)  
*Diferencia:* El ciclo anotado → aprobado → factura exige varios pasos reales.  
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

**33 · `comousar` — Cómo usar la app** — **DIFERENTE · A** · DEVICE  
Prototipo: [comousar](2026-10-16-relevamiento-capturas/proto-mapa-comousar.png) · App: [comousar-0](2026-10-16-relevamiento-capturas/app-comousar-0.png)  
*Diferencia:* Sólo cambia el contenedor (tarjeta única contra una por fila) y el número en círculo contra numeral.  
*Corrección:* Igualar contenedor y numeración.  
*Vínculo:* F11-comousar

**34 · `soporte` — Soporte técnico** — **DIFERENTE · A** · DEVICE  
Prototipo: [soporte](2026-10-16-relevamiento-capturas/proto-mapa-soporte.png) · App: [soporte](2026-10-16-relevamiento-capturas/app-soporte.png)  
*Diferencia:* Falta el clip de adjuntar; la app suma el botón de voz grande y párrafos de aclaración. La barra con campo y mic existe en ambos. El hilo es dato del tenant.  
*Corrección:* Agregar el clip; quitar el botón de voz grande si el mapa manda.  
*Vínculo:* F11-soporte-hilo · F11-soporte-ticket

**35 · `feedback` — Contanos qué tal** — **DIFERENTE · A** · DEVICE  
Prototipo: [feedback](2026-10-16-relevamiento-capturas/proto-mapa-feedback.png) · App: [feedback-0](2026-10-16-relevamiento-capturas/app-feedback-0.png)  
*Diferencia:* Estructura: campo dentro o fuera de tarjeta; «Mandar» sólido contra deshabilitado; el mes va a la derecha en el prototipo y debajo en la app.  
*Corrección:* Igualar estructura y posición del mes.  
*Vínculo:* F11-feedback

**36 · `hitl` — Confirmación** — **NO-VERIFICABLE** · NO-MEDIBLE  
Prototipo: [hitl](2026-10-16-relevamiento-capturas/proto-mapa-hitl.png) · App: — (no capturada)  
*Diferencia:* La confirmación de «Recordatorio a Lucía» (patrón madre, «Confirmar y mandar» / «Cancelar») exige un mensaje real que no se mandó: escribiría en el hilo del canónico y mandaría un mail. Mockup 04: el ícono del ojo y «Un solo mail, ahora. No se manda nada sin tu confirmación.»  
*Corrección:* Medir con autorización explícita y un destinatario de prueba.  
*Vínculo:* K1-K5

**37 · `vacio` — Mi día sin avisos** — **NO-VERIFICABLE** · DEVICE+CÓDIGO  
Prototipo: [vacio](2026-10-16-relevamiento-capturas/proto-mapa-vacio.png) · App: — (no capturada)  
*Diferencia:* En el prototipo `?ver=vacio` tampoco muestra su estado. Por código: «Nada urgente por hoy.» (`PantallaMiDia.tsx:661`).  
*Corrección:* Corregir el deep link del prototipo.  
*Vínculo:* N5


### Funciones

**38 · `gastos` — Gastos** — **DIFERENTE · A** · DEVICE  
Prototipo: [gastos](2026-10-16-relevamiento-capturas/proto-mapa-gastos.png) · App: [gastos-top](2026-10-16-relevamiento-capturas/app-gastos-top.png) · [funcion-gastos](2026-10-16-relevamiento-capturas/app-funcion-gastos.png)  
*Diferencia:* Sin dock con campo y mic, sin «Ticket», sin rótulo «ÚLTIMOS»; campo BUSCAR que el prototipo no tiene.  
*Corrección:* Agregar el dock y «Ticket»; decidir qué hacer con BUSCAR.  
*Vínculo:* F1 · F12

**39 · `ingresos` — Ingresos** — **DIFERENTE · A** · DEVICE  
Prototipo: [ingresos](2026-10-16-relevamiento-capturas/proto-mapa-ingresos.png) · App: [ingresos-top](2026-10-16-relevamiento-capturas/app-ingresos-top.png)  
*Diferencia:* Sin dock; la nota de Mercado Pago no se ve en la captura (puede estar bajo el pliegue). «Anotar que me pagaron» sí existe como verbo de alta.  
*Corrección:* Agregar el dock.  
*Vínculo:* F2 · F12

**40 · `factura` — Facturación** — **DIFERENTE · A** · DEVICE  
Prototipo: [factura](2026-10-16-relevamiento-capturas/proto-mapa-factura.png) · App: [facturacion-top](2026-10-16-relevamiento-capturas/app-facturacion-top.png)  
*Diferencia:* Faltan «N facturas · N impaga», los chips por fila y el dock. «Te deben» no existe en el prototipo.  
*Corrección:* Agregar chips y dock; retirar «Te deben» o documentarlo.  
*Vínculo:* F3 · F12

**41 · `presu` — Presupuestos** — **DIFERENTE · A** · DEVICE  
Prototipo: [presu](2026-10-16-relevamiento-capturas/proto-mapa-presu.png) · App: [presupuestos-top](2026-10-16-relevamiento-capturas/app-presupuestos-top.png)  
*Diferencia:* Sin dock ni chips de antigüedad.  
*Corrección:* Agregar chips de antigüedad y dock.  
*Vínculo:* F4 · F12

**42 · `bi` — Inteligencia de Negocio** — **DIFERENTE · A** · DEVICE  
Prototipo: [bi](2026-10-16-relevamiento-capturas/proto-mapa-bi.png) · App: [inteligencia-top](2026-10-16-relevamiento-capturas/app-inteligencia-top.png) · [mapa-bi-reposo](2026-10-16-relevamiento-capturas/app-mapa-bi-reposo.png)  
*Diferencia:* Falta la etiqueta de mes y los mosaicos y el dock «Preguntame lo que quieras…» + mic. El título está suelto con ícono, no dentro de una card blanca con período (mockup 12: «nombre y período en la card blanca»); «Volver» ya va a la izquierda con chevron (N6, decisión 7). La regla del dato faltante sí se cumple: Rentabilidad muestra «—» y la explicación, no «$0» (decisión del mockup 12). La pestaña «Preguntar» es una salida al chat (B).  
*Corrección:* Igualar cabecera, etiqueta de mes, mosaicos y dock («Volver» ya resuelto: N6).  
*Vínculo:* F6 · F6b · N6 · F12

**43 · `clientes` — Clientes** — **DIFERENTE · A** · DEVICE  
Prototipo: [clientes](2026-10-16-relevamiento-capturas/proto-mapa-clientes.png) · App: [clientes-top](2026-10-16-relevamiento-capturas/app-clientes-top.png)  
*Diferencia:* Falta la columna derecha (monto, comprobantes, chips) y el dock. Causa en el mapeo previo: `api/clientes.ts:31` no trae esos campos.  
*Corrección:* Traer monto y comprobantes del backend y dibujarlos; agregar el dock.  
*Vínculo:* F5 · F12


### Ajustes

**44 · `ajustes` — Ajustes** — **DIFERENTE · B** · DEVICE  
Prototipo: [ajustes](2026-10-16-relevamiento-capturas/proto-mapa-ajustes.png) · App: [ajustes](2026-10-16-relevamiento-capturas/app-ajustes.png)  
*Diferencia:* Grilla de tiles en lugar de lista; «Cómo hablarle» no es entrada del grid; faltan subtítulos y encabezado de negocio (esos dos últimos, A).  
*Corrección:* Agregar subtítulos y encabezado; actualizar el mapa por la grilla.  
*Vínculo:* F7 · F7c · F7d

**45 · `negocio` — Mi negocio** — **DIFERENTE · A** · DEVICE  
Prototipo: [negocio](2026-10-16-relevamiento-capturas/proto-mapa-negocio.png) · App: [negocio-1](2026-10-16-relevamiento-capturas/app-negocio-1.png)  
*Diferencia:* Estructura distinta (tarjeta única contra campos sueltos), selector en vez de texto, título duplicado y botón «Guardar» explícito.  
*Corrección:* Igualar la estructura del formulario.  
*Vínculo:* F11-negocio

**46 · `afip` — Facturación ARCA** — **DIFERENTE · A** · DEVICE+CÓDIGO  
Prototipo: [afip](2026-10-16-relevamiento-capturas/proto-mapa-afip.png) · App: [afip-0](2026-10-16-relevamiento-capturas/app-afip-0.png)  
*Diferencia:* Faltan el subtítulo, «Necesito cambiarlo ›» y la nota de la clave fiscal en la forma del mapa; la condición de IVA es selector. La aclaración de la clave fiscal **sí existe** con otro texto («Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta.», `PantallaAfipSetup.tsx:840`); la aclaración de Homologación y Producción también (`:876`).  
*Corrección:* Igualar subtítulo y «Necesito cambiarlo ›»; decidir el texto de la clave fiscal.  
*Vínculo:* F11-afip

**47 · `apps` — Apps conectadas** — **DIFERENTE · A** · DEVICE+CÓDIGO  
Prototipo: [apps](2026-10-16-relevamiento-capturas/proto-mapa-apps.png) · App: [apps-0](2026-10-16-relevamiento-capturas/app-apps-0.png)  
*Diferencia:* El grupo «Trabaja sola, de fondo» existe (`PantallaApps.tsx:111,124`). Falta la frase «No puede leerlos» en Gmail: la app dice «Enviá mails desde el chat.» (el comentario `:79` explica que `capacidades` decía «leer y buscar», que el conector no hace). El estado va como botón y no como etiqueta a la derecha; el mapa lista seis apps (con Google Sheets) y la app cinco. «Cada app por lo que habilita» sí se cumple.  
*Corrección:* Agregar «No puede leerlos» a Gmail (decisión del mockup 13); revisar Sheets; mover el estado a una etiqueta.  
*Vínculo:* F11-apps

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

**50 · `apar` — Apariencia** — **DIFERENTE · A** · DEVICE  
Prototipo: [apar](2026-10-16-relevamiento-capturas/proto-mapa-apar.png) · App: [apariencia](2026-10-16-relevamiento-capturas/app-apariencia.png)  
*Diferencia:* Cambia el detalle del mosaico (mini-vista contra muestras) y se pierde el chevron; la nota de la app agrega una frase.  
*Corrección:* Igualar el mosaico y el chevron.  
*Vínculo:* F11-apariencia

**51 · `hablar` — Cómo hablarle** — **DIFERENTE · A** · DEVICE  
Prototipo: [hablar](2026-10-16-relevamiento-capturas/proto-mapa-hablar.png) · App: [tono](2026-10-16-relevamiento-capturas/app-tono.png)  
*Diferencia:* Copy de las opciones idéntico verbatim. Control de selección distinto (filas con radio contra opciones sueltas) y botones explícitos. El ejemplo vivo (mockup 13) existe y el nombre es editable en el mismo lugar (B).  
*Corrección:* Igualar el control de selección.  
*Vínculo:* F11-tono-a · F11-tono-b

## 3. Lista de correcciones

### 3.1 Se corrige en la app (clase A)

| # | Entrada | Qué hay que hacer |
|---|---|---|
| 1 | `ingresar` | Igualar la estructura del formulario al prototipo y agregar el aviso de sesión cerrada (el flujo de «sesión caída sola» ya va directo a este formulario, `EntradaSesion.tsx:25`). |
| 2 | `base` | Decidir una sola estructura (pregunta 4). Si gana el mapa: tarjeta de cabecera, lista «Ahora» y «Para hoy · Ver tablero ›» que abre una pantalla «Tu día». |
| 3 | `esc` | Igualar título, orden y estilo de tiles (C1). Dejar R02 como está. |
| 4 | `chat` | Mismo arreglo que R01: campo + mic chico siempre visibles al pie. |
| 5 | `tablero` | Decidir con el mapa si el tablero es pantalla propia o parte de Mi día (pregunta 4); el resto es copy y filtros extra sin cita. |
| 6 | `grabando` | **RESUELTO (N8, 2026-10-16)** — la barra de grabación toma el lugar del botón de alta en la misma fila y el reloj ya no pisa al chevron. Capturas en N8. |
| 7 | `bloqueado` | **RESUELTO (N8, 2026-10-16)** — fijado, los controles ocupan toda la fila con la onda ancha. Capturas en N8. |
| 8 | `bi-refresh` | **RESUELTO (N2, 2026-10-16)** — el círculo nativo queda fuera de cuadro (`progressViewOffset`); sólo se ve «Actualizando…». Capturas en N2. |
| 9 | `consent` | Agregar íconos por capacidad y el banner de continuación. |
| 10 | `caida` | **RESUELTO (2026-10-16)** — copy de Mercado Pago = frase del código (mapa actualizado) y montos en una línea (N1). Queda sin decidir el segundo aviso de Calendar. |
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
| `agenda` | La agenda sólo es comparable con Google Calendar conectado; en el canónico está caído (la app dice «Se cayó la conexión con Google Calendar» y oculta «Ver agenda», `PantallaMiDia.tsx:560-566`). Falta confirmar la línea del ahora (mockup 14). | Reconectar Calendar en el usuario canónico y medir. |
| `card` | La card de gasto aterrizando desde Gastos exige dictar o escribir un gasto: crea un dato en el tenant canónico. Por código, el aviso es «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.» (`TarjetaGastoPropuesto`); el mapa decía otra frase, corregida a la del código por la decisión 8 del operador (ver N3). | Medir con autorización explícita para generar el dato. |
| `vozchat` | Necesita una nota de voz real transcripta y enviada al hilo (la pantalla «Grabando» ya se midió sin voz, entrada 12). | Medir con una persona. |
| `bi-vacio` | El estado sin ventas exige un tenant sin datos; el canónico tiene gastos. Fabricarlo sería borrar datos. | Medir con un tenant vacío. |
| `onb-cumplida` | El primer insight con plata real sólo se produce en la primera sesión de un tenant con datos de facturas. Los importes del mapa (`$147.000`, `$63.000`) son un ejemplo, no copy. | Medir con un usuario nuevo con facturas cargadas. |
| `preg` | La pregunta libre se contesta con un mensaje real al agente: consume una acción del plan y escribe en el hilo del canónico (el clasificador de permisos lo denegó). Además la app resuelve «Preguntar» saliendo al chat (decisión del 2026-10-13), no con una respuesta dentro de Inteligencia. | Medir con autorización explícita. |
| `recibo` | El comprobante tras ejecutar exige confirmar una acción real. Por código el recibo existe (`chat/Recibo.tsx`) y la meta «✓✓ recibido» también (C8). | Medir con una acción de prueba autorizada. |
| `fact-voz` | Facturar por voz exige dictado y datos reales de un cliente. | Medir con una persona y un cliente de prueba. |
| `fact-hitl` | La confirmación para emitir (Segundo HITL) no se provocó: emitir es irreversible. Por código: «Esto entendí. Revisalo y tocá Emitir la factura — todavía no la mandé.» y encabezado «Factura C · ARCA» (`TarjetaFacturaPropuesta.tsx:187-202`). El mapa dice «Queda así. Revisala antes de emitir» y «Una factura emitida no se borra». | Medir en homologación, nunca en producción. |
| `fact-cae` | El CAE sólo existe tras emitir una factura real. | Medir en homologación. |
| `pres-voz` | Igual que «Facturar por voz». | Medir con una persona. |
| `pres-hitl` | Por código el aviso es «Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar el presupuesto — todavía no lo anoté. Al guardar, a tu cliente no le llega…» (`TarjetaPresupuestoPropuesto.tsx:126`): coincide con la idea del mapa («Todavía no lo anoté»). El botón difiere: «Guardar presupuesto» (mapa) contra «Guardar el presupuesto». | Medir con una propuesta real; igualar el rótulo del botón. |
| `pres-ciclo` | El ciclo anotado → aprobado → factura exige varios pasos reales. | Medir con un presupuesto de prueba. |
| `vacio-visto` | En el prototipo `?ver=vacio-visto` no muestra su estado (hallazgo del propio mapa). Por código la app dibuja «Nada urgente por hoy.» y varía la calma por días (`PantallaMiDia.tsx:661`, `EstadoVacio.tsx`). El canónico tiene tarjetas, así que no se ve. | Corregir el deep link del prototipo para que muestre el estado. |
| `hitl` | La confirmación de «Recordatorio a Lucía» (patrón madre, «Confirmar y mandar» / «Cancelar») exige un mensaje real que no se mandó: escribiría en el hilo del canónico y mandaría un mail. Mockup 04: el ícono del ojo y «Un solo mail, ahora. No se manda nada sin tu confirmación.» | Medir con autorización explícita y un destinatario de prueba. |
| `vacio` | En el prototipo `?ver=vacio` tampoco muestra su estado. Por código: «Nada urgente por hoy.» (`PantallaMiDia.tsx:661`). | Corregir el deep link del prototipo. |

## 4. Hallazgos nuevos de esta pasada

**N1 — Montos partidos en dos líneas en la portada** (**RESUELTO**, 2026-10-16: se corrigió la app). En los tres cuadros de Mi día (Entró · Salió · Por cobrar) un monto con centavos no entra y se corta en la coma: `$101.234,` y debajo `00` (y `$205.000,` / `00`). El prototipo no muestra centavos y cada monto va en una línea. El formateo con `,00` es deliberado y exacto (`formatoDinero.ts`); el corte, no. *Corrección:* Una línea por monto: `numberOfLines={1}` con `adjustsFontSizeToFit` en `PortadaNegocio.tsx`, o sin centavos en los cuadros chicos. Captura: [mapa-midia-caida](2026-10-16-relevamiento-capturas/app-mapa-midia-caida.png). *Corrección aplicada:* `PortadaNegocio.tsx` pone `numberOfLines={1}` + `adjustsFontSizeToFit` (`minimumFontScale` 0,6) en el valor de cada cuadro; el `,00` se conserva. Captura en device, con `$101.234,00` entero: [después](2026-10-16-relevamiento-capturas/n1-midia-montos-una-linea-despues.png).

**N2 — El indicador nativo de refresh tapa el saldo** (**RESUELTO**, 2026-10-16: se corrigió la app). Al tirar para actualizar en Inteligencia, un círculo blanco con flecha se dibuja encima del monto; el prototipo sólo muestra «Actualizando…». No encontré cita que lo justifique. *Corrección:* Dejar sólo la línea «Actualizando…» (color del indicador transparente). Captura: [mapa-bi-tirando](2026-10-16-relevamiento-capturas/app-mapa-bi-tirando.png). *Corrección aplicada:* el `RefreshControl` de `PantallaInteligencia.tsx` lleva `progressViewOffset={-1000}`, que deja el círculo nativo fuera de cuadro (se mantiene el `RefreshControl` de RNGH: es el árbitro del gesto). **El primer intento —`colors` transparentes— falló en device:** Android pisa el alfa del color y dibujó un arco negro; el test de jsdom estaba verde con el comportamiento real roto, y lo destapó la captura. Capturas en device: [arrastrando](2026-10-16-relevamiento-capturas/n2-inteligencia-arrastrando-sin-circulo-despues.png) · [actualizando](2026-10-16-relevamiento-capturas/n2-inteligencia-actualizando-sin-circulo-despues.png).

**N3 — Aviso de la card de gasto distinto del mapa** (**RESUELTO** por la decisión 8 del operador, 2026-10-16: la frase canónica es la del código; se corrigió el mapa, no la app). Mapa: una frase corta anterior (mockup 11), que `CONTEXT.md` citaba sin contenerla. App: «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.» (`TarjetaGastoPropuesto`). *Corrección aplicada:* mapa, prototipo, mockup 11 y `CONTEXT.md` alineados con la frase del código; cero cambios en `apps/mobile`.

**N4 — Paso de perfil de negocio en el onboarding** (D · no determinado). La app agrega, antes de entrar, «Antes de entrar, contame de tu negocio: qué vendés y cómo se llama.» (`PantallaOnboarding.tsx:292`), un paso que el mapa no tiene. Es un gate del backend (`perfilIncompleto`); el docstring cita el contrato BL-Q3 fila 3, pero no pude confirmar que ese contrato lo ordene. *Corrección:* Agregar el paso al mapa o documentar su cita.

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
| 13 · Ajustes | Cerrar sesión en grupo aparte, en terracota profunda | DIFERENTE | Existe `PantallaCuenta.tsx`; pasa de fila a botón (F11-cuenta-b). |
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
- La corrección más grande de la lista es la estructura de Mi día y el tablero (entradas `base` y `tablero`): es la **pregunta 4** del relevamiento previo.

## 7. Criterio de terminado

1. Las 51 entradas tienen veredicto, método y diferencia. ✔ (51 de 51, contadas con `collections.Counter` en `gen_mapa.py`.)
2. Cada diferencia cita `path:línea` o una captura de ambos lados. ✔
3. Lo no medido está declarado con su motivo, sin veredicto inventado. ✔ (17 entradas)
4. Capturas versionadas en `2026-10-16-relevamiento-capturas/`: 51 del prototipo + 12 nuevas del device. ✔
5. Sin cambios de código en `apps/` ni `packages/`. ✔
