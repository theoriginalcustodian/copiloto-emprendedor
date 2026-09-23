# Backlog beta Odobi — todo lo que falta para la beta, con su definición de terminado

**Fecha:** 2026-09-21 · **Base verificada:** `main @ e6544f3b` (= `origin/main`, 0 PR abiertos) · **Autor:** planificación
**Qué es:** el inventario **completo** de lo que falta para que la beta de Odobi funcione de punta a punta, en web, mobile, backend y operación. **Qué no es:** el plan. Acá no hay orden de ejecución ni fechas; hay ítems con evidencia, dependencias y DoD, para que el plan se arme encima sin volver a investigar.

## 0. Cómo leer este documento

### 0.1 Fuentes (no se re-auditó lo ya auditado)

| Fuente | Qué aporta |
|---|---|
| `coordinacion/abierto/2026-09-21_hallazgo_auditoria-a-planificacion_...` (auditoría, 21/09) | Estado al 21/09 de las 48 pantallas, las 16 juntas, las 12 divergencias, las decisiones MAYORES |
| `docs/copiloto-emprendedor/Auditorias/2026-09-16-reporte-hallazgos-prototipo-vs-codigo-base-plan-implementacion.md` | IDs `H-01..H-51`, `D-1..D-3`, `DA-1..DA-11`, `T-*`, `R-*`, criterio de terminado §11 |
| Barrido del buzón `coordinacion/` (21/09) | Contratos emitidos y no ejecutados, pedidos sin respuesta, bandeja de `PLAN.md` |
| Re-verificación de pendientes no-UI (21/09) | Backend y operación que no son pantalla |
| Relevamiento operativo read-only del VPS `unreal-copilot` (21/09) | Qué necesita la beta para recibir testers reales |
| Auditoría de los 3 hilos fuera del mapa (`pres-marca`, `fact-sinarca`, `cobro-voz`) + clasificación spec/visión | Lo que la auditoría declaró no cubierto (§12) |

### 0.2 Alcance de «beta»

- **Entra:** web (PWA) y mobile (Android, dev-client/APK) coherentes con el **prototipo final de Martín**, más el backend y la operación que hacen falta para que testers reales usen el producto sin asistencia.
- **Queda afuera, pero listado** (§12): lo que el propio prototipo marca como VISIÓN o PROPUESTA, y la deuda de escala que no bloquea a 1–15 testers.
- **Referencia de diseño:** el prototipo del repo (07/09 + arreglo de enlaces del 16/09). La versión del 17–18/09 de Martín **no está en el repo** (`BL-P2`); hasta que entre, todo lo posterior al 07/09 se conoce sólo por el código de mobile.

### 0.3 Formato de cada ítem

`ID · título` — **Plataforma** (web / mobile / backend / ops) · **Tamaño** (S ≤ 1 día, M 2–4, L ≥ 1 semana; orientativo, del reporte 16/09) · **Origen** (IDs de la auditoría) · **Evidencia** (`ruta:línea` verificada) · **Depende de** (otro ítem, decisión `DEC-*` o contrato) · **DoD** (casillas binarias).

**Prefijos** (elegidos para no chocar con `H-`, `D-`, `DA-`, las «olas» ni los `H-x/B-x` de la sesión de Martín, que acá se citan como `MC-*`):

| Prefijo | Bloque |
|---|---|
| `DEC-` | Decisión MAYOR que destraba ítems (§1) — no se resuelve acá |
| `BL-P` | Prerrequisitos sin código (§2) |
| `BL-D` | Defectos (§3) |
| `BL-C` | Contrato del 16/09, Parte 1 (§4) |
| `BL-W` | Portar a web, tramo 1 (§5) |
| `BL-F` | Frontend pendiente en ambas o en mobile (§6) |
| `BL-J` | Juntas backend ↔ app (§7) |
| `BL-X` | Bloqueado por decisión (§8) |
| `BL-B` | Backend y plataforma sin pantalla (§9) |
| `BL-O` | Operación de la beta (§10) |
| `BL-Q` | Calidad transversal: paridad, re-medición, smoke (§11) |
| `BL-V` | Post-beta: visión, propuesta y escala (§12) |

### 0.4 DoD base — aplica a **todo** ítem de código, además de su DoD propio

Un ítem está terminado sólo si cumple **todas** estas casillas y las suyas:

1. **PR mergeado** a `main` desde rama propia, con recibo de `scripts/gate.sh` en `.ci-recibos/<sha>.json` para el SHA mergeado (ADR-001). GitHub verde es la segunda confirmación, no la única.
2. **Tests del comportamiento nuevo:** unidad o componente siempre; integración de backend **corrida en el VPS** si toca backend.
3. **Test adversarial** (actor A pide lo de B → denegado) si el ítem toca autorización, datos por tenant o aislamiento. Sin él, el control queda `[UNVERIFIED]` y el ítem no cierra.
4. **Desplegado:** backend con `deploy/copiloto/deploy.sh`; web al PWA de producción; mobile en el dev-client por Metro, o en build EAS si el cambio es nativo.
5. **Evidencia de uso real**, con `e2e-device@copiloto.test` salvo que el ítem diga otra cosa: captura o video del **device** (mobile) y del **PWA desplegado** (web), **lado a lado con el prototipo `?ver=<id>`** cuando el ítem tiene pantalla. Los gestos se ejercitan con `adb input motionevent`, nunca `input tap`. Si algo no se pudo verificar en device, el cierre lo dice.
6. **Paridad:** si el ítem aplica a las dos plataformas, cierra en las dos o el PR dice cuál queda y por qué, con un ítem nuevo para la que falta.
7. **Accesibilidad:** contraste **computado** (no estimado) dentro de lo firmado por tokens; `aria-live` en recibos; animaciones con pausa y `prefers-reduced-motion` / movimiento reducido.
8. **Re-medición:** la fila de la matriz de 48 pantallas que el ítem toca se re-verifica y su veredicto cambia (auditoría la republica al cerrar cada bloque).
9. **Cierre por buzón:** `cierre_` o `avance_` con la evidencia; el contrato se mueve a `cerrado/<fecha>/`.

Los ítems de operación (`BL-O`) y prerrequisitos (`BL-P`) no llevan 1–8: su DoD propio dice qué evidencia los cierra.

---

## 1. Decisiones MAYORES que destraban ítems (`DEC-`)

No se resuelven en este documento. Cada una necesita **acta** con dueño y fecha (reporte 16/09 §11.2) antes de que arranquen sus ítems.

| ID | Decisión | Dueño | Origen | Destraba |
|---|---|---|---|---|
| **DEC-1** | **Quién implementa mobile de acá a la beta**: la sesión de Martín (PR #511–#513, escritos por Claude Code en su máquina, fuera del buzón y sin recibo de `gate.sh`) o las sesiones de este buzón. Incluye si sus PR pasan a exigir recibo (el `gate.sh` falla en bash 3.2 de macOS). | Operador | Auditoría §6.1.1 | Todo ítem con mobile; `BL-B*` del gate en macOS |
| **DEC-2** | **¿Web sigue a mobile?** DA-1 (capas), DA-2 (6 funciones), DA-5 (2 temas), DA-11 (ARCA), DA-3 (bloque negro), y **cómo se traducen las capas a escritorio**. | Operador + Martín | Auditoría §6.1.2 | `BL-X1`–`BL-X5`, `BL-X11` |
| **DEC-3** | **Animación de arranque**: librería (Rive vs Reanimated; hay spec `specs/splash-port-reanimated.md`) y alcance del guión (DA-8). | Operador + Martín | DA-8 | `BL-X10` |
| **DEC-4** | **Build EAS nativo**: cuándo se paga la próxima compilación y qué entra en ella. | Operador | Auditoría §6.1.4 | `BL-C5`, `BL-O3`, todo cambio nativo |
| **DEC-5** | **Tipografía + licencia + historia pública**: qué fuente usa la app, si la licencia de Neue Einstellung permite redistribuir, y si hay que sacar los 10 `.otf` también de la **historia** del repo público (`filter-repo` = MAYOR). | Operador + Martín | DA-4, auditoría §6.1.5 | `BL-X6` |
| **DEC-6** | **«Cómo hablarle»**: editor de tono con ejemplo (prototipo) vs guía de capacidades (código). | Operador + Martín | DA-9 | `BL-X7` |
| **DEC-7** | **Onboarding**: ¿entra en la beta? alcance del hilo de 2 permisos y del primer insight. | Operador + Martín | DA-6 | `BL-X8` |
| **DEC-8** | **Plan y límites**: ¿entra en la beta? El prototipo lo marca VISIÓN (`index.html:915`) y `kb-usuario/chat.md:158-162` le dice al usuario que **no hay tope**; `limite` ni figura en `mapa.html`. | Operador | DA-7, P-3 | `BL-X9`, texto de `kb-usuario` |
| **DEC-9** | **CUIT bloqueado: ¿con o sin salida?** El prototipo se contradice (regla «sin acción» vs render «Necesito cambiarlo ›»). | Operador | DA-10, P-1 | `BL-C6` |
| **DEC-10** | **Acta de las decisiones de Martín posteriores al 07/09**: isotipo en Soporte, trazo 1,3, logos reales de apps, **Calma 3 vs 5 días**, cinco íconos provisorios, lockup en el login, nocturno retirado. | Martín + operador | Auditoría §6.3 | `BL-W5` (umbral), `BL-X11` |
| **DEC-11** | **Contrastes firmados**: el sello de acción (3,17:1) y el botón de grabar (1,26:1 sobre el extremo claro del degradado) — ¿se mantienen como excepción firmada o se corrigen? Depende del acento (DA-4). | Operador + Martín | DA-4, contrato 16/09 Parte 2 | `BL-Q4` |
| **DEC-12** | **Google OAuth: Testing con lista manual vs verificación de Google.** En Testing cada tester se agrega a mano (tope 100) y ve «app no verificada»; pasar a Production con `gmail.send`/Drive exige revisión de seguridad de Google. Además hay que confirmar **qué app OAuth ve el tester** (la propia o la de Composio). | Operador | Relevamiento operativo | `BL-O2` |
| **DEC-13** | **iOS en la beta**: ¿hay testers con iPhone? Hoy no existe perfil ni build iOS. | Operador | Relevamiento operativo | `BL-O3` |

**Orden sugerido para la reunión con Martín** (no vinculante): DEC-2 y DEC-10 primero (juntas destraban el tramo 2 de web y 7 ítems), después DEC-9, DEC-11, DEC-5. DEC-1, DEC-4, DEC-8, DEC-12 y DEC-13 son del operador solo.

---

## 2. Prerrequisitos sin código (`BL-P`)

### BL-P1 · Respuesta del operador a §6.1 de la auditoría y estado de la Parte 2
- **Qué:** saber si la reunión con Martín ocurrió y qué se decidió; responder DEC-1, DEC-2 y el estado de la Parte 2 del contrato del 16/09 (en mobile se aplicó igual).
- **DoD:** [ ] `dato_` o acta en el buzón con la respuesta a DEC-1 y DEC-2 y la lista de lo que la Parte 2 deja liberado.

### BL-P2 · La carpeta `odobi-ui/` de Martín (17–18/09) entra al repo
- **Qué:** su versión del prototipo y `mobile-coherencia.md` (Parte 2 = las formas propuestas de los pedidos a backend) no están en el repo. Sin ella, la referencia de «prototipo final» es la del 07/09.
- **DoD:** [ ] PR con la carpeta, sin `.otf` nuevos ni credenciales (revisión de `git status` y grep de formas de credencial antes del commit); [ ] auditoría re-mide las filas que cambian contra la versión nueva.

### BL-P3 · Acta de decisiones ya aplicadas
- **Qué:** registrar como cerradas, con alcance por plataforma, las decisiones que mobile ya aplicó y el prototipo ya dibuja (DA-1, DA-2, DA-3, DA-4 en tokens, DA-5 en mobile, DA-11) y las de DEC-10.
- **DoD:** [ ] un documento de acta en `docs/copiloto-emprendedor/` con cada DA: estado, dueño, fecha, plataformas, ítems que destraba.

### BL-P4 · Re-emitir el contrato del 16/09 con el estado real
- **Qué:** el contrato sigue en `abierto/` sin acuse ni avance; el trabajo 2 se hizo en mobile por fuera. Hay que cerrarlo y emitir uno nuevo con `BL-C1`–`BL-C6` y su estado de hoy.
- **DoD:** [x] contrato viejo en `cerrado/<fecha>/` con nota de reemplazo (`cerrado/2026-09-21/2026-09-16_contrato_planificacion-a-frontend_seis-trabajos-…`, línea 1: «REEMPLAZADO … (BL-P4)»); [x] contrato nuevo citando este backlog: `2026-09-21_contrato_planificacion-a-frontend2_cola-del-plan-autonomo-beta-odobi.md` (BL-C1–C6 en la cola de FE2; hoy en `cerrado/2026-09-22/`). Checkboxes tildados el 2026-09-22 tras A4 (auditoría lo verificó).

### BL-P5 · Marcar spec vs visión en el mapa del prototipo
- **Qué:** P-3. `mapa.html:97` presenta `plan` como spec aunque `index.html:915` dice VISIÓN; `limite`, `pres-marca`, `fact-sinarca` y `cobro-voz` no figuran en el mapa. Sin esto, «48/48 coherentes» se mide contra pantallas que nadie va a construir.
- **Depende de:** `BL-P2` (sobre la versión final), DEC-8.
- **DoD:** [x] cada `?ver=` del prototipo clasificado spec / visión / propuesta en un solo lugar (`2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md`: 54 spec · 2 visión · 1 propuesta · 7 fuera); [x] el criterio de cierre del frente (§13) cita esa lista.

### BL-P6 · Corregir `fact-sinarca` en el prototipo
- **Qué:** el hilo muestra facturar con un solo comando de voz y CAE inmediato, sin confirmación. El producto **prohíbe** emitir sin HITL: `apps/copiloto/tool_catalog.py:267-269` («NO la emite: la deja lista para que él la revise») y `kb-usuario/chat.md:96-98` («No emite una factura solo con la voz»). El hilo real es `fact-voz` → `fact-hitl` → `fact-cae`. No se implementa: se corrige el prototipo.
- **DoD:** [ ] Martín ajusta o retira el hilo; [ ] queda anotado en el acta (`BL-P3`).

### BL-P7 · Cerrar los mensajes viejos de `abierto/`
- **Qué:** 8 `avance_`/`dato_` del 07–08/09 ya materializados siguen en `abierto/` (el barrendero no los movió). Ruido que esconde lo vivo.
- **DoD:** [x] cada uno movido a `cerrado/<fecha-original>/`; [x] `abierto/` sólo contiene trabajo vivo (2026-09-22: `find abierto -name '2026-09-0[78]_*'` → 0; auditoría contó los archivos de `abierto/`: todos del 22/09).

---

## 3. Defectos — van antes que todo (`BL-D`)

Rompen una garantía que el sistema ya declara. No dependen de ninguna decisión.

### BL-D1 · Presupuesto duplicado al recargar (idempotencia + guard mobile)
- **Plataforma:** backend + mobile · **Tamaño:** M · **Origen:** D-1, H-26 · **Pantalla:** `pres-hitl`
- **Evidencia:** `apps/copiloto/presupuesto_store.py:213-251` (`crear` inserta con `max(numero)+1`, sin clave de idempotencia) · `apps/mobile/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:25,32-37` (`useState` sin persistencia; el docstring 17-27 admite el gap) · referencia web resuelta `apps/copiloto-web/src/modules/chat/TarjetaPresupuestoPropuesto.tsx:22-34`.
- **Depende de:** nada. **Contrato:** sí (junta J1: forma de la clave de idempotencia).
- **DoD:**
  - [ ] Test de integración en el VPS: dos `crear` con la misma clave → **un** registro y la misma respuesta.
  - [ ] Test mobile: remount de la card tras guardar → queda en estado terminal, sin botón Guardar.
  - [ ] Device: guardar → recargar el hilo → la card aparece guardada; tocar dos veces rápido Guardar no duplica.
  - [ ] Consulta **con claims** (no ciega bajo `FORCE`) de presupuestos duplicados existentes, antes y después (R-8); resultado anotado en el cierre.

### BL-D2 · Deslizar a la izquierda cancela la grabación
- **Plataforma:** web + mobile · **Tamaño:** M · **Origen:** D-2, H-14 · **Pantalla:** `grabando`
- **Evidencia:** mobile `apps/mobile/src/modules/chat/ChatView.tsx:155` (soltar ⇒ envío) · `BotonVoz.tsx:193-207` (`Gesture.Pan` lee sólo `translationY`) · web `apps/copiloto-web/src/modules/chat/MicButton.tsx:194` (sin eje horizontal) · spec `Prototipo frontend/odobi-ui/mockups/03-home-conversacional/DECISIONES.md:95,108`.
- **Incluye:** portar a mobile el descarte del toque < 350 ms que ya tiene web (`MicButton.tsx:212-214`).
- **Depende de:** nada.
- **DoD:**
  - [ ] Deslizar a la izquierda más allá del umbral cancela en web y en mobile, con feedback visual antes de soltar.
  - [ ] Un toque < 350 ms no envía en mobile (igual que web).
  - [ ] Device mobile: gesto ejercitado con `adb input motionevent` DOWN/MOVE/UP (nunca `input tap`), video o secuencia de capturas.
  - [ ] Web: test de componente del gesto horizontal + captura en el PWA.

### BL-D3 · HITL genérico de mobile completo (servicio, campos, riesgo, irreversible)
- **Plataforma:** mobile · **Tamaño:** S · **Origen:** D-3, H-20 · **Pantalla:** `hitl`
- **Evidencia:** `apps/mobile/src/modules/chat/ListaMensajes.tsx:68-115` (`TarjetaConfirmacion`: sólo `gate.markdown` + Confirmar/Cancelar) · referencia web `apps/copiloto-web/src/modules/chat/HitlCard.tsx:41-125`.
- **Depende de:** nada (el payload del gate ya trae `service`/`label`/riesgo; web lo consume).
- **DoD:**
  - [ ] Paridad de campos con web: ícono + label del servicio, PARA, MONTO, badge de riesgo, aviso «no se puede deshacer» con borde de alerta. (corregido 2026-09-21 post-A1: `preview` sale del DoD — el motor lo manda como texto del mensaje, `conversation_workflow.py:608-615`; ninguna app tiene productor de `preview`.)
  - [ ] Test de componente: un gate irreversible **exige** el aviso; uno reversible no lo muestra.
  - [ ] Device: captura de un HITL irreversible real (p. ej. mandar un mail) lado a lado con `?ver=hitl`.

### BL-D4 · El hilo muestra el token interno del HITL (`cancel:2:0`)
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** barrido BL-Q3 web (FE1, 2026-09-22) · **Pantalla:** `hitl`
- **Evidencia:** el `value` de la elección es `confirm:`/`cancel:<turn>:<step>` (`motor/backend/agent/conversation_workflow.py:712-716`; `:401-404` dice que nunca es texto del interlocutor) · web `hitlMapping.ts:98-99` → `ChatScreen.tsx:77` → `useChat.ts:296` (eco optimista con el valor crudo) → `MessageList.tsx:223-224` · mobile `ListaMensajes.tsx:250-251` → `useChat.ts:291` → `packages/core/src/chat/chatMachine.ts:238-239` → `ListaMensajes.tsx:186-187`. Web tiene además su `useChat` propio, que no usa el reducer de core (`useChat.ts:118-123`).
- **Contrato:** `contrato_planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8`, fila 1.
- **DoD:**
  - [ ] Tras Confirmar o Cancelar, la burbuja muestra el label elegido (o no hay burbuja), igual en las dos apps; nunca el `value`.
  - [ ] Recargar el hilo tampoco lo muestra. Si el backend lo persiste como turno del usuario, es junta (`pedido_`), no un filtro en el front.
  - [ ] Test con control negativo en core y en el `useChat` de web.
  - [ ] Captura PWA del hilo tras cancelar un cobro de prueba.

### BL-D5 · Total del presupuesto con 4 decimales («$30.000,0000»)
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** barrido BL-Q3 web (FE1) · **Pantalla:** `pres-hitl`
- **Evidencia:** `multiplicarDecimal` (web `modules/presupuestos/FormularioPresupuesto.tsx:66-75`, mobile `:73-82`, copia línea a línea) suma los decimales de los dos operandos sin redondear a centavos; lo llama `TarjetaPresupuestoPropuesto.tsx:93-103`. `formatearImporte` (`packages/core/src/dinero/formatoDinero.ts:84-105`) respeta a propósito los decimales que recibe (`:78-79`): no es el culpable.
- **Contrato:** `contrato_planificacion-a-frontend2_BL-Q3-web-arreglos-D5-D6-D7-D8-W11-W12`, fila 2.
- **DoD:**
  - [ ] El cálculo vive una sola vez en `packages/core` y redondea a 2 decimales; se borra la copia duplicada.
  - [ ] Test: «1.00» × «30000.00» → `$30.000,00`, más un caso de redondeo.
  - [ ] Captura PWA de `pres-hitl`.

### BL-D6 · Mi día web: las tarjetas de «Para hoy» se ven en blanco colapsadas
- **Plataforma:** web · **Tamaño:** S · **Origen:** barrido BL-Q3 web (FE2) · **Pantallas:** `(vacío)`, `tablero`
- **Evidencia:** `modules/midia/MidiaScreen.tsx:335-355` · `midia.css:140-145,161-165` (`-webkit-line-clamp` sin el `line-clamp` estándar, que `connections.css:164` sí tiene). Es la causa probable por inspección; falta confirmarla en vivo. Al expandir, el texto aparece.
- **Contrato:** `contrato_planificacion-a-frontend2_BL-Q3-web-arreglos-D5-D6-D7-D8-W11-W12`, fila 1.
- **DoD:**
  - [ ] Causa confirmada en el PWA y nombrada en el PR.
  - [ ] Texto visible recortado a 2 líneas con la tarjeta colapsada.
  - [ ] Test que falle sin el fix.
  - [ ] Captura con `?ver=tablero`.

### BL-D7 · La barra de pestañas de web mete 10 ítems a ancho de teléfono
- **Plataforma:** web · **Tamaño:** S–M · **Origen:** barrido BL-Q3 web (FE2, transversal; es regresión de #587) · **Depende de:** `DEC-2`
- **Evidencia:** `shell/TabBar.tsx:62-74,109-136` pinta 10 `TABS` (+ admin) bajo 900 px (`ResponsiveShell.tsx:21-27`); a 390 px los rótulos se pisan. El docstring (`:101`) todavía dice «4 ítems fijos». En mobile, las 6 funciones viven en el escritorio (`BL-X1`), no en la barra.
- **Contrato:** `contrato_planificacion-a-frontend2_BL-Q3-web-arreglos-D5-D6-D7-D8-W11-W12`, fila 3.
- **DoD:**
  - [ ] Bajo 900 px, las puertas fijas de mobile (chat · Mi día · Funciones, + admin); cada función se abre desde el escritorio.
  - [ ] Desde 900 px, sin cambios.
  - [ ] Test del shell: a 390 px hay ≤ 4 pestañas.
  - [ ] Captura a 390 px sin rótulos pisados.

### BL-D8 · Conexiones web: ícono de Google Docs en blanco y título
- **Plataforma:** web · **Tamaño:** S · **Origen:** barrido BL-Q3 web (FE2) · **Pantalla:** `apps`
- **Evidencia:** el SVG es válido (`design-system/serviceIcons.tsx:4,46` → `logos/docs.svg`, igual al de mobile), así que la causa no es estática: hay que reproducirla en el PWA. Título: web «Conexiones» (`ConnectionsScreen.tsx:33,67`), mobile «Apps» (`apps/mobile/src/modules/apps/PantallaApps.tsx:211`). La grilla de 2 columnas es una decisión con test (`ConnectionsScreen.test.tsx:107-121`) y queda.
- **Contrato:** `contrato_planificacion-a-frontend2_BL-Q3-web-arreglos-D5-D6-D7-D8-W11-W12`, fila 6.
- **DoD:**
  - [ ] Causa del ícono nombrada, con captura antes y después.
  - [ ] Título «Apps».

---

## 4. Contrato del 16/09, Parte 1 — emitido y nunca tomado (`BL-C`)

Contrato `coordinacion/abierto/2026-09-16_contrato_planificacion-a-frontend_seis-trabajos-...md`. Estado real al 21/09 (auditoría §7): **nadie lo tomó**; el trabajo 2 se hizo en mobile por fuera del buzón (#511). Hay que re-emitirlo con este estado (ver `BL-P4`).

### BL-C1 · Desconectar una app (web)
- **Plataforma:** web · **Tamaño:** S · **Origen:** contrato 16/09 trabajo 1, H-44 · **Pantalla:** `apps`
- **Evidencia:** `apps/copiloto-web/src/modules/connections/ServiceCard.tsx:30-35,55-92` (sólo sello CONECTADO) · backend listo `apps/copiloto/web.py:1030,1063`, `apps/copiloto/catalog.py:92-106` (`disconnect_path`).
- **DoD:**
  - [ ] Acción «Desconectar» en la tarjeta activa, con confirmación que dice qué se pierde (como mobile `PantallaApps.tsx:68-93`).
  - [ ] Desconectar Composio **y** MercadoPago en el PWA desplegado con `e2e-device`; la tarjeta vuelve a «Conectar» sin recargar.
  - [ ] Test de componente de los dos estados.

### BL-C2 · CAE, número, vencimiento y PDF en la card del chat (web)
- **Plataforma:** web · **Tamaño:** S (mobile ya hecho, #511) · **Origen:** trabajo 2, H-24 · **Pantalla:** `fact-cae`
- **Evidencia:** `apps/copiloto-web/src/modules/chat/TarjetaFacturaPropuesta.tsx:59-66` · dato ya en cliente `packages/core/src/api/afip.ts:109-116` · diseño a portar `facturacion/TarjetaComprobante.tsx:71-87` · referencia mobile `apps/mobile/src/modules/facturacion/comprobante.tsx` (sondea hasta `terminado`: el CAE llega antes que el PDF).
- **Depende de:** nada. Convive con `BL-F1` (Recibo): si el Recibo se hace antes, se monta ahí.
- **DoD:**
  - [ ] Tras emitir desde el chat, la card muestra número, CAE, vencimiento del CAE y acción al PDF cuando existe.
  - [ ] El PDF que llega segundos después aparece sin recargar (sondeo hasta `terminado`, igual que mobile).
  - [ ] Evidencia: factura real en homologación con `e2e-device` (tiene credencial) en el PWA, lado a lado con `?ver=fact-cae`.

### BL-C3 · Separadores de fecha en el historial del chat
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** trabajo 3, H-13
- **Evidencia:** web `apps/copiloto-web/src/modules/chat/MessageList.tsx:160-163` (un solo `sessionMarker`) · mobile `apps/mobile/src/modules/chat/ListaMensajes.tsx` (tampoco los tiene; no estaba en el contrato).
- **DoD:**
  - [ ] Un divisor por cambio de día en ambas apps («Hoy», «Ayer», fecha).
  - [ ] Test unitario de la agrupación, incluido el borde de medianoche en `America/Argentina/Buenos_Aires`.
  - [ ] Captura de un hilo con mensajes de ≥ 2 días en PWA y device.

### BL-C4 · Origen real de la propuesta (voz / foto / mail / manual)
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** trabajo 4, H-18
- **Evidencia:** web `apps/copiloto-web/src/modules/gastos/FormularioGasto.tsx:39,45,64` (envía `origen`, sólo muestra la cita OCR si es `foto`, `:100`) · mobile `apps/mobile/src/modules/gastos/FormularioGasto.tsx:52,60,85` (sólo lo envía).
- **DoD:**
  - [ ] El formulario muestra el origen para los tres valores (voz / foto / manual) en ambas apps. (corregido 2026-09-21 post-A1: `mail` nunca existió, `gasto_store.py:20` `ORIGENES`; un origen por mail sería fila nueva de ingesta, fuera de la beta.)
  - [ ] Test de componente por valor de `origen`.
  - [ ] Captura de una propuesta por voz y una por foto en device.

### BL-C5 · Login de apps en `expo-web-browser` (mobile)
- **Plataforma:** mobile (nativo) · **Tamaño:** S + build · **Origen:** trabajo 5, H-45
- **Evidencia:** `apps/mobile/src/modules/apps/PantallaApps.tsx:2,171,176` (sigue con `Linking`; su comentario `:166-167` dice que falta el build) · dependencia instalada `apps/mobile/package.json:30`.
- **Depende de:** `DEC-4` (build EAS nativo).
- **DoD:**
  - [ ] El OAuth de Conectar abre en la ventana segura y vuelve a la app sin salir al navegador del sistema.
  - [ ] Build EAS con el cambio instalado en el device; video del flujo con Gmail (o el servicio que esté conectable).

### BL-C6 · «Cambiar» el CUIT, validado por backend
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** trabajo 6, H-43, P-1 · **Pantalla:** `afip`
- **Evidencia:** web `apps/copiloto-web/src/modules/ajustes/afip/PantallaAfipSetup.tsx:376-382` · mobile `apps/mobile/src/modules/ajustes/afip/PantallaAfipSetup.tsx:550-553` (`setCuitBloqueado(false)` sin validar) · backend `apps/copiloto/afip_web.py:183-209` (no rechaza un CUIT no vinculado).
- **Depende de:** `DEC-9` (DA-10: CUIT con o sin salida).
- **DoD:**
  - [ ] Backend rechaza con código explícito un CUIT que no esté entre los vinculados a la clave fiscal del tenant; test de integración en el VPS.
  - [ ] **Test adversarial**: el tenant A intenta fijar el CUIT vinculado del tenant B → rechazo.
  - [ ] UI según DA-10: sin salida, o con salida que muestra el error del backend; test de componente.
  - [ ] Device + PWA: intento con un CUIT ajeno muestra el rechazo y la facturación sigue funcionando.
  - [ ] No se cierra con sólo la mitad de UI.

---

## 5. Portar a web — tramo 1, sin decisión pendiente (`BL-W`)

Mobile va adelante en estas pantallas (auditoría §9.1–9.2). Se porta la versión de mobile, no se reinventa.

### BL-W1 · Pausar y Reanudar en la grabación fijada
- **Plataforma:** web · **Tamaño:** S · **Origen:** H-15 · **Pantalla:** `bloqueado`
- **Evidencia:** web `apps/copiloto-web/src/modules/chat/RecordingOverlay.tsx:41-62` · referencia mobile `ControlesFlotantes.tsx:30-44` · spec `03-home-conversacional/DECISIONES.md:95,108,133`.
- **DoD:**
  - [ ] Tres controles: Pausar/Reanudar, Eliminar (no «Cancelar»), Enviar; el audio pausado y reanudado llega entero.
  - [ ] Test de componente de la máquina de estados.
  - [ ] Captura en el PWA lado a lado con `?ver=bloqueado`.

### BL-W2 · Descripción por capacidad bajo cada app
- **Plataforma:** web · **Tamaño:** S · **Origen:** H-44 · **Pantalla:** `apps`
- **Evidencia:** `ServiceCard.tsx:55-92` no pinta `service.description` (ya llega; `ConnectionsScreen.tsx:20` la usa para filtrar).
- **DoD:**
  - [ ] Cada tarjeta muestra la capacidad («Mandar correos por vos. No puede leerlos.»).
  - [ ] Captura en el PWA con ≥ 3 servicios.

### BL-W3 · Pantalla «Contanos qué tal» (feedback) en web
- **Plataforma:** web · **Tamaño:** S · **Origen:** H-51 · **Pantalla:** `feedback`
- **Evidencia:** web sin pantalla (sólo panel interno `admin/AdminScreen.tsx:686`); backend `/feedback` vivo; referencia mobile `apps/mobile/src/modules/feedback/PantallaFeedback.tsx:103-171` (pregunta guiada + derivación a Soporte).
- **DoD:**
  - [ ] Envío por texto y por voz desde Ajustes → Ayuda; el registro aparece en el panel admin.
  - [ ] Pregunta guiada «¿Qué le cambiarías?» y derivación a Soporte presentes.
  - [ ] Test de componente + envío real en el PWA con `e2e-device`.
  - [ ] «Lo pediste vos» NO entra acá: es `BL-J12`.

### BL-W4 · Rodillo de ejemplos del chat, con pausa desde el principio
- **Plataforma:** web (+ deuda mobile) · **Tamaño:** M · **Origen:** H-12 · **Pantalla:** `chat`
- **Evidencia:** web `ChatScreen.tsx:8-9`, `MessageList.tsx:159` (párrafo fijo) · mobile hecho con deuda: `apps/mobile/src/modules/chat/RodilloEjemplos.tsx:22-24` (sin pausa y corre con movimiento reducido).
- **DoD:**
  - [ ] Web: un ejemplo por vez cada ~4 s, pausable (WCAG 2.2.2) y quieto con `prefers-reduced-motion`.
  - [ ] Mobile: agregar pausa y respetar `AccessibilityInfo.isReduceMotionEnabled`.
  - [ ] Test de componente de pausa y de movimiento reducido en ambas.
  - [ ] Captura en PWA y device.

### BL-W5 · Vacío con título, cuerpo e ilustración, y retiro progresivo
- **Plataforma:** web · **Tamaño:** M · **Origen:** H-09, H-10 · **Pantallas:** `vacio`, `vacio-visto`
- **Evidencia:** web `apps/copiloto-web/src/modules/midia/MidiaScreen.tsx:187-193` (texto plano) · referencia mobile `apps/mobile/src/theme/EstadoVacio.tsx:26-64` (clave `odobi-calma-dias`, días distintos) y `PantallaMiDia.tsx:383-398`.
- **Depende de:** umbral 3 vs 5 días (`DEC-10`, decisión de Martín §6.3) — se puede construir parametrizado y fijar el número después.
- **DoD:**
  - [ ] Ilustración sólo en el vacío bueno de «Para hoy»; título y cuerpo separados.
  - [ ] El cuerpo se retira tras N días **distintos** (no visitas); título, ilustración y salida no se tocan nunca. N es una constante única, igual en ambas apps.
  - [ ] Test unitario con reloj simulado: 5 visitas el mismo día no cuentan como 5.
  - [ ] Captura en el PWA antes y después del umbral.

### BL-W6 · Textos de estado del refresco (Tirá / Soltá / Actualizando / Al día)
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** H-39 · **Pantalla:** `bi-refresh`
- **Evidencia:** web `InteligenciaScreen.tsx:47-50,112-121` (botón, sin textos) · mobile `PantallaInteligencia.tsx:150-158` (`RefreshControl` sin textos; WCAG 1.4.1 sin verificar).
- **DoD:**
  - [ ] Los cuatro estados textuales en ambas; «Al día · recién» tras refrescar.
  - [ ] Web decide gesto o botón explícitamente en el PR (hoy botón por decisión propia).
  - [ ] Captura del ciclo completo en device y PWA.

### BL-W7 · Categorías y contador del tablero (parte frontend)
- **Plataforma:** web · **Tamaño:** M · **Origen:** H-06 (FE) · **Pantalla:** `tablero`
- **Evidencia:** web `MidiaScreen.tsx:36-48,110-132,197-208` · referencia mobile `apps/mobile/src/modules/midia/categoriaTarjeta.ts:5,25` (deriva del cliente, aislado para borrarse cuando llegue `BL-J5`).
- **DoD:**
  - [ ] Chips Todo / Cobros / ARCA / Presupuestos / Tuyas y contador «N para hoy · N en curso · N crítico».
  - [ ] La derivación vive en un único módulo borrable (misma forma que mobile).
  - [ ] Test del mapeo `regla → categoría` **en backend** (`test_mi_dia_clasificacion.py`, K-06 lo movió ahí); captura en el PWA. (corregido 2026-09-21 post-A1: el FE ya no mapea.)

### BL-W8 · Portada financiera de Mi día como componente
- **Plataforma:** web · **Tamaño:** M · **Origen:** H-04 (a) · **Pantalla:** `/`
- **Evidencia:** web `MidiaScreen.tsx:50-214` sin portada · referencia mobile `apps/mobile/src/modules/midia/PortadaNegocio.tsx`.
- **Depende de:** no de la posición (DA-1): se construye autocontenida. Fecha de corte y variación esperan `BL-J2`/`BL-J3`.
- **DoD:**
  - [ ] Caja, entró / salió / por cobrar; «—» cuando falta un dato, nunca «$0».
  - [ ] Componente montable en cualquier contenedor (test que lo monta aislado).
  - [ ] Captura en el PWA con datos de `e2e-device`.

### BL-W9 · «Cómo usar la app» abre el chat principal
- **Plataforma:** web · **Tamaño:** S · **Origen:** H-49 · **Pantalla:** `comousar`
- **Evidencia:** web `AccountScreen.tsx:158-166` → chat de soporte propio (`SoporteScreen.tsx:10-13`, `useChatSoporte.ts:36-47`) · referencia mobile `PantallaComoUsarLaApp.tsx:48-105` + `mensajePendiente.ts:20-33` (sin backend).
- **Depende de:** nada; la junta de backend de la Ola 3 **sobra** (auditoría §8).
- **DoD:**
  - [ ] Los 5 temas; cada uno abre el chat principal con la pregunta precargada. No existe un chat de ayuda propio.
  - [ ] Test del puente de un solo mensaje; captura en el PWA.

### BL-W10 · Soporte: tiempo de respuesta y qué datos viajan con el ticket
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** H-50 · **Pantalla:** `soporte`
- **Evidencia:** grep de «4 h hábiles» / «Va con esta conversación» sin resultados en `apps/mobile/src` ni `apps/copiloto`; web `SoporteScreen.tsx:31-48`. El avatar = isotipo es decisión de Martín (`PantallaSoporte.tsx:136-146`, #513) — web lo sigue.
- **DoD:**
  - [ ] Texto fijo de tiempo de respuesta y de qué viaja con el ticket, en ambas.
  - [ ] Web muestra el mismo encabezado que mobile (isotipo + «Soporte de Odobi»).
  - [ ] El texto de tiempo de respuesta coincide con el SLA de `BL-O7`; si no hay SLA, no se promete un número.

### BL-W11 · Mi día: fecha, agenda con la conexión caída y aviso de caja que nombra a Mercado Pago
- **Plataforma:** web + mobile · **Tamaño:** S · **Origen:** barrido BL-Q3 web (FE2) · **Pantallas:** `(vacío)`, `agenda`, `caida`
- **Evidencia:** el prototipo pone marca + fecha arriba (`prototipo/index.html:1645`); web (`MidiaScreen.tsx:169-172`) y mobile (`PantallaMiDia.tsx:493-505`) no muestran fecha. El panel de agenda dice «Conectá Google Calendar…» aunque la conexión existe y está caída: no distingue *nunca conectada* de *caída* (web `MidiaScreen.tsx:284-289`, mobile `:517-533`). El aviso de caja incompleta es genérico (`packages/core/src/midia/caja.ts:63-64`), aunque la condición (`apps/copiloto/inteligencia_queries.py:210`) sólo mira Mercado Pago.
- **Contrato:** `contrato_planificacion-a-frontend2_BL-Q3-web-arreglos-D5-D6-D7-D8-W11-W12`, fila 4.
- **DoD:**
  - [ ] Fecha en el encabezado de Mi día, en las dos apps.
  - [ ] El panel de agenda usa la salud por conexión del catálogo (#550): si Calendar está caída, lo dice y ofrece reconectar.
  - [ ] El aviso de caja nombra a Mercado Pago.
  - [ ] Tests de los tres estados.
  - [ ] Captura PWA.
  - `caida` del prototipo (el banner en «En caja») exige Mercado Pago caído → tanda de device.

### BL-W12 · Ajustes de web igual a mobile y fin de la guía «Cómo hablarle»
- **Plataforma:** web (+ la guía en mobile) · **Tamaño:** S–M · **Origen:** barrido BL-Q3 web (FE2; `hablar` como «diferencia grave») · **Pantallas:** `ajustes`, `hablar` · **Depende de:** `DEC-6`, `DEC-10`
- **Evidencia:** la grilla de mobile (`apps/mobile/src/modules/ajustes/PantallaAjustes.tsx:54-88`) es una decisión de Martín del 18/09 (`51437353`) aceptada por DEC-10. Web conserva el tile `ajuste-tile-comoHablarle` (`PantallaAjustes.tsx:23,40`), que abre la guía de `/capacidades` (`AjustesScreen.tsx:66`), mientras que «Cómo hablarle» es el editor de tono (#560, DEC-6) y se abre desde Mi negocio (`AjustesScreen.tsx:63`). «Presupuestos» sale repetido porque hay dos capacidades con ese rótulo (`apps/copiloto/tool_catalog.py:369-370`) y la guía arma un bloque por tool (`PantallaComoHablarle.tsx:78-85`).
- **Contrato:** `contrato_planificacion-a-frontend2_BL-Q3-web-arreglos-D5-D6-D7-D8-W11-W12`, fila 5.
- **DoD:**
  - [ ] Web con los mismos tiles, orden y grupo «Ayuda» que mobile.
  - [ ] «Cómo usar la app» absorbe la guía, como en mobile; se borran `PantallaComoHablarle` y su tile.
  - [ ] La guía agrupa por rótulo en las dos apps (test con dos capacidades de igual rótulo).
  - [ ] Captura PWA lado a lado con la de mobile. El prototipo (`?ver=ajustes`) queda desalineado → acta §4.

---

## 6. Frontend pendiente en ambas o en mobile, sin decisión (`BL-F`)

### BL-F1 · Componente `Recibo` compartido
- **Plataforma:** web + mobile · **Tamaño:** M · **Origen:** H-21, H-23, T-3 · **Pantallas:** `recibo`, `fact-hitl`
- **Evidencia:** web `TarjetaFacturaPropuesta.tsx:59-64`, `MessageList.tsx:252-263` · mobile `TarjetaPropuestaShell.tsx:69-90`; `apps/mobile/src/modules/facturacion/comprobante.tsx` queda absorbido (#511 lo dejó «Pendiente de David»).
- **DoD:**
  - [ ] Un `Recibo` por plataforma con check `aria-live`, título, líneas secundarias y acción (Ver / Detalle / Copiar).
  - [ ] Lo usan factura, gasto, ingreso, presupuesto y HITL genérico (grep: ninguna card mantiene su texto terminal propio).
  - [ ] La card de factura repite el aviso «se anula con nota de crédito» antes de emitir (H-23).
  - [ ] Test de componente con lector de pantalla simulado (anuncio `aria-live`); capturas en ambas.

### BL-F2 · Tarjeta del link de cobro en mobile (`cobro-voz`)
- **Plataforma:** mobile · **Tamaño:** S · **Origen:** hilo `cobro-voz` (fuera del mapa; el prototipo lo marca spec, `index.html:3134-3139`)
- **Evidencia:** backend listo (`apps/copiloto/tool_catalog.py:102-108,588-630`, `mp_charge` genera el link y no cobra) · web lo pinta (`apps/copiloto-web/src/modules/chat/ArtifactView.tsx:23`, tests `ArtifactView.test.tsx:20-65`) · mobile **no porta el renderer de artefactos** (`apps/mobile/src/modules/chat/Burbuja.tsx:20-22`); grep de `payment_link`/`init_point` en `apps/mobile/src` vacío, con control positivo en web.
- **DoD:**
  - [ ] Mobile renderiza `payment_link` con monto, concepto y acciones Compartir (share sheet nativo, que incluye copiar) / Abrir. (corregido 2026-09-21 post-A1: el backend no emite vencimiento, `tool_catalog.py:613-615`; «Copiar» propio exige `expo-clipboard`, nativo congelado — Compartir lo cubre.)
  - [ ] Decidido en el PR qué otros `kind` de artefacto porta (`email_draft`, etc.) o se abre ítem por cada uno.
  - [ ] Device: «hacele un link de cobro a …» → HITL → tarjeta con el link real de MercadoPago; compartir por WhatsApp.

---

## 7. Juntas backend ↔ app — cada una necesita su `contrato_` (`BL-J`)

Ninguna tiene contrato (salvo la del CUIT, `BL-C6`). La dueña de la junta es planificación. Las formas «aditivas y opcionales» que redactó la sesión de Martín están en la Parte 2 de `mobile-coherencia.md`, dentro de su carpeta `odobi-ui/` que **no está en el repo** (ver `BL-P2`): se leen antes de redactar para no escribirlas dos veces.

**DoD común de toda junta** (además del específico):
- [ ] `contrato_` emitido con endpoint, request, response, códigos y DoD por lado **antes** de implementar.
- [ ] Campo nuevo aditivo y opcional; los clientes viejos siguen funcionando (test de compatibilidad).
- [ ] Test de integración en el VPS del lado backend; test adversarial si expone datos por tenant.

### BL-J1 · Clave de idempotencia en `presupuesto_store.crear`
Es la mitad backend de `BL-D1`; se contrata junto con él. **Tamaño:** S.
- **DoD:** el que figura en `BL-D1`.

### BL-J2 · Fecha de corte del saldo
- **Plataforma:** backend + web + mobile · **Tamaño:** S · **Origen:** H-04, sesión de Martín (#511, «Lo que NO entra» 1)
- **Evidencia:** `CajaPortada` es `{saldo, moneda}`; el prototipo muestra «Al 19 de agosto».
- **DoD:**
  - [ ] La respuesta trae la fecha de corte del saldo; la portada la muestra en la card blanca que fecha los números.
  - [ ] Sin dato → la card no muestra fecha, no inventa «hoy».

### BL-J3 · Variación del saldo contra el mes anterior (`MC-H2`)
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-04, sesión de Martín
- **Evidencia:** `apps/mobile/src/modules/midia/PortadaNegocio.tsx:14-18` (`serieMensual` trae ingresos y gastos, no saldo por mes).
- **DoD:**
  - [ ] Saldo del mes anterior (o delta) expuesto; si falta (`variacion_pct: null`) la portada **omite el chip entero**. (corregido 2026-09-21 post-A1: manda K-03 l.49.)
  - [ ] Test backend con un tenant de un solo mes de historia (sin mes anterior).

### BL-J4 · Salud por conexión (`MC-H3`) + alerta en el detector
- **Plataforma:** backend + web + mobile · **Tamaño:** L · **Origen:** H-11, sesión de Martín · **Pantallas:** `caida`, `/`, avatar
- **Evidencia:** `PortadaNegocio.tsx:19-24` (la portada no sabe que está incompleta) · `apps/mobile/src/modules/midia/AvatarCuenta.tsx:13-17` (punto `avisa` cableado y apagado) · web `ServiceCard.tsx:6,22-36,77` («HOY nada en el catálogo lo dispara»).
- **DoD:**
  - [ ] Señal de salud por conexión (Composio y MercadoPago) consultable por tenant.
  - [ ] Regla del detector que crea la tarjeta de alerta cuando una conexión cae y la cierra sola al reconectar.
  - [ ] La portada oculta el dato que depende de la conexión caída y lo dice; el punto del avatar se enciende; el badge «Reconectar» se cablea.
  - [ ] Test de integración que revoca una conexión de `e2e-device` y ve la tarjeta; **test adversarial** (la salud de B no aparece en A).
  - [ ] Captura device + PWA lado a lado con `?ver=caida`.

### BL-J5 · Verbo contextual y criticidad por regla (`MC-B3`)
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-06 · **Pantalla:** `tablero`
- **Evidencia:** `apps/mobile/src/modules/midia/categoriaTarjeta.ts:5,25` (derivación del cliente, provisoria) · `PantallaMiDia.tsx:131,190` · `packages/core/src/api/miDia.ts:17`.
- **DoD:**
  - [ ] Cada tarjeta trae `categoria`, `criticidad` y `verbo` desde el detector.
  - [ ] Se borran `categoriaTarjeta.ts` y su gemelo web (grep vacío).
  - [ ] Banner de alerta crítica separado y nota final de qué se cierra solo, en ambas.
  - [ ] Captura del tablero con ≥ 1 tarjeta crítica.

### BL-J6 · Agregado de cartera del tenant en `/clientes`
- **Plataforma:** backend + web + mobile · **Tamaño:** S · **Origen:** H-40
- **Evidencia:** `apps/mobile/src/modules/clientes/PantallaClientes.tsx:93-95` (`agregadosEsteMes` sale de la página cargada; dice «pedido a backend en curso» pero no hay `pedido_`); web igual (`ClientesScreen.tsx:60-70`).
- **DoD:**
  - [ ] `/clientes` devuelve total de la cartera y agregados solos del mes, independientes de la paginación.
  - [ ] Test con > 1 página de clientes: el chip coincide con un `count` hecho **con claims**.
  - [ ] Test adversarial: el total de A no cuenta clientes de B.

### BL-J7 · Voz dentro de las funciones (contexto de función en el dispatcher)
- **Plataforma:** backend + web + mobile · **Tamaño:** L · **Origen:** H-16, H-33, H-17, T-2 · **Pantallas:** `card`, `gastos`, `vozchat`, `ingresos`
- **Evidencia:** sin `MicButton`/`BotonVoz`/`useVozComando` en `modules/gastos/` de ninguna app; `TarjetaGastoPropuesto` sólo en `modules/chat`. Riesgo R-3.
- **DoD:**
  - [x] ~~El dispatcher acepta un contexto de función **opcional**; sin él, la ruta del chat queda idéntica (test de regresión del dispatcher en el VPS antes de tocar FE).~~ **Corregido por el contrato `K-10` §1 (2026-09-21):** transcribir por el dispatcher arrancaba un workflow por cada dictado de campo y ensuciaba el hilo del chat con mensajes que el emprendedor no mandó. Se resolvió con endpoints nuevos que **no pasan por el dispatcher**: `POST /transcribir` (#573) y `POST /gastos/leer-foto` (#615). La ruta del chat queda idéntica por construcción, porque no se tocó; el replay del `ConversationWorkflow` lo confirma (A3, 15/15 en el VPS sobre `b59588d2`).
  - [ ] Mic en la fila del rótulo de Gastos, Ingresos, Presupuestos y Clientes; el texto dictado **rellena el formulario de esa pantalla y no se guarda solo** (`K-10` §4: una transcripción es una propuesta, como las cards del agente), no va al hilo.
  - [ ] Foto del ticket como disparador directo desde Gastos.
  - [x] ~~Chip «Por voz · duración» en la card (H-17): la duración viaja en el mensaje.~~ **Corregido tras A3 (H-A3-7, 2026-09-22):** `K-10` (DoD #5 de FE1) y el plan §8.2 fila 23 lo resolvieron en el cliente. El chip vive en `MicFuncion` (web `MicFuncion.tsx:64,89-93`, mobile `:151-158`), la duración se mide localmente y **no viaja** al backend. Para la beta vale así; persistirla pasa a `BL-V19`.
  - [ ] El mensaje dictado **en el chat** lleva el chip «Por voz · m:ss» en su burbuja (prototipo `vozAlChat(dur)`, `index.html:2903`; `specs/mobile-coherencia.md:210` B-6), dibujado en el cliente. Está en `contrato_planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8`, anexo, fila 6.
  - [ ] Device: dictar un gasto desde Gastos y verlo aterrizar ahí; captura lado a lado con `?ver=card`.

### BL-J8 · Consentimiento en contexto (`requiere_conexion`)
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-30 · **Pantalla:** `consent`
- **Evidencia:** `apps/copiloto/dispatcher_emprendedor.py:279-283` (responde texto «Andá a Conexiones…»).
- **DoD:**
  - [ ] El dispatcher emite un gate estructurado `requiere_conexion` con servicio y alcance.
  - [ ] Sheet en contexto con el alcance por permiso, Conectar / Ahora no, y el hilo visible detrás; al conectar, el pedido original se reanuda.
  - [ ] Device: pedir algo de Gmail con Gmail desconectado → sheet → conectar → se ejecuta.
  - [ ] **(A3, H-A3-2)** Una tool de escritura con HITL sobre un servicio no conectado muestra la card **antes** de pedir confirmación (hoy `tool_catalog.py:1611-1615` chequea después). Si la conexión cae entre el confirm y la ejecución, la rama del confirm (`conversation_workflow.py:424-433`) extrae `gate_card` como `:621-641`. Medido en prod: la card llegaba vacía (`card: {}`).
  - [ ] **(A3, H-A3-4)** Fixture de replay que atraviese la rama `gate_card` (lo pedía `K-11` DoD l.58 y #570 no lo agregó). Está en `contrato_planificacion-a-backend_A3-arreglos-*`, fila 2.

### BL-J9 · Acciones sugeridas tras guardar o aprobar un presupuesto
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-27 · **Pantalla:** `pres-ciclo`
- **Evidencia:** `apps/copiloto/tool_catalog.py:367,1201-1259` (`marcar_presupuesto` sin sugerencia); grep de «Armá la factura» / «Mandalo por mail» vacío en ambas apps.
- **DoD:**
  - [ ] La respuesta de guardar trae «Mandalo por mail» / link al Doc; la de aprobar trae «¿Te armo la factura?» con chip.
  - [ ] Tocar «Armá la factura» abre la propuesta de factura con los ítems del presupuesto (HITL normal).
  - [ ] Decisión explícita en el PR sobre el botón Aprobar en pantalla (`presupuestos/DetallePresupuesto.tsx:28` dice que no hay).
  - [ ] Si el mismo turno deja una card que bloquea (`requiere_conexion`) y la sugerencia, **gana la que bloquea**, en los dos órdenes de llegada; test de regresión en el motor con ambos órdenes y el replay intacto. *(Agregado tras A2: estaba en la forma de K-07-B §2 y no en su DoD, y quedó sin implementar.)*
  - [ ] Adversarial a nivel **reply** (par `two_tenants` de `test_adversarial_multitenant.py`): la card de A nunca aparece en el `GET /reply` de B.
  - [ ] Device: ciclo presupuesto → aprobado → factura de punta a punta.

### BL-J10 · Teléfono y email del negocio
- **Plataforma:** backend + web + mobile · **Tamaño:** S · **Origen:** H-42 · **Pantalla:** `negocio`
- **Evidencia:** `packages/core/src/api/perfilNegocio.ts:40-60` sin `telefono`/`email`; spec `prototipo/index.html:2200-2203`.
- **DoD:**
  - [ ] Columnas en perfil + API (`uc_tables.json`, `provision.py`), con RLS.
  - [ ] **Test adversarial**: A no lee ni escribe el perfil de B.
  - [ ] Validación de formato en ambos lados; captura de guardar y releer.

### BL-J11 · Cambiar el mail y la contraseña (GoTrue)
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-46 · **Pantalla:** `cuenta`
- **Evidencia:** `packages/core/src/api/auth.ts` sólo expone login · web `AccountScreen.tsx:88-224` · mobile `PantallaCuenta.tsx:28-122`.
- **DoD:**
  - [ ] Cambiar mail con confirmación al mail nuevo; cambiar contraseña con reautenticación.
  - [ ] Test de integración contra una GoTrue de **TEST** (nunca `copiloto-auth` de prod), con cuentas efímeras creadas y destruidas por el propio test; un token de A no cambia la cuenta de B. *(Corregido tras A2: la línea anterior decía `copiloto-auth`, y el contrato K-12 §3 prohíbe prod. `MockTransport` no cumple esta línea.)*
  - [ ] Cuentas creadas con Google: la fila de contraseña se oculta o explica (decisión en el contrato).
  - [ ] Cerrar sesión queda en su propio grupo.
  - [ ] Probado con una cuenta descartable, **no** con `e2e-device` (no romper el usuario canónico).
  - [ ] **(A3, H-A3-11)** Los 8 tests contra GoTrue real corren en **cada** `gate.sh`. Hoy se saltean si falta `UC_TEST_GOTRUE_URL`; A3 los corrió a mano, 8/8. Está en `contrato_planificacion-a-backend_A3-arreglos-*`, fila 5.

### BL-J12 · «Lo pediste vos» (feedback propio y su estado)
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-51 · **Pantalla:** `feedback`
- **Evidencia:** grep de «Lo pediste vos» vacío; el prototipo la marca «LA PIEZA» (`index.html:2114-2117`).
- **DoD:**
  - [ ] Endpoint que lista el feedback propio con estado «escuchado» (lo marca el equipo desde admin).
  - [ ] **Test adversarial**: A no ve el feedback de B.
  - [ ] Sección en ambas apps; captura con un pedido marcado como escuchado.

### BL-J13 · Agenda de varios días y escritura de eventos (incluye Calendar capa 1)
- **Plataforma:** backend + web + mobile · **Tamaño:** L · **Origen:** H-07; `PLAN.md` bandeja (Calendar × Mi día capas 1 y 3; CAL1 cerró sólo la capa 2) · **Pantalla:** `agenda`
- **Evidencia:** `apps/copiloto/mi_dia_web.py:44` (`_rango_hoy`) · web `MidiaScreen.tsx:142,216-250` · mobile `PantallaMiDia.tsx:259-310` · `GOOGLECALENDAR_CREATE_EVENT` ya en la policy.
- **Depende de:** ADR (CAL1 §3 fijó sólo-hoy) + `contrato_`.
- **DoD:**
  - [ ] ADR que reemplaza la decisión sólo-hoy de CAL1 §3.
  - [ ] Pantalla Agenda con Hoy / Mañana / Esta semana / Sin hora y franja horaria (títulos literales de `GRUPOS_AGENDA`, `mi_dia_web.py:46`; K-13 §5).
  - [ ] Crear un evento por voz y desde «Nuevo evento», siempre con HITL; aparece en Google Calendar de `e2e-device`.
  - [ ] Test adversarial: A no lee la agenda de B (la conexión de Composio es por tenant).
  - [ ] La capa 3 (cruce evento ↔ cliente) queda afuera: `BL-V3`.

---

---

## 8. Bloqueado por decisión — tramo 2 de web y pantallas que faltan (`BL-X`)

Se construyen **cuando** la decisión tenga acta. Hasta entonces, tocarlas es trabajo a riesgo de tirar (contrato 16/09, Parte 2).

### BL-X1 · Armazón en capas en web, aterrizaje en Mi día, avatar como única puerta a Ajustes
- **Plataforma:** web · **Tamaño:** L · **Origen:** H-04 (b), H-05, H-41, T-1 · **Depende de:** `DEC-2`
- **Estado:** aplicado en mobile (`PantallaPrincipal.tsx:183`, `EscritorioFunciones.tsx:70-91`, `PantallaMiDia.tsx:429-441`).
- **DoD:**
  - [ ] La traducción a escritorio decidida en `DEC-2` implementada tal cual.
  - [ ] Web abre en Mi día; Ajustes sólo por el avatar (grep: sin tab ni tile de Ajustes).
  - [ ] Capturas de `/`, `esc`, `chat`, `ajustes` lado a lado con el prototipo.

### BL-X2 · 6 funciones y fusión Contabilidad + Inteligencia en web
- **Plataforma:** web · **Tamaño:** M · **Origen:** H-05, H-37, DA-2 · **Depende de:** `DEC-2`
- **Estado:** hecho en mobile (`apps/mobile/src/modules/inteligencia/AcumuladoAnual.tsx:1-114`).
- **DoD:**
  - [ ] 6 tiles; el acumulado de 12 meses con medidor de tope vive en Inteligencia; `ContabilidadScreen` retirada.
  - [ ] Semáforo y fail-soft (`tope: null`) iguales a mobile; captura en el PWA.

### BL-X3 · «Preguntar» en el chat principal, no en un mini-chat de Inteligencia
- **Plataforma:** web + mobile · **Tamaño:** M · **Origen:** H-19 · **Depende de:** `DEC-2`
- **Evidencia:** `inteligencia/ChatInteligencia.tsx` en ambas (sincrónico, aparte).
- **DoD:**
  - [ ] La pregunta libre abre el chat principal durable con el contexto; el mini-chat se borra en ambas.
  - [ ] Device: pregunta desde Inteligencia → respuesta en el hilo principal.

### BL-X4 · Temas: 2 exactos con muestras + «Como el teléfono»
- **Plataforma:** web + mobile · **Tamaño:** M · **Origen:** H-47, DA-5 · **Depende de:** `DEC-2` (para web)
- **Evidencia:** web `PantallaApariencia.tsx:7-11,20-46` (3 temas, sin muestras) · mobile `skinsCatalogo.ts:10-18` (2 temas con muestras) · falta «Como el teléfono» en ambas.
- **DoD:**
  - [ ] Web retira `nocturno` y muestra muestras reales; ambas agregan «Como el teléfono» que sigue al sistema en vivo.
  - [ ] Contrastes **recomputados desde tokens** para las pieles que quedan (R-6); el gate de contraste en verde.
  - [ ] Captura cambiando el tema del sistema con la app abierta.

### BL-X5 · AFIP → ARCA en todo texto visible de web
- **Plataforma:** web (+ barrido backend de textos al usuario) · **Tamaño:** S · **Origen:** DA-11 · **Depende de:** `DEC-2`
- **DoD:**
  - [ ] grep de `AFIP` en strings visibles de `apps/copiloto-web/src` y en respuestas del agente al usuario → 0 (los identificadores internos no se renombran).
- **Nota de trazabilidad (A3, H-A3-12):** el cuerpo de #618, su commit y el insumo de backend describen `test_arca_no_afip_visible.py`, con allowlist, guard de huérfanos y barrido de `motor/`. Lo que se mergeó es `test_arca_sin_afip_visible.py`, con exención por archivo (`INTERNOS`). El invariante se cumple igual: A3 lo recomputó por AST (4 strings, 3 internos + 1 equivalencia «ex AFIP») y dio 4/4 en el VPS.

### BL-X6 · Tipografía de la app + retiro de los `.otf` del repo público
- **Plataforma:** web + mobile + repo · **Tamaño:** M · **Origen:** DA-4, §6.1.5 · **Depende de:** `DEC-5`
- **Evidencia:** web `apps/copiloto-web/src/design-system/fonts.css:38-39,79` (`@font-face` a un `.woff2` que no existe) · 9 `.otf` en `docs/Imagen de marca/Neue_Einstellung/` (desde #264) + 1 en `Prototipo frontend/odobi-ui/assets/fonts/`. Mobile **ya la retiró** del bundle por la licencia de app impaga (`apps/mobile/app/_layout.tsx:83-87`; hoy Plus Jakarta Sans + Inter); web la sigue nombrando primero en `--font-display` con su propio TODO «antes de abrir la beta a testers externos» (`fonts.css:32-36`).
- **DoD:**
  - [ ] La fuente decidida cargada en ambas; ningún `@font-face` apunta a un archivo inexistente (test que cruza cada `src` contra lo que baja `fetch-fonts.sh`: los `.otf` no se versionan, así que resolverlos en el test es imposible sin red. *Sustituto aceptado por planificación tras A2.*).
  - [ ] Si la licencia no permite redistribuir: archivos fuera del árbol **y** de la historia según lo que decida `DEC-5` (filter-repo = MAYOR).
  - [ ] Capturas de las dos pieles.

### BL-X7 · Editor de tono «Cómo hablarle» con respuesta de ejemplo
- **Plataforma:** web + mobile · **Tamaño:** M · **Origen:** H-48, H-42, DA-9 · **Depende de:** `DEC-6`
- **Evidencia:** editor sin ejemplo en `negocio/PantallaPerfilNegocio.tsx:409-444` (ambas); web `PantallaComoHablarle.tsx:8-104` es una guía de capacidades.
- **DoD:**
  - [ ] Una sola pantalla de tono (Formalidad / Largo / Nombre) con respuesta de ejemplo que cambia al elegir.
  - [ ] Mi negocio muestra sólo una fila-resumen que linkea ahí (sin editor duplicado).
  - [ ] El ejemplo refleja lo que el agente realmente usa (test que arma el prompt con cada combinación).

### BL-X8 · Onboarding de 2 permisos + primer insight
- **Plataforma:** backend + web + mobile · **Tamaño:** L · **Origen:** H-28, H-29, DA-6 · **Depende de:** `DEC-7`
- **DoD:** se escribe cuando `DEC-7` fije el alcance. Mínimo: alta → hilo de 2 permisos con alcance dicho antes → recibo con un primer dato real del negocio; probado con una cuenta nueva en device.
- **Estado 2026-09-22:** backend ✅ (#558, `K-14`, adversariales en verde en A3). Web está montado, pero como **pantalla completa** (`App.tsx`). Mobile está **sin montar**: `PantallaOnboarding` tiene 0 consumidores (A3, H-A3-5). DEC-7 + `mockups/01-onboarding/DECISIONES.md` fijan que el onboarding es una **conversación en el hilo**, no una pantalla. Resto → `contrato_planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8`, fila 3 + anexo: el hilo en web y mobile, montado en el Guard de `_layout.tsx`, sin tabbar, receipt + completar idempotente y la promesa cumplida con el insight real. `onb-cumplida` → tanda de device.

### BL-X9 · Plan, medidor de acciones y tope
- **Plataforma:** backend + web + mobile · **Tamaño:** L · **Origen:** H-31, H-32, T-7, DA-7 · **Depende de:** `DEC-8`
- **Evidencia:** web `AccountScreen.tsx:106-115` (TODO backend) · mobile `app/ajustes-mi-plan.tsx:1-22` (andamiaje).
- **DoD:** se escribe cuando `DEC-8` fije el modelo. Mínimo: ledger de acciones por tenant con RLS + test adversarial; preguntar no gasta (test); mensaje de tope en el chat con dos salidas del mismo tamaño.

### BL-X10 · Splash, entrada y reveal
- **Plataforma:** web + mobile · **Tamaño:** M · **Origen:** H-01, H-02, H-03, DA-8 · **Depende de:** `DEC-3` (librería)
- **Evidencia:** spec lista `specs/splash-port-reanimated.md`; web `App.tsx:39-46`; mobile `app/_layout.tsx`.
- **DoD:**
  - [ ] Primer ingreso: 4 formas → O (6,8 s); arranques 2..n: isotipo dibujándose; reveal con «se dice o-DO-bi» y botón que reproduce la pronunciación.
  - [ ] Respeta movimiento reducido; no retrasa el TTI medido (callstack-performance).
  - [ ] Video en device de primer y segundo arranque.
- **Estado 2026-09-22:** #616 cubrió los arranques 2..n y `volver`. Falta (barrido BL-Q3 web + A3 H-A3-6): el reveal de primer ingreso (`TEXTOS_REVEAL.primeraVez` tiene 0 consumidores), el Splash de 6,84 s en mobile (hoy dura ~1,5 s), que web no repita el splash después del login, `PRONUNCIACION_MARCA` en las dos apps y el test de movimiento reducido en mobile. **Decisión de planificación sobre la pronunciación:** sin asset no hay botón en ninguna de las dos apps; se retira el TTS del navegador de web, y el audio «o-DO-bi» lo aporta el operador. Está en `contrato_planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8`, fila 2 + anexo.

### BL-X11 · Aplicar las decisiones de Martín posteriores al 07/09 que se acepten
- **Plataforma:** web (mobile ya las tiene) · **Tamaño:** S–M · **Origen:** auditoría §6.3 · **Depende de:** `DEC-2`, `DEC-10`
- **Incluye:** isotipo en el avatar de Soporte · trazo 1,3 del isotipo · logos reales de apps (`logosMarca.ts`; `assets/logos/` falta en el repo) · Calma 3 vs 5 días · cinco íconos provisorios (`mapaIconos.ts:12-16`) · lockup en el login. (corregido 2026-09-21 post-A1: en **web** el avatar de Soporte y los cinco íconos son N/A — no hay Soporte en `apps/copiloto-web`; se acepta el acta de #528. En mobile siguen incluidos.)
- **DoD:**
  - [ ] Cada decisión con acta; las aceptadas, en web; las rechazadas, revertidas en mobile.
  - [ ] Los logos de apps con fuente versionada y licencia de uso de marca anotada.

---

## 9. Backend y plataforma sin pantalla (`BL-B`)

### BL-B1 · Evidencia de durabilidad ante un restart real del worker (E3)
- **Plataforma:** backend · **Tamaño:** S · **Origen:** `Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md:54,58,99,462-491`
- **Evidencia:** el disparador era «el próximo deploy de backend que reinicie el worker por mérito propio». Desde el 13/08 hay **10 commits** en `apps/copiloto`/`motor` desplegados, y `scripts/e2e_g6_durabilidad_worker_restart.py` nunca se corrió después. Es la evidencia del moat del producto.
- **DoD:**
  - [ ] Script corrido contra un restart real (el de un deploy) con una conversación y un HITL en vuelo; ambos retoman sin pérdida.
  - [ ] Salida completa a archivo (no por `tail`) citada en el cierre.
  - [ ] Decidido si se cablea a `deploy.sh` para que no vuelva a quedar sin correr.
  - [ ] **(A3, H-A3-8)** El VERDE del script discrimina por la activity ejecutada (`execute_tool confirmed:true` después del restart). Hoy `_reply_resolvio_el_gate` (`e2e_g6_durabilidad_worker_restart.py:134-138`) da verde también con «Listo 👍». Falta el control negativo corrido, y que el nombre «en vuelo» se sostenga o pase a «continuidad». El hecho de fondo lo verificó A3 leyendo la historia de prod. Está en `contrato_planificacion-a-backend_A3-arreglos-*`, fila 3.

### BL-B2 · Ventana de vida del `FacturaWorkflow` (dictado abandonado)
- **Plataforma:** backend (Temporal) · **Tamaño:** M · **Origen:** `TODO(hito9-dictado-sin-ventana-de-vida, backend, antes de habilitar producción)`
- **Evidencia:** `apps/copiloto/web.py:391` · `apps/copiloto/afip_factura_workflow.py:241` (`wait_condition` sin timeout). La condición de pago del propio TODO («antes de producción») ya se cruzó: la beta está viva. Hoy lo acota sólo la ventana de 15 min por `StartTime` en `web.py:376`.
- **Depende de:** skill `temporal-developer` antes de tocar (regla 3 del repo).
- **DoD:**
  - [ ] Timeout real del workflow introducido con versionado (`workflow.patched`); los workflows en vuelo terminan igual que antes.
  - [ ] Test de replay con la fixture de Factura existente (ADR-003) en verde.
  - [ ] Test que confirma un dictado vencido → estado terminal, y el link directo no lo reanuda.
  - [ ] TODO borrado del código y de `memoria/`.

### BL-B3 · Scanner de secretos antes del push
- **Plataforma:** repo · **Tamaño:** M · **Origen:** gap de `memoria/en-bypasspermissions-solo-sobrevive-permissions-deny.md`
- **Evidencia:** `.githooks/pre-push` sólo sincroniza el grafo; grep de `secret`/`gitleaks`/`trufflehog` vacío. El repo es público desde el 06/08.
- **DoD:**
  - [ ] Scanner (gitleaks o equivalente, versión fijada) en `pre-push` **y** en `scripts/ci/lint.sh`.
  - [ ] Control positivo: un commit de prueba con una credencial falsa con forma real es **bloqueado**; control negativo: los fixtures conocidos (`gphy_test`, `eyJ…` que no decodifican) pasan con allowlist explícita.
  - [ ] Pasada sobre la historia completa con el resultado anotado.
  - [ ] **(A3, H-A3-1)** El hook corre **de verdad** en cada worktree. `core.hooksPath` era absoluto y apuntaba al checkout compartido (114 commits atrás, sin el paso de #601), así que ningún push corría gitleaks. Arreglo: `hooksPath` relativo, más un push de prueba con una credencial sintética que **falla**. Está en `contrato_planificacion-a-backend_A3-arreglos-*`, fila 1; ver la memoria `hookspath-absoluto-apaga-el-pre-push-de-todos-los-worktrees`.

### BL-B4 · `gate.sh` que corra en macOS (bash 3.2)
- **➡️ Movido a post-beta `BL-V16`** por `DEC-1` (acta `:11`, plan `:87`). No se implementa en la beta.
- **Plataforma:** repo · **Tamaño:** S · **Origen:** ADR-001; PR #511–#513 mergeados sin recibo
- **Depende de:** `DEC-1` (si la sesión de Martín sigue implementando).
- **DoD:**
  - [ ] `scripts/gate.sh` y `scripts/ci/*.sh` corren en bash 3.2 (sin `mapfile`, arrays asociativos ni `${var,,}`), verificado con un `bash --version` 3.2 real o contenedor equivalente.
  - [ ] Un PR desde la máquina de Martín trae su recibo.

### BL-B5 · Estado real del gate automático en el servidor (ADR-001 v2)
- **Plataforma:** repo · **Tamaño:** S (decidir) / M (hacer) · **Origen:** ADR-001 §6(e); `scripts/setup-vps-mirror.sh` nunca corrido
- **Evidencia:** el ADR se contradice: fila «✅» en la tabla de estado (línea 204) vs «scripteado pero no verificado con push real» (línea 231).
- **DoD:**
  - [ ] ADR corregido para que diga una sola cosa.
  - [ ] O el mirror se prueba con un push real y queda el recibo, o se acepta por escrito que el gate sigue siendo manual en la beta.

---

## 10. Operación de la beta (`BL-O`)

Lo que hace falta para que testers reales entren, usen y reciban ayuda sin que alguien del equipo esté mirando. Verificado read-only en el VPS `unreal-copilot` el 21/09: `uc-copiloto-web`, `uc-copiloto-worker` y `caddy` activos; `https://copilotoemprendedor.duckdns.org` responde con TLS.

### BL-O1 · Lista de testers y alta por invitación
- **Evidencia:** alta cerrada por invitación, fail-closed (`apps/copiloto/web.py:548-591,1079-1158`, #399); `COPILOTO_INVITE_TOKEN` y `COPILOTO_SIGNUP_ALLOWLIST` seteadas en el proceso vivo (hoy 4 emails).
- **Depende de:** lista de testers del operador.
- **DoD:**
  - [ ] Allow-list ampliada con los testers, desplegada.
  - [ ] Cada tester recibe el link y completa el alta sin ayuda (verificado con el primero).
  - [ ] Un email fuera de la lista es rechazado (control negativo en prod).

### BL-O2 · Google OAuth para testers externos
- **Depende de:** `DEC-12`.
- **Evidencia:** `docs/copiloto-emprendedor/2026-07-21-runbook-oauth-google-propio.md:18,90,92,199` (consent screen en Testing «a propósito») · `motor/clients/agent/providers/composio_gateway.py:190-234` (prefiere config propia, 7 de 8 configs de Composio son `is_composio_managed`, `apps/copiloto/tests/test_composio_auth_config.py:5-9`).
- **DoD:**
  - [ ] Documentado qué pantalla de consentimiento ve el tester al conectar Gmail/Drive (la app propia o la de Composio), con captura.
  - [ ] Según DEC-12: testers cargados como test users, o verificación de Google iniciada con su número de caso.
  - [ ] Login con Google E2E en un navegador real con una cuenta de tester (pendiente de «lo que la auditoría no pudo ver», `PLAN.md:711`).

### BL-O3 · Distribución de la app mobile a testers
- **Evidencia:** `apps/mobile/eas.json` sólo tiene `development` y `preview` (Android, APK, `distribution: internal`); sin perfil `production` ni iOS.
- **Depende de:** `DEC-4`, `DEC-13`.
- **DoD:**
  - [ ] Build `preview` con todo lo nativo pendiente (`BL-C5`), instalado en un Android que **no** sea el de desarrollo.
  - [ ] Instructivo de instalación del APK para testers, probado por alguien que no sea del equipo.
  - [ ] Si DEC-13 dice iOS: perfil y build iOS instalados en un iPhone real.

### BL-O4 · Observabilidad y alertas
- **Evidencia:** en el VPS no hay unidades de Prometheus / Grafana / Alertmanager / `obs-*` / node_exporter; `/opt/uc-repos/alerting-monitor` es el esqueleto sin unidad systemd. Gap ya anotado en `2026-07-06-production-readiness-assessment.md` §3.6.
- **Depende de:** `fleet-platform` (fuente de verdad de `obs-*`; se vendorea con `sync-fleet-platform.sh`, nunca se edita `platform/`).
- **DoD:**
  - [ ] Alertas vivas de: servicio caído (web, worker, Caddy, GoTrue), tasa de errores 5xx, workflows Temporal fallidos, gasto de LLM por día.
  - [ ] Cada alerta disparada una vez a propósito y recibida en el canal del operador (Telegram).
  - [ ] Runbook corto de qué hacer con cada alerta.

### BL-O5 · Backups de la base de producción
- **Evidencia:** WAL-G + Backblaze B2 construidos y **apagados por decisión del operador** hasta que haya clientes reales (`memoria/backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida.md`). No verificado en el host `fusion` en esta pasada.
- **Depende de:** decisión del operador: ¿los testers de la beta cuentan como «clientes reales»? (sus facturas y presupuestos son datos reales).
- **DoD:**
  - [ ] Backups encendidos para Postgres (fusion) y Temporal.
  - [ ] **Restore probado** en una base descartable, con el conteo de filas de una tabla con RLS hecho **con claims**.

### BL-O6 · Términos y privacidad reales, en las dos apps
- **Evidencia:** web `apps/copiloto-web/src/auth/LegalScreen.tsx:5-9,125` es una **plantilla genérica** que se declara así en pantalla; mobile no tiene pantalla legal (grep de términos/privacidad en `apps/mobile` sin resultados relevantes). El assessment de julio lo marca ❌ (§3.5, §3.9).
- **DoD:**
  - [ ] Texto propio que nombra los terceros que ven datos (Composio, ARCA, MercadoPago, proveedor de LLM, Graphity) y qué se guarda (la clave fiscal no).
  - [ ] Aceptación registrada al alta (fecha y versión) en web **y** mobile.
  - [ ] El aviso «plantilla genérica» retirado.

### BL-O7 · Soporte humano: quién contesta y en cuánto
- **Evidencia:** el agente de soporte abre tickets (SOP, cerrado 12/08) y web tiene `MiTicketScreen.tsx:46-153`; no hay SLA escrito.
- **DoD:**
  - [ ] Responsable y horario de atención de tickets escritos.
  - [ ] El texto de `BL-W10` usa ese SLA; un ticket de prueba se contesta dentro del SLA.

### BL-O8 · Acciones pendientes del operador que tocan la beta
- **DoD (cada una se cierra por separado):**
  - [ ] **Token de 60fps.design rotado** — salió del árbol en #505 pero sigue en la historia pública (`39decb95`); la rama `fix/quita-token-mcp-prototipo` (worktree `wt-fe2-tokens`) sigue sin mergear. Es el único secreto vivo conocido en un repo público. (Se lista; no se insiste.)
  - [ ] **ARCA vinculado en `341lin@gmail.com`** o aceptado que el operador factura con `e2e-device` — medido el 15/09: perfil sí, credencial no.
  - [ ] **`DATABASE_URL` de fusion rotada** antes de abrir a externos (`PLAN.md:769`).

---

## 11. Calidad transversal (`BL-Q`)

### BL-Q1 · Control de paridad web ↔ mobile en CI
- **Tamaño:** M · **Origen:** reporte 16/09 §7, auditoría §11.6 (R-2 ya ocurrió tres veces: D-1, H-14 y el lote del 18/09).
- **DoD:**
  - [x] Inventario versionado de `testID` / `data-testid` equivalentes **por pantalla** (`scripts/ci/testid_paridad.py --inventario`; agrupa por el mapeo `modules/<feature>` que web y mobile ya comparten).
  - [x] `scripts/ci/lint.sh` falla si una pantalla tiene un id en una plataforma y no en la otra sin excepción declarada (`--check`, clave `pantalla::id`).
  - [x] Control positivo: borrar un id en una sola app pone el gate en rojo, nombrando `pantalla::id`.
  - [x] Trinquete: el archivo de excepciones sólo puede achicarse — una excepción cuyo id ya no existe o ya tiene su par en la misma pantalla hace fallar el gate ("sacala del baseline"), no se puede acumular en silencio.
  - [x] Ids dinámicos (`testID={...}` / `data-testid={...}`) no se pierden: se cuentan y reportan aparte como "no medidos" (656 usos hoy: 402 mobile / 254 web), nunca como par ni como falta.
  - [x] Baseline inicial: 535 excepciones `pantalla::id` sin triage id-por-id, con dueño y disparador — ver `BL-V17`. Bajó a **484** con #617 (el gate dejó de escanear `*.test.tsx`/`*.spec.tsx`/`__tests__/`: 51 venían de archivos de test, que no son pantallas) y #616 no lo movió (medido en `main` @ `b704a685`).

### BL-Q2 · Smoke E2E completo contra producción
- **Tamaño:** S · **Evidencia:** `deploy/copiloto/smoke_beta_e2e.py`; última corrida con evidencia `37/37` el 13/08 (`Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md:107`); `deploy.sh` sólo corre `/healthz` + un smoke corto.
- **DoD:**
  - [ ] Corrido hoy contra prod con salida completa a archivo; 0 fallas o cada falla con ítem nuevo.
  - [ ] Se vuelve a correr al cerrar cada bloque del plan y antes de invitar testers.

### BL-Q3 · Barrido de device de todo lo marcado ✅ sin ver
- **Tamaño:** M · **Origen:** R-7; `[NO VERIFICADO]` de H-15 (papelera), H-22 y H-25 (un dato por vez), H-35 (chips de estado), H-36 (layout), H-39 (WCAG 1.4.1), H-43 («la clave fiscal no se guarda», vinculación de varios minutos); `PWA` con service worker viejo (`memoria/pwa-sw-staleness-gotcha.md`).
- **DoD:**
  - [ ] Cada una de las 48 pantallas marcada ✅ capturada en device y en el PWA (con `unregister` del service worker + `caches.delete` antes de medir) lado a lado con su `?ver=`.
  - [ ] `fact-voz` y `pres-voz` ejercitados por voz real: el agente pide un dato por vez y no completa un precio no dicho.
  - [ ] Cada diferencia encontrada, ítem nuevo en este backlog.
- **Mitad web medida el 2026-09-22 entre las 02:10 y las 02:11** (prod `index-w80j8z6l.js`, `main` @ `ed4e31c0`, `e2e-device`, SW limpio; capturas fuera del repo, en `C:/gfw-src/_ctl/bl-q3-web/`). Los 54 ids se repartieron así: FE1 35, FE2 19.

  | Sesión | COHERENTE | DIFERENCIA | NO_REPRODUCIBLE_SIN_EFECTO | PENDIENTE_DEVICE |
  |---|---|---|---|---|
  | FE1 (35) | 22 | 1 (`reveal`) | 8 | 4 (`vozchat`, `pres-voz`, `fact-voz`, `cobro-voz`) |
  | FE2 (19) | 7 | 9 | 3 | — |

  (Los números de FE2 salen de recontar su tabla; el resumen de su `dato_` decía 8/8.) Cada diferencia tiene su ítem:
  - `reveal` → BL-X10;
  - el token `cancel:2:0` en el hilo, visto en `hitl` → BL-D4;
  - «$30.000,0000» en `pres-hitl` → BL-D5;
  - `(vacío)` y `tablero` → BL-D6;
  - la barra de 10 pestañas → BL-D7;
  - `apps` → BL-D8;
  - `agenda`, `caida` y la fecha → BL-W11;
  - `ajustes` y `hablar` → BL-W12;
  - `onb-promesa` → BL-X8;
  - `gastos` → verificación: el desglose existe en el código (`ResumenMes.tsx`);
  - `clientes` → BL-V18 (el CUIT ya se muestra).

  **Pasan a la tanda de device del sprint siguiente** (BACKEND fuerza el estado sobre `e2e-device` y lo restaura después): `grabando`, `bloqueado`, `fact-hitl`, `fact-cae`, `recibo`, `card-factura`, `consent`, `bi-vacio`, `vacio`, `vacio-visto`, `onb-cumplida` y los 4 de voz. Precondiciones: `e2e-device` con Google Calendar conectado (A3, H-A3-9; necesita un consentimiento OAuth humano) y el flag de onboarding reseteado.

### BL-Q4 · Contrastes re-medidos sobre los tokens de hoy
- **Tamaño:** S · **Origen:** DA-4 (la auditoría no los re-midió), R-6 · **Depende de:** `DEC-11` para las dos excepciones.
- **DoD:**
  - [ ] Todos los pares **pintados** (no sólo los declarados) computados en las pieles vigentes de cada app; el gate de contraste cubre declarados − cubiertos = 0.
  - [ ] Las dos excepciones con acta (DEC-11) o corregidas.
- **Estado 2026-09-22 (A3, H-A3-10):** web deriva los pares de lo que pinta (`paresPintadosContraste.test.ts:140-183`) ✅. Mobile sigue con el mapa manual `SUPERFICIES`: `temaContraste.test.ts:344-348` lo declara no automatizable, sin acta. Por ahí entró un par nuevo bajo AA que no está entre los 34 escalados: `textoTenue` sobre la burbuja del operador de `PantallaTicket`, 4,381:1 en oscuro. El resto está en `contrato_planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8`, anexo, fila 5. El par se suma a la decisión del operador (CIERREB).

### BL-Q5 · Re-medición de la matriz de 48 pantallas por bloque
- **Tamaño:** S por bloque · **Origen:** reporte 16/09 §11.2, auditoría §11.8.
- **DoD:** [ ] al cerrar cada bloque del plan, auditoría republica la matriz con los veredictos nuevos y la fecha del SHA medido.
- **Estado 2026-09-22 (planificación): PARCIAL — el ítem figura virgen y no lo está.** Se entregaron **29 filas web** re-medidas, pero bajo otro nombre, y por eso ningún cierre las asocia a `BL-Q5`: FE1 publicó 22 filas (`cerrado/2026-09-22/…dato_frontend1-a-planificacion_matriz-web-re-medida.md:56`) más 9 veredictos faltantes en su `v2:7`, y FE2 otras 7 (`…dato_frontend2-a-planificacion_matriz-web-re-medida.md:29`), sobre los SHA `fc37dc3f` (#654) y `34a865a2` (#653). El headline **«matriz web 16/16»** de `abierto/…dato_auditoria-a-planificacion_BIS-mediciones.md:156` **no son 16 de 48**: son las 16 filas que estaban *sin veredicto* (9 de FE1 + 7 de FE2). Los contratos y PRs se titularon `A4-criterio3-cierre-matriz-web`, así que el id nunca aparece en un DoD y el ítem no se auto-cierra — el único rastro que lo nombra es `cerrado/2026-09-22/…avance_frontend1-a-planificacion_A4-estado-8-filas.md:24`.
- **Lo que FALTA, explícito:** la spec son **54 ids**, no 48 (`2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md:34`, salto 48→51→54 en PR #611) ⇒ quedan **25 ids de web sin re-medir** · **mobile entero en 0** (diferido por decisión, §0.2) · y la **republicación la hicieron FE1/FE2, que es justo la fuente que A4 §C invalidó**: el DoD pide que la republique **auditoría**, y ella dejó por escrito que no lo hizo (`Auditorias/2026-09-22-auditoria-A4-cierre-A.md:116`: «A4 muestrea; no re-midió los 54 ids»). **No marcar `[x]` hasta que auditoría republique**: sería el DoD envejeciendo en silencio.

---

## 12. Post-beta — listado para que no se pierda (`BL-V`)

No bloquean la beta. Cada uno con su condición de entrada.

| ID | Qué | Por qué queda afuera | Evidencia |
|---|---|---|---|
| BL-V1 | Presupuesto con el logo y los colores del negocio (`pres-marca`) | El prototipo lo marca **PROPUESTA** de Martín; no existe en ninguna capa (el presupuesto hoy es un Google Doc) | `index.html:3110-3115` · `apps/copiloto/presupuesto_doc.py:1-8` |
| BL-V2 | Plan, medidor y tope, si `DEC-8` lo deja afuera | VISIÓN en el propio prototipo | `index.html:915` |
| BL-V3 | Calendar capa 3: cruce evento ↔ cliente | Nunca contratado | `coordinacion/PLAN.md:804` |
| BL-V4 | Huecos de agenda | Visión | decisión 10 del artefacto de decisiones del 16/09 |
| BL-V5 | Ingesta real al grafo por tenant | Frente MAYOR abierto; hoy la memoria da `[]` a todo tenant real | `apps/copiloto/inteligencia_chat.py:90` |
| BL-V6 | Riesgos de escala: sin pool de Postgres / N+1 (C1), Composio sin caché (C7), firma que ignora el payload (C8), 4 errores tragados sin log, `print` de datos personales en `agent_activities.py:114` | No bloquean a 1–15 testers según el propio documento; **el `print` de datos personales conviene revisarlo antes** si hay testers reales | `Auditorias/2026-08-12-reverificacion-beta.md` |
| BL-V7 | Pentest, chaos y carga con usuarios reales; tasa de falla del agente de voz a escala | Necesitan volumen real | `coordinacion/PLAN.md:711` |
| BL-V8 | Revocar en MercadoPago al desconectar | Sólo si se promete como garantía | `apps/copiloto/mp_credential_store.py:73-76` |
| BL-V9 | `DROP COLUMN sheet_fila` | Paso 2 irreversible; espera OK del operador | `apps/copiloto/presupuesto_store.py:65-71` |
| BL-V10 | Fixtures de replay para los 7 workflows restantes | Diferido por riesgo (ADR-003 §4c) | `docs/copiloto-emprendedor/adr/2026-08-13_ADR-003…md:87-93` |
| BL-V11 | D9: EPERM intra-run del gate | Oportunista, sin disparador | `Auditorias/2026-08-12-DEUDA-…md` |
| BL-V12 | Dos suites lentas de mobile (`testTimeout=20000`) | No bloquea; requiere profiling | `apps/mobile/jest.config.js:120-155` |
| BL-V13 | Memoria busca top-10 por similitud | Deuda condicional no disparada | `apps/copiloto/inteligencia_chat.py:130-135` |
| BL-V14 | TODO muerto del guardrail de narración | Cosmético | `motor/backend/agent/conversation_workflow.py:548` |
| BL-V15 | Config OAuth propia de Google en Composio (branding propio) | Funciona con la de Composio; sale de `DEC-12` si se decide | `composio_gateway.py:190-234` |
| BL-V16 | `gate.sh` y `scripts/ci/*.sh` en bash 3.2 (macOS), ex `BL-B4` | `DEC-1`: Martín diseña y no commitea código; vuelve si eso cambia | `scripts/gate.sh` · acta `DEC-1` |
| BL-V17 | Triage id-por-id de las 484 excepciones `pantalla::id` del baseline de `BL-Q1` (drift preexistente al encender el gate, cada una con motivo genérico de baseline, no un motivo real por caso) | El gate en verde no exige triage inmediato; sólo exige que no crezca más (trinquete). Dueño: backend. Disparador: la próxima vez que alguien toque la pantalla que contiene la excepción | `scripts/ci/testid-paridad-excepciones.json` (484 entradas tras #617, `main` @ `b704a685`, 2026-09-22) |
| BL-V18 | Cantidad de comprobantes por cliente en la lista de Clientes (`clientes` del prototipo) | La API de clientes no la expone. El CUIT/DNI sí se muestra cuando existe | barrido BL-Q3 web (FE2) · `apps/copiloto-web/src/modules/clientes/TarjetaCliente.tsx:48-59` |
| BL-V19 | Persistir los metadatos de voz del mensaje (origen + duración), para que el chip «Por voz · m:ss» sobreviva a recargar el hilo | Para la beta el chip se dibuja en el cliente (BL-J7, H-A3-7); la duración no viaja al backend | A3 §1, fila BL-J7 |
| BL-V20 | Alinear al prototipo final las divergencias de **patrón** que declaró la matriz web A4 de FE2: `detalle` (pestañas + filtros en «Para hoy» vs lista simple; sin composer embebido en Mi día; Entró/Salió/Por cobrar en texto vs chips) · `ingresos` (botón «Actualizar» y fecha en el encabezado; sin ícono por ítem; «Borrar» visible; montos con decimales; sin composer embebido — el aviso de MercadoPago sí está, bajo el pliegue) · `negocio` (campos sueltos vs card envolvente; etiquetas en pregunta vs mayúsculas; «¿A quién le vendés?» `select` vs texto libre; título duplicado; «el copiloto» vs «Odobi») · `afip` (asistente numerado vs página de ajustes; sin la línea «● ARCA vinculada · CUIT») · `cuenta` (título, enlace «‹ Ajustes», subtítulo, secciones reorganizadas) | Las cinco pantallas funcionan y cada diferencia está declarada con su causa: son decisiones de forma tomadas al construir, que el prototipo del 17–18/09 cambió después. Se alinean cuando Martín cierre su prototipo final (`BL-P2`). «Cambiar el mail» no entra acá: ya es `[DIFERIDO_CIERRE_B]` por K-12 | `dato_frontend2-a-planificacion_matriz-web-re-medida.md` (2026-09-22) · A4 §C, filas `negocio`/`cuenta` ✅ con la misma vara |
| BL-V20b | Rótulo y chip del CUIT en `afip`: prod muestra «CUIT 20-11111111-2» + botón **«Cambiar»**, sin el chip «Bloqueado»; el proto (`prototipo/index.html:2316-2318`) muestra «[Bloqueado]» + «Necesito cambiarlo ›» | **La matriz web cierra 16/16** (M-2, 2026-09-22): `cuitBloqueado=true` y el input NO es editable, así que la conclusión de FE2 («no cuenta como defecto») **se sostiene** — lo que no se sostenía era su causa («no verificable, tenant no vinculado»: el tenant SÍ está vinculado). La causa correcta ya estaba escrita en `specs/mobile-coherencia.md:198` (fila A-3): **el prototipo se contradice** —sus reglas dicen bloqueado sin acción y su render muestra «Necesito cambiarlo ›»— y el código siguió al render en el PATRÓN, no en el literal. **No es decisión de UX: tiene implicancia fiscal y está abierta en el operador.** Estas dos diferencias quedan SUBORDINADAS a A-3: si se decide «sin salida», el botón desaparece y el rótulo es irrelevante. **No amerita trabajo antes de esa decisión** | A4-bis ítem 3 + M-2 · `PantallaAfipSetup.tsx:370-383` |
| BL-V21 | Paridad del landing de **Facturación en mobile** con el fix web de `H-A4-5`: hoy `apps/mobile` auto-crea el borrador al montar la pantalla, en vez de aterrizar en el resumen + las emitidas y abrir el wizard desde «Nueva factura» | **Diferida a la tanda de device del sprint siguiente** (orden del operador, 2026-09-22). No es el mismo bug que se arregló en web: en mobile es un diseño intencional distinto, fijado por ~15 tests que el port rompería — necesita decidir el contrato antes de tocarlo, y verificarse en device. La cita de la auditoría («mismo patrón que mobile», `PantallaFacturacion.tsx:428`) está en el archivo **web**, nombrando a mobile como origen del patrón; no es una nota escrita en mobile | A4 `H-A4-5` (§3 `factura`, §5) · `avance_frontend1-a-planificacion_A4-estado-8-filas.md` (2026-09-22) · web cerrada en #644 |
| BL-V22 | **Bloqueo real del push de secretos (server-side).** A4-bis probó con un push REAL que con `core.hooksPath` apuntado a otro árbol git **no invoca** `.githooks/pre-push`: el commit con secreto sintético entró al remoto (caso 1c, rc=0; control 1d limpio también entró, así que los rechazos de 1a/1b prueban algo). El repo es **público** y GitHub tenía `secret_scanning` y `secret_scanning_push_protection` **disabled** cuando se midió; el operador los activó el mismo día y hoy los dos leen **`enabled`** (re-medido por API 2026-09-22 post-reboot). **Lo que sigue apagado es `secret_scanning_non_provider_patterns`**, así que push protection sólo intercepta el **catálogo de proveedores** — no un `.env` ni un token interno, que son justo los que este repo usa | **No es un bug del hook.** El hook está bien escrito y es fail-closed; el techo es de la capa: ningún hook local puede defenderse de que git no lo invoque. Detección ya cubierta por dos capas independientes (`scripts/gate.sh:105-111` #649, con control negativo; y `scripts/vigilancia-check.sh:87-105` en el cron de 3 min, con test de 3 casos) — lo que falta es **bloqueo**, que sólo puede ser server-side. Es gratis en repos públicos. **Escalado al operador** (Telegram 2026-09-22, msg 25) porque el `PATCH` lo bloquea el clasificador de permisos — y **lo activó**. Residual: `non_provider_patterns`, que el operador decidió encender **al terminar el sprint**, no antes, porque sus falsos positivos frenarían pushes legítimos. **DoD:** push protection habilitada + re-corrida del fixture 1c contra el remoto real → rechazado por el servidor | A4-bis ítem 1 (`a4bis-h1-push-y-gate.log`, refs `rama-a2 rama-b2`) · el Cierre A afirmaba «ya no apaga el hook en los demás worktrees», y **esa frase es falsa**: 1b prueba otra cosa (que el segundo worktree hereda bien el hook cuando el `hooksPath` es relativo) |
| BL-V23 | **Agenda le dice «Conectá» a quien ya había conectado.** Cuando la conexión con Google Calendar se CAE, Mi día dice «se cayó… Reconectar» y Agenda dice «conectá Google Calendar en Ajustes → Apps» | **Medido por auditoría (M-1, 2026-09-22) y reducido respecto del reporte inicial: no son «dos estados contradictorios», es una pantalla que no consulta la señal que desempata.** Las dos leen `GET /mi-dia/calendario` (`conectado:false`) y las dos aciertan; Mi día además lee `GET /catalog`, donde `googlecalendar` es `status:"caido"` mientras los otros 5 servicios son `nunca_conectado` — el backend distingue, y a favor de Mi día. El desempate está en `MidiaScreen.tsx:323-337` y documentado como deliberado en `:305-312` (BL-W11 4b); `AgendaScreen.tsx:91-95` tiene el caso único y nunca se portó. **El fix ya existe a 40 líneas de distancia.** Impacto: guía, no dato — le pierde al usuario la acción correcta («Reconectar»). **Y la fila `agenda` de FE2 NO se cerró sobre premisa falsa:** «el tenant no tiene Calendar vinculado» es VERDADERO; lo incompleto es el porqué. No es el caso de `afip` | A4-bis H-BIS-2 + `dato_auditoria-a-planificacion_BIS-mediciones.md` (3 fuentes crudas de prod, con control negativo propio en los otros 5 servicios) |
| BL-V24 | **Con una hoja de conexión abierta, el envío NO SALE** — la fila era «la latencia de `pres-hitl` no es constante» y la medición la reclasificó | **Lo que decía era el síntoma equivocado.** Auditoría midió (B-1, con control de 0 tomado en cada sesión): 1 pendiente = **1,4×**, 2 pendientes = **3,2×** — sí escala, y cada pendiente cuesta más que la anterior, así que el problema es el *costo por pendiente*, no «no dejes ninguna abierta». El tiempo vive **entero en el backend**: el payload mide **490 B en las cuatro condiciones**, o sea con pendientes no vuelve más contenido, vuelve el mismo resultado más tarde — descarta transferencia y serialización sin abrir el backend. **Y el «>151 s» original no era lentitud:** el timeout ocurrió en el *clic de enviar*. Tratarlo como latencia habría llevado a subir un timeout para tapar un composer bloqueado → ver `BL-V29` | A4-bis H-BIS-4 + `dato_…BIS2-latencia-y-barrido.md`. Candidato NO medido del costo por pendiente: `HISTORY_TAIL = 54` (`conversation_workflow.py:49` + `:502`) — declarado como hipótesis, no como causa |
| BL-V25 | (menor, pulido) El detalle de presupuesto deja leer el resumen por detrás: `.detalle-presupuesto` tiene fondo con alpha 0,95 y **`backdrop-filter: none`** | El texto del detalle se lee bien igual — es pulido, no legibilidad. Auditoría descartó antes los dos artefactos de instrumento posibles: reproduce en captura de **viewport** (no sólo `fullPage`) y **con GPU** habilitada, y no hay `backdrop-filter` que el headless pudiera estar omitiendo | A4-bis H-BIS-5 |
| BL-V26 | (higiene menor, **reducida al verificarla**) Dos feedbacks de instrumentación conviven en «LO PEDISTE VOS» con los del usuario | **La formulación anterior pedía algo que ya existe.** Decía «decidir si las corridas futuras marcan sus escrituras»: la marca **ya existe y es única** — el único sitio del repo que escribe un feedback de evidencia es `scripts/evidencia/fe1-ola1-pwa.mjs:28`, con prefijo `[e2e <ID> <ISO>]`, y los dos de prod son dos corridas del mismo script. **Y sospeché que el muro era cross-tenant: me equivoqué.** `/feedback` filtra con doble barrera — `web.py:882-886` (`Depends(require_tenant)`, el tenant sale del token) + `feedback_store.py:41` (`WHERE cliente_id`) + RLS ENABLE/FORCE con policy `tenant_isolation`. Lo que se ve es el **tenant de prueba ensuciando su propio sandbox**, no contaminación entre usuarios. Queda como higiene: borrarlas muta prod (necesita autorización) y destruiría la evidencia | Verificado 2026-09-22 por planificación. El hallazgo real que salió de mirarlo está en `BL-V28` |
| BL-V27 | La fila `afip` de la matriz web cierra como **diferencia declarada — con otra causa que la registrada** | **El veredicto de FE2 se sostiene; su causa no.** No es «no verificable porque el tenant no está vinculado» (falso: está vinculado y prod lo renderiza — «Tu cuenta ya está vinculada con ARCA en Homologación», CUIT bloqueado, botón presente). La causa real ya estaba escrita hace días en `Prototipo frontend/odobi-ui/specs/mobile-coherencia.md:198` (A-3): **el prototipo se contradice consigo mismo** —sus reglas piden «bloqueado, sin acción» y su render muestra «Necesito cambiarlo ›»— y la decisión **tiene implicancia fiscal, no la toma frontend**. Escalada al operador (Telegram msg 26). Subordinados a esa decisión, sin trabajo antes: rótulo «Cambiar» vs «Necesito cambiarlo ›» y chip «Bloqueado» ausente (`PantallaAfipSetup.tsx:370-383`) — si decide «sin salida», el botón desaparece | Medición M-2 de auditoría. **Matriz web: 16/16 con veredicto.** Lección en `memoria/un-cierre-correcto-por-la-causa-equivocada.md` |
| BL-V28 | ✅ **CERRADA 2026-09-22** — `GET /feedback` ya tiene test adversarial HTTP | `test_adversarial_http_feedback_a_cannot_read_b_feedback` en `test_adversarial_multitenant.py`, PR **#660** squash `847ec197`, CI 6/6, gate local `ab7e7522` 5/5 `sucio:false` ✅ CUBRE, suite VPS 2088 passed / 27 skipped. Test-only, sin deploy. **El control positivo dejó un hallazgo que vale más que el test:** romper sólo el `WHERE` interno salió **VERDE** —RLS FORCE lo enmascara— y sólo romper `require_tenant` dio rojo. O sea: un control de dos capas **no se puede validar rompiendo la de adentro**, y quien lo intente va a leer el verde como «el test no sirve» en vez de «hay defensa en profundidad». Backend declaró qué rompió y qué color dio cada capa, que es exactamente la forma correcta | Barrido del mismo patrón que backend dejó abierto → `BL-V33` |
| BL-V29 | 🔴 **La hoja de conexión deja la app inusable para quien vuelve** — DOS defectos que se potencian | **(1) «Ahora no» no persiste:** clic real verificado con `elementFromPoint` *antes* de tocarlo; cierra, se recarga y **vuelve**, con el composer tapado por `div.sheet-conexion__acciones`. Control: con Escape da idéntico ⇒ es producto, no el instrumento. localStorage: 27 claves antes y después, ninguna nueva — con control positivo de que la app sabe persistir esto (las claves `*-propuesto-resuelto:assistant-<id>` que sí conviven). Causa: `useConexionRequerida.ts:63` (`useState(new Set())`) contra `useChat.ts:116-138`, que persiste los mensajes: al recargar vuelve el historial sobre un set vacío. **(2) A 390 px el botón es intocable:** la tab-bar cubre «Ahora no» entero (`pctTapado=100`, franja libre **0 px**) y en táctil no hay Escape. **Juntos: el usuario móvil que vuelve no tiene camino previsto de salida y el chat no acepta escribir.** El fix ya existe en otro call-site: `resolucionCardPropuesta.ts` (#419) resolvió esto para las 4 tarjetas `*_propuesto` y la hoja nunca entró al barrido | Contrato a FE2, por encima de su cola. **No medido:** si reaparece sin recargar · si el swipe-down cierra en móvil |
| BL-V30 | ✅ **BARRIDO CERRADO 2026-09-22** — **2 hallazgos reales en web**, y el patrón no era uno sino **dos** | Sujeto `origin/main` `847ec197`, 264 archivos, 435 declaraciones, **dos controles positivos en verde**. **Lo que reencuadra todo:** conviven dos soluciones probadas al mismo defecto — **A** `resolucionCardPropuesta.ts` (#419, marca en `localStorage` por `mensajeId`, 4 tarjetas de web) y **B** `hitlRespondido` (H-A4-9, la marca va **dentro del mensaje persistido**; lo usan web y mobile, `useChat.ts:82` lo dice textual). La hoja de conexión de `BL-V29` **no usa ninguno, teniendo los dos en su propio módulo**. Los 2 reales: (1) `TarjetaFacturaPropuesta.tsx:77/81` — es la **quinta** tarjeta del chat y sólo 4 importan el guard: tras recargar vuelve a pedir «Emitir» sobre una factura que **ya tiene CAE**; (2) `SeccionMisComprobantes.tsx:85` — recargar entre «Sí, anular» y «Confirmar» pierde el `anulacionId` y reaparece «Anular». **Ninguno de los dos duplica la acción**, y eso lo verificó auditoría en vez de heredarlo: `confirmarConTokenFresco` es fail-closed, y la anulación es idempotente en el **servidor** (`web.py:423-429`, workflow id determinístico por comprobante con `USE_EXISTING`) — el sub-agente lo había dejado como riesgo fiscal no descartado y habría reportado una nota de crédito duplicada **que no existe** | 17 candidatos + 33 dudosos triados como transitorios con evidencia caso por caso. `App.tsx:49 onboardingCerrado` **bien resuelto** (POST al backend, la condición vuelve de `me.onboarding_completado`). Del instrumento: v1 buscaba por nombre de variable y **su control lo reprobó** (veía 1 de 4); y `origin/main` avanzó un commit durante el barrido — re-corrido sobre el nuevo, mismos 19 |
| BL-V31 | 🔴 **`apps/mobile` no tiene el guard A en NINGUNA de sus 5 tarjetas** — y es la app que va a beta en device | Barrido con ámbito `apps/mobile/src` y **las 4 tarjetas de web metidas adentro como canario**, para que el control positivo viaje en la misma corrida en vez de comparar dos salidas: 191 archivos, 433 declaraciones, `CUBIERTO = 8` y **las 8 son de web**. Mobile: cero. Los 5: `useConexionRequerida.ts:42` (**el mismo defecto que se midió en prod web hoy** — es lógica, no layout: el device no lo salva) · `TarjetaFacturaPropuesta.tsx:74` · `TarjetaGastoPropuesto.tsx:39` (**en web esta SÍ está cubierta**) · `TarjetaPresupuestoPropuesto.tsx:76` (la que **ya generó un presupuesto duplicado en prod** antes del guard de web) · `SeccionMisComprobantes.tsx:75`. **Costo: 5 lugares, no uno** — `TarjetaPropuestaShell.tsx:19-26` declara «los estados TERMINALES no entran acá… cada tarjeta tiene los suyos», así que no hay punto único donde persistir. **La deuda ya estaba anotada… dentro de un comentario de web** (`TarjetaPresupuestoPropuesto.tsx:20-27`) y nunca salió a un tablero: por eso esta fila existe. **Precondición: `BL-V32`** — propagar A sin poda multiplica la fuga por 5 | Código mobile, entra al sprint (lo que sale es device/EAS). **Límite declarado por auditoría:** el resto de candidatos de mobile son espejo exacto de los transitorios de web pero **no se leyeron uno por uno** — analogía, no verificado |
| BL-V32 | ⚖️ **Decisión de diseño ANTES de propagar: el guard A no tiene poda** — y la poda tiene un punto único que ya existe | El guard A escribe `${prefix}:${mensajeId}` en `localStorage` y **nada borra**; `useChat.ts:446` borra los mensajes de la sesión previa (`removeItem(messagesStorageKey(previous))`) y **deja sus marcas huérfanas** — en el navegador de la corrida ya había ~20 claves acumuladas. El guard B no tiene el problema: la marca vive **dentro del mensaje**, así que muere con él. **Decisión (planificación, 2026-09-22, verificada en el archivo, no por analogía):** (1) para todo estado nuevo del tipo «el usuario ya descartó / ya resolvió esto», **preferir B** cuando el estado pertenece a un mensaje persistido — cero fuga por construcción; (2) A se conserva donde ya está (no invalidar claves de browsers reales, que es justo por lo que #419 reusó el prefijo viejo) y **su poda se ata a `useChat.ts:443-447`**, el único punto del código que ya borra estado de sesión previa: leer los ids de los mensajes **antes** del `removeItem` y borrar `${prefix}:${id}` por cada prefijo conocido — determinístico y sin tocar la sesión viva; (3) **no propagar A a mobile sin (2)**. **DoD:** poda implementada + test que deja marcas, resetea sesión y verifica que `localStorage` vuelve al conteo previo (**control positivo: sin la poda, ese test tiene que dar rojo**) | Bloquea `BL-V31`. Planteado por auditoría antes de que el pedido fijara la decisión — correcto: el pedido la habría congelado |
| BL-V33 | **Tres endpoints más con el patrón store-only: control implementado, caso hostil sólo a nivel store** | Barrido que backend dejó explícito al cerrar `BL-V28`, para batchear en un PR: `GET /catalog` (`web.py:1067` → `MpCredentialStore.salud`) · `DELETE /mp/connection` (`web.py:1157` → `MpCredentialStore.delete_all`, **agrava: es mutación**, no lectura) · `POST /me/onboarding/completar` (`web.py:1042` → `TenantOnboardingStore.completar`). Mismo razonamiento que `BL-V28`: el test de store recibe el `cliente_id` **ya resuelto** y por lo tanto no ejercita `require_tenant`, que es la pieza que decide de quién es el request. **DoD:** un test HTTP adversarial por endpoint + control positivo **rompiendo `require_tenant`** (romper el `WHERE` interno queda enmascarado por RLS FORCE — medido en #660, no repetir el intento a ciegas). Menor de la misma corrida: el test HTTP de `/me` **nunca ejercita `onboarding_completado=True` en A**, cobertura parcial de esa dimensión | `cerrado/2026-09-22/…_cierre_backend-a-planificacion_feedback-test-adversarial-http.md` |
| BL-V34 | 🔴 **Anotar un gasto dos veces crea dos gastos** — y presupuesto igual, por otra causa | **Gastos no tiene idempotencia en NINGUNA capa.** Verificado con control positivo del grep (`cobro_store.py` 30 hits · `cliente_store.py` 3 · gasto **0** en front, `packages/core/src/api/gastos.ts`, `gasto_store.py`, `gastos_web.py` y la migración; el único hit era la palabra «Idempotente» en un comentario **sobre la migración**). Como la card remonta accionable tras recargar (`BL-V31`), el segundo «Guardar» **inserta plata duplicada, sin pregunta y sin 409**. **Presupuesto es otro caso y se arregla más barato:** el backend YA tiene `idem_key` + índice único parcial y el front YA la manda — el defecto es que **la clave nace con el montaje** (`useRef(generarId())`: web `:104`→`:177`, mobile `:125`→`:231`), así que al remontar es otra y el backend la ve como intención nueva. ⚠️ **El que duplica es el de MOBILE**; web está tapado por el guard A, así que un fix sobre `:177` sale verde y deja el daño intacto. **Causa de clase:** las claves cubren «un gesto con reintentos», no «la misma intención re-disparada desde una card que sobrevivió a la app» ⇒ **derivarla del `mensajeId`** arregla ambas sin almacenamiento nuevo ni claves que podar. **DoD:** montar→guardar→DESMONTAR→montar y no poder volver a guardar, **escrito contra mobile primero**; control positivo obligatorio (sin el fix, ROJO) — los 5 tests de esas tarjetas existen y **ninguno monta dos veces**, así que el verde actual no dice que esté bien, dice que nadie preguntó | Contrato de junta bajado 2026-09-22 (backend + FE1/FE2). El repo ya registra el daño ocurrido: «un click en Guardar generaba un presupuesto duplicado en prod» |
| BL-V35 | (media) **La ventana anti-duplicado de cobros mira la fecha DICTADA, no la de creación** | `cobro_store.py:409-426` filtra `fecha >= CURRENT_DATE - 5`. Dictar un cobro con fecha de más de 5 días atrás y repetirlo tras reiniciar **escapa a los dos guardas**, porque ambos miran esa misma ventana. Pide fecha vieja + reinicio + volver a tocar Guardar, por eso no es alta. Entra en el PR de `BL-V34` si no lo complica | Hallazgo de auditoría, barrido 2026-09-22 |
| BL-V36 | ✅ **CERRADO** — (alta) **El gate verificaba A DÓNDE apunta el hook, no QUÉ contiene** | #649 dejó `gate.sh` fail-closed sobre `core.hooksPath`, y está bien — pero un árbol anterior a #601 tiene `.githooks/pre-push` **y** `core.hooksPath=.githooks` (las dos condiciones en verde) con un hook **sin escáner**: corre entero y no escanea nada. No es teoría: M-3 caso C lo midió con un push real y el commit con el secreto **entró al remoto**, con el log mostrando que el hook corrió. **4 de 26 árboles vivos** estaban así, **el checkout compartido entre ellos**. **Fix:** `gate.sh` agrega un check de CONTENIDO (`grep` de `secretos-check` descartando comentarios — si no, el guard se satisface con la mención en un comentario del propio hook). **DoD:** `scripts/tests/test-gate-hook-secretos.sh`, 4 casos, con control negativo (hook completo ⇒ no grita) y aislamiento (hooksPath mal ⇒ grita el de #649, no éste) | Hallazgo propio de planificación 2026-09-22, cuantificado por auditoría en M-3 (H1). Regla operativa mientras tanto: **no se pushea desde el checkout compartido** |

---

## 13. Criterio de cierre de la beta

La beta está lista cuando **todo** esto es verdad a la vez, medido sobre un mismo SHA de `main`:

1. Todos los `DEC-*` tienen acta (resueltos o explícitamente pospuestos con su ítem movido a §12).
2. Todos los `BL-P`, `BL-D`, `BL-C`, `BL-W`, `BL-F`, `BL-J`, `BL-B`, `BL-O` y `BL-Q` cerrados con su DoD, y los `BL-X` cuya decisión los mantuvo en la beta.
3. La matriz de pantallas re-medida (`BL-Q5`) da ✅ en web y mobile para **todas las pantallas marcadas spec** en `BL-P5` — la lista es [`2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md`](2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md) §2, **54 ids** —, contra el prototipo final de Martín (`BL-P2`).
4. `smoke_beta_e2e.py` en verde contra prod (`BL-Q2`) y durabilidad demostrada (`BL-B1`).
5. Un tester que no es del equipo completa, sin ayuda y en su propio teléfono: alta → conectar una app → dictar un gasto → emitir una factura en homologación → pedir soporte. Con video.

---

## 14. Trazabilidad — cada hallazgo de la auditoría y su ítem

| Hallazgo | Ítem(s) | | Hallazgo | Ítem(s) |
|---|---|---|---|---|
| H-01, H-02, H-03 | BL-X10 | | H-27 | BL-J9 |
| H-04 | BL-W8, BL-J2, BL-J3, BL-X1 | | H-28, H-29 | BL-X8 |
| H-05 | BL-X1, BL-X2 | | H-30 | BL-J8 |
| H-06 | BL-W7, BL-J5 | | H-31, H-32 | BL-X9 / BL-V2 |
| H-07 | BL-J13 | | H-33 | BL-J7 |
| H-08 | — (sin brecha) | | H-34 | ✅ mobile; mic en BL-J7 |
| H-09, H-10 | BL-W5 | | H-35, H-36 | BL-Q3 |
| H-11 | BL-J4 | | H-37 | BL-X2 |
| H-12 | BL-W4 | | H-38 | — (sin brecha) |
| H-13 | BL-C3 | | H-39 | BL-W6 |
| H-14, D-2 | BL-D2 | | H-40 | BL-J6 |
| H-15 | BL-W1 | | H-41 | BL-X1 |
| H-16, H-17 | BL-J7 | | H-42 | BL-J10, BL-X7 |
| H-18 | BL-C4 | | H-43 | BL-C6, BL-Q3 |
| H-19 | BL-X3 | | H-44 | BL-C1, BL-W2 |
| H-20, D-3 | BL-D3 | | H-45 | BL-C5 |
| H-21, H-23 | BL-F1 | | H-46 | BL-J11 |
| H-22, H-25 | BL-Q3 | | H-47 | BL-X4 |
| H-24 | BL-C2 | | H-48 | BL-X7 |
| H-26, D-1 | BL-D1 (+ BL-J1) | | H-49 | BL-W9 |
| `cobro-voz` | BL-F2 | | H-50 | BL-W10 |
| `fact-sinarca` | BL-P6 | | H-51 | BL-W3, BL-J12 |
| `pres-marca` | BL-V1 | | `limite` | DEC-8, BL-P5 |

**Barrido BL-Q3 web (2026-09-22) y auditoría A3 (#622):**

| Hallazgo | Ítem(s) | | Hallazgo | Ítem(s) |
|---|---|---|---|---|
| `hitl`: token `cancel:` en el hilo | BL-D4 | | H-A3-1 | BL-B3 |
| `pres-hitl`: 4 decimales | BL-D5 | | H-A3-2, H-A3-4 | BL-J8 |
| `(vacío)`, `tablero` | BL-D6 | | H-A3-3 | ADR-003 (contrato backend A3, fila 4) |
| barra de 10 pestañas | BL-D7 | | H-A3-5 | BL-X8 |
| `apps` | BL-D8 | | H-A3-6 | BL-X10 |
| `agenda`, `caida`, fecha de Mi día | BL-W11 | | H-A3-7 | BL-J7, BL-V19 |
| `ajustes`, `hablar` | BL-W12 | | H-A3-8 | BL-B1 |
| `reveal` | BL-X10 | | H-A3-9 | BL-Q3 (precondición de device) |
| `onb-promesa` | BL-X8 | | H-A3-10 | BL-Q4 |
| `clientes` | BL-V18 | | H-A3-11 | BL-J11 |
| `gastos` | verificación (FE2, fila 7) | | H-A3-12 | BL-X5 (nota) |
