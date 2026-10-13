# Veredictos — bloque cáscara / ajustes / auth (frontend-2, 16 filas sin device)

**Fecha:** 2026-10-13 · **Contrato:** `contrato_planificacion-a-frontend2_bloque-CASCARA-AJUSTES-AUTH-16-filas-sin-device-del-mapeo`
· **Fuente de las filas:** `2026-10-12-mapeo-prototipo-vs-nativo.md` · **DoD por fila:** cada divergencia
queda **resuelta en código** (con `path:línea` y test) o **enmienda fundada con motivo escrito**.

⚠️ Acredita **código + jest**, no el teléfono: la verificación de device es del sprint siguiente (orden
del operador, 2026-09-22). Cada «RESUELTO» cita su test; cada «ENMIENDA» cita el porqué.

Convención: `R` = resuelto en código · `E` = enmienda fundada · `C` = ya coincidía (medido, no supuesto).

## Auth (3)

| fila | divergencia del mapeo | veredicto |
|---|---|---|
| `ingresar` | label «Email» vs «Mail» | **R** `PantallaLogin.tsx:159` · test «mapeo `ingresar`/`ingresar-error`…» |
| | divisor «o» entre Entrar y Google | **R** eliminado (y sus estilos) · mismo test, `queryByText('o')` nulo |
| | aviso «Tu sesión se cerró por seguridad…» siempre visible en el proto, condicional en el nativo | **E** `PantallaLogin.tsx:276` — el prototipo es una **hoja de estados** (una pantalla por estado, todas a la vez); en un teléfono el aviso sólo tiene sentido cuando hubo cierre. Se pinta con `avisoSesion !== undefined && estado === 'idle'` |
| `ingresar-error` | error DESPUÉS de los botones | **R** `PantallaLogin.tsx:205-215` — va entre contraseña y Entrar · test fija el orden `login-password < login-alert < login-submit < login-google` |
| | token de color `peligro` vs `terracota-prof` | **R** `acentoTinta` (claro `#B04A2E` = `--terracota-prof`); medido: `peligro` es `#c7455a`, otro color |
| | borde del campo contraseña en `acento` vs `terracota-prof` | **R** `PantallaLogin.tsx:196` |
| `volver` | labels idénticos por construcción; «Entrar» lleva a login con mail precargado; hereda las divergencias de `reveal` | **C** labels (`textosEntrada.ts:16-19`, `EntradaSesion.tsx`) · **E** mail precargado: el prototipo no modela navegación a login, y precargar es la intención del reveal («ya sabe quién era»; test `emailInicial`) · el botón de pronunciar es de la fila `reveal` (frontend-1/otra), no de ésta |

## Inteligencia (2)

| fila | divergencia | veredicto |
|---|---|---|
| `bi` | chip «Al 19 de agosto» ausente (comentario viejo decía que faltaba el dato) | **R** `PantallaInteligencia.tsx:209` `chip={chipDeCaja(portada.caja)}` — `fechaCorte` existe en core (`api/inteligencia.ts:41`) · 2 tests (con dato / sin dato no dibuja) |
| | pestañas Resumen/Preguntar que el prototipo quitó (DESTINO inteligencia→chat) | **E** la pestaña «Preguntar» es la superficie de preguntas de negocio hoy; quitarla antes de que el chat las responda deja al usuario sin la capacidad. Se revisa cuando `bi→chat` esté contratado |
| | «Por cobrar» es Row y no bloque grande con sub-línea «vencidos · Rodríguez, hace 22 días» | **E** el sub-texto necesita **cliente y antigüedad del vencido más viejo**, que `Portada.porCobrar` no trae (sólo `vencido` importe): no se fabrica |
| | agrega 4 gráficos y «Acumulado del año» | **E** son capacidad real de la beta que el prototipo no modela; se conservan |
| `bi-vacio` | texto corto, pierde «el ranking se arma solo» | **R** `PantallaInteligencia.tsx:305` — copy textual del prototipo (mobile **y** web, mismo texto) · test |
| | texto plano bajo rótulo, no un bloque | **E** el rótulo «MEJORES CLIENTES» + texto es el patrón de todas las secciones de esta pantalla; bloque propio para un vacío rompería el ritmo del resto |

## EstadoVacio (2)

| fila | divergencia | veredicto |
|---|---|---|
| `vacio` | título sin punto, cuerpo distinto | **R** `PantallaMiDia.tsx:469-470` — «Nada urgente por hoy.» + «Cuando haya algo que mirar, te lo dejo acá. Si querés saber algo, preguntame.» (mobile y web) · test |
| | «Para hoy» + «Ver tablero ›» fijos arriba; `#prog` sólo en calmo | **E** «Para hoy» ya es la solapa activa (`PantallaMiDia.tsx:93`); el progreso `#prog` necesita el conteo de pendientes de hoy, que el tablero no entrega separado: no se inventa un 0/0 |
| `vacio-visto` | «NO EXISTE el estado veterano en nativo; la constante tiene CERO consumidores» | **C — el mapeo midió mal**: `DIAS_PARA_RETIRAR_EXPLICACION` vive en core `midia/calma.ts` y la consume `mostrarExplicacion` (core), que **sí** llama `EstadoVacio.tsx:64`. El estado veterano existe y está probado (`EstadoVacio.test.tsx:47` «después de N días DISTINTOS la explicación se retira sola»). Ojo: el mapeo contaba consumidores **de la constante en `apps/mobile`**, no el comportamiento |
| | N | **E** el prototipo siembra 5 días (`CALMA_TOPE`) para la demo; la regla del producto es **N = 3** (BL-W5, una sola N web+mobile). No se cambia |

## Ajustes (7)

| fila | divergencia | veredicto |
|---|---|---|
| `apar` | título «Skins» | **R** `PantallaSkins.tsx:158` «Apariencia» |
| | 3 tarjetas iguales vs 2 swatches + fila aparte | **R** `PantallaSkins.tsx:175-191` — Claude/Oscuro lado a lado, `FilaSistema` (`:100`) con «Cambia solo según tu sistema» · tests de `PantallaSkins` intactos (16/16 con Ajustes) |
| | notas explicativas | **R** intro, «Elegí el tema» y `skins-nota` (`:192`) |
| | (propia) muestras de 4 chips vs 2 puntos | **E** `PantallaSkins.tsx:147-150` — el skin se elige viendo el lienzo; el test lo fija como contrato |
| `ajustes` | sin rótulos de grupo | **R** `PantallaAjustes.tsx:127` `GRUPOS_AJUSTES` — Tu negocio / La app / Ayuda · test de orden |
| | subtítulo de pantalla | **R** `PantallaAjustes.tsx:156` |
| | subtítulos por fila («Qué vendés, a quién y tu horario») | **E** la entrada es un tile ícono+etiqueta (decisión de diseño de la pantalla); en 3 columnas no entra una 2ª línea sin recortarla |
| | encabezado «El Galpón · Martín Cairo» | **E** exige nombre comercial (lectura aparte de `perfilNegocio`) y el nombre de la **persona**, que `/me` no trae |
| | «Como hablarle» fusionado / «Mi plan» placeholder | **C** el mapeo quedó viejo: «Mi plan» salió de la beta (DEC-8, `PantallaAjustes.test.tsx` control negativo) y «Cómo hablarle» tiene pantalla propia (`PantallaTono`) |
| `afip` | label «Condición IVA» vs «Condición frente al IVA» | **R** `PantallaAfipSetup.tsx:611` |
| | sin encabezado «ARCA vinculada · CUIT» | **R** `PantallaAfipSetup.tsx:536` — sólo si hay credencial (`conectado`) **y** CUIT · 2 tests (con / sin vínculo) |
| | falta «Necesito cambiarlo ›» (chip «Bloqueado» sí existe) | **E** BL-V27, decisión del operador: «cero control que sugiera cambiar el CUIT vinculado»; el test `afip-perfil-cuit-cambiar` nulo lo fija. Un link que lleva a soporte sigue siendo un control que lo sugiere |
| | sin «Guardado» por campo | **E** un botón Guardar explícito por bloque (edición inline por campo guardaría perfiles a medio completar) |
| | bloques «2. Alta ARCA» y «3. Ambiente» | **E** son las funciones reales de la beta (vincular, homologación/producción) que el prototipo no modela |
| `comousar` | sin chip «Cómo usar la app · tema» ni retorno al tema siguiente (`volver-ayuda`) | **E** en nativo cada tema se **responde en el chat principal** (`preguntar()` → `dejarPendiente` + `router.back()`, `PantallaComoUsarLaApp.tsx:74`), contrato `POST /chat` + polling; el prototipo simula una hoja de respuesta embebida que el producto no tiene |
| | agrega «LO QUE LE PODÉS PEDIR» desde GET /capacidades | **E** capacidad real (la lista sale de las tools vivas, no del copy); se conserva |
| | los 5 temas | **C** `TEMAS_AYUDA` coincide (medido en el mapeo) |
| `cuenta` | falta «Cambiar el mail» | **E** `DIFERIDO_CIERRE_B` (`CambiarCredenciales.tsx`): cambiar mail exige confirmar en la casilla nueva — flujo de GoTrue sin contrato de backend todavía |
| | No molestar sin chip «Pronto», sin rótulo «Avisos», otro copy | **R** `PantallaCuenta.tsx:72,108,122` — rótulo «Avisos», chip «Pronto», «Silenciar los avisos de Odobi» y la nota con el porqué · test. La fila sigue **sin `onPress`** a propósito (muta estado fuera del sandbox) |
| | sin subtítulo «desde marzo de 2021» | **E** el alta no está en `/me`; no se fabrica una fecha |
| | sin nota de cierre | **R** `PantallaCuenta.tsx:184` «Si cerrás sesión, tus datos quedan guardados…» (oculta con el panel de confirmación abierto, test) · el panel de confirmación del nativo es **E**: un toque accidental no puede echar de la sesión |
| | agrega Términos / Privacidad | **E** BL-O6 parte A: mobile no tiene alta, van acá. Más `cuenta-legal-version` (BL-O6 «Informar», `PantallaCuenta.tsx:72`, commit `4a8e9fab`) |
| `hablar` | CampoSelect de chips, orden Formal→Cercano, sin descripciones | **R** `PantallaTono.tsx:21` — Cercano primero + `descripcion` por opción (el `CampoSelect` ya la soportaba) · test |
| | nombre como «¿Cómo querés llamarlo?» | **R** `PantallaTono.tsx:198` «Cómo lo llamás» |
| | falta nota «Esto se guarda aparte…» | **R** `PantallaTono.tsx:174` `tono-nota` + subtítulo `tono-intro` |
| | «Así te respondería» y botones Guardar/Volver que el proto no tiene | **E** el ejemplo viene del backend (misma tabla que arma el prompt: es la prueba de que el tono se aplica) y Guardar es el contrato `guardarPerfilNegocio` parcial |
| `negocio` | rótulos distintos («¿Qué vendés o qué servicio ofrecés?») | **R** `PantallaPerfilNegocio.tsx:361` — «Qué vendés», «A quién le vendés», placeholders «Contá qué hacés» / «Con el que te conocen»; «Cómo te habla» / «Tono y forma» |
| | falta el chip «Te pide confirmación antes de ejecutar» (elemento ausente) | **R** `PantallaPerfilNegocio.tsx:348` `perfil-negocio-estado-modo`, desde `modoCeremonia` (no texto fijo) · test en los dos modos |
| | «A quién le vendés» es select de 3 vs texto libre | **E** el backend lo guarda como enum; texto libre rompe el contrato |
| | sin validación inline de largo mínimo | **E** **MAYOR, se pide a planificación**: el backend no la exige y bloquear Guardar sobre perfiles ya guardados cambia el contrato de guardado. Quedó escrito en `PantallaPerfilNegocio.tsx` junto a los rótulos |
| | Guardar explícito por sección; agrega «Cómo trabaja tu copiloto» y Catálogo | **E** capacidades reales de la beta (modo de ceremonia, catálogo) |

## Apps (1) y Agenda (1)

| fila | divergencia | veredicto |
|---|---|---|
| `apps` | título «Apps» vs «Apps conectadas» | **R** `PantallaApps.tsx:237` (+ test del título) |
| | sin encabezado «4 conectadas de 6» | **R** `PantallaApps.tsx:257` `textoConectadas` · 2 tests (plural/singular) |
| | sin grupos «Para pedirle por chat» / «Trabaja sola, de fondo» (Drive) | **R** `PantallaApps.tsx:116` `gruposDe` — no pinta el rótulo de un grupo vacío (control) |
| | agrega Desconectar + confirmación y «Reconectar» | **E** K-09: una conexión caída se dice, no se disfraza de «nunca»; desconectar nombra lo que se pierde |
| `agenda` | «ninguna medida aún» | **Medida**: ruta alcanzable `PantallaPrincipal.tsx:186` → `app/agenda.tsx` → `PantallaAgenda` · subtítulo `agenda-intro` y estado `agenda-estado` (`PantallaAgenda.tsx:104-110`), «Nuevo evento» (`:118`) · mobile **y** web, mismos testid, test |
| | rejilla horaria con bloques «Libre · 2 h 30», «Cobrar a Rodríguez · desde el tablero» | **E** `PantallaAgenda.tsx:99-103`: el cuerpo es una lista de sólo lectura por día (BL-J13, ADR-004); la rejilla exige duración y solapamiento que `leerAgenda` no trae, y mezclar «lo que vence» exige el tablero en el mismo contrato. Sin Calendar conectado el cuerpo no es comparable (nunca se dice «no tenés eventos») |

## Pendiente de DECISIÓN (no es mío)

1. **Validación de largo mínimo en Mi negocio** — cambia el contrato de guardado (ver `negocio`).
2. **`bi` Preguntar→chat** — retirar la pestaña depende de que el chat conteste preguntas de negocio.

## Gate

`testid_paridad.py --check`: **OK**, 0 sin cubrir, 0 obsoletas. Los 2 ids nuevos de `agenda` llegaron
al par web **sin excepción** (la web tiene el gemelo y se alineó); el resto lleva excepción con motivo
y fecha porque la web no tiene esa pantalla o la estructura es otra.
