---
description: (Re)crea idempotente los TRES crones de monitoreo de la sesión PLANIFICACIÓN (PARÁLISIS + vigía v3 + sesiones ociosas)
allowed-tools: CronList, CronCreate
---

# Arrancar el monitoreo de la sesión PLANIFICACIÓN

Recreá los tres crones de monitoreo de coordinación. **Idempotente: primero `CronList`, y creá SÓLO los
que falten** (comparando por el schedule + el arranque del prompt). Si los tres ya existen, no hagas nada
y reportá "los 3 crones ya están vivos". Si falta alguno, `CronCreate` con el schedule y prompt exactos
de abajo. Al terminar, `CronList` para confirmar que los tres están, y reportá en una línea.

> Contexto: esta es la sesión PLANIFICACIÓN del trabajo en 3 sesiones paralelas (planificación/backend/
> frontend) coordinadas por el buzón `coordinacion/`. Los crones se pierden al abrir una sesión NUEVA
> (sobreviven a `--continue`/`--resume`). Este command los re-arma cuando hace falta.

---

## Cron 1 — Monitor de PARÁLISIS

- **Schedule (cron):** `*/3 * * * *`  (cada 3 minutos)
- **Prompt:**

```
Monitor de PARÁLISIS (sesión PLANIFICACIÓN). Ruta absoluta del buzón:
C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\

NO es el vigía de 20 min: éste no busca silencio, busca **espera mutua** — dos sesiones que se
esperan sin que ninguna esté formalmente bloqueada, que es lo que el umbral de 90 min NO ve.

0. 🔴 INSTRUMENTO OBLIGATORIO — corré PRIMERO:
   `bash scripts/no-ocio-check.sh` y `bash scripts/cola-check.sh`
   El script mide la VIDA de cada sesión por el **mtime de su transcript JSONL**
   (`~/.claude/projects/<slug>/*.jsonl`), NO por lo que postea al buzón. Una sesión puede
   trabajar una hora sin postear: el buzón mide REPORTES, no vida.
   **PROHIBIDO afirmar que una sesión está muerta/parada sin ese output.** Transcript fresco
   + buzón viejo = "trabaja sin reportar" (señal leve), NO dead-man. Ver COORDINACION §4.2.sexies.

1. MEDIR, en un solo comando: hora actual · último commit de `origin/main` y su antigüedad ·
   último commit de la rama de la app y su antigüedad · `gh pr list --state open` ·
   `git rev-list --count origin/main..origin/feat/mobile-first-cascara-glass` ·
   los 3 archivos más recientes de `en-curso/` y `abierto/` con hora.

2. DISPARADORES de alarma (cualquiera basta):
   - Un PR abierto hace más de ~15 min que sea precondición declarada de otra cosa.
   - Una sesión sin commits ni archivos de buzón hace más de 25 min mientras la otra sí avanza.
   - **Las dos** sin actividad hace más de 20 min.
   - Alguien esperando un aviso que nadie emitió («avisá cuando tomes el device», «congelo hasta
     que cierres»): si el aviso no está en el buzón, la espera es indefinida.

3. SI HAY ALARMA: bajar un `dato_` corto al buzón nombrando **quién destraba y con qué acción
   concreta** (no «coordinen»). Si la acción es de una sola sesión, decilo con su nombre.

4. SI NO HAY ALARMA: **una sola línea** — antigüedad de cada sesión y estado del PR. Nada más.
   No repitas hallazgos del vigía de 20 min ni resumas trabajo hecho.

NO implementes código. Esta sesión baja contratos y destraba.
```

---

## Cron 2 — Vigía de coordinación v3

- **Schedule (cron):** `7,27,47 * * * *`  (minutos 7, 27 y 47 de cada hora)
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

---

## Cron 3 — Control de sesiones ociosas

- **Schedule (cron):** `1-58/3 * * * *`  (cada 3 minutos, intercalado 1 min con PARÁLISIS)
- **Prompt:**

```
Control de SESIONES OCIOSAS (sesión PLANIFICACIÓN) — cada 3 min. COMPLEMENTA al monitor de PARÁLISIS:
aquél caza esperas MUTUAS (ambas trabadas, umbral ~25 min); ÉSTE caza UNA sola sesión PARADA rápido,
aunque la otra avance. El operador lo pidió porque una sesión parada esperando una respuesta se le
escapó al umbral de 25 min.

Buzón (ruta absoluta): C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\

0. 🔴 INSTRUMENTO OBLIGATORIO — corré PRIMERO: `bash scripts/no-ocio-check.sh`
   Mide la VIDA de cada sesión por el **mtime de su transcript JSONL**
   (`~/.claude/projects/<slug>/*.jsonl`), que Claude Code escribe en CADA turno. Ése es el
   latido real. **PROHIBIDO afirmar que una sesión está parada/muerta sin ese output**
   (2026-07-24: se reportó "backend muerto 8½ h" mientras backend escribía código).
   NUNCA leas un `.jsonl` entero — pesan cientos de MB; el script usa `tail -c`.

1. Con el output del paso 0, distinguí las DOS señales, que NO son lo mismo:
   - **VIDA (transcript fresco)** → la sesión está trabajando. Si además su buzón está viejo,
     eso es "trabaja sin reportar": recordale un `avance_` por hito. **NO es alarma de muerte.**
   - **Transcript viejo (≥30 min)** → ahí sí, sesión o heartbeat caídos → dead-man: push al
     operador (`/monitoreo-backend` o `/monitoreo-frontend` en su ventana) + reasignar a
     planificación lo resoluble sin ella.
   Como señal secundaria de REPORTE mirá el buzón: archivos que ella autoreó
   (`*_backend-a-*` / `*_frontend-a-*` en abierto/ y cerrado/<hoy>/) y acuses que pegó al final
   de archivos ajenos. Reportá minutos de ambas señales por sesión.

2. UMBRAL CORTO: una sesión con > ~6 min sin actividad REAL (a+b), mientras la otra avanza o mientras
   hay trabajo pendiente que le toca, es candidata a PARADA. No esperar 25 min.

3. SI UNA ESTÁ PARADA, encontrar POR QUÉ antes de reportar (esto es lo que PARÁLISIS no ve). Y el
   PRIMER chequeo NO es "pedile a la otra que responda" — es **¿la respuesta YA existe, invisible?**:
   - ¿Hay una respuesta ENTERRADA bajo una sección posterior en el mismo archivo, o contestada en el
     hilo de OTRA sesión (no en el suyo)? Si existe → el destrabe es RELAYEARLA a un `dato_..._a-<ella>`,
     no volver a preguntar. (Caso real 2026-07-23: backend había contestado 01:25, quedó enterrado.)
   - Si no existe: ¿está bloqueada en una PREGUNTA/pedido sin responder que otra sesión puede contestar,
     incluso de MEMORIA sin device? Buscar secciones `PREGUNTA →` / preguntas abiertas sin respuesta.
   - ¿Espera un resultado de device que el dueño (backend) todavía no reportó?
   - ¿Terminó TODO lo suyo y lo reportó? → ocio legítimo, NO es alarma.

4. SI HAY PARADA DESTRABABLE: bajar un `dato_` corto nombrando QUIÉN la destraba y con qué acción
   CONCRETA. Si la acción NO necesita device (relayear una respuesta que existe, contestar de memoria,
   una decisión, una lectura), decirlo explícito — es lo que más rápido la libera.

5. SI TODO ACTIVO, o el ocio es legítimo (terminó y reportó): UNA sola línea con los minutos de cada
   sesión. Nada más. No repetir hallazgos del monitor de PARÁLISIS ni del vigía.

NO implementes código. Esta sesión coordina y destraba.
```
