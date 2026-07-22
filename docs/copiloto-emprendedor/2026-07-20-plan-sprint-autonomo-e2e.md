# Plan — Sprint autónomo E2E en device (2026-07-20)

> **Goal (fijado con `/goal`):** app nativa Android del Copiloto corriendo en el SM-A217M vía dev-client,
> con la cáscara de documed —glass deslizable, 6 funciones, actividad reciente— conectada al backend
> vivo, con **chat E2E y dictado por voz**. Sin stores. **Todo probado y funcionando E2E.**
>
> **Modo:** 100% autónomo. El device (`RF8R50N2WGR`) queda libre para esta sesión; se maneja por USB.
> **Cierre binario:** cada fase tiene un DoD verificable **en el teléfono**, con captura/log de evidencia.

---

## 0. Hechos verificados hoy (el plan sale de esto, no de suposiciones)

- **APK v2** (`fb299289`, de HEAD) instalable en `_evidencia/copiloto-v2.apk`, 310 MB. **Sin instalar aún.**
- **Todas las nativas ya están compiladas en el APK v2**: `react-native-audio-api ^0.13.1`, `expo-audio`,
  `@op-engineering/op-sqlite`, blur, svg, gesture, reanimated, worklets. **⇒ F6 y F7 NO necesitan rebuild.**
- **Permisos de micrófono** ya en `app.json` (`RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, FS). ⇒ F6 sin rebuild.
- **F5 código completo y verde en jest** (auth + chat + integración), **sin ejecutar en device**.
- **Contrato backend verificado** (recon): `POST /chat` fire-and-forget → polling `GET /reply` 1500ms;
  `/auth/{signup,login,refresh}` HTTP puro; `POST /chat/audio` multipart → Groq. Sin SSE/WS.
- **Diagnóstico pendiente de confirmar:** el APK v1 moría en runtime por `expo-system-ui` ausente del
  binario; el v2 lo incluye. **Fundado, no probado** — lo confirma o refuta el primer arranque (F0).
- **Decisión del operador (2026-07-20):** crear usuario de prueba vía `/auth/signup` (autoriza escribir
  en el backend beta); implementar el handoff `fixes-gestos-glass` (B/C/D/E).

---

## 1. Fases y DoD

### F0 — Spike de arranque (GATE CERO, bloquea todo lo demás)
Instalar APK v2 → arrancar contra Metro → confirmar que el runtime carga.
- **DoD:** la app abre **sin pantalla roja** y cae en el login (por el guard de F5). Captura `f0-arranque`.
- **Si NO arranca:** el diagnóstico `expo-system-ui` era falso → re-diagnosticar con `logcat` **antes**
  de tocar nada más. Es el spike que colapsa la incertidumbre del cimiento: sin device vivo, ninguna
  fase siguiente es verificable.

### F1 — Cáscara verificada + sesión real
Crear usuario de prueba vía `/auth/signup` → login en device → recorrer las 6 funciones.
- **DoD:** screencap de cada una de las 6 funciones montando **su** pantalla + panel deslizable;
  reabrir la app **no** re-pide login (sesión persistida). Capturas `f1-*`.
- Credencial de prueba: se genera y se guarda en `~/.claude/secrets/` (no en repo). Email tipo
  `sprint-e2e+<ts>@copiloto.test`.

### FIX — Handoff de gestos (B/C/D/E), implementado como dice el doc
- **B** — `EscritorioFunciones.tsx`: `ScrollView`/`Pressable` → `react-native-gesture-handler`.
- **C** — `Tile.tsx`: `Pressable` → RNGH.
- **D** — `Tile.tsx`: sacar `PRESS_SCALE` del callback (tiles fijos, pedido del operador).
- **E** — "un solo glass a la vez". 🔴 **Adaptación, no copia literal:** en este repo las 6 funciones son
  **capas** (`funcionActiva`, un slot único), no rutas — la invariante ya existe **por construcción** y
  hay test que la fija. NO se porta `empujarUnaVez` (es para `router.push`). Se **verifica** la
  invariante en device y se documenta por qué el patrón E no aplica.
- **NO-F** — confirmar que `PanelDeslizable` **no** tiene `useFocusEffect` (ya verificado). No agregar.
- **G** (FeGaussianBlur) — trade-off de dos hilos; **decisión de device**, se mide, no se aplica a ciegas.
- **DoD:** tap único abre glass (verificable con `adb tap`, que SÍ reproduce el tap ≠ swipe); el tile no
  se hunde; un solo glass a la vez. Verificado en device + suite verde. Repliegue del glass observado y
  reportado con evidencia (el operador afirma que documed ya lo resolvió — se confirma, no se asume).

### F5 — Chat E2E (corazón del goal)
Con la sesión real: enviar un mensaje desde el device → `POST /chat` → polling `/reply` → respuesta del
agente durable en pantalla.
- **DoD:** un mensaje real recibe respuesta del agente en el device, capturada (`f5-chat-e2e`). Verificar
  el ciclo completo contra el backend vivo, no un mock.

### F6 — Voz (mic → Groq → texto). D6: sin retención, sin buffer local
Portar **sólo** botón de voz + onda + grabador corto de documed (NO la máquina clínica: sin `purgador`,
`proteccionDurable`, `huérfanos`, `GateTranscripcion` clínico). Captura → `POST /chat/audio` → Groq →
el texto entra como mensaje del usuario.
- **DoD:** hablar por el micrófono produce texto en el chat **y** respuesta del agente, en device
  (`f6-voz-e2e`). Permiso de mic concedido por `adb pm grant`/tap. Sin archivo de audio retenido.

### F7 — Índice de actividad (Recientes). D8/D9
Medir `consultar_actividad` primero. Construir caché local (`op-sqlite`) **sólo si la medición lo
justifica**; si no, Recientes lee directo del backend.
- **DoD:** Recientes muestra actividad real del tenant de prueba; el índice local (si se construye) es
  **caché de UI, nunca camino del agente** (el agente corre server-side). Captura `f7-recientes`.

### CIERRE — regresión + persistencia
- **DoD:** suite completa verde + `tsc` limpio en ambos workspaces; carpeta `_evidencia/` con las
  capturas E2E; `HANDOFF` y memoria actualizados; commits por fase.

---

## 2. Ejecución (eficiencia)

**El trabajo de device es secuencial e interactivo** (instalar, tap, logcat, screencap) — no
paralelizable. **La implementación de código de F6 y F7 sí** lo es. Estructura:

- **Serial primero (yo):** F0 → F1 → FIX → F5. Es el camino crítico y todo toca el device o el estado
  compartido (git, backend). No se delega.
- **Wave de implementación (2 sub-agentes Sonnet, ownership exclusiva)**, lanzada apenas F5 esté verde en
  device, mientras preparo la verificación:
  - Agente **VOZ** → `src/modules/voz/**` (F6): botón + onda + grabador corto → `/chat/audio`.
  - Agente **ÍNDICE** → `src/modules/recientes/**` sólo lo nuevo del índice + adapter `op-sqlite` (F7).
  - Yo integro cada uno al volver y **verifico en device** (no confío en el reporte).
- **Scripts deterministas:** `S3-device-harness.sh` ya es el único punto de contacto con el teléfono. Se
  extiende con un `S8-e2e-chat.sh` (enviar mensaje + esperar respuesta + capturar) reutilizable por F5/F6.

**Riesgo de rebuild:** BAJO — todas las nativas están en el APK v2. Si aparece una nativa imprevista, se
agrupa en **un** rebuild, no goteando (la lección de los ~76 min ya pagada dos veces).

**Modelos:** sub-agentes de port/impl → Sonnet. La integración, las decisiones de contrato y la
verificación en device → esta sesión (Opus).

---

## 3. Lo que este sprint NO hace (alcance explícito)

- **No mide el tirón del glass con instrumentación de frames.** El operador afirma que documed ya lo
  resolvió; el sprint **aplica el handoff y confirma el repliegue visualmente**, no reabre la
  investigación (que requería dedo humano y no es automatizable con `adb swipe`).
- **No decide dónde va Clientes** (D7). El puerto existe en `core`; la ubicación es decisión de producto.
- **No toca `apps/copiloto-web`** (mobile-first, web congelada) ni **documed** (read-only).
- **No emite facturación AFIP** (frente en pausa, greenfield).

---

## 4. Gate humano restante

Ninguno bloqueante para arrancar: el device es de esta sesión y el usuario de prueba está autorizado.
El único input que puede hacer falta es **regenerar/rotar** la credencial de prueba al cerrar (queda como
TODO de higiene, no bloquea el E2E).

**Estimación (calibrada, sin unidad "días"):** ~4h de wall time si no hay rebuild; +~1.5h si una nativa
imprevista obliga a uno. El cuello es el device-work serial (F0→F5), no el cómputo.
