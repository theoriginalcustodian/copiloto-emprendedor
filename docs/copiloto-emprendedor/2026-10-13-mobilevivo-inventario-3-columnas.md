# MOBILEVIVO — qué de mobile está mergeado y cómo (y si) le llega a alguien

> **Medido el 2026-10-13 contra `origin/main @ d8e5e128`.** Lectura pura: sin build, sin EAS, sin device.
> **Dueña de esta medición:** frontend2 (contrato de planificación del mismo día; la fila la había medido
> frontend1 cuatro veces entre el 06 y el 08/10 — este doc **extiende** esa serie, no la reemplaza).
> **Veredicto de una línea al final de §0.**

---

## 0. Veredicto

**¿Hay trabajo mobile mergeado que hoy no le llega a nadie? SÍ — 6 commits con efecto de runtime (+1 de
sólo comentarios y +1 de sólo test), todos posteriores a la base del binario instalado.**

| a quién | llega? |
|---|---|
| **El device de pruebas (dev-client + Metro)** | **Sí, sin build**: es un dev-client, su JS lo sirve Metro. Llega al reiniciar Metro contra `main`. Cero commits del rango tocan config nativa. |
| **Un usuario real** | **No, y no por un build pendiente: no existe artefacto de distribución.** `eas.json` tiene `development` y `preview` — **sin `production`** —, `package.json` no trae `expo-updates` y `app.json` no declara `runtimeVersion`. Ningún build de este código salió ni puede salir por OTA. |

Tres hechos de este inventario **corrigen la premisa del contrato** («ningún build salió», «sin dueño»,
«procedencia no determinable»). Están en §1 porque cambian qué hay que hacer.

---

## 1. Lo que el contrato daba por vigente y la medición corrige

1. **La fila tenía dueño y cuatro mediciones.** `MOBILEVIVO` es de frontend1 desde el 06/10 y tiene cuatro
   `cierre_` (`2026-10-06`, `2026-10-07` ×2, `2026-10-08`, en `coordinacion/cerrado/`). La última frase binaria
   decía «ocho PRs sin entregar: #800, #801, #803, #809, #822, #833, #887, #911».
2. **Esos ocho ya están dentro del binario.** Los ocho commits son ancestros de `6278836a` (la base del build
   del 11/10, §4): verificado con `git merge-base --is-ancestor`, no por fecha. La frase del 08/10 era cierta
   **ese día**; después del build del 11/10 es falsa.
3. **«Mobile viaja en un BUILD» es cierto sólo para la config nativa.** El device usa un dev-client
   (`eas.json` → `development.developmentClient: true`; `expo-dev-client ~57.0.5`): el JS lo sirve Metro. Lo que
   exige build es lo que toca `app.json`, `eas.json`, `package.json`, `assets/` o `plugins/` de mobile.

---

## 2. Rango y control de cuadratura (comando citado, no memoria)

- **Base:** `6278836a` — la base del commit del que salió el binario (§4).
- **Tip:** `origin/main @ d8e5e128`.
- **Enumeración cruda:**

  ```
  git log --no-merges --format=%h 6278836a..origin/main -- apps/mobile packages/core
  ```

  → **8 commits**. El inventario clasifica **8**: `5 CORE + 2 MOBILE + 1 SOLO_TEST_DOC = 8`. **Cuadra.**
- **Clasificación por path del diff** (no por descripción del PR), un solo bucket por commit con precedencia
  `NATIVO > CORE > MOBILE > SOLO_TEST_DOC`. Test = `*.test.*`, `__tests__/`, `jest.*`. Nativo = `app.json`,
  `eas.json`, `package.json`, `babel.config.js`, `metro.config.js`, `assets/`, `plugins/` de `apps/mobile`.
- **Por cada commit se corrió** `git show --name-only --format= <sha>` y se filtró a `apps/mobile` y
  `packages/core`; los archivos de la tabla salen de ahí.

---

## 3. Columnas (1) y (2)

### (1) Vive en `packages/core` → llega con el deploy web **y** al mobile por Metro

| commit | PR | `packages/core` (prod) | mobile (prod) | ¿mobile consume el módulo? |
|---|---|---|---|---|
| `d8e5e128` | #1065 | `api/types.ts` · `chat/dictadoPorChat.ts` · `chat/facturaPropuesta.ts` · `chat/index.ts` | 12 archivos (incl. 4 tarjetas de chat y 4 pantallas) | sí — 12 de 45 exports usados |
| `d5655465` | #1063 | `chat/datosNegocio.ts` · `chat/index.ts` | `ListaMensajes.tsx` · `TarjetaDatosNegocio.tsx` | sí — 2 de 3 |
| `2e509377` | #1056 | `audio/formatearDuracion.ts` · `audio/index.ts` · `chat/chatMachine.ts` | 10 archivos (incl. Burbuja, 4 tarjetas, 3 formularios) | sí — 8 de 11 |
| `be1fb9fe` | #1053 | `api/index.ts` · `api/perfilNegocio.ts` | 4 archivos (PerfilNegocio, Inteligencia ×2, CampoTexto) | sí — 15 de 18 |
| `004ee3ce` | #1051 | `legal.ts` | 11 archivos (incl. Ajustes, Cuenta, Skins, AFIP, Tono, Apps, Login) | sí — 7 de 11 |

«Consume» es una **heurística por módulo** (¿alguno de los nombres exportados por el archivo core aparece en
`apps/mobile/src|app` de producción en `main`?), no por línea cambiada. Alcanza para descartar el caso
«toca core pero mobile no lo importa» que FE1 midió a mano el 08/10 (#915/#909): **acá los cinco sí.**

**Cuándo llega a la web:** cuando corra `deploy/copiloto/sync-web.sh`. **No verifiqué que haya corrido para
`d8e5e128`** (es estado de producción, no está en el repo). Es una condición, no un hecho.

### (2) Sólo mobile

| commit | PR | efecto | paths |
|---|---|---|---|
| `8e1dfa94` | #1048 | **runtime** — bloque CHAT del mapeo | 17 archivos prod (incl. `modules/chat/{Burbuja,ChatView,Recibo,useChat}`, `modules/facturacion/PantallaFacturacion.tsx`) + 12 test/doc |
| `076a09cf` | #1025 | **ninguno** — sólo comentarios | `app/_layout.tsx` · `modules/recientes/PantallaRecientes.tsx` (diff leído: líneas `//` y `*`) |
| `6d3b3579` | #1023 | **ninguno** — sólo test | `modules/facturacion/SeccionMisComprobantes.test.tsx` |

`#1025` cae en `MOBILE` por path y tiene efecto **nulo** por diff; `#1023` cae en `SOLO_TEST_DOC`. Quedan
en la tabla para que la suma cuadre y no se pierdan: un renglón que desaparece del inventario es el modo en
que éste dice «ya lo revisé» sin haberlo hecho.

### Config nativa (NATIVO) — **0 commits** en el rango

Ningún commit desde `6278836a` toca `app.json`, `eas.json`, `package.json`, `assets/` ni `plugins/` de mobile.
**Nada del rango exige un build nuevo para correr en el dev-client.**

---

## 4. Columna (3) — de qué commit salió el binario

**Determinable, con un límite declarado.**

| dato | valor | fuente |
|---|---|---|
| commit de origen | `5e19949f` — «fix(mobile): cablear los 5 assets de build time y el permiso de camara que el codigo ya pide», 2026-10-11 17:22:23 -0300 | `git log` de la rama local `build/eas-dev-client-assets-h49` |
| padre / base | `6278836a` (2026-10-09, `fix(core): sacar del barrel las 3 funciones de la enmienda clínica…`) | `git merge-base origin/main build/eas-dev-client-assets-h49` |
| qué agrega sobre `main` | **sólo `apps/mobile/app.json`** (+17/−1): 3 imágenes `adaptiveIcon`, `favicon`, splash configurado con imagen y `backgroundColor`, permiso `android.permission.CAMERA` | `git diff --stat 6278836a 5e19949f` |
| binario instalado | `app.copiloto.emprendedor 0.1.0`, build `5e19949f`, device `RF8T318RN9T`, «instalado hoy 17:53» (11/10) | `coordinacion/cerrado/2026-10-11/…BACKLOG-del-sprint-app-lista-para-un-usuario-medido.md:66-67` |

**Consistencia:** el commit es de 17:22 y la instalación de 17:53 — 31 minutos, plausible para un build EAS.
El «build `5e19949f`» del mensaje coincide con los primeros 8 caracteres del commit, no con un UUID de EAS.

**Lo que NO está verificado, y por qué:**
- **No consulté EAS** (el contrato lo prohíbe). La afirmación «el binario salió de `5e19949f`» es
  **declarada por auditoría y consistente con el git**, no medida contra `eas build:list`. Esa es la
  verificación que cierra la columna: `eas build:list --platform android --limit 5` (lectura) y comparar el
  `gitCommitHash` del build.
- **No verifiqué el device** (límite del contrato): que `RF8T318RN9T` tenga hoy ese binario es lo que dijo
  auditoría el 11/10.

### Hallazgo derivado — la config del binario **no es reproducible desde `main`**

`5e19949f` **no está en `origin/main`**, no tiene rama en `origin` y no tiene PR (`git ls-remote --heads
origin build/eas-dev-client-assets-h49` → vacío; `gh pr list --head …` → vacío). Vive sólo en un worktree
local (`C:/gfw-src/wt-build-eas`).

Consecuencias, las dos medidas en `app.json` de `origin/main`:

1. **Un build desde `main` hoy perdería** los íconos adaptativos, el splash con imagen y el permiso de
   cámara que el binario instalado sí tiene. Los 5 archivos de `assets/` están en `main`; la **referencia** a
   ellos desde `app.json` no.
2. **El commit está en un solo disco.** El mismo día en que un corte de luz se llevó los crones, ese commit
   es lo único que documenta la config nativa del binario que el sprint usa.

---

## 5. Qué hay que hacer, con dueño — y dónde para este contrato

El contrato manda parar en «hay que buildear». **Acá no hace falta un build para el device de pruebas**; sí
hace falta cerrar lo siguiente (ninguno es mío de ejecutar: son de otra sesión o del operador):

| # | acción | dueño | costo |
|---|---|---|---|
| a | `git push -u origin build/eas-dev-client-assets-h49` y PR del `app.json` a `main` | quien tiene el worktree `wt-build-eas` (quien instaló el binario; planificación lo asigna) | 1 push + 1 PR de un archivo |
| b | Verificar la columna (3) contra EAS: `eas build:list` (lectura) y comparar `gitCommitHash` con `5e19949f` | operador (credenciales de EAS) | 1 comando, sin build |
| c | **Sólo si el objetivo es entregar a un usuario:** definir el perfil de distribución (`production`/`preview` con JS embebido, o `expo-updates` + `runtimeVersion` para OTA) y lanzar un build | operador (decisión MAYOR + cuota EAS) | 1 corrida EAS por build; el APK de EAS expira a los 14 días (`BACKLOG` F4) |

`(c)` es el hueco real detrás del titular del contrato: **no es que haya 32 filas esperando build, es que
el repo no tiene un camino a un usuario.** Hasta que el operador decida `(c)`, «mobile mergeado» sólo puede
significar «corre en el dev-client».

---

## 6. Alcance de esta medición — lo que no hice

- No toqué EAS, ni disparé build, ni usé el device (límite duro de la fila).
- No verifiqué que el deploy web haya corrido para `d8e5e128` (estado de producción).
- La columna «¿mobile consume el módulo?» es heurística por módulo, no por línea.
- No re-medí los **125** commits de `apps/mobile`/`packages/core` entre `6033bd3f` (el último build
  documentado anterior, 2026-08-10) y `6278836a`
  (`git log --no-merges --format=%h 6033bd3f..6278836a -- apps/mobile packages/core | wc -l` → 125): por
  ancestría están dentro de la base del binario; su contenido no es parte de la pregunta («¿qué no llegó?»).
  Con ellos, el rango total desde `6033bd3f` es 133 = 125 + los 8 de §3.
