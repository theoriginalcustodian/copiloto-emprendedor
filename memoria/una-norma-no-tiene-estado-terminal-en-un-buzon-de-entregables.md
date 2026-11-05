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

## Refuerzo 2026-11-05 — PAGADO: el estado terminal lo declara el AUTOR, en un campo que sólo puede hablar de sí mismo

Esto estuvo 20 días como propuesta sin implementar, y el motivo escrito era bueno: tocar el janitor
para que archive **obligaciones** exige probar lo contrario de lo que uno quiere —que una obligación
**viva sobrevive**— y un test que sólo verifique «el cerrado se archiva» sale verde aunque el patrón
archive todo. Ese fallo borra normas vigentes del circuito **sin un solo síntoma**: el janitor no
falla cuando archiva de más, archiva ([[instrumento-que-no-mira-nunca-falla]]).

**La solución es un campo DEDICADO y AUTO-REFERENCIAL** en `scripts/archivar-buzon.sh`:

```
CIERRE: VENCIDO|REFUTADO|CUMPLIDO — <motivo en una línea>
```

El janitor no juzga: el criterio es la **presencia** del campo, y la decisión queda en quien escribe
el archivo, que es el único que sabe si su norma sigue viva. Lo que hace que funcione donde los otros
tres criterios fallaron son **tres exigencias del patrón, cada una contra un falso positivo medido**:

| Exigencia | Qué falso positivo mata |
|---|---|
| `^` anclado a inicio de línea | el banner `⛔ REFUTADO`, que **tiene dos referentes**: en «…_REFUTADO-mi-propio-hallazgo…» significa que el archivo refuta a OTRO, o sea que es el artefacto **vigente**. Archivarlo mata la corrección y deja circulando lo falso ([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]) |
| uno de los TRES valores, exacto | la **prosa**: «un hallazgo nuevo NO reabre un punto **cerrado**» marcaba el archivo con el criterio-palabra ([[no-era-que-no-cazaba-el-patron-era-que-no-lo-cazaba-en-su-forma-real]]) |
| ` — ` + motivo **no vacío** | la **plantilla del propio protocolo**: `CIERRE: VENCIDO\|REFUTADO\|CUMPLIDO — <motivo…>`. Tras `VENCIDO` viene un `\|` y no el guión, así que no matchea — **el documento que define el mecanismo no se autodestruye**. Es el caso hostil que el proponente contiene literalmente, y el primero que un patrón laxo archivaría |

**El test es hostil por construcción** (`scripts/tests/test-archivar-buzon-campo-cierre.sh`, 6 casos):
1 control positivo (si éste falla, todo lo demás es vacuo), **3 hostiles** —los tres de la tabla—,
1 de que el campo **no saltea el TTL** y 1 de no-regresión. Entra solo al denominador de
`scripts/ci/tests-coordinacion.sh` (87 tests) que `lint.sh:70` corre.

### 🔭 Y el detalle que casi leí como «no funciona»

Declaré el cierre de **11** broadcasts de octubre y el dry-run siguiente dijo **«archivaría 2»**.
Por un momento lo leí como que el mecanismo no disparaba. No: **escribir el campo renueva el
`mtime`**, así que los 11 pasaron a contar como tráfico **fresco** y quedaron dentro del TTL de 90
min. Es deliberado —un cierre escrito hace un minuto no debe hacer desaparecer el archivo antes de
que las otras sesiones lo lean— pero **el efecto llega un ciclo después, no en el mismo**.

El control que lo desmiente es mover **una** variable: `TTL_MIN=0 --dry-run` → listó **11 de 11**
marcados y **0** de las 25 obligaciones sin cierre. Sin ese control, «archivaría 2» es
indistinguible de un patrón que no matchea ([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]).

**Y el campo no releva de medir.** De los 12 broadcasts, marqué 11: el del sync del grafo dice en su
cuerpo *«falta UN paso que yo no puedo correr»* — espera acción ajena, así que es obligación
legítima y **sigue abierto**. Los tres que afirmaban un estado del sistema los medí antes de
declararlos vencidos (`vigia.sh` sí existe en el compartido · `git rev-list @{u}..HEAD` = 0 · 0 de 10
instrumentos faltantes), no los cerré por antigüedad
([[un-despacho-de-retiro-no-distingue-el-resto-olvidado-de-la-excepcion-fechada]]).