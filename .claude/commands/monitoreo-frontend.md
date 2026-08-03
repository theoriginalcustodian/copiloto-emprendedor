---
description: (Re)crea idempotente el cron de heartbeat de la sesión FRONTEND (vigía del buzón cada 3 min) y CONFIRMA contra CronList
allowed-tools: CronList, CronCreate
---

# Arrancar el monitoreo de la sesión FRONTEND

Instalá el cron de heartbeat de ESTA sesión (frontend). **Corré este comando EN LA VENTANA DE
FRONTEND** — un cron no se puede crear para otra sesión.

Pasos, en orden (idempotente + auto-verificado):

1. **`CronList`** — mirá si ya existe un cron con schedule `*/3 * * * *` cuyo prompt arranque con
   "Vigía de coordinación (sesión FRONTEND)". Si ya está → no crees nada, saltá al paso 3.
2. **`CronCreate`** — si falta, crealo con el schedule y el prompt EXACTOS de abajo.
3. **`CronList` de nuevo y CONFIRMÁ** que aparece. **Sin verlo en `CronList`, NO está instalado**
   (raíz 2026-07-24: backend quedó 8½ h mudo porque instalar no confirmaba nada — ver
   `coordinacion/CRONES.md` §Ritual de instalación).
4. **Harness de buzón vivo** — `grep -c buzon_watcher ~/.claude/settings.json`. Ese hook
   (PostToolUse) te empuja los mensajes nuevos en CADA tool call, sin depender del cron. Si da `0`,
   el push no existe y dependés sólo del cron: **decilo en el reporte**, no lo asumas.
5. **Contexto de coordinación** — leé `coordinacion/COORDINACION.md` y `coordinacion/PLAN.md`
   (reglas vivas + COLA-VIVA). Son la fuente de qué te toca; sin esto arrancás adivinando.
5.bis. **Instrumento** — `bash scripts/vigilancia-check.sh --quiet`. Corré esto primero en cada tick del
   cron (ver el gate del paso 0 de abajo); acá en el arranque alcanza con confirmar que corre sin
   error. Si no existe en tu checkout, estás en una rama vieja — decilo.
6. **Buzón** — listá `coordinacion/abierto/` filtrando `-a-frontend_` y `-a-todos_`, **y también**
   `coordinacion/cerrado/<hoy>/` (los `avance_`/`dato_` nacen archivados: ahí viven las señales que
   destraban, tipo «suelto el device»). Contá cuántos te interpelan sin acusar.
7. **Checkout** — `git branch --show-current` y `git status --short | head`. Es checkout COMPARTIDO:
   `git add` con rutas explícitas, y NUNCA `-A`/`--amend`/rebase/reset/checkout/pull/stash/clean.

**REPORTE de arranque — una línea por ítem, binario, sin prosa:**

```
✅/❌ cron FRONTEND vivo (schedule */3, próximo tick HH:MM)
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

> Contexto: sesión FRONTEND del trabajo en 4 sesiones paralelas (planificación/backend/frontend/
> manejo-de-errores) coordinadas por el buzón `coordinacion/`. El cron se pierde al abrir una sesión
> NUEVA (sobrevive a `--continue`/`--resume`). Este command lo re-arma cuando hace falta.

---

## Cron — Vigía de coordinación (FRONTEND)

- **Schedule (cron):** `*/3 * * * *`  (cada 3 minutos)
- **Prompt:**

```
Vigía de coordinación (sesión FRONTEND).

Buzón (ruta absoluta, NO relativa al cwd):
C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\

0. 🔴 GATE DETERMINISTA (chequeo GLOBAL, no reemplaza el paso 1) — corré primero:
   `bash scripts/vigilancia-check.sh --quiet`
   Exit 1 = alarma global (cola arrancable, contrato_/pedido_/en-curso viejo sin acusar de
   CUALQUIER sesión, o alguna sesión muda ≥30min) — su stdout ya es el reporte, no lo reconstruyas.
   Exit 0 = nada de eso, pero **igual seguí al paso 1**: este gate sólo detecta lo VIEJO/estancado
   (vía `escaladores-buzon.sh`), no un `contrato_` que te bajaron hace 2 minutos — para tu buzón
   propio no hay atajo. Si no existe en tu checkout, estás en una rama vieja — decilo y seguí igual.

1. Listar `abierto/` y quedarte SÓLO con `-a-frontend_` y `-a-todos_`. Descartar lo que empiece por
   `frontend-a-` (es tuyo). Mirar también `cerrado/<hoy>/` por los `avance_` y `dato_`, que nacen
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
```
