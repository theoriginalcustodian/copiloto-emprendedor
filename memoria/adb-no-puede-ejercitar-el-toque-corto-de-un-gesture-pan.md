---
name: adb-no-puede-ejercitar-el-toque-corto-de-un-gesture-pan
description: "adb `input tap`/`swipe` no ejercita gestos RNGH ni botones flotantes de RN; `input motionevent DOWN/MOVE/UP` SÍ — y es lo único que permite un E2E táctil completo sin dedo real"
metadata:
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-08-19T18:51:16.184Z
---

**RESUELTO 2026-08-19** (fix de `BotonVoz`, PR #461). Lo de abajo seguía abierto como "no hay forma
de confirmarlo sin un dedo real". Sí la hay, y es otro subcomando del mismo binario:

```
adb -s <serial> shell input motionevent DOWN <x> <y>
adb -s <serial> shell input motionevent MOVE <x> <y>     # N veces, para arrastrar
adb -s <serial> shell input motionevent UP   <x> <y>
```

Con eso se ejercitó **el ciclo táctil completo** de un `Gesture.Pan()` de RNGH: arrancar la
grabación al bajar el dedo, cruzar el umbral de 80px con MOVEs intermedios, fijar, y después tocar
los botones flotantes (`Pausar` → `Reanudar` → `Enviar`) — todo confirmado por logcat instrumentado.
`input tap` sobre esos MISMOS botones flotantes no registraba nada.

**Por qué `motionevent` sí y `tap` no:** `input tap` sintetiza un DOWN+UP inmediato en el mismo punto
y sin duración controlable; `motionevent` emite cada evento por separado, así que hay tiempo real
entre ellos y se pueden intercalar MOVEs. Un gesto continuo (`Pan`) necesita exactamente eso.

⚠️ **Costo de no saberlo:** planificación concluyó "`Pausar`/`Reanudar` NO aparecen" con `input tap`
+ `uiautomator dump`. La conclusión era correcta por casualidad (había un bug real), pero el
instrumento no podía distinguirlo de un artefacto — y lo reportó como duda irresoluble. Ver
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]].

⚠️ **`uiautomator dump` falla mientras hay una animación corriendo** ("could not get idle state"): no
escribe el XML, y grepear un archivo inexistente devuelve "AUSENTE" para todo — un falso negativo que
se lee igual que evidencia. Con una onda de audio animando en pantalla, usar `screencap -p` + leer la
imagen, nunca el dump. Ver [[probar-ausencia-necesita-otro-instrumento]].

⚠️ **Git Bash mangla los paths de adb** (`/sdcard/x.png` → `C:/Program Files/Git/sdcard/x.png`). Todo
el trabajo de adb va por la tool de **PowerShell**, no por Bash.

---

## Lo que estaba escrito antes (contexto original, 2026-08-04)

Al intentar verificar A3 (BETA-4a/Sprint mobile-first, `PanelDeslizable.tsx`) — un toque corto y
casi sin desplazamiento sobre `panel-handle` que hace *toggle* del panel sin arrastrar —
`adb shell input tap` y `adb shell input swipe` con 0-2px de movimiento **nunca dispararon el
toggle**, 3 intentos, coordenadas verificadas por `uiautomator dump` (no adivinadas) contra los
bounds reales del `GestureDetector`.

**El control que lo aisló:** en la MISMA corrida, taps simples (`TouchableOpacity`/`onPress`, ej.
"Volver"/"Cancelar") respondieron normal vía ADB, y un drag grande (600px) sobre la MISMA zona
también movió el panel correctamente. Sin ese control, hubiera sido fácil concluir "el toque no
funciona" cuando en realidad sólo falla el camino de desplazamiento casi-cero.

**Hipótesis de entonces:** `Gesture.Pan()` en Android sólo activa al cruzar el *touch slop* nativo,
mayor que un `UMBRAL_TAP` chico (5px). Un desplazamiento sintético de ADB es determinístico (0-2px
exactos), sin el jitter de un dedo real, y queda bajo el piso de activación.

**Cómo aplicar hoy:** para cualquier gesto RNGH, **empezar por `motionevent`**, no por `tap`/`swipe`.
Si aun así no dispara, recién ahí corren los controles del párrafo anterior (¿un tap simple en OTRO
componente funciona? ¿un drag grande en el MISMO componente funciona?) antes de declarar el gesto
roto o verificado — y si el toque corto específico sigue sin disparar con todo lo demás verde, es el
patrón del touch-slop: reportar INCONCLUSO con la hipótesis, no forzar un veredicto. Ver también
[[gate-jsdom-no-ve-gestos-tactiles]] (limitación hermana, en el gate de CI en vez de en ADB).

⚠️ **Los umbrales de RNGH están en dp y `motionevent` mueve en PÍXELES** (medido 2026-10-16). `UMBRAL_CANCELAR_PX = 70` son
70 **dp** (~129 px en un teléfono de 720×1600 a 390 dp, 1 dp = 1,846 px), y `translationX` cuenta desde que el `Pan`
se ACTIVA (~10 dp después de apoyar), no desde el DOWN. Tres corridas con −104/−119/−134 px (56–73 dp) «no armaron»
la cancelación y se reportó `[UNVERIFIED]`/«defecto real o límite del instrumento»: era el instrumento. Con 13 MOVE
hasta −157 px (≈85 dp) apareció «Soltá para cancelar». **Antes de concluir «el gesto no llega al umbral», convertí:
umbral_dp × densidad + margen de activación, y pasate** (`adb shell wm density` da la densidad).

---

## ⚠️ REFUERZO 2026-11-02 — el tap sin MOVE no activa NINGÚN control, y el falso «no responde» casi queda escrito en una ficha

La entrada de arriba dice que `adb input tap` no ejercita un Pan. Hoy medí el caso de al lado, que
muerde distinto: **`input motionevent DOWN x y` + `UP x y`, sin MOVE intermedio, tampoco activa los
`Pressable` comunes de esta app.**

**Lo que pasó.** El operador reportó que no encontraba el acceso a Ajustes. Toqué el avatar de Mi
Día con DOWN+UP y no navegó; escribí en la ficha «el avatar además no responde». Minutos más tarde
el tile «Apps conectadas» **tampoco** respondía al mismo tap — y **sí** abrió al agregarle un `MOVE`
de 1 píxel. O sea: mi instrumento no activaba nada, y yo ya había atribuido el defecto al
componente. Repetida la prueba sobre el avatar **con** MOVE, y con dos controles ajenos que sí
abren como **control positivo**, el veredicto se sostuvo. Pero se sostuvo por verificación, no por
la primera corrida.

**Why:** un instrumento que no activa nada produce «no responde» para **todo lo que toca**, y ese
veredicto es indistinguible de un defecto real. Lo peligroso es la asimetría: si el control hubiera
funcionado, yo habría concluido bien; como falló, concluí mal **sin ninguna señal de que estaba
midiendo con un instrumento muerto**. Lo que lo destapó fue casualidad —otro botón falló igual—, y
una verificación que depende de la casualidad no es una verificación.

**How to apply:**
1. En esta app, todo toque por ADB va **DOWN → MOVE (±1 px) → UP**. El tap sin desplazamiento no
   sirve ni para `Pressable` ni para gestos.
2. **Antes de escribir «X no responde», tocá otra cosa que SÍ deba responder.** Si el control ajeno
   tampoco abre, el roto es el instrumento. Es un control positivo de una línea y convierte un
   veredicto en evidencia.

## ⚠️ REFUERZO 2026-11-02 (b) — el hash de la captura COMPLETA siempre dice «cambió»: lo mueve el reloj

Para acreditar si un toque navegó comparé `md5` de las capturas antes/después. Dio **CAMBIO** — y al
abrirlas, lo único distinto era **el reloj de la barra de estado** (19:04 → 19:05). La pantalla era
la misma.

**Why:** la barra de estado tiene reloj, batería y señal, y los tres se mueven solos. Un hash de
pantalla completa mide **el paso del tiempo**, no el efecto de tu acción. Y falla hacia el lado
peligroso: dice que cambió, que es lo que uno quiere escuchar al verificar que un toque funcionó.
El gemelo es que el hash **nunca** dice «no cambió», así que como control no distingue nada.

**How to apply:** compará **la región** que debería cambiar (recortá, o compará un elemento
concreto: un texto presente/ausente, el título de la pantalla). Si vas a comparar capturas enteras,
recortá primero la barra de estado. Y ante un «CAMBIÓ», **mirá las dos imágenes** antes de
declararlo: acá la diferencia eran dos dígitos ([[el-instrumento-tambien-CONDENA-no-solo-absuelve]]).
