# DoD — Relevamiento mobile completo (código · build · plataforma EAS · teléfono)

> **Sujeto (código):** `apps/mobile/` en `C:/gfw-src/wt-relev` @ `41e1d005` (contenido de `apps/mobile` = `6278836a`, el mismo SHA del relevamiento de código ya cerrado).
> **Sujeto (device):** `SM-M127F` (samsung Galaxy M12), serial `RF8T318RN9T`, Android **13** / API **33**, `arm64-v8a`, conectado por USB y **autorizado** (`adb devices` → `device`, no `unauthorized`), `adb 1.0.41`. Un solo usuario de Android: `0 · David Huck`.
> **Sujeto (plataforma):** proyecto EAS `@341lin/copiloto-emprendedor`, `projectId 05317fbe-ca0e-4f46-a63e-6f47a1cb118a`, owner `341lin`.
> **Antecedente:** [`2026-10-09-relevamiento-codigo-cierre.md`](2026-10-09-relevamiento-codigo-cierre.md) — 60 hallazgos, de los cuales **1 cita `apps/mobile`**. Mobile nunca fue su propio lote: entró como capa de cada capacidad de negocio y quedó `REQUIERE_DEVICE` por construcción.
> **Regla que gobierna este DoD:** un criterio que crece con cada medición no se puede alcanzar. Los denominadores de abajo están **medidos hoy** y se congelan al abrir el relevamiento; un elemento que aparezca después va a una lista de *llegados tarde*, no mueve el denominador.

---

## 0 · Denominadores congelados (medidos, no estimados)

| universo | n | cómo se contó |
|---|---|---|
| rutas de Expo (`apps/mobile/app/*.ts*`) | **22** | 21 pantallas + `_layout.tsx` |
| módulos (`apps/mobile/src/modules/*`) | **21** | |
| componentes `.tsx` en `src/` (sin tests) | **115** | |
| archivos de test mobile | **112** | `*.test.ts` + `*.test.tsx`, todos bajo `src/`. **Medido con `inventario-mobile.py`; la primera cifra de este DoD decía 110 y estaba corta por 2.** La medida vale, la estimación no |
| otros `.ts` en `src/` (no `.tsx`, no test) | **52** | `adapters` 5 · `modules` 30 · `navegacion` 2 · `theme` 13 · `util` 2. **Ningún denominador anterior los cubría** |
| TOTAL de archivos `.ts`/`.tsx` en `apps/mobile` | **301** | 22 + 115 + 112 + 52 — la suma que A1 tiene que cerrar |
| `dependencies` en `package.json` | **34** | de las cuales **27** son candidatas a módulo nativo |
| plugins declarados en `app.json` | **8** | `expo-router`, `expo-audio`, `expo-sharing`, `expo-splash-screen`, `expo-font`, `expo-navigation-bar`, `expo-web-browser`, `@react-native-google-signin/google-signin` |
| Expo / React Native | `~57.0.4` / `0.86.0` | |
| identidad de la app | `app.copiloto.emprendedor` · name **Odobi** · version `0.1.0` | el `name` ya es Odobi; el `applicationId` todavía dice copiloto |
| builds en la plataforma EAS | **14** | todos ANDROID; 0 iOS |

**Tres datos de forma, ya medidos, que gobiernan las fases:**

- **`runtimeVersion` NO está declarada** en `app.json` (ni `updates`), y los **14** builds de la plataforma la reportan `null`. Sin ella el dev-client **no puede rechazar** un bundle incompatible con su binario: cualquier rojo del teléfono queda de causa ambigua — *¿la pantalla está mal, o el binario no tiene el módulo?*
- **Proyecto MANAGED:** no existen `android/` ni `ios/`. Instalar algo exige `expo prebuild` + gradle local, o un build EAS. `eas.json` ya trae el perfil **`development`** con `developmentClient: true`, `distribution: internal`, `buildType: apk` — la receta existe y **no cambió** desde el último build.
- **`appBuildVersion` = `1` en los 14 builds**, pese a `cli.appVersionSource: remote`. El `versionCode` nunca se incrementó: los 14 binarios son **indistinguibles por versión**. Ver el hallazgo 🔬 del §0.ter.

---

## 0.bis · B0 — identidad del binario instalado: **YA MEDIDO, y reordena todo**

| medición | resultado |
|---|---|
| `adb shell pm path app.copiloto.emprendedor` | **vacío** |
| control positivo, mismo comando sobre un paquete que sí existe | `package:/system/priv-app/SVCAgent/SVCAgent.apk` ✅ |
| `pm list packages` filtrado por `copiloto` / `odobi` / `expo`, en **4** variantes (`--user 0`, `-u` incluye desinstaladas con datos, `-d`, `-e`) | **0, 0, 0, 0** |
| control positivo del mismo conteo (`samsung`) | **141** ✅ |
| `pm list packages` total | **358** paquetes — el instrumento ve |
| Expo Go / cualquier dev-client | **ninguno** |
| APK/AAB en el repo | **ninguno** |

### ⛔ El teléfono está conectado y **vacío**: no hay app, ni dev-client, ni Expo Go

**Esto refuta una premisa operativa vigente.** La memoria del proyecto dice *«iterar en device NO compila nada — dev-client ya instalado + Metro local por USB»*. Es verdad **una vez instalado**, y hoy **no lo está**: en este teléfono no hay nada que cargar un bundle. La frase describía un estado, se leyó como una propiedad permanente, y «conectado» se tomó por «listo para probar».

---

## 0.ter · La plataforma EAS: **14 builds, y CERO sirven hoy**

Medido contra `api.expo.dev/graphql` con el instrumento `2026-10-11-eas-builds.py` (§8), que trae control positivo y negativo.

| medición | resultado |
|---|---|
| builds del proyecto | **14** — 12 `FINISHED`, 1 `CANCELED`, 1 `ERRORED` |
| perfiles | `development` **9** · `preview` **5** |
| plataformas | ANDROID **14** · iOS **0** |
| con artefacto registrado (URL no nula) | **12** |
| **builds NO expirados** | **0** — la expiración más nueva es **2026-09-21**, hace 20 días |
| descarga real de 3 artefactos (HEAD) | **HTTP 404, 404, 404** |

### El último build, con nombre y apellido

| campo | valor |
|---|---|
| id | `13397737-2911-4b8d-a512-f80935bf3d99` |
| fecha | **2026-09-07** (creado 14:22Z, completado 15:11Z) |
| perfil | **`development`** — era un dev-client, justamente el que servía para iterar |
| estado | `FINISHED`, con APK |
| commit | **`f8428b9e`** — *«UI: gesto de voz de WhatsApp, migración a iframes y estados nuevos (#474)»* |
| `appVersion` / `appBuildVersion` | `0.1.0` / `1` |
| `runtimeVersion` | `null` |
| expiró | **2026-09-21** → su URL da **404** |

### 🔥 Hallazgo: el artefacto no expiró «en papel», **ya no existe**

`expirationDate` en el pasado es un dato administrativo; que la URL **baje o no** es la propiedad que importa. Se midió, y es 404 en los tres artefactos muestreados — incluido el último. **No hay nada que descargar e instalar.** Esto cierra la alternativa barata de B′ antes de intentarla: la pregunta no es «¿bajo el APK o compilo?», es «compilo, y además perdí la trazabilidad de lo que había».

### 🔬 Hallazgo: los 14 builds son indistinguibles por versión

`appVersionSource: remote` está configurado, pero `appBuildVersion` es **`1`** en los catorce. Combinado con `runtimeVersion: null`, un binario instalado en el teléfono **no puede identificarse por lo que reporta**: `dumpsys package` diría `versionCode 1` para cualquiera de los 14, y no hay runtime version que lo ate a un bundle. La única identidad confiable de un build instalado es el `gitCommitHash`, que vive **en la plataforma** y no en el teléfono — y la plataforma ya borró los artefactos. Por eso B0 se mide con `pm path` y no con la versión.

### El build que había estaba **98 commits atrás** del código relevado

| medición | resultado |
|---|---|
| `f8428b9e` es ancestro de `6278836a` | **sí** — el build precede al código relevado |
| commits que tocan `apps/mobile` entre ambos | **98** |
| diff de `apps/mobile` | **197 archivos**, +12.909 / −2.348 |
| `app.json` desde el build | **sin cambios** |
| `eas.json` desde el build | **sin cambios** |
| `package.json` desde el build | 1 línea: −`@expo-google-fonts/jetbrains-mono`, −`@expo-google-fonts/space-grotesk`, +`@expo-google-fonts/inter` |

**Lo que esto habilita, como hipótesis con su condición de refutación — no como veredicto.** La receta nativa (`app.json`, `eas.json`, los 8 plugins) **no cambió**, y el único cambio de dependencias son paquetes de fuentes de `@expo-google-fonts`, que entregan TTF cargados por `expo-font` desde el bundle. *Si* eso es así, un dev-client compilado desde `f8428b9e` habría aceptado el bundle de hoy, y lo que mató la iteración no fue el código: fue la **retención de 14 días del artefacto**. **Qué la refuta:** que alguno de esos tres paquetes de fuentes aporte algo nativo, o que entre los 98 commits haya un import nuevo de un módulo nativo que `package.json` ya listaba pero el binario viejo no incluía. Eso se decide en **B1/B3**, con el grep de imports, no acá. Mientras no se mida, se trata como hipótesis.

---

## 0.quater · Candidatos que medí y se CAYERON (negativos verificados)

Un relevamiento que sólo publica lo que acusa es un relevamiento sesgado. Estos tres los perseguí con una hipótesis concreta y el código los refutó; van escritos para que el próximo lector **no los vuelva a litigar**.

| candidato | hipótesis | veredicto |
|---|---|---|
| **♊ dos clientes HTTP gemelos** — `src/adapters/http.native.ts` (80 líneas) y `http.web.ts` (68) | «el mismo cliente vive dos veces y el fix llega a uno» | **REFUTADO.** El split es deliberado y resuelto por plataforma: `src/adapters/plataforma.ts:7` importa `./http` y Metro resuelve a `.native` o `.web`. Ambos exportan por **default** justamente para que el import no dependa de la plataforma (`http.web.ts:66`), y la diferencia real está acotada al multipart (`http.web.ts:8`). Los dos tienen test: `http.test.ts` y `http.test.web.ts` |
| **🔬 un test que existe y nunca corre** — `http.test.web.ts`, `almacen.test.web.ts` | «hay tests `.web` sin proyecto jest que los ejecute» | **REFUTADO.** `jest.config.js:166-168` define el proyecto `web` con `preset: 'jest-expo/web'` y `testMatch: ['<rootDir>/src/**/*.test.web.ts']`. Son 2 archivos y los 2 matchean |
| **🔬 el congelamiento nativo como gate decorativo** | «bloquea en teoría y nunca evaluó» | **REFUTADO hoy, pero por poco margen y ya con antecedente.** Corre y decide (`ok … exit 0` con el `merge-base` resuelto). Su fail-open es ruidoso y tiene test propio — porque el guard **sí** vivió cableado sin evaluar nunca, por el clon superficial de CI. El bug está arreglado; el antecedente queda |

**Lo que estos tres tienen en común:** en los tres el comentario del código explicaba la decisión y su motivo. Ninguno se resolvió leyendo el nombre del archivo ni contando archivos — se resolvió abriendo el archivo donde se elige, que es un paso distinto de abrir el archivo sospechoso.

---

## 1 · Método (qué cuenta como evidencia, y qué no)

- **El grafo orienta, el código decide.** Ninguna afirmación entra por lo que diga el grafo, un comentario, un doc o un nombre de archivo. Se abre el archivo.
- **El teléfono decide sobre el teléfono.** Ninguna afirmación de device entra por un test de Jest, un comentario o una memoria. Se mide con `adb`.
- **La plataforma decide sobre los builds.** Un `expirationDate` futuro no prueba que el artefacto baje: se pide con HEAD y se lee el código de respuesta.
- **Documentación excluida como fuente**, igual que en el relevamiento cerrado: `docs/**`, `*.md`, `coordinacion/**` — ni para orientarse.
- **Toda afirmación con `path:línea`** (código) o **comando + salida** (device/plataforma), verificable.
- **Resultados negativos con control positivo** — la regla que este relevamiento ya pagó **dos veces hoy**:
  1. El `grep` del paquete en el teléfono dio vacío; recién el control positivo (`pm path` sobre un paquete conocido; **141** samsung contra **0** copiloto) distinguió «no está instalado» de «mi comando no mira».
  2. La API de EAS dio **HTTP 403 con cuatro credenciales distintas**. Se leía como «no tengo acceso a la cuenta» y era **Cloudflare error 1010**: faltaba el `User-Agent`. La pista fue la **uniformidad** — un 403 de autorización habría discriminado entre un token válido y uno roto. Y el control negativo tuvo que corregirse, porque una credencial inválida **no da error**: da HTTP 200 con `me: null`.
- **Ejes separados, nunca colapsados** — un veredicto por eje, por pantalla:
  1. `veredicto_codigo` — existe y está completo el código.
  2. `veredicto_evidencia` — hay test que ejercita el **camino real**, con dobles sólo en los bordes externos.
  3. **`alcanzable_navegando`** — se llega desde el arranque de la app, sin deep link escrito a mano. *(Existe porque ya hay un hallazgo de UI escrita que nadie alcanza: una pantalla perfecta e inalcanzable da verde en código y en tests, y vale cero.)*
  4. `veredicto_device` — ejercitada en el teléfono. **Sólo lo escribe Fase C.** Hasta entonces el valor es `BLOQUEADO_POR_BUILD` (hoy, las 21) o `REQUIERE_DEVICE`, nunca vacío y nunca «presumiblemente OK».
- **Refutación obligatoria** de cada `EXISTE_Y_COMPLETO`: `lo_mas_fragil` (*qué tendría que ser falso para que este veredicto se caiga*) + **pregunta de mutación** (*si quito X, ¿qué test se pone rojo?*) + **auditoría de los controles positivos propios** (un control que prueba «mi grep ve por nombre» no prueba «no existe otra grafía»).
- **Un mutante sobreviviente se clasifica**, no se reporta crudo: *no hay test* ≠ *no hay diferencia observable bajo la configuración real*.

---

## 2 · DoD Fase A — inventario de código mobile *(sin teléfono · paralelizable · arranca ya)*

- [x] **A1 · Partición total.** HECHO por `inventario-mobile.py`: los **301** archivos `.ts`/`.tsx` de `apps/mobile` repartidos en **22** rutas + **115** componentes `.tsx` + **112** tests + **52** `.ts` de `src/`. Cero sin asignar, cero en dos lugares.
  ⚠️ **La versión previa de este criterio tenía un agujero:** pedía asignar «22 rutas y 115 componentes» y habría declarado *partición total* dejando **52 archivos `.ts` afuera** (los hooks, stores, adapters y tokens de tema donde vive buena parte de la lógica). Una partición que no suma al total no es una partición: es una muestra con nombre de censo.
- [ ] **A1.bis · Los 52 `.ts` asignados a su capacidad**, igual que los componentes. No son accesorios: `modules` 30 y `theme` 13 son donde viven las decisiones que la UI sólo refleja.
- [ ] **A2 · Cuatro ejes por pantalla**, para las **21**. Ninguna celda vacía.
- [x] **A3 · `alcanzable_navegando` — primer salto medido.** HECHO: **20 de 21** pantallas tienen ≥1 call-site de navegación **en producción** (no en tests), con su `path:línea`. La única con 0 es `/` (el índice), y eso es **correcto**: nadie navega *hacia* el punto de entrada. **Cero candidatas a 🕳️ en el primer salto.**
- [ ] **A3.bis · Alcanzabilidad TRANSITIVA.** El primer salto no alcanza: un botón puede vivir en una pantalla que a su vez no se alcanza. Hay que cerrar la cadena desde `/` hasta cada pantalla.
  **Dónde mirar, ya medido:** **10** de las 21 se alcanzan desde 2+ archivos distintos (redundantes), y **10 dependen de UN SOLO archivo** — `app/ajustes.tsx` es el único camino a **5** (`/ajustes-como-usar`, `/ajustes-cuenta`, `/ajustes-negocio`, `/ajustes-skins`, `/apps`), `PantallaPrincipal.tsx` a **2** (`/ajustes`, `/ingresos`), y `PantallaCuenta.tsx`, `PantallaMiDia.tsx` y `destinoActividad.ts` a **1** cada uno. Los dos hubs son `PantallaPrincipal.tsx` (9 rutas) y `app/ajustes.tsx` (8): si uno de ellos no se alcanza o su botón está tras un guard, caen en bloque — y el primer salto seguiría diciendo que todo está bien.
- [ ] **A4 · Refutación de cada `EXISTE_Y_COMPLETO`** con los tres instrumentos del §1. Un lote sin refutación **no cierra**; «refutación pedida» no es un estado terminal.
- [ ] **A5 · Los 110 tests clasificados** en: ejercita el camino real · mockea `@copiloto/core` (ejercita el componente, no el contrato) · afirma texto fuente · no ejercita el elemento que su nombre sugiere.
- [ ] **A6 · Índice de hallazgos** con la taxonomía en uso (🔥 🚫 🕳️ 🔬 📐 ♊), una clase por fila, conteos declarados == contados **por emoji** (la prosa tiene 19 grafías para 6 clases; contarla da 27 de 60 y acusa al documento).
- [ ] **A7 · Citas verificadas:** 0 rotas, 0 ambigüedades reales, instrumento **ejecutable desde la ubicación publicada**.

---

## 3 · DoD Fase B — relevamiento del BUILD *(sin teléfono salvo B0, ya hecho)*

- [x] **B0 · Identidad del binario instalado.** HECHO: no hay binario. 4 variantes de listado, 3 controles positivos (§0.bis).
- [x] **B0.bis · Estado de la plataforma EAS.** HECHO: 14 builds, 0 vigentes, último `development` del 07/09 @ `f8428b9e`, artefactos en 404 (§0.ter).
- [ ] **B1 · Las 27 candidatas nativas clasificadas** en exactamente una de: (a) **exige el binario** (módulo nativo) · (b) JS puro, viaja en el bundle · (c) declarada y **no importada** por el código. Cada una con la evidencia de cómo se determinó. **Acá se decide la hipótesis del §0.ter**: si entre los 98 commits aparece un import nativo nuevo, el binario viejo tampoco habría servido.
- [ ] **B2 · Los 8 plugins de `app.json` cruzados** contra lo que el build de B′ efectivamente produzca. Un plugin declarado no prueba un módulo presente — se verifica sobre el APK, no sobre el JSON.
- [ ] **B3 · Imports vs lockfile.** Todo módulo nativo **importado por el código** está en `dependencies`, y toda `dependency` nativa que el código **ya no importa** queda listada (peso en el binario y ruido en el diagnóstico). Incluye verificar que los tres paquetes de fuentes del §0.ter no aporten nada nativo.
- [ ] **B4 · `runtimeVersion`: decidido y escrito** si se declara o no, con el porqué. Hoy no está, ni en `app.json` ni en ninguno de los 14 builds, y su ausencia es lo que haría ambiguo todo rojo de C.
- [ ] **B5 · `versionCode` / `appVersionSource`: decidido.** Los 14 builds dicen `1`. Un binario instalado tiene que poder identificarse por lo que reporta el teléfono, no sólo por la plataforma — que ya probó que borra sus artefactos a los 14 días.
- [ ] **B6 · Deriva de identidad nombrada:** `name` dice **Odobi**, `applicationId` dice `app.copiloto.emprendedor`. Se decide y se escribe si el id se migra o se congela — **antes** de instalar, porque cambiarlo después desinstala y borra datos.
- [ ] **B7 · Veredicto binario:** qué pantallas de A puede ejercitar el binario **realmente instalado**. *Valor de hoy: **0 de 21**.* Se recalcula al cerrar B′.

> ⚠️ **B4, B5 y B6 chocan con un congelamiento vigente, y no lo había visto.** `scripts/ci/nativo-freeze.sh` bloquea todo cambio a `apps/mobile/package.json` o `apps/mobile/app.json` salvo que exista `NATIVO-APROBADO: <contrato>` en el body del PR, en un mensaje de commit del rango o en la env var. Y los tres criterios **escriben en `app.json`**: `runtimeVersion` (B4), `appVersionSource`/`versionCode` (B5) y `applicationId`/`name` (B6). O sea: **tres de los seis criterios de Fase B necesitan la excepción del congelamiento antes de poder siquiera commitearse**, y el propio gate dice quién la da (*«la aprueba planificación con el operador»*). Eso es un disparador externo, no trabajo mío: se pide temprano o bloquea al final.
> Medido hoy sobre este worktree: el gate corre y da `ok (sin cambios en apps/mobile/package.json apps/mobile/app.json)`, exit 0 — pasa porque esos dos archivos no difieren del `merge-base` (`6278836a`). No está pasando por fail-open: su fail-open (sin `merge-base` resoluble) es **ruidoso** y dice «guard NO evaluado», y tiene test propio que lo exige (`scripts/tests/test-nativo-freeze-evalua.sh`) precisamente porque este guard vivió cableado sin evaluar nunca, por el clon superficial de CI.

---

## 4 · DoD Fase B′ — build e instalación *(NUEVA · es la que gatea a C)*

> **Ya no hay opción barata.** Se midió: 0 de 14 builds vigentes, 404 en los artefactos. Hay que compilar. Lo que sí sobrevivió del intento anterior es la **receta**: `app.json` y `eas.json` no cambiaron desde `f8428b9e`, así que no hay que volver a decidir configuración nativa — sólo correrla.

- [ ] **B′1 · Vía elegida y escrita:** EAS perfil `development` (existe en `eas.json`, y **9 de los 14 builds ya usaron ese perfil** — 8 terminaron bien, así que está probado, no es una apuesta) **o** `expo prebuild` + gradle local. Se decide por costo y por quién tiene las credenciales, y queda registrado.
  **El costo real, medido sobre los 12 builds FINISHED** (`createdAt → completedAt`): **mín 27 · mediana 82 · máx 136 minutos**; los dos `development` más recientes, **41 y 49 min**. Esto corrige la cifra que circulaba en la memoria del proyecto — *«cola de HORAS, 4h 36min»* — que **ningún** build de este proyecto reproduce: venía de un caso suelto y se había vuelto la regla. Un dev-client EAS entra en una sesión.
- [ ] **B′2 · APK producido**, con su `gitCommitHash`, su id de build y su hash. Un build que nadie puede volver a identificar no es evidencia — y el §0.ter mostró que la plataforma **no lo guarda**: la identidad se anota en el documento, no se deja en expo.dev.
- [ ] **B′3 · Artefacto DESCARGADO Y GUARDADO fuera de la retención de 14 días.** Es la lección directa del §0.ter: el build de hace 5 semanas existió, funcionó, y hoy no se puede recuperar. El APK se baja y se archiva, o se vuelve a perder.
- [ ] **B′4 · Instalado y verificado EN EL TELÉFONO** con el mismo comando que hoy da vacío: `adb shell pm path app.copiloto.emprendedor` devuelve una ruta. **Ese comando es el criterio**, no «lo instalé».
- [ ] **B′5 · Los módulos nativos del APK listados** (`nativeLibraryPath` → `ls`) y cruzados contra B1/B2. Acá se cierra «el plugin está declarado» vs «el `.so` está en el binario».
- [ ] **B′6 · Arranque verificado:** la app abre y el dev-client toma el bundle de Metro por USB (`adb reverse`), con screenshot y `logcat`. Hasta acá, C sigue bloqueada.
- [ ] **B′7 · `abi` compatible:** el teléfono es `arm64-v8a`; el APK tiene que incluirla. Los 14 builds anteriores fueron todos ANDROID, así que el perfil ya produce lo correcto — se verifica igual sobre el APK nuevo.

---

## 5 · DoD Fase C — relevamiento EN DEVICE *(dueño único · receta escrita antes)*

- [ ] **C0 · Dueño único del teléfono, declarado.** Dos sesiones con ADB sobre el mismo device fabrican evidencia falsa. Mientras C corre, nadie más lo toca. *(Hoy el dueño es esta sesión.)*
- [ ] **C1 · Receta async por pantalla, escrita ANTES de conectar** — pasos, gestos y aserciones. No se improvisa con el device en mano.
- [ ] **C2 · Gestos con `adb input motionevent`** (DOWN/MOVE/UP). `input tap` **no** ejercita un `Pan` de RNGH: da verde sin haber tocado el gesto.
- [ ] **C3 · Iteración sin compilar** — válida **sólo después de B′**: dev-client instalado + Metro local por USB. Y Metro sirve el **checkout compartido**, no un worktree: se verifica qué bundle está sirviendo antes de atribuir un resultado.
- [ ] **C4 · Usuario canónico único:** `e2e-device@copiloto.test`. Ningún agente elige otro.
- [ ] **C5 · Evidencia por pantalla:** screenshot + `logcat` del tramo + el comando exacto. Un «funciona» sin artefacto no cuenta.
- [ ] **C6 · `veredicto_device` escrito para las N pantallas que B7 habilitó**; las excluidas quedan `BLOQUEADO_POR_BUILD` con el módulo faltante nombrado — no «no probado».
- [ ] **C7 · Cada rojo atribuido** a pantalla, build o entorno (red/sesión/datos). Un rojo sin atribución no es un hallazgo, es ruido. *Con `runtimeVersion` ausente (B4 sin resolver), la atribución pantalla-vs-binario es estructuralmente ambigua: por eso B4 va antes.*

---

## 6 · Gate de cierre (binario, mecánico, con control positivo)

Cerrado cuando `gate-relevamiento-mobile.py` sale **exit 0**. Criterios:

1. 21/21 pantallas con los 4 ejes, ninguna celda vacía.
2. 22 rutas + 115 componentes asignados; suma == denominador congelado.
3. Toda `EXISTE_Y_COMPLETO` con su refutación; **0** «pedidas».
4. Índice: filas consecutivas, una clase por fila, declarados == contados por emoji.
5. 0 citas rotas · 0 ambigüedades reales · los dos instrumentos de citas cuadran entre sí.
6. 27/27 nativas y 8/8 plugins clasificados (B1, B2) **contra el APK**, no contra el JSON.
7. **`adb shell pm path app.copiloto.emprendedor` devuelve ruta** — el gate lo corre, no lo asume.
8. **El APK del build nuevo existe en disco local** (B′3) y su `gitCommitHash` está escrito en el documento. La plataforma no es almacenamiento: probó borrar 12 artefactos.
9. B7 recalculado post-B′, y toda pantalla sin `veredicto_device` con `BLOQUEADO_POR_BUILD` + módulo nombrado.
10. **Control positivo propio:** ≥5 mutantes del documento que el gate **debe** poner en rojo; si alguno sale verde, el gate es ciego ahí y lo dice. Más ≥1 control positivo de device (un comando `adb` que debe fallar y falla) y ≥1 de plataforma (credencial mutilada ⇒ `me: null`).
11. El gate corre **desde la ubicación publicada**, no sólo desde el scratchpad.

---

## 7 · Lo que NO cuenta como terminado

- Mi autoevaluación. «Lo revisé y está bien» no es un criterio.
- Un `veredicto_device` **inferido** del código o de un test de Jest.
- **«El dev-client ya está instalado» como supuesto.** Hoy se midió y era falso. Se verifica con `pm path` cada vez que se abre una sesión de device.
- **«Hay un build en EAS» leído como «hay un APK».** Hoy hay 14 builds y 0 descargables. `FINISHED` no significa recuperable: la URL se pide y se lee el código de respuesta.
- Un `expirationDate` leído como el estado del artefacto. Es administrativo; el 404 es el hecho.
- «El teléfono está conectado» leído como «se puede probar». Conectado y vacío es el estado real de hoy.
- Un `EXISTE_Y_COMPLETO` sin refutación, o con la refutación «pedida» a un agente que no la entregó.
- Un verde de suite que incluya tests salteados sin contarlos.
- Una cifra sin unidad. Todo número lleva su denominador y cómo se contó.
- Un instrumento que sólo corre en la máquina donde se escribió.

---

## 8 · Entregables

| artefacto | qué es |
|---|---|
| `2026-10-1X-relevamiento-mobile-cierre.md` | **el documento de cierre, con el mismo formato y rigor que el del relevamiento de código**: denominadores congelados, método, 21 pantallas × 4 ejes, refutación por lote, índice de hallazgos por clase contado por emoji, mapa causa→síntoma, y toda cita verificable |
| §B / §B′ del mismo doc | 27 nativas + 8 plugins contra el APK, identidad del binario, estado de la plataforma, y **B7** recalculado |
| `gate-relevamiento-mobile.py` | el gate del §6, con control positivo de documento, de device **y** de plataforma, portable |
| `2026-10-11-eas-builds.py` | el instrumento que midió la plataforma. Lleva adentro las dos trampas que ya pagó: el **Cloudflare 1010** por falta de `User-Agent` (cuatro credenciales distintas, el mismo 403) y el **`me: null` con HTTP 200** de una credencial inválida, que obliga a que el control negativo pregunte por el dato y no por el error |
| recetas de C | una por pantalla, versionadas, reutilizables en el próximo sprint |
| el APK de B′ + su `gitCommitHash` | archivado **fuera** de expo.dev, porque la retención es de 14 días y ya se perdieron 12 artefactos |

---

## 9 · Orden y disparadores (actualizado por B0 y B0.bis)

| fase | disparador | estado hoy |
|---|---|---|
| **A** código | ninguno — arranca ya | ⏳ listo para arrancar |
| **B** build (sin B0/B0.bis) | ninguno — en paralelo con A | ⏳ listo para arrancar |
| **B′** build + install | **decisión de vía (B′1)** + las de `runtimeVersion` (B4), `versionCode` (B5) e identidad (B6), todas **antes** de compilar | 🔴 **bloquea a C** · no hay atajo: 0 de 14 artefactos vivos |
| **C** device | **`pm path` devuelve ruta** (B′4) + B7 recalculado | ⛔ bloqueada: 0 de 21 pantallas ejercitables |

**El backlog mobile se escribe cuando el gate sale exit 0**, no antes. Hoy se apoyaría en 1 fila del índice, un teléfono sin app y un APK que la plataforma ya borró.
