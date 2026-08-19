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
