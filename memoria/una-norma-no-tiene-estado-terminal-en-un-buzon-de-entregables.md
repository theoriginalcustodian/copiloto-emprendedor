---
name: una-norma-no-tiene-estado-terminal-en-un-buzon-de-entregables
description: Un contrato que define CÓMO se trabaja no se termina nunca, así que en un buzón de tres estados (abierto/en-curso/cerrado) las tres posiciones son falsas y dos generan alarma permanente. La norma se versiona; lo que se cierra es su bajada, no la norma
metadata:
  type: feedback
---

**El caso (2026-09-29).** `contrato_planificacion-a-auditoria_tres-capas-script-subagente-opus` define
cómo trabaja auditoría: capa 0 script → capa 1 sub-agente → capa 2 Opus, con el disparador binario del
tercer archivo y la línea `delegación:` como medición. **Lo apliqué todo el turno** —cada `cierre_` lleva
su línea de delegación— y el escalador lo reportó **442 min «sin tomar»**, porque nunca moví el archivo.

El escalador tenía razón en lo que mide: **el estado ES la ubicación del archivo**, y el archivo seguía
en `abierto/`. Lo que no existe es la ubicación correcta.

## Las tres posiciones, medidas contra `scripts/escaladores-buzon.sh`

| carpeta | qué afirma | qué le pasa a una norma ahí |
|---|---|---|
| `abierto/` | «nadie lo tomó» | **falso** —lo estoy ejecutando— y **Regla 1** (`:217`) lo escala cada corrida, para siempre |
| `en-curso/` | «en ejecución, con avance esperado» | **Regla 3** (`:299`) lo escala cada `UMBRAL_SILENCIO` (default 90 min) sin `avance_` del frente. Una norma no produce avances: **alarma permanente** |
| `cerrado/` | «terminado» | falso como estado de la norma, y `coordinacion/` **no está versionado** ⇒ la norma no sobrevive al clon |

Silenciarlo con `UMBRAL_SILENCIO: 999999` es apagar un instrumento sano para tapar un archivo mal
clasificado ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]], del otro lado: acá el ruido es
real y la tentación es matar al que avisa).

## La regla

**Un contrato normativo se versiona, y el archivo del buzón se cierra como lo que era: un transporte.**
Lo que se cierra es **la bajada** de la norma, no la norma. Después del `mv` la norma sigue rigiendo
porque vive en `memoria/` (indexada, se carga cada sesión) o en `COORDINACION.md` — los dos versionados.

El discriminador es una pregunta: **¿este archivo describe un trabajo que termina, o una regla que
rige?** Un entregable tiene DoD binario y un final; una norma no tiene ninguno de los dos, y un modelo
de estados que no distingue los dos casos convierte al segundo en alarma eterna.

## Lo que esto NO era

**No era un defecto del escalador.** La tentación era leer «el escalador grita sobre trabajo que sí
hice» como un falso positivo y agregarle una excepción. Medido: sus tres reglas son correctas y ya
pagaron sus propios falsos positivos (el comentario de `:308` documenta el `mv` que no cambiaba el
mtime). El archivo estaba mal clasificado, no el instrumento
([[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]], en espejo: acá el instrumento
no miente y el reflejo era desautorizarlo).

## Y el corolario que me caza a mí

Ese mismo día escribí, en [[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]], que **«una
regla que vive sólo en el buzón no sobrevive al clon»** — y no lo apliqué al contrato que tenía en la
mano, el que define cómo trabajo. **Escribir la lección no barre los casos que ya la violan.** Al cerrar
una lección nueva, el paso que falta es grepear los casos existentes de su misma clase
([[el-fix-ya-existe-en-otro-call-site]] · [[barrer-llamadores-incluye-los-instrumentos-de-verificacion]]).

Emparentado: [[buzon-se-ordena-por-janitor-no-por-disciplina]] ·
[[un-disparador-cumplido-no-avisa-a-nadie]] · [[el-cron-dispara-mas-cuanto-menos-trabaja-la-sesion]].
