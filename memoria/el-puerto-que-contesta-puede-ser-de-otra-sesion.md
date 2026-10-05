---
name: el-puerto-que-contesta-puede-ser-de-otra-sesion
description: Con sesiones paralelas, el dev server que responde en localhost puede ser el de OTRA sesión con código viejo — y medís el servidor equivocado creyendo que tu cambio no funcionó
metadata:
  type: project
---

**LEER antes de verificar un cambio de UI contra un dev server local.** Caso raíz: 2026-08-06, hito 6
de ODOBI — backend perdió ~78 min y se comió la ventana de su `avance_` de 90 min por esto.

## Qué pasó

Levantó Vite para el E2E web, apuntó Playwright a `localhost:5183`, y vio **"Clash Display"** donde
el hito 3 había puesto **NeueEinstellung**. Conclusión natural y falsa: *"el cambio no llegó"*.

El puerto 5183 ya estaba tomado por **otra sesión**, corriendo código **pre-hito-3**. Su propio Vite
había avisado —`Port 5183 is in use, trying another one...`— y se había ido a 5187/5199. El aviso
estaba en el log; la medición apuntaba al otro lado.

## Por qué es traicionero

El servidor equivocado **responde 200 y renderiza la app**. No hay error, no hay conexión rechazada,
no hay nada que proteste: hay una app funcionando que simplemente no es la tuya. Es un
[[instrumentos-que-confirman-en-vez-de-verificar]] perfecto — mide algo real, sólo que no lo tuyo.

Y con checkout compartido + tres sesiones, el puerto colisionado es lo **normal**, no lo raro.

## El control: cruzar el PID del puerto contra tu propio proceso

No alcanza con leer el puerto que imprimió tu comando — hay que confirmar que quien contesta es él:

```bash
netstat -ano | grep :<puerto>        # PID que tiene el puerto
# comparar contra el PID del Vite/Metro que arrancaste vos
```

Barato y definitivo. Es lo que finalmente lo destrabó.

## La generalización

Todo servicio de desarrollo que elige puerto **con fallback silencioso** (Vite, Metro, Storybook,
`serve`) tiene esta trampa: el fallback es una conveniencia para el que arranca y una mentira para el
que mide. Ante un resultado visual que contradice un cambio ya mergeado, la primera pregunta no es
*"¿falló el cambio?"* sino **"¿le estoy preguntando al proceso correcto?"** — control positivo antes
de explicar el vacío ([[vacio-no-es-hallazgo-correr-el-control]]).

Relacionado: [[sincronizar-al-vps-desde-el-worktree-equivocado]] (mismo error, escribiendo en vez de
leyendo) · [[el-checkout-compartido-sirve-comandos-viejos]] · [[el-control-corrido-contra-la-base-equivocada]]

---

## Refuerzo (2026-10-05): «vivo» no es «avanzando» — y matar la TAREA no mata el proceso

Mismo músculo, otro recurso: no un puerto, el **lock del `graph-sync`** que comparten las cuatro
sesiones. Un `git push --delete` en background no terminó; `TaskStop` cerró la tarea. Cuatro minutos
después, los **tres** procesos seguían vivos (`pre-push` → `graph-sync.sh` → subshell) y el
`$LOCKDIR` compartido declaraba `pid=1590`: **mi propio proceso**, sin ningún hijo `uv`/`python`
trabajando, o sea detenido. `TaskStop` cierra la tarea del harness, no el árbol de procesos.

Y el `pre-push`, ante un lock ocupado, sale **`exit 0` sin sincronizar** (`graph-sync.sh:274` «*un
lock ocupado NO es un fallo*»; `.githooks/pre-push:78` avisa y no aborta). Entre dos sesiones vivas
está bien; con un proceso detenido es **verde silencioso para las otras tres**: push aceptado, grafo
sin ingerir.

**Lo que iba a escribir primero era falso.** Iba a anotar «el lock sólo mira la edad, debería mirar el
PID»: **ya lo mira**, desde #676 (`graph-sync.sh:261`, `kill -0 "$pid_lock"`). Leído el bloque entero
(`graph-sync.sh:234-271`), el mecanismo es deliberado y con su porqué escrito:

| Estado del dueño | Qué hace | Umbral real |
|---|---|---|
| vivo (`kill -0` responde) | el lock **vale por viejo que sea** | `LOCK_HARD_MAX=14400 s` (4 h) |
| muerto o sin pid anotado | lo toma **de inmediato** | — |

Dos cosas invierten lo intuitivo: `LOCK_MAX_AGE=600` **ya no decide** la recuperación, y `kill -9` es
**benigno** para el lock (pid muerto ⇒ el siguiente sync lo toma al instante). Lo tóxico es el caso
del medio —**vivo pero detenido**—, que retiene el lock hasta 4 h. No es un olvido: `graph-sync.sh:246-248`
documenta que un sync completo tras un mes de drift ingiere >17 min, y la regla por edad le robaba el
lock a un sync vivo, con dos procesos reescribiendo el mismo árbol y checkpoint.

**La forma general.** Todo guard de recurso compartido que pregunta *¿el dueño existe?* está usando
existencia como proxy de **progreso**, y el proxy falla exactamente en el caso que motiva el guard:
el proceso que no avanza. La pregunta con filo es *¿cuándo fue su último latido?* — y entonces un
dueño lento legítimo conserva su lock, y uno detenido lo pierde en segundos.

**Qué hacer en el momento.** Antes de dar por muerto un proceso que tenía un recurso compartido:
cruzar el PID que declara el lock contra los procesos vivos (`ps -W` da el WINPID; `Get-CimInstance
Win32_Process` da el command line, que dice en qué paso quedó) y **mirar eso antes de matar** — si
matás primero, perdés la evidencia ([[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]]).
Matar con TERM, no con KILL, para que corra el `trap` que borra el lock (verificado: quedó libre).

Y el mismo gatillo —borrar una rama— le dio al backend hoy **otra** causa (`status 2`,
`config: ['graphity-memory']`): un enunciado, dos defectos
([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]] ·
[[el-contrato-que-manda-a-hacer-algo-ya-hecho]]).

### Y `timeout` hace exactamente lo mismo que `TaskStop` (2026-10-05, segunda vez el mismo día)

`timeout 300 git push --delete` murió a los 300 s y el `graph-sync` que el hook había lanzado **siguió
vivo con el lock** (`pid=2745`). Dos mecanismos distintos, el mismo resultado: **matás al que lanzaste,
no al árbol**. Si un proceso tuyo lanza nietos, tu forma de cancelarlo no los alcanza — y el recurso
compartido se queda con ellos.

Lo que **no** hay que hacer es subir el timeout. El huérfano terminó solo, escribió su marcador y el
reintento pasó en 5 s, porque el hook **falla abierto** cuando el lock está ocupado. Reintentar >
esperar más. Y medí el estado real antes de diagnosticar: yo escribí que el trabajo se había perdido
—marcador viejo con el grafo ya ingerido— y era falso; dos minutos después el marcador estaba al día.
Un estado intermedio no es un estado final.
