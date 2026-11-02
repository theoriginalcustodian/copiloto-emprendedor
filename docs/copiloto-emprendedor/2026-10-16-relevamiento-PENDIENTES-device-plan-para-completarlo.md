# Relevamiento mapa ↔ app: lo que falta medir en el device y cómo completarlo

> **Fecha:** 2026-10-16 · **Sesión:** frontend2 · **Estado:** PLAN GUARDADO; ejecución parcial (ver «00. RETOMAR ACÁ»). Se escribió para que el trabajo no se pierda al compactarse el contexto.
> **Parte de:** `2026-10-16-relevamiento-mapa-de-pantallas-vs-app.md` (#1288 = `79b94ab6`) y `2026-10-16-relevamiento-concordancia-prototipo-vs-app-mobile.md` (#1285 = `01851f70`, #1287 = `e024075b`). Artefacto «Relevamiento Odobi» (privado): https://claude.ai/artifact/WdTwwZED2A6hUMwW1LfXDy (versión 3).

## 00. RETOMAR ACÁ (estado al cierre del 2026-10-16, noche)

**Decisiones del operador, todas registradas:** ambos ambientes (homologación y producción) · el botón de emitir lo toca el operador con su usuario `341lin@gmail.com` · receptor = consumidor final · usuario descartable **AUTORIZADO** · segundo aviso de Calendar **se agrega al mapa** · Pregunta 4: **gana el mapa** (tablero = pantalla propia «Tu día»). Detalle en §4 y §6.

**Hecho hoy:** #1297 (N1/N2/N8) y #1298 (decisiones MP, VISIÓN) mergeados; ARCA del operador medido = **0 credenciales** (§4); el teléfono quedó libre.

**Cola para mañana, en este orden:**
1. **Operador + teléfono:** iniciar sesión con `341lin@gmail.com` en el teléfono (yo no leo credenciales) → **vincular ARCA en homologación** (certificado propio del ambiente) → medir `fact-hitl` y `fact-cae` con la factura de $100 a consumidor final, **botón final = el operador**. Después lo mismo en **producción** (clave fiscal del operador; es comprobante real).
2. **Operador:** reconectar **Google Calendar** (autorización de Google, en el teléfono) → medir `agenda`.
3. Con la sesión del operador abierta, recorrer las entradas que usan su usuario (§2): `vozchat`, `fact-voz`, `pres-voz`, `card`, `preg`, `hitl` (cancelar, sin mail), `recibo`, `pres-hitl`, `pres-ciclo`, más los veredictos por código de §2.bis (`splash`, `volver`, `reveal`, `ingresar-error`; el cierre de sesión sólo con el usuario del operador).
4. **Usuario descartable** (autorizado): falta el mecanismo del alta — el operador genera la invitación / el alias; el candado `COPILOTO_SIGNUP_ALLOWLIST` + `COPILOTO_INVITE_TOKEN` no se lee. Cubre `bi-vacio`, `vacio`, `vacio-visto`, `onb-cumplida`, `onb-promesa`.
5. **Build release** para `entrada` y el experimento R03: **DECIDIDO (operador, 2026-10-16): se hace AL FINAL**, después de terminar todo el relevamiento **y** de implementar todas las correcciones que salgan de él (incluida la Pregunta 4). No se compila antes.

**Trabajo mío que no necesita al operador (puede adelantarse):**
- Editar el prototipo y el mapa (`mapa-pantallas/index.html`, `prototipo/index.html`, `specs/mobile-coherencia.md`) para agregar el **aviso de Google Calendar** caído en la portada de Mi día.
- `pedido_` a planificación: ficha con DoD para la **Pregunta 4** (Mi día = tarjeta de cabecera + lista «Ahora» + «Para hoy · Ver tablero ›»; pantalla «Tu día» con «Volver»; qué pasa con los filtros por categoría y «Anotar algo para hoy»). Es MAYOR: Plan v1 + v2.
- Defectos del propio mapa sin decidir: N4 (paso de perfil en el onboarding), N5 (`?ver=vacio`), N7 («30 pantallas» vs 51).
- Al cerrar todas las medidas: regenerar conteos (`collections.Counter`), `cierre_` con FICHA/SHA/DOD y aviso de teléfono libre (§8).

**Teléfono:** `RF8T318RN9T` libre (aviso en el buzón). Antes de tomarlo mañana, `avance_` de TOMO.

**Para que el agente termine SOLO tras los cuatro toques del operador (sesión, ARCA, Calendar, botón de emitir):**
- *Operador, antes de irse:* (a) teléfono con USB depuración, desbloqueado y conectado a la PC; (b) iniciar sesión con `341lin@gmail.com` y **dejarla abierta**; (c) vincular ARCA homologación (y producción si hay tiempo) y reconectar Calendar; (d) para el descartable: agregar el mail/alias a la allowlist o dar la invitación (nunca pegar el token en el chat) y elegir la contraseña **en el teléfono**.
- *Agente, receta:* worktree desde `origin/main` en `C:/gfw-src/wt-fe2-relevN` · `cd apps/mobile && CI=1 EXPO_PUBLIC_API_BASE=https://copilotoemprendedor.duckdns.org npx expo start --dev-client --port 8081 --clear` · `adb reverse tcp:8081 tcp:8081` · helpers versionados en `scripts/device/adb_helpers.py` (`cap`, `tap`, `swipe`, `hold`, `slide` en dp, `deeplink`).
- *Orden autónomo:* §2 con la sesión abierta → `fact-hitl`/`fact-cae` sólo hasta la card (el botón lo toca el operador) → cierres de sesión (`splash`/`volver`/`reveal`/`ingresar-error`) AL FINAL, porque vuelven a pedir login → descartable → regenerar conteos y `cierre_` (§8).
- *Sin el operador no se hace:* el botón de emitir, el login tras cada cierre de sesión, la voz real (si no hay quien hable, la fila queda NO-VERIFICABLE con el motivo), el build release.
- *Estado del repo:* PR #1300 lleva estas decisiones; el CI no corrió solo (docs): se disparó con `gh workflow run tests.yml --ref <rama>`.

## 00.bis Sesión con el operador (2026-11-02): avance y hallazgos NUEVOS

**Hecho en device (teléfono `RF8T318RN9T`, sesión Google de `341lin@gmail.com`):**
- Sesión iniciada; perfil de onboarding completado por el operador; **Calendar ya estaba conectado** (no hizo falta reconectarlo: `agenda` se mide sin su toque).
- **ARCA vinculada en Homologación** (`afip_credentials` 0 → 1 activa `dev:***065`, medido con `scripts/diag/estado-tenant-prod.sh`). Causa del primer fallo: el token de AfipSDK (`AFIP_ACCESS_TOKEN`) estaba vencido (`401 invalid_token`); se reemplazó en `/etc/unreal-copilot/copiloto.env` con el token «TOC» (respaldo del `.env` en el mismo directorio; permisos devueltos a `600` tras un descuido mío que los dejó en `644` ~1 min).
- Producción: **sin vincular** (el operador debe cargar usuario y clave fiscal de producción; el CUIT de prueba precargado `20111111112` NO era el suyo).

**Pedidos del operador (decididos, a implementar en la tanda de correcciones):**
1. **Icono de configuración en «Funciones».** Hoy la única puerta a Ajustes es el avatar de «Mi día» (`PantallaMiDia.tsx:729`); en el panel «Funciones» no hay ninguna. Hay que poner un icono de acceso a Ajustes ahí.
2. **El botón «Vincular» de cada ambiente debe ser el RECUADRO COMPLETO tocable**, no solo la palabra (`PantallaAfipSetup.tsx:927-933`: hoy solo la palabra es `Pressable`). Y el recuadro de un ambiente sin vincular debe **verse igual** que el de Homologación «Activo» (mismo marco y estado visual).
3. **En la beta no aparecerá Homologación** (decisión del operador: es solo para pruebas). El selector de ambientes de la beta muestra solo Producción; Homologación queda para desarrollo/pruebas internas.

**Hallazgos de usabilidad (clase A, medidos en device):**
- Tocar «Vincular» en un ambiente abre el formulario en el bloque «2. Conectar con ARCA» (arriba), sin desplazar la pantalla: desde el bloque 3 parece que no pasó nada.
- El formulario de usuario/clave **no dice a qué ambiente vincula**; con Producción (comprobantes reales) es el caso grave.
- Los botones «Guardar perfil» y «Continuar» se apagan con CUIT de menos de 11 dígitos **sin decir por qué** (`PantallaAfipSetup.tsx:679`, `:793`).
- El error «No pudimos vincular… escribinos» no distingue una falla del servicio (token del proveedor) de un dato mal cargado.
- El avatar de Mi día se dibuja vacío («·») porque nadie le pasa `inicial` (`AvatarCuenta.tsx`), y es la única puerta a Ajustes.
- El paso de perfil del onboarding (N4) muestra los errores en rojo antes de tocar nada.
- «Presupuestos» se parte en «Presupuesto/s» en el tile de Funciones (a 390 dp).
- Observación (no concluyente): el proceso de la app murió una vez por `signal 9` (muerte externa, sin crash en el log).
- **A CORREGIR (orden del operador, 2026-11-02): la pantalla de ARCA no se refresca sola al terminar la vinculación.** Medido: Producción quedó vinculada y activa en el servidor (`dev` inactiva, `prod` activa, diag `estado-tenant-prod.sh`; `POST /afip/conectar` 200 a las 10:45 hora del teléfono) y 3 min después la pantalla seguía diciendo «vinculada en Homologación» con Homologación «Activo»; recién al salir y volver a entrar mostró Producción «Activo». Criterio: el estado se actualiza **solo**, sin salir ni reentrar. Pista: `PantallaAfipSetup.tsx` (polling `poleando`/`refrescarEstadoGeneral`, `usarAmbiente`) — comprobar que al cerrar el polling con `completado` se llame a `refrescarEstadoGeneral(cuit)`. Causa NO verificada todavía.

- **HECHO 2026-11-02: Producción vinculada y factura REAL emitida** (botón final tocado por el operador, su usuario `341lin@gmail.com`): Factura C (tipo 11), PV 6, N° 10, CAE 86440590262416, vence 2026-11-12, total 100,00; comprobante `423`; servidor: `cliente` → `confirmar` → consulta de estado, todos 200 (13:53 UTC); queda «Todavía no te la pagaron».
- Máscara de fecha de «Datos de venta»: con `adb input text 02112026` quedó `DD / 02 / 1120` y después no respondió a borrar ni reescribir con toques sintéticos; el operador la cargó a mano sin problema. **No concluyente** (puede ser el instrumento, no la máscara): repetir con teclado real antes de llamarlo defecto.
- Panel de compartir: faltaba WhatsApp/Telegram porque no estaban instalados (`pm list packages`, control positivo con Gmail/Mensajes); tras instalarlos el operador confirmó que funciona. No es defecto. Mejora de UX opcional: el panel muestra solo el link crudo de AfipSDK, sin texto.

- **A CORREGIR (clase A, orden del operador 2026-11-02): los botones laterales de la barra «Escribí, o hablá…» del chat están casi invisibles.** Medido en device (captura con el campo vacío y con texto escrito): el de la izquierda (tacho/micrófono, x≈77 de 720 px) y el de la derecha (enviar, x≈643) son un cuadrado redondeado muy pálido con ícono rojo de contraste mínimo; no se lee qué hacen ni si están activos. No es solo «apagado por estar vacío»: con texto cargado seguían igual. Criterio: contraste legible en reposo y estado deshabilitado distinguible.
- **Diferencia del chat (`fact-hitl`, #26):** al pedir «Facturale 100 pesos a consumidor final» el asistente no asumió consumidor final: respondió «Necesito más información… Podés darme el CUIT o DNI del consumidor final.» Recién tras «no hace falta… consumidor final» apareció la tarjeta «Factura C · ARCA», con Cliente «consumidor final» y el aviso «Esto entendí, pero falta completar algo antes de emitirla». El mapa muestra la tarjeta directa. Falta capturar la tarjeta completa (el teclado la tapaba) y decidir si «consumidor final» explícito debe saltear la pregunta.
- **HECHO 2026-11-02: segunda factura REAL, ahora por el chat y por voz** (operador, botón final suyo): N° 11, CAE 86440594053582, vence 2026-11-12, total 100.00, «Guardada en tu Drive»; servidor `POST /afip/facturas/dictado-conv-web-…/confirmar` 14:07:22 UTC. Es la contraparte real de `fact-voz` (#25), `fact-hitl` (#26) y `fact-cae` (#27). Diferencias contra el mapa (a cerrar con captura limpia, la tomada llevaba encima la barra de capturas de Samsung): la app dice «Factura emitida.» con `Tipo de comprobante 11 · Punto de venta 6 · N° 11` sin formato y sin cliente; el mapa muestra «Factura C emitida», N° `0003-00000127`, importe, cliente, CAE, vencimiento y enlace «PDF», y ofrece Drive / **mail** / WhatsApp (la app: «Abrir en Drive» / «Compartir», sin mail).
- **A IMPLEMENTAR (orden del operador, 2026-11-02): la tarjeta «Factura C · ARCA» debe traer un botón para EDITAR todos los datos de la factura, junto al de «Emitir la factura».** Hoy no hay forma de modificar nada una vez que aparece la card: solo se puede emitir o rehacer el pedido por chat. Medido en el código: `TarjetaFacturaPropuesta.tsx:26` declara a propósito «No es una card editable como gasto/ingreso/presupuesto — es un gate + un handoff», con lo que el pedido **revierte esa decisión de diseño**; hay que decidirlo explícito con planificación (hay un `contrato_` previo del 2026-10-13 cuyo nombre dice «el Editar es contrato MUERTO»: leerlo antes de diseñar, no inventar). Alcance pedido: editar **todos** los campos (tipo de comprobante, cliente y su condición/documento, ítems y descripciones, importes, fecha, concepto, condición de venta). Criterio de terminado: desde la card, tocar «Editar», cambiar un dato, volver a la card con el dato nuevo y recién ahí «Emitir», sin pasar por otra pantalla de otro flujo; con test y evidencia en device (en Homologación, sin emitir real). Riesgo a cuidar: lo editado tiene que viajar por el mismo gate de confirmación (`confirmarConTokenFresco`), no por un camino paralelo que se saltee la verificación.
- **Evidencia de la card sin «Editar»** (`2026-10-16-relevamiento-capturas/app-mapa-fact-hitl-sin-boton-editar.png`, device 2026-11-02 11:15): encabezado «Factura C · ARCA», «Esto entendí. Revisalo y tocá Emitir la factura — todavía no la mandé.», Cliente «consumidor final» / «Consumidor Final», ítem «slinga de acero de 10 milímetros de 2 metros de largo» 1 × 200, Total 200.00, aviso de nota de crédito y **un único botón «Emitir la factura»**. El dictado dejó la transcripción con errores («…la factura no hace falta el quit»), que es el caso donde editar más hace falta. `fact-hitl` queda medido como DIFERENTE · A (falta Editar; el prototipo muestra «Queda así. Revisala antes de emitir»).
- **A IMPLEMENTAR (orden del operador, 2026-11-02): la card «Factura C · ARCA» también debe tener «Cancelar».** Medido en device (captura de arriba): el único botón es «Emitir la factura»; no hay forma de descartar la propuesta sin emitirla, y mientras la card queda pendiente en el hilo la acción sigue disponible. Criterio: la card trae **Editar · Cancelar · Emitir la factura** juntos; «Cancelar» descarta la propuesta sin emitir nada, deja la card marcada como cancelada (no vuelve a ofrecer Emitir tras un remount, mismo mecanismo `facturaResuelta` que ya cierra la card tras emitir, `TarjetaFacturaPropuesta.tsx:65`) y no llama a ARCA. Contraste: las cards HITL del mapa (`hitl`, «Confirmar y mandar» / «Cancelar») ya traen Cancelar; esta es la excepción. Test adversarial: tras «Cancelar», ni un toque repetido ni un remount pueden emitir.
- **MEDIDO 2026-11-02 · `agenda` (#16) → DIFERENTE · A** (`app-agenda.png`; Calendar reconectado por el operador, «5 conectadas de 5» en `app-apps-conectadas-5-de-5.png`). El prototipo dibuja una **línea de tiempo** del día (horas 8:00–15:00, bloques de evento, **línea del ahora**) con «Hoy martes 18» y el botón «+ Nuevo evento» en una píldora a la derecha; la app muestra una **lista** agrupada Hoy / Mañana / Esta semana / Sin hora («Nada por acá.»), sin grilla horaria ni línea del ahora, el botón «Nuevo evento» de ancho completo y sin «+», y «Google Calendar conectada» sin el punto de estado. A mirar aparte: «Jujuy 1660 - VER (varios detalles)» aparece **dos veces** idéntico (08:30–17:15) en Esta semana; puede ser dato real duplicado en el calendario del operador o un defecto de listado — no verificado.
- **A CORREGIR (clase A): las tiles de Ajustes dibujan un fondo blanco cuadrado que sobresale del borde redondeado** (visto en `Ajustes`, 2026-11-02 11:19; mismo artefacto en las cards de «Apps conectadas»). Medido solo en captura; sin causa verificada.
- **DECISIÓN DEL OPERADOR (2026-11-02): las entradas de VOZ se miden DESPUÉS de las correcciones, no ahora.** Motivo: el botón grande de voz que hay hoy ya no está en el mapa nuevo, así que medirlo contra el mapa no sirve. Afecta a `vozchat`, `fact-voz`, `pres-voz` y al cancelar-deslizando de `grabando`: **quedan NO-VERIFICABLE hasta entonces**. Corrección a lo dicho antes en esta sesión: la factura N° 11 fue dictada, pero **no cuenta como medición de `fact-voz` (#25)**; sí sirvió de contraparte de `fact-hitl` (#26) y `fact-cae` (#27), que son de la card y no del dictado.
- **DEFECTO GRAVE (clase A, prioridad alta) 2026-11-02 11:17–11:23: cancelar por chat NO desactiva la card.** Evidencia: `app-fact-hitl-cancelada-por-chat-sigue-emitible.png`. El operador escribió «Cancela» (11:17, recibido); Odobi contestó «Borré la tarjeta de la factura. Si necesitás algo más, no dudes en decirlo.»; seis minutos después la card «Factura C · ARCA» de $200 seguía en el hilo con **«Emitir la factura» activo**. El mensaje afirma un efecto que la UI no tiene: tocarlo emitiría un comprobante fiscal REAL en Producción tras haber dicho el sistema que se canceló. Verificado en el servidor: 0 `confirmar` desde las 14:08 UTC (no se emitió; nadie la tocó). Causa NO verificada: falta saber si el backend marcó la propuesta como descartada y la card no lo refleja, o si el «Borré» es solo texto del modelo sin acción. Esto refuerza el pedido de «Cancelar» en la card y suma un criterio: **una propuesta cancelada (por botón o por chat) deja la card deshabilitada y el backend rechaza el `confirmar` de esa propuesta** — test adversarial: cancelar, luego confirmar → denegado.
- **Incidente del instrumento:** un gesto mío (`slide` desde el borde inferior) inició una grabación de voz sin querer; se descartó con el tacho, no se envió nada.
- **Teléfono compartido:** el operador escribió en el chat mientras yo operaba; para medir en paralelo hay que acordar quién toca (un segundo operador fabrica evidencia).

- **Veredictos medidos 2026-11-02 (chat, Producción):** `preg` CONFORME (responde «cuánto facturé»). `card` CONFORME para gasto (editable, Cancelar/Guardar). `hitl` DIFERENTE·A: pedido «Mandale un recordatorio por mail a Lucia para mañana» → el asistente propuso un evento de **Google Calendar** «Recordatorio para Lucía» (no un mail Gmail con «Confirmar y mandar»/«Cancelar» como el mapa); botones «Confirmar»/«Cancelar». Al tocar Cancelar se envió «Cancelar» como mensaje, el asistente respondió «Parece que el recordatorio fue cancelado» y **la card siguió visible con ambos botones activos** (mismo defecto que la factura: cancelar no desactiva la card). Evidencias: `app-hitl-recordatorio-lucia.png`, `app-hitl-cancelada-card-sigue-visible.png`. No se confirmó nada: no se creó evento.

**Pendiente de esta sesión:** Calendar ya reconectado (5 de 5); sigue el recorrido autónomo: `recibo`, `pres-hitl`, `pres-ciclo`, usuario descartable `structuralsource@gmail.com` y cierres de sesión.

## 0. Orden del operador (textual, 2026-10-16)

> «necesitamos prueba empírica del device de cada pantalla que falta… con adb sí se puede grabar y lo hemos hecho para las pruebas de audio… además no tenemos que grabar nada, sólo probar las pantallas… además también estoy yo para poder hacer lo que necesitemos en el device para terminar el relevamiento completo.»
> «podemos utilizar mi usuario para lo que resta… en principio debería de estar vinculado a ARCA y poder emitir factura… podemos hacer una por 100 pesos.»

**Lectura correcta de la orden:** las entradas que quedaron como NO-VERIFICABLE no eran imposibles; se descartaron por un criterio mío demasiado conservador. Cada una se mide **llevando la app a esa pantalla y capturándola**, no ejecutando la acción de fondo. El operador está presente para tocar el teléfono cuando haga falta.

## 1. Qué ya está hecho (no repetir)

- 51 entradas del mapa clasificadas: 4 CONFORME · 26 DIFERENTE (22 A + 4 B) · 21 NO-VERIFICABLE (`scratchpad` del doc de #1288, conteo con `collections.Counter`).
- **Actualización 2026-10-16 (tarde):** `grabando` y `bloqueado` medidos en device (DIFERENTE · A, hallazgo N8) y `plan`/`limite` clasificados por CÓDIGO con la cita de DEC-8 (DIFERENTE · B): el doc del mapa queda en **4 CONFORME · 30 DIFERENTE (24 A + 6 B) · 17 NO-VERIFICABLE**. Las filas 1, 2, 20 y 21 de la sección 2 ya están resueltas; el resto de la tabla sigue vigente.
- Relevamiento previo de 45 filas: A 29 · B 9 · C 0 · D 7.
- 28 decisiones de los 14 mockups repasadas; hallazgos N1–N7.
- Las 63 capturas nuevas están versionadas en `2026-10-16-relevamiento-capturas/`.

## 2. Pendientes — las 21 entradas NO-VERIFICABLE

Clave de método: **MOTION** = `adb input motionevent` (DOWN/MOVE/UP; nunca `input tap` para gestos de RNGH, ver memoria `adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan`). **OP** = lo hace el operador con el teléfono en la mano.

| # | Entrada | Qué se mide | Cómo | Riesgo / requisito |
|---|---|---|---|---|
| 1 | `grabando` | pantalla de grabación en curso | **✔ HECHO 2026-10-16** (DOWN sostenido sin voz en Gastos) → DIFERENTE · A; ver N8 en el doc del mapa | sólo queda, con un dedo real, el cancelar al deslizar a la izquierda (`[UNVERIFIED]`) |
| 2 | `bloqueado` | audio bloqueado por deslizamiento | **✔ HECHO 2026-10-16** (DOWN + 6 MOVE hacia arriba, descartado con el tacho) → DIFERENTE · A; ver N8 | no quedó ninguna nota de voz enviada |
| 3 | `vozchat` | lo dictado aterrizando en el chat | MOTION como #1 y soltar hasta que aparezca el texto | **escribe un mensaje en el hilo**: con el usuario del operador, no con el canónico |
| 4 | `fact-voz` | facturar por voz | ídem, entrando desde Facturación | usa datos de cliente: cliente de prueba |
| 5 | `pres-voz` | presupuesto por voz | ídem, desde Presupuestos | cliente de prueba |
| 6 | `card` | card de gasto aterrizando (aviso, botones) | escribir o dictar un gasto chico en el chat | crea un dato; borrar/cancelar después. Frase esperada del aviso: la del código (decisión 8) |
| 7 | `preg` | pregunta libre en Inteligencia | escribir una pregunta; el mapa dice que contesta dentro, la app sale al chat (decisión 2026-10-13) | consume una acción del plan |
| 8 | `hitl` | confirmación «Recordatorio a Lucía» («Confirmar y mandar» / «Cancelar») | pedir el recordatorio, capturar la card, **Cancelar** | no mandar el mail; destinatario de prueba |
| 9 | `recibo` | comprobante tras ejecutar | confirmar una acción chica de prueba | acción real: elegirla inocua |
| 10 | `fact-hitl` | confirmación previa a emitir («Revisalo y tocá Emitir la factura») | pedir una factura de **$100** a un cliente de prueba y capturar la card antes de emitir | **verificar antes el ambiente y el estado de ARCA (sección 4)** |
| 11 | `fact-cae` | comprobante con CAE | emitir la factura de $100 | irreversible: sólo con ARCA vinculado, ambiente a decidir (homologación o producción) y cliente de prueba; el operador autoriza el botón |
| 12 | `pres-hitl` | aviso y botón («Guardar el presupuesto») | crear una propuesta de presupuesto y capturar antes de guardar | igualar rótulo del botón con el mapa |
| 13 | `pres-ciclo` | anotado → aprobado → factura | recorrer el ciclo con un presupuesto de prueba | varios pasos reales |
| 14 | `bi-vacio` | Inteligencia sin ventas | usuario/tenant sin facturas | ver sección 3: no se fabrica borrando datos |
| 15 | `onb-cumplida` | primer insight con plata real | usuario nuevo con facturas cargadas | ídem; los importes del mapa son ejemplo |
| 16 | `agenda` | agenda con la línea del ahora | reconectar Google Calendar en el usuario de prueba | OP: la conexión es una autorización de Google |
| 17 | `vacio` | estado «Nada urgente por hoy.» | usuario sin tarjetas | además el deep link `?ver=vacio` del prototipo está roto (N5) |
| 18 | `vacio-visto` | ídem, variante por días | ídem | ídem |
| 19 | `entrada` | arranque en frío hasta Mi día | **build release** (el dev-client contamina el tiempo) | si el chat sube solo también en release, es defecto nuevo (se suma a R03) |
| 20 | `plan` | — | **no existe en la app**: DEC-8 (acta 21/09) lo dejó fuera de la beta → `BL-V2` | se resuelve sacándolo del mapa; no se mide |
| 21 | `limite` | — | ídem DEC-8 | ídem |

**Error mío a corregir en lo ya informado:** en una respuesta al operador conté `splash`, `volver` y `reveal` dentro de las 21. **No lo están.** Son tres entradas con veredicto por **CÓDIGO** cuya *animación* no se vio en device (ver sección 2.bis). Las 21 son exactamente las de la tabla de arriba (19 de «Falta medir» + `plan` + `limite`).

### 2.bis Veredictos por CÓDIGO que conviene confirmar en device (6 + 2)

Veredicto sin captura propia, sólo lectura de código: `splash` (DIFERENTE B), `volver` (CONFORME), `reveal` (DIFERENTE B), `ingresar-error` (CONFORME), `onb-promesa` (CONFORME), y `plan` (ya cubierto arriba). Además `afip` y `apps` son DEVICE+CÓDIGO (DIFERENTE A): el código dice qué texto hay; falta mirarlos con el estado real del usuario.
- `splash` / `volver` / `reveal`: exigen **cerrar sesión** para ver la secuencia (6,8 s). Con el usuario del operador, no con el canónico. Grabar con `adb shell screenrecord` y extraer cuadros.
- `ingresar-error`: escribir una contraseña mala a propósito en el login (no cuenta como ingreso fallido del canónico si se usa el usuario del operador).
- `onb-promesa`: es la pantalla del primer ingreso de un usuario nuevo.

## 3. Datos de usuario: lo que bloquea varias filas

Las filas 14, 15, 17, 18 (y parte de 16) dependen del **estado del tenant**: sin ventas, sin tarjetas, primer ingreso. Un tenant ya poblado no las muestra y **no se borran datos para fabricarlas**. Opciones, a decidir:
1. Un usuario nuevo descartable (alta por invitación) → cubre `bi-vacio`, `vacio`, `vacio-visto`, `onb-promesa` y `onb-cumplida` (después de cargar una factura).
2. Usar el usuario del operador para las filas con datos y uno descartable para las vacías.

El alta tiene candado: `COPILOTO_SIGNUP_ALLOWLIST` y `COPILOTO_INVITE_TOKEN` (nombres de variables en `/etc/unreal-copilot/copiloto.env`; **no se leyeron valores**).

## 4. El usuario del operador — qué se sabe y qué no

**Medido hoy (GoTrue admin API, sólo lectura):**
- `341lin@gmail.com` · `id` `2598d84b-59df-4fa4-95a6-add5f597e606` · `cliente_id` `48a9d75f-124b-4f9d-af8d-a73e2311bbbd`.
- Alta: 2026-07-05, mail confirmado. `app_metadata.providers = ['email', 'google']`: puede ingresar con **mail + contraseña** y con **Google**. Último ingreso 2026-08-13. Es admin (`copiloto_admin: true`).

**NO verificado — ARCA:** la memoria `afip-vacia-en-prod-era-una-consulta-ciega-por-force-rls` dice que el 2026-09-15 esta cuenta tenía **`afip_credentials` = 0 y `afip_perfil` = 1** (sin credencial ARCA). Es un dato de hace un mes. La consulta de relectura (con `request.jwt.claims` y el control `rolsuper/rolbypassrls`) quedó **denegada por el clasificador de permisos** la segunda vez; la primera (sólo columnas) pasó. Para emitir una factura hay que saber: ¿credencial cargada?, ¿`activo`?, ¿`ambiente` (homologación o producción)?, ¿`punto_venta`?, ¿`ws_autorizados`?
- Camino A (sin permisos especiales): ingresar en el teléfono con el usuario del operador y mirar **Ajustes → ARCA**. Necesita la contraseña o que el operador haga el ingreso con Google.
- Camino B: correr la consulta con aprobación puntual del operador, o que la corra él.

**ARCA MEDIDO (2026-10-16, tras #1299, `scripts/diag/estado-tenant-prod.sh --email 341lin@gmail.com`, sólo lectura):** `afip_credentials` = **0** filas (ni homologación ni producción), activas 0; `afip_perfil` = 1; `mp_credentials` = 1. Controles del propio script: RLS sin tenant = 0 (fail-closed), tenant resuelto con la función de la policy, adversarial «0 = las propias». **El usuario del operador NO tiene ARCA vinculado**: hay que vincularlo (por ambiente) antes de emitir. Camino A queda como confirmación en device (Ajustes → ARCA).

**Decisiones del operador (2026-10-16, textual):**
- *Ambiente de la factura de $100:* «ambos ambientes probaremos» → **homologación Y producción**. La credencial es **una por ambiente** (`afip_credential_store.py:88-95`: `dev`/`prod`, certificados distintos), así que son **dos vinculaciones** y dos facturas; el toggle entre ambientes ya vinculados es `afip_web.py:655`. El default de la superficie es homologación (`afip_web.py:99`).
- *Botón final de emitir:* «lo toco yo, pero será con mi usuario, no con uno de prueba» → emite `341lin@gmail.com`, **no** un usuario descartable. Sustituye la regla anterior de «cliente de prueba». **Producción = comprobante fiscal real** con CAE: sólo el operador toca el botón, y se registra ambiente, CUIT enmascarado y número de comprobante en el cierre.
- *Receptor de las facturas:* «consumidor final» (en los dos ambientes).

**Regla de seguridad para emitir:** no emitir nada sin haber visto el estado de ARCA (visto: 0 credenciales); el operador autoriza el botón final en cada ambiente; registrar el ambiente en el cierre.

## 5. Falta de herramienta — pedido del operador (RESUELTO el 2026-10-16 por #1296 + #1299)

> **Estado:** `scripts/diag/estado-tenant-prod.sh` (read-only, selector por email o cliente_id, sin `cert_enc`/`key_enc`/`DATABASE_URL`, CUIT enmascarado, con control RLS y adversarial) corre en real desde #1299 y contestó el §4. El texto de abajo es el planteo original.

El operador dijo: *«si en el futuro necesito chequear cosas como estas no puedo entrar a la app de un usuario… hay que resolverlo de alguna forma».* Hoy ver el estado de un tenant (ARCA vinculado, método de alta) exige un acceso directo a la base de producción que el clasificador frena. Hay que **diseñar una vía legítima de diagnóstico por tenant**, de sólo lectura, con auditoría. Candidatos a investigar (no confirmados): endpoints de admin protegidos por el claim `copiloto_admin` (§5.5 de `HANDOFF.md`), la consola (`COPILOTO_CONSOLA_DSN`), y `scripts/evidencia/contar-filas-prod.sh` (ya tiene permiso en `.claude/settings.local.json`). Es una decisión **MAYOR** (superficie nueva sobre datos de tenants): Plan v1 + v2 antes de tocar, y control adversarial (un admin no ve lo de otro por error de scoping).

## 6. Otros pendientes ligados (no son del relevamiento pero dependen de él)

- **Contrato de planificación** `2026-10-16_contrato_planificacion-a-frontend2_DECISIONES-7-y-8…` (en `coordinacion/abierto/`): **el operador ordenó dejarlo pendiente; no se tocó en ese momento — después ordenó ejecutarlo primero y quedó hecho el 2026-10-16: la 8 en #1293, la 7 con la fila E5 de la concordancia en CONFORME.** Dice: (7) «Volver» a la izquierda con «‹» en todos los call-sites del marco glass + captura a 390 px de ≥2 pantallas + fila E5 → CONFORME; (8) gana la frase del código «Esto entendí. Revisalo y tocá Guardar el gasto — todavía no lo anoté.», se actualiza el **mapa** y `CONTEXT.md`, cero cambios en `apps/mobile`, grep del literal viejo = 0 con control positivo. Se creó y no se usó nada: ningún worktree de esa tarea existe.
- **R03** sigue `[UNVERIFIED]`: necesita el experimento de +0,3 / +0,8 / +3 s.
- **N1** (montos partidos) y **N2** (indicador de refresh sobre el saldo): defectos, a la cola de trabajo.
- ~~Tercer conflicto de copy: aviso de **Mercado Pago caído**~~ — **RESUELTO 2026-10-16** (#1298: gana la frase del código). **Segundo aviso de Google Calendar: DECIDIDO (2026-10-16) — se agrega al mapa.**
- **Pregunta 4** (estructura de Mi día / tablero): **RESUELTA (operador, 2026-10-16) — gana el mapa**, el tablero es pantalla propia «Tu día». Es la corrección más grande de la lista y falta su ficha de implementación (`pedido_` a planificación).
- Defectos del propio mapa: portada dice «30 pantallas» y hay 51 (N7); `?ver=vacio` y `?ver=vacio-visto` no muestran su estado (N5).

## 7. Receta para retomar el device (el worktree anterior se borró)

1. Worktree desde `origin/main` (`git worktree add /c/gfw-src/wt-fe2-relevN -b … origin/main`), `npm`/Metro en ese worktree (Metro sirve el bundle del **checkout desde donde arranca**, ver memoria `metro-sirve-el-bundle-del-checkout-compartido-no-del-worktree`).
2. Teléfono `RF8T318RN9T` (720×1600 = 390 dp): `adb reverse tcp:8081 tcp:8081`, modo avión + «Connect» al dev-launcher (memoria `receta-avion-reverse-connect-destraba-dev-launcher`). El engranaje «Tools» es del dev-client, no de la app.
3. Gestos con `adb input motionevent`; helpers en el scratchpad de la sesión (`rel2/d.py`: `cap`, `drag`, `tap`, `sh`) — **se pierden si se borra el scratchpad**; recrear.
4. **El teléfono exige dueño único.** Avisar por el buzón antes de tomarlo y al liberarlo (`avance_`). Al terminar: matar Metro, `adb reverse --remove tcp:8081`, avión off, dejar Mi día.
5. Cerrar sesión (para `splash`/`volver`/`reveal`) **sólo con el usuario del operador**, nunca con `e2e-device@copiloto.test` (usuario canónico, lo usan otras sesiones).

## 8. Criterio de terminado del relevamiento completo

1. Las 21 entradas de la sección 2 con veredicto **CONFORME / DIFERENTE** y captura de device versionada; salvo `plan`/`limite` (se retiran del mapa) y las que una decisión del operador deje explícitamente fuera, cada una con su motivo.
2. Los 6 veredictos por CÓDIGO de la sección 2.bis confirmados o corregidos en device.
3. Doc `…mapa-de-pantallas-vs-app.md` y artefacto regenerados con los conteos nuevos (derivados con `collections.Counter`, no escritos a mano).
4. Cada fila nueva con clase A/B/C/D y, si B, cita.
5. `cierre_` en el buzón con `FICHA:` · `SHA:` · `DOD:` y aviso de teléfono libre.
6. Lo irreversible (CAE, mail real) sólo con autorización explícita del operador en ese momento.
