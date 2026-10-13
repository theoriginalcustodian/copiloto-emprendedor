# Veredicto TRIAJE15 — las filas `bloqueado`, `grabando` e `ingresos`, divergencia por divergencia (frontend-1)

**Fecha:** 2026-10-13 · **Contrato:** `2026-10-13_contrato_planificacion-a-frontend1-y-frontend2_TRIAJE15-se-parte-por-CAPA-las-3-filas-del-composer-son-codigo-de-frontend1-y-el-device-sigue-con-duena-unica` ·
**Mapeo de origen:** [`2026-10-12-mapeo-prototipo-vs-nativo.md`](2026-10-12-mapeo-prototipo-vs-nativo.md) (filas `bloqueado` l.54, `grabando` l.76, `ingresos` l.81) ·
**Medición de device de origen:** [`2026-10-13-veredictos-device15-15-filas.md`](2026-10-13-veredictos-device15-15-filas.md) (filas 3, 10 y 11; hallazgos H6, H7, H10) ·
**Rama:** `frontend1/triaje15-composer-voz`

> Documento hermano de [`2026-10-13-veredicto-onb-cumplida-chat-frontend1.md`](2026-10-13-veredicto-onb-cumplida-chat-frontend1.md):
> mismos estados, mismo criterio. El nombre lleva `chat` porque el medidor asigna cada doc a un brazo
> por el nombre (`medir-mapeo-implementacion.py`, `corpus()`).

## Cómo leer esto

| estado | qué significa |
|---|---|
| ✅ **CERRADA-EN-CODIGO** | la divergencia quedó resuelta: existe en el código con `path:línea` y un test que la ejercita |
| 📝 **ENMIENDA-FUNDADA** | la divergencia se **mantiene a propósito**, con el motivo y la autoridad escritos. Reabrible por el operador |

**Nivel de verificación de TODO lo de abajo:** jest (RNTL) + vitest + `tsc` + `testid_paridad.py` + eslint,
y cada comportamiento nuevo con su mutante (rojo→verde, ver §Mutantes). **Nada fue visto en un teléfono.**
El gesto real (`GestureDetector`) está mockeado a passthrough en jest (`jest.setup.js`): los tests invocan
los handlers del `Gesture.Pan` capturado, no un dedo. Lo que sólo se vería en device queda anotado como
*«[sin ver en device]»*, y **la acreditación en device la hace frontend-2**, dueña del aparato.

## Resumen

| fila | # | divergencia (medida en device, DEVICE15) | veredicto | cómo |
|---|---|---|---|---|
| `bloqueado` | B1 | en diagonal el candado gana siempre (sin eje dominante) | ✅ | gana el eje que domina |
| `bloqueado` | B2 | sin pista de candado ni «deslizá para cancelar» antes de soltar | ✅ | `PistasGestoVoz` + aviso «cerca» |
| `bloqueado` | B3 | «en pausa» sólo se distingue porque la onda deja de moverse | ✅ | `EstadoEnPausa`: texto «En pausa» |
| `bloqueado` | B4 | «Pausar/Enviar» partidos en dos líneas | ✅ | ya en `main` (H6): `alignSelf:'stretch'` |
| `bloqueado` | B5 | botones de texto «Pausar/Enviar/Eliminar» vs tacho + mic-como-enviar | 📝 | spec del operador 23/07, controles de texto |
| `bloqueado` | B6 | 130 px (69 dp) no fija: al soltar, envía | 📝 | H7: es el diseño (umbral 80 dp) |
| `grabando` | G1 | falta «deslizá para cancelar» antes de armar la cancelación | ✅ | mismas pistas que B2 |
| `grabando` | G2 | falta el reloj `0:07` | 📝 | spec del operador 23/07: «Sin contador» — **contrapunto abierto** |
| `grabando` | G3 | el prototipo transforma la barra del composer; el nativo es overlay | 📝 | spec del operador 23/07: waves flotantes, sin glass — **contrapunto abierto** |
| `ingresos` | I1 | sin período junto al título («Agosto») | ✅ | `MarcoGlass.etiqueta` + `formatearMesDePeriodo` |
| `ingresos` | I2a | rótulo «Últimos» reemplazado por «BUSCAR» | ✅ | `BuscadorActividad.rotuloLista` |
| `ingresos` | I2b | buscador «Buscar un ingreso» que el prototipo no tiene | 📝 | decisión C de planificación (22/07) — **autoridad a confirmar** |
| `ingresos` | I3 | sin la nota «Los cobros por MercadoPago todavía no entran solos…» | 📝 | COBROMP: ahora entra solo; el cartel sería falso |

**Cuenta honesta:** 13 divergencias, **13 con veredicto** (7 en código, 6 enmiendas). Que cumplan el DoD
no quiere decir que se hayan visto en un teléfono: ver §Lo que NO está verificado. Tres de las seis
enmiendas (G2, G3, I2b) dejan una **decisión abierta** que no es mía cerrar: ver §Contrapunto.

> Esta tabla es el veredicto de **estas tres filas**. No es una cifra de avance del sprint: la cifra
> vigente la mide `medir-mapeo-implementacion.py` y se cita siempre con su línea `ARBOL MEDIDO` y su SHA.

---

## Fila por fila

### 1 · `bloqueado` — ✅ + 📝

#### B1 · en diagonal el candado ganaba siempre — ✅ CERRADA-EN-CODIGO

**Qué había.** `BotonVoz` evaluaba los dos ejes por separado: si `arriba > UMBRAL_FIJAR_PX` fijaba, sin
mirar cuánto se había movido a la izquierda. Un gesto en diagonal que para el usuario era «cancelar»
terminaba fijando la grabación (DEVICE15 `diag-*`: *«el candado gana, no hay eje dominante»*).

**Qué hay ahora.** El prototipo lo decide por eje dominante: *«gana el que domina el movimiento; un
gesto en diagonal no puede disparar cancelar y bloquear a la vez»*
(`mockups/03-home-conversacional/DECISIONES.md:112`).

| qué | código | test |
|---|---|---|
| eje dominante `-dy > \|dx\|`: arriba domina → puede fijar y se des-arma la cancelación; si domina la izquierda, sólo cancela | `modules/chat/BotonVoz.tsx:232-241` (`mover`), `:318` (`onUpdate` → `scheduleOnRN(mover, …)`) | `BotonVoz.test.tsx:252-297` «los dos ejes»: diagonal izquierda → cancela y NO fija; diagonal arriba → fija y NO arma cancelación; cancelación armada que pasa a dominar arriba se des-arma ANTES de soltar |
| umbral de cancelar 80 → **70**, el del prototipo (`UMBRAL_CANCEL = 70`, `index.html:2844`); el de fijar queda en 80 (`UMBRAL_LOCK = 80`) | `BotonVoz.tsx:42` | los tests importan la constante, no el literal |

*[sin ver en device]* — el «se siente» del eje dominante y de 70 vs 80 px sólo lo da el dedo.

#### B2 · sin pista de candado ni «deslizá para cancelar» — ✅ CERRADA-EN-CODIGO

**Qué había.** El usuario tenía que *adivinar* que hacia arriba se fija y a la izquierda se cancela. El
texto «Soltá para cancelar» sólo aparecía **después** de armar la cancelación.

**Qué hay ahora.** Las dos pistas del prototipo (`rec-hint` + `lock-col`, `index.html:2939-2950`), y el
candado se tiñe al estar «cerca» de fijar (`index.html:3001`, `-dy > UMBRAL_LOCK * 0.6`):

| qué | código | test |
|---|---|---|
| `PistasGestoVoz`: «‹ Deslizá para cancelar» + candado con flecha; al armar la cancelación las reemplaza el aviso «Soltá para cancelar» | `modules/chat/PistasVoz.tsx:40-` (`voz-pistas`, `voz-pista-cancelar`, `voz-pista-candado`) | `PistasVoz.test.tsx:13-52` |
| aviso «cerca»: `onCerca(true)` al pasar `UMBRAL_FIJAR_PX × 0.6` sin fijar; se apaga al volver, al fijar y al soltar | `BotonVoz.tsx:47` (`FRACCION_CERCA_DE_FIJAR`), `:69` (prop), `:238` | `BotonVoz.test.tsx:299-338` |
| cableado en el chat | `modules/chat/ChatView.tsx:106` (estado), `:265` (pistas), `:272` (`onCerca`) | `ChatView.test.tsx:364-387` |
| el mismo composer en contexto de formulario (gastos/ingresos/clientes/presupuestos) | `modules/voz/MicFuncion.tsx:120` (`pistasVisibles`), `:131`, `:138` | `MicFuncion.test.tsx:182-196` |

Además es la alternativa que exige WCAG 2.5.1 para un gesto que obliga a sostener presión
(`DECISIONES.md:110`): una alternativa que nadie sabe que existe no cumple el criterio. *[sin ver en device]*

#### B3 · «en pausa» sólo se distinguía porque la onda dejaba de moverse — ✅ CERRADA-EN-CODIGO

**Qué había.** Fijado y en pausa, el estado se leía por ausencia de movimiento: sin texto. Un estado que
depende sólo de que algo deje de moverse no pasa WCAG 1.4.1.

**Qué hay ahora.** `EstadoEnPausa`: «En pausa» en texto, región viva (`role="status"`), en el lugar de la
onda. La onda se apaga en pausa (`ondaVisible = voz.fase === 'grabando'`).

| código | test |
|---|---|
| `PistasVoz.tsx:80-` (`voz-en-pausa`); `ChatView.tsx:219-220` (`ondaVisible`/`enPausa`), `:289`; `MicFuncion.tsx:119`, `:152` | `PistasVoz.test.tsx:53-`; `ChatView.test.tsx:388-408` (en pausa: texto + sin onda; al reanudar vuelve la onda); `MicFuncion.test.tsx:197-` |

*[sin ver en device]*

#### B4 · «Pausar/Enviar» partidos en dos líneas — ✅ CERRADA-EN-CODIGO (ya en `main`, no es de este PR)

DEVICE15 lo midió y lo bajó como **H6**; la corrección ya está en `main`:
`modules/chat/ControlesFlotantes.tsx:47-54` (`alignSelf:'stretch'` en `contenedor` y `fila`, con el porqué
en el comentario). Se lista acá para que la fila `bloqueado` no quede con un defecto «sin dueño» a la
vista; **no lo toco en este PR.**

#### B5 · controles de texto «Pausar/Enviar/Eliminar» vs tacho + mic-como-enviar — 📝 ENMIENDA-FUNDADA

**Qué es hoy.** Fijado, los controles son tres botones **de texto**: Pausar/Reanudar · Enviar · Eliminar
(`ControlesFlotantes.tsx`). El prototipo dibuja un tacho, un punto y el mic como «enviar»
(`index.html:2924`).

**Por qué se mantiene — autoridad.** El contrato del 2026-07-23
(`coordinacion/cerrado/2026-08-03/2026-07-23_contrato_planificacion-a-frontend_dictado-por-voz-sin-glass-hold-graba-soltar-envia-deslizar-fija.md`,
**no versionado**: se cita acá la letra) es una *«Decisión MAYOR de UX tomada por el operador, con spec
confirmado punto por punto»* (l.4) y su §1 fija que al fijar *«aparecen los controles flotantes (no glass):
**Pausar/Reanudar · Enviar · Eliminar**»* (l.38). Cambiarlos por íconos no es un detalle de la fila:
revierte una decisión del operador. **Reabrible por él**, ver §Contrapunto.

#### B6 · 130 px (69 dp) no fija, al soltar envía — 📝 ENMIENDA-FUNDADA

DEVICE15 lo midió y lo bajó como **H7 → enmienda** (`2026-10-13-veredictos-device15-15-filas.md`, tabla de
hallazgos y «TRIAJE15 (A)»): 130 px en ese aparato son 69 dp, **por debajo** del umbral de 80 dp del
contrato (`UMBRAL_FIJAR_PX = 80`; l.38 del contrato 23/07: «> umbral, ~80px»). Que no fije es el diseño, no
un defecto; el comportamiento correcto al soltar sin fijar es enviar (§1 del contrato). Se mantiene.

### 2 · `grabando` — ✅ + 📝

#### G1 · falta «deslizá para cancelar» antes de armar la cancelación — ✅ CERRADA-EN-CODIGO

Es la misma pista de B2: grabando sin fijar, `PistasGestoVoz` muestra «‹ Deslizá para cancelar» desde el
primer instante y el aviso «Soltá para cancelar» la **reemplaza** al armar (no se apilan).
Código y tests: ver B2 (`ChatView.test.tsx:364` «al armar la cancelación el aviso REEMPLAZA a las pistas»).
*[sin ver en device]*

#### G2 · falta el reloj `0:07` — 📝 ENMIENDA-FUNDADA (**contrapunto abierto**)

**Qué es hoy.** Grabando no hay contador. Es **a propósito y está especificado**: el contrato 23/07 §1
dice *«**Sin glass. Sin contador.** El único feedback es la onda flotante»* (l.31), §3 manda *eliminar* el
cronómetro del HUD (l.129) y el DoD §4 lo verifica: *«Waves flotantes … sin contador»* (l.149). Quien
tomó la decisión fue el operador, después de probar el botón en device.

**Por qué no lo implementé aunque el prototipo lo dibuje.** El prototipo del 24/08 sí tiene reloj; pero
ese reloj **no está argumentado** en `DECISIONES.md` (ver §Contrapunto), y agregarlo es **revertir una
línea explícita de una decisión MAYOR del operador** con un dibujo de mockup. No es una divergencia que
una fila de mapeo pueda cerrar por su cuenta.

**Costo si el operador dice «sí, reloj»:** bajo. `useCronometroGrabacion` (`useCronometro.ts`) sigue
existiendo con **0 consumidores** y el estado `fase` ya está en `ChatView`. Es un cambio de un PR.

#### G3 · el prototipo transforma la barra del composer; el nativo es un overlay — 📝 ENMIENDA-FUNDADA (**contrapunto abierto**)

**Qué es hoy.** Durante la grabación el nativo muestra un **overlay flotante** (onda + pistas) sobre el
chat; el prototipo transforma la propia barra (punto rec + reloj + `lock-col`).

**Por qué se mantiene.** Mismo contrato, §3 (l.136-137): *«cómo se muestra (waves flotantes + controles flotantes, no glass)»* y
*«`Onda` — las waves, ahora **flotantes** sobre el chat (único feedback visual)»*. Además, la mitad de esto **sí** se
cerró: el gesto y las pistas son los del prototipo (B1-B3).

**Lo que esta enmienda NO cubre — dicho sin maquillaje.** La respuesta del operador del 2026-10-12
(«Composer vs `MicFuncion`», mapeo l.118-129) confirma que **`MicFuncion` es el mismo composer
reutilizado** y que las 5 filas «se implementan como están». **No** dice que la barra no se transforme:
no la cito como autoridad para G3. La autoridad es el spec del 23/07.

### 3 · `ingresos` — ✅ + 📝

#### I1 · sin período junto al título — ✅ CERRADA-EN-CODIGO

**Qué había.** El prototipo pone el período al lado del título (`<span class="per">Agosto</span>`,
`index.html:2248`); el nativo no lo mostraba aunque el dato **ya viaja** (`resumen.periodo`, `"YYYY-MM"`,
`packages/core/src/api/ingresos.ts:304`).

| qué | código | test |
|---|---|---|
| `formatearMesDePeriodo("2026-08") → "Agosto"`; vacío si no es fecha/período | `packages/core/src/dinero/formatoDinero.ts:153,164` | `formatoDinero.test.ts` «formatearMesDePeriodo…» (2 casos) |
| `MarcoGlass.etiqueta`: texto tenue junto al título, dentro de la zona de arrastre, no interactivo; ausente = no se dibuja | `theme/glass/MarcoGlass.tsx:105,109,282` | `MarcoGlass.test.tsx` «etiqueta junto al título» (con / sin / vacía) |
| `PantallaIngresos` la pasa **sólo si hay resumen** (no se inventa un mes con la fecha del teléfono) | `modules/ingresos/PantallaIngresos.tsx:145` | `PantallaIngresos.test.tsx` «período junto al título…» (con período / sin resumen) |

**Por qué un helper nuevo y no `formatearFechaCorta`:** sobre un período sin día da `"1 ago"`
(`formatoDinero.test.ts` ya lo fija), que inventa un día que nadie eligió. Ver §Declarado.

#### I2a · el rótulo «Últimos» — ✅ CERRADA-EN-CODIGO

El prototipo rotula la lista «Últimos» (`.lista-lbl`, `index.html:2255`); el nativo sólo mostraba el
«BUSCAR» del campo. Ahora `BuscadorActividad` acepta `rotuloLista` y lo dibuja **sólo sin query** (con
query la lista rica no se muestra y el rótulo describiría otra cosa).

| código | test |
|---|---|
| `modules/actividad/BuscadorActividad.tsx:49,62,118`; `PantallaIngresos.tsx:241` | `BuscadorActividad.test.tsx` «rótulo de la lista rica» (sin prop / con prop / con query desaparece); `PantallaIngresos.test.tsx` «la lista lleva el rótulo «Últimos»» |

La prop es opcional: Gastos, Presupuestos, Facturación y Recientes no cambian.

#### I2b · el buscador «Buscar un ingreso» — 📝 ENMIENDA-FUNDADA (**autoridad a confirmar**)

**Qué es hoy.** Un campo «BUSCAR» sobre la lista. **El prototipo no tiene buscador** en ninguna función
(0 hits de «Buscar»/«buscador» en `index.html`).

**Por qué se mantiene.** Es la *decisión C de planificación* del 2026-07-22
(commit `cca1e5ff`: *«la lista RICA de cada glass NO se toca … el buscador es una sección aparte»*),
implementada igual en Gastos/Presupuestos/Facturación/Ingresos/Recientes; el backend lo sirve
(`/actividad?funcion=&q=`). Quitarlo de Ingresos solo lo haría asimétrico con las otras cuatro funciones.

**Lo que esta enmienda NO tiene — dicho sin maquillaje.** La autoridad es una decisión **de planificación**
citada en un commit y en el docstring de `BuscadorActividad.tsx`; **no encontré el acta del operador** que
la firme. El DoD pide «acta, decisión del operador o spec»: lo dejo declarado para que planificación
confirme si alcanza o si el buscador necesita su acta. Hasta entonces la fila lo cuenta como enmienda
**con esta salvedad escrita**, no como cerrada.

#### I3 · sin la nota de MercadoPago — 📝 ENMIENDA-FUNDADA

**Qué es hoy.** No hay nota. **No es un olvido:** se retiró a propósito.

**Autoridad (código + commit + test, no «se ve mejor»).**
1. **El propio prototipo la condiciona:** *«MercadoPago todavía NO entra solo: eso es una advertencia del
   repo, no un detalle»* (`index.html:929-930`). La nota era verdadera mientras eso fuera cierto.
2. **Dejó de serlo.** `9e4a70dc` — *«feat(cobros): pago MercadoPago aprobado se vuelve Ingreso (COBROMP)»*,
   2026-10-06: el webhook registra el ingreso con `idem_key = 'mp:<payment id>'` y *«se retiran los dos
   carteles "los cobros por MercadoPago todavía no entran solos" (web y móvil)»*. El lector ya distingue
   `origen: 'mercadopago'` (`PantallaIngresos.tsx:53-58`, «por MercadoPago»).
3. **Test que lo fija:** `PantallaIngresos.test.tsx:159` «ya no hay cartel … el cobro entra solo».

Mostrarla hoy afirmaría algo **falso** al emprendedor. De paso corrijo el docstring de
`ResumenIngresos.tsx`, que seguía diciendo que el aviso «va con el resumen, palabra por palabra» — un
comentario que declaraba un estado que el commit COBROMP ya había retirado.

**Lo que NO verifiqué:** que el webhook de MercadoPago esté efectivamente recibiendo en el entorno vivo.
Lo que cito es el contrato del código y los tests de backend de ese commit (Postgres efímero).

---

## Contrapunto — la decisión que NO me corresponde cerrar

Hay **dos artefactos con peso de operador que no coinciden** sobre el composer de voz:

| artefacto | fecha | qué dice | argumentado |
|---|---|---|---|
| contrato `dictado-por-voz-sin-glass` | 2026-07-23 | *«Decisión MAYOR de UX tomada por el operador»*: **sin contador**, controles flotantes **de texto**, onda flotante, sin glass | sí: nace de que el operador probó el botón y «no funciona» (l.5) |
| prototipo ODOBI (`index.html`) | 2026-08-24 | composer que se transforma en la barra, **reloj**, íconos (tacho / mic-como-enviar) | **no**: figura como decisión de carril «de Martin y David» y `DECISIONES.md:85-113` no argumenta el reloj ni los íconos |

El denominador del sprint es «dejar la app tal cual define `index.html`», así que por esa regla G2, G3 y
B5 serían divergencias a cerrar. Por la otra, el contrato 23/07 las manda mantener. **El prototipo es
posterior pero no refuta la decisión anterior con un argumento**, y revertir una decisión MAYOR del
operador no es una táctica de implementación.

**Mi recomendación:** mantener el spec del 23/07 (las 3 enmiendas de arriba) hasta que el operador diga
expresamente «reloj / íconos / barra transformada». Si dice que sí, B5/G2/G3 pasan de 📝 a trabajo de
código y el costo es bajo (ver G2). **Es una decisión, no un hallazgo de esta fila** — se la llevo a
planificación como `pedido_` no bloqueante.

## Lo que NO está verificado

- **Nada en device.** Los umbrales (70/80 px, «cerca» a 0,6×) y el eje dominante vienen del prototipo y se
  ejercitan con los handlers del `Gesture.Pan`, no con un dedo. frontend-2 re-mide en el aparato.
- **El contraste** de «En pausa», de las pistas y de la etiqueta del período sobre el vidrio real: usan
  `textoTenue`/tokens del tema (la suite de tema pasa), pero no vi el píxel.
- **El layout** de `glass-etiqueta` junto al título en pantallas angostas: el título es corto
  («Ingresos») y la etiqueta lleva `numberOfLines={1}` y `flexShrink:1`, pero no lo medí.
- **Que el webhook de MercadoPago esté vivo** (I3): ver arriba.
- **`PantallaSoporte`** también monta `BotonVoz`: `onCerca` es opcional, así que no se rompe, pero no
  dibuja pistas ahí y no lo probé en pantalla.

## Mutantes (rojo → verde)

Cada comportamiento nuevo se rompió a propósito y el test correspondiente tuvo que fallar:

| mutante | resultado |
|---|---|
| el candado gana siempre (comportamiento viejo) | rojo en `BotonVoz.test.tsx` |
| «cerca» nunca avisa | rojo en `BotonVoz.test.tsx` |
| `ChatView` sin el texto «En pausa» / con la onda en pausa | rojo en `ChatView.test.tsx` (2) |
| `MicFuncion` sin pistas | rojo en `MicFuncion.test.tsx` |
| `PantallaIngresos` sin período / sin «Últimos» | rojo en `PantallaIngresos.test.tsx` (2) |
| el rótulo «Últimos» también con query | rojo en `BuscadorActividad.test.tsx` |
| `MarcoGlass` no dibuja la etiqueta | rojo en `MarcoGlass.test.tsx` |

## Declarado, no tocado

- **Período con día inventado en otras pantallas** (no son mis filas): `gastos/ResumenMes.tsx:39` pinta
  `Gastado en ${formatearFechaCorta(resumen.periodo)}` → «Gastado en 1 ago», y la web
  `copiloto-web/…/IngresosScreen.tsx:131` pinta «1 sep» junto al título. Mismo defecto que I1 resolvió en
  Ingresos nativo; `formatearMesDePeriodo` ya existe para quien tome esas filas.
- **`useCronometroGrabacion`** sigue con 0 consumidores (ver G2): no lo borro, porque borrarlo encarece la
  decisión abierta.
- **Web:** no tiene composer de voz gestual (`MicButton` por toque): las pistas del gesto son del táctil
  nativo. Los 5 ids nuevos están en `scripts/ci/testid-paridad-excepciones.json` con ese motivo.

## Rollback

`git revert` del merge commit del PR: son cambios de UI y de un helper puro, **sin migración, sin
contrato de red, sin estado persistente**. `BuscadorActividad.rotuloLista` y `MarcoGlass.etiqueta` son
props opcionales: revertir deja a los demás consumidores exactamente como estaban.
