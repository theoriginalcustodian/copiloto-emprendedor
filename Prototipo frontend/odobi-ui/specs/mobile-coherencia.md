# Coherencia de Odobi mobile con el sistema de diseño

**17/09/2026** · Verificado contra `theoriginalcustodian/copiloto-emprendedor` @ `a963fd1`
(el commit de la auditoría del 16/09, PR #510).

> ⚠️ **Estado al 21/09/2026 — las casillas de este documento NO se fueron tildando.** Quedó
> como se escribió el 17/09, pero **las olas 1 a 5 ya están aplicadas y mergeadas a `main`**
> (PRs #511, #512 y #513, más el `fix` `c2cb298`), head `3914716`. Leer las `[ ]` como el plan
> original, no como trabajo pendiente: **el estado real es el código**. Lo único abierto de esta
> lista es lo que depende del backend — los tres huecos de contrato (fecha de corte del saldo ·
> variación vs mes anterior · señal de salud por conexión) y **B-3** (criticidad y verbo
> contextual por regla).

## Objetivo

Dejar `apps/mobile` en coherencia con `odobi-ui/CLAUDE.md`, y separar con precisión qué depende
de nosotros de qué depende del backend de David — para poder trabajar sin bloquearnos y para que
la reunión sea corta.

---

## 0 · Autoridad, alcance y supuestos

### Autoridad
**`odobi-ui/CLAUDE.md` es la especificación de diseño de Odobi.** Está en el repo, verbatim
(1158 líneas cuando se escribió esto; **1167 desde el 21/09**, que suma las tres decisiones
del 18/09 — trazo plano, los 5 íconos y la calma). Cuando el código no coincide con ese documento,
**es deuda del código**: no es una divergencia a negociar ni una decisión pendiente.

⚠️ La auditoría del 16/09 clasificó como «decisiones abiertas» varias cosas ya cerradas por Martin
—DA-2 (20/08), DA-3 (§5, línea 153), DA-5, DA-11 (20/08) y el acento de DA-4—. **Esa clasificación
no se usa.** Acá esas filas son ítems de aplicación.

### Alcance
**Sólo `apps/mobile`.** `apps/copiloto-web` queda **fuera de alcance declarado**.

⚠️ **Supuesto que hay que confirmar con David, y es el primer punto de la reunión.** Martin entiende
que el producto es una sola app mobile y que el PWA fue una herramienta de pruebas. **La evidencia
del repo dice otra cosa:** `deploy/copiloto/sync-web.sh` la despliega al VPS, `_mount_spa` la sirve
mismo-origen, `fetch-fonts.sh` le baja fuentes self-hosted en el deploy, `README-TECNICO.md` la
define como «Frontend PWA autocontenido» al mismo nivel que el backend, y su último commit es del
mismo día que el de mobile (08/09).

**Si la respuesta es «las dos», esta spec se amplía y aparece un costo permanente:** cada pantalla
se escribe dos veces. Ya hay daño medible — 7 pantallas con veredicto distinto entre plataformas,
el guard anti-duplicados en una app y no en la otra, dos acentos y dos gramáticas. La auditoría lo
nombra como causa raíz: *«los componentes de presentación viven duplicados por plataforma y sólo
`packages/core` es compartido»*.

### Decisiones ya cerradas por Martin (no vuelven a discutirse)
| | Decisión | Fecha |
|---|---|---|
| Armazón | **Mi día es la pantalla principal.** Modelo de capas. **El avatar es la única puerta a Ajustes** | 17/09 |
| Tipografía | **Plus Jakarta Sans Bold** (display) + **Inter** 400/500 (cuerpo). NeueEinstellung descartada: su licencia de app era un pago aparte | 17/09 (confirma 06–07/08) |
| Gramática | **Bloque negro** = «una cifra de tu negocio», uno por pantalla (`CLAUDE.md` línea 153) | 19/08 |
| Temas | **Exactamente 2**: claro y oscuro. **«Nocturno» se elimina** | 17/09 |
| Funciones | **6 tiles**, Contabilidad + Inteligencia fusionadas | 20/08 |
| Nombre del organismo | **ARCA** en todo texto visible | 20/08 |
| Ajustes | **«Cómo usar la app»** (un chat, que ES la guía de capacidades) · **Feedback** · **Soporte técnico**. El selector de **tono y forma** vive en **Mi negocio** | 17/09 |
| Isotipo | El de Martin (el trabajado con Rive). El de David era referencia y se descarta | 17/09 |

---

## Parte 1 · Nuestro trabajo (mobile)

### Ola 0 — Defectos

Rompen garantías que el producto ya declara. Van antes que todo.

- [ ] **D-1 · Presupuesto duplicado al recargar.** Portar el guard de web
      (`copiloto-web/…/TarjetaPresupuestoPropuesto.tsx:22-34`) a
      `mobile/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:32-45`.
      ⚠️ **El guard NO cierra el defecto**: tapa el remount, no el doble toque ni el reintento de
      red. La raíz es backend (ver Parte 2 · B-1). Se hacen las dos mitades o no cuenta.
- [ ] **D-2 · Cancelar la grabación deslizando a la izquierda.** Hoy soltar el mic sin fijar
      **siempre envía** (`ChatView.tsx:155`; `BotonVoz.tsx:193-207` lee sólo `translationY`).
      Spec: `mockups/03-home-conversacional/DECISIONES.md:95,108`.
- [ ] **D-3 · HITL genérico con aviso de irreversibilidad.** `ListaMensajes.tsx:38-90` muestra sólo
      `gate.markdown` + Confirmar/Cancelar. El payload ya trae `service`/`label`/`riesgo`.

### Ola 1 — Tokens

**Casi todo esto es un archivo.** `temaSinHex.test.ts` prohíbe hex fuera de `tokens.ts`, y **75
archivos** leen de ahí: cambiar los tokens repinta los 19 módulos de una vez.

- [ ] **Tipografía.** Hoy: `ui*` = Space Grotesk, `mono*` = JetBrains Mono, `display` =
      NeueEinstellung-Bold (`tokens.ts:180-185`).
      Debe ser: **display Plus Jakarta Sans Bold · cuerpo Inter 400/500 · nada más**.
      Incluye **borrar `assets/fonts/NeueEinstellung-Bold.otf`** y su registro en
      `app/_layout.tsx:104` — hoy está embebida en el bundle, que es justo el uso que la licencia
      no cubría.
- [ ] **Radios.** Hoy `sm 6 · md 12 · lg 20` (`tokens.ts:175`). Debe ser **14 / 22 / 26**.
- [ ] **Escala tipográfica.** Hoy `13 / 15 / 18 / 24` (`tokens.ts:176`). Debe ser la de
      `tokens/odobi.css`: **`caption 13 · body 16 · title 20 · display 28`**, más
      **`btn 19`** (label de confirmación — §2, piso no preferencia) y la **cifra del bloque a 40**.
- [ ] **Lienzo.** Hoy plano `#EFE6D2`. Debe ser el degradé del prototipo:
      **`linear-gradient(0deg, #F5E7DE 0%, crema 60%, crema 100%)`**.
      ⚠️ Verificado: **`#EFE6D2` no aparece en ningún archivo de `odobi-ui`.** No es un color del
      sistema — lo introdujo el código. (También está en `copiloto-web/themes.css`; web sigue
      fuera de alcance.)
- [ ] **Arena `#E8A088`.** No existe en mobile. Es el apoyo obligatorio dentro del bloque negro
      (terracota sobre negro no contrasta).
- [ ] **Eliminar «nocturno».** Toca `tokens.ts`, `skinsCatalogo.ts`, `PantallaSkins.tsx`,
      `relieve.ts`, `temaContraste.test.ts` y `PantallaSkins.test.tsx`.
- [ ] **Recalcular los contrastes desde los tokens nuevos**, no desde las cifras citadas en
      comentarios.

### Ola 2 — El bloque negro

No es un color: es un componente que **no existe** en mobile (`grep` de `bloque` en `src/` no
devuelve ninguna superficie). Hay que crearlo y decidir, en cada pantalla, cuál es *la* cifra.

- [ ] Componente de superficie de máximo contraste (equivalente de `Surface variant="bloque"`).
      ⚠️ **El rol es «máximo contraste contra el lienzo», no «negro»**: invierte polaridad en el
      tema oscuro (bloque crema, texto oscuro).
- [ ] Aplicarlo donde hay una cifra, **según el mapa de pantallas de Martin**:

      | Pantalla | La cifra |
      |---|---|
      | `gastos` | «Total del mes» (bajada del mapa) |
      | `ingresos` | Todo lo que entró |
      | `midia` | **«En caja»** + **«−18% vs julio»** + el trío Entró / Salió / Por cobrar.
        ⚠️ Y la línea que **admite estar incompleto** («faltan los cobros de hoy — Mercado Pago
        está caído»): regla dura del repo, el dato que falta se DICE, no se disfraza de cero |
      | `bi` | **«Saldo en caja»** + chip **«Al 19 de agosto»** + **Entró / Salió dentro del
        bloque** (confirmado por Martin, 17/09, contra `prototipo/index.html:1858-1863`).
        ⚠️ Martin lo llamó «el acumulado del mes»; **el rótulo de la pantalla es «Saldo en caja»**
        y es el que manda. No inventar un nombre nuevo al implementar |
      | `clientes` | **NINGUNA — no lleva bloque.** El dato es un conteo con su chip
        («los que entraron solos»), no una cifra de plata |
- [ ] **Cifra a 40px** (hoy `tipo.titulo` = 24px).
- [ ] **Sin borde**, elevación `0 4px 18px rgba(26,21,18,.07)` (hoy: borde `bd` + sombra cálida
      `#6E4B2C` 30%).
- [ ] Verificar y aplicar: **pill `#DE7250`** como acción de tarjeta · **wordmark en la card del
      stack** con sólo el avatar arriba · **isotipo fuera de los labels de sección**.
- [x] **Grosor del isotipo a `1.3`.** Mobile lo dibujaba a `1.7` (`Marca.tsx`). Hecho en
  `c2cb298`, y de paso quedó **plano**: un solo valor para toda la app, porque `logoScale`
  predivide el trazo por la escala. El par 1.6/1.3 del `LEEME` es del prototipo, que dibuja
  sin predividir.
      ✅ **Los trazos ya son los correctos**: `Marca.tsx` dibuja los cuatro arcos de Martin, path
      por path. No hay isotipo ajeno que reemplazar.

### Ola 3 — Funcionalidad que falta en mobile

- [ ] **Ingresos**: bloque «Cobraste este mes» + «Mes anterior» + aviso «Los cobros por Mercado
      Pago todavía no entran solos». `PantallaIngresos.tsx:100-227` no llama
      `obtenerResumenIngresos`, que ya existe y web sí consume.
- [ ] **Clientes**: bloque «Le vendiste a N clientes» + chip «N se agregaron solos este mes».
- [ ] **CAE + compartir** en la card del chat al emitir (hoy sólo «Factura emitida.»; la
      confirmación ya devuelve `cae`, `caeVto`, `nro`).
- [ ] **Componente Recibo** compartido (check con `aria-live`, título, líneas secundarias, acción)
      para factura, gasto, presupuesto y HITL genérico.
- [ ] **Rodillo de ejemplos del chat**: un ejemplo por vez, ~4 s, pausable (WCAG 2.2.2) y con
      `prefers-reduced-motion`.
- [ ] **Estados vacíos**: título + cuerpo + ilustración, y retiro progresivo de la explicación
      tras N días distintos.
- [ ] **ARCA**: reemplazar «AFIP» en todo texto visible — `PantallaAjustes.tsx:34`, el aviso de
      facturación no configurada, «portal de AFIP», «El PDF de AFIP…», «Ajustes → Facturación
      AFIP» en Mi negocio y en Detalle de presupuesto. Los comentarios y nombres de variables
      pueden quedarse.
- [ ] **`expo-web-browser`** para el flujo OAuth de conexiones (`PantallaApps.tsx:162,167`).

### Ola 4 — Armazón (destrabado por la decisión del 17/09)

- [ ] **Mi día como portada**: caja, Entró / Salió / Por cobrar, delta vs mes anterior. Los datos
      ya existen en `/inteligencia` y `/contabilidad/resumen`.
- [ ] **Mi día es el aterrizaje.** Hoy mobile monta escritorio + chat con Mi día como ruta modal
      (`PantallaPrincipal.tsx:149-167`).
- [ ] **6 tiles** en Funciones (hoy 9): fusionar Contabilidad + Inteligencia y **sacar Ajustes del
      grid** — ahora entra por el avatar.
- [ ] **El avatar es la única puerta a Ajustes.**
- [ ] **Mover el bloque «Acumulado del año — últimos 12 meses»** con el medidor del tope de
      monotributo de Contabilidad a Inteligencia. Existe y funciona: se mueve, no se construye.
- [ ] **Tablero**: chips de categoría (Todo / Cobros / ARCA / Presupuestos / Tuyas), banner de
      alerta crítica separado, contador «3 para hoy · 1 en curso · 1 crítico».
      *(El verbo contextual por tarjeta depende de Parte 2 · B-3.)*

### Ola 5 — Ajustes

- [ ] Ajustes queda con **«Cómo usar la app» · Feedback · Soporte técnico**.
- [ ] **«Cómo usar la app» es un chat** y **es** la guía de capacidades: se funden
      `PantallaComoHablarle` (guía de `GET /capacidades`) y `PantallaSoporte`/`useChatSoporte`
      (otro chat) en **uno solo**. Es una pantalla menos, no una más.
- [ ] El **selector de tono y forma** se queda en **Mi negocio** (ya está ahí).
- [ ] **Feedback**: sumar «¿Qué le cambiarías?» y la derivación a Soporte.
      *(«Lo pediste vos» depende de Parte 2 · B-9.)*

---

## Parte 2 · Pedido a David

### A · Decisiones de producto (único contenido de la reunión)

| | Qué hay que decidir | Por qué no puede esperar |
|---|---|---|
| **A-1** | **Plan y medición de acciones**: qué gasta una acción, cuál es el tope, cuánto sale | **No existe el concepto de «acción consumida» en ningún lado.** Sin ledger por tenant no hay plan, ni límites, ni cobro por uso. Y **la app ya afirma «no gasta acciones» en la pregunta libre: hoy afirma algo que no puede medir** |
| **A-2** | **Onboarding**: hilo de 2 permisos (Mercado Pago + Google) con el alcance dicho antes, y un primer insight al conectar | Hoy el alta cae al catálogo completo de conexiones |
| **A-3** | **CUIT bloqueado: ¿con salida o sin salida?** | Tiene implicancia fiscal. **El prototipo se contradice**: las reglas dicen «bloqueado, sin acción» y el render muestra «Necesito cambiarlo ›». El código siguió al render. **No se decide por UX** |
| **A-4** | **¿Cuántos frontends mantiene el proyecto?** | Ver §0 · Alcance. Es la pregunta más cara de la reunión |

### B · Contrato: lo que el backend tiene que emitir o garantizar

| | Qué | Por qué | Evidencia |
|---|---|---|---|
| **B-1** | **Clave de idempotencia en `crear`** de presupuestos | `presupuesto_store.py:213-244` inserta siempre con `max(numero)+1`. **Ninguna corrección de frontend cierra D-1** | Alta |
| **B-2** | **Gate estructurado `requiere_conexion`** con servicio y alcance | Hoy el dispatcher responde texto: «Andá a Conexiones, conectalo y volvé a pedírmelo». Sin gate no hay consentimiento en contexto | `dispatcher_emprendedor.py:279-283` |
| **B-3** | **Verbo contextual y criticidad por regla** del detector | El frontend hoy deriva la categoría a mano y muestra Empezar/Terminé/Borrar en vez de «Reclamar el pago» / «Renovarlo» | `packages/core/src/api/miDia.ts:17` |
| **B-4** | **Acciones sugeridas** en la respuesta de las tools de presupuesto | Faltan «¿Te armo la factura?», el chip «Armá la factura» y «Mandalo por mail» | `tool_catalog.py:367,1201-1259` |
| **B-5** | **Contexto de función en el dispatcher** + destino de la propuesta | Para dictar desde Gastos/Ingresos/Presupuestos/Clientes y que la card aterrice **ahí**, no en el hilo. Es la brecha funcional más grande sin bloqueo | — |
| **B-6** | **Duración del audio** en el mensaje | Para el chip de origen «Por voz · duración» | — |
| **B-7** | **Teléfono y email** en el perfil de negocio | Faltan columnas + API | `packages/core/src/api/perfilNegocio.ts:40-60` |
| **B-8** | **Cambiar mail y contraseña** (GoTrue, con reautenticación) | Hoy no se puede. Es piso, no funcionalidad | `packages/core/src/api/auth.ts` sólo expone login |
| **B-9** | **Agregado de cartera del tenant** en `/clientes` y **listado de feedback propio** con estado escuchado | Para «Le vendiste a N» sin subcontar, y para «Lo pediste vos» | — |

⚠️ **B-5 cambia el contrato del dispatcher.** Contexto **opcional con fallback a la ruta actual**, y
tests en el VPS antes de tocar frontend: si se rompe, se rompe el chat entero.

---

## Restricciones

- **Stack:** Expo / React Native, New Architecture. `packages/core` es lo único compartido.
- **`temaSinHex.test.ts`**: ningún hex fuera de `tokens.ts`. Es una ventaja — no se relaja.
- **Contrato del repo** `2026-09-16` Parte 2: hay superficies congeladas hasta la reunión con
  Martin. **Martin puede levantar ese congelamiento**; hasta entonces, los PRs declaran que no las
  tocan.
- 🔴 **Splash y entrada son INTOCABLES** (Martin, 17/09). Fuera de esta spec y fuera de discusión.
  Las decisiones del 18/08 (Entrada con el isotipo) y del 30/08 (Rive derogado → porte a
  Reanimated, `specs/splash-port-reanimated.md`) **siguen vigentes**. El congelamiento de la
  Parte 2 del contrato **se mantiene**: nadie toca esas superficies.
- **Inter** se baja por `@expo-google-fonts/inter`, igual que mobile ya carga sus otras familias.
  **Plus Jakarta Sans Bold** sale de `odobi-ui/assets/fonts/`.

## Casos borde

- **El guard de D-1 sin la idempotencia de B-1** deja vivo el doble toque y el reintento de red.
  No se declara cerrado hasta tener las dos mitades.
- **Presupuestos duplicados ya existentes** en datos reales: consultar con claims correctos (no a
  ciegas bajo RLS FORCE) antes y después de B-1.
- **El bloque negro en tema oscuro** invierte polaridad. Si se implementa como «negro» y no como
  «máximo contraste», el tema oscuro queda ilegible.
- **Terracota dentro del bloque negro**: `#DE7250` sobre `#1A1512` no contrasta. Dentro del bloque
  el apoyo es **arena `#E8A088`**. No es una licencia: es la razón por la que la arena existe.
- **Sacar «nocturno»** invalida los tests de contraste existentes. Se recalculan desde los tokens.
- **`prefers-reduced-motion`** en el rodillo de ejemplos y en el retiro progresivo del vacío.

## Definición de terminado

**Por ítem:**
- [ ] La regla de `CLAUDE.md` que lo motiva se cumple, citada por número de línea en el PR.
- [ ] Tests: unidad/componente de lo nuevo; integración en el VPS si toca contrato; test
      adversarial si toca autorización o aislamiento de tenant.
- [ ] `scripts/gate.sh` verde con recibo en `.ci-recibos/<sha>.json`.
- [ ] Evidencia en device (dev-client, Metro local) — no alcanza el análisis estático.
- [ ] Contraste verificado **desde los tokens**, nunca desde cifras citadas.

**Por ola:** todos sus ítems cumplen lo anterior y se republica el estado.

**Del frente completo:**
- [ ] `apps/mobile` no tiene ninguna desviación abierta contra `odobi-ui/CLAUDE.md`.
- [ ] Los tres defectos cerrados, D-1 con su mitad de backend.
- [ ] Las cuatro decisiones de la reunión (A-1 a A-4) con acta escrita, dueño y fecha.
- [ ] Ninguna afirmación de la app sin respaldo — en particular «no gasta acciones».

---

## Anexo · Qué se verificó y qué no

**Verificado en código** (`a963fd1`): tipografías de mobile · radios · lienzo · cantidad de temas ·
ausencia de arena · ausencia del bloque negro · tamaño de la cifra · identidad byte a byte del
`CLAUDE.md` del repo con el de Martin · acento ya migrado a `#DE7250`/`#B04A2E` en ambas apps ·
strings visibles con «AFIP» · el editor de tono ya en Mi negocio · el despliegue del PWA.

**No verificado, se verifica al ejecutar:** la pill de acción de tarjeta · la posición del wordmark
y del isotipo · si el isotipo de David está en el código y dónde · el estado real del porte del
splash a Reanimated · todo lo que dependa de render en device.

**Corrección a la auditoría del 16/09:** dice que el acento del código es `#C2452E`. Ya no:
`themes.css` usa `#DE7250`/`#B04A2E` y cita el `CLAUDE.md` §2 como fuente. La nota de la línea 805
del `CLAUDE.md` describe el repo «al 13/08» y quedó vieja en ese punto.
