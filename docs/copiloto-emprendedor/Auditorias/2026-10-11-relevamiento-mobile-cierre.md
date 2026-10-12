# Relevamiento mobile — documento de cierre

> **Estado:** ✅ **CERRADO** en sus 10 secciones. Lo que queda abierto no es relevamiento: son los disparadores externos de §9 y la fase de build.
> **Criterios de cierre:** [`2026-10-11-DoD-relevamiento-mobile.md`](2026-10-11-DoD-relevamiento-mobile.md).
> **Antecedente:** [`2026-10-09-relevamiento-codigo-cierre.md`](2026-10-09-relevamiento-codigo-cierre.md) — el relevamiento de código, cerrado con 60 hallazgos de los cuales **1 solo cita `apps/mobile`**. Este documento existe porque mobile nunca fue un lote propio: entró como capa de cada capacidad de negocio y quedó `REQUIERE_DEVICE` por construcción.
> **Instrumentos publicados al lado:** `2026-10-11-eas-builds.py` · `2026-10-11-inventario-mobile.py` (v3) — los dos verificados corriendo **desde** la carpeta publicada, no sólo desde el scratchpad.

---

## §0 · Los tres sujetos

Un relevamiento mobile tiene **tres** sujetos, y confundirlos es la primera forma de mentir. El código dice qué está escrito; el binario dice qué se puede ejecutar; el teléfono dice qué pasa de verdad. Un verde en el primero no implica nada sobre los otros dos.

| sujeto | identidad exacta | cómo se midió |
|---|---|---|
| **código** | `apps/mobile/` en `C:/gfw-src/wt-relev`, contenido de **`6278836a`** (el mismo SHA del relevamiento anterior; `git diff --stat 6278836a HEAD -- apps/mobile` → **vacío**) | `git`, lectura directa |
| **plataforma** | proyecto EAS `@341lin/copiloto-emprendedor`, `projectId 05317fbe-ca0e-4f46-a63e-6f47a1cb118a` | `api.expo.dev/graphql` vía `2026-10-11-eas-builds.py` |
| **teléfono** | `SM-M127F` (Galaxy M12), serial `RF8T318RN9T`, Android 13 / API 33, `arm64-v8a`, USB **autorizado**, un solo usuario Android, `adb 1.0.41` | `adb devices -l`, `getprop`, `pm` |

**Dueño único del teléfono:** esta sesión mientras el relevamiento corre. Dos sesiones con ADB sobre el mismo device fabrican evidencia falsa.

---

## §1 · Método

**El grafo orienta, el código decide.** Ninguna afirmación entra por lo que diga el grafo, un comentario, un nombre de archivo o un documento. La documentación está **excluida como fuente** —`docs/**`, `*.md`, `coordinacion/**`—, ni para orientarse. Los seis lotes confirmaron por separado haber cumplido la exclusión. Todo lo que se afirma se abrió, y viaja con su `path:línea`.

**Cada sujeto decide sobre sí mismo.** El teléfono no se infiere de un test de Jest. La plataforma no se infiere de un `expirationDate`: se pide el artefacto y se lee el código HTTP.

**Cuatro ejes por pantalla, nunca colapsados en uno:**

1. `veredicto_codigo` — existe y está completo el código.
2. `veredicto_evidencia` — hay test que ejercita el **camino real**, con dobles sólo en los bordes externos.
3. `alcanzable_navegando` — se llega desde el arranque sin deep link escrito a mano.
4. `veredicto_device` — ejercitada en el teléfono. **Hoy, para las 21: `BLOQUEADO_POR_BUILD`** (§2).

El eje 3 existe porque el relevamiento anterior ya encontró **UI escrita que nadie alcanza**: una pantalla perfecta e inalcanzable da verde en código y en tests, y vale cero. En este relevamiento el eje 3 **pagó**: encontró `/midia` (§5.3), que los otros tres ejes declaran impecable.

**Refutación obligatoria** de todo `EXISTE_Y_COMPLETO`: `lo_mas_fragil` (*qué tendría que ser falso para que el veredicto se caiga*) + **pregunta de mutación** (*si quito X, ¿qué test se pone rojo?*) + **auditoría de los controles positivos propios**. Un mutante que sobrevive se **clasifica**, nunca se reporta crudo: *no hay test* ≠ *no hay diferencia observable bajo la configuración real*. Esa distinción aparece decenas de veces abajo y es la que separa una deuda de evidencia de un no-hallazgo.

**Ante 0 resultados: control positivo antes de concluir.** La regla cobró **cuatro** veces acá, y tres fueron contra instrumentos propios (§4).

**Clases de hallazgo** (se cuentan **por emoji**, nunca por la prosa de la etiqueta):

| clase | qué nombra |
|---|---|
| 🔥 | código roto en producción |
| 🚫 | protección o camino ausente |
| 🕳️ | capacidad completa que nadie alcanza |
| 🔬 | instrumento (test, gate, script, cifra) ciego |
| 📐 | evidencia que no toca producción |
| ♊ | duplicación divergente |

**Qué verifiqué yo y qué viene de un lote.** Los lotes son lectura delegada, no autoridad: cada hallazgo viaja con la cita que lo hace comprobable. Verifiqué de primera mano, re-midiendo: la partición y la alcanzabilidad completas (instrumento propio v3, §5), el falso positivo de comentarios abriendo las líneas acusadas (§4.3), `onAbrirItem` (0 asignaciones, control positivo `onAbrirActividad` → 1), `op-sqlite` (0 líneas de código en todo el repo), `contexto="Mi cuenta"`, los `router.push` crudos (**exactamente 3** en producción) y el conteo de tests web (**2**, donde el lote dijo 3 — §10). Lo demás es el lote con su cita.

---

## §2 · El teléfono: conectado y vacío

| medición | resultado |
|---|---|
| `adb shell pm path app.copiloto.emprendedor` | **vacío** |
| control positivo — mismo comando, paquete del sistema | `package:/system/priv-app/SVCAgent/SVCAgent.apk` ✅ |
| `pm list packages` filtrado por `copiloto` / `odobi` / `expo`, 4 variantes | **0 · 0 · 0 · 0** |
| control positivo — mismo conteo, `samsung` | **141** ✅ |
| `pm list packages` total | **358** — el instrumento ve |
| Expo Go, dev-client, build de release | **ninguno** |
| `.apk` / `.aab` en el repo · `android/` · `ios/` | **ninguno** → proyecto *managed*: hace falta `prebuild` o EAS |

### 🔥 H-01 · No hay binario: las 21 pantallas son 0 de 21 ejercitables

El teléfono está conectado, autorizado y **vacío**. No es que la app esté desactualizada: **no está**. Las 21 pantallas quedan `BLOQUEADO_POR_BUILD`, no «no probado».

**Qué premisa refuta.** La regla operativa vigente decía *«iterar en device NO compila nada — dev-client ya instalado + Metro local por USB»*. Es verdad **una vez instalado**. La frase describía un **estado**, se leyó como una **propiedad permanente**, y «el teléfono está conectado» se tomó por «se puede probar». Un estado que caduca por su cuenta no se afirma de memoria: se mide. La causa de la caducidad es un mecanismo que la premisa nunca nombró (§3).

---

## §3 · La plataforma EAS: 14 builds, cero sirven

Medido con `2026-10-11-eas-builds.py`, con control positivo (credencial real ⇒ username) y negativo (credencial mutilada ⇒ `me: null`).

| medición | resultado |
|---|---|
| builds del proyecto | **14** — 12 `FINISHED`, 1 `CANCELED`, 1 `ERRORED` |
| perfiles · plataformas | `development` **9** · `preview` **5** · ANDROID **14** · iOS **0** |
| con artefacto registrado | **12** |
| **builds NO expirados** | **0** — expiración más nueva: **2026-09-21** |
| descarga real de 3 artefactos (HEAD) | **404 · 404 · 404** |
| duración de los 12 `FINISHED` | mín **27** · mediana **82** · máx **136** min |
| los dos `development` más recientes | **41** y **49** min |
| `appBuildVersion` en los 14 | **`1`** (pese a `appVersionSource: remote`) |
| `runtimeVersion` en los 14 | **`null`** |

**El último build, con nombre y apellido:** id `13397737-2911-4b8d-a512-f80935bf3d99`, **2026-09-07** 14:22Z→15:11Z (**49 min**), perfil **`development`** —era el dev-client, justamente el que servía para iterar—, `FINISHED` con APK, commit **`f8428b9e`**, expiró el **2026-09-21**, su URL da **404**.

### 🔥 H-02 · El artefacto no «expiró en papel»: ya no existe

`expirationDate` en el pasado es un dato administrativo. Que la URL **baje o no** es la propiedad que importa, y se midió: **404** en los tres muestreados, el último incluido. **No hay nada que descargar e instalar.** Esto cierra la alternativa barata antes de intentarla: la pregunta no es «¿bajo el APK o compilo?», es «compilo, y además ya perdí la trazabilidad de lo que había».

**La retención de 14 días es la causa raíz de H-01.** El dev-client existió, funcionó y se evaporó sin que nadie hiciera nada. Un recurso que desaparece por inacción no deja síntoma hasta que se lo necesita.

### 🔬 H-03 · Los 14 builds son indistinguibles por versión

`appBuildVersion` es **`1`** en los catorce y `runtimeVersion` es `null`. Un binario instalado **no puede identificarse por lo que reporta el teléfono**: `dumpsys package` diría `versionCode 1` para cualquiera de los 14. La única identidad confiable es el `gitCommitHash`, que vive **en la plataforma** — la misma que acaba de probar que borra sus artefactos. Por eso §2 mide con `pm path` y no con la versión.

### 🔬 H-04 · La cifra de costo que circulaba no la reproduce ningún build

La regla operativa decía *«build EAS en la nube = cola de HORAS (un build previo tardó 4h 36min)»*, y con eso se descartaba la nube para iterar. **Ningún** build de este proyecto reproduce esa cifra: los 12 `FINISHED` dan mín 27 / mediana 82 / máx **136** minutos, y los dos `development` más recientes **41 y 49**. La cifra venía de **un** caso suelto y se volvió la regla. Consecuencia práctica: un dev-client EAS cuesta **~45–90 min** y **entra en una sesión**.

### 🔬 H-05 · El 403 de EAS no era de autenticación, y cuatro credenciales dieron lo mismo

La API devolvió **HTTP 403** con el `EXPO_TOKEN` de entorno, con el `sessionSecret` del CLI, y con cada uno en los dos headers posibles: **cuatro credenciales distintas, el mismo código**. Se leía como «no tengo acceso a la cuenta». Era **Cloudflare error 1010**: faltaba el `User-Agent`.

**La pista fue la uniformidad.** Un 403 de autorización habría **discriminado** entre una credencial válida y una rota; que las cuatro dieran idéntico acusaba al borde, no a la credencial. **Y el control negativo estaba mal planteado**: una credencial inválida en esta API **no da error**, da **HTTP 200 con `me: null`**. Un control que pregunta «¿hubo error?» la habría aceptado como válida. El control correcto pregunta por el **dato**.

---

## §4 · Mis propios instrumentos, auditados

Cuatro veces el primer resultado fue un defecto del instrumento, no un hallazgo. Van acá con nombre: un relevamiento que sólo audita el código ajeno no es un relevamiento.

### 🔬 H-06 · Un falso cero con la cara exacta del hallazgo buscado

El instrumento de alcanzabilidad busca, por cada ruta, quién la navega — para detectar la clase 🕳️. Su v1 exigía la comilla de cierre **pegada** al literal. Reportó que **`/legal` era la única pantalla con cero call-sites**. Era falso: el call-site real es `router.push('/legal?kind=tos')` —`src/modules/ajustes/PantallaCuenta.tsx:61` y `:66`— con **query string**, así que la comilla no venía pegada. El patrón cazaba la ruta, no **su forma real**.

**Por qué es peor que un bug cualquiera:** el instrumento existía para encontrar pantallas inalcanzables y su defecto **fabricó una**. Un falso cero no se siente como una falla: se siente como el hallazgo que fuiste a buscar, con su sección ya escrita.

### 🔬 H-07 · El mismo instrumento, inflando en el sentido opuesto

Para la raíz `/`, el patrón genérico matcheaba **cualquier** `"/"` citado: **136** call-sites. Un cero inventado y un número inflado, en el mismo script y la misma corrida. El patrón laxo sobre-matchea en el caso degenerado y el estricto sub-matchea en el caso con parámetros, y **ninguno de los dos extremos avisa**.

### 🔬 H-08 · La peor: conté **comentarios** como call-sites — y así tapé el único cero verdadero

La v2 no distinguía código de comentario. En este repo los comentarios **citan rutas constantemente** para explicar mecánica, así que produjo **10 call-sites fantasma**, verificados abriendo las líneas una por una:

| línea contada | qué es en realidad |
|---|---|
| `src/modules/midia/PantallaMiDia.tsx:267` | docstring que **afirma que `/midia` está viva** |
| `src/modules/midia/PantallaMiDia.tsx:329` | comentario `//` sobre `/inteligencia` |
| `src/modules/ajustes/PantallaCuenta.tsx:79` | bloque `{/* */}` que cita `/ajustes-feedback` y `/ajustes-soporte` (contó **doble**) |
| `src/modules/escritorio/EscritorioFunciones.tsx:22`, `:195`, `:256` | docstring + comentario + JSX comment, los tres con `/recientes` |
| `src/modules/actividad/BuscadorActividad.tsx:22` | docstring que cita `/gastos` |
| `src/modules/chat/TarjetaClientePropuesto.tsx:32`, `ChipArmarFactura.tsx:12`, `PantallaFacturacion.tsx:182` | comentarios |

**El caso que muerde es `/midia`.** Su **único** «call-site» era ese docstring, que dice: *«La ruta `/midia` sigue viva porque las tarjetas de actividad y los enlaces internos la usan»*. O sea: **el instrumento contó la afirmación de alcanzabilidad como su propia prueba**, y convirtió en 1 el único 0 verdadero del mapa. Mi §5 preliminar publicó *«20 de 21 alcanzables, cero candidatas a 🕳️»*. Medido de nuevo: **19 de 21**, y `/midia` es un hallazgo que mi instrumento tapó.

**La simetría con H-06 es el aprendizaje.** El mismo instrumento primero **fabricó** un hallazgo que no existía y después **tapó** uno que sí. Y el falso positivo es mucho más difícil de notar, porque no se lee como un error: se lee como la redundancia que uno quiere encontrar — *«tranquilo, hay dos caminos»*. Un cero te obliga a mirar; un uno te autoriza a seguir.

**El arreglo (v3).** Máscara de comentarios carácter por carácter con estado de comilla —un regex no alcanza: `'https://x'` y `// ver /gastos` se parecen demasiado, y equivocarse hacia el otro lado reintroduce H-06— más un **control negativo** nuevo: las 7 líneas verificadas a mano **no pueden** aparecer. Sin ese control la máscara podría estar apagada y **el verde de los controles positivos la absolvería**, porque los call-sites reales se encuentran igual con la máscara apagada. Corrida del v3: 4 controles positivos OK, techo OK, **7 controles negativos OK**, exit 0.

### 📐 H-09 · El instrumento publicado que no corría donde se publica

Los instrumentos del relevamiento anterior resolvían su documento y su raíz **hardcodeados** a la máquina donde se escribieron. El que acredita 766 citas no era ejecutable por el próximo lector, que es exactamente para quien se publica. Corregido con resolución en cascada y descubrimiento de la raíz; los dos instrumentos nuevos se verificaron **corriendo desde la carpeta publicada**.

---

## §5 · Inventario, partición y alcanzabilidad

### §5.1 · Partición total — 301 archivos, y el agujero que tenía mi propio criterio

| universo | n |
|---|---|
| rutas de Expo (`app/`) | **22** (21 pantallas + `_layout.tsx`) |
| componentes `.tsx` en `src/` | **115** |
| tests (`*.test.ts` / `*.test.tsx`) | **112** |
| otros `.ts` en `src/` | **52** |
| **TOTAL `.ts`/`.tsx`** | **301** |
| módulos (`src/modules/*`) | **21** |

**Dos correcciones a mis propias cifras.** Los tests eran **112**, no 110 — la primera cifra era estimada y la medición manda. Y más grave: el criterio de «partición total» pedía asignar «22 rutas + 115 componentes», con lo que habría declarado *partición total* **dejando 52 archivos `.ts` afuera**. Una partición que no suma al total no es una partición: es una muestra con nombre de censo.

**Los 52, asignados:** `theme` 13 · `chat` 6 · `adapters` 5 · `facturacion` 4 · `auth` 3 · `ajustes`/`apps`/`soporte`/`navegacion`/`util` 2 cada uno · `actividad`/`afip`/`captura`/`feedback`/`ingresos`/`inteligencia`/`midia`/`onboarding`/`recientes`/`splash`/`voz` 1 cada uno. Ahí viven hooks, stores, adapters y tokens de tema: las decisiones que la UI sólo refleja.

De los 52, **14** tienen test homónimo y **38** no. ⚠️ **«Sin test homónimo» no es «sin cobertura»**: **15** de esos 38 son barriles (`index.ts`), que se ejercitan vía sus consumidores. Los no-barriles sin test propio son **23** — entre ellos `adapters/almacen.ts`, `adapters/http.native.ts`, `adapters/http.web.ts`, `auth/useSession.ts`, `chat/mensajePendiente.ts`, `afip/cuitCache.ts`, `navegacion/empujarUnaVez.ts` y `theme/tokens.ts`.

### §5.2 · Alcanzabilidad, primer salto — 19 de 21

Medido con el v3 (máscara de comentarios, controles en los dos sentidos):

```
pantallas (sin layouts)                : 21
con >=1 call-site de produccion        : 19
*** con CERO call-sites de produccion  :  2 ***
de esas, con call-site SOLO EN TESTS   :  0
```

Los dos ceros son **`/`** y **`/midia`**. El de `/` es **correcto**: nadie navega *hacia* el punto de entrada, se aterriza ahí. El de `/midia` es un hallazgo.

### 🕳️ H-10 · `/midia`: una pantalla entera que nadie alcanza, y el código afirma lo contrario

`app/midia.tsx` monta `PantallaMiDia` sin props, lo que toma la rama `src/modules/midia/PantallaMiDia.tsx:498-504` (`MarcoGlass titulo="Mi día" testID="pantalla-midia"`). El código está **entero y bien testeado**: solapas, chips, contador, banner crítico, cuatro estados, swipe con relectura, cuatro cargas que degradan por separado.

**Y no se llega.** Cero call-sites de producción, medido con tres instrumentos independientes que coinciden: mi v3 con máscara; el medidor propio del lote de shell (que además verificó sus **10** diferencias contra el inventario viejo abriéndolas a mano, y los 10 eran comentarios); y el switch completo de `src/modules/actividad/destinoActividad.ts:62-79`, que mapea `gasto`, `presupuesto`, `cliente`, `factura`, `nota_credito` y `ticket_respuesta`, con `default → null`: **no hay caso `/midia`**.

**El docstring `PantallaMiDia.tsx:267-269` afirma** *«La ruta `/midia` sigue viva porque las tarjetas de actividad y los enlaces internos la usan»*, y `app/_layout.tsx:148-150` repite la afirmación. El código las refuta. La ruta sigue registrada en el Stack (`_layout.tsx:150`), así que es alcanzable por deep link, **no navegando**.

**Y el daño colateral es de evidencia:** de los ~33 tests de `PantallaMiDia.test.tsx`, **~32 corren el modo glass** (la ruta que nadie abre) y el modo que producción monta (`comoPortada`, la base de la app) lo cubre **uno** (`:415`). Mutación: si se quita el `if (!comoPortada)` de `:498`, se ponen rojos ~30 tests **y nada de producción cambia**. Es el gemelo exacto de borrar `app/midia.tsx`: ningún test rojo, ninguna navegación rota.

### 🚫 H-11 · Diez pantallas cuelgan de un solo archivo, y dos hubs sostienen el mapa

| archivo | es el ÚNICO camino a | rutas que alcanza |
|---|---|---|
| `apps/mobile/app/ajustes.tsx` | **5** — `/ajustes-como-usar`, `/ajustes-cuenta`, `/ajustes-negocio`, `/ajustes-skins`, `/apps` | 8 |
| `apps/mobile/src/shell/PantallaPrincipal.tsx` | **2** — `/ajustes`, `/ingresos` | 9 |
| `src/modules/ajustes/PantallaCuenta.tsx` | 1 — `/legal` | 3 |
| `src/modules/actividad/destinoActividad.ts` | 1 — `/soporte-ticket` | 5 |

`/ajustes` se alcanza **sólo** desde `PantallaPrincipal.tsx:185` (el avatar), y `ajustes.tsx` es a su vez el único camino a 5. **Si ese botón queda detrás de un guard que no se cumple, caen seis pantallas en bloque — y la medición del primer salto seguiría diciendo que todo está bien.** La alcanzabilidad es **transitiva**; el primer salto es necesario y no suficiente.

### 🚫 H-12 · El primer eslabón de 6 rutas es un gesto que arranca fuera de pantalla

El escritorio de 6 tiles (`/facturacion`, `/ingresos`, `/gastos`, `/presupuestos`, `/clientes`, `/inteligencia`) **arranca cerrado**: `src/shell/PanelFunciones.tsx:126` pone `y.value = -h` en la primera medida, y lo único visible es la pestaña de 44 px (`:132`). La apertura se resuelve en el `onEnd` de un **`Gesture.Pan()`** que trata el toque quieto como tap (`:85-105`) — **no hay `Gesture.Tap()` ni `Pressable`**, y la pestaña **no tiene `onPress`** (`:132-140`), así que la activación por lector de pantalla no tiene handler a dónde ir.

**Nadie lo verifica, y hoy nadie puede.** `PanelFunciones.test.tsx:29-38` se titula *«la pestaña es TOCABLE … WCAG 2.5.1»* y sólo asevera `accessibilityRole`/`accessibilityLabel`/`accessibilityState`; su propio encabezado declara que el comportamiento «se valida en device». Y `PantallaPrincipal.test.tsx:76-90` presiona los tiles en un render **sin layout**: `onLayout` nunca entrega `height`, así que el escritorio nace *abierto* — ejercita un estado que en el teléfono no ocurre al arrancar. Con device imposible, la alcanzabilidad real de esas 6 rutas desde el arranque **no la verifica nada**. La excepción medida es `/ajustes`: llega por el avatar de la capa base, y ese salto sí tiene test real (`PantallaPrincipal.test.tsx:129`).

---

## §6 · Dependencias nativas, plugins y el veredicto del binario

### §6.1 · Las 34 `dependencies` clasificadas

Determinadas por **contenido**, no por nombre: presencia de `android/`, `ios/`, `*.podspec`, `app.plugin.js`, `expo-module.config.json` y conteo de archivos nativos. Los `node_modules` usados son los del repo principal, previa verificación de que `apps/mobile/package.json` es **byte-idéntico** al del worktree.

| categoría | n |
|---|---|
| **(a) exige el binario** (nativo + importado) | **14** |
| **(b) JS puro** (importado) | **3** |
| **(c) declarada y no importada** | **17** |
| **TOTAL** | **34** ✅ |

**La lectura que importa para producir el APK: 28 de 34 exigen binario** (14 de (a) + 14 nativas de (c)); **6 viajan en el bundle**.

⚠️ **La tabla de tres categorías engaña sola, y por eso lleva una cuarta columna.** Las categorías del criterio se solapan: `expo-dev-client` cae en «(c) declarada y no importada» **y es lo más imprescindible del binario** — es el workflow Metro entero. Sin la columna *¿exige binario?*, un lector concluiría «no se usa, sacala». De los 17 de (c), **7 NO son peso muerto** aunque el grep dé 0: `expo` (núcleo), `expo-dev-client`, `expo-constants` (peer de `expo-router`), `expo-font` (**usado transitivamente**: `@expo-google-fonts/inter/useFonts.js:1` importa `loadAsync` de ahí), `expo-linking` (peer de `expo-router`), `react-native-screens` (dep **y** peer de `expo-router`), `expo-system-ui` (habilita el `userInterfaceStyle: "automatic"` de `app.json:7`).

### §6.2 · Los 8 plugins, y la pregunta inversa

Dos plugins son **críticos y están bien declarados**: `expo-audio` (su `withAudio.js` inyecta `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` **y el `<service> AudioControlsService`**, que el `AndroidManifest.xml` propio del paquete **no** declara) y `@react-native-google-signin/google-signin` (el login Google es la única alta self-service de la beta).

**La pregunta inversa —¿hay un nativo importado sin su plugin?— se responde NO. Y casi reporté lo contrario.** `expo-file-system` y `expo-image-picker` son nativos, están importados, tienen `app.plugin.js` y **no figuran en `app.json:plugins`**: tenía la cara exacta del hallazgo caro. Dos verificaciones lo refutaron: (1) `@expo/prebuild-config/build/plugins/withDefaultPlugins.js:185` define `legacyExpoPlugins`, que los incluye literalmente, con el comentario *«These get applied automatically to create parity with expo build in eas build»*; (2) aun sin plugin, los permisos llegan por **merge de manifiestos** del autolinking, leído en el `AndroidManifest.xml` de cada paquete. Los demás nativos importados **no tienen `app.plugin.js`**: no hay nada que declarar.

> 🔴 **CORREGIDO 2026-10-11 (post-prebuild) — la conclusión se sostiene, su SEGUNDA razón no.** «No hay nativo importado sin su plugin» sigue siendo cierto, y por la razón (1): `legacyExpoPlugins` los auto-aplica. Pero la razón (2) —*«aun sin plugin, los permisos llegan por merge de manifiestos»*— **afirmaba un efecto que este relevamiento declaró explícitamente no haber medido** (§Z: *«El `AndroidManifest.xml` resultante. No se corrió `prebuild`»*).
>
> Hoy se corrió. **El `AndroidManifest.xml` que genera `expo prebuild` NO contiene `CAMERA`** (0 hits, con control positivo verde: 9 `uses-permission` sí encontrados), aunque `expo-image-picker/android/src/main/AndroidManifest.xml` la declara. No es contradicción: el manifest del prebuild es **el de la app**, y el merge con los manifests de las librerías lo hace **Gradle al compilar** — una capa más abajo, que sólo el APK muestra. 🔑 **Así que la frase no estaba equivocada: estaba midiendo la capa equivocada**, y leer el manifest *del paquete* no puede acreditar lo que sale *del merge*. Reincidí en esto hoy mismo, con el mismo texto como sospechoso, antes de correr el prebuild. `CAMERA` quedó declarada explícita en `app.json` (§12): el código la pide en `useCapturaFoto.ts:64,69`, y así la pregunta no depende de un merge que no se puede medir antes del binario.

### §6.3 · ¿El binario de septiembre habría aceptado el bundle de hoy? — **hipótesis SOSTENIDA**

Premisa verificada primero: **98** commits y **197** archivos (+12.909/−2.348) entre `f8428b9e` y `6278836a` en `apps/mobile`; `app.json` **sin cambios bit a bit** (los 8 plugins, `newArchEnabled`, los 4 permisos y el `scheme`); `eas.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json` **sin cambios** — importa, porque un cambio en el plugin de worklets/Reanimated sí obligaría a recompilar; y el único cambio de `package.json` es **una línea**: salen `@expo-google-fonts/jetbrains-mono` y `space-grotesk`, entra `inter`.

Las dos mitades de la refutación, medidas:

1. **¿Los paquetes de fuentes aportan algo nativo?** **No.** `@expo-google-fonts/inter@0.4.2`: 18 `.ttf` + 20 `.js` + 20 `.d.ts`, **0 archivos nativos, 0 `android/`, 0 `ios/`, 0 podspec, 0 `app.plugin.js`**, sin `dependencies` ni `peerDependencies`. El matiz que sí había que mirar: `useFonts` no es del paquete, es un re-export de `expo-font` — que **sí** es nativo, pero estaba en `dependencies` **y** en `plugins` **en los dos commits, misma versión**, y declarado **pelado** (sin la opción `fonts`), así que no embebe nada: los TTF se cargan en runtime desde el bundle. Intercambiar paquetes de fuentes es un cambio **100 % de bundle**.
2. **¿Apareció un import nuevo de un módulo nativo?** **No**, con dos instrumentos que coinciden. Diff de conjuntos de paquetes importados entre refs: **nuevos = `@expo-google-fonts/inter`; desaparecidos = los dos de fuentes**, nada más. Control cruzado por líneas `+` de import en los 98 commits: todos los paquetes ya se importaban en `f8428b9e`. El único que merecía mirar de cerca —el `expo-audio` nuevo en `src/modules/auth/RevealEntrada.tsx:1`— no agrega nada nativo: `expo-audio` ya se importaba en tres archivos y su módulo nativo es uno solo.

**Veredicto: el binario del 2026-09-07 habría aceptado el bundle de hoy.** Lo que mató la iteración fue la **retención**, no el código. Dos salvedades que no lo invalidan: es un juicio **hacia atrás** y hoy no cambia nada (hay que compilar igual) — su valor es que *nada en 98 commits agregó requisito nativo*, así que el APK nuevo necesita exactamente los mismos 28 módulos; y los assets **de build time** sí divergieron sin que nadie los cablee (**H-49** — acá decía «H-43», puntero roto corregido el 2026-10-11; ver el recuadro de §9), y ésos no viajan por Metro: se hornean al compilar, y éste es el momento de arreglarlos. **Se arreglaron: §12.**

---

## §7 · La evidencia, clasificada — los 112 tests

Clasificados por **la evidencia más débil presente**, con precedencia D > C > B > A. Bordes que **no** degradan a B (siguen siendo A): `expo*`, `react-native*`, `src/adapters/almacen`, `Date.now`, `global.fetch`, `spyOn` de `Alert`/`Linking`/`Share`. **No-bordes** que sí degradan: `@copiloto/core`, el store de sesión, y módulos internos de producción reemplazados por dobles.

| categoría | n | % |
|---|---|---|
| **A** · ejercita el camino real | **53** | 47 % |
| **B** · mockea el núcleo | **52** | 46 % |
| **C** · asevera texto del fuente | **5** | 4,5 % |
| **D** · el nombre no corresponde a lo que ejercita | **2** | 1,8 % |
| **TOTAL** | **112** | ✅ |

⚠️ **La frontera A/B lleva un juicio declarado.** Los tests cuya fuente de datos entra **por prop** (`fuente` de `ListaActividad`, `actividad` de `EscritorioFunciones`) se contaron **A**, porque el doble entra por la API real de producción del componente. Con el criterio estricto —«tampoco verifican el contrato de cable»— serían **51 A / 54 B**. La cifra no se presenta sin su criterio.

### 📐 H-13 · El titular de §7: 52 de 112 reemplazan la capa de contrato, y la costura inyectable existe sin usarse

**Cero** tests de mobile inyectan un `HttpPort` falso vía `configurarApi`. La costura está construida y a mano —`packages/core/src/api/http.ts:61` (`export interface HttpPort { enviar(peticion): Promise<RespuestaHttp> }`) y `packages/core/src/api/config.ts:18` (`export function configurarApi(cfg: ConfigApi): void`)— y ningún test de `apps/mobile` la usa. Consecuencia medida: el fetch+parse por dominio y el mapeo de errores de `apiClient` (refresh 401 single-flight, `mapearError`) **nunca se ejercitan desde mobile**; un cambio de shape en una respuesta del backend **no pone nada rojo acá**.

**El matiz que lo hace menos grave de lo que suena, y hay que publicarlo:** los 52 usan `jest.requireActual` + spread, así que los **parsers de lectura de las cards** (`leerGastoPropuesto`, `leerClientePropuesto`, `leerIngresoPropuesto`, `leerPresupuestoPropuesto`, `leerFacturaPropuesta`) quedan **reales y sí se ejercitan** sobre payloads crudos `{kind, data}`. Lo que no se ejercita es la **capa de cable**, no el parseo de las cards.

**Los cinco agujeros más caros de los 52**, cada uno con el `path:línea` del mock: `modules/chat/useChat.test.ts:14` (el contrato fire-and-forget `POST /chat` → `GET /reply`, que **es** el moat) · `modules/facturacion/PantallaFacturacion.test.tsx:46` (**14** funciones mockeadas: toda la máquina de estados AFIP) · `modules/auth/sesionExpirada.test.tsx:22` (mockea `apiReal.*`, o sea **justo el 401/refresh que el test dice cubrir**: simula la expiración en vez de provocarla) · `navegacion/Guard.test.tsx:17` (el guard se valida contra un estado de sesión inventado: no se verifica que un token real expirado redirija) · `modules/ajustes/afip/PantallaAfipSetup.test.tsx:19` (el handshake con ARCA completo, errores incluidos).

### 🔬 H-14 · Cinco tests aseveran **texto del fuente**, no comportamiento

| test | qué asevera | qué pasa igual |
|---|---|---|
| `navegacion/inerteAlPerderFoco.test.tsx:47` | `expect(src).toContain('useInerteAlPerderFoco')` | un archivo que importe el hook y **no** aplique el spread; un comentario con el nombre también satisface |
| `theme/glass/presion.test.tsx:133` | ausencia/presencia del import de `presion` | **lo admite su propio docstring**: «un archivo que importe `pressableStyle` y no se lo pase a su `Pressable` pasa el guard» |
| `theme/movimientoReducido.test.tsx:91` | `not.toContain('useMovimientoReducido')` | código muerto que mencione el hook; no verifica que la animación se desactive |
| `theme/paresPintadosContraste.test.tsx:898`, `:911`, `:976-994` | lee `HudGrabacion.tsx` y `BotonVoz.tsx` como texto | un literal de color movido a una constante o a otro archivo deja esas tres secciones mudas sin cambiar el contraste |
| `theme/temaSinHex.test.ts:88` | regex de hex literal | un hex **construido** (`'#' + x`, interpolado, o venido de datos) pasa |

El de `presion` se cuenta igual, pero con una lectura distinta: **está autodeclarado**. Vale como registro de que el equipo ya sabe que ese verde no acredita comportamiento — y es el contraste exacto contra los otros cuatro, que no lo declaran.

### §7.bis · Las dos preguntas transversales, con su medición

**¿Tests salteados que un verde de suite no distingue de pasados?** **Uno, sobre 947 statements `it`/`it.each`** en los 112 archivos: `src/shell/shell.test.tsx:76`. **Cero** `.only`, `.todo`, `.failing`, `xit`, `xdescribe`, `fit`, `fdescribe`. Los 3 hits de `process.env` no son gates: *setean* `EXPO_PUBLIC_API_BASE`. Control positivo: la misma regex matcheó sintéticos de las siete formas, rechazó `it.each(` e `it(` planos, y encontró el `describe.skip` real. **Y lo que muerde es cuál es**: el único salteado es el único que monta el árbol real del router (H-35).

**¿Hay cobertura de la cadena de navegación?** **Sí — 11 sitios de aserción en 6 archivos**, y la respuesta correcta no era «ninguno»: `rutaAjustes.test.tsx:65` (`it.each` de los **8** tiles de ajustes, usando el componente de ruta real) · `PantallaPrincipal.test.tsx:88` (`it.each` de los **6** tiles de función), `:115`, `:129` (avatar → `/ajustes`), `:151` (encabezado → `/recientes`) · `PantallaCuenta.test.tsx:88` (`it.each` de los dos `/legal?kind=`) · `ChipArmarFactura.test.tsx:38` · `TarjetaClientePropuesto.test.tsx:202` · `TarjetaFacturaPropuesta.test.tsx:252` · `PantallaFacturacion.test.tsx:277` y `:305`.

**Tres huecos dentro de esa cobertura** — y el tercero es el que nadie había nombrado:

### 🚫 H-15 · `/agenda`: el call-site existe en producción y tiene cero aserciones

`src/shell/PantallaPrincipal.tsx:186` (`onAgenda={() => empujarUnaVez('/agenda')}`) no lo asevera ningún test. La costura se parte en dos mitades que nadie junta: `PantallaMiDia.test.tsx:425-437` sólo verifica que el botón llame a un `jest.fn()`; **nada** verifica el mapeo a `/agenda`. Control positivo: el grep del literal encuentra el call-site de producción y da cero del lado test.

### 🔬 H-16 · Ningún test verifica que la ruta aseverada **exista** como archivo

Los 11 sitios aseveran el **argumento** de `router.push`, no que el destino exista. Un typo como `/ajustes-soport` pasaría en los once. Y el único instrumento que lee `app/` del disco (`appSoloRutas.test.ts`) verifica otra cosa: que no haya archivos de test dentro de `app/`. Es el mismo agujero que H-34 por el otro lado: nada cruza las rutas **aseveradas**, las rutas **declaradas en el Stack** y los **archivos** que existen.

### ♊ H-17 · Cuatro overrides locales de Reanimated, cada uno omitiendo un subconjunto distinto

Son reemplazos **completos** que no spreadean el stub global de `jest.setup.js`: `modules/chat/ChatView.test.tsx:106` (omite `useAnimatedScrollHandler`, `withDelay`, `useAnimatedProps`, `useReducedMotion`; agrega `SlideInDown`/`SlideOutDown`) · `modules/chat/ControlesFlotantes.test.tsx:7` (sólo tres claves) · `modules/auth/RevealEntrada.test.tsx:11` y `modules/splash/IdentidadEntrada.test.tsx:14` (omiten `withSpring`, `runOnJS`, `Extrapolation`, `interpolate`, y dos más). Y `PantallaSoporte.test.tsx`, casi gemelo de `ChatView.test.tsx`, **nunca recibió** el agregado `SlideInDown`/`SlideOutDown`. El modo de falla es crash ruidoso, no silencio — por eso es severidad media y no 🔬: lo que crece es la divergencia, no el riesgo de falso verde.

### ♊ H-18 · Los tres gemelos de idemKey divergen, y uno cuelga de una sola línea ajena

Sólo `modules/ingresos/FormularioIngreso.idemKey.test.tsx:75` cubre el invariante «dos llamadas reales en la MISMA instancia (sin desmontar) ⇒ MISMA idemKey». Para cliente, el equivalente a través del reintento `forzar` se asevera **en otro archivo** (`modules/clientes/PantallaClientes.test.tsx:441`), así que borrar esa única línea lo deja sin test y el archivo que lleva `idemKey` en el nombre no lo nota. Para gasto **no falta nada**: `FormularioGasto` no tiene camino `posible_duplicado`/`forzar` en producción — un negativo verificado, no una omisión.

**Los dos controles obligatorios de este lote, con su resultado** (son los que impedirían que todo §7 fuera un artefacto de configuración): el `moduleNameMapper` de `jest.config.js` redirige **sólo React** (`^react$`, `^react/jsx-runtime$`, `^react/jsx-dev-runtime$`) — **ningún módulo de la app está redirigido**, así que no hay mock global encubierto; y `jest.setup.js` mockea **sólo bordes externos** (gesture-handler, reanimated, worklets, async-storage, svg, safe-area, `expo-audio`, `expo-image-picker`, fuentes, `expo-router` con `requireActual`) — **no hay mock de `@copiloto/core` ahí**, así que ningún test parece A por un mock global del núcleo.

---

## §8 · Las 21 pantallas, cuatro ejes cada una

`veredicto_device` = **`BLOQUEADO_POR_BUILD` en las 21**, por H-01. La columna no se repite.

| ruta | código | evidencia | alcanzable | nota |
|---|---|---|---|---|
| `/` | COMPLETO | (a) del componente · **la ruta, ningún test** | es el aterrizaje | mutar `index.tsx:19` a `<View/>` no pone rojo nada |
| `/midia` | COMPLETO | (b) densa, **~32 de 33 sobre la rama muerta** | **NO** 🕳️ | H-10 |
| `/inteligencia` | COMPLETO | (b) fuerte, 17 casos | sí, 3 saltos + 2 guards | `GET /inteligencia/portada` marcado `[CONNECT]` |
| `/legal` | COMPLETO | (a) del componente · **guard `kindDeParam` cero** | sí, 5 saltos | H-22 |
| `/ajustes-soporte` | COMPLETO + capacidad muerta | (a)/(b) densa, **un solo valor de `funcion`** | sí, 2 caminos | H-24 |
| `/facturacion` | COMPLETO + **CTA muerto** | (b), 31 casos · ruta sin test | sí, 3 caminos | H-19 |
| `/presupuestos` | COMPLETO + error roto | (b), 24 casos · **la costura sin test** | sí | H-20, H-22b |
| `/gastos` | COMPLETO + error roto | (b), 23 casos | sí, 2 caminos | H-20, H-26 |
| `/ingresos` | **PARCIAL** | (b), 17 casos · cero del fallo de red | sí, **un solo camino** | H-25 |
| `/ajustes-afip` | COMPLETO + mensaje mal atribuido | (b), 20 casos | sí, 2 caminos | H-21 |
| `/clientes` | COMPLETO + capacidad truncada | (b), 45 casos | sí, 3 caminos | H-23 |
| `/recientes` | **PARCIAL** | (b) + (d) | sí (y un comentario dice que no) | H-24b, H-31 |
| `/agenda` | COMPLETO (sólo lectura, por diseño) | (b), 10 casos · **navegación sin aserción** | sí, **tras 2 guards** | H-15, H-27 |
| `/soporte-ticket` | COMPLETO (sólo lectura) | (b) **delgada: 3 casos** | sí, **un camino frágil** | depende de estar entre los 20 ítems |
| `/apps` | COMPLETO | (b) densa, 14 casos | sí, **sin ningún guard** | la única cadena tapada en los dos saltos |
| `/ajustes` | COMPLETO | **(a)** `rutaAjustes.test.tsx`, las 8 keys | sí, un único camino | el mejor test del relevamiento |
| `/ajustes-cuenta` | COMPLETO | (b) · identidad mockeada | sí | H-37 |
| `/ajustes-negocio` | COMPLETO | (b), 17 casos + 2 sub-secciones, **la mejor** | sí | H-41 |
| `/ajustes-skins` | COMPLETO | **(a)** persistencia real | sí | H-40 |
| `/ajustes-como-usar` | COMPLETO | (b) con pieza (a) del buzón | sí | H-42 |
| `/ajustes-feedback` | **PARCIAL** | (b) con hueco estructural | sí | H-37 |

**Tres PARCIAL, diecisiete COMPLETO, una inalcanzable.** Y la cadena del hub se verificó eslabón por eslabón: el mapa `Record<AjusteKey,string>` de `app/ajustes.tsx:28-40` es **exhaustivo por tipo** (una key sin destino no compila), `agruparEnFilas` parte en filas **derivadas de `tiles.length`** y no con `slice` fijos, las 8 entradas tienen fila renderizada y presionable, y **no hay flag, rol ni `if` de estado** en toda la cadena. El tipo como gate es el patrón correcto, y aparece también en `RUTA_POR_FUNCION` (`PantallaPrincipal.tsx:43`).

---

## §9 · El congelamiento nativo: tres decisiones bloqueadas antes de empezar

`scripts/ci/nativo-freeze.sh` bloquea **todo** cambio a `apps/mobile/package.json` o `apps/mobile/app.json` salvo que exista `NATIVO-APROBADO: <contrato>` en la env var, en el body del PR o en un mensaje de commit del rango. Su propio texto dice quién da la excepción: *«la aprueba planificación con el operador»*.

**Y todo lo que el build nuevo necesita escribe en esos dos archivos:** `runtimeVersion` (hoy ausente, y es lo que haría ambiguo todo rojo de device), `versionCode` (hoy `1` en los 14 builds, H-03), `applicationId`/`name` (la app se llama **Odobi** y el id sigue diciendo `app.copiloto.emprendedor`), los cinco assets de build time sin cablear (H-43), y la poda de los siete nativos sin uso (H-46). **Es un disparador externo, no trabajo propio: se pide temprano o bloquea al final.**

> 🔴 **CORREGIDO 2026-10-11 (post-build) — este párrafo tenía DOS defectos, y los dos los destapó ejecutarlo.** Se deja el texto original arriba y la corrección acá, porque retirar la observación borraría la lección.
>
> **1 · Los punteros `H-43` y `H-46` NO apuntan a lo que la frase describe.** Los cinco assets de build time son **H-49**; `H-43` es un 🔥 sobre `app/ajustes-feedback.tsx:6` (el `contexto="Mi cuenta"`). Y «la poda de los siete nativos sin uso» **no tiene fila numerada**: es la categoría (c) de §6.1; `H-46` es un 🕳️ de deuda de comentarios. El mismo error de puntero está en **§6.3**, última línea, que también cita «(H-43)» para los assets. Causa: los ids se asignaron al final y la prosa quedó citando la numeración vieja.
>   🔑 **Y lo que esto dice del gate, que es lo que importa:** `C4` valida que los ids 1..59 **existan** sin huecos y que las clases cuadren — y pasa igual, porque `H-43` existe. Un gate que verifica la **existencia** del id nunca verifica su **referente**. Es la misma degradación que ya pagó `C2` (presencia global que absuelve a la tabla rota): la propiedad vive en la **correspondencia**, no en la existencia. Se agregó `C12` para medirla, con su mutante.
>
> **2 · De los tres campos que este párrafo declara bloqueantes, el build no tocó NINGUNO.** Medido al compilar: `eas.json` declara `appVersionSource: "remote"`, así que **EAS gestiona el `versionCode`** y el repo no lo escribe (H-03 sigue en pie: los builds son indistinguibles por versión — pero su causa es ésa, no un `versionCode` faltante en `app.json`); `applicationId` **ya es** `app.copiloto.emprendedor` (renombrarlo a Odobi crearía un paquete nuevo y perdería la instalación: es decisión MAYOR, no requisito del build); y `runtimeVersion` **no aplica** — `expo-updates` no está en `dependencies` y los tres últimos builds de Android reportan `runtimeVersion: None` (medido con `eas build:list --json`). **Lo único que el build exigió escribir fueron los assets de H-49** (más `CAMERA`, ver §12). El párrafo sobreestimó el alcance de su propio bloqueo: declaró bloqueantes tres campos sin medir si el build los pedía.

Medido hoy: el gate corre y da `ok (sin cambios en apps/mobile/package.json apps/mobile/app.json)`, exit 0. **No está pasando por fail-open** — su fail-open (sin `merge-base` resoluble) es **ruidoso**, dice «guard NO evaluado», y tiene test propio (`scripts/tests/test-nativo-freeze-evalua.sh`) justamente porque este guard vivió cableado en CI **sin evaluar nunca**, por el clon superficial del `checkout@v4`.

---

## §10 · Candidatos que medí y se cayeron (negativos verificados)

Un relevamiento que sólo publica lo que acusa está sesgado. Estos los perseguí con hipótesis concreta y el código los refutó; van escritos para que nadie los vuelva a litigar.

| candidato | hipótesis | veredicto |
|---|---|---|
| **♊** `src/adapters/http.native.ts` (80 líneas) y `http.web.ts` (68) | «el mismo cliente vive dos veces y el fix llega a uno» | **REFUTADO.** Split por plataforma deliberado: `src/adapters/plataforma.ts:7` importa `./http` y Metro resuelve a `.native`/`.web`. Ambos exportan por **default** para que el import no dependa de la plataforma (`http.web.ts:66`); la diferencia real está acotada al multipart (`http.web.ts:8`). Los dos tienen test |
| **🔬** los tests `.test.web.ts` | «hay tests `.web` que ningún proyecto jest ejecuta» | **REFUTADO.** `jest.config.js:168` define `testMatch: ['<rootDir>/src/**/*.test.web.ts']` para el proyecto `web`. **Son 2** (`adapters/almacen.test.web.ts`, `adapters/http.test.web.ts`) y los 2 matchean. ⚠️ **El lote reportó «3» y la medición da 2** — la cifra del lote no se publica sin re-medir |
| **🔬** el congelamiento nativo | «bloquea en teoría y nunca evaluó» | **REFUTADO hoy** — corre y decide. El antecedente es real y queda escrito (§9) |
| **🚫** `expo-file-system` / `expo-image-picker` sin plugin declarado | «nativo importado al que no se le aplica su config plugin» | **REFUTADO** por dos caminos: `legacyExpoPlugins` los auto-aplica (`@expo/prebuild-config/build/plugins/withDefaultPlugins.js:185`) y el merge de manifiestos del autolinking ya trae sus permisos (§6.2) |
| **🚫** identidad/tenant saliendo de env o constante en `/ajustes-cuenta` | «el tenant se hardcodea en algún lado» | **REFUTADO.** `me` sale de `useSession()` → `api.me()` por request con bearer del almacén. Control positivo: el grep de `cliente_id` da 39 ocurrencias (el patrón caza) y ninguna no-test es constante ni env; el **único** `process.env` en no-test es `EXPO_PUBLIC_API_BASE` — base URL, no tenant |
| **🚫** el cruce de las 20 rutas del Stack contra `app/` | «sobra un nombre muerto o falta una ruta» | **REFUTADO.** `FALTAN = []`, `SOBRAN = []`: 20 + `index` = 21 = las 21 pantallas. El hallazgo que queda es el **gate ausente**, no una desalineación actual (H-34, H-16) |
| **🔬** mezcla de los dos sentidos de «actividad» | «el feed SQL de negocio y la memoria conversacional se cruzan» | **REFUTADO.** El shell usa `listarActividad` (`PantallaPrincipal.tsx:27,79`) y nada en `src/shell`/`src/modules/chat` toca la memoria conversacional |
| **🔥** siete rutas sin `app/*.tsx` (`/chat`, `/documentos`, `/actividad?funcion=`, `/me`, `/reply`, `/transcribir`, `/catalog`) | «destinos de navegación que no existen» | **REFUTADO con file+line**: los siete son **paths HTTP de API dentro de docstrings**, no rutas de expo-router |
| **♊** el tercer gemelo de idemKey (gasto) | «le falta el caso que los otros dos tienen» | **REFUTADO.** `FormularioGasto` no tiene camino `posible_duplicado`/`forzar` en producción: no hay invariante que cubrir |
| **🔬** mock global encubierto del núcleo | «los A son A por configuración, no por mérito» | **REFUTADO.** `moduleNameMapper` redirige sólo React; `jest.setup.js` no mockea `@copiloto/core`; 0 directorios `__mocks__` fuera de `node_modules`; 0 `jest.doMock`/`setMock`/`unstable_mockModule`/`requireMock`/`createMockFromModule` |

**Lo que casi todos comparten:** el comentario del código explicaba la decisión y su motivo, y ninguno se resolvió contando archivos ni leyendo nombres — se resolvió abriendo **el archivo donde se elige**, que es un paso distinto de abrir el archivo sospechoso.

---

## §I · Índice de hallazgos

Conteo **por emoji**, nunca por la prosa. Un hallazgo con dos caras se cuenta en su clase **principal** y la secundaria se nombra en el texto.

### Los tres sujetos, mis instrumentos y la evidencia (§2–§7)

| # | clase | hallazgo | dónde |
|---|---|---|---|
| H-01 | 🔥 | No hay binario instalado: 0 de 21 pantallas ejercitables | §2 |
| H-02 | 🔥 | Los 12 artefactos EAS dan 404: no hay nada que instalar | §3 |
| H-03 | 🔬 | Los 14 builds son indistinguibles por versión (`appBuildVersion` 1, `runtimeVersion` null) | §3 |
| H-04 | 🔬 | La cifra «4h 36min» no la reproduce ningún build (real: 27–136 min) | §3 |
| H-05 | 🔬 | El 403 de EAS era Cloudflare 1010, y mi control negativo preguntaba por el error en vez del dato | §3 |
| H-06 | 🔬 | Falso cero propio: `/legal` reportada inalcanzable por no cazar el `?query` | §4 |
| H-07 | 🔬 | El mismo instrumento infló `/` a 136 call-sites por sobre-match | §4 |
| H-08 | 🔬 | **Conté comentarios como call-sites: 10 fantasma, y el docstring que afirma que `/midia` vive fue contado como su prueba** | §4 |
| H-09 | 📐 | Instrumentos publicados que no corrían desde su ubicación publicada | §4 |
| H-10 | 🕳️ | **`/midia`: pantalla entera inalcanzable; ~32 de 33 tests corren su rama muerta** | §5.3 |
| H-11 | 🚫 | 10 pantallas cuelgan de un solo archivo; 2 hubs sostienen 9 y 8 rutas | §5.4 |
| H-12 | 🚫 | El primer eslabón de 6 rutas es un `Gesture.Pan()` sin `onPress`, que ningún test ejercita | §5.5 |
| H-13 | 📐 | **52 de 112 tests reemplazan la capa de contrato; `HttpPort`/`configurarApi` existen y ningún test de mobile los usa** | §7 |
| H-14 | 🔬 | Cinco tests aseveran texto del fuente, no comportamiento (uno lo admite en su docstring) | §7 |
| H-15 | 🚫 | `/agenda`: el call-site de producción existe y tiene cero aserciones | §7.bis |
| H-16 | 🔬 | Ningún test verifica que la ruta aseverada corresponda a un `app/*.tsx` existente | §7.bis |
| H-17 | ♊ | Cuatro overrides locales de Reanimated, cada uno omitiendo un subconjunto distinto del stub global | §7.bis |
| H-18 | ♊ | Los tres gemelos de idemKey divergen; el de cliente cuelga de una sola línea en otro archivo | §7.bis |

### Dinero y facturación

| # | clase | hallazgo |
|---|---|---|
| H-19 | 🔥 | `facturacion-nueva-factura-pill` es un CTA **primario muerto** cuando el tenant no puede facturar: se pinta con `gate.tipo === 'bloqueado'` (`PantallaFacturacion.tsx:556`, `:632`, `:645-655`), el ternario evalúa el gate antes de `vista` (`:576` gana sobre `:602`) y el efecto de creación exige `'listo'` (`:339`). Toque sin efecto, sin error, sin cambio visual. El test `:261` monta este estado exacto y no lo ve |
| H-20 | 🔥 | El estado de error de Gastos y Presupuestos **instruye una acción imposible**: dice *«Tirá hacia abajo para reintentar»* (`PantallaGastos.tsx:187`, `PantallaPresupuestos.tsx:179`) y el `ScrollFormulario` con el `RefreshControl` **sólo se monta bajo `estado === 'ok'`**. La única recuperación real es cerrar el glass y reabrirlo, que el copy no menciona. **El mismo defecto vive dos veces** (♊) y ninguna de las dos ramas tiene test |
| H-21 | 🔥 | `PantallaAfipSetup` acusa un fallo de **lectura** con el mensaje de un fallo de **escritura**: el `catch` de `precargarPerfil` (`:229-231`) setea `estadoPerfil('error')` y ese estado dice *«No pudimos guardar tu perfil»* (`:634-638`). Un `GET` caído manda a revisar datos que nunca se intentaron guardar, y como el mismo estado lo setea el guardado, no hay forma de distinguirlos |
| H-22 | 🔬 | La costura presupuesto→factura tiene test **del callback, no del camino**: `PantallaPresupuestos.test.tsx:289` inyecta `onFacturar` como prop, nunca monta `app/presupuestos.tsx` ni cierra la puerta de `empujarUnaVez`. Quitar `reabrirNavegacion()` de `app/presupuestos.tsx:34` deja la suite verde y «Facturar» **muerto en producción** — el bug que el propio docstring de la ruta declara ya pagado. El contraste es exacto: para Facturación **sí** se escribió el test de la puerta cerrada (`PantallaFacturacion.test.tsx:294-306`) |
| H-23 | 🚫 | `/clientes` no puede mostrar más de 50 y **lo admite en pantalla sin ofrecer salida**: pinta «Mostrando X de Y clientes.» (`PantallaClientes.tsx:383-387`) y no hay «ver más»; `listarClientes` no acepta offset ni cursor (`packages/core/src/api/clientes.ts:135-139`); backend sirve 50 y topea 200. El orden alfabético aplica sólo a la página cargada y su propio docstring lo dice (`:63-66`) |
| H-24 | 🕳️ | **Los resultados de búsqueda y la lista paginada no se pueden abrir.** `FilaActividad.tsx:61` sólo hace la fila tocable si llega `onPress`, que deriva de `onAbrirItem` — y **`onAbrirItem=` tiene 0 asignaciones en todo el repo** (verificado; control positivo `onAbrirActividad=` → 1). Afecta a los 5 montajes: `PantallaFacturacion.tsx:661`, `PantallaGastos.tsx:268`, `PantallaIngresos.tsx:203`, `PantallaPresupuestos.tsx:252` y `PantallaRecientes.tsx:27`. El escritorio, en cambio, pasa el handler siempre (`PantallaPrincipal.tsx:176`): **mismo card, dos cableados, el fix llegó a uno** (♊). Consecuencia encadenada: el detalle de cualquier operación con más de 20 movimientos de antigüedad queda inalcanzable |
| H-25 | 🚫 | `/ingresos` **no tiene estado de error**: `EstadoLista` es `'cargando' \| 'ok' \| 'no_disponible'` y el `catch` manda cualquier fallo a `no_disponible` (`PantallaIngresos.tsx:87-89`), que dice *«los ingresos todavía no están disponibles en tu copiloto»* — un corte de red se reporta como «la función no existe». Y en ese estado **no hay forma de reintentar**. Su hermana `PantallaGastos` sí distingue (`:47`) |
| H-26 | 🔬 | El `Promise.all` de Gastos **contradice su propio docstring y el test elige el caso benigno**: `:42-44` promete *«El resumen NO bloquea la pantalla»*, pero `:85` hace `Promise.all` y `:100-102` manda cualquier rechazo a `error`. El test que acredita la promesa (`:202`) usa un resumen que **resuelve** con otro status, no uno que **lanza** — el caso del docstring queda sin ejercitar y falla |
| H-27 | 🕳️ | `PantallaAgenda` tiene una rama **escrita, testeada e inalcanzable**: *«Se cayó la conexión con Google Calendar»* (`:117-122`) sólo se pinta con `estadoGoogleCalendar === 'caido'`, y la **única** puerta a `/agenda` se oculta exactamente en ese caso (`PantallaMiDia.tsx:406`), con test que lo fija. Las dos lecturas vienen de la misma señal. El test que la cubre (📐) está verde sobre UI que el usuario no puede alcanzar |

### Clientes, actividad y navegación

| # | clase | hallazgo |
|---|---|---|
| H-28 | 🚫 | **Los dos guards de deep-link del repo no tienen ningún test, ni feliz ni adversarial.** `app/legal.tsx:11-14` (`kindDeParam`) y `app/ajustes-soporte.tsx:13-16` (`funcionDeParam`) declaran degradar al default ante un param inválido. Mutarlos a «devolver el param crudo» no pone rojo nada. Es literal el caso de la regla dura del repo: *control declarado y no ejercitado ⇒ indistinguible de ausente* |
| H-29 | 🚫 | **La protección que el código declara para las filas sin destino no existe en el composition root.** `FilaActividad.tsx:21-24` afirma: *«Es tappable SÓLO si tiene dónde aterrizar; `onPress` llega `undefined` para los tipos sin destino (hoy `ingreso`)»*. En el escritorio el handler se pasa **a todas** las filas sin consultar `destinoDe` (`EscritorioFunciones.tsx:279`), y el descarte ocurre *después* del toque, en silencio (`PantallaPrincipal.tsx:120-121`). Una fila `ingreso` **se pinta como botón y no hace nada** — exactamente el síntoma que el docstring dice evitar (*«se lee como la app está rota»*) |
| H-30 | 🕳️ | `funcion='como_uso_la_app'` es una **capacidad construida** —título propio (`PantallaSoporte.tsx:28`), hilo y namespace de storage propios (`useChatSoporte.ts:60-65`)— que **ninguna navegación produce**: los dos call-sites reales mandan `soporte_tecnico`, y `PantallaComoUsarLaApp.tsx:23` documenta que ese camino se retiró. Mutación: borrar el valor del enum no pone rojo nada **y no cambia producción** — la definición de capacidad inalcanzable |
| H-31 | 🚫 | **Tres `router.push` crudos saltean `empujarUnaVez`**, y son los únicos 3 de producción (verificado): `PantallaCuenta.tsx:61`, `:66`, `PantallaFeedback.tsx:165`. Dos toques rápidos apilan dos `transparentModal` — el defecto que `empujarUnaVez.ts:5-11` existe para matar y que se reportó en device. ⚠️ **Y el fix obvio rompe la pantalla**: la puerta es un flag de módulo que sólo reabren `/` y `/ajustes`, así que cambiarlos a `empujarUnaVez` sin más deja los enlaces legales **muertos para siempre**. El arreglo correcto es `empujarUnaVez` **+** `reabrirNavegacion()` en esos route-wrappers |
| H-32 | 📐 | **La convención «toda ruta hoja reabre la puerta» se enuncia como universal y la cumplen 7 de 22.** `app/soporte-ticket.tsx:13-14` dice *«mismo motivo que toda ruta hoja de esta carpeta»*; no la llaman `agenda.tsx`, `apps.tsx`, `recientes.tsx`, `ajustes-cuenta.tsx`, `ajustes-feedback.tsx`, entre otras. Hoy es inocuo; el día que una gane un botón de navegación, el síntoma es «la app se queda muda», que ya se pagó una vez. Y la regla divergió en los dos sentidos: `app/gastos.tsx:33` **sí** la llama siendo hoja que no navega a nada, contra lo que `empujarUnaVez.ts:23-24` fija |
| H-33 | ♊ | `idDeParam` vive **cuatro veces, byte a byte idéntica** (`app/clientes.tsx:22-26`, `gastos.tsx:22-26`, `presupuestos.tsx:23-27`, `soporte-ticket.tsx:21-25`), contra una **quinta variante inline** en `app/facturacion.tsx:27-28` que aplica la regex sólo a `comprobanteId` y deja `facturaId` con un `!== ''` que **no maneja el caso array**. Es el guard que decide si un deep link con id basura abre una pantalla o un cartel; un endurecimiento llegaría a uno |
| H-34 | ♊ | **Dos clientes y dos parsers sobre el mismo endpoint `/mi-dia/calendario`**: `packages/core/src/api/agenda.ts:91-110` (`leerAgenda`, con `desde/hasta`, parsea `grupos`) y `miDia.ts:216-260` (`leerCalendario`, sin params, parsea `eventos`). La puerta a `/agenda` se gatea con la salud del primero **medida por el segundo**: un fix de robustez en un parser no alcanza al otro, y la disponibilidad que se le muestra al usuario la decide la llamada que la pantalla no usa |
| H-35 | 🔬 | **Ningún test ejercita el tap de una fila de actividad → navegación.** Las filas se renderizan y se asevera su texto/monto (`BuscadorActividad.test.tsx:61-66`, `ListaActividad.test.tsx:78-80`, `PantallaRecientes.test.tsx:47-114`), pero ninguno **presiona** `actividad-<id>` ni pasa `onAbrirActividad` (grep en `*.test.tsx` → 0, con el literal de producción `actividad-${item.id}` confirmado en `FilaActividad.tsx:60`). `EscritorioFunciones.test.tsx:114-119` sólo ejercita el estado VACÍO. Lo único cubierto es el mapeo puro de `destinoActividad.test.ts`: el único camino a `/soporte-ticket` y el camino actividad→`/clientes` tienen **cero** evidencia de su cableado |
| H-36 | 📐 | **Asimetría de evidencia entre gemelos:** el pie de paginación de Clientes (`clientes-total`) no tiene ninguna aserción; el de Gastos sí (`PantallaGastos.test.tsx:238`). Mismo componente conceptual, misma frase, media cobertura. Idem `PantallaTicket`, que no cubre ni `error` ni `cargando` con 3 casos |
| H-37 | 📐 | **El contrato de `tipo` en `@copiloto/core` no lista el único tipo que surte `/soporte-ticket`**: `packages/core/src/api/actividad.ts:35` enumera seis y `ticket_respuesta` no aparece en ninguna línea de `packages/core/src` (control positivo: `nota_credito` sí aparece). No rompe porque `tipo` es `string` abierto, pero el único consumidor que lo entiende vive en mobile contra un tipo que el contrato del cliente no nombra |

### Ajustes

| # | clase | hallazgo |
|---|---|---|
| H-38 | 🔬 | **El guard anti-regresión de la grilla de Ajustes es ciego, y su docstring dice lo contrario.** `PantallaAjustes.test.tsx:82-85` se titula *«el último tile del array se renderiza»* y afirma sobre `ajuste-tile-facturacionAfip`, que es el **tile #2 de 8**; el último es `feedback`. Si alguien reintroduce el `slice(0,3)/slice(3,6)` que el bug tenía, se renderizarían 6, `facturacionAfip` seguiría presente y **este test seguiría verde** mientras `soporte` y `feedback` desaparecen en silencio. *Atenuante medido:* `rutaAjustes.test.tsx:50-67` sí se pondría rojo — existe un guard real, pero **el crédito está mal atribuido** |
| H-39 | 🔬 | **El comentario que declara exhaustividad está refutado por su propio archivo.** `PantallaAjustes.test.tsx:16-24` dice *«Las 5 entradas EXPLÍCITAS … sacar o agregar una obliga a nombrarla acá»*. Falso: `comoUsar`, `soporte` y `feedback` existen en el componente y **no están** en `TILE_KEYS`, con la suite verde. 3 de 8 tiles sin cobertura de render en el archivo que se llama `PantallaAjustes.test.tsx` |
| H-40 | 🔬 | **No existe guard de que cada ruta de `app/` esté declarada en el `Stack`.** `app/_layout.tsx:144-188` lista a mano 20 nombres. Hoy el cruce sale exacto, así que el hallazgo es el gate ausente: borrar un nombre deja la ruta **navegando** (expo-router la arma por `require.context`) pero con fondo **opaco** por defecto — se pierde el vidrio, en silencio, con la suite entera verde. **El molde del gate que falta ya existe**: `appSoloRutas.test.ts` lee `app/` del disco y trae su propio control positivo (`:46-52`); comparar ese listado contra los nombres declarados es el mismo instrumento con otra aserción. Es la otra mitad de H-16 |
| H-41 | 🔬 | **`shell.test.tsx` lleva un `.skip` cuya condición de pago ya se cumplió.** `:76` (`describe.skip`, único `it` en `:91`), con la condición escrita en `:74`: *«quitar el `.skip` cuando `modules/chat` esté portado»* — `modules/chat` existe con ~33 tests y `ChatView` está en producción. Es el **único** test que monta el árbol real con `renderRouter()` (`:102`), o sea que el skip vencido es exactamente lo que deja H-40 y H-16 sin cubrir, y es el único salteado de 947 statements |
| H-42 | ♊ | **`Row` y `Tile` son hermanos y el fix del toque llegó a uno.** `src/theme/glass/Tile.tsx:33` importa `Pressable` de **RNGH**, con 19 líneas de docstring explicando que es obligatorio (*«mientras la presión la maneje el responder system de RN y el scroll viva en RNGH, siguen siendo dos árbitros distintos decidiendo sobre el mismo dedo»*, medido sobre 97 eventos, causa del *«si lo apreto muy rápido no toma el primer tap… pero es random»*). `src/theme/glass/Row.tsx:11` importa `Pressable` de **react-native** — y `Row` vive dentro de `ScrollFormulario`, cuyo `ScrollView` es de RNGH: la condición exacta de dos árbitros. Contado: 12 archivos importan de RNGH, 18 de react-native, 21 usan `ScrollFormulario` |
| H-43 | 🔥 | **`app/ajustes-feedback.tsx:6` manda `contexto="Mi cuenta"` al backend desde una puerta que ya no es Mi cuenta** (verificado): la puerta es Ajustes › «Contanos qué tal» (`app/ajustes.tsx:39`) y la fila que vivía en Mi cuenta se retiró. Todo feedback enviado se etiqueta con un origen que ya no existe. **Y el test es el espejo del defecto, no su control**: monta `<PantallaFeedback contexto="Mi cuenta" />` hardcodeando el mismo valor, así que es estructuralmente incapaz de detectarlo |
| H-44 | 📐 | **El test que acredita la única puerta a Ajustes no puede ver la falla que importa.** `PantallaPrincipal.test.tsx:129` presiona `avatar-cuenta` por `testID` y afirma el push. Dos razones por las que no toca producción en el eje geométrico: `fireEvent.press` invoca el handler **sin hit-testing**, y `jest.setup.js` stubbea `useAnimatedStyle: () => ({})`, así que la capa del escritorio **no se traslada** en test y de hecho queda cubriendo Mi día a `y=0` — el test pasa igual. El aire real son **14 px** entre `ALTO_PESTANA=44` (`PanelFunciones.tsx:41`) y `paddingTop:58` (`PantallaMiDia.tsx:712`): dos constantes acopladas en archivos distintos **sin ningún instrumento que las vincule** |
| H-45 | 🔬 | **El gate de paridad de testID no puede ver los 8 tiles del hub**: `scripts/ci/testid_paridad.py:43` usa `testID="([^"]+)"` —sólo literales en comillas dobles— y los tiles son `testID={\`ajuste-tile-${t.key}\`}`, dinámicos. Está honestamente declarado como fail-open-con-reporte; se anota porque la grilla que gobierna 8 rutas queda fuera de ese control |
| H-46 | 🕳️ | **Deuda de comentarios que miente sobre el conteo, en tres lugares con tres cifras distintas.** `PantallaAjustes.tsx:12`, `:31`, `:123` dicen «5» contra **8** tiles reales; `PantallaSkins.tsx:33`, `:100` dicen «5 temas» contra **3** opciones en `skinsCatalogo.ts:24`. No es cosmético: en los dos archivos la cifra del comentario es la que un lector usa para decidir si el array está completo |
| H-47 | 🕳️ | **Código muerto en `PantallaPerfilNegocio`**: `guardar(seccion)` admite `'modo'` (`:124`, `:218`) y el único call-site pasa `'negocio'` (`:406`); `parcial` (`:229-236`) ignora `seccion` y manda siempre las 6 claves. El docstring describe *«dos secciones que se guardan por separado»* con *«cada botón manda sólo sus claves»*; hoy hay un botón |
| H-48 | 📐 | **El contrato prometido es de un back y el real son dos.** `PantallaComoUsarLaApp.tsx:30` afirma *«deja la pregunta en el buzón y cierra el glass; el chat de abajo la manda al recuperar el foco»*, pero el stack real es `/` → `/ajustes` → `/ajustes-como-usar`: `router.back()` devuelve a **`/ajustes`**, no a `/`, así que `ChatView` **no recupera el foco todavía**. La pregunta no se pierde: se **demora un toque**, y en el intervalo el usuario volvió a una pantalla donde no pasó nada visible. El test no lo ve porque monta la pantalla sola, sin stack — hay test del escritor y del buzón, **ninguno de la costura escritor→lector atravesando el stack** |

### Dependencias nativas y binario

| # | clase | hallazgo |
|---|---|---|
| H-49 | 🕳️ | **Cinco assets de build time que `app.json` no referencia: se pierden justo al compilar.** `app.json` referencia **uno solo** (`"icon"`). Existen y nadie los alcanza: `assets/splash-icon.png` (el plugin de splash está declarado **pelado**, usa el default del template), las **tres** piezas de un adaptive icon —`android-icon-background/foreground/monochrome.png`, incluida la monocromática de los themed icons de Android 13— sin `android.adaptiveIcon` que las consuma, y `assets/favicon.png` sin `web.favicon`. **Es lo más accionable del relevamiento**: son recursos nativos, se hornean al compilar, **no se arreglan por Metro**, y si el binario sale así hay que recompilar para corregir el splash y el ícono |
| H-50 | 🕳️ | **`@op-engineering/op-sqlite`: nativo, entra al binario, cero uso en todo el repo** (verificado: las únicas 3 líneas son `apps/mobile/package.json:9` y dos del lock; ni una de código, en ninguna rama del rango). Trae `android/` + `ios/` + podspec + 19 archivos nativos con SQLite compilado, y **autolinking mete los `.so` igual**, porque mira `node_modules`, no los imports. Candidato #1 a sacar **antes** de compilar |
| H-51 | 🚫 | **`react-native-audio-api`: peso muerto nativo hoy y trampa armada para mañana.** Sin un solo import —`src/adapters/audio/index.ts:12-20` documenta la decisión de usar `expo-audio`—, se linkea igual. Y tiene `app.plugin.js` que inyecta `FOREGROUND_SERVICE*` y el `<service> CentralizedForegroundService`, **no está en `app.json:plugins`** y **no está en `legacyExpoPlugins`**, así que nunca se auto-aplica; su `AndroidManifest.xml` propio está vacío. Quien lo importe **compilará y reventará en runtime en el device** por un `<service>` que no existe en el manifiesto |
| H-52 | 🚫 | **Siete paquetes nativos entran al binario sin que nada los use**: los dos de arriba más `expo-blur`, `expo-status-bar`, `expo-sharing` y la cadena muerta `expo-web-browser`+`expo-auth-session` (`oauth.ts:5` documenta que google-signin nativo los reemplazó). De cuatro de ellos **nadie más depende** (scan de deps+peerDeps de todo `node_modules`: sólo `copiloto-mobile`). Y tres ocupan renglón en `app.json:plugins`, **lo que hace parecer que están en uso**: cuando el binario nuevo falle, son superficie que hay que descartar a mano |
| H-53 | 🔬 | **`expo-navigation-bar` no tiene ningún instrumento: su ausencia es indistinguible de su presencia.** `app/_layout.tsx:49-58` resuelve el módulo con `require()` dentro de `try { } catch { return null }` — el catch se come la ausencia. Y no hay nada que lo mire: el grep sobre `app`, `src`, `jest.setup.js` y `jest.config.js` devuelve **sólo las 6 líneas de `_layout.tsx` mismo**; ningún test, y **`jest.setup.js` no lo mockea** (sí mockea otros diez módulos). Si el APK nuevo saliera sin el módulo, la barra queda visible, nadie se entera y ningún gate da rojo |
| H-54 | 🚫 | **El `try/catch` de `BarraNavegacionOculta` no puede atrapar el fallo que dice atrapar.** El `try` cubre el `require()` y el acceso al módulo, pero el `return <Barra hidden/>` **sólo crea el elemento**: si el componente lanza, lanza cuando React lo renderiza, **fuera** del `try/catch`. Y `expo-navigation-bar` **ya es dependencia declarada**, así que el `require` no falla: el modo de falla que queda vivo es el nativo-ausente **al renderizar**, que este guard no cubre — lo atraparía `LimiteDeError`, o sea la app muestra el fallback de error en vez de la app |
| H-55 | 📐 | **El docstring de `BarraNavegacionOculta` declara una premisa que ya era falsa en septiembre.** `_layout.tsx:39-47` afirma *«El APK actual del device es anterior a que `expo-navigation-bar` entrara al proyecto»*. Medido contra `f8428b9e`: ese commit **ya tenía** el paquete en `dependencies` **y** en `plugins`. El comentario se lee como protección viva y describe una condición vencida — y el `try/catch` que justifica es lo que hoy garantiza que H-53 falle callado |
| H-56 | ♊ | **Los 4 permisos Android de `app.json:11-16` duplican lo que el plugin de `expo-audio` ya inyecta** (`withAudio.js` con sus defaults agrega exactamente esos cuatro). Hoy converge porque el plugin es idempotente. Divergiría el día que alguien pase opciones —`enableBackgroundRecording: true` agrega `POST_NOTIFICATIONS` y `FOREGROUND_SERVICE_MICROPHONE`— o lo saque: la lista manual seguiría ahí, afirmando permisos que ya nadie respalda con un servicio en el manifiesto |
| H-57 | 🕳️ | **El botón de pronunciación y todo el camino de `useAudioPlayer` son inalcanzables.** `src/modules/auth/RevealEntrada.tsx:124` dibuja el botón sólo si `pronunciacionAsset != null` y `:97-103` monta el player con `seekTo(0)`+`play()`; **el único call-site de producción nunca pasa la prop** (`EntradaSesion.tsx:32-37`). El único que la inyecta es el test (`RevealEntrada.test.tsx:35-43`) — 📐 evidencia sobre un parámetro que producción no provee. Está declarado como deuda (`[ASSUMED_PENDING_VERIFY]`, falta el asset de voz); lo que se agrega es que **no hay asset en `assets/`** y el camino entero quedó verde en test y muerto en device |
| H-58 | 📐 | **`@jest/globals` importado sin declarar** (`src/theme/glass/campos/revelarCampo.test.ts`, ausente de `devDependencies`). Resuelve por hoisting de `jest`; rompería con `node_modules` aislados o con otro gestor de paquetes |
| H-59 | 📐 | **Dos ramas excluyentes de `PantallaMiDia` comparten el `testID` `pantalla-midia`** (`:500` glass y `:507` portada). Hoy no causa daño: `PantallaPrincipal.test.tsx:124-126` lo desempata con `midia-wordmark`. Queda como trampa cargada: un nombre con dos referentes en un árbol donde el testID **es** el instrumento de medición |
| H-60 | 🔥 | **El toque de la pestaña abre el escritorio, pero es INTERMITENTE — **4 de 6** ciclos, medido en device con un sensor que no depende de `uiautomator`.** `PanelFunciones.tsx` promete en su docstring *«la pestaña además es **tocable** … WCAG 2.5.1 pide una alternativa de un solo puntero»*, y el tap **existe y llega**: con las escalas de animación en su valor normal el toque quieto abre — **75,00 % de la pantalla cambia** — en 4 de 6 ciclos con reset completo, repartidos en dos corridas del instrumento `2026-10-11-toque-pestana-por-pixeles.py`. **Pero no de forma confiable:** al primer toque abrió **1 de 6**, al segundo **3 de 6**, y **2 ciclos no abrieron ni al tercer toque**. Para el usuario: toca la pestaña, no pasa nada, repite, y a veces sigue sin pasar nada. **Dos cosas retiradas de versiones anteriores de esta fila, las dos mías:** (1) que el tap fuera *inalcanzable* por vivir en `onEnd` de un `Gesture.Pan()` (`:94-98`) que un dedo quieto no activa — razonamiento canonico consistente con la medición de entonces (escalas en **0**, Reanimated en *reduced motion*) y refutado por la condición normal; (2) que *«el primer toque nunca abre»* — con n=3 se veía determinista y con n=6 no se sostiene | §12.3 |
| H-61 | 🔬 | **135 advertencias de RNGH en el bundle vivo:** *«None of the callbacks in the gesture are worklets»* — esos gestos corren en el **JS thread**, que es justamente lo que RNGH existe para evitar. **Atribución pendiente**: el aviso no nombra el detector y esta tanda no instrumentó cuál lo emite; adjudicárselo a `PanelFunciones` sin medir sería el error que este documento viene cazando | §12.3 |
| H-62 | 🔥 | **El primer gesto después de montar la pantalla se pierde; recién el segundo abre el escritorio.** Medido **3 de 3 ciclos** con reset completo (relanzar + login) y dos swipes idénticos de velocidad declarada — el 1º nunca abre, el 2º siempre —, más una cuarta confirmación del instrumento committeado. **¿Vale también para el toque? En parte, y menos de lo que parecía:** con las animaciones normales el primer **toque** no abrió en 5 de 6 ciclos — pero sí abrió en uno, así que para el tap no es la regla determinista que sí es para el arrastre (ver H-60, reescrito dos veces por esto). El primer **arrastre** tampoco movió la pantalla en 2 de 2 corridas con animaciones normales, lo que sí es consistente con el 3 de 3 original. Para el usuario: abre la app, arrastra la pestaña, **no pasa nada**, y tiene que repetir. Candidata dicha como candidata: `onEnd` abre con `if (max <= 0) return` sobre `alto.value`, que fija `onLayout`; lo medido es el **síntoma**. Es también lo que hizo que la primera corrida casi publicara un falso «escritorio inalcanzable» | §12.3 |

### Conteo por clase

| clase | n |
|---|---|
| 🔥 código roto en producción | **8** |
| 🚫 protección o camino ausente | **11** |
| 🕳️ capacidad completa que nadie alcanza | **9** |
| 🔬 instrumento ciego | **18** |
| 📐 evidencia que no toca producción | **10** |
| ♊ duplicación divergente | **6** |
| **TOTAL** | **62** |

**Las cifras de esta tabla están medidas por emoji sobre las filas del índice, no contadas a mano** — y la medición corrigió tres de las seis que había escrito de memoria (🚫 12→11, 📐 11→10, ♊ 4→6). Controles de la medición: **62 filas = 62 emoji**, ids `H-01`..`H-62` sin duplicados ni faltantes, y el regex probado contra una fila sintética. ⚠️ **Las tres filas nuevas de §12.3 (H-60, H-61, H-62) desactualizaron esta tabla y el gate lo cazó dos veces seguidas** — primero el hueco de id (`C4: ids faltantes [62]`), después el conteo (`declara 6 y hay 8`). Es el comportamiento buscado: una tabla de totales escrita a mano **siempre** se desincroniza del índice, y por eso la mide un gate y no la confianza. Es exactamente la falla que la regla previene: contar por la prosa de la etiqueta en vez de por el emoji.

**La forma de la distribución es el resultado de más alto nivel, y no es accidental.** Las dos clases más grandes son **🔬 (17)** y **🚫 (11)**: el problema dominante de `apps/mobile` hoy no es código que no existe — es **código que existe y nada lo mide**, más **protecciones que el código declara en un comentario y el composition root no implementa** (H-29, H-54), más **guards sin un solo test** (H-28). Cinco de los 17 🔬 son **instrumentos míos de este relevamiento** (H-03 a H-08), lo cual es la confirmación del método: si auditar mis propios instrumentos no hubiera producido hallazgos, no los estaría auditando.

**Y el mapa causa→síntoma tiene un solo nudo central.** Cinco hallazgos distintos —H-10 (`/midia` inalcanzable), H-46 (comentarios que mienten sobre el conteo), H-55 (premisa vencida del APK), H-39 (exhaustividad falsa) y los dos comentarios refutados de `_layout.tsx:160` y `PantallaMiDia.tsx:267`— son **la misma falla**: en este repo el comentario se usa como fuente, los comentarios envejecen y nada los mide. Mi propio H-08 es su caso extremo: un instrumento que leyó un comentario como evidencia y tapó el hallazgo que el comentario negaba. Si hubiera que arreglar **una** cosa de este relevamiento antes que las otras, es que **ningún gate lea comentarios y ningún lector los trate como medición**.

---

## §11 · El gate que acredita este cierre (y lo que rechazó)

«Cerrado» no es una afirmación mía: la mide `gate-relevamiento-mobile.py`, publicado al lado, con los 11 criterios del DoD. Corrido desde esta carpeta y también desde otro directorio (criterio 11):

```
OK  C1   21 pantallas x 4 ejes, 0 celdas vacias
OK  C2   301 = 22 + 115 + 112 + 52
OK  C3   0 marcas pendientes, 0 secciones en curso, se declara CERRADO
OK  C4   59 filas, ids 1..59 sin huecos, 6 clases cuadran una por una
OK  C5   129 citas: 127 verificadas contra el disco (0 rotas / 0 ambiguas) + 2 a node_modules
OK  C6   34 deps y 8 plugins clasificados (vs node_modules, NO vs APK)   [parcialmente BLOQUEADO]
OK  C9   las 21 con BLOQUEADO_POR_BUILD y el mecanismo nombrado          [parcialmente BLOQUEADO]
OK  C10  8/8 mutantes cazados (alcance C1-C5) + plataforma: real -> 341lin, mutilada -> me:null
OK  C11  corre desde la carpeta publicada
ROJO C7  `pm path app.copiloto.emprendedor` -> VACIO, con control positivo y negativo verdes
ROJO C8  0 APK atribuible a este proyecto en disco local
VEREDICTO: VERDE en el alcance declarado CODIGO+PLATAFORMA     (exit 0)
           SIN el flag de alcance: exit 2 — aprobar por omision seria el fail-open
```

**El alcance se declara, nunca se infiere del exit code.** Sin `--alcance=codigo-plataforma` el gate sale **exit 2** a propósito: los criterios 7 y 8 son imposibles hoy y un gate que los omitiera para poder cerrar sería exactamente el fail-open que este relevamiento documenta diecisiete veces. **El relevamiento de código y plataforma está cerrado; el de device no empezó y no se declara cerrado.**

### Lo que el gate me rechazó a mí, antes de aprobar nada

Escribirlo tiene más valor que el verde, porque es la prueba de que el instrumento puede decir no:

| rechazo | qué era |
|---|---|
| **C8 salió VERDE en falso** — el peor | Buscaba cualquier `*.apk` bajo el repo, `~/Downloads` y esta carpeta, y aprobó con un APK de 248 MB del 13 de julio **ajeno al proyecto**. Un gate que acredita «hay binario» con un binario cualquiera **dice menos que no haber corrido**. El criterio tiene dos mitades y miraba media: el APK debe ser el del build **y** su `gitCommitHash` estar escrito acá. Corregido: hoy exige atribución y sale **ROJO**, que es el estado real |
| **C5 fabricó 44 citas fantasma de 174** | Un segundo patrón de «nombre pelado» cuyo lookbehind no excluía `.` ni `-`, así que cazaba el **sufijo** de una cita ya contada: de `jest.config.js:168` extraía además el trozo *config·js* con la misma línea, y de `app/ajustes-feedback.tsx:6` el trozo *feedback·tsx*. Esos sufijos no existen como archivos, así que los reportaba como citas rotas del documento. Es **el mismo defecto de forma** que pagó el inventario (H-06, H-08): el patrón cazaba algo que *se parecía*. Medido con el lookbehind corregido, ese patrón aportaba **cero** citas legítimas — el documento siempre entrecomilla — así que se eliminó. (Los ejemplos van con `·` en lugar del punto **a propósito**: escribir la forma fantasma tal cual la volvería una cita rota de verdad, y haría tropezar al próximo lector con herramienta) |
| **C3 gritó en el caso sano** | Buscaba `TODO:` en minúscula sobre el texto en minúscula. En un documento **en español** eso matchea prosa normal (*«…y todo: …»*). Un guard que da rojo en el caso normal se desarma solo, porque el camino de menor resistencia pasa a ser ignorarlo. Corregido a case-sensitive con frontera de palabra: es un literal de código, no una palabra |
| **El control de plataforma no concluía** | Mi `urlopen` pelado dejaba cualquier no-2xx en «NO EJERCITADO», perdiendo la lección que el instrumento hermano ya tenía escrita (*«Nunca levanta: el error es un valor a reportar»*). **El fix existía en otro call-site y no viajó porque reescribí la llamada en vez de reusarla.** Corregido: hoy el control se ejercita y da `real → 341lin`, `mutilada → me:null` |
| **El reporte repetía un bloqueo 9 veces** | Los checks de documento corren 1 vez de verdad + 1 por mutante, y cada corrida appendeaba. Un reporte que hay que leer en diagonal es un reporte que no se lee |
| **🔥 Un mutante salió VERDE — y destapó un agujero de origen en C2** | `C2` verificaba cada cifra de la partición **en cualquier parte del documento**. Al escribir esta misma sección agregué la frase «la partición real de **301**», y esa **mención suelta absolvió una tabla de partición rota**: el mutante que cambia 301 por 299 pasó. El check no medía la propiedad — medía que el número estuviera escrito en algún lado. Corregido: hoy se mide **dentro de la tabla de §5.1**, que es donde la propiedad vive. Sin el bloque de mutantes, este agujero se publicaba con cara de verde |
| **C3 le prohibía al documento hablar de sí mismo** | Al describir el marcador en esta tabla, el documento **contiene** el marcador, y el guard lo leyó como trabajo sin terminar. **La mención no es la cosa** — es la **tercera** vez que esta familia muerde en el día, después del docstring que afirmaba que `/midia` estaba viva (H-08) y del patrón que cazaba un sufijo parecido (C5, arriba). Corregido: los marcadores se buscan fuera de los code spans |

**Y una corrección a dos criterios del DoD, no al documento.** El DoD pedía «22 rutas + 115 componentes == denominador»: esa suma deja **52 archivos `.ts` afuera**, así que el gate asevera la partición real de **301**. Y pedía «27/27 nativas» cuando las `dependencies` medidas son **34**. El gate afirma la **medición**, no la cifra que el DoD escribió antes de medir — un criterio que contradice la medición se corrige, no se cumple de mentira.

---

## §12 · El binario, el device y lo que sólo el APK podía contestar

**Estado:** H-01 cerrado. Las 21 pantallas dejan de ser `BLOQUEADO_POR_BUILD`.

### §12.1 · El build, y su atribución

| qué | valor | cómo se midió |
|---|---|---|
| build | `a0c8c8b7-cd19-4945-9bd7-72a9f4e789c7`, perfil `development`, `FINISHED` | `eas build:list --json` |
| commit | **`5e19949f`** | el mismo campo `gitCommitHash` |
| artefacto | `artefactos-build/copiloto-dev-client-5e19949f.apk`, 325,4 MB | archivado **antes** de instalar |
| `versionCode` / `versionName` | `1` / `0.1.0` | `dumpsys package` del APK instalado |
| instalación | `package:/data/app/~~bHVMdrjW3rQkFtBgnbPGqw==/app.copiloto.emprendedor-Wy59w-VlXX` | `pm path`, con control positivo y negativo |
| device | `RF8T318RN9T`, dueño único verificado | `adb devices` |

**La atribución no es un supuesto.** `5e19949f` sale de `6278836a` —el SHA que §0 declara como sujeto
de este relevamiento— y su **único** diff en `apps/mobile` es `app.json` (`1 insertion, 17 deletions`
contra `origin/main`, medido con `git diff --stat`). Es decir: el JS que corre en el teléfono es el
código relevado, no una base vecina. El `app.json` sólo afecta la capa nativa, ya horneada.

El artefacto se archivó **con el SHA en el nombre y antes de instalar**, porque la retención de EAS
es de 14 días y ya borró 12 builds de este proyecto (los 3 muestreados dan 404). Un binario que vive
sólo en `expo.dev` tiene fecha de desaparición, y con él se va la única forma de volver a inspeccionar
lo que se instaló.

### §12.2 · Lo que el APK contestó y el prebuild no podía

Los **11** permisos que el APK pide de verdad (`dumpsys package`, acotado a la sección
`requested permissions:` — el dump entero sobre-reporta 137 de ruido sobre `com.android.settings`):

```
ACCESS_NETWORK_STATE   CAMERA*   CHANGE_WIFI_MULTICAST_STATE   FOREGROUND_SERVICE*
FOREGROUND_SERVICE_MEDIA_PLAYBACK*   INTERNET   MODIFY_AUDIO_SETTINGS*   RECORD_AUDIO*
SYSTEM_ALERT_WINDOW   VIBRATE   WAKE_LOCK
```
`*` = los 5 declarados en `app.json`. **Los otros 6 nunca se escribieron en ningún lado del repo.**

🔑 **Y esto resuelve la pregunta que §6.2 dejó abierta.** El texto original afirmaba que los permisos
llegan por el **merge de manifiestos**; la corrección del mediodía lo degradó a *no demostrado*,
porque el manifest que genera `expo prebuild` tenía **0** hits de `CAMERA` y el merge de Gradle es
invisible antes del binario. Con el APK en la mano hay un caso positivo **con nombre y path**:

> `CHANGE_WIFI_MULTICAST_STATE` lo declara `expo-dev-launcher/android/src/debug/AndroidManifest.xml`,
> no está en `app.json` ni lo escribe ningún plugin de config — **y está en el APK**.

Es decir: **el merge de Gradle sí incorpora los `uses-permission` de los manifests de las librerías**,
que era exactamente el mecanismo que §6.2 afirmaba. Como `expo-image-picker/android/src/main/AndroidManifest.xml:4`
declara `CAMERA` **sin `maxSdkVersion`**, la inferencia —dos premisas medidas, no una conjetura— es que
`CAMERA` habría llegado igual sin declararla. Declararla explícitamente es, a lo sumo, redundante; y
sigue siendo lo correcto, porque el código la usa (`useCapturaFoto.ts:64,69`) y un permiso que depende
de que una dependencia transitiva no cambie su manifest es una garantía prestada.

**Lo que NO queda demostrado, y se dice:** que `CAMERA` específicamente llegue por esa vía no se midió
—haría falta un segundo build sin declararla—. Lo medido es el **mecanismo**, con un caso positivo.
`READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` de esa misma librería **no** aparecen, pero eso no
prueba lo contrario: las dos traen `android:maxSdkVersion="32"` y el device está por encima.

> 📸 **Las capturas del device NO estan versionadas, y las citas a ellas mueren en un clon.** Viven
> en artefactos-build/device-capturas del worktree, junto al APK (que ya estaba gitignored). **No se
> commitean a proposito:** son pantallas de la app con datos del usuario de prueba y **este repo es
> publico** (§cabecera de `CLAUDE.md`). Consecuencia que se dice en vez de descubrirse despues: cada
> nombre de captura citado aca es verificable **solo en la maquina que corrio la receta**. Lo que
> sostiene cada veredicto sin ellas es el log de la corrida y el JSON de resultado, que si estan
> versionados.

#### §12.2.bis · Lo nativo, ahora medido DENTRO del binario (y no contra `node_modules`)

§6.1 clasificó las **34** dependencias y los **8** config plugins contra `node_modules` y el código
de cada plugin, porque no había binario. Con el APK en mano la otra mitad deja de estar bloqueada:

| qué | medido en el APK |
|---|---|
| librerías nativas | **120 `.so`** — **30 distintas × 4 ABIs** |
| ABIs empaquetadas | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` (30 cada una) |
| control positivo | `libreanimated.so`, `libgesturehandler.so`, `libhermesvm.so` presentes |
| control negativo | una librería inventada → 0 hits |

🔑 **Las cuatro ABIs explican buena parte de los 325,4 MB.** Un dev-client los trae a propósito
—corre en emulador x86 y en teléfono ARM—, así que esto **no es un defecto del build**; se registra porque la
cifra de tamaño no se entiende sin ella, y porque un build de distribución que arrastre las cuatro
sí sería un problema. **Lo que no se midió:** a qué dependencia pertenece cada `.so` — el mapeo nombre→paquete
no es 1:1 y afirmarlo sin medir sería exactamente lo que §12.2 acaba de corregir.

### §12.3 · Las 21 pantallas en device, y los dos ejes que no son uno

**Por qué dos columnas y no un «veredicto_device».** Una pantalla puede **montar** perfecta y ser
**inalcanzable** navegando. H-10 lo prueba: `/midia` se abre por deep link y **cero** call-sites
navegan hacia ella. Un verde único las habría fundido y, peor, habría **lavado** H-10. Van separadas:
**EJE A** (¿se LLEGA tocando lo que el usuario toca?) y **EJE B** (¿MONTA por `copiloto://<ruta>`?,
que acredita render y nada más).

| ruta | testID verificado | EJE B · monta | EJE A · se llega |
|---|---|---|---|
| `/` | `panel-principal` | MONTA | — |
| `/midia` | `pantalla-midia` | MONTA | — |
| `/inteligencia` | `pantalla-inteligencia` | MONTA | ⚠️ no atribuible |
| `/legal` | `legal-screen-tos` | MONTA | — |
| `/ajustes-soporte` | `pantalla-soporte` | MONTA | — |
| `/facturacion` | `pantalla-facturacion` | MONTA | **LLEGA** |
| `/presupuestos` | `pantalla-presupuestos` | MONTA | ⚠️ no atribuible |
| `/gastos` | `pantalla-gastos` | MONTA | NO LLEGA |
| `/ingresos` | `pantalla-ingresos` | MONTA | NO LLEGA |
| `/ajustes-afip` | `pantalla-afip-setup` | MONTA | — |
| `/clientes` | `pantalla-clientes` | MONTA | ⚠️ no atribuible |
| `/recientes` | `pantalla-recientes` | MONTA | — |
| `/agenda` | `pantalla-agenda` | MONTA | — |
| `/soporte-ticket` | `pantalla-ticket` | MONTA | — |
| `/apps` | `pantalla-apps` | MONTA | — |
| `/ajustes` | `pantalla-ajustes` | MONTA | — |
| `/ajustes-cuenta` | `pantalla-cuenta` | MONTA | — |
| `/ajustes-negocio` | `pantalla-perfil-negocio` | MONTA | — |
| `/ajustes-skins` | `pantalla-skins` | MONTA | — |
| `/ajustes-como-usar` | `pantalla-como-usar` | MONTA | — |
| `/ajustes-feedback` | `pantalla-feedback` | MONTA | — |

**EJE B: 21 de 21 montan**, cada una con su testID correcto, ninguna `NO_ATRIBUIBLE`. Es el resultado
que cierra H-01: las 21 pantallas dejan de estar `BLOQUEADO_POR_BUILD`.

**EJE A: 1 de 6 verificado, y el resto NO se declara rojo.** `/facturacion` llega. `/ingresos` y
`/gastos` dieron `NO LLEGA` y **quedan sin atribuir**: después de volver con `BACK` el escritorio se
cierra, y aunque el instrumento lo reabre, el patrón de H-62 (abajo) hace que el primer gesto de cada
reapertura se pierda — no puedo separar «la ruta no responde» de «mi gesto se perdió». Las tres
últimas salieron explícitamente `NO_ATRIBUIBLE_ESCRITORIO_CERRADO`. **Cinco casillas sin veredicto
son cinco casillas sin veredicto**, no cinco rojos.

> ⚠️ Las escalas de animación del sistema van en **0** durante la corrida (`uiautomator` no consigue
> idle mientras algo anima y devuelve un árbol **vacío**, que se lee como «la pantalla no tiene
> nada»). Y el log del bundle destapó un efecto que yo no había declarado: eso pone a **Reanimated en
> modo *reduced motion*** (*«Some animations will be disabled by default»*). Consecuencia: el eje A
> mide **NAVEGACIÓN**, no la calidad de la animación, y **ese pendiente quedó CERRADO el mismo día**: se
> repitió el toque con las escalas en **1** y con un sensor que no depende del idle de `uiautomator`
> (bytes distintos entre framebuffers crudos, con su piso de ruido medido antes de usarlo). El
> resultado **reescribió H-60**: el toque SÍ abre, nunca al primer intento y no siempre. Un
> veredicto que no sobrevive fuera de la condición que el instrumento necesitaba era un veredicto
> **sobre el instrumento**.

#### 🔥 H-60 · El toque de la pestaña **sí abre**, pero nunca el primero — y no siempre

**Esta sección reemplaza una que afirmaba lo contrario, y la corrección es mía.** La v1 cerró
*«el toque no abre nada»* y le adjudicó una causa —el tap vive en una rama de `onEnd` de un
`Gesture.Pan()` que un dedo quieto no activa, así que `alternar()` nunca se llama— **deducida de la
skill canónica y consistente con todo lo que había medido**. Era falsa.

`PanelFunciones.tsx` promete en su propio docstring una alternativa de un solo puntero:

> *«La pestaña además es **tocable**, no sólo arrastrable — WCAG 2.5.1 pide una alternativa de un
> solo puntero para cualquier función que se consiga con un gesto de trayectoria.»*

**Lo medido con las escalas de animación en su valor normal (1): 6 ciclos con reset completo,
en dos corridas del instrumento publicado `2026-10-11-toque-pestana-por-pixeles.py`.**

| corrida | ciclo | abrió en el toque | cambio de pantalla, toque por toque |
|---|---|---|---|
| A | 1 | **2** | 0,00 % · **75,00 %** |
| A | 2 | **2** | 0,00 % · **75,00 %** |
| A | 3 | ninguno de 3 | 0,00 % · 0,00 % · 4,86 % |
| B | 1 | **1** | **75,00 %** |
| B | 2 | ninguno de 3 | 0,00 % · 0,00 % · 0,67 % |
| B | 3 | **2** | 0,00 % · **75,00 %** |

**Abrió en 4 de 6.** Al primer toque **1 de 6**, al segundo **3 de 6**, y **2 ciclos no abrieron ni
al tercero**.

⚠️ **La corrida A sola decía otra cosa, y yo la escribí.** Con sus 3 ciclos —toque 1 en
0,00 % las tres veces— el patrón parecía **determinista**: *«el primer toque nunca abre, es H-62
aplicado al tap»*. La corrida B abrió **al primero** en su primer ciclo y eso lo refuta. Un
fenómeno **intermitente** con n=3 se deja leer como regla — y una regla es mucho más fácil de
publicar que una probabilidad.

Tres cosas quedan establecidas, y una de ellas tira la v1:

1. **El tap es alcanzable.** Abre en 2 de 3 ciclos. Un código inalcanzable no abre nunca, así que
   el mecanismo que dedujo la v1 —por más que la skill respalde el ciclo de vida que cité— **no es
   el que ejerce el runtime**. Adjudicar la línea exacta exige instrumentar el worklet; esta tanda
   no lo hizo y por eso no lo afirma.
2. **El primer toque casi nunca abre, pero «nunca» es falso:** 1 de 6. El gesto perdido que H-62
   establece **3 de 3 para el arrastre** no tiene en el toque la misma forma determinista, y
   decir que la tiene fue sobre-leer la primera corrida.
3. **Es INTERMITENTE, y eso es el hallazgo:** 2 de 6 ciclos no abrieron ni al tercer toque. Los
   residuos sub-umbral (4,86 % y 0,67 %) **no se atribuyen**: pueden ser un snap a medias o un
   overlay, y decir cuál sin medirlo sería volver a hacer lo que esta sección corrige.

🔑 **El instrumento necesitaba apagar las animaciones para poder VER, y apagarlas cambió lo que
había que ver.** `uiautomator dump` no consigue idle mientras algo anima —y la portada anima
siempre—, así que las tres escalas iban en **0**; eso pone a Reanimated en *reduced motion* (lo
avisa en el bundle) y **en esa condición el toque no abre jamás**, a ninguna de las tres alturas
probadas. La condición que el instrumento exigía para medir era una **variable con efecto sobre lo
medido**, y el veredicto que produjo no sobrevive fuera de ella. Verificado corriendo la receta con
`--animaciones=normales`: corta en seco con *«0 nodos, 0 resource-ids»* en vez de emitir 21 rojos
falsos — el sensor del arbol **no existe** en la condición del usuario.

**Por eso esto se midió con un segundo sensor que no depende del idle:** el porcentaje de bytes
distintos entre dos framebuffers crudos (`screencap` sin `-p`). Con su piso de ruido medido antes de
usarlo —la portada anima sola: **0,29 %** entre capturas consecutivas sin tocar nada— y umbral en
8 %. Y con control positivo: el arrastre largo también mueve la pantalla en la misma corrida, así
que un «no abre» no puede ser «el device no recibe gestos».

**Fix, igual que antes pero por otra razón:** `Gesture.Race(pan, tap)` da un camino de un solo
puntero que no cuelga del `onEnd` del Pan — lo que la medición pide no es *hacer alcanzable* el tap,
es hacerlo **confiable al primer toque**.

#### 🔴 H-62 · El **primer** gesto después de montar la pantalla se pierde; recién el segundo abre

El hallazgo más caro de la tanda, y el que explica por qué casi publico un falso «escritorio
inalcanzable». Protocolo: reset completo (relanzar la app + login) y dos swipes idénticos, de
velocidad declarada.

| ciclo | 1er swipe | 2º swipe |
|---|---|---|
| 1 | no abre | **ABRE** |
| 2 | no abre | **ABRE** |
| 3 | no abre | **ABRE** |

**3 de 3**, más una cuarta confirmación en la corrida del instrumento committeado (*«gesto 1 sin
efecto → repito; el escritorio abrió en el gesto 2 de 2»*). Para el usuario esto es: abre la app,
arrastra la pestaña para ver sus funciones, **no pasa nada**, y tiene que repetir el gesto.

**Candidata del código, dicha como candidata:** `onEnd` arranca con `const max = alto.value;` y
`if (max <= 0) return;` — con `alto.value` todavía en `0` el gesto no hace **nada**, y `alto.value`
lo fija `onLayout`. Lo **medido** es el síntoma; adjudicar la línea exacta exige instrumentar el
worklet.

#### 🔬 H-61 · Los callbacks del gesto **no son worklets**: corren en el JS thread

El bundle en ejecución emitió **135 veces** la advertencia del propio RNGH: *«None of the callbacks in
the gesture are worklets»*. Esos gestos no corren en el hilo de UI: pierden la razón de existir de
RNGH frente a `PanResponder` y quedan expuestos a jank cuando el JS está ocupado. **Atribución
pendiente y declarada:** el aviso no nombra el detector y esta tanda no instrumentó cuál lo emite;
adjudicárselo a `PanelFunciones` sin medirlo sería el error que este documento viene cazando.

#### 🔹 Observación menor (sin número de hallazgo) — «Presupuestos» corta mal

En el tile del escritorio rompe como `Presupuesto` / `s`, con la `s` huérfana en la segunda línea
(captura `03-abrio-arrastre-1207.png`). Cosmético. **No lleva número a propósito:** las seis clases
del §I —🔥 🚫 🕳 🔬 📐 ♊— no tienen ninguna que le corresponda, y el gate lo rechazó por eso
(*«C4: H-62 tiene 0 clases»*). Forzarle una clase para que pasara habría sido cumplir el criterio de
mentira.

#### ⚠️ Y los rojos que eran **míos**, dichos antes que los de la app

La primera corrida cerró **«el escritorio NO abrió ni con toque ni con arrastre → H-12 confirmado en
device»**. Era falso, y la causa era múltiple — **defectos de mi instrumento, cada uno con cara de
defecto de la app**:

| defecto del instrumento | qué fabricaba |
|---|---|
| detector `'tile-facturacion' in x` por **subcadena** | `ajuste-tile-facturacionAfip`, de la pantalla de Ajustes, lo satisfacía: cantó «ya estaba abierto» 3 veces sin ejercitar un solo toque |
| toque en el **centro** de la pestaña (`y=42`) | cae en la barra de estado; arrastrar desde ahí abre la **cortina de notificaciones**, que tapa la app, y las 21 rutas salieron `NO_MONTA` por una causa ajena a todas ellas |
| arrastre de **600 px** | `onEnd` hace snap por **mitad** y el recorrido es ~1421: volver a cerrado era **correcto**. Medí mi propio gesto corto y se lo imputé a la app |
| 20 `motionevent MOVE` como comandos adb sueltos | timing con jitter, `velocityY` errática, destino errático. Gesto **no reproducible** (abría 1 de 3). Corregido a `input swipe` con duración declarada |
| el bucle de tiles **suponía** el escritorio abierto tras el `BACK` | los tiles 2 a 6 salían «no encontrado» / «NO LLEGA»: rojos del instrumento con cara de rutas rotas, y en la dirección que confirmaba lo que yo ya creía |

**Qué cae y qué queda en pie, con precisión.** H-12 nunca afirmó «6 rutas inalcanzables» — eso lo
concluí **yo**, y es lo que se retira. Lo que H-12 sí afirma —que la apertura cuelga del `onEnd` de un
Pan, sin `Gesture.Tap()` ni `onPress`, y que ningún test lo ejercita— queda **confirmado en device y
agravado**: no es sólo que nadie lo verifique, es que **ninguno de los dos caminos funciona al primer
intento** (H-62 vale para el arrastre **y** para el toque, 3 de 3) y que más allá del primero el toque
es **intermitente** (H-60 reescrito: abrió en 2 de 3 ciclos). El escritorio es alcanzable por ambos
caminos; cuesta al menos dos gestos, y el docstring promete uno.

**Y una nota sobre el testigo:** la corrida `--eje=a` **sobreescribió** el JSON de la corrida completa,
así que el eje B de esta tabla está reconstruido del log de su propia corrida, no del JSON. Un archivo
de resultados que se pisa a sí mismo borra la prueba justo cuando dos mediciones difieren — que es
exactamente cuando hace falta.
---

## §Z · Lo que este documento NO afirma

- **~~Nada sobre el comportamiento en el teléfono.~~ SUPERADO el 2026-10-11 por §12:** hay binario instalado (`5e19949f`) y las 21 pantallas dejaron de estar `BLOQUEADO_POR_BUILD`. Lo que **sigue** sin medirse es todo lo táctil fino, geométrico y animado — la tanda corrió con las animaciones del sistema en 0, que además pone a Reanimated en modo reducido (§12.3). Siguen sin medir: los 14 px de H-44, el primer tap de los `Row` de H-42, el teclado sobre los campos, el scroll dentro del vidrio, el `AudioRecorder.stop()`, y si el tap corto activa el `Gesture.Pan()` de H-12 (receta medida: `adb input motionevent` DOWN/UP sin MOVE — `input tap` **no** ejercita un Pan).
- **Que los tests pasen.** Ningún lote corrió `jest` (encargo read-only; además `apps/mobile/node_modules` no existe en el worktree). Todo `veredicto_evidencia` y toda §7 son **lectura del código del test**: qué ejercita y qué mockea, no su resultado. Por lo mismo, la ausencia de salteados vale **en estático**: un `beforeAll` que tire y saltee en silencio no se vería. Las preguntas de mutación son **razonadas sobre el código, no ejecutadas**: donde dice «se pondría rojo» es inferencia de que `getByTestId` lanza cuando el nodo no existe. Y `jest.config.js` documenta un flake bimodal abierto en `ChatView.test.tsx` y `PantallaSoporte.test.tsx` que no se evaluó.
- **Que el proyecto `web` de jest sea el único que levanta esos 2 archivos.** `node_modules` ausente ⇒ no se pudo leer el preset `jest-expo` para confirmar el `testMatch` por defecto del proyecto `native`. Si también los matcheara, los 2 tests web correrían dos veces, uno de ellos bajo el preset equivocado. **Queda abierto, medible en un comando el día que haya `node_modules`.**
- **La frontera A/B de §7 como un hecho.** Es juicio declarado en los casos de datos inyectados por prop: **53/52** con el criterio usado, **51/54** con el estricto. Igual para `appSoloRutas.test.ts` en A: asevera nombres de archivo, pero eso **es** la propiedad de producción del `require.context` de expo-router.
- **Cuatro de los 112 clasificados por su scan de mocks, no por sus títulos** (`theme/glass/campos/campos.test.tsx`, `campos/revelarCampo.test.ts`, `theme/glass/primitivos.test.tsx`, `util/abrirYCompartir.test.ts`): los cuatro salieron limpios ⇒ A. Riesgo residual declarado: un desajuste nombre↔cuerpo ahí sería D y no se vio.
- **El contenido real del APK del 2026-09-07.** Que incluyera los 28 módulos nativos se **infirió** de los manifiestos de `f8428b9e`, no se leyó de un APK. Lo directo es que el **set de requisitos nativos no cambió** entre los dos commits, y eso es lo que sostiene §6.3.
- **El `AndroidManifest.xml` resultante.** No se corrió `prebuild`. Las conclusiones sobre permisos y `<service>` salen de leer el código de cada config plugin y el manifiesto propio de cada paquete: lectura de fuente, no observación del manifiesto generado. Que una dependencia nativa sin uso sea efectivamente autolinkeada es comportamiento conocido de Expo/RN, no algo medido acá — afecta el **tamaño** de H-50/H-51/H-52, no su existencia.
- **El backend.** No se verificó ningún endpoint vivo: ni el `limit` efectivo de `/clientes`, ni si `GET /inteligencia/portada` está desplegado (el código lo marca `[CONNECT]` y a la vez `PantallaMiDia` ya lo consume), ni si un tenant real emite `ticket_respuesta` entre los 20 ítems.
- **Que los 23 archivos `.ts` sin test homónimo estén sin cubrir.** Falta medir si sus consumidores los ejercitan; «sin test propio» es una cifra con unidad distinta de «sin cobertura».
- **Que el primer salto pruebe alcanzabilidad.** Prueba el primer salto. La cadena transitiva está medida a mano sólo para las cadenas de §8; H-11 y H-12 son precisamente el riesgo que el primer salto no ve.
- **La inconsistencia de `empujarUnaVez` como rotura observada.** H-31 está demostrado en el código (3 `router.push` crudos, el flag de módulo, los route-wrappers que no reabren); que **apile dos modales en el teléfono** es inferencia del mecanismo más un reporte previo de device, no una observación de esta sesión.
- **iOS, por completo.** `app.json` no tiene clave `ios` y `eas.json` sólo define `android.buildType`. No hay target iOS que medir.
- **La web.** Donde un docstring de mobile cita su gemelo web, no se abrió el archivo de la web: no se afirma paridad ni divergencia con `apps/copiloto-web`.
