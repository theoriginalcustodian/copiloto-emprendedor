# SM-L4 — receta async de device para las 11 entradas del corpus que sólo se cierran con el teléfono

**Ficha:** SM-L4. **Autor:** auditoría. **Medido contra** `origin/main` @ `e8e6c0a6` (2026-11-03 23:29).
**Corpus:** `docs/copiloto-emprendedor/2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md` (lo mide `scripts/mapa-51-estado.py`).
**Entradas:** 05 · 06 · 10 · 15 · 25 · 28 · 30 · 36 · 42 · 47 (device o conexión) + 20 (días de uso).

Esta receta **no** marca nada. La sesión que captura aporta la evidencia en su `cierre_`, quien redacta la
pone en el corpus, y el estado de SM-L4 lo escribe `sprint-estado.py`.

## Reglas comunes (valen para las 11)

1. **El device tiene un solo dueño en la ventana.** Nadie más corre `adb` mientras dura la pasada: con dos
   clientes ADB la evidencia sale falsa, y el teléfono escribe en la base (`memoria/device-fisico-exige-dueno-unico.md`).
2. **Cuenta: `e2e-device@copiloto.test`, la única canónica.** Ninguna entrada de esta receta cambia de cuenta.
   La 20 es la única que pide otra cuenta, y por eso **no se corre** (ver su fila).
3. **Bundle:** Metro local sirviendo `origin/main`, con el dev-client ya instalado y `--clear` al arrancar.
   La excepción es la **05**, que exige un build de release. Cada captura lleva un `.txt` hermano con:
   - SHA servido;
   - cuenta;
   - `adb shell wm size`, `wm density` y `settings get system font_scale`;
   - hora.

   Ojo: el device no corre `main`, corre lo que sirve Metro (`memoria/el-device-no-corre-main-corre-lo-que-metro-sirve.md`).
4. **Gestos.** Todo Pan, hold, swipe o scroll se hace con `adb shell input motionevent DOWN|MOVE|UP x y`.
   **Nunca con `input tap`**: no ejercita un `Gesture.Pan` de RNGH y da un verde falso. Un toque simple de
   botón sí puede ir con `input tap`.
5. **Las coordenadas no se escriben a mano.** Se sacan del `uiautomator dump` del momento: el centro del
   `bounds` del nodo con el `testID` que nombra cada fila. Fijarlas en la receta las rompe con el primer
   cambio de layout o de `density`.
6. **Nombre de archivo:** `l4-<NN>-<qué>-390[-<paso>].png` (o `.mp4`), más su `.txt`. Van a
   `docs/copiloto-emprendedor/2026-10-16-relevamiento-capturas/`. Cada captura lleva también
   `uiautomator dump` → `l4-<NN>-<qué>.xml`: la foto prueba lo que se ve y el dump prueba qué nodo es.
7. **Navegación:** se navega por toque desde Funciones o desde el dock. El deep link
   `adb shell am start -a android.intent.action.VIEW -d "copiloto://<ruta>"` vale sólo si cae en la
   pantalla: con dev-client puede caer en el launcher. Si pasa eso, se navega por toque y se anota.
8. **Lo que muta (30, 36) requiere autorización explícita del operador, escrita, antes de correrlo.** Sin
   ella esas filas no se ejecutan. Se anotan como «esperan autorización»; no se reemplazan por otra cosa.

## Las entradas

| # · id | Estado previo | Gesto exacto | Qué se mira en la captura → cierra la entrada | Archivo | Qué podría falsearlo |
|---|---|---|---|---|---|
| **05** · `entrada` | **Build de release** instalado (orden del operador: va al final). Sesión canónica ya iniciada. `adb shell am force-stop app.copiloto.emprendedor`. | Sin gesto. `screenrecord --bit-rate 8000000` y, en paralelo, `adb shell am start -W -n "$(adb shell cmd package resolve-activity --brief app.copiloto.emprendedor | tail -1 | tr -d '')"`. El nombre de la activity no está en el repo, porque `apps/mobile/android/` no se versiona: se resuelve en el teléfono y no se escribe a mano. Parar la grabación a los 15 s. | (1) Del logo pasa **directo** a Mi día, sin la fase del dev-client. El tiempo sale del `TotalTime` de `am start -W` y de los cuadros. (2) **¿El chat sube solo?** Si pasa también en release, es defecto nuevo y se suma al R03. Si no pasa, el de la medición vieja era del dev-client. | `l4-05-entrada-release.mp4` + `.txt` con `TotalTime` y los fps reales del archivo | Medir con dev-client: la fase «Tools» contamina el tiempo, que es lo que invalidó la primera medición. Si la grabación tiene pocos fps, el primer cuadro ya muestra el estado final. Verificar los fps con `ffprobe`. |
| **06** · `base` | Canónica con **Mercado Pago y Google Calendar sanos**, más dos meses de historia de movimientos. Calendar es OAuth de Composio: lo reconecta el operador, no se siembra. | Abrir Mi día; sin gesto. Si la caja no entra en pantalla, un único scroll con `motionevent` (DOWN → MOVE hacia arriba → UP). | La caja (`midia-portada`, `PortadaNegocio.tsx:37`) con su chip, que arma `chipDeCaja` del core: **«−18% vs mes anterior»** o la variación que corresponda. En «Ahora», la **agenda** con eventos y el botón «Ver agenda» (`midia-ver-agenda`, `PantallaMiDia.tsx:284`; la app no lleva el «›» del mapa). Lo estructural ya está CONFORME en device, y el avatar es B (SM-N28). | `l4-06-midia-base-390.png` | Con MP caído, la app **no dibuja** la variación a propósito (`PortadaNegocio.tsx:16`) y la caja muestra «Se cayó la conexión con Mercado Pago». Eso no es diferencia: anotarlo como «precondición no cumplida». Lo mismo vale para Calendar. |
| **10** · `agenda` | Igual que 06: Google Calendar conectado en la canónica (SM-N34), con al menos un evento hoy antes y otro después de la hora actual. | Mi día → `midia-ver-agenda` (toque simple). | La **línea del ahora** (`agenda-linea-ahora`, `PantallaAgenda.tsx:99`) entre los dos eventos, contra el mockup 14. Con Calendar caído aparece `agenda-calendario-caida` y no hay línea que medir. | `l4-10-agenda-ahora-390.png` | Calendar caído: «Ver agenda» no aparece (`PantallaMiDia.tsx:560-566`). Un día sin eventos tampoco muestra la línea entre eventos. |
| **15** · `vozchat` | Canónica en el chat (`chat-view`), con permiso de micrófono ya concedido. Se necesita **una persona que hable**, o un audio reproducido junto al micrófono. | Hold en el centro de `boton-voz`: `motionevent DOWN cx cy`, dictar 3 a 5 s («Hoy gasté cuatro mil en nafta»), `motionevent UP cx cy` **en las mismas coordenadas**. No hacer MOVE: 70 px a la izquierda cancela y 80 px hacia arriba fija (`BotonVoz.tsx:19,29`). Si el hold dura menos de 350 ms, descarta. | (1) Mientras se graba: estado de grabación (`voz-reloj`). (2) Después del UP: **lo dictado aparece en el chat** como burbuja de voz (`chat-bubble-voz`, `Burbuja.tsx:90`), contra `proto-mapa-vozchat.png`. | `l4-15-vozchat-390-1-grabando.png`, `l4-15-vozchat-390-2-en-chat.png` | `input tap` sobre `boton-voz` no graba y parece «no anda». Tampoco sirve un dictado sin voz real: el transcriptor devuelve vacío y no hay burbuja que comparar. |
| **25** · `fact-voz` | Canónica, en el chat, con **un cliente de prueba ya existente** en Clientes. Anotar su nombre en el `.txt`. | Mismo hold de 15. Dictar: «Facturale cincuenta mil a *<cliente de prueba>* por *<concepto>*». | La **card de factura** que propone la app (`TarjetaFacturaPropuesta.tsx`), contra `proto-mapa-fact-voz.png`: cliente, importe, concepto y botones. **No tocar «Emitir»**: el segundo HITL es la entrada 26, que ya está en B. | `l4-25-fact-voz-390.png` | Usar un cliente que no existe: la app desambigua o pregunta, y se mide otra pantalla. Emitir por error escribe en ARCA y en la base. Cancelar la card al terminar y anotarlo. |
| **28** · `pres-voz` | Canónica, en el chat, con el mismo cliente de prueba. | Mismo hold. Dictar: «Haceme un presupuesto para *<cliente>* de *<monto>* por *<trabajo>*». | La **card editable del presupuesto** (`TarjetaPresupuestoPropuesto.tsx`), contra `proto-mapa-pres-voz.png` (la 29, la card editable en sí, ya está CONFORME). **Cancelar, no confirmar.** | `l4-28-pres-voz-390.png` | Confirmar crea un presupuesto real. Si eso pasa, anotarlo y avisar antes de la 30, porque cambia su estado previo. |
| **30** · `pres-ciclo` | **Requiere autorización del operador: escribe en la base.** Canónica, con un presupuesto de prueba **nuevo** en estado anotado, creado para esta pasada; anotar su número. | Por chat, tres pasos con toques simples: (1) abrir Presupuestos y capturar la card «anotado»; (2) escribir «Me aprobaron el de *<cliente>*» y capturar; (3) aceptar «¿Te armo la factura?» y capturar la card de factura **sin emitir**. | Una captura por paso, contra `proto-mapa-pres-ciclo.png`. Las tres diferencias que ya midió la pasada del 2026-11-02 se re-miran: el rótulo del chip, el importe en formato inglés «$50,000.00» y que la card «anotado» no muestra «Pendiente». **El paso 3 nunca se ejecutó: es lo nuevo.** | `l4-30-pres-ciclo-390-1-anotado.png` · `-2-aprobado.png` · `-3-factura.png` | Si hay varios presupuestos del mismo cliente, la app desambigua (pasó el 11-02) y se mide la desambiguación. Usar un cliente con un solo presupuesto. |
| **36** · `hitl` | **Requiere autorización del operador y un destinatario de prueba bajo su control: manda UN mail real** desde la cuenta de Gmail de la canónica. Gmail conectado. | Chat → escribir «Mandale un recordatorio por mail a *<destinatario de prueba>* para mañana» → capturar la card (`tarjeta-confirmacion`, `ListaMensajes.tsx:230-330`) → tocar `tarjeta-confirmacion-cancelar` (toque simple) → capturar de nuevo. Si el operador autorizó el envío, en vez de cancelar se toca `tarjeta-confirmacion-confirmar`. | (1) ¿La card es de **Gmail** (`tarjeta-confirmacion-servicio`) y cómo se rotulan sus dos botones? Contra el mockup 04: «Confirmar y mandar» / «Cancelar», el ícono del ojo y «Un solo mail, ahora. No se manda nada sin tu confirmación.». ⚠️ **Medido @e8e6c0a6: «Confirmar y mandar» y «Un solo mail» dan 0 hits en `apps/mobile/src`.** Si en device tampoco aparecen, la entrada sale DIFERENTE y no NO-VERIFICABLE: anotar el rótulo real. El 11-02 salió una card de **Calendar**: si se repite, es hallazgo y se anota. (2) Después de Cancelar, ¿la card **se retira** o queda con los botones? El 11-02 quedó y después pasó a «✓ Confirmado» sin que se creara nada. | `l4-36-hitl-390-1-card.png`, `l4-36-hitl-390-2-tras-cancelar.png` | Sin Gmail conectado, la app puede proponer otro canal y parecer la diferencia de herramienta. Anotar en el `.txt` el estado de conexiones de `/apps`. |
| **42** · `bi` | Canónica **con datos** y con categoría de monotributo cargada (SM-N35). Inteligencia. | Captura del tope, y después scroll con `motionevent` (DOWN en el 75 % de la altura → MOVE en pasos hasta el 25 % → UP) repetido hasta que el último scroll no mueve nada (el dump sale igual al anterior). Una captura y un dump por posición. | Las **once secciones del mapa, en orden** (lista en la entrada 42 del corpus, contra el DOM `?ver=bi`). Tienen que estar 6 «Por cobrar», 7 «En qué se te va la plata», 11 «Margen por trabajo» y la barra «N% del tope» de la 10. También los botones **«Resumen» y «Preguntar»** del mapa (SM-N32 DoD 6). ⚠️ **Medido @e8e6c0a6: 0 hits de «Resumen» y «Preguntar» en `apps/mobile/src/modules/inteligencia`.** Lo esperable es que **no estén**, y la captura lo confirma; no hay que buscarlos como si existieran. | `l4-42-bi-390-<1..N>.png` + `.xml` | Comparar contra la captura del prototipo, que está recortada a la mitad (lo que falseó la entrada hasta el 11-03): se compara contra el DOM. Con la categoría sin cargar, la barra no se dibuja a propósito (`tope:null`). |
| **47** · `apps` | Canónica en `/apps`. Para el punto (2), **al menos una app conectada** (la de 06 y 10 sirve). Correrla después de reconectar. | Abrir Apps; captura; scroll con `motionevent` hasta el final; captura. | (1) ¿Aparece **Google Drive** y el grupo **«Trabaja sola, de fondo»**? El 11-03 no aparecieron, aunque `PantallaApps.tsx:123` arma el grupo y `catalog.py:94` declara `googledrive`. (2) La etiqueta **«● Conectada»** a la derecha, en la app conectada. | `l4-47-apps-390-1.png`, `l4-47-apps-390-2-fondo.png` | Si Drive no aparece, la causa puede ser el **backend desplegado** y no la app. Anotar la respuesta del catálogo que sirve el VPS antes de concluir que el cliente lo filtra. |
| **20** · `onb-cumplida` | **No se corre en esta pasada.** Exige la **primera sesión** de un tenant con facturas reales cargadas, y la canónica ya pasó su primera sesión hace semanas. | — | El primer insight con plata real; los importes del mapa son ejemplo, no copy. | — | Correrla con la canónica mide la sesión N, no la primera. Fabricar un tenant nuevo choca con la regla de un solo usuario canónico, y esa excepción la decide el operador. Hasta entonces sigue **declarada por días de uso**. |

## Orden sugerido (menos cambios de estado; lo que muta, al final)

1. **El operador reconecta Mercado Pago y Google Calendar** en la canónica. Sin eso, 06, 10 y el punto (2) de 47 se anotan como «precondición no cumplida».
2. Canónica, sólo lectura: **06 → 10 → 47 → 42**.
3. Voz (necesita a la persona): **15 → 25 → 28**. Cancelar cada card.
4. Con autorización escrita: **30**, y después **36**.
5. **05** al final, con el build de release. Es la orden del operador para todo lo de release.
6. Restaurar `font_scale` y cualquier ajuste del sistema que se haya tocado.

## Lo que esto destraba, medido

Corpus @ `e8e6c0a6` con la re-medición de 03 y 46: **38/51** en condición (15 CONFORME · 23 B · 3 A · 10 NO-VERIFICABLE).

| Si se corre… | Techo |
|---|---|
| Nada | 38/51 |
| Las 10 de device, todas en CONFORME o B | 48/51 |
| Más la 03 (decisión del botón + alto 52) y la 09 (decisión del operador) | 50/51 |
| La 20 | sólo con la excepción de cuenta o con días de uso reales |

La 47 figura **A** en el corpus, pero lo que la hacía A (el orden y las descripciones) **ya venció por código**:
`ORDEN_DEL_MAPA` (`PantallaApps.tsx:117`, b9ae880b) = el orden de `index.html:2332-2346` (Gmail · Calendar ·
Mercado Pago · Sheets · Docs · Drive), y los textos vienen de 694a10ca. Lo que la cierra es el device:
que Drive aparezca y la etiqueta «● Conectada». Por eso cuenta entre las 10.

## Al terminar

Un `cierre_` con `FICHA: SM-L4`, `SHA:` (el SHA servido) y `DOD:` con una línea por entrada: el archivo y
qué se vio. Las precondiciones no cumplidas se anotan como tales, no como diferencias.
