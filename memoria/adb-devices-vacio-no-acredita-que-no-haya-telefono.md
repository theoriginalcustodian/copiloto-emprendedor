---
name: adb-devices-vacio-no-acredita-que-no-haya-telefono
description: El primer `adb devices` arranca el servidor y lista ANTES de enumerar — da vacío, exit 0, y «no hay teléfono» y «server en frío» comparten esa salida.
metadata:
  type: feedback
---

**`adb devices` vacío NO acredita que no haya teléfono.** El primer invoque tras un rato sin uso
**arranca el servidor adb** y devuelve la lista **antes** de que el daemon termine de enumerar:
sale vacío, **exit 0**, sin error ni reintento. Y reiniciar el servidor —el reflejo obvio— **reproduce
el mismo vacío**, porque vuelve a correr la primera consulta en frío.

Antes de declarar «no hay device», nunca `adb devices` solo:

```bash
adb start-server; adb wait-for-device    # el control: si el teléfono está, RETORNA
adb devices -l                           # recién ahora la lista es confiable
adb -s <serial> shell echo VIVO          # que RESPONDE, no sólo que figura
```

Si `wait-for-device` cuelga >~10 s, ahí sí no hay teléfono.

**Why:** dos causas distintas —«no hay teléfono conectado» y «el servidor recién arrancó»— comparten
**la misma salida y el mismo exit code**, y la salida no dice cuál es
([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]). El vacío se lee como
el caso benigno-explicable («se desconectó el cable»), que es una causa **con dueño** —el operador— y
por eso nadie la cuestiona: se coordina
([[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]] ·
[[supuesto-cuya-falla-parece-un-estado-legitimo]]).

**Caso raíz, 2026-11-02.** frontend1 reportó `adb devices -l` vacío tras reiniciar el servidor, soltó
el teléfono y pidió que el operador reconectara el cable. Planificación **confirmó el vacío con un
comando que tenía la misma falla** y lo escaló al operador como su pendiente. El operador desconfió
(*«cómo que se desconectó… revisá nuevamente»*) y la medición completa dio: `RF8T318RN9T`, SM-M127F,
estado `device`, `shell echo` → `VIVO`, **y la app en foco** (`mCurrentFocus =
app.copiloto.emprendedor/.MainActivity`). Nunca se desconectó. Costó una pasada de device con 20
fichas esperándola, y un blocker falso escalado al operador — que es justo lo que `CLAUDE.md §3.8`
prohíbe: un gate mecánico que me frena es mi problema, no su tarea
([[deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo]] · [[el-contrato-afirma-el-mecanismo-que-no-opero]]).

**How to apply:** ante un vacío, el control positivo va **primero**, no después de explicar
([[el-canario-el-control-positivo-de-lo-que-falla-callado]]). Y un blocker que llega de otra sesión
**se re-mide con un instrumento distinto al que lo produjo** antes de propagarlo: confirmar con el
mismo comando no es verificar, es repetir
([[un-control-de-corroboracion-premia-al-que-mas-cita]]). Si el blocker apunta al operador, ese es el
momento de más desconfianza, no de menos.
