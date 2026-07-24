---
description: (Re)crea idempotente los DOS crones de monitoreo de la sesión PLANIFICACIÓN (control de sesiones cada 3 min + vigía del buzón)
allowed-tools: CronList, CronCreate, Bash
---

# Arrancar el monitoreo de la sesión PLANIFICACIÓN

Recreá los crones de coordinación. **Idempotente: primero `CronList`, y creá SÓLO los que falten**
(comparando por el schedule + el arranque del prompt). Al terminar, `CronList` para confirmar, y
reportá en una línea.

⚠️ **Si encontrás vivos los crones VIEJOS —«Monitor de PARÁLISIS» o «Control de SESIONES OCIOSAS»—
borralos con `CronDelete` y creá el Cron 1 de abajo en su lugar.** Ordenaban correr
`no-ocio-check.sh` como instrumento obligatorio, que es exactamente la causa raíz que este cambio
retira (ver más abajo).

Verificá también que el instrumento existe antes de reportar verde:
`bash scripts/ultimas-acciones.sh 2` tiene que imprimir sesiones con hora.

> Contexto: esta es la sesión PLANIFICACIÓN del trabajo en 3 sesiones paralelas (planificación/backend/
> frontend) coordinadas por el buzón `coordinacion/`. Los crones se pierden al abrir una sesión NUEVA
> (sobreviven a `--continue`/`--resume`). Este command los re-arma cuando hace falta.

---

## 🔴 Por qué el instrumento es el LOG y no un script de heurísticas

El 2026-07-24 `scripts/no-ocio-check.sh` se equivocó **seis veces seguidas** sobre si una sesión
trabajaba: rotuló backend como frontend, llamó backend "por descarte", eligió el transcript
equivocado tras un reinicio, y gritó `🌀 GIRA EN VACÍO` sobre sesiones que estaban implementando.
Cada vez se lo parcheó; cada parche habilitó el fallo siguiente.

**La causa raíz no era ninguno de esos bugs: era que el prompt del cron ordenaba correr el script
PRIMERO y prohibía afirmar nada sin su salida.** Con esa regla, el ciclo arranca leyendo una
inferencia y sólo va al log cuando algo chirría — así que el error del script se convierte en el
reporte. El log crudo, en cambio, **muestra** las acciones con hora y no se equivocó nunca.

Un script que infiere identidad y productividad a partir de paths y nombres de herramienta es un
instrumento que **confirma** en vez de verificar: cuando se equivoca no falla ruidoso, entrega una
respuesta plausible. `scripts/ultimas-acciones.sh` no infiere nada — imprime qué hizo cada sesión y
cuándo, y deja el juicio en quien lee.

---

## Cron 1 — Control de sesiones (cada 3 min)

Reemplaza a los dos crones viejos de 3 min («PARÁLISIS» + «SESIONES OCIOSAS»): con el log a la vista,
una sesión parada y una espera mutua se ven en la misma lectura, y dos disparos por ventana era ruido
duplicado.

- **Schedule (cron):** `*/3 * * * *`
- **Prompt:**

```
Control de sesiones (PLANIFICACIÓN) — cada 3 min. Caza una sesión PARADA y también la espera MUTUA.

🔴 INSTRUMENTO ÚNICO — corré esto y NADA MÁS para juzgar si alguien trabaja:

    bash "C:/Proyectos/Claude/Claude code/copiloto-emprendedor/scripts/ultimas-acciones.sh" 3

Imprime, por sesión viva, sus últimas acciones CON HORA (UTC) leídas del log crudo, y el rol tomado
del prompt del cron que esa ventana recibe.

⛔ PROHIBIDO usar `no-ocio-check.sh` para decidir si una sesión trabaja. Medido el 2026-07-24: erró
6 veces seguidas (rotuló mal, contó producción mal, gritó "GIRA EN VACÍO" sobre sesiones que
estaban implementando). Sus heurísticas infieren; el log MUESTRA. Si alguna vez el script y el log
se contradicen, **gana el log, sin excepción y sin volver a revisarlo**.

Cómo leer la salida, y es todo lo que hay que saber:
- Última acción hace ≤5 min → TRABAJA. No hay nada que reportar sobre ella.
- Última acción hace >25 min → parada de verdad. Recién ahí buscá POR QUÉ (ver abajo).
- Mirá QUÉ acción es, no sólo cuándo: Edit/Write/git commit/pytest/adb = produce.
  Sólo `ls`/`cat`/`date`/`grep` repetidos durante varios ciclos = gira en vacío.
  ⚠️ Una sola pasada de lecturas NO es ocio: casi siempre es el arranque de un turno.

Si UNA está realmente parada, el primer chequeo NO es pedirle a la otra que conteste — es
**¿la respuesta ya existe, invisible?**: enterrada bajo una sección posterior, o contestada en el
hilo de otra sesión → RELAYEALA a un `dato_..._a-<ella>`. ¿Es un blocker que resolvés vos con un
grep, una lectura, un contrato o una decisión táctica? → resolvelo ESTE ciclo. ¿Espera device
(exclusivo de backend)? ¿Terminó todo lo suyo y lo reportó? → ocio legítimo, no es alarma.

También revisá el buzón `C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\`:
`abierto/` filtrando `-a-planificacion_` y `-a-todos_`, y `cerrado/<hoy>/` por los `avance_`, que
nacen archivados. Y `git ls-remote` / `gh pr list` si hay un hito esperando push o merge.

REPORTE: si todas trabajan, UNA sola línea con la última acción de cada una y su hora. Nada más.
Si hay alarma, bajá un `dato_` corto nombrando QUIÉN destraba y con qué acción CONCRETA (no
"coordinen"), y decí explícito si NO necesita device — es lo que más rápido libera.

Y antes de cerrar el turno: si TU cola no está vacía, seguí con lo tuyo. "Sin novedades" describe el
buzón, no tu trabajo.

NO implementes código de la app. Esta sesión baja contratos y destraba.
```

---

## Cron 2 — Vigía de coordinación v3 (el buzón, no las sesiones)

Éste NO mira sesiones: mira el **buzón** — qué te interpela, qué quedó en silencio, qué se puede
archivar. Por eso corre cada 20 min y no cada 3.

- **Schedule (cron):** `7,27,47 * * * *`
- **Prompt:**

```
Vigía de coordinación (sesión PLANIFICACIÓN) v3.

Buzón (ruta absoluta, NO relativa al cwd):
C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\

1. NOVEDADES. Listar `abierto/` y quedarte SÓLO con lo dirigido a vos: nombres que contengan
   `-a-planificacion_` o `-a-todos_`. Descartar todo lo que empiece por `planificacion-a-` (son
   tuyos: notificarlos es ruido disfrazado de novedad). Mirar también `cerrado/<hoy>/` por los
   `avance_`, que nacen archivados y no aparecen en `abierto/`.

2. LO QUE TE INTERPELA. Un archivo puede pedirte respuesta aunque su nombre diga otro destinatario:
   abrí los que tengan secciones nuevas al final y fijate si alguna te interroga a vos. El nombre
   miente sobre quién debe contestar; el cuerpo no.

3. SILENCIO. Para cada archivo de `en-curso/`, comparar su `mtime` (y el del último `avance_` del
   mismo frente) contra ahora. Umbral por defecto 90 minutos, salvo que el encabezado del contrato
   declare otro — ese gana. Reportar sólo los que lo pasaron, con el frente y los minutos.
   NO escribas líneas de acuse sobre un `avance_`: su `mtime` ES la medición.

4. ARCHIVO. Para cada archivo de `abierto/`: contar los acuses ya escritos. Si están cubiertos
   todos los destinatarios del nombre, moverlo a `cerrado/<fecha>/`. Ante la duda, no mover.

5. REPORTE. Máximo 3 ítems, los más accionables, en 6 líneas. Si no hay nada: una línea con el
   silencio de cada sesión y nada más. NO implementes nada — esta sesión baja contratos, no código.
```
