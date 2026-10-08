---
description: Arranque VERIFICADO de la sesión FRONTEND-1: cron + harness de buzón + contexto + qué arranca, con reporte binario
allowed-tools: CronList, CronCreate, Read, Bash, Glob, Grep
---

# Arrancar el monitoreo de la sesión FRONTEND-1

Instalá el cron de heartbeat de ESTA sesión (frontend). **Corré este comando EN LA VENTANA DE
FRONTEND-1** — un cron no se puede crear para otra sesión.

Pasos, en orden (idempotente + auto-verificado). **Ninguno es opcional: el objetivo no es
"instalar el cron", es dejar la sesión LISTA PARA TRABAJAR y poder demostrarlo.**

1. **`CronList`** — mirá si ya existe un cron con schedule `*/3 * * * *` cuyo prompt arranque con
   "Vigía de coordinación (sesión FRONTEND1)". Si ya está → no crees nada, saltá al paso 3.
2. **`CronCreate`** — si falta, crealo con el schedule y el prompt EXACTOS de abajo.
3. **`CronList` de nuevo y CONFIRMÁ** que aparece. **Sin verlo en `CronList`, NO está instalado**
   (raíz 2026-07-24: backend quedó 8½ h mudo porque instalar no confirmaba nada — ver
   `coordinacion/CRONES.md` §Ritual de instalación).
4. **Harness de buzón vivo** — `grep -c buzon_watcher ~/.claude/settings.json`. Ese hook
   (PostToolUse) te empuja los mensajes nuevos en CADA tool call, sin depender del cron. Si da `0`,
   el push no existe y dependés sólo del cron: **decilo en el reporte**, no lo asumas.
5. **Contexto de coordinación** — leé `coordinacion/COORDINACION.md` y `coordinacion/PLAN.md`
   (reglas vivas + COLA-VIVA). Son la fuente de qué te toca; sin esto arrancás adivinando.
5.bis. **Instrumento, desde un pin de `origin/main` — nunca desde el checkout compartido.**
   `SESION_ACTUAL=frontend1 bash scripts/vigia.sh vigilancia-check.sh --quiet`
   El lanzador **ubica (y si falta, crea) el pin detached de `origin/main`** y corre el instrumento
   desde ahí, así que la receta de `fetch` + `checkout --detach` a mano **ya no hace falta**:
   vive adentro de `vigia.sh`, tiene 22 casos de test, y el pin está excluido del podador
   para que no se borre a sí mismo en cada corrida.
   **Por qué importa** (medido 2026-10-08): el checkout compartido tiene HEAD viejo y un script
   que EJECUTA del working tree **hereda esa versión sin avisar** — su parser reporta **15 ids
   con «estado no reconocido» que no existen en `main`**, y centinelas `999999min` donde la edad
   real es calculable (`memoria/el-instrumento-respondio-sobre-otro-sujeto.md`,
   `memoria/el-checkout-compartido-sirve-comandos-viejos.md`). No toca el checkout compartido,
   así que **no es CANON 9**. Tu pin propio `C:/gfw-src/_frontend1-vigia` sigue sirviendo si preferís
   seguir usandolo a mano; el guard `0.bis VERSIÓN DEL INSTRUMENTO` (#944) corre adentro de
   `vigilancia-check.sh` y detecta por sí solo si el árbol que lo ejecuta quedó atrás.
6. **Buzón** — listá `coordinacion/abierto/` filtrando `-a-frontend1_`, `-a-frontend_` (broadcast a las dos) y `-a-todos_`, **y también**
   `coordinacion/cerrado/<hoy>/` (los `avance_`/`dato_` nacen archivados: ahí viven las señales que
   destraban, tipo «suelto el device»). Contá cuántos te interpelan sin acusar.
7. **Checkout** — `git branch --show-current` y `git status --short | head`. Es checkout COMPARTIDO:
   `git add` con rutas explícitas, y NUNCA `-A`/`--amend`/rebase/reset/checkout/pull/stash/clean.

> 🔧 **Por qué `vigia.sh` y no `scripts/<instrumento>` directo** (medido el 2026-10-08): el path relativo resuelve contra tu **cwd**, que es el checkout COMPARTIDO, cuyo HEAD está viejo. Esa versión **miente**: reportó 15 ids con «estado no reconocido» (el parser viejo no entiende `⏳`/`⏸`) y `999999min` en 4 escaladores en vez de la antigüedad real (2897/2045/2036/2067). `vigia.sh` corre el instrumento desde un **pin de `origin/main`**, y si no puede refrescarlo **grita en stderr** en vez de caer callado al árbol viejo. Un instrumento que EJECUTA un script del working tree hereda la versión de ese checkout y no lo sabe.

**REPORTE de arranque — una línea por ítem, binario, sin prosa:**

```
✅/❌ cron FRONTEND-1 vivo (schedule */3, próximo tick HH:MM)
✅/❌ vigilancia-check.sh corre
✅/❌ buzon_watcher registrado
✅/❌ COORDINACION.md + PLAN.md leídos (COLA-VIVA: hito N «...»)
📬 N mensajes dirigidos a mí sin acusar  → los listo
🌿 rama <nombre> · <N> archivos modificados
▶️  ARRANCO CON: <el ítem concreto que sigue>
```

La última línea **no es opcional**: si terminás el arranque sin nombrar qué vas a hacer, no arrancaste
— quedaste esperando. Si tu cola está genuinamente vacía, escribilo así y **posteá un `avance_` de una
línea al buzón**, porque planificación lee el buzón, no tus ticks.

> Contexto: sesión FRONTEND-1 del trabajo en sesiones paralelas (planificación/backend/frontend1/frontend2/
> manejo-de-errores) coordinadas por el buzón `coordinacion/`. El cron se pierde al abrir una sesión
> NUEVA (sobrevive a `--continue`/`--resume`). Este command lo re-arma cuando hace falta.

---

## Cron — Vigía de coordinación (FRONTEND-1)

- **Schedule (cron):** `*/3 * * * *`  (cada 3 minutos)
- **Prompt:**

```
Vigía de coordinación (sesión FRONTEND1).

Buzón (ruta absoluta, NO relativa al cwd):
C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\

0. 🔴 GATE DETERMINISTA (chequeo GLOBAL, no reemplaza el paso 1) — corré primero, **siempre vía el
   lanzador**, NUNCA con el path relativo del checkout compartido (ese miente: parser viejo sin
   `⏳`/`⏸`, centinelas `999999min` en vez de la edad real — medido 2026-10-08):
   `SESION_ACTUAL=frontend1 bash scripts/vigia.sh vigilancia-check.sh --quiet`
   `vigia.sh` hace el `fetch` y el `checkout --detach` del pin por su cuenta: una línea, no cinco.
   Exit 1 = alarma global (cola arrancable, contrato_/pedido_/en-curso viejo sin acusar de
   CUALQUIER sesión, o alguna sesión muda ≥30min) — su stdout ya es el reporte, no lo reconstruyas.
   Exit 0 = nada de eso, pero **igual seguí al paso 1**: este gate sólo detecta lo VIEJO/estancado
   (vía `escaladores-buzon.sh`), no un `contrato_` que te bajaron hace 2 minutos — para tu buzón
   propio no hay atajo. Si no existe en tu checkout, estás en una rama vieja — decilo y seguí igual.

1. Listar `abierto/` y quedarte SÓLO con `-a-frontend1_`, `-a-frontend_` y `-a-todos_`. Descartar lo que empiece por
   `frontend1-a-` (es tuyo). Un `-a-frontend2_` es de la OTRA sesión: no lo tomes. Mirar también `cerrado/<hoy>/` por los `avance_` y `dato_`, que nacen
   archivados: ahí viven las señales que DESTRABAN trabajo (p.ej. «el hito 8 está desplegado»).

2. Abrir lo nuevo y ver si te interpela aunque el nombre diga otro destinatario.

3. Releer `PLAN.md` y `COORDINACION.md` sólo si cambió su `mtime`.

4. Reportar máximo 3 ítems accionables en 6 líneas, con qué te toca hacer.

5. 🔴 SI NO HAY NOVEDADES, NO TE DUERMAS — SEGUÍ CON TU COLA.
   «Sin novedades» describe el BUZÓN, no tu trabajo. Antes de cerrar el turno:
   - Mirá `PLAN.md` y tu último `avance_`: ¿qué dejaste declarado como «lo mío que sigue abierto»?
   - Si hay algo tomado y sin terminar, SEGUILO. No hace falta que nadie te lo pida: ya está
     contratado.
   - Si estás esperando algo de otra sesión, verificá que ese aviso EXISTA en el buzón. Si no
     existe, no lo estás esperando: estás parado. Pedilo o seguí con otra cosa de tu cola.
   - Sólo si tu cola está vacía Y hay una espera real con su aviso pendiente, reportá una línea
     y terminá.
   Lo prohibido es abrir un frente NO contratado, no trabajar. Avanzar en lo ya asignado nunca
   necesita un mensaje que lo dispare.

6. ⏱️ EL CRON NO ES TU ÚNICO CANAL — y es el que MENOS te llega cuando trabajás.
   Medido 2026-07-24: un cron NO puede interrumpir un turno en curso, así que dispara MÁS cuanto
   MENOS trabajás (la sesión ociosa tuvo 42 disparos; la que implementaba, 5, y después nada por
   40 min). Mientras trabajás estás SORDA al buzón — justo cuando leer tarde cuesta más.
   Por eso:
   - El hook `buzon_watcher` (PostToolUse) te avisa de mensajes nuevos en CADA tool call, sin cron.
     Si ves un bloque `<buzon-nuevo>`, abrí lo dirigido a vos ANTES de seguir; `urgente_` y
     `contrato_` interrumpen lo que estés haciendo.
   - Y revisá el buzón vos misma en cada FRONTERA DE TRABAJO —terminar un PR, antes de un E2E o de
     algo largo, al cerrar una sub-tarea—, no cuando el cron te despierte.
   - Si un ciclo tuyo termina SIN NADA que hacer, decilo en el buzón con un `avance_` de una línea
     («terminé X, sin frente propio»): planificación lee el buzón, no tus ticks, y un tick que
     repite «idéntico al anterior» te hace parecer ocupada.
```
