# Acta de decisiones — beta Odobi (2026-09-21)

**Cierra:** `BL-P1` y `BL-P3` del [backlog](2026-09-21-backlog-beta-odobi-con-dod.md). **Aplica en:** el [plan autónomo](2026-09-21-plan-implementacion-beta-odobi-autonomo.md).
**Fuente:** respuestas del operador (David Lin) en la sesión de planificación del 21/09. Para las decisiones de Martín, el código de mobile al 21/09 (auditoría §6.3).
**Regla:** una decisión de acá se cambia sólo con otra acta. Una sesión que necesite contradecirla lo escala como MAYOR (plan §5.2).

## 1. Decisiones MAYORES

| DEC | Decisión | Dueño | Fecha | Plataformas | Destraba / efecto |
|---|---|---|---|---|---|
| DEC-1 | Mobile lo implementan FRONTEND-1 y FRONTEND-2 por el buzón. Martín diseña; no commitea código. | Operador | 21/09 | mobile | Todo ítem con mobile. `BL-B4` → post-beta (`BL-V16`). |
| DEC-2 | Web sigue a mobile: capas (DA-1), 6 funciones (DA-2), 2 temas (DA-5), ARCA (DA-11), bloque negro (DA-3). La traducción de las capas a escritorio la decide FRONTEND-2 dentro de esta regla y la revisa auditoría. | Operador | 21/09 | web | `BL-X1`–`BL-X5`, `BL-X11` |
| DEC-3 | Splash con Reanimated, según `Prototipo frontend/odobi-ui/specs/splash-port-reanimated.md`. No entra Rive. | Operador | 21/09 | web + mobile | `BL-X10` |
| DEC-4 | Builds EAS a cargo de BACKEND, planificados: como máximo 2 (plan §6). | Operador | 21/09 | mobile | `BL-C5`, `BL-O3` |
| DEC-5 | Neue Einstellung sale del árbol del repo. La app usa Plus Jakarta Sans + Inter en las dos plataformas. La reescritura de la historia es paso del operador (plan §13.2). | Operador | 21/09 | web + mobile + repo | `BL-X6` |
| DEC-6 | «Cómo hablarle» = editor de tono con respuesta de ejemplo, como el prototipo. | Operador | 21/09 | web + mobile | `BL-X7` |
| DEC-7 | Onboarding entra en la beta: hilo de 2 permisos + primer insight (`mockups/01-onboarding`). | Operador | 21/09 | backend + web + mobile | `BL-X8` |
| DEC-8 | Plan y límites **no** entran en la beta. | Operador | 21/09 | — | `BL-X9` → `BL-V2`; `plan` y `limite` son VISIÓN en `BL-P5` |
| DEC-9 | El CUIT se puede cambiar; el backend acepta sólo un CUIT vinculado a la clave fiscal del tenant y la UI muestra el rechazo. | Operador | 21/09 | backend + web + mobile | `BL-C6` |
| DEC-10 | Se aceptan todas las decisiones de Martín ya aplicadas en mobile (§2). | Operador | 21/09 | web (mobile ya las tiene) | `BL-W5`, `BL-W10`, `BL-X11` |
| DEC-11 | Los dos contrastes que fallan (sello de acción, botón de grabar) **se corrigen**, sin excepción firmada. | Operador | 21/09 | web + mobile | `BL-Q4` — ✅ **CERRADO el 08/10**: las dos piezas por fill + el sello por la excepción firmada en `DEC-15`. Ver §5. |
| DEC-12 | Google OAuth y lista de testers: más adelante (Cierre B). | Operador | 21/09 | ops | `BL-O1`, `BL-O2` |
| DEC-13 | Sin iOS en la beta. | Operador | 21/09 | mobile | `BL-O3` sólo Android |
| **DEC-14** | **El sprint cierra contra el ALCANCE anclado, NO contra §13.** Las **7** filas de la lista cerrada (`A3`·`A5`·`A7`·`A8`·`P1`·`P3`·`C1`) mergeadas y verificadas sobre `92fd8a06`, con el recibo que **cubre** ese SHA. **§13 queda explícitamente ABIERTO** como criterio del cierre **siguiente**: sus puntos 3 y 5 esperan la tanda de **device**, que el propio operador difirió el 22/09. | Operador | **08/10** | — | `ALCANCE-CIERRE-BETA.md` · backlog §13 |
| **DEC-15** | **Firmada la excepción de clase `logotipo` para el sello de acción** (isotipo blanco sobre `acento` sólido, 3,17:1), por **WCAG 1.4.3**. Puntual: no afloja ningún otro par. ⇒ **cierra `DEC-11`**. | Operador | **08/10** | web + mobile | cierra `DEC-11` / `BL-Q4` · §5 de esta acta |
| **DEC-16** | **El punto 2 de §13 excluye lo diferido por acta.** Exigía «todos los `BL-O` cerrados» mientras `DEC-12` (21/09) tenía cuatro de ellos **DIFERIDOS a Cierre B** y `BL-O3` **atado a EAS**: incumplible por **firma**, no por trabajo. Se le copia la cláusula que el punto **1 ya tenía** («o explícitamente pospuestos»). **No revierte `DEC-12` ni agrega alcance** — pone el criterio al día con decisiones ya tomadas. Importaba ahora porque `DEC-14` dejó §13 como criterio del cierre **siguiente**. | Operador | **08/10** | — | `backlog §13.2` · cierra `H-PUNTO2INCUMPLIBLE` (auditoría, #964) |
| **DEC-17** | **`BL-O4` (observabilidad y alertas) DIFERIDO a Cierre B**, con los otros `BL-O`. Era el único huérfano real de los 12 `SIN-SEÑAL` (auditoría): sin diferimiento, sin dueño, sin decisión pendiente. **Motivo:** es observabilidad **para testers externos**, y `BL-O1`/`BL-O2`/`BL-O3` ya estaban diferidos por `DEC-12` — cubriría usuarios que esa firma no habilitó. **Riesgo aceptado:** hoy una caída de web/worker/Caddy/GoTrue **no alerta a nadie**. | Operador | **08/10** | VPS / `fleet-platform` | `backlog BL-O4` · cierra `H-DOCESINSENAL` (auditoría) |
| — | No se enciende todavía: backups, legal propio, horario de soporte. Hasta que exista un SLA, los textos de soporte no prometen un número de horas. | Operador | 21/09 | ops | `BL-O5`, `BL-O6`, `BL-O7` → Cierre B |

## 1.bis Qué libera esta acta, y la reunión que no hubo

**Levanta el congelamiento de la «Parte 2».** El contrato del 16/09 de planificación a frontend
—`2026-09-16_contrato_planificacion-a-frontend_seis-trabajos-sin-bloqueo-y-lo-que-NO-se-toca-hasta-la-reunion`,
que vive en el buzón `coordinacion/` y **no está versionado**— reservaba una **Parte 2, «lo que NO se
toca»**, hasta que hubiera reunión. **`DEC-2` y `DEC-3` la liberan:** web sigue a mobile en capas,
6 funciones, 2 temas, ARCA y bloque negro (`DEC-2`), y el splash queda con Reanimated (`DEC-3`). No
queda nada de esa Parte 2 esperando una reunión.

Sus **6 trabajos no se perdieron:** pasaron a `BL-C1`–`BL-C6` del
[backlog](2026-09-21-backlog-beta-odobi-con-dod.md) por `BL-P4`, con reparto **C1/C4/C5/C6 →
FRONTEND-2**, **C2/C3 → FRONTEND-1**, y la mitad backend de `C6` por el contrato `K-02`. El contrato
del 16/09 quedó marcado **REEMPLAZADO** en su primera línea; su trabajo 2 ya se había hecho en mobile
por fuera, en #511.

**La reunión no ocurrió, y esta acta no la necesitó.** Las decisiones de Martín no se tomaron en una
reunión: se **leyeron del código de mobile al 21/09** (encabezado, «Fuente»; auditoría §6.3) y se
aceptaron en bloque por `DEC-10`. Lo que sigue pendiente de Martín son los **3 temas de §4**, que los
lleva el operador — y de ésos, `DEC-11` (contrastes) figuró **abierto** entre el 29/09 y el 08/10, y **cerró** con `DEC-15`; estuvo abierto desde la actualización del
29/09: no es deuda de documentación, es una decisión de diseño sin tomar.

> **Por qué esto estaba en el aire.** El contrato del 16/09 registraba **de su lado** que esta acta lo
> liberaba; el acta no lo decía **del suyo**. Una liberación escrita en un solo extremo —y encima en
> `coordinacion/`, que no se versiona y no sobrevive a un clon— desaparece con el buzón, y entonces
> nadie puede responder «¿se puede tocar la Parte 2?» sin reconstruir el hilo. `BL-P1`.

## 2. Registro DA-1 a DA-11

| DA | Estado | Dueño | Fecha | Plataformas | Alcance |
|---|---|---|---|---|---|
| DA-1 Armazón en capas | **Cerrada**: capas | Operador | 21/09 | mobile + web | Mobile hecho (#512); web en `BL-X1` |
| DA-2 Fusión Contabilidad + Inteligencia | **Cerrada**: 6 funciones | Operador | 21/09 | mobile + web | Mobile hecho; web en `BL-X2` |
| DA-3 Bloque negro vs glass | **Cerrada**: bloque negro para la cifra única, glass para el resto | Operador | 21/09 | mobile + web (`DEC-2`) | Registra la convergencia que ya ocurrió en mobile |
| DA-4 Tokens, acento, contraste, tipografía | **Cerrada**: tokens de #511, Plus Jakarta Sans + Inter, contrastes corregidos | Operador | 21/09 · contrastes reabiertos 29/09 (`DEC-11`) | mobile + web | `BL-X6`, `BL-Q4` |
| DA-5 Temas | **Cerrada**: 2 temas con muestras + «Como el teléfono» | Operador | 21/09 | mobile + web | `BL-X4` |
| DA-6 Onboarding | **Cerrada**: entra | Operador | 21/09 | mobile + web | `BL-X8` |
| DA-7 Plan y límites | **Cerrada**: post-beta | Operador | 21/09 | ninguna en la beta (post-beta) | `BL-V2` |
| DA-8 Splash | **Cerrada**: Reanimated | Operador | 21/09 | mobile + web (`DEC-3`) | `BL-X10` |
| DA-9 «Cómo hablarle» | **Cerrada**: editor de tono con ejemplo; Mi negocio conserva una fila-resumen | Operador | 21/09 | mobile + web | `BL-X7` |
| DA-10 CUIT | **Cerrada**: con salida, validada por backend | Operador | 21/09 | mobile + web + backend | `BL-C6` |
| DA-11 AFIP → ARCA | **Cerrada**: aplicar en web y en textos del agente | Operador | 21/09 | web + textos del agente | `BL-X5` |

> **De dónde salen las tres columnas nuevas** (`BL-P3`), para que no se lean como estimación.
> **Dueño** = el decisor, que es el Operador en las 11: `DEC-1` dice que Martín diseña y no commitea,
> y `DEC-10` acepta en bloque lo que Martín ya había aplicado en mobile. Quién *ejecuta* lo que falta
> sigue estando en Alcance — los `BL-X*` son web y, por `DEC-2`, los decide FRONTEND-2.
> **Fecha** = 21/09, el día de esta acta, que es cuando las 11 quedaron **Cerradas**; la única
> excepción está marcada en su fila. **Plataformas** = derivadas del propio Alcance más `DEC-2`/`DEC-3`:
> donde el Alcance dice «mobile hecho» hay mobile, y donde cita un `BL-X*` falta web. **No** salen de
> una lectura del código: si una fila se contradice con el código, gana el código y esta tabla se
> corrige.

## 3. Decisiones de Martín posteriores al 07/09, aceptadas (DEC-10)

| Tema | Valor aceptado | Dónde está hoy | Web |
|---|---|---|---|
| Avatar de Soporte | Isotipo de 38 px, fuera del scroll, con «Soporte de Odobi» | `apps/mobile/src/modules/soporte/PantallaSoporte.tsx:136-146` | `BL-W10` |
| Grosor del isotipo | 1,3 en todos los tamaños | `apps/mobile/src/theme/Marca.tsx:28-36` | `BL-X11` |
| Logos de apps | Logo real de cada servicio en un tile blanco | `apps/mobile/src/modules/apps/logosMarca.ts`; fuente `odobi-ui/assets/logos/` (#516) | `BL-X11` |
| Calma | **3** días distintos (Martín lo confirmó en #516) | `apps/mobile/src/theme/EstadoVacio.tsx:27` | `BL-W5` con constante única |
| Cinco íconos | Provisorios, tal como están | `apps/mobile/src/theme/glass/mapaIconos.ts:12-16` | `BL-X11` |
| Lockup en el ingreso | Símbolo y nombre en una línea + «Entrá a tu cuenta» | `apps/mobile/src/modules/auth/PantallaLogin.tsx` | `BL-X11` |
| Nocturno | Eliminado | `apps/mobile/src/theme/tokens.ts:201` | `BL-X4` |

La nota de `soporte` del mapa («el avatar NO es el isotipo») queda **reemplazada** por esta acta.

## 4. Para Martín (lo lleva el operador)

1. **`fact-sinarca` (`BL-P6`):** el hilo muestra facturar con un comando de voz y CAE inmediato. El producto **no emite sin confirmación** (`apps/copiloto/tool_catalog.py:267-269`; `kb-usuario/chat.md:96-98`). El hilo real es `fact-voz` → `fact-hitl` → `fact-cae`. Pedido: ajustarlo o retirarlo del prototipo.
2. **Fuente:** Neue Einstellung salió del repo (DEC-5), incluido `assets/fonts/NeueEinstellung-Bold.otf` del prototipo; el prototipo cae a su fuente de respaldo. En próximas entregas, nada de `.otf` / `.woff*` con licencia paga. La app usa Plus Jakarta Sans + Inter.
3. **Contrastes (DEC-11):** el sello de acción y el botón de grabar van a cambiar de token para pasar WCAG. Cuando FRONTEND-1 cierre `BL-Q4`, esta acta se actualiza con los valores nuevos, en hex. ✅ **`DEC-11` cerró el 2026-10-08** con `DEC-15`. Ver el detalle y su cierre en §5 — ahí vive toda su historia, incluido el bloque del 29/09 que antes partía esta lista y con su ratio computado, para que los lleves al prototipo.

4. **Calma = 3 días**, confirmado por Martín en #516. Falta alinear el prototipo: `prototipo/index.html:3703` todavía dice `CALMA_TOPE = 5`.
5. **Ajustes (`?ver=ajustes`):** el prototipo tiene una lista agrupada en 3 secciones («Tu negocio» / «La app» / «Ayuda») con la identidad del negocio arriba. Tu mobile del 18/09 (`51437353`, aceptado por DEC-10) usa en cambio una grilla de tiles con el grupo «Ayuda», y ahí «Cómo usar la app» absorbe la guía. Web va a seguir a mobile (`BL-W12`, barrido BL-Q3 web del 2026-09-22). Pedido: alinear el prototipo con tu decisión, o avisar si la lista agrupada es la versión final (en ese caso se reabre DEC-10 para Ajustes).

6. **Affordance de voz (patrón, no bug):** el prototipo pone un **composer al pie** de la pantalla; la app pone un **micrófono suelto junto al label**. Auditoría lo encontró **sistemático**: pasa en `ingresos` **y** en `presu`, o sea que no es un descuido de una pantalla sino **dos criterios de entrada por voz conviviendo**. Pedido: decidir cuál es el patrón y que valga para las dos. Mientras no se decida, cada pantalla nueva elige uno y la divergencia crece.

7. **`agenda` — 5 diferencias de header no declaradas** (auditoría, Bloque A, 2026-09-23). Severidad baja, pero conviene mirarlas juntas porque son del mismo encabezado. Nota: esa fila **todavía no es del todo medible** — Google Calendar está desconectado en el tenant de prueba y el cuerpo de la pantalla queda vacío; reconectarlo pide un consentimiento OAuth que sólo puede dar el operador.

---

## 5. `DEC-11` — cómo envejeció y cómo cerró

> ⚠️ **Este bloque estuvo mal ubicado hasta el 2026-10-08**: se insertó **entre los ítems 3 y 4** de la lista de §4, partiéndola en dos listas. Lo movió acá su propio autor. La lección es del mismo tipo que la que el bloque documenta: **un texto correcto insertado en el lugar equivocado degrada el documento sin que ningún control lo note**, porque ningún gate mide estructura de Markdown.

> 📌 **Lo mismo le pasaba a este blockquote del 29/09, y es ANTERIOR**: vivía entre los ítems 3 y 4 de §4 desde que se escribió, así que la lista estuvo partida **nueve días** sin que nadie lo notara. Mi propio bloque la partió una segunda vez, y al mover sólo el mío **el control que escribí para probarlo siguió en rojo** — por eso está acá también. **El hallazgo real es del instrumento:** un control que mide *«¿la lista es 1..7 consecutiva?»* encuentra el defecto **ajeno y viejo** que nadie buscaba; uno que midiera *«¿moví mi bloque?»* habría dado verde con la lista igual de partida.

> ### ⚠️ ACTUALIZACIÓN 2026-09-29 — **`DEC-11` NO está cerrado, y no es deuda de documentación**
>
> Esta acta esperaba «los valores nuevos, en hex y con su ratio computado» para cuando FRONTEND-1
> cerrara `BL-Q4`. Al ir a buscarlos apareció que **no existen todavía: el fix no se aplicó.** Lo que
> hay es la medición y **una decisión de diseño sin tomar**, que es lo que en realidad bloquea.
> Evidencia: `docs/copiloto-emprendedor/Auditorias/2026-09-28-BL-Q4-variantes-AA-texto-sin-tocar-marca.md`.
>
> | par | dónde | hoy | variante fg-only | ¿es mínima? |
> |---|---|---|---|---|
> | **Sello de acción** — isotipo `acentoTexto` sobre `acento` sólido `#DE7250` | `apps/mobile/src/theme/tokens.ts:594` · `Marca.tsx`, `BotonVoz.tsx:339-366` | `#FFFFFF` → **3,17:1** | invertir el isotipo a gris oscuro | **no**: es cambio de identidad, no de tono |
> | **Botón de grabar** — mismo `acentoTexto` contra el 1er stop (`glass.accent2` = `#F8E0D9`) | `apps/mobile/src/modules/chat/BotonVoz.tsx:323` + `:339-366` | `#FFFFFF` → **1,26:1** | `#666666` → 4,55:1 | **no**: ídem |
>
> **El repo ya eligió el otro camino, y funcionó.** `HudGrabacion.tsx` — el HUD que se ve *mientras*
> se graba, hermano de `BotonVoz.tsx` — tenía el **mismo** defecto y se corrigió **tocando el fill, no
> el texto**: su degradé pasó de `[glass.accent2, acento, acento]` a `glass.ub1 → glass.ub2`
> (`#B04A2E → #722717`), **conservó el isotipo blanco** y llegó a **5,43:1** en el peor punto
> (`tokens.ts:441-443`, comentario `BL-Q4 (DEC-11)`). `BotonVoz.tsx` es **la mitad de la pareja que no
> se tocó**.
>
> **Recomendación de planificación:** replicar en `BotonVoz.tsx` el fix de fill de su hermano, y
> aplicar el mismo criterio al sello. Cumple `DEC-11` «sin excepción firmada», **no toca la marca**, y
> tiene precedente medido en el propio repo — mientras que invertir el isotipo es una decisión de
> identidad visual, que no es de una sesión.
>
> **Por qué esto no se veía:** la decisión estaba firmada («se corrigen») y el renglón pendiente
> quedó redactado como «falta anotar los hex». Una decisión trabada que se archiva como deuda de
> registro deja de pedir turno: nadie va a buscar un bloqueo donde el texto promete una anotación.
>
> **Tokens de referencia, ya que el renglón los pedía:** `textoTenue` = `p.dim`
> (`tokens.ts:590`) → **claro `#6A6457`** (`:497`), **oscuro `#928777`** (`:536`).
>
> Fila de seguimiento: `DEC11FILL` en `coordinacion/PLAN.md`.

### 🔁 El bloque de arriba quedó **VENCIDO EN SUS DOS FILAS** — re-medido 2026-10-08

**No se borra: queda para que se vea cómo envejeció.** El bloque del 29/09 se titula *«`DEC-11` NO está cerrado»* y afirma *«los valores nuevos no existen todavía: el fix no se aplicó»*. **Hoy el código lo desmiente en las dos filas de su propia tabla.** Lo levantó AUDITORÍA (que además declaró **nulo** uno de sus propios controles: grepeó `ub1|ub2` en `HudGrabacion.tsx` esperando ≥1 y obtuvo 0 **porque ese path no existe en `main`** — un control sobre un archivo ausente no valida nada); re-verificado acá contra el código, no contra su reporte.

| fila del 29/09 | estado medido hoy | evidencia |
|---|---|---|
| **Botón de grabar** (`acentoTexto` contra `glass.accent2`, **1,26:1**) | ✅ **CORREGIDO por fill**, con guard de regresión | `paresPintadosContraste.test.tsx:893` — *«`BL-Q4`: el botón de grabar no vuelve al degradado que terminaba en accent2 (1,26:1)»*, con `expect(gradiente[1]).not.toMatch(/accent2/)` |
| **Sello de acción** (isotipo blanco sobre `acento` sólido, **3,17:1**) | 🟠 **sigue declarado como excepción**, clase `logotipo` | `paresPintadosContraste.test.tsx:836` y `:849`: `{ min: 3.16, clase: 'logotipo', motivo: 'isotipo Odobi (trazo blanco) sobre acento sólido' }` |

Y apareció una **tercera** pieza que el bloque del 29/09 no podía prever, porque es posterior: **el botón de voz (la esfera) también se corrigió por fill**, con el mismo criterio del hermano `HudGrabacion` — `BotonVoz.tsx:318-331` usa el radial `glass.ub1 → glass.ub2` con el comentario que nombra `DEC-11/DEC11FILL, Pieza A`, y tiene su propio guard en `paresPintadosContraste.test.tsx:905`. **O sea la «Recomendación de planificación» del bloque de arriba —replicar el fix de fill— se ejecutó.** El `motivo` de la excepción lo dice textual: *«BotonVoz salió de este par en DEC11FILL Pieza A»*, así que la excepción ya **no** cubre al botón: cubre sólo la Marca.

#### ✅ `DEC-11` **CERRADO** — el operador firmó la excepción el 2026-10-08 (`DEC-15`)

`DEC-11` (fila §1 de esta acta) dice textual **«se corrigen, sin excepción firmada»**. El sello **está** declarado como excepción. Las dos varas se contradicen y sólo el operador elige cuál manda:

- **La norma lo permite:** WCAG 1.4.3 exime al texto que es parte de un logotipo, y el gate implementa esa exención de forma explícita — `UMBRAL_POR_CLASE` da **0** a `logotipo` (`:760`, *«`logotipo` no tiene piso de ratio (exento por norma)»*).
- **Y el bloque del 29/09 ya había dicho** que invertir el isotipo *«es una decisión de identidad visual, que no es de una sesión»* ⇒ no tocarlo fue el diferimiento **correcto**.
- **`DEC-11` prohibió la excepción sin firma — y el 2026-10-08 el operador la firmó.** → **`DEC-15`: la clasificación `logotipo` del sello de acción queda FIRMADA.** Con eso `DEC-11` se cumple en sus **tres** piezas y no por indulto: botón de grabar ✅ corregido por fill, botón de voz ✅ corregido por fill, sello ✅ **excepción firmada** — que es exactamente la salida que la propia letra de `DEC-11` preveía: *«sin excepción **firmada**»* nunca prohibió la excepción, prohibió la **no firmada**.

> 🗿 **La firma, textual:** el operador firma la clase `logotipo` para el sello de acción (isotipo blanco sobre `acento` sólido, **3,17:1**), apoyado en **WCAG 1.4.3**, que exime al texto que es parte de un logotipo. **No** habilita bajar el piso de ningún otro par: `:753` ya advierte que si el glifo fuera texto real ninguna excepción puede declararlo `logotipo`, y una excepción **sin** `clase` sigue rompiendo el gate por diseño (`:786`, con su control positivo en `:956`). **La exención es puntual, declarada y ejercitada por un test — no es un agujero abierto.**

**A favor del gate, y vale decirlo:** la clasificación no puede colarse en silencio. Una excepción **sin** `clase` **rompe el gate por diseño, sin default** (`:786`), el propio test tiene su **control positivo** para eso (`:956`, `excepcionSinClase` con *«clase omitida a propósito»*), y `:753` advierte que si el glifo fuera texto real **ninguna** excepción puede declararlo `logotipo` para aflojarle el piso. O sea: la exención es una decisión **declarada y ejercitada**, no un agujero.

**La lección del envejecimiento, que es el verdadero hallazgo:** un bloque que dice *«X NO está cerrado»* **no vence solo**. Sigue leéndose como estado actual mientras el código avanza, y cualquiera que mida `DEC-11` contra esta acta concluye que falta trabajo cuando lo que falta es una firma. El bloque de arriba ya había diagnosticado su propia versión de esto —*«una decisión trabada que se archiva como deuda de registro deja de pedir turno»*— y después le pasó lo simétrico: **una deuda resuelta que se archiva como trabada sigue pidiendo turno.**
