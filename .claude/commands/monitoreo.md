---
description: Arranque VERIFICADO de la sesión PLANIFICACIÓN: 3 crones + instrumentos + estado de la cola, con reporte binario
allowed-tools: CronList, CronCreate, Read, Bash, Glob, Grep
---

# Arrancar el monitoreo de la sesión PLANIFICACIÓN

Dejá la sesión PLANIFICACIÓN **lista para dirigir, y demostralo**. No alcanza con instalar los
crones: si arrancás sin saber en qué hito está la cola y quién está bloqueado, el primer ciclo se va en
averiguarlo.

1. **`CronList`** — ¿existen los tres? (comparar por schedule + arranque del prompt). Los que estén, no
   se tocan.
2. **`CronCreate`** — creá SÓLO los que falten, con el schedule y prompt EXACTOS de abajo.
3. **`CronList` de nuevo y CONFIRMÁ los tres.** Sin verlos, no están instalados.
4. **Instrumentos** — `bash scripts/no-ocio-check.sh` y `bash scripts/cola-check.sh`. Los dos tienen que
   correr **sin error**: son la base de todos los ciclos. Si `no-ocio-check.sh` no existe en tu checkout,
   estás en una rama vieja — `git log origin/main -1` y decilo.
5. **Harness de buzón** — `grep -c buzon_watcher ~/.claude/settings.json`. Si da `0`, el push de mensajes
   nuevos no está y las tres sesiones dependen sólo de sus crones: **reportalo**.
6. **Estado** — leé `coordinacion/PLAN.md` (COLA-VIVA) y listá `coordinacion/abierto/` filtrando
   `-a-planificacion_` y `-a-todos_`, descartando lo que empiece por `planificacion-a-` (es tuyo).
   Mirá también `cerrado/<hoy>/` por los `avance_`, que nacen archivados.

**REPORTE de arranque — binario, una línea por ítem:**

```
✅/❌ 3 crones vivos (PARÁLISIS */3 · vigía 7,27,47 · ociosas 1-58/3)
✅/❌ no-ocio-check + cola-check corren
✅/❌ buzon_watcher registrado
📊 PRODUCCIÓN backend Nmin · frontend Nmin   (⚠️ VIDA fresca NO prueba trabajo: el cron también
     genera turnos — 2026-07-24, la sesión ociosa tuvo 42 disparos y la que implementaba 5)
🔥 COLA: hito N «...» · siguiente: ...
📬 N mensajes dirigidos a mí sin resolver → los listo
▶️  ARRANCO CON: <la acción concreta que sigue>
```

**La última línea no es opcional.** Y si el instrumento marca `🌀 GIRA EN VACÍO` en alguna sesión, eso
es OCIO (no dead-man): reasignale algo en el MISMO ciclo, no lo difieras.

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

0. 🔴 GATE DETERMINISTA — corré PRIMERO, antes de razonar nada:
   `bash scripts/vigilancia-check.sh --quiet`
   **Exit 0 = sin novedades. Cerrá el turno en UNA línea y NO sigas** — no releas no-ocio-check.sh
   ni cola-check.sh a mano, `vigilancia-check.sh` ya los corre a los dos y decide.
   **Exit 1 = alarma. Su stdout ES el reporte** — partí de ahí, no reconstruyas la medición vos.
   Este script compone `cola-check.sh` (hito arrancable) + `escaladores-buzon.sh` (contrato/pedido
   viejo) + mtime de transcripts (VIDA vs PRODUCCIÓN — VIDA fresca NO prueba trabajo, el cron
   también genera turnos: medido 2026-07-24, la sesión OCIOSA tuvo 42 disparos y la que
   implementaba 5). Ver su docstring para el detalle de cada pieza.
   Si el script no existe en tu checkout (`vigilancia-check.sh: command not found`), estás en una
   rama vieja — `git log origin/main -1` y decilo; mientras tanto, caé al modo manual de abajo.

1. SI HUBO ALARMA (o el script no existe): MEDIR, en un solo comando: hora actual · último commit de `origin/main` y su antigüedad ·
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

0. 🔴 GATE DETERMINISTA — corré PRIMERO: `bash scripts/vigilancia-check.sh --quiet`
   **Exit 0 = sin novedades, cerrá en UNA línea y NO sigas.** Exit 1 = alarma, su stdout ES el
   reporte (ya trae PRODUCCIÓN vs VIDA de ambas sesiones + escaladores de buzón + cola). Si no
   existe en tu checkout, caé al modo manual: `bash scripts/no-ocio-check.sh` — PRODUCCIÓN =
   minutos desde el último `Write`/`Edit` (dice si TRABAJA); VIDA = mtime del transcript, que el
   CRON también renueva (2026-07-24: sesión ociosa con 42 disparos vs 5 de la que implementaba) →
   VIDA fresca + PRODUCCIÓN vieja = `🌀 GIRA EN VACÍO`, ocio, no dead-man. **PROHIBIDO afirmar
   parada/muerte sin ese output** (2026-07-24: "backend muerto 8½h" mientras escribía código).
   NUNCA leas un `.jsonl` entero.

1. SI HUBO ALARMA, con el output del paso 0 distinguí las DOS señales, que NO son lo mismo:
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
