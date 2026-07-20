# Sprint Mobile-First — Copiloto del Emprendedor

> **Fecha:** 2026-07-20 · **Estado:** PROPUESTO (pasa a EN CURSO con el OK del operador)
> **Decisión de origen:** el operador fija mobile-first; la web (`apps/copiloto-web`) pasa a vía secundaria y **no se toca** en este sprint.
> **Fuente del clon:** `documed` @ `a684147` (rama `feat/frontend-h6-anclaje`) — **commit pinneado**, no la rama viva.
> **documed es READ-ONLY.** No se modifica nada de ese repo en ningún momento.

---

## 1. Goal

Una **app nativa Android del Copiloto del Emprendedor corriendo en el teléfono del operador** (Samsung `RF8R50N2WGR`, vía dev-client sobre USB), con la cáscara visual de documed —glass deslizable, escritorio de 6 funciones, actividad reciente— conectada al backend vivo del copiloto, con chat E2E y dictado por voz.

Sin stores. Sin distribución. Solo el device del operador.

---

## 2. Alcance

### Se clona (agnóstico, sin traducción de dominio)

| Bloque | Origen en documed |
|---|---|
| Capa glass completa | `src/theme/glass/` (14 archivos: `CristalVidrio`, `FondoIluminado`, `MarcoGlass`, `Orbe`, `Tile`, `Row`, `GlassIcon`, `canonGlass`, `presion`, `relieve`, `iconPalette`, `icons`, `ondaPalette`) |
| Tokens + temas (5 skins) | `src/theme/tokens.ts`, `ThemeProvider.tsx`, `skinsCatalogo.ts` |
| Candados de diseño | `temaSinHex.test.ts`, `luminosidad.test.ts` |
| Panel principal deslizable | `src/shell/PanelDeslizable.tsx` |
| Escritorio de funciones | `src/modules/escritorio/EscritorioFunciones.tsx` |
| Actividad reciente | `src/modules/recientes/PantallaRecientes.tsx` |
| Chat | `src/modules/chat/` (`ChatView`, `Composer`, `Burbuja`, `ListaMensajes`, `TarjetaArtefacto`) |
| Adaptadores HTTP / rutas / guardias | `src/adapters/http.*`, `src/rutas/`, `src/guardias/` |
| Núcleo hexagonal | `packages/core` (`chatMachine`, `hitl`, `api`) |

### Se adapta (misma forma, otro contenido)

- **Tiles del escritorio** → las 6 funciones del copiloto (§4).
- **`pacientes/` → `clientes/`** — dentro va después la gestión de CRM.
- **Artefactos** → tipos del emprendedor, no clínicos.

### Se descarta

- Toda la capa clínica: ontología médica, `graph_*`, `clinical_*`, vademécum.
- **Persistencia local de audio completa**: de los 5 puertos sobrevive **solo el grabador**. Se caen almacén, índice de audio, hasher, purgador, hash-chain, `atestiguar_hash`, `registroProteccion`, `restauradorArranque`, `AvisoHuerfanos`, `Reproductor`, `GateTranscripcion`, `PanelEnmienda`, `PantallaGrabacion`.
- **El guard `bloqueado` del panel principal.** Existe en documed para que no quede un micrófono abierto en una consulta larga. Acá el dictado es un mensaje corto: no hay amenaza, no se copia la defensa.

---

## 3. Decisiones ya cerradas

| # | Decisión | Estado |
|---|---|---|
| D1 | Mobile-first; web = vía secundaria, congelada este sprint | CERRADA |
| D2 | Fuente = `documed@a684147`, pinneado. documed read-only | CERRADA |
| D3 | Sin stores. Dev-client + `adb install` sobre USB | CERRADA |
| D4 | Build en **EAS cloud** (la PC no tiene JDK ni Android SDK) | CERRADA |
| D5 | Proyecto Expo nuevo, **misma cuenta** que Documed | CERRADA |
| D6 | Voz: mic → blob → **Groq** → texto al composer. Sin retención de audio, sin buffer local | CERRADA |
| D7 | `pacientes` → **Clientes** (CRM adentro, después) | CERRADA |
| D8 | **Índice local = caché de UI. Nunca camino del agente.** El agente corre server-side; una tabla en el teléfono está del lado equivocado de la red | CERRADA |
| D9 | Tabla de proyección `actividad` en Postgres **solo si la medición la justifica** | CERRADA (condicional) |
| D10 | `EXPO_TOKEN` en el bloque `env` de `~/.claude/settings.json` + `.env` local gitignored | HECHA |

---

## 4. Las 6 funciones

| # | Función | Contenido inicial |
|---|---|---|
| 1 | **Apps** | Real: Gmail, Drive, Sheets, Docs, HubSpot, Instagram, Calendar, MercadoPago |
| 2 | **Ajustes** | Real: skins, cuenta, sistema |
| 3 | **Recientes** | Real: lee actividad del backend |
| 4 | **Redes Sociales** | Cascarón |
| 5 | **Métricas** | Cascarón |
| 6 | **Facturación** | Cascarón (frente AFIP activo) |

El grid es **máximo 2 filas + scroll horizontal** (el "3×2 fijo" del docstring viejo de documed estaba mal y ya fue corregido allá).

---

## 5. Fases y DoD

> **Regla transversal de verificación:** *verde en jsdom/vitest ≠ verificado.* Todo DoD que involucre gesto, animación o render se cierra **en el device real**, no en el emulador ni en el test runner.
>
> **Regla de autonomía:** este sprint corre sin operador presente, así que **ningún DoD puede cerrarse con "se ve bien"**. Cada uno declara su **instrumento** — un comando cuya salida es la evidencia. Si un DoD no tiene instrumento programático, no es un DoD para este sprint: es un punto de parada (§9).

**Device de verificación:** `SM-A217M` (`RF8R50N2WGR`), 720×1600, Android 12 — el mismo hardware contra el que documed calibró su código.

### F1 — Andamiaje y primer arranque en device

- `package.json` raíz + workspaces npm en `copiloto-emprendedor` (hoy no existen).
- `apps/mobile` con Expo SDK pinneado al de documed (RN 0.86 / React 19.2).
- Deps nativas: `reanimated`, `gesture-handler`, `safe-area-context`, `op-sqlite`, `expo-audio`, `expo-router`.
- Proyecto nuevo en expo.dev + `eas build --profile development --platform android`.
- `adb install` del APK.

**DoD:** la app abre en el `RF8R50N2WGR`, con hot-reload funcionando vía `expo start --dev-client`. Evidencia: captura del device + salida de `adb devices`.

### F2 — Spike del repliegue ⚠️ GATE

El supuesto crítico del sprint. **Hipótesis a falsar:** el hitch de los glass secundarios viene del handoff gesto→router (`runOnJS(cerrar)` → `router.back()`), donde `panelY` queda congelado en el punto de release mientras el navegador arranca *su* transición.

Tres mecanismos lado a lado, medidos con frame timing en el device:
- **A** — `router.back()` directo (el actual de documed).
- **B** — animar `panelY` hasta el final con `CONFIG_SNAP` y llamar `router.back()` en el callback, con animación de ruta desactivada.
- **C** — capas dentro de una pantalla, sin router (el modelo del panel principal).

**DoD:** `spikes/repliegue-glass/RESULT.md` con frames medidos por mecanismo, en device, **y la decisión rutas-vs-capas escrita**. Incluye sección *"Qué NO prueba"*.

**Esta decisión condiciona la estructura de carpetas de F3 y F4.** No se avanza sin ella.

### F3 — Capa glass + shell

- Portar `src/theme/` completo + los 5 skins.
- `PanelDeslizable` con el canon (`ALTO_HANDLE 56`, `CONFIG_SNAP 420ms bezier(.2,.8,.2,1)`, `UMBRAL_TAP 5`).
- Candados `temaSinHex` y `luminosidad` verdes.

**DoD:** el chat glass sube y baja con el dedo en el device; los 5 skins conmutan; candados verdes. **Cero literales hex fuera de tokens.**

### F4 — Escritorio de 6 funciones + Recientes

- `EscritorioFunciones` con las 6 tiles.
- Apps, Ajustes y Recientes con contenido; las otras 3 cascarón.
- Apertura/cierre con el mecanismo que salga de F2.

**DoD:** las 6 abren y cierran **sin el hitch** — verificado en device contra la medición de F2, no por impresión.

### F5 — Chat vivo contra el backend ⚠️ RIESGO

- `lib/api` + auth.
- **Riesgo declarado:** el login hoy es GoTrue + Google OAuth por navegador web. En nativo es `AuthSession` + deep-link con esquema propio, y hay que registrar el redirect URI en Google Cloud. **No es portable tal cual.** Si se traba, el fallback es login por email/password (que ya existe) y Google queda para después.
- `ChatView`, `Composer`, `Burbuja`, `ListaMensajes`, `TarjetaArtefacto`, card HITL.

**DoD:** conversación E2E real contra el copiloto vivo desde el teléfono, con un HITL confirmado de punta a punta.

### F6 — Voz

- `BotonVoz` + `Onda` (feedback visual).
- mic → blob → Groq → texto al composer, como si lo hubiera tipeado el usuario.
- Sin almacenamiento local, sin hasher, sin gate de transcripción.

**DoD:** dictado que entra al chat como mensaje, medido E2E en device.
**Trade-off aceptado y declarado:** sin buffer local, si se corta la red a mitad del dictado ese audio se pierde. Es decisión, no descubrimiento.

### F7 — Índice de actividad

1. **Medir primero** cuánto tarda hoy `consultar_actividad`. Sin número no se construye nada.
2. Caché local SQLite (`op-sqlite`) para que Recientes pinte instantáneo. Proyección descartable, reconstruible, nunca autoridad.
3. Tabla de proyección `actividad` en Postgres **solo si la medición la justifica** (D9).

**DoD:** Recientes pinta desde caché sin esperar red; la decisión sobre la proyección server-side queda tomada **con el número medido adjunto**.

**Riesgo conocido:** el índice del teléfono no sabe lo que se hizo en la web. Sin refresh contra el servidor, el agente responde *"no hiciste nada"* con total seguridad — el peor modo de fallo, porque no se ve. El refresh es parte del DoD, no un extra.

---

## 6. DoD global del sprint

App nativa instalada en el teléfono del operador que, **verificado en el device**:

1. Abre con el glass del copiloto y los 5 skins conmutables.
2. Desliza el panel principal sin hitch.
3. Muestra las 6 funciones; abre y cierra cada una sin hitch.
4. Conversa E2E contra el backend vivo, con HITL confirmable.
5. Acepta dictado por voz que entra como mensaje.
6. Lista actividad reciente sin esperar red.

Más: candados de tema verdes, cero hex fuera de tokens, y `RESULT.md` del spike de F2 con números.

---

## 7. Estimación

Reference class: *Sprint frontend UX paralelo ~6-7h* (2026-05-29, 6 sub-agentes). Este es mayor —app nueva, toolchain nativo, integración de backend—.

| Tramo | Wall time con waves |
|---|---|
| **Cáscara (F1-F4)** | ~5-7 h |
| **Completo (F1-F7)** | ~10-13 h |

**Buffer externo declarado aparte:** la cola de build de EAS es dependencia externa con latencia propia (10-40 min por build, no controlable). No entra en el wall time de arriba.

---

## 8. Riesgos abiertos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Auth Google en nativo no es portable (F5) | Fallback a email/password; Google después |
| R2 | El spike F2 puede refutar mi hipótesis del hitch | Por eso es gate y no supuesto: si A/B/C no distinguen, hay que buscar la causa antes de construir 6 funciones sobre el mecanismo equivocado |
| R3 | Cola de EAS bloquea el ciclo | Rebuild solo cuando cambian deps nativas; el día a día es hot-reload |
| R4 | Worktree `_documed-wt` sobre este repo (branch `documed/backend-foundation`, sin tocar desde 2026-07-11) | No bloquea F1-F2. Resolver antes de que `apps/mobile` crezca |
| R5 | El proyecto Expo cuelga de la cuenta de Documed | Aceptado por el operador. Migrar entre cuentas después es fricción |

---

## 9. Autonomía — instrumentos, reglas de decisión y puntos de parada

El sprint corre **sin operador**. Eso obliga a tres cosas que un sprint asistido no necesita.

### 9.1 Instrumento por DoD

| Fase | Cómo se mide, sin humano mirando |
|---|---|
| F1 | `adb shell pm list packages \| grep <pkg>` (instalada) + `adb exec-out screencap -p` → PNG leído y verificado |
| F2 | `adb shell dumpsys gfxinfo <pkg> framestats` → parseo de frames por mecanismo (A/B/C). **Números, no impresión** |
| F3 | Candados `temaSinHex` / `luminosidad` en CI + screencap por skin (5 PNG) |
| F4 | Screencap de las 6 funciones abiertas + `framestats` del cierre de cada una |
| F5 | Log de request/response del front-door + screencap del HITL confirmado |
| F6 | Texto transcripto presente en el composer, leído del screencap + latencia del POST a Groq |
| F7 | Tiempo de pintado de Recientes con red cortada (`adb shell svc wifi disable`) |

### 9.2 Reglas de decisión pre-declaradas

Bajo autonomía no puedo escalar a mitad de camino, así que los bifurcadores se deciden **ahora**:

- **Si F2 da que A/B/C no se distinguen** (la hipótesis del handoff queda refutada) → **PARAR**. No construir 6 funciones sobre un mecanismo no entendido. Escribir `RESULT.md` con lo medido y un handoff. Esto es un resultado válido del sprint, no un fracaso.
- **Si F2 da que C (capas) gana** → las funciones son capas, sin `expo-router` para navegación entre funciones.
- **Si F2 da que B (animar + callback) alcanza** → se mantienen rutas, más barato.
- **Si Google OAuth nativo no cierra en F5** → email/password, que ya existe. Google queda documentado como pendiente. **No se intenta tocar la consola de Google Cloud** (§9.3).
- **Si la cola de EAS supera 45 min en un build** → seguir con el trabajo que no depende del APK (lógica, tests, `packages/core`) y reintentar. No bloquear el sprint esperando.
- **Si el teléfono se desconecta o bloquea** → reintentar `adb devices`; si no vuelve, cerrar hasta donde se pudo verificar y dejar el resto marcado `[REQUIERE_DEVICE]`. **No declarar verde lo no medido.**

### 9.3 Lo que este sprint NO va a intentar solo

- **Consola de Google Cloud** (registrar redirect URI del deep-link). Es UI web con sesión humana. Fallback ya declarado.
- **Publicar en stores.** Fuera de alcance por decisión D3.
- **Tocar `documed`.** Read-only, sin excepción.
- **Tocar `apps/copiloto-web` o el servicio vivo en prod.** El copiloto está en prod-beta con smoke 10/10; este sprint no lo pone en riesgo.
- **Resolver el worktree `_documed-wt`** (R4). Requiere decisión sobre WIP ajeno.

### 9.5 Nota sobre §10

Las fases F1-F7 de §5 son el **qué** y su DoD. §10 es el **cómo se ejecuta** — waves, scripts y reparto de modelos. El orden real de ejecución es el de §10, no el numérico de §5: varias fases se solapan.

### 9.4 Condición de parada general

Ante cualquier resultado que contradiga una premisa del plan —y no solo ante un error— **el sprint para, escribe lo medido y deja handoff**. Seguir adelante inventando la causa de un resultado inesperado es exactamente el modo de fallo que este plan intenta evitar: un cimiento no verificado se amplifica en todo lo que se apoye encima, y sin operador mirando no hay nadie que lo note.

---

## 10. Ejecución — scripts, waves y reparto de modelos

Aplicando `/ejecutar-con-eficiencia`. Principio rector: **todo lo determinista sale del LLM y se vuelve script**; los sub-agentes consumen output de scripts, nunca contexto crudo.

### 10.1 Script-first — los 5 scripts que van ANTES de cualquier sub-agente

Sin esto, 4 sub-agentes harían `git show` sobre ~180 archivos de `documed@a684147` cada uno. Con esto, se extrae una vez y todos leen el manifest.

| Script | Qué hace | Por qué es script y no agente |
|---|---|---|
| `S1 extract-documed-mobile.sh` | `git archive` de `a684147:apps/mobile` + `packages/core` → `_staging/documed-a684147/` read-only | Una operación git, cero juicio. Idempotente |
| `S2 classify-port.mjs` | Recorre el staging, parsea imports, emite `manifest.json` con `{path, loc, imports[], importedBy[], categoria, fase}` | Grafo de dependencias = parseo determinista |
| `S3 device-harness.sh` | Wrappers `adb` idempotentes: `install`, `screencap`, `framestats`, `logcat-slice` | Todo lo que toca el device pasa por un solo lugar auditable |
| `S4 scaffold-mobile.mjs` | Genera `apps/mobile` skeleton + `package.json` raíz con workspaces + `eas.json` + `app.json` | Boilerplate. Idempotente: no pisa lo existente |
| `S5 parse-framestats.mjs` | Parsea `dumpsys gfxinfo framestats` → p50/p95/p99 + conteo de jank por mecanismo | **Es el instrumento del DoD de F2.** Un número no se estima, se calcula |

Ahorro estimado: **~150-200k tokens** vs. que cada agente lea el árbol crudo.

### 10.2 Reparto de modelos

| Modelo | Para qué | Por qué |
|---|---|---|
| **Haiku** | Verificar integridad de extracción · tabular manifests · sustitución de nomenclatura (`documed→copiloto`, `paciente→cliente`) · los 3 cascarones + tests de humo · docs de cierre | Alto volumen, patrón fijo, cero juicio arquitectónico |
| **Sonnet** | Portar módulos · adaptar componentes · EAS · escribir tests · correr mediciones · chat y voz | Builder / Explore / tester / validator — el default |
| **Opus** | **Solo C3**: interpretar la medición de F2 y decidir rutas-vs-capas | Cruza dominios (reanimated + navegación + estadística de frames) y condiciona todo lo que sigue |

### 10.3 Waves

```
PRE   parent, foreground (~20 min)
      └── escribir y validar S1..S5 con dry-run

WAVE A  ── 3 agentes en un solo mensaje, todos bg ──────────────
  A1  Haiku   corre S1+S2, verifica conteo vs `git ls-tree`   → _staging/manifest.json
  A2  Sonnet  crea proyecto expo.dev + eas.json + lanza build  → APK  ⏳ 10-40 min de cola
  A3  Sonnet  porta packages/core (chatMachine, hitl, ports)   → packages/core/**
  ▸ La cola de EAS (A2) queda TAPADA por A1 y A3. Ese es el ahorro grande.
BARRIER A

WAVE B  ── 3 agentes ──────────────────────────────────────────
  B1  Sonnet  S3 install + arranque + screencap                → cierra F1
  B2  Sonnet  porta src/theme/ completo + 5 skins + candados   (bg)
  B3  Haiku   sustitución de nomenclatura en lo portado        (bg)
BARRIER B

WAVE C  ── EL GATE (F2) ─────────────────────────────────────────
  C1  Sonnet  implementa los 3 mecanismos A/B/C en pantalla spike
  C2  parent  corre la medición en device + S5
  C3  OPUS    interpreta y DECIDE rutas-vs-capas
BARRIER C = GATE. Si refuta la hipótesis → PARAR (§9.2)

WAVE D  ── 3 agentes, post-decisión ────────────────────────────
  D1  Sonnet  Escritorio + 6 tiles con el mecanismo decidido   (bg)
  D2  Sonnet  Ajustes + Recientes con contenido real           (bg)
  D3  Haiku   los 3 cascarones + tests de humo                 (bg)
BARRIER D

WAVE E  ── 2 agentes ──────────────────────────────────────────
  E1  Sonnet  auth + lib/api + chat E2E                        (bg)
  E2  Sonnet  voz Groq                                          (bg)
BARRIER E

WAVE F  ── cierre ─────────────────────────────────────────────
  F1  Haiku   docs + memoria + checkpoint
  F2  parent  framework-self-check + verificación final en device
```

### 10.4 File-ownership matrix

| Agente | `owner:` | `NO-TOCAR:` |
|---|---|---|
| A1 | `_staging/**` | todo el resto |
| A2 | `apps/mobile/eas.json`, `apps/mobile/app.json` | `apps/mobile/src/**` |
| A3 | `packages/core/**` | `apps/**` |
| B2 | `apps/mobile/src/theme/**` | `apps/mobile/src/modules/**`, `packages/**` |
| B3 | solo archivos ya portados, listados por el manifest | cualquier archivo no listado |
| D1 | `apps/mobile/src/modules/escritorio/**`, `src/shell/**` | `src/modules/{ajustes,recientes}/**` |
| D2 | `apps/mobile/src/modules/{ajustes,recientes}/**` | `src/modules/escritorio/**` |
| D3 | `apps/mobile/src/modules/{redes,metricas,facturacion}/**` | todo el resto de `modules/` |
| E1 | `apps/mobile/src/lib/**`, `src/modules/{auth,chat}/**` | `src/modules/captura/**` |
| E2 | `apps/mobile/src/modules/captura/**` | `src/modules/chat/**` |

Cero solapamientos. **Ningún sub-agente en bg tiene `git push`, `gh pr merge` ni deploy.** El parent es el único que commitea.

### 10.5 Wall time

| | Serial | Con waves |
|---|---|---|
| Cáscara (hasta barrier D) | ~5-7 h | **~3-4 h** |
| Completo (hasta wave F) | ~10-13 h | **~5-7 h** |

Ahorro ~45%. El grueso sale de tapar la cola de EAS con A1+A3, y de que el port de `packages/core` y de `src/theme/` **no dependen del gate F2** — se hacen mientras tanto.
