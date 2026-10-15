# Veredictos — TRIAJE15, capa cáscara/escritorio/tablero (frontend-2, 10 filas + `consent`)

**Fecha:** 2026-10-13 · **Contrato:** `contrato_planificacion-a-frontend1-y-frontend2_TRIAJE15-se-parte-por-CAPA` ·
**Fuente de las filas:** `2026-10-13-veredictos-device15-15-filas.md` (medición en device, `2610bb6b`) ·
**Código:** PR #1093 (`440339c5`) + #1084 (`6e10b57d`, TRIAJE15 A/B/C).

**DoD por fila:** resuelta en código (símbolo `archivo:línea` + test) **o** enmienda con autoridad citada. «Se ve mejor
así» no es autoridad. **Esto acredita código + jest, no el teléfono**: las filas con device esperan UN turno de
re-medición (frontend2, dueña única de `RF8T318RN9T`); mientras tanto la fila queda **cerrada en código**, no `COHERENTE`.

Convención: `R` = resuelta en código · `E` = enmienda con autoridad · `D` = ⛓ depende de otra capa (pedido emitido) ·
`P` = ⚠ no medible / no reproducible, con el porqué y cómo se mediría.

## Cáscara y escritorio

| fila | divergencia | veredicto |
|---|---|---|
| `(home)` | grip «FUNCIONES» vs «Baja para tus funciones» (`index.html:1639`) | **R** `PanelFunciones.tsx:186` — «Bajá para tus funciones» / «Subí para volver a Mi día» según abierto · test de `PanelDeslizable` |
| | no existe «Ver tablero ›» (el tablero se fusionó en las solapas) | **E** `PantallaMiDia.tsx:101-103` — las solapas con su contador ya SON el tablero; un vínculo a una pantalla que no existe sería una ruta muerta (Mi día = base, Ola 4) |
| | agenda «Ahora» inline | **P** requiere Google Calendar conectado (OAuth externo, `NO_REPRODUCIBLE_SIN_EFECTO`); medible con una cuenta con Calendar conectado en device |
| `bi-refresh` | línea permanente «Tirá para actualizar» | **R** `PantallaInteligencia.tsx:174-176` — el estado sólo existe durante el gesto o la confirmación · test de Inteligencia |
| | «Al día · recién» dura 3000 ms vs 700 ms | **R** `textosRefresco.ts:21` `MS_AL_DIA = 700` (`PantallaInteligencia.tsx:141`) · test |
| | indicador del sistema vs el propio con flecha que gira; fase «Soltá» | **E** `PantallaInteligencia.tsx:7,196` — `RefreshControl` de RNGH por el `waitFor` del handler del `ScrollView`; en Android el sistema no expone la fase «Soltá». Se conserva el control nativo |
| | el refresh se dispara antes del UP | **R** causa atribuida y re-medida en device: el `RefreshControl` de `react-native` y el `ScrollView` de RNGH se disputaban el dedo (`waitFor` apuntando a nada), por eso `onRefresh` salía a los 0,3 s del DOWN; `PantallaInteligencia.tsx:4-7` importa el de RNGH y `:196` lo monta. Re-medición del 13-10 (`refresh2.py`): «Actualizando…» a t=5,2 s con UP en 4,8 s → ya no se dispara antes (`2026-10-13-veredictos-device2-remedicion-triaje15-fe2.md:68`) y la CLASE A de la Enmienda 2 sobre `ac86a5bd` lo confirma · test del mecanismo (#1234) |
| `chat` | isotipo 120 px de caja vs 96 px del prototipo | **R** `ListaMensajes.tsx:528` `<Marca size={96} tono="desnudo" />` · `Marca.tsx:25,51` tono `desnudo` (sin badge, isotipo = size) · 2 tests |
| | grip «ESCRIBILE A ODOBI» vs «Baja para volver a Mi día» (`index.html:1873`) | **E** `PantallaPrincipal.tsx:178` + `PanelDeslizable.tsx:156-177` — Ola 4 (2026-09-18): la conversación arranca ABAJO asomando; ahí el grip es la invitación a escribir, no el retorno a Mi día |
| `detalle` | sin filas kv «Monto / Enviado» | **R** `PantallaMiDia.tsx:690-695` — filas clave/valor como `.kv` del prototipo (`index.html:1692`) · test |
| | chip y píldora de acción (antes dependían de «semántica del backend») | **R** medido en device `@ ac86a5bd` (`d3exp-scroll`, doc device15 enmienda 2): la tarjeta expandida muestra la prosa con el importe, el chip «Emitida hace 42 días» y la píldora «Reclamar el pago». Salen de `tarjeta.presentacion`, que **prod ya entrega** — la dependencia del backend está cumplida |
| | tile de color | **R** — `TileCategoria.tsx` (pastel + glifo por categoría, leída del backend; sin categoría no hay tile), cableado en `PantallaMiDia.tsx` (`midia-tarjeta-<id>-tile`), pasteles en `tokens.ts` (`tileFuncion`), test `PantallaMiDia.test.tsx` «tile de color por categoría» con mutante verificado. **Se ve en device** (15-10, Metro local del PR sobre `5678979e`; prod aún sirve `ac86a5bd`): tarjeta de cobros con tile verde + moneda, tarjeta de presupuestos con tile crema + portapapeles |
| | línea monto·fecha bajo el pliegue | **P** `NO_MEDIBLE` en device por el panel de chat; medible con el panel colapsado |
| `tablero` | «Mi día» vs «Tu día» | **E** `CONTEXT.md:213` + `PantallaMiDia.tsx:567` — «Mi Día» es el nombre del glosario del dominio |
| | solapas sin contador / falta nota | **R** `PantallaMiDia.tsx:101-103` (contador pegado al rótulo, 0 no se dibuja) y `:555` `midia-nota` · test; paridad web (`MidiaScreen.tsx`) |
| | píldora «Reconectar» inerte → destino fino | **R** H5b: `destinoTarjeta.ts` `rutaDeDestino` + `PantallaMiDia.tsx` banner por `destino.tipo` + `PantallaPrincipal.tsx:199` + `apps.tsx` `?servicio=` · tests `PantallaMiDia.test` (incl. `tipo: "lo-que-sea"` → Ajustes) y `destinoTarjeta.test` · **espera medición en device con backend #1092** (en una `conexion_caida` YA abierta) |
| | viewport útil ≈120 dp con avisos | **R** `PantallaMiDia.tsx:434-438` — un solo `ScrollView` (`midia-scroll`) para encabezado, banner, solapas y lista: antes sólo la lista scrolleaba bajo un encabezado fijo (medido en device 2026-10-13: ≈89 px de lista visibles con 1 aviso crítico) · test «`tablero`: … UN solo scroll» · **espera re-medición en device** |

## Entrada, identidad y retroalimentación

| fila | divergencia | veredicto |
|---|---|---|
| `reveal` | wordmark 40 dp `#B04A2E` vs 46 terracota | **R** `RevealEntrada.tsx:27,149-153` — 46 dp, `COLOR_PALABRA_MARCA`, letterSpacing -0.02 · 3 tests |
| | descriptor/tagline | **R** `RevealEntrada.tsx:80,176` + `textosEntrada.ts` `TAGLINE_MARCA` · test |
| | forma residual sobre el wordmark | **R** corregido en H8 (TRIAJE15 B, `6e10b57d`); **espera re-medición** |
| | «Crear una nueva cuenta» | **E** `EntradaSesion.tsx:17-21` — decisión #3 (2026-08-04): en `primeraVez` la acción única es «Empecemos» |
| | botón pronunciar (`rv-say`, `index.html:2549`) | **D** ⛓ requiere el asset de audio de la pronunciación (pedido al operador/Martín); sin audio un altavoz mudo es peor que no tenerlo |
| `splash` | no existe la tagline «Tu copiloto emprendedor» | **R** `RevealEntrada.tsx:80` `Tagline` (`tema.tipo.base`, fade-up tras `T_BOUNCE_END`) · test incluido reduced motion · **se ve en device** (15-10, tras Cerrar sesión desde Mi cuenta; app sobre `5678979e`, prod `72b85cba`): la entrada muestra el lockup y, en estado estable, «Tu copiloto emprendedor» bajo él y «se dice o-DO-bi» debajo, con «Entrar» y «Entrar con otra cuenta»; la ráfaga de capturas pescó la fase intermedia (aro de la O colapsando) antes de la tagline |
| | formas sólidas vs gradientes y radios asimétricos | **R** `IdentidadEntrada.tsx:72,79,86` (`bordeElipticoPath`) y `:133-149` (`LinearGradient`) · `formasPath.test.ts` |
| | wordmark letra por letra con rebote | **P** `NO_MEDIBLE` por screencap (~1 s vs animación por letra); medible con grabación de pantalla a 60 fps |
| `entrada` | fondo crema vs `#FFFFFF` del prototipo | **R** `EntradaDiaria.tsx:128` — blanco en piel clara; en piel oscura manda el lienzo del tema (el prototipo sólo modela la clara) · test con sonda `useTema` |
| | animación translate/scaleX | **P** `NO_MEDIBLE` por screencap (ver `splash`) |
| `feedback` | título «Contanos qué tal», rótulo «TU FEEDBACK», «Mandar» | **R** `PantallaFeedback.tsx:105,128-130,181` (título, `etiquetaOculta`, «Mandar») y `:111` `feedback-bajada` · tests de `PantallaFeedback`; paridad web declarada en las excepciones |
| | «Lo pediste vos» muestra estado y no el mes | **R** `LoPedisteVos.tsx:14,81` `mesDeEnvio` · test |
| | derivación a Soporte antes y como card | **R** `PantallaFeedback.tsx:214-228` — va **después** de «Lo pediste vos», como el prototipo (`feedback-a-soporte`) |

## Soporte y consentimiento

| fila | divergencia | veredicto |
|---|---|---|
| `soporte` | «sin plazo fijo» vs «Antes de 4 h hábiles» | **E** `textosSoporte.ts:3-10` — no hay SLA vigente (acta beta-odobi, `BL-O7`); prometer «4 h hábiles» sería un compromiso inventado |
| | sin «Ver tickets anteriores (3) ›» | **R** — **el código ya existía** (#1115 `e3d1efa3`, ancestro de `ac86a5bd`): `TarjetaTicketSoporte.tsx` (`soporte-tickets-anteriores`) montada en `PantallaSoporte.tsx:231-235` vía `useTicketsSoporte.ts:76` (`listarMisTickets`). **Se ve en device** (15-10, Metro local sobre `5678979e`): «Ver tickets anteriores (4) ›» que despliega SOP-0004 / SOP-0003…. La medida previa lo daba por ausente porque el tenant canónico no tenía tickets entonces (sin vigente ni anteriores la tarjeta devuelve `null` por diseño) y se infirió «falta código» sin leer `PantallaSoporte` — error de método, no de código |
| | sin clip de adjuntos | **R** — **el código ya existía** (#1115): `PantallaSoporte.tsx:152-165` (`alAdjuntarFoto` → `adjuntarFoto`, sin ticket vigente avisa `SOPORTE_ADJUNTO_SIN_TICKET`) pasa `onFoto` al `Composer` (`chat-foto`, «Foto del ticket», `Composer.tsx:185-192`). **En device, con ticket vigente (SOP-0005): el clip abre «Foto del ticket · ¿De dónde sacamos la foto? Cancelar / Cámara / Galería»** (con destino, no el Alert de «sin ticket»); se canceló sin elegir, **no** se subió nada (escribiría un adjunto en el canónico). El control negativo (0 tickets: sin tarjeta y el clip avisa por Alert) NO se midió en device —el canónico ya tiene 5 tickets y no hay DELETE— y queda cubierto por `PantallaSoporte.test.tsx` |
| | entrada por hold-to-record + composer | **D** ⛓ decisión A/B/C del operador sobre el dictado hecho desde una función (`pedido_` planificación→operador) |
| | card «Ticket #…» | **P** `NO_REPRODUCIBLE_SIN_EFECTO` — abrir un ticket real avisa al equipo |
| `consent` | copy «Conectá {label}» vs «Conectar Mercado Pago» y filas «Solo lectura / Nunca sin tu OK» | **R** la dependencia original («`capacidades[]` por servicio») **se cumplió con otro nombre**: `alcance_items` con `condicion` en `apps/copiloto/catalog.py:145,149,192` (la card lleva `alcance`), `tests/test_alcance_condicion.py:63`; la app lo pinta en `SheetRequiereConexion.tsx:43-58` (`testID` `sheet-requiere-conexion-condicion-${i}`). **Se ve en device `@ ac86a5bd`**: «Leer tus cobros · Solo lectura», «Armar links de cobro cuando vos confirmás · Nunca sin tu OK». El copy «Conectá» (voseo) es deliberado |
| | el sheet no se alcanza sin efecto externo | **R** sí se alcanza, **sin efecto externo**: con un verbo que falla («arma un link de cobro de 1000 pesos», Mercado Pago desconectado) nace la card y el sheet. Medido en device `@ ac86a5bd`. De esa medición salió un defecto real —el composer y el botón de voz tapaban «Conectar»/«Ahora no»— **corregido y verificado en device** (PR #1221) |
