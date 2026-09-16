# Reporte de hallazgos — Prototipo Odobi vs. código real (web + mobile)

> **Base para el plan de implementación de coherencia prototipo ↔ código.**

| Campo | Valor |
|---|---|
| Fecha | 2026-09-16 |
| Alcance | 48 pantallas del mapa `Prototipo frontend/odobi-ui/mapa-pantallas/` × 2 plataformas (`apps/copiloto-web`, `apps/mobile`) + dependencias de backend (`apps/copiloto`, `packages/core`) |
| Base de código | `origin/main` @ `ac13f181` (incluye #507, #508, #509) |
| Documento fuente | [`2026-09-16-mapa-de-pantallas-vs-codigo-web-y-mobile.md`](2026-09-16-mapa-de-pantallas-vs-codigo-web-y-mobile.md) (tabla de veredictos pantalla por pantalla) |
| Antecedentes | [`2026-09-08-diff-pantalla-por-pantalla-prototipo-vs-app.md`](2026-09-08-diff-pantalla-por-pantalla-prototipo-vs-app.md) y su par `-mobile.md` |
| Restricción vigente | Contrato `coordinacion/abierto/2026-09-16_contrato_planificacion-a-frontend_seis-trabajos-sin-bloqueo-y-lo-que-NO-se-toca-hasta-la-reunion.md` (Parte 1: 6 trabajos liberados · Parte 2: superficies congeladas hasta la reunión con Martín) |
| Estado | Hallazgos verificados contra código. **No** es el plan: es su insumo. |

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Método, evidencia y límites](#2-método-evidencia-y-límites)
3. [Registro de decisiones abiertas (bloqueantes)](#3-registro-de-decisiones-abiertas-bloqueantes)
4. [Defectos de severidad alta (no son brechas de diseño)](#4-defectos-de-severidad-alta-no-son-brechas-de-diseño)
5. [Hallazgos por dominio](#5-hallazgos-por-dominio)
6. [Temas transversales](#6-temas-transversales)
7. [Divergencias web ↔ mobile](#7-divergencias-web--mobile)
8. [Inconsistencias internas del prototipo](#8-inconsistencias-internas-del-prototipo)
9. [Correcciones a auditorías previas](#9-correcciones-a-auditorías-previas)
10. [Backlog semilla por olas](#10-backlog-semilla-por-olas)
11. [Criterios de aceptación y Definición de Terminado](#11-criterios-de-aceptación-y-definición-de-terminado)
12. [Riesgos](#12-riesgos)
13. [Anexo A — Matriz completa de 48 pantallas](#anexo-a--matriz-completa-de-48-pantallas)

---

## 1. Resumen ejecutivo

### 1.1 Cifras

| Plataforma | ✅ Implementado | 🟡 Parcial | 🔴 Ausente | Total |
|---|---|---|---|---|
| Web | 14 (29 %) | 23 (48 %) | 11 (23 %) | 48 |
| Mobile | 14 (29 %) | 24 (50 %) | 10 (21 %) | 48 |

- **10 pantallas ausentes en ambas plataformas:** `splash`, `entrada`, `reveal`, `onb-promesa`, `onb-cumplida`, `consent`, `caida`, `card`, `limite`, `vacio-visto`.
- **7 pantallas con veredicto distinto entre web y mobile:** `bloqueado`, `bi-refresh`, `feedback`, `hitl`, `ingresos`, `clientes`, `apps`.
- **"Implementado" no equivale a "coherente con el prototipo":** 4 de las 14 implementadas en mobile arrastran un defecto o una desviación que el plan tiene que cubrir igual (ver §4 y §8).

### 1.2 Las cinco conclusiones que ordenan el plan

1. **El armazón no coincide.** El prototipo aterriza en *Mi día* (capa media: escritorio detrás · Mi día · chat adelante). Web aterriza en el chat (`apps/copiloto-web/src/shell/AppShell.tsx:30`, `DEFAULT_TAB = 'chat'`) y mobile monta escritorio + chat con Mi día como ruta modal (`apps/mobile/src/shell/PantallaPrincipal.tsx:149-167`). **Es la Decisión A, abierta** (Martín + David). Mientras no se cierre, cualquier trabajo sobre Mi día como portada, `caida`, `vacio-visto` y la navegación de Ajustes por avatar es retrabajo probable.
2. **Lo más barato y de mayor impacto es paridad y FE puro.** ~40 % de las brechas se cierran sin backend ni decisión: bloque resumen de Ingresos y Clientes en mobile, HITL genérico rico en mobile, Pausar/Reanudar en web, descripción de apps en web, pantalla Feedback en web, rodillo de ejemplos del chat, deslizar-para-cancelar en voz.
3. **La voz no vive en las funciones.** El prototipo dicta desde Gastos/Ingresos/Presupuestos/Clientes y la card aterriza ahí mismo (`card`). Hoy el micrófono existe sólo en el composer del chat y en Soporte. Es la brecha funcional más grande sin bloqueo de decisión.
4. **El "recibo en el hilo" está a medias.** El principio "el comprobante queda en la conversación que lo produjo" se cumple en texto, pero sin componente de recibo (`recibo`) ni CAE/compartir al emitir desde el chat (`fact-cae`, trabajo 2 del contrato Parte 1).
5. **Hay tres frentes de backend nuevo reales:** plan/consumo de acciones (`limite`, `plan`), onboarding con primer insight (`onb-promesa`, `onb-cumplida`) y señal de conexión caída (`caida`). Ninguno se debería empezar sin su decisión de producto (§3).

---

## 2. Método, evidencia y límites

### 2.1 Método

1. **Inventario del prototipo.** Las 48 claves `?ver=` del mapa (`mapa-pantallas/index.html`) con título, bajada y nota del mapa como criterio esencial de cada pantalla.
2. **Lectura de código por pantalla** en worktree limpio desde `origin/main` (el checkout compartido está atrasado y no se usó como fuente).
3. **Veredicto por plataforma** — ✅ el mecanismo esencial de la bajada/nota está; 🟡 está el núcleo pero falta al menos un elemento que el mapa marca esencial; 🔴 el mecanismo no existe.
4. **Clasificación de dependencia** de cada brecha:

| Clase | Significado | Implicancia para el plan |
|---|---|---|
| `FE` | Sólo frontend; el dato o endpoint ya existe | Arrancable ya |
| `FE+CONTRATO` | Frontend + ajuste chico de contrato (campo nuevo en respuesta existente, flag, texto del dispatcher) | Coordinar con backend, esfuerzo bajo |
| `BACKEND` | Requiere endpoint, tabla, workflow o integración nueva | Diseño + ADR si aplica |
| `DECISIÓN` | Bloqueado por decisión abierta de producto/diseño (§3) | No empezar hasta cerrar |

5. **Verificación adversarial** de los 8 hallazgos de mayor peso por un agente independiente: 8/8 confirmados, con dos correcciones de alcance ya incorporadas y un defecto real destapado (§4.1).
6. **Contraste manual** de afirmaciones dudosas del barrido automático — dos fueron refutadas y se corrigen en §9.

### 2.2 Evidencia

Cada hallazgo cita `ruta:línea` verificable en `origin/main` @ `ac13f181`. La tabla completa con evidencia de ambas plataformas está en el documento fuente; este reporte la agrega por dominio y le suma clasificación, severidad y ola.

### 2.3 Límites (lo que este reporte NO afirma)

- **Análisis estático.** No se capturó cada pantalla en device. Las diferencias puramente visuales (espaciados, peso tipográfico, paleta exacta) quedan fuera; se marcan `[NO VERIFICADO EN DEVICE]` donde el veredicto depende de lo renderizado.
- **Comportamiento del LLM** (`fact-voz`, `pres-voz`: "pregunta un dato por vez"; textos de Soporte como "4 h hábiles") depende del prompt en runtime y no se puede afirmar por lectura de código.
- **El prototipo no es spec cerrada.** Varias pantallas son "visión" declarada (`limite`, `plan`) y hay decisiones abiertas que pueden cambiar el objetivo (§3). Coherencia total exige cerrar primero esas decisiones.

---

## 3. Registro de decisiones abiertas (bloqueantes)

Fuentes: `Prototipo frontend/odobi-ui/CLAUDE.md` §11-12, `mockups/10-arranque/DECISIONES.md`, `mockups/13-ajustes/DECISIONES.md`, contrato 2026-09-16 Parte 2.

| ID | Decisión | Estado | Dueños | Pantallas bloqueadas | Costo de no decidir |
|---|---|---|---|---|---|
| **DA-1** | **Armazón: capas vs pestañas** — qué va al frente (Mi día o chat), si hay tabbar, avatar como única puerta a Ajustes | Decisión A en revisión; modelo de capas pendiente | Martín + David | `/`, `esc`, `chat`, `caida`, `vacio`, `vacio-visto`, `ajustes` | Cualquier portada de Mi día construida hoy se reubica después |
| **DA-2** | **Fusión Contabilidad + Inteligencia** (7 → 6 funciones) | Cerrada en el prototipo el 20/08; **no aplicada en código** | Operador + David | `esc`, `bi`, `preg`, `bi-refresh` | El grid queda en 9 tiles; el acumulado 12 meses vive en Contabilidad y el prototipo lo pide en Inteligencia |
| **DA-3** | **Gramática visual: bloque negro (web) vs glass (mobile)** | Divergencia documentada, sin resolver | David | `gastos`, `ingresos`, `clientes`, `bi`, `/` | Cada pantalla nueva duplica la decisión por plataforma |
| **DA-4** | **Tokens y acento** (`#C2452E` vs `#DE7250`/`#B04A2E`), contrastes firmados, tipografía (licencia) | Abierta | David + Martín | Todas (visual), `apar` | Retoque visual global posterior |
| **DA-5** | **Temas: 2 exactos + "Como el teléfono"** vs los 3 implementados (claro/oscuro/nocturno) | Prototipo pide 2; código tiene 3 | David | `apar` | Borrar o mantener "nocturno" cambia tokens y tests de contraste |
| **DA-6** | **Onboarding**: hilo de 2 permisos + primer insight | Visión; sin diseño de backend | Operador + Martín | `onb-promesa`, `onb-cumplida`, `consent` | Hoy el alta cae al catálogo completo de conexiones |
| **DA-7** | **Plan y límites de acciones** (qué gasta, tope, precio) | Visión (`13-ajustes/DECISIONES.md` §4, 19/08) | Operador | `limite`, `plan` | Sin modelo de medición no hay nada que mostrar |
| **DA-8** | **Splash y animación de entrada** (4 formas → O, 6,8 s; isotipo dibujándose; reveal con pronunciación) | Abierta en la Parte 2 del contrato | David + Martín | `splash`, `entrada`, `reveal` | Ninguno funcional; es marca |
| **DA-9** | **"Cómo hablarle"**: editor de tono (prototipo) vs guía de capacidades (código) | Divergencia de producto no registrada como decisión | Operador + David | `hablar`, `negocio`, `comousar` | Dos pantallas con el mismo nombre y distinto propósito |
| **DA-10** | **CUIT bloqueado: ¿con o sin salida?** | Contradicción dentro del prototipo (§8) | Operador | `afip` | El código ya ofrece "Cambiar"; el contrato Parte 1 trabajo 6 pide que el backend rechace CUIT no vinculado |
| **DA-11** | **AFIP → ARCA** en todo texto visible | Cerrada en el prototipo (20/08) | — (aplicar) | `afip`, `factura`, textos de chat | Inconsistencia de nombre ante el usuario |

> **Recomendación:** llevar DA-1, DA-2, DA-3 y DA-10 a la reunión con Martín como primer bloque. Son las que más pantallas destraban (DA-1 sola bloquea 7).

---

## 4. Defectos de severidad alta (no son brechas de diseño)

Estos ítems son **defectos**: rompen una garantía que el sistema ya declara. Van antes que cualquier trabajo de coherencia visual.

### 4.1 D-1 — Presupuesto duplicado en mobile al recargar

| Campo | Detalle |
|---|---|
| Severidad | **Alta** — genera datos duplicados del usuario (presupuestos con numeración correlativa) |
| Plataforma | Mobile (web ya corregido) |
| Evidencia | `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:32-45` — estado `'editando'` inicial por `useState`, sin guard cross-reload; el docstring del archivo (líneas 17-27) admite el gap. Web lo resolvió: `apps/copiloto-web/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:22-34` |
| Causa raíz | Doble: (a) la card no recuerda que ya guardó tras un remount; (b) el backend no es idempotente: `apps/copiloto/presupuesto_store.py:213-244` (`crear`) inserta siempre con `max(numero)+1`, sin clave de idempotencia |
| Escenario | Usuario guarda el presupuesto → la app se recarga (Fast Refresh, reinicio, reapertura del hilo) → la card vuelve a `editando` → toca Guardar → segundo presupuesto con otro número |
| Remedio de raíz | Clave de idempotencia derivada del mensaje/propuesta en `crear` (backend) **y** portar el guard de web a mobile. Sólo el guard FE deja abierto el caso de doble toque o reintento de red |
| Clase | `FE+CONTRATO` (idempotencia en backend) |
| Criterio de cierre | Test de integración backend: dos `crear` con la misma clave → un solo registro. Test mobile: remount tras guardar → estado terminal. Evidencia en device |

### 4.2 D-2 — Mobile: soltar el micrófono sin fijar siempre envía

| Campo | Detalle |
|---|---|
| Severidad | **Media-alta** — el usuario no tiene forma de arrepentirse de un audio no fijado |
| Evidencia | `apps/mobile/src/modules/chat/ChatView.tsx:155` (release ⇒ envío); `apps/mobile/src/modules/chat/BotonVoz.tsx:193-207` (`Gesture.Pan` lee sólo `translationY`) |
| Contraste | Web descarta con un release < 350 ms (`apps/copiloto-web/src/modules/chat/MicButton.tsx:212-214`) |
| Spec | Deslizar a la izquierda cancela: `Prototipo frontend/odobi-ui/mockups/03-home-conversacional/DECISIONES.md:95,108` |
| Clase | `FE` (ambas plataformas — tampoco web implementa el eje horizontal, `MicButton.tsx:194`) |
| Criterio de cierre | Gesto horizontal < umbral cancela en web y mobile, con feedback visual; test de gesto con `adb input motionevent` en device (no `input tap`) |

### 4.3 D-3 — HITL genérico de mobile no avisa irreversibilidad

| Campo | Detalle |
|---|---|
| Severidad | **Media** — una acción irreversible (p. ej. publicar, enviar correo) se confirma sin aviso de "no se puede deshacer" |
| Evidencia | `apps/mobile/src/modules/chat/ListaMensajes.tsx:38-90` (`TarjetaConfirmacion`: sólo `gate.markdown` + Confirmar/Cancelar) vs `apps/copiloto-web/src/modules/chat/HitlCard.tsx:41-125` (servicio, PARA, MONTO, badge de riesgo, aviso irreversible) |
| Clase | `FE` — el payload del gate ya trae `service`/`label`/riesgo (lo consume web) |
| Criterio de cierre | Paridad de campos con web; test que renderiza un gate irreversible y exige el aviso |

---

## 5. Hallazgos por dominio

Formato de cada fila: **ID · pantalla (`?ver=`) · veredicto web / mobile · brecha · evidencia · clase · severidad**.
Severidad: **A** rompe principio del producto o flujo principal · **M** falta un elemento esencial marcado por el mapa · **B** detalle o pulido.

### 5.1 Arranque y marca

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-01 | Splash (`splash`) | 🔴 / 🔴 | No existe la animación de 4 formas que crecen y se contraen hacia la O (6,8 s). Web muestra texto plano; mobile, el splash nativo de Expo | Web `App.tsx:39-46`; mobile `app.json:30` (sólo plugin `expo-splash-screen`) | `DECISIÓN` (DA-8) | B |
| H-02 | Entrada (`entrada`) | 🔴 / 🔴 | Falta el isotipo "dibujándose" en arranques 2..n, distinto del primer ingreso. Ambas usan el mismo placeholder para todo arranque | Web `App.tsx:39-46`; mobile `app/_layout.tsx` (sólo `ActivityIndicator`); referencia `prototipo/index.html:2348-2355` | `DECISIÓN` (DA-8) | B |
| H-03 | El reveal (`reveal`) | 🔴 / 🔴 | Falta el lockup completo con "se dice o-DO-bi" y botón que reproduce la pronunciación | Sin resultados de `lockup`, `o-DO-bi`, `pronunci` en ambas `src/` | `DECISIÓN` (DA-8) | B |

### 5.2 Armazón, Mi día y tablero

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-04 | Mi día (`/`) | 🟡 / 🟡 | (a) Falta la portada de negocio: caja, entró/salió/por cobrar, delta vs mes. (b) No es la pantalla de aterrizaje en ninguna plataforma | Web `MidiaScreen.tsx:50-214`, `AppShell.tsx:30`; mobile `PantallaMiDia.tsx:1-60`, `PantallaPrincipal.tsx:149-167`, `app/midia.tsx` | (a) `FE` — los datos existen en `/inteligencia` y `/contabilidad/resumen`; (b) `DECISIÓN` (DA-1) | A |
| H-05 | Funciones (`esc`) | ✅ / ✅ | 9 tiles en vez de 6 (grilla 3×2 por frecuencia); Contabilidad e Inteligencia separadas; `ajustes` y `midia` como tiles | Web `EscritorioScreen.tsx:48-58,91-149`; mobile `EscritorioFunciones.tsx:1-80` (docstring 12-19) | `DECISIÓN` (DA-1, DA-2) | M |
| H-06 | Tablero (`tablero`) | 🟡 / 🟡 | Faltan: chips de categoría (Todo/Cobros/ARCA/Presupuestos/Tuyas), banner de alerta crítica separado, contador "3 para hoy · 1 en curso · 1 crítico", verbo contextual por tarjeta ("Reclamar el pago", "Renovarlo") en vez de Empezar/Terminé/Borrar, nota final de qué se cierra solo | Web `MidiaScreen.tsx:36-48,110-132,197-208`; mobile `PantallaMiDia.tsx:75-120,312-406` | `FE+CONTRATO` — la categoría se deriva de `regla` (`packages/core/src/api/miDia.ts:17`), pero el verbo contextual y la criticidad necesitan un campo explícito por regla en el detector | M |
| H-07 | Agenda (`agenda`) | 🟡 / 🟡 | No hay pantalla Agenda propia: sólo un panel de sólo-lectura con eventos de HOY dentro de Mi día. Faltan Mañana, Vencen esta semana, Sin hora, franja horaria y "Nuevo evento" | Web `MidiaScreen.tsx:142,216-250`; mobile `PantallaMiDia.tsx:204,259-310`; backend `apps/copiloto/mi_dia_web.py:44` (`_rango_hoy`) | `BACKEND` (rango de días + vencimientos + escritura de evento vía Composio; CAL1 §3 fijó sólo-hoy) | M |
| H-08 | Detalle (`detalle`) | ✅ / ✅ | Sin brecha: el prototipo reemplazó el sheet por expandir en el lugar, y así está | Web `MidiaScreen.tsx:203,272-301`; mobile `PantallaMiDia.tsx:245,312-406`; `prototipo/index.html:3311-3315` | — | — |
| H-09 | Mi día sin avisos (`vacio`) | 🟡 / 🟡 | Falta la ilustración y la estructura título + cuerpo ("Nada urgente por hoy" + texto) | Web `MidiaScreen.tsx:187-193`; mobile `PantallaMiDia.tsx:227-234` | `FE` | B |
| H-10 | Calma, ya conocida (`vacio-visto`) | 🔴 / 🔴 | No existe el retiro progresivo de la explicación tras N días distintos (prototipo: `localStorage` `odobi-calma-dias`) | Referencia `prototipo/index.html:3481-3557`; sin persistencia en `modules/midia/` de ninguna app | `FE` (almacenamiento local por usuario; en mobile vía storage del dispositivo) | B |
| H-11 | Conexión caída (`caida`) | 🔴 / 🔴 | No existe la portada que admite estar incompleta (ocultar el delta de ingresos) ni la tarjeta de alerta en el detector cuando cae una conexión. El badge "Reconectar" de Conexiones no está cableado a ninguna señal | Web `ServiceCard.tsx:6,22-36,77` ("HOY nada en el catálogo lo dispara"); mobile `PantallaPrincipal.tsx:52-80` | `BACKEND` (señal de salud por conexión + regla del detector) + `DECISIÓN` (DA-1: requiere portada) | M |

### 5.3 Chat y voz

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-12 | Chat (`chat`) | 🟡 / 🟡 | Falta el rodillo vertical de un ejemplo por vez (~4 s, WCAG 2.2.2 pausable, `prefers-reduced-motion`). Hoy es un párrafo fijo. Además el chat es hoy el aterrizaje (DA-1) | Web `ChatScreen.tsx:8-9`, `MessageList.tsx:159`; mobile `ListaMensajes.tsx:29,236-247` | `FE` (rodillo); `DECISIÓN` (posición) | M |
| H-13 | Separadores de fecha | — | Un solo hilo con divisores de día (contrato Parte 1, trabajo 3) | Web `MessageList.tsx:161-163` | `FE` (liberado) | M |
| H-14 | Grabando (`grabando`) | 🟡 / 🟡 | Falta "deslizar a la izquierda cancela" en ambas. Ver D-2 | Web `MicButton.tsx:183-224`; mobile `BotonVoz.tsx:193-207`, `ChatView.tsx:155,188-207` | `FE` | A (mobile) / M (web) |
| H-15 | Audio bloqueado (`bloqueado`) | 🟡 / ✅ | Web no tiene Pausar/Reanudar y su "Cancelar" mezcla lo que el prototipo llama Eliminar. Mobile cubre los tres controles `[NO VERIFICADO EN DEVICE: ícono de papelera]` | Web `RecordingOverlay.tsx:41-62`; mobile `ControlesFlotantes.tsx:30-44`; spec `03-home-conversacional/DECISIONES.md:95,108,133` | `FE` | M |
| H-16 | La card en la función (`card`) | 🔴 / 🔴 | **No se puede dictar desde Gastos/Ingresos/Presupuestos/Clientes** para que la card aterrice ahí. El mic vive sólo en el chat y en Soporte. Hallazgo ya marcado el 08/09, sin cambios | Web `GastosScreen.tsx:1-9` (sin `MicButton`); mobile `modules/gastos` sin `BotonVoz`/`useVozComando`; `TarjetaGastoPropuesto` sólo en `modules/chat` | `FE+CONTRATO` — reusar `useVozComando`/`MicButton` y enviar el contexto de función al dispatcher para que la propuesta vuelva a la pantalla y no al hilo | A |
| H-17 | Lo dictado, en el chat (`vozchat`) | 🟡 / 🟡 | Falta el chip de origen "Por voz · duración" en la card. Mientras no exista H-16, todo dictado pasa por esta ruta | Web `TarjetaGastoPropuesto.tsx:76-105`; mobile `TarjetaGastoPropuesto.tsx:55-88` | `FE+CONTRATO` (duración del audio en el mensaje) | B |
| H-18 | Origen de la propuesta | — | El formulario debe reflejar el origen real (voz/foto/manual) de la propuesta (contrato Parte 1, trabajo 4) | `FormularioGasto.tsx:39,64` | `FE` (liberado) | M |
| H-19 | Pregunta libre (`preg`) | 🟡 / 🟡 | Funciona sin gate, pero en un mini-chat sincrónico propio de Inteligencia, no en el chat principal durable con divisores de día. "No gasta acciones" no es verificable: no hay medición | Web `inteligencia/ChatInteligencia.tsx:32-169`; mobile `inteligencia/ChatInteligencia.tsx` | `DECISIÓN` (DA-2) + `BACKEND` (DA-7 para el medidor) | M |
| H-20 | Confirmación (`hitl`) | ✅ / 🟡 | Ver D-3 | Web `HitlCard.tsx:41-125`; mobile `ListaMensajes.tsx:38-90` | `FE` | M |
| H-21 | El comprobante (`recibo`) | 🟡 / 🟡 | No existe el componente de recibo del prototipo (`REC()`): ícono de check con `aria-live`, título + líneas secundarias, link accionable (Ver/Detalle/Copiar). Hoy es una línea de texto | Web `TarjetaFacturaPropuesta.tsx:59-64`, `MessageList.tsx:252-263`; mobile `TarjetaPropuestaShell.tsx:69-90` | `FE` (componente compartido para factura, gasto, presupuesto, HITL genérico) | M |

### 5.4 Facturación y presupuestos por conversación

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-22 | Facturar por voz (`fact-voz`) | ✅ / ✅ | Sin brecha de UI. `[NO VERIFICADO]` que el agente pregunte un dato por vez | Web `TarjetaFacturaPropuesta.tsx:57,87-119`; mobile `:51,84-91`; backend `afip_rules.py`, `afip_factura_workflow.py` | — (prueba e2e con voz) | B |
| H-23 | Segundo HITL — emitir (`fact-hitl`) | ✅ / ✅ | La card del chat no repite el aviso de irreversibilidad ("se anula con nota de crédito"); sólo existe en el paso Resumen del flujo manual | Web `TarjetaFacturaPropuesta.tsx:92-146`; mobile `:84-148` | `FE` | M |
| H-24 | Emitida — el CAE (`fact-cae`) | 🟡 / 🟡 | Al emitir desde el chat sólo aparece "Factura emitida.": sin CAE, sin PDF, sin Guardar/Mail/WhatsApp. Existen en `TarjetaComprobante` de la pantalla Facturación (contrato Parte 1, trabajo 2) | Web chat `TarjetaFacturaPropuesta.tsx:59-66` vs `facturacion/TarjetaComprobante.tsx:82,110-139`; mobile chat `TarjetaFacturaPropuesta.tsx:54` vs `facturacion/TarjetaComprobante.tsx` | `FE` — la confirmación ya devuelve `cae`, `caeVto`, `nro` (`packages/core/src/api/afip.test.ts:462-476`) | A |
| H-25 | Presupuesto por voz (`pres-voz`) | ✅ / ✅ | Sin brecha de UI. `[NO VERIFICADO]` la secuencia de ítems turno por turno | Web `TarjetaPresupuestoPropuesto.tsx:91-96` | — | B |
| H-26 | La tarjeta editable (`pres-hitl`) | ✅ / ✅ | Mobile implementado pero con D-1 (duplicados) | Ver §4.1 | `FE+CONTRATO` | A |
| H-27 | El ciclo (`pres-ciclo`) | 🟡 / 🟡 | Aprobar por voz funciona (`marcar_presupuesto`), pero faltan la sugerencia "¿Te armo la factura?" + chip "Armá la factura", y el chip "Mandalo por mail" / link al Doc tras guardar. Tampoco hay botón Aprobar en pantalla (decisión no contrastada con el prototipo) | Backend `tool_catalog.py:367,1201-1259`; web `presupuestos/DetallePresupuesto.tsx:28`; mobile `TarjetaPresupuestoPropuesto.tsx:39-45` | `FE+CONTRATO` (acciones sugeridas en la respuesta de la tool) | M |

### 5.5 Onboarding, permisos y plan

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-28 | La promesa (`onb-promesa`) | 🔴 / 🔴 | Falta el hilo HITL de "dos minutos" que pide 2 permisos (Mercado Pago + Google) con el alcance dicho antes. Tras el alta, web lleva al catálogo completo | Web `App.tsx:31-35,58` → `ConnectionsScreen.tsx:59-121`; mobile sin paso entre login y `PantallaPrincipal` | `DECISIÓN` (DA-6) → `BACKEND` | M |
| H-29 | La promesa cumplida (`onb-cumplida`) | 🔴 / 🔴 | Falta el recibo con el primer dato de negocio no sabido ("$147.000 facturados sin cobrar"). No hay disparador post-conexión | Sin resultados en ambas apps ni backend | `BACKEND` (workflow de primer insight tras conectar) + DA-6 | M |
| H-30 | Just-in-time consent (`consent`) | 🔴 / 🔴 | Falta el sheet en contexto (alcance por permiso, Conectar/Ahora no, hilo visible detrás). Hoy el dispatcher responde texto: "Andá a Conexiones, conectalo y volvé a pedírmelo". Ya marcado el 08/09 | `apps/copiloto/dispatcher_emprendedor.py:279-283` | `FE+CONTRATO` (el dispatcher emite un gate estructurado `requiere_conexion` con servicio y alcance) | A |
| H-31 | El límite (`limite`) | 🔴 / 🔴 | No hay campo de plan/consumo en `/me` ni mensaje de tope de acciones | Web `account/AccountScreen.tsx:106-115` (TODO backend); mobile `app/ajustes-mi-plan.tsx:1-22` | `DECISIÓN` (DA-7) → `BACKEND` | M |
| H-32 | Mi plan (`plan`) | 🟡 / 🟡 | Placeholder honesto (`PantallaAndamiaje`). Faltan medidor "64 de 200 acciones", explicación Gasta/No gasta y aviso de tope | Web `ajustes/AjustesScreen.tsx:63-69`; mobile `app/ajustes-mi-plan.tsx:13-22`; spec `prototipo/index.html:2265-2271` | `DECISIÓN` (DA-7) → `BACKEND` | M |

### 5.6 Funciones de negocio

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-33 | Gastos (`gastos`) | 🟡 / 🟡 | Falta el mic dentro de la función y la foto como disparador directo (ver H-16). Mobile usa `Tile` glass en vez de bloque negro | Web `GastosScreen.tsx:82-180`, `ResumenMes.tsx:17-54`; mobile `PantallaGastos.tsx:130-221`, `ResumenMes.tsx:26-81` | `FE+CONTRATO` (H-16) + `DECISIÓN` (DA-3) | M |
| H-34 | Ingresos (`ingresos`) | ✅ / 🟡 | Mobile no tiene el resumen "Cobraste este mes" + "Mes anterior" ni el aviso "Los cobros por MercadoPago todavía no entran solos". Mic embebido ausente en ambas | Web `IngresosScreen.tsx:92-196`, `ResumenIngresos.tsx:20-36`; mobile `PantallaIngresos.tsx:100-227,145-152` (no llama `obtenerResumenIngresos`) | `FE` (endpoint ya consumido por web vía `@copiloto/core`) | M |
| H-35 | Facturación (`factura`) | ✅ / ✅ | Sin brecha funcional. `[NO VERIFICADO EN DEVICE]` paridad de chips de estado | Web `ResumenFacturacion.tsx`, `SeccionMisComprobantes.tsx`, `SeccionMeDeben.tsx`; mobile `PantallaFacturacion.tsx` | — | B |
| H-36 | Presupuestos (`presu`) | ✅ / ✅ | Sin brecha funcional | Web `PresupuestosScreen.tsx:64-82`; mobile `modules/presupuestos/` | — | — |
| H-37 | Inteligencia de Negocio (`bi`) | 🟡 / 🟡 | El bloque "Acumulado del año — últimos 12 meses" con medidor del tope de monotributo **existe, pero en Contabilidad**, no en Inteligencia como pide el prototipo | Web `contabilidad/ContabilidadScreen.tsx:225-245`; mobile `contabilidad/PantallaContabilidad.tsx:188-210`; comentario de gap en web `InteligenciaScreen.tsx:278-283` | `DECISIÓN` (DA-2) — se resuelve moviendo, no construyendo | M |
| H-38 | Sin ventas todavía (`bi-vacio`) | ✅ / ✅ | Sin brecha | Web `InteligenciaScreen.tsx:256-276`; mobile `PantallaInteligencia.tsx:218-223` | — | — |
| H-39 | Tirar para actualizar (`bi-refresh`) | 🟡 / ✅ | Web cambió el gesto por botón "Actualizar" (decisión propia) y perdió los estados textuales Tirá/Soltá/Actualizando/"Al día · recién". Mobile usa `RefreshControl` nativo sin esos textos `[NO VERIFICADO: WCAG 1.4.1]` | Web `InteligenciaScreen.tsx:47-50,112-121`; mobile `PantallaInteligencia.tsx:150-158` | `FE` | B |
| H-40 | Clientes (`clientes`) | ✅ / 🟡 | Mobile no tiene el bloque "Le vendiste a N clientes" + chip "N se agregaron solos este mes" — el mapa lo marca esencial ("ver nombres que no cargó se lee como error"). En web, `agregadosEsteMes` subcuenta con cartera paginada | Web `ClientesScreen.tsx:60-70,228-245`; mobile `PantallaClientes.tsx:74-320`; hallazgo previo `coordinacion/abierto/2026-09-07_hallazgo_frontend1-clientes-a-planificacion_...` | `FE` (mobile) + `FE+CONTRATO` (agregado del tenant en `/clientes`) | M |

### 5.7 Ajustes y soporte

| ID | Pantalla | W / M | Brecha | Evidencia | Clase | Sev. |
|---|---|---|---|---|---|---|
| H-41 | Ajustes (`ajustes`) | ✅ / ✅ | 7 entradas en el orden correcto. Se entra por tile/tab, no por el avatar como única puerta | Web `ajustes/PantallaAjustes.tsx:16-40`; mobile `ajustes/PantallaAjustes.tsx:14-82`, `EscritorioFunciones.tsx:126` | `DECISIÓN` (DA-1) | B |
| H-42 | Mi negocio (`negocio`) | 🟡 / 🟡 | Faltan Teléfono y Email (también en el contrato `PerfilNegocio`). El editor de tono está duplicado acá en vez de ser fila-resumen que linkea a "Cómo hablarle" | Web `negocio/PantallaPerfilNegocio.tsx:48-58,318-444`; mobile `:75-86,409-444`; `packages/core/src/api/perfilNegocio.ts:40-60`; spec `prototipo/index.html:2200-2203` | `FE+CONTRATO` (columnas + API) + `DECISIÓN` (DA-9) | M |
| H-43 | Facturación ARCA (`afip`) | ✅ / ✅ | CUIT bloqueado con botón "Cambiar" (ver §8 y DA-10). Botón "Cambiar CUIT" debe validar contra backend (contrato Parte 1, trabajo 6). `[NO VERIFICADO EN DEVICE]` el texto "la clave fiscal no se guarda" | Web `afip/PantallaAfipSetup.tsx:370-386`; mobile `:531-553`; backend `afip_web.py:183-209` | `FE+CONTRATO` (liberado) | M |
| H-44 | Apps conectadas (`apps`) | 🟡 / ✅ | Web no muestra la capacidad bajo cada app ("Mandar correos por vos. No puede leerlos.") aunque `service.description` ya llega (se usa para filtrar), y no puede desconectar (contrato Parte 1, trabajo 1). Mobile completo, con aviso de "lo que se pierde" | Web `connections/ServiceCard.tsx:30-35,55-92`, `ConnectionsScreen.tsx:20`; mobile `modules/apps/PantallaApps.tsx:68-93,240-343` | `FE` | M |
| H-45 | Login OAuth en mobile | — | Usar `expo-web-browser` para el flujo de conexión (contrato Parte 1, trabajo 5) | `apps/mobile/src/modules/apps/PantallaApps.tsx:162,167` | `FE` (liberado) | M |
| H-46 | Mi cuenta (`cuenta`) | 🟡 / 🟡 | Faltan "Cambiar el mail" y "Cambiar la contraseña" — el contenido central según el mapa. Hay filas no previstas (Plan/Idioma/Notificaciones en web; Feedback en mobile) | Web `account/AccountScreen.tsx:88-224`; mobile `ajustes/PantallaCuenta.tsx:30-175`; `packages/core/src/api/auth.ts` sólo expone login | `FE+CONTRATO` (endpoints GoTrue de actualización de usuario, con reautenticación) | M |
| H-47 | Apariencia (`apar`) | 🟡 / 🟡 | 3 temas en vez de 2 y sin "Como el teléfono". Web además sin muestras de color (mobile sí) | Web `ajustes/PantallaApariencia.tsx:7-11,20-46`; mobile `ajustes/PantallaSkins.tsx:9-19,33-90`; spec `prototipo/index.html:2311-2318` | `FE` + `DECISIÓN` (DA-4, DA-5) | B |
| H-48 | Cómo hablarle (`hablar`) | 🟡 / 🟡 | **Divergencia de producto:** el prototipo es un editor de Tono/Largo/Nombre con respuesta de ejemplo que cambia; el código es una guía de capacidades (`GET /capacidades`) | Web `ajustes/PantallaComoHablarle.tsx:8-104`; mobile `:9-34`; spec `prototipo/index.html:2323-2343` | `DECISIÓN` (DA-9) | M |
| H-49 | Cómo usar la app (`comousar`) | 🟡 / 🟡 | El prototipo: 5 temas cortos que abren el chat principal con contexto (Decisión C). El código abre un chat de ayuda propio, la duplicación que el propio repo dijo evitar | Web `AccountScreen.tsx:158-166`, `soporte/SoporteScreen.tsx:10-13,31-48`, `useChatSoporte.ts:36-47`; mobile `PantallaCuenta.tsx:99-106`, `PantallaSoporte.tsx:17-20,37-64` | `FE+CONTRATO` (arranque del chat principal con tema) | M |
| H-50 | Soporte técnico (`soporte`) | 🟡 / 🟡 | Sin avatar ni distinción de que contesta una persona; sin texto estático de tiempo de respuesta ni de qué datos viajan con el ticket | Web `SoporteScreen.tsx:31-48`, `MiTicketScreen.tsx:46-153`; mobile `PantallaSoporte.tsx:64-180` | `FE` | B |
| H-51 | Contanos qué tal (`feedback`) | 🔴 / 🟡 | Web: no existe la pantalla (el backend `/feedback` está vivo y lo usa mobile). Mobile: falta "¿Qué le cambiarías?", la sección "Lo pediste vos" con pedidos escuchados (la pieza esencial) y la derivación a Soporte | Web: sólo `admin/AdminScreen.tsx:686` (panel interno); mobile `PantallaFeedback.tsx:39-193` | Web `FE`; "Lo pediste vos" `BACKEND` (listar feedback propio + estado escuchado) | M |

> H-13, H-18 y H-45 no son claves del mapa: son trabajos de la Parte 1 del contrato que tocan pantallas auditadas y se incluyen para que el plan los secuencie junto al resto. La numeración supera 48 por eso.

---

## 6. Temas transversales

Agrupan hallazgos que conviene resolver **una vez** y no pantalla por pantalla.

| Tema | Hallazgos | Diagnóstico | Enfoque recomendado |
|---|---|---|---|
| **T-1 Armazón y aterrizaje** | H-04, H-05, H-11, H-12, H-41, H-09, H-10 | El producto real es "chat primero"; el prototipo es "Mi día primero, en capas" | Cerrar DA-1. Luego un único cambio de shell por plataforma, no ajustes sueltos |
| **T-2 Voz en las funciones** | H-16, H-33, H-34, H-17 | La voz depende del chat; el prototipo la quiere donde está el usuario | Hook/componente de voz contextual compartido + contexto de función en el dispatcher; la propuesta vuelve a la pantalla de origen |
| **T-3 Recibo en el hilo** | H-21, H-24, H-23, H-27 | Cada tarjeta resuelve su estado terminal con texto propio | Un componente `Recibo` compartido (web + mobile) con check `aria-live`, detalle y acciones; factura lo usa con CAE y compartir |
| **T-4 Paridad web ↔ mobile** | H-15, H-20, H-34, H-39, H-40, H-44, H-51 | Siete pantallas con distinto veredicto; cada plataforma va adelante en algo | Portar la versión más completa; test de paridad por componente (§7) |
| **T-5 Gramática visual** | H-33, H-34, H-37, H-40, H-47 | Bloque negro en web, glass en mobile, sin decisión | Cerrar DA-3 y DA-4 antes de tocar estilos; mientras tanto, sólo cambios funcionales |
| **T-6 Ayuda y tono duplicados** | H-42, H-48, H-49 | "Cómo hablarle", "Mi negocio" y "Cómo usar" se pisan entre sí y con el prototipo | Cerrar DA-9: una pantalla de tono, un chat principal que acepta tema de ayuda, la guía de capacidades como contenido del chat |
| **T-7 Medición y plan** | H-19, H-31, H-32 | No existe el concepto de acción consumida | Decidir modelo (DA-7) antes de cualquier UI; el medidor exige ledger de acciones por tenant con RLS |
| **T-8 Marca** | H-01, H-02, H-03 | Sin guión de arranque | Congelado por contrato Parte 2 hasta la reunión |

---

## 7. Divergencias web ↔ mobile

| Pantalla | Web | Mobile | Quién va adelante | Acción |
|---|---|---|---|---|
| `bloqueado` | 🟡 sin Pausar/Reanudar | ✅ tres controles | Mobile | Portar a web (H-15) |
| `bi-refresh` | 🟡 botón | ✅ gesto nativo | Mobile en gesto; ninguna tiene los textos | Textos de estado en ambas (H-39) |
| `feedback` | 🔴 | 🟡 | Mobile | Crear en web; completar ambas (H-51) |
| `hitl` | ✅ | 🟡 | Web | Portar a mobile (D-3, H-20) |
| `ingresos` | ✅ | 🟡 | Web | Portar resumen y aviso a mobile (H-34) |
| `clientes` | ✅ | 🟡 | Web | Portar bloque a mobile (H-40) |
| `apps` | 🟡 | ✅ | Mobile | Descripción + desconectar en web (H-44) |

Además, dentro de pantallas con el mismo veredicto: web descarta audio corto y mobile no (H-14); mobile muestra muestras de color en Apariencia y web no (H-47); web tiene guard anti-duplicado en presupuestos y mobile no (D-1).

**Causa raíz común:** los componentes de presentación viven duplicados por plataforma y sólo `packages/core` es compartido. Sin un test de paridad, cada fix llega a una sola app. El plan debería incluir un control que lo haga visible (p. ej. un inventario de `testID`/`data-testid` equivalentes por pantalla verificado en CI).

---

## 8. Inconsistencias internas del prototipo

| ID | Inconsistencia | Evidencia | Decisión requerida |
|---|---|---|---|
| P-1 | **CUIT bloqueado.** La regla del repo dice "CUIT bloqueado, sin acción"; el render del prototipo muestra "Bloqueado" + "Necesito cambiarlo ›" | `Prototipo frontend/odobi-ui/CLAUDE.md` §12 (reglas) vs `prototipo/index.html:2221-2226` | DA-10. El código siguió al render ("Cambiar"); el contrato Parte 1 exige que el backend rechace un CUIT no vinculado a la clave fiscal |
| P-2 | **Fusión Contabilidad + Inteligencia.** El prototipo la da por hecha (6 tiles), pero el mapa sigue describiendo pantallas de Inteligencia sin el acumulado que hoy vive en Contabilidad | `mockups/10-arranque/DECISIONES.md`; `odobi-ui/CLAUDE.md` §11 (20/08) | DA-2: confirmar destino de cada bloque |
| P-3 | **Pantallas de visión mezcladas con pantallas de spec.** `limite` y `plan` se autodeclaran visión; el mapa las presenta igual que las demás | `mockups/13-ajustes/DECISIONES.md` §4 | Marcar en el mapa qué es visión y qué es spec, para no medir coherencia contra visión |
| P-4 | **Tabbar.** Decisión abierta en `10-arranque/DECISIONES.md` mientras otras pantallas ya asumen el modelo de capas | Fila "Tabbar" del mismo archivo | DA-1 |

---

## 9. Correcciones a auditorías previas

Registradas para que el plan no herede errores.

| Afirmación previa | Estado | Evidencia de la corrección |
|---|---|---|
| "`/contabilidad/resumen` está huérfano, ninguna app lo consume" (barrido automático de este ciclo) | **Refutada** | Web `contabilidad/ContabilidadScreen.tsx:6,66` y mobile `contabilidad/PantallaContabilidad.tsx:4,37` llaman `obtenerResumenContabilidad` (`packages/core/src/api/contabilidad.ts:170`) |
| "No existe el acumulado de 12 meses ni el medidor de tope de monotributo" (fila `bi` del documento fuente) | **Corregida en alcance** | Existe en ambas apps, en Contabilidad: web `ContabilidadScreen.tsx:225-245`, mobile `PantallaContabilidad.tsx:188-210`, con fail-soft si no hay escala vigente. La brecha es de ubicación (DA-2), no de construcción |
| "Cancelar deslizando es una decisión abierta" (clasificación inicial de `grabando`) | **Reclasificada a `FE`** | El prototipo la especifica: `03-home-conversacional/DECISIONES.md:95,108` |
| `pres-hitl` mobile ✅ | **Se mantiene ✅ con defecto D-1** | El mecanismo existe; la garantía de no duplicar, no |

---

## 10. Backlog semilla por olas

Ordenado por **desbloqueo × impacto ÷ riesgo**. Cada ola puede ejecutarse en paralelo por plataforma. Tamaño: S ≤ 1 día · M 2-4 días · L ≥ 1 semana (orientativo, para dimensionar el plan, no compromiso).

### Ola 0 — Defectos (antes que todo)

| Ítem | Hallazgos | Plataforma | Clase | Tamaño |
|---|---|---|---|---|
| Idempotencia en `presupuesto_store.crear` + guard en card mobile | D-1, H-26 | Backend + mobile | `FE+CONTRATO` | M |
| Cancelar grabación deslizando a la izquierda | D-2, H-14 | Web + mobile | `FE` | M |
| HITL genérico con servicio, campos, riesgo e irreversibilidad | D-3, H-20 | Mobile | `FE` | S |

### Ola 1 — Contrato Parte 1 (ya liberado)

| Ítem | Hallazgos | Plataforma | Tamaño |
|---|---|---|---|
| 1. Desconectar app | H-44 | Web (`ServiceCard.tsx:69-85`) | S |
| 2. CAE + compartir en la card del chat | H-24 (usa T-3) | Web + mobile (`TarjetaFacturaPropuesta.tsx:59-66`) | M |
| 3. Separadores de fecha | H-13 | Web (`MessageList.tsx:161-163`) | S |
| 4. Origen real de la propuesta | H-18 | `FormularioGasto.tsx:39,64` | S |
| 5. `expo-web-browser` en conexiones | H-45 | Mobile (`PantallaApps.tsx:162,167`) | S |
| 6. Cambiar CUIT validado por backend | H-43 | Web + mobile + `afip_web.py:183-209` | M |

### Ola 2 — FE puro y paridad (sin decisión)

| Ítem | Hallazgos | Plataforma | Tamaño |
|---|---|---|---|
| Componente `Recibo` compartido | H-21, H-23 | Web + mobile | M |
| Pausar/Reanudar en grabación fijada | H-15 | Web | S |
| Resumen mensual + aviso MercadoPago | H-34 | Mobile | S |
| Bloque "Le vendiste a N" + chip | H-40 | Mobile | S |
| Descripción de capacidad por app | H-44 | Web | S |
| Pantalla Feedback (envío texto/voz) | H-51 | Web | S |
| Rodillo de ejemplos del chat (pausable, reduced-motion) | H-12 | Web + mobile | M |
| Estados textuales de refresco | H-39 | Web + mobile | S |
| Vacío con título + cuerpo + ilustración; retiro progresivo | H-09, H-10 | Web + mobile | M |
| Avatar humano + textos estáticos de Soporte | H-50 | Web + mobile | S |
| Categorías del tablero derivadas de `regla` + contador | H-06 (parte FE) | Web + mobile | M |
| Portada financiera de Mi día como componente (sin decidir su posición) | H-04 (a) | Web + mobile | M |

> La portada de H-04 se construye como componente autocontenido y se monta donde hoy está Mi día. Si DA-1 la mueve al frente, se reubica sin reescribir.

### Ola 3 — Contratos chicos (backend liviano + FE)

| Ítem | Hallazgos | Backend requerido | Tamaño |
|---|---|---|---|
| Voz contextual en funciones | H-16, H-33, H-17 | Contexto de función en el dispatcher; destino de la propuesta; duración de audio | L |
| Consentimiento en contexto | H-30 | Gate estructurado `requiere_conexion` en `dispatcher_emprendedor.py:279-283` | M |
| Chips de seguimiento del ciclo de presupuesto | H-27 | Acciones sugeridas en la respuesta de `marcar_presupuesto`/guardar | M |
| Verbo contextual y criticidad por tarjeta | H-06 | Campo por regla en el detector | M |
| Teléfono y email del negocio | H-42 | Columnas en perfil + API (`uc_tables.json`, `provision.py`, RLS) | S |
| Cambiar mail y contraseña | H-46 | Endpoints de actualización de usuario (GoTrue) con reautenticación | M |
| Agregado de cartera del tenant | H-40 | Total y agregados del mes en `/clientes` | S |
| "Cómo usar" abre el chat principal con tema | H-49 | Arranque de hilo con tema | M |

### Ola 4 — Backend nuevo

| Ítem | Hallazgos | Diseño requerido | Tamaño |
|---|---|---|---|
| Agenda multi-día + escritura de evento | H-07 | Revisar CAL1 §3 (sólo-hoy); ADR | L |
| Señal de conexión caída + alerta del detector | H-11 | Salud por conexión (Composio) + regla nueva | L |
| "Lo pediste vos" | H-51 | Listado de feedback propio + estado escuchado | M |

### Ola 5 — Bloqueado por decisión

| Ítem | Hallazgos | Decisión |
|---|---|---|
| Armazón en capas / aterrizaje en Mi día / avatar a Ajustes / 6 tiles | H-04 (b), H-05, H-41 | DA-1, DA-2 |
| Fusión Contabilidad + Inteligencia; pregunta libre en el chat principal | H-37, H-19 | DA-2 |
| Bloque negro vs glass | H-33, H-34, H-40 (visual) | DA-3 |
| Tokens, temas, "Como el teléfono" | H-47 | DA-4, DA-5 |
| Onboarding de 2 permisos + primer insight | H-28, H-29 | DA-6 |
| Plan, medidor y tope | H-31, H-32 | DA-7 |
| Splash, entrada, reveal | H-01, H-02, H-03 | DA-8 |
| Editor de tono vs guía de capacidades | H-48, H-42 | DA-9 |

### Cobertura esperada al cerrar cada ola

Proyección sobre las 48 pantallas del mapa, asumiendo que cada ola cierra todos sus ítems. Una pantalla sale de 🟡/🔴 sólo cuando se cierran **todas** sus brechas, por eso varias dependen de la Ola 5.

| Al cerrar | Pantallas coherentes en ambas plataformas (estimado) |
|---|---|
| Hoy | 11 (✅ en ambas; 5 de ellas con brechas menores que igual entran al plan) |
| Olas 0-2 | ~23 |
| Ola 3 | ~31 |
| Ola 4 | ~33 |
| Ola 5 (con decisiones cerradas) | 48 |

> Estimación, no medición: se recalcula con la matriz del Anexo A al cierre de cada ola.

---

## 11. Criterios de aceptación y Definición de Terminado

### 11.1 Por ítem

Un ítem del backlog está **terminado** sólo si cumple todo lo siguiente:

1. **Coherencia verificable:** la brecha citada en el hallazgo ya no se reproduce; se re-ejecuta la verificación de esa fila del Anexo A y el veredicto cambia.
2. **Paridad:** si el hallazgo es de ambas plataformas, cierra en ambas o el PR declara explícitamente cuál queda y por qué.
3. **Tests:** unidad/componente del comportamiento nuevo; integración en backend (en el VPS) si hay contrato; **test adversarial** si el ítem toca autorización o aislamiento de tenant (p. ej. teléfono/email de negocio, feedback propio, cambio de CUIT).
4. **Gate:** `scripts/gate.sh` verde con recibo en `.ci-recibos/<sha>.json`.
5. **Evidencia de device:** captura o video del flujo en el dev-client (Metro local, usuario `e2e-device@copiloto.test`) para mobile, y en el PWA desplegado para web.
6. **Accesibilidad:** contraste dentro de lo firmado por tokens; `aria-live` en recibos; animaciones con `prefers-reduced-motion` y pausa (WCAG 2.2.2).
7. **Deploy + PR mergeado** siguiendo la convención del repo.

### 11.2 Por ola

- La ola cierra cuando todos sus ítems cumplen 11.1 **y** se republica la matriz del Anexo A con los veredictos nuevos.
- La Ola 5 no arranca por ítem: arranca cuando cada decisión DA-x tiene acta escrita con dueño y fecha.

### 11.3 Criterio de cierre del frente completo

**48/48 pantallas ✅ en web y mobile** contra una versión del prototipo que marque qué es spec y qué es visión (P-3), con todas las DA-x cerradas y documentadas.

---

## 12. Riesgos

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R-1 | Construir portada/armazón antes de DA-1 y rehacerlo | Alta | Alto | Ola 2 construye componentes autocontenidos; la reubicación queda en Ola 5 |
| R-2 | Arreglar en una plataforma y no en la otra (patrón ya observado: D-1, H-14, H-47) | Alta | Medio | Criterio de paridad en DoD; control de paridad en CI |
| R-3 | Voz contextual (H-16) cambia el contrato del dispatcher y rompe la ruta del chat | Media | Alto | Contexto opcional con fallback a la ruta actual; tests del dispatcher en el VPS antes de FE |
| R-4 | Medir coherencia contra pantallas de visión | Media | Medio | Resolver P-3 en el mapa antes de declarar cobertura |
| R-5 | Tocar superficies de la Parte 2 del contrato antes de la reunión | Media | Alto | Ola 5 bloqueada explícitamente; los PRs de Olas 0-4 declaran que no tocan Parte 2 |
| R-6 | Cambio de tema (DA-5) invalida tests de contraste existentes | Media | Medio | Recomputar contrastes desde tokens, no desde cifras citadas |
| R-7 | Afirmaciones `[NO VERIFICADO]` de este reporte resultan falsas en device | Media | Bajo | Barrido de device de las 14 ✅ antes de cerrar Ola 2 |
| R-8 | Presupuestos duplicados ya existentes en datos reales | Baja | Medio | Consulta con claims correctos (no ciega bajo RLS `FORCE`) antes y después de D-1 |

---

## Anexo A — Matriz completa de 48 pantallas

Veredicto por plataforma, ID de hallazgo, clase dominante y ola asignada.

| # | `?ver=` | Pantalla | Web | Mobile | Hallazgo | Clase | Ola |
|---|---|---|---|---|---|---|---|
| 1 | `splash` | Splash | 🔴 | 🔴 | H-01 | `DECISIÓN` | 5 |
| 2 | `entrada` | Entrada | 🔴 | 🔴 | H-02 | `DECISIÓN` | 5 |
| 3 | `/` | Mi día | 🟡 | 🟡 | H-04 | `FE` + `DECISIÓN` | 2 / 5 |
| 4 | `esc` | Funciones | ✅ | ✅ | H-05 | `DECISIÓN` | 5 |
| 5 | `chat` | Chat | 🟡 | 🟡 | H-12 | `FE` | 2 |
| 6 | `tablero` | Tablero | 🟡 | 🟡 | H-06 | `FE+CONTRATO` | 2 / 3 |
| 7 | `agenda` | Agenda | 🟡 | 🟡 | H-07 | `BACKEND` | 4 |
| 8 | `detalle` | Detalle | ✅ | ✅ | H-08 | — | — |
| 9 | `grabando` | Grabando | 🟡 | 🟡 | H-14, D-2 | `FE` | 0 |
| 10 | `bloqueado` | Audio bloqueado | 🟡 | ✅ | H-15 | `FE` | 2 |
| 11 | `card` | La card en la función | 🔴 | 🔴 | H-16 | `FE+CONTRATO` | 3 |
| 12 | `vozchat` | Lo dictado, en el chat | 🟡 | 🟡 | H-17 | `FE+CONTRATO` | 3 |
| 13 | `bi-vacio` | Sin ventas todavía | ✅ | ✅ | H-38 | — | — |
| 14 | `bi-refresh` | Tirar para actualizar | 🟡 | ✅ | H-39 | `FE` | 2 |
| 15 | `reveal` | El reveal | 🔴 | 🔴 | H-03 | `DECISIÓN` | 5 |
| 16 | `onb-promesa` | La promesa | 🔴 | 🔴 | H-28 | `DECISIÓN` | 5 |
| 17 | `onb-cumplida` | La promesa cumplida | 🔴 | 🔴 | H-29 | `BACKEND` | 5 |
| 18 | `consent` | Just-in-time consent | 🔴 | 🔴 | H-30 | `FE+CONTRATO` | 3 |
| 19 | `caida` | Conexión caída | 🔴 | 🔴 | H-11 | `BACKEND` | 4 |
| 20 | `preg` | Pregunta libre | 🟡 | 🟡 | H-19 | `DECISIÓN` | 5 |
| 21 | `recibo` | El comprobante | 🟡 | 🟡 | H-21 | `FE` | 2 |
| 22 | `fact-voz` | Facturar por voz | ✅ | ✅ | H-22 | — | — |
| 23 | `fact-hitl` | Segundo HITL — emitir | ✅ | ✅ | H-23 | `FE` | 2 |
| 24 | `fact-cae` | Emitida — el CAE | 🟡 | 🟡 | H-24 | `FE` | 1 |
| 25 | `pres-voz` | Presupuesto por voz | ✅ | ✅ | H-25 | — | — |
| 26 | `pres-hitl` | La tarjeta editable | ✅ | ✅ | H-26, D-1 | `FE+CONTRATO` | 0 |
| 27 | `pres-ciclo` | El ciclo | 🟡 | 🟡 | H-27 | `FE+CONTRATO` | 3 |
| 28 | `limite` | El límite | 🔴 | 🔴 | H-31 | `DECISIÓN` | 5 |
| 29 | `vacio-visto` | Calma, ya conocida | 🔴 | 🔴 | H-10 | `FE` | 2 |
| 30 | `comousar` | Cómo usar la app | 🟡 | 🟡 | H-49 | `FE+CONTRATO` | 3 |
| 31 | `soporte` | Soporte técnico | 🟡 | 🟡 | H-50 | `FE` | 2 |
| 32 | `feedback` | Contanos qué tal | 🔴 | 🟡 | H-51 | `FE` + `BACKEND` | 2 / 4 |
| 33 | `hitl` | Confirmación | ✅ | 🟡 | H-20, D-3 | `FE` | 0 |
| 34 | `vacio` | Mi día sin avisos | 🟡 | 🟡 | H-09 | `FE` | 2 |
| 35 | `gastos` | Gastos | 🟡 | 🟡 | H-33 | `FE+CONTRATO` + `DECISIÓN` | 3 / 5 |
| 36 | `ingresos` | Ingresos | ✅ | 🟡 | H-34 | `FE` | 2 |
| 37 | `factura` | Facturación | ✅ | ✅ | H-35 | — | — |
| 38 | `presu` | Presupuestos | ✅ | ✅ | H-36 | — | — |
| 39 | `bi` | Inteligencia de Negocio | 🟡 | 🟡 | H-37 | `DECISIÓN` | 5 |
| 40 | `clientes` | Clientes | ✅ | 🟡 | H-40 | `FE` + `FE+CONTRATO` | 2 / 3 |
| 41 | `ajustes` | Ajustes | ✅ | ✅ | H-41 | `DECISIÓN` | 5 |
| 42 | `negocio` | Mi negocio | 🟡 | 🟡 | H-42 | `FE+CONTRATO` + `DECISIÓN` | 3 / 5 |
| 43 | `afip` | Facturación ARCA | ✅ | ✅ | H-43 | `FE+CONTRATO` | 1 |
| 44 | `apps` | Apps conectadas | 🟡 | ✅ | H-44 | `FE` | 1 / 2 |
| 45 | `plan` | Mi plan | 🟡 | 🟡 | H-32 | `DECISIÓN` | 5 |
| 46 | `cuenta` | Mi cuenta | 🟡 | 🟡 | H-46 | `FE+CONTRATO` | 3 |
| 47 | `apar` | Apariencia | 🟡 | 🟡 | H-47 | `DECISIÓN` | 5 |
| 48 | `hablar` | Cómo hablarle | 🟡 | 🟡 | H-48 | `DECISIÓN` | 5 |

**Conteo de control:** Web ✅ 14 · 🟡 23 · 🔴 11 — Mobile ✅ 14 · 🟡 24 · 🔴 10.
