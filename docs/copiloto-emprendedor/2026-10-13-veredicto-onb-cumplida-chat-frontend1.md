# Veredicto de la fila `onb-cumplida` — las 6 divergencias, una por una (frontend-1)

**Fecha:** 2026-10-13 · **Contrato:** `2026-10-13_contrato_planificacion-a-frontend1_onb-cumplida-es-la-UNICA-fila-del-padron-54-sin-veredicto-de-nadie…` ·
**Mapeo de origen:** [`2026-10-12-mapeo-prototipo-vs-nativo.md`](2026-10-12-mapeo-prototipo-vs-nativo.md) (fila `onb-cumplida`, línea 83) ·
**Rama:** `frontend1/onb-cumplida-veredicto`

> Documento hermano de [`2026-10-13-veredicto-bloque-chat-frontend1.md`](2026-10-13-veredicto-bloque-chat-frontend1.md):
> mismos estados, mismo criterio. El nombre lleva `chat` porque el medidor asigna cada doc a un brazo
> por el nombre (`medir-mapeo-implementacion.py`, `corpus()`) y éste es de frontend-1, con su formato.

## Cómo leer esto

| estado | qué significa |
|---|---|
| ✅ **CERRADA-EN-CODIGO** | la divergencia quedó resuelta: existe en el código con `path:línea` y un test que la ejercita |
| 📝 **ENMIENDA-FUNDADA** | la divergencia se **mantiene a propósito**, con el motivo escrito. Reabrible por el operador |

**Nivel de verificación de TODO lo de abajo:** jest (RNTL) + vitest + `tsc` + `testid_paridad.py` +
eslint. **Nada fue visto en un teléfono ni contra el agente real.** Lo que sólo se vería en device queda
anotado como *«[sin ver en device]»*.

## Resumen

| # | divergencia (fila `onb-cumplida`) | veredicto | cómo |
|---|---|---|---|
| 1 | pantalla completa, sin separador «Hoy» | 📝 ENMIENDA-FUNDADA | el onboarding es un *gate* a propósito; «Hoy» nace en el hilo con el primer mensaje |
| 2 | «Servicios conectados» es una píldora de texto, no el `Recibo` | ✅ CERRADA-EN-CODIGO | ambos clientes usan el `Recibo` real del chat |
| 3 | insight «…ya vencidos» vs «…de hace más de 20 días» | 📝 ENMIENDA-FUNDADA | el umbral vive en backend y no viaja en el payload; «20 días» es un número del mock |
| 4 | pregunta acortada «¿…el detalle?» | ✅ CERRADA-EN-CODIGO | copy del prototipo: «…el detalle de quiénes son?» |
| 5 | «Armame el detalle» sólo ejecutaba `onEntrar` | ✅ CERRADA-EN-CODIGO | **era un defecto real**: ahora entra al hilo con el pedido dicho |
| 6 | botón «Entrar» que el proto no tiene | 📝 ENMIENDA-FUNDADA | sin él el `sin_dato` no tiene salida: el onboarding no es un hilo con composer |

**Cuenta honesta:** 6 divergencias, **6 con veredicto** (3 en código, 3 enmiendas). Que cumplan el DoD
no quiere decir que se hayan visto en un teléfono: ver §Lo que NO está verificado.

---

## Fila por fila

### 1 · `onb-cumplida` — ✅ + 📝

Una sola fila del padrón, seis divergencias. Cada una lleva su veredicto abajo.

#### #1 · pantalla completa, sin separador «Hoy» — 📝 ENMIENDA-FUNDADA

**Qué es hoy.** El recibo se renderiza **en lugar de** la app, no dentro del hilo:
`apps/mobile/app/_layout.tsx:97-98` y `apps/copiloto-web/src/App.tsx:76-77` (el `Guard` devuelve
`<PantallaOnboarding>` / `<Onboarding>` mientras `!onboardingCerrado && debeMostrarOnboarding(me)`).

**Por qué se mantiene.**
1. **Es un gate, no una conversación.** Hacerlo «mensajes del hilo» obliga a escribir en una sesión de
   chat **antes** de que el emprendedor esté dentro de la app (sesión, persistencia, qué significa
   `completarOnboarding` si el hilo ya tiene historia). Eso es un cambio de arquitectura, **MAYOR**: lo
   decide el operador, no una fila de mapeo. BL-X8 ya tomó el punto medio: la promesa **se dibuja** con
   burbujas de asistente y la tarjeta real del hilo, sobre un gate real (`PantallaOnboarding.test.tsx`
   «la promesa se dibuja con burbujas de asistente y la tarjeta real del hilo, no un formulario»).
2. **«Hoy» no es de la pantalla sino de los mensajes.** Lo calcula `separadoresFecha` sobre mensajes con
   `creadoEn` (`packages/core/src/chat/separadoresFecha.ts`; test «un separador por cambio de día,
   incluido el primero»). El onboarding no tiene mensajes fechados; el «Hoy» aparece en el hilo **con el
   primer mensaje**, que desde #5 es el pedido del detalle. *[sin ver en device]*

**Lo que esta enmienda NO cubre — dicho sin maquillaje.** El mockup funda el recibo dentro del hilo con
*«el historial nace auditable desde el minuto uno (el chat es el registro)»*
(`mockups/01-onboarding/DECISIONES.md`, fila «Receipt "Servicios conectados"»). Hoy ese motivo **no se
cumple**: el recibo de servicios no queda como primer renglón del historial. Se mantiene la divergencia
por el costo/riesgo de (1), no porque el motivo del diseño no valga.

**Reabrible — y es del operador:** si quiere el onboarding como hilo real, es una decisión de
arquitectura (MAYOR), y con ella caen también la #6 y este «Hoy».

#### #2 · «Servicios conectados» es una píldora, no usa el `Recibo` — ✅ CERRADA-EN-CODIGO

El `REC('Servicios conectados','Mercado Pago · Google','')` del prototipo es título + línea secundaria
(`t2`). Ya existe el componente que lo dibuja en el chat; ahora lo usa el onboarding en vez de una
píldora propia:

| cliente | código | test |
|---|---|---|
| mobile | `modules/onboarding/PantallaOnboarding.tsx:207` → `<Recibo tono="exito" titulo="Servicios conectados" detalle={['Mercado Pago · Google']}/>` (`chat/Recibo.tsx`); se quitó el estilo `recibitoPill` | `PantallaOnboarding.test.tsx:130` «…es el Recibo del chat: título + detalle» |
| web | `modules/onboarding/Onboarding.tsx:207-215` → `<Recibo>` del design-system con `nota` = el `t2`, envuelto en el `data-testid` literal que lee el gate de paridad | `Onboarding.test.tsx:204` (ídem) |

Efecto visible: check de éxito y `role="status"`/live region (WCAG 4.1.3) que la píldora no tenía.
El texto «Mercado Pago · Google» es verdadero por construcción: el paso `recibo` sólo se alcanza con
`permisosCompletos` (`PantallaOnboarding.tsx:75`, `Onboarding.tsx:75`). *[sin ver en device]*

#### #3 · «…y $X ya vencidos» vs «…$63.000 son de hace más de 20 días» — 📝 ENMIENDA-FUNDADA

**Qué dice hoy.** `textoDelInsight` (`packages/core/src/api/onboarding.ts:86-91`): *«Tenés $X facturados
sin cobrar, y $Y ya vencidos.»*

**Por qué se mantiene — el dato SÍ trae antigüedad, pero no la que dice el mock.**
- `por_cobrar.vencido` es *«la parte con más de `DIAS_VENCIDO` días desde la emisión»* con
  `DIAS_VENCIDO = 30` (`apps/copiloto/inteligencia_queries.py:77` y `:198-205`). El prototipo dice **20**:
  es un número de maqueta que no corresponde a ninguna regla del sistema.
- El umbral es **una constante del backend que no viaja en el payload** de la portada (sólo
  `{total, vencido}`). Escribir «hace más de 30 días» en el cliente es hardcodear un valor ajeno: el día
  que backend lo mueva, la pantalla miente con la cifra correcta al lado. «Ya vencidos» es el único
  texto que sigue a la definición del backend sin copiarla.

**Reabrible, con contrato:** si el operador quiere la antigüedad literal, es una fila **backend +
frontend** (la portada debería traer `dias_vencido` y el texto lo leería). Contrato primero; frontend no
la inventa.

#### #4 · pregunta acortada — ✅ CERRADA-EN-CODIGO

Prototipo (`index.html:3216`, `ODOBI_HANDOFF.md:147`): *«¿Querés que te arme el detalle de quiénes son?»*.
Ambos clientes dicen ahora exactamente eso:
`PantallaOnboarding.tsx:218` · `Onboarding.tsx:221` · tests `PantallaOnboarding.test.tsx:172`,
`Onboarding.test.tsx:191`. La versión corta no tenía ninguna razón registrada (`DECISIONES.md:27` del
mockup deja el texto con puntos suspensivos).

#### #5 · «Armame el detalle» sólo ejecutaba `onEntrar` — ✅ CERRADA-EN-CODIGO · **defecto real**

**Causa raíz.** El chip prometía un detalle y su `onPress` era el mismo `onEntrar` que «Entrar»: cerraba
el onboarding y dejaba al emprendedor frente al hilo sin ningún detalle. La regla del mockup —*«nada se
ejecuta solo… cada paso pide permiso para el siguiente»* (`DECISIONES.md`, fila «Una pregunta,
cerrada»)— promete un chip que pide permiso, y el permiso concedido no llevaba a nada: el único paso
donde el producto *cumple* lo que prometió terminaba sin cumplirlo. Con el fix el detalle sigue sin
ejecutarse solo: lo dispara el toque.

**Fix (mismo PR, ambos clientes — «dos clientes gemelos: el fix llega a UNO»).**
- El detalle **no sale de la portada** (sólo trae total + vencido, sin desglose por cliente): lo arma el
  agente. Se reusa el puente que ya existe, `dejarPendiente`/`tomarPendiente` (`mensajePendiente`, BL-W9):
  el chip deja un **pedido autocontenido** y el chat principal lo manda al tomar el foco, **una vez**
  (`tomarPendiente` vacía el buzón).
- Texto único en core: `PEDIDO_DETALLE_POR_COBRAR` (`packages/core/src/api/onboarding.ts:100`). Sin cifras:
  no puede quedar viejo, y el hilo al que entra el emprendedor no vio el recibo.
- Chip: `PantallaOnboarding.tsx:177-185,221` · `Onboarding.tsx:178-185,223`. «Entrar» **no** deja nada.
- **Defecto latente que apareció al ejercitarlo (mobile).** `ChatView` tomaba el buzón en el primer foco,
  pero `useChat` arranca con `estado === null` y `send` **descarta en silencio** mientras sea `null`. Con
  el chat ya montado debajo de un glass no pasaba nada; con el onboarding —que se renderiza *en lugar
  del* chat— el chat se monta de cero, `tomarPendiente()` vaciaba el buzón y el pedido **se perdía sin
  rastro**. Ahora sólo toma con el estado hidratado (`ChatView.tsx:146-152`, `hidratado` en las deps).
  Esto corrige también «Cómo usar la app» si se llegara a dejar un pedido antes del montaje.

**Pruebas (rojo→verde medido con mutantes, no declarado):**

| mutante | test que se pone rojo |
|---|---|
| chip vuelve a `onPress: onEntrar` (mobile) | `PantallaOnboarding.test.tsx:194` «el chip deja el pedido… UNA sola vez» |
| ídem (web) | `Onboarding.test.tsx:224` |
| `ChatView` sin la guarda `if (!hidratado) return` | `ChatView.test.tsx:238` «un pedido que ya estaba en el buzón al MONTAR se manda UNA vez, tras hidratar» |

Contrapartes: «Entrar» no deja pedido (`…test.tsx:204` / `Onboarding.test.tsx:235`) y `tomarPendiente()` por
segunda vez da `null` (no se reenvía solo).

#### #6 · botón «Entrar» que el proto no tiene — 📝 ENMIENDA-FUNDADA

**Por qué se mantiene.** En el prototipo el recibo está dentro del hilo: el emprendedor sigue escribiendo
en el composer de abajo, así que no necesita salida. Acá el onboarding es un gate **sin composer**
(#1), y el chip «Armame el detalle» **sólo existe con dato real** (`pregunta = listo && insight.tipo ===
'dato'`; test «sin dato real (0/vacío) NO hay pregunta cerrada ni chip»). Sin «Entrar», el caso
`sin_dato` —sin facturas pendientes— no tendría cómo salir del recibo.
`PantallaOnboarding.tsx:226-227` · `Onboarding.tsx:227`, deshabilitado hasta que el insight cargó
(`deshabilitado: !listo`), para no cerrar sobre un «cargando».
Test: «“Entrar” del recibo marca el onboarding y cierra el hilo» (`PantallaOnboarding.test.tsx:146`).

**Reabrible:** cae junto con la #1: si el onboarding pasa a ser el hilo real, «Entrar» sobra.

---

## Lo que NO está verificado (declarado)

1. **Nada en device.** Aspecto del recibo, orden de las burbujas y el momento en que el pedido aparece en
   el hilo no se vieron en un teléfono. El contrato lo declara «sin device».
2. **La respuesta del agente al pedido no se midió.** Lo que el código garantiza —y los tests prueban— es
   que el pedido **llega al chat y se manda una vez**. Que el agente conteste con la lista real de
   clientes que deben (las herramientas de inteligencia: `apps/copiloto/inteligencia_chat.py`, `datos_card.py`) es del backend y requiere el tenant de
   prueba con facturas impagas en el device de frontend-2. Si esa respuesta fuera pobre, el defecto sería
   de la herramienta, no del puente.
3. **Un caso no cubierto por test:** el emprendedor toca el chip, el `completarOnboarding()` falla
   (devuelve `false`) — el código cierra igual («se reintenta al próximo arranque») y el pedido ya está en
   el buzón; entra igual al hilo. No hay test de ese cruce.

## Control de efecto

El control no es esta tabla: es `python scripts/evidencia/medir-mapeo-implementacion.py` corrido por
quien lee, con su línea `ARBOL MEDIDO`. Ver el `cierre_` del contrato para la salida citada y su
procedencia (merge commit).

## Rollback

`git revert <merge>`: el chip vuelve a ser `onEntrar`, el recibo a la píldora, la pregunta al texto corto
y `ChatView` a tomar el buzón sin esperar la hidratación. Sólo UI y un helper de core; sin esquema,
migraciones ni cambios de contrato.
