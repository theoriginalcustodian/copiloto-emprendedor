# Veredictos DEVICE2 — re-medición en el teléfono tras TRIAJE15 (frontend-2)

**Fecha:** 2026-10-13 · **Contrato:** `contrato_planificacion-a-frontend1-y-frontend2_TRIAJE15-se-parte-por-CAPA` ·
**Medición de origen (antes):** [`2026-10-13-veredictos-device15-15-filas.md`](2026-10-13-veredictos-device15-15-filas.md) (`2610bb6b`) ·
**Veredictos de código (los que esta medición acredita o refuta):**
[`…triaje15-capa-cascara-fe2.md`](2026-10-13-veredictos-triaje15-capa-cascara-fe2.md) y
[`…triaje15-bloqueado-grabando-ingresos-chat-frontend1.md`](2026-10-13-veredicto-triaje15-bloqueado-grabando-ingresos-chat-frontend1.md) ·
**Sesión:** frontend2 (dueña única de `RF8T318RN9T`)

## Qué se midió y sobre qué

| dato | valor |
|---|---|
| **SHA que servía Metro** | **`40e2fe62`** (`origin/main` al momento de medir: #1093 + #1101 + #1095/#1096 de voz), árbol detached en el worktree `wt-fe2-mapeo`, `--clear` |
| Binario | el dev-client ya instalado; no se compiló nada |
| Usuario | `e2e-device@copiloto.test` (el canónico) |
| Gestos | `adb shell input motionevent DOWN/MOVE/UP` (nunca `input tap`) |
| Lectura | `uiautomator dump` **con animaciones del sistema en 0** (con animación el dump devuelve «could not get idle state» y 0 nodos) + `screencap` |
| Capturas | locales, no versionadas (repo público, tenant de prueba) |

⚠️ **Vocabulario y regla** (decisión de planificación, 2026-10-13): el brazo device **no tiene clase ENMIENDA**.
Una fila con una enmienda citada lleva `DESVÍO` en la dimensión afectada y **no** se declara `COHERENTE`: la
enmienda la acredita el brazo de código; acá se mide qué ve el teléfono. `DESVÍO` no miente. La lista de las
enmiendas con su cita está en la sección «Enmiendas» de abajo.

## Resumen

| # | fila | CONT | COMP | nota |
|---|---|---|---|---|
| 1 | `(home)` | DESVÍO | COHERENTE | grip «Bajá para tus funciones» medido; falta «Ver tablero ›» (enmienda); agenda «Ahora» `NO_REPRODUCIBLE_SIN_EFECTO` |
| 2 | `bi-refresh` | COHERENTE | DESVÍO | sin línea permanente; «Actualizando…» sólo tras el UP; «Al día · recién» ≤ 1 muestra; control nativo sin fase «Soltá» (enmienda) |
| 3 | `bloqueado` | COHERENTE | DESVÍO | tacho · onda · reloj · pausa · enviar; pista de candado visible al arrastrar; 130 px no fija y envía (enmienda H7) |
| 4 | `chat` | DESVÍO | `NO_MEDIBLE` | grip «Escribile a Odobi» / «Bajá para volver a Mi día» (enmienda); isotipo de 96 px no medible con conversación poblada |
| 5 | `consent` | `NO_REPRODUCIBLE_SIN_EFECTO` | `NO_REPRODUCIBLE_SIN_EFECTO` | el sheet no se alcanza sin un efecto externo (sin cambio) |
| 6 | `detalle` | DESVÍO | DESVÍO | kv «Cliente» medido; **Monto/Fecha no llegan** (H12); sin chip de antigüedad ni píldora de acción (⛓ backend) |
| 7 | `entrada` | COHERENTE | `NO_MEDIBLE` | fondo blanco medido; la animación no se resuelve con screencap |
| 8 | `esc` | `FUERA-DE-REFERENCIA` | COHERENTE | sin cambio: TRIAJE15 (A), medido el mismo día en el doc de origen |
| 9 | `feedback` | COHERENTE | COHERENTE | título, bajada, «Mandar», mes en «Lo pediste vos», derivación a Soporte después |
| 10 | `grabando` | COHERENTE | COHERENTE | reloj «● 0:02» + «Deslizá para cancelar» antes de armar; la barra de grabación ocupa el lugar del composer |
| 11 | `ingresos` | DESVÍO | COHERENTE | período «Octubre» y «Últimos» medidos; buscador y falta de nota MP son enmiendas |
| 12 | `reveal` | DESVÍO | COHERENTE | wordmark 46 dp, tagline y sin forma residual medidos; «Crear una nueva cuenta» es enmienda (decisión #3 del 2026-08-04) y el altavoz espera el asset de audio. ✅ **Ninguna de las dos bloquea el DoD de la fila**, que pide «al menos UN consumidor real fuera de su archivo y de sus tests, y que se VEA en pantalla» (padrón `2026-10-12-contratos-del-mapeo.md:51`): consumidor en `EntradaSesion.tsx:6,32` y visto en device el 15-10. Cerrada el 15-10 |
| 13 | `soporte` | DESVÍO | DESVÍO | «sin plazo fijo» (enmienda fundada: no hay SLA vigente, acta beta-odobi `BL-O7`). ⚠️ **«sin tickets anteriores ni adjuntos» quedó REFUTADO el 15-10 y la dependencia de backend NO existe:** el código ya estaba (#1115 `e3d1efa3`) y **se ve en device** — «Ver tickets anteriores (4) ›» desplegando SOP-0004/SOP-0003, más el clip de adjuntos (`PantallaSoporte.tsx:152-165`); la medición previa lo daba por ausente porque el tenant canónico no tenía tickets entonces, que es error de método y no de código. El pendiente REAL de esta fila es la entrada por hold-to-record, que espera la decisión A/B/C del operador sobre el dictado. Detalle en `2026-10-13-veredictos-triaje15-capa-cascara-fe2.md:59-62` |
| 14 | `splash` | COHERENTE | `NO_MEDIBLE` | tagline y gradientes medidos; el rebote letra por letra no se resuelve con screencap |
| 15 | `tablero` | DESVÍO | COHERENTE | scroll único medido; «Mi día» vs «Tu día» (enmienda); destino de «Reconectar» **pendiente de backend desplegado** |

**Cuadratura:** 15 filas / 15 con veredicto del vocabulario cerrado / 0 `PENDIENTE_DEVICE` / 0 `INCOMPLETO`.
Por fila (CONT + COMP sin `DESVÍO`): `COHERENTE` 5 (`entrada`, `esc`, `feedback`, `grabando`, `splash`) ·
`DESVÍO` 9 · `NO_REPRODUCIBLE_SIN_EFECTO` 1 (`consent`). Antes de TRIAJE15: `COHERENTE` 1 (`esc`).

**Lo que esto NO dice:** que las 9 filas en `DESVÍO` estén mal hechas. En `(home)`, `bi-refresh`, `bloqueado`,
`chat` e `ingresos` lo único que queda de `DESVÍO` es una enmienda que el brazo de código ya acreditó (el teléfono
confirma que el nativo hace lo que la enmienda dice); en `reveal`, `soporte`, `tablero` y `detalle` además hay una
dependencia ⛓ o una medición pendiente de backend.

---

## Fila por fila (sólo lo medido hoy; el gesto de cada fila va entre paréntesis)

### 1. `(home)` — Mi día en reposo
*(arranque en `home`, `dump` + `snap t13-home-reposo`)* Grip superior «Bajá para tus funciones» (`panel-funciones-pestana`,
[239,37][481,68]); inferior «Escribile a Odobi». Encabezado «Odobi» + fecha, portada «En caja», contador y solapas. **Falta**
«Ver tablero ›» → enmienda (E1). La agenda «Ahora» exige Google Calendar conectado (hoy: «Se cayó la conexión con Google
Calendar») → `NO_REPRODUCIBLE_SIN_EFECTO`.

### 2. `bi-refresh` — Inteligencia, tirar para actualizar
*(`refresh2.py`: DOWN, 15 MOVE, sostener 1,5 s, UP, muestreo de la franja del texto, 22 muestras / 0,66 s)* Reposo sin
ninguna línea («Tirá para actualizar» ya no es permanente); durante el gesto **no** aparece «Soltá para actualizar» (el
control es el `RefreshControl` de RNGH, E2); «Actualizando…» aparece **después** del UP (t=5,2 s contra UP en 4,8 s: el
refresh ya no se dispara antes); «Al día · recién» se ve en **una** muestra (≤ 0,66 s, compatible con
`MS_AL_DIA = 700`; con los 3000 ms de antes habría ~4); vuelve al reposo.

### 3. `bloqueado` — grabación fijada
*(`DOWN` en `boton-voz` (363,1348) → sostener 1,2 s → 6 `MOVE` arriba (120 px) → snap → 7 `MOVE` más (260 px en total) → `UP`)*
A 120 px: cápsula de candado con caret ↑ resaltada y «Deslizá para cancelar» + reloj. Fijada: tacho · onda · `0:06` ·
pausa · enviar en **una** barra con el lugar del composer, «Pausar/Enviar» ya no se parten. Descartada con el tacho: no
se envió nada (la lista de mensajes quedó igual). El 130 px sin fijar **envía**: es el diseño (E3).

### 4. `chat` — panel de chat
*(`DOWN` en el asidero → arrastre arriba)* Grip en reposo «Escribile a Odobi» y, abierto, «Bajá para volver a Mi día»
(E4). El **isotipo de 96 px del vacío no se puede medir**: el usuario canónico tiene una conversación poblada y el
estado vacío no se muestra; queda cubierto por los tests de `ListaMensajes` (`<Marca size={96} tono="desnudo" />`).

### 6. `detalle` — tarjeta expandida
*(tocar la tarjeta 110 «CAE por vencer» y la 106 «factura impaga»)* La 110 trae sólo «Revisarla»; la 106 trae
«Reclamar el pago» + kv **«Cliente · Cliente Seed Mi Dia»**. **No aparecen «Monto» ni «Fecha»** (H12).

### 9. `feedback`
*(`deep ajustes-feedback`, scroll al final)* «Contanos qué tal», bajada, «¿Qué le cambiarías?», «Mandar»; en «Lo pediste
vos» cada entrada trae «Enviado · Septiembre/Agosto» (mes, no estado); la derivación a Soporte («Ir a Soporte técnico»)
va **después** de «Lo pediste vos».

### 10. `grabando`
*(`DOWN` en `boton-voz`, 2,6 s quieto; 8 `MOVE` a la izquierda; `UP`)* En reposo del gesto ya se ve **«● 0:02»** y
**«‹ Deslizá para cancelar»** y la barra de grabación reemplaza al composer; soltar a la izquierda descarta sin enviar.

### 11. `ingresos`
*(`deep copiloto://ingresos` + 2 scrolls)* Título «Ingresos» con **«Octubre»** al lado; «BUSCAR» + buscador y **«ÚLTIMOS»**
sobre la lista. Sin nota de MercadoPago (enmienda E5: COBROMP ya entra solo).

### 13. `soporte`
*(`deep ajustes-soporte`)* «Los tickets los responde una persona del equipo; todavía no tenemos un plazo de respuesta
fijo». Sin «Ver tickets anteriores» ni clip de adjuntos. El composer de la pantalla muestra el rodillo genérico de
voz («Gasté 15 lucas en nafta») dentro de Soporte (observación O1).

### 15. `tablero` — Mi día
*(`deep midia`, drag 960→360, `dump` con animaciones en 0)* **Un solo `ScrollView`** (`midia-scroll`): al scrollear, la
lista pasa a ocupar [0,229][720,1465] (≈ 1236 px) y `midia-nota` queda a la vista en [30,1337]; antes, ≈ 89 px de lista
con un aviso crítico. La píldora «Reconectar» lleva a Ajustes porque la tarjeta **no trae `destino`**: el backend con
H5b (#1092) no está desplegado (**el deploy fue denegado por el clasificador; es del operador**). Medición
pendiente con disparador nombrado: backend desplegado + una `conexion_caida` ya abierta (no recién creada).

---

## Enmiendas — lista con cita (para planificación)

| id | fila | enmienda | cita |
|---|---|---|---|
| E1 | `(home)` | sin «Ver tablero ›»: las solapas con su contador ya SON el tablero | `PantallaMiDia.tsx:101-103` |
| E2 | `bi-refresh` | `RefreshControl` de RNGH; el sistema no expone la fase «Soltá» | `PantallaInteligencia.tsx:7,196` |
| E3 | `bloqueado` | soltar sin llegar al umbral de 80 dp envía (H7) | `2026-10-12-mapeo-prototipo-vs-nativo.md`, fila `bloqueado` («ACLARADO 2026-10-13») |
| E4 | `chat` | grip «Escribile a Odobi» en reposo (la conversación arranca abajo asomando) | `PantallaPrincipal.tsx:178`, `PanelDeslizable.tsx:156-177` (Ola 4, 2026-09-18) |
| E5 | `ingresos` | buscador «Buscar un ingreso» (I2b) y sin nota de MercadoPago (I3, COBROMP) | `2026-10-13-veredicto-triaje15-bloqueado-grabando-ingresos-chat-frontend1.md`, filas I2b/I3 |
| E6 | `reveal` | sin «Crear una nueva cuenta»: en `primeraVez` la acción única es «Empecemos» | `EntradaSesion.tsx:17-21` (decisión #3, 2026-08-04) |
| E7 | `soporte` | «sin plazo fijo» en vez de «Antes de 4 h hábiles» | `packages/core/src/ayuda/textosSoporte.ts:3-10` (acta beta-odobi, BL-O7) |
| E8 | `tablero` | «Mi día», no «Tu día» | `CONTEXT.md:213`, `PantallaMiDia.tsx:567` |

---

## Hallazgos nuevos

| id | hallazgo | dueño | siguiente paso |
|---|---|---|---|
| **H12** | La costura de `detalle` **leía un campo que nadie escribe**: el core lee `datos.monto` y `datos.fecha` (`packages/core/src/api/miDia.ts:141-142`), pero el backend emite `total` (presupuesto, `mi_dia_detector.py:149`), `saldo` (factura impaga, `:165`) y `cae_vto` (`:248`); `monto` y `fecha` no los escribe ninguna regla. Las filas kv «Monto/Fecha» que cerré en código son inalcanzables | backend (contrato `PROTO4DEPS`, bloque `presentacion` por regla) | `pedido_` a planificación; la app **no** arma una tabla regla→campo |
| O1 | El composer de Soporte muestra el ejemplo de gasto («Gasté 15 lucas en nafta») | frontend1 (voz/composer) | `dato_` |
| O2 | Con animaciones del sistema activas `uiautomator dump` no consigue idle en Mi día y en el chat: medir con `anim 0` | frontend2 | ya aplicado |

## Lo que sigue pendiente

- `tablero` — destino de «Reconectar»: disparador = deploy del backend con #1092 + una `conexion_caida` ya abierta.
- `detalle` — Monto/Fecha: disparador = H12 resuelto en backend.
- `chat` — isotipo del vacío: requiere un tenant sin conversación (no el canónico).
