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
- **DoD:** [ ] contrato viejo en `cerrado/<fecha>/` con nota de reemplazo; [ ] contrato nuevo en `abierto/` citando este backlog.

### BL-P5 · Marcar spec vs visión en el mapa del prototipo
- **Qué:** P-3. `mapa.html:97` presenta `plan` como spec aunque `index.html:915` dice VISIÓN; `limite`, `pres-marca`, `fact-sinarca` y `cobro-voz` no figuran en el mapa. Sin esto, «48/48 coherentes» se mide contra pantallas que nadie va a construir.
- **Depende de:** `BL-P2` (sobre la versión final), DEC-8.
- **DoD:** [ ] cada `?ver=` del prototipo clasificado spec / visión / propuesta en un solo lugar; [ ] el criterio de cierre del frente (§13) cita esa lista.

### BL-P6 · Corregir `fact-sinarca` en el prototipo
- **Qué:** el hilo muestra facturar con un solo comando de voz y CAE inmediato, sin confirmación. El producto **prohíbe** emitir sin HITL: `apps/copiloto/tool_catalog.py:267-269` («NO la emite: la deja lista para que él la revise») y `kb-usuario/chat.md:96-98` («No emite una factura solo con la voz»). El hilo real es `fact-voz` → `fact-hitl` → `fact-cae`. No se implementa: se corrige el prototipo.
- **DoD:** [ ] Martín ajusta o retira el hilo; [ ] queda anotado en el acta (`BL-P3`).

### BL-P7 · Cerrar los mensajes viejos de `abierto/`
- **Qué:** 8 `avance_`/`dato_` del 07–08/09 ya materializados siguen en `abierto/` (el barrendero no los movió). Ruido que esconde lo vivo.
- **DoD:** [ ] cada uno movido a `cerrado/<fecha-original>/`; [ ] `abierto/` sólo contiene trabajo vivo.

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
  - [ ] Paridad de campos con web: ícono + label del servicio, PARA, MONTO, badge de riesgo, preview, aviso «no se puede deshacer» con borde de alerta.
  - [ ] Test de componente: un gate irreversible **exige** el aviso; uno reversible no lo muestra.
  - [ ] Device: captura de un HITL irreversible real (p. ej. mandar un mail) lado a lado con `?ver=hitl`.

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
  - [ ] El formulario muestra el origen para los cuatro valores en ambas apps.
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
  - [ ] Test unitario del mapeo `regla → categoría`; captura en el PWA.

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
  - [ ] Mobile renderiza `payment_link` con monto, vencimiento y acciones Copiar / Compartir (share sheet nativo).
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
  - [ ] Saldo del mes anterior (o delta) expuesto; la portada muestra la variación con «—» si falta.
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
  - [ ] El dispatcher acepta un contexto de función **opcional**; sin él, la ruta del chat queda idéntica (test de regresión del dispatcher en el VPS antes de tocar FE).
  - [ ] Mic en la fila del rótulo de Gastos, Ingresos, Presupuestos y Clientes; la card propuesta aterriza en esa pantalla, no en el hilo.
  - [ ] Foto del ticket como disparador directo desde Gastos.
  - [ ] Chip «Por voz · duración» en la card (H-17): la duración viaja en el mensaje.
  - [ ] Device: dictar un gasto desde Gastos y verlo aterrizar ahí; captura lado a lado con `?ver=card`.

### BL-J8 · Consentimiento en contexto (`requiere_conexion`)
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-30 · **Pantalla:** `consent`
- **Evidencia:** `apps/copiloto/dispatcher_emprendedor.py:279-283` (responde texto «Andá a Conexiones…»).
- **DoD:**
  - [ ] El dispatcher emite un gate estructurado `requiere_conexion` con servicio y alcance.
  - [ ] Sheet en contexto con el alcance por permiso, Conectar / Ahora no, y el hilo visible detrás; al conectar, el pedido original se reanuda.
  - [ ] Device: pedir algo de Gmail con Gmail desconectado → sheet → conectar → se ejecuta.

### BL-J9 · Acciones sugeridas tras guardar o aprobar un presupuesto
- **Plataforma:** backend + web + mobile · **Tamaño:** M · **Origen:** H-27 · **Pantalla:** `pres-ciclo`
- **Evidencia:** `apps/copiloto/tool_catalog.py:367,1201-1259` (`marcar_presupuesto` sin sugerencia); grep de «Armá la factura» / «Mandalo por mail» vacío en ambas apps.
- **DoD:**
  - [ ] La respuesta de guardar trae «Mandalo por mail» / link al Doc; la de aprobar trae «¿Te armo la factura?» con chip.
  - [ ] Tocar «Armá la factura» abre la propuesta de factura con los ítems del presupuesto (HITL normal).
  - [ ] Decisión explícita en el PR sobre el botón Aprobar en pantalla (`presupuestos/DetallePresupuesto.tsx:28` dice que no hay).
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
  - [ ] Test de integración contra la GoTrue dedicada (`copiloto-auth`); un token de A no cambia la cuenta de B.
  - [ ] Cuentas creadas con Google: la fila de contraseña se oculta o explica (decisión en el contrato).
  - [ ] Cerrar sesión queda en su propio grupo.
  - [ ] Probado con una cuenta descartable, **no** con `e2e-device` (no romper el usuario canónico).

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
  - [ ] Pantalla Agenda con Hoy / Mañana / Vencen esta semana / Sin hora y franja horaria.
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

### BL-X6 · Tipografía de la app + retiro de los `.otf` del repo público
- **Plataforma:** web + mobile + repo · **Tamaño:** M · **Origen:** DA-4, §6.1.5 · **Depende de:** `DEC-5`
- **Evidencia:** web `apps/copiloto-web/src/design-system/fonts.css:38-39,79` (`@font-face` a un `.woff2` que no existe) · 9 `.otf` en `docs/Imagen de marca/Neue_Einstellung/` (desde #264) + 1 en `Prototipo frontend/odobi-ui/assets/fonts/`. Mobile **ya la retiró** del bundle por la licencia de app impaga (`apps/mobile/app/_layout.tsx:83-87`; hoy Plus Jakarta Sans + Inter); web la sigue nombrando primero en `--font-display` con su propio TODO «antes de abrir la beta a testers externos» (`fonts.css:32-36`).
- **DoD:**
  - [ ] La fuente decidida cargada en ambas; ningún `@font-face` apunta a un archivo inexistente (test que resuelve cada `src`).
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

### BL-X11 · Aplicar las decisiones de Martín posteriores al 07/09 que se acepten
- **Plataforma:** web (mobile ya las tiene) · **Tamaño:** S–M · **Origen:** auditoría §6.3 · **Depende de:** `DEC-2`, `DEC-10`
- **Incluye:** isotipo en el avatar de Soporte · trazo 1,3 del isotipo · logos reales de apps (`logosMarca.ts`; `assets/logos/` falta en el repo) · Calma 3 vs 5 días · cinco íconos provisorios (`mapaIconos.ts:12-16`) · lockup en el login.
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

### BL-B4 · `gate.sh` que corra en macOS (bash 3.2)
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
  - [ ] Inventario versionado de `testID` / `data-testid` equivalentes por pantalla.
  - [ ] Un script en `scripts/ci/lint.sh` falla si una pantalla tiene un id en una plataforma y no en la otra sin excepción declarada.
  - [ ] Control positivo: borrar un id en una sola app pone el gate en rojo.

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

### BL-Q4 · Contrastes re-medidos sobre los tokens de hoy
- **Tamaño:** S · **Origen:** DA-4 (la auditoría no los re-midió), R-6 · **Depende de:** `DEC-11` para las dos excepciones.
- **DoD:**
  - [ ] Todos los pares **pintados** (no sólo los declarados) computados en las pieles vigentes de cada app; el gate de contraste cubre declarados − cubiertos = 0.
  - [ ] Las dos excepciones con acta (DEC-11) o corregidas.

### BL-Q5 · Re-medición de la matriz de 48 pantallas por bloque
- **Tamaño:** S por bloque · **Origen:** reporte 16/09 §11.2, auditoría §11.8.
- **DoD:** [ ] al cerrar cada bloque del plan, auditoría republica la matriz con los veredictos nuevos y la fecha del SHA medido.

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

---

## 13. Criterio de cierre de la beta

La beta está lista cuando **todo** esto es verdad a la vez, medido sobre un mismo SHA de `main`:

1. Todos los `DEC-*` tienen acta (resueltos o explícitamente pospuestos con su ítem movido a §12).
2. Todos los `BL-P`, `BL-D`, `BL-C`, `BL-W`, `BL-F`, `BL-J`, `BL-B`, `BL-O` y `BL-Q` cerrados con su DoD, y los `BL-X` cuya decisión los mantuvo en la beta.
3. La matriz de pantallas re-medida (`BL-Q5`) da ✅ en web y mobile para **todas las pantallas marcadas spec** en `BL-P5`, contra el prototipo final de Martín (`BL-P2`).
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
