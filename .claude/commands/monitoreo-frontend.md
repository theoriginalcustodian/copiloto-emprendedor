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
3. **`CronList` de nuevo y CONFIRMÁ** — verificá que el cron aparece. Reportá UNA línea:
   `✅ FRONTEND cron vivo — schedule */3, próximo tick HH:MM` **o** `❌ no aparece, reintento`.
   **Sin verlo en `CronList`, NO está instalado** (raíz 2026-07-24 — ver `coordinacion/CRONES.md`
   §Ritual de instalación).

> Contexto: sesión FRONTEND del trabajo en 3 sesiones paralelas coordinadas por el buzón
> `coordinacion/`. El cron se pierde al abrir una sesión NUEVA (sobrevive a `--continue`/`--resume`).
> Este command lo re-arma cuando hace falta.

---

## Cron — Vigía de coordinación (FRONTEND)

- **Schedule (cron):** `*/3 * * * *`  (cada 3 minutos)
- **Prompt:**

```
Vigía de coordinación (sesión FRONTEND).

Buzón (ruta absoluta, NO relativa al cwd):
C:\Proyectos\Claude\Claude code\copiloto-emprendedor\coordinacion\

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
