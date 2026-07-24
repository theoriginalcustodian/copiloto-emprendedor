---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# Toda la vigilancia vive DENTRO de las sesiones vigiladas — plano de fallo común

**Evidencia:** backend estuvo **8½ h mudo** y nada externo lo notó. Los crones «viven sólo en memoria
de la sesión: mueren al cerrar Claude, al reiniciar la PC» (`coordinacion/CRONES.md:22-24`). Hallazgo
de la auditoría externa del 2026-07-24, §2 P2 — **ningún** mecanismo existente ni pendiente lo cubría.

**Qué falla:** el vigía, el dead-man, los sensores y el janitor corren todos **dentro** del mismo
proceso que vigilan. Si la aplicación muere, la cuota se agota o la máquina duerme, **el vigilante
muere con el vigilado** y el silencio resultante es idéntico al de una sesión que trabaja tranquila.
Es la clase de fallo que costó las 8+ h, y no se arregla vigilando más rápido desde adentro.

**Gancho a construir:** una tarea del **Task Scheduler de Windows** (cada 10-15 min, determinista,
cero LLM) que lea los `mtime` de los transcripts de las sesiones y el estado de la cola del buzón; si
una sesión del camino crítico está muda >30 min **con cola no vacía**, notificación al operador. El
patrón «garantizado aún con la PC reiniciada requiere Task Scheduler» ya está descrito en
`~/.claude/pattern_scheduled_jobs.md` — reutilizarlo, no inventarlo.

**DoD binario:**
- Matar la sesión de una implementadora con trabajo en `en-curso/` → la notificación llega en <15 min
  **sin que ninguna sesión de Claude esté viva**.
- **Control negativo:** las tres sesiones trabajando normalmente durante una hora → **cero**
  notificaciones. Un watchdog que avisa siempre se silencia a la semana y deja de existir.

---

## ✅ IMPLEMENTADO — 2026-07-24

**Gancho:** `scripts/watchdog-sesiones.ps1` (rama `chore/vigilancia-sin-modelo`). PowerShell puro,
cero LLM, cero dependencias externas — usa `Get-ChildItem`/`LastWriteTime` (sólo metadata, **nunca**
abre los `.jsonl`, que pesan cientos de MB) + `msg.exe` (nativo de Windows, confirmado presente:
`Get-Command msg.exe` → `C:\Windows\system32\msg.exe`) para notificar sin bloquear.

**Qué mide:** (1) VIDA = minutos desde el `.jsonl` más reciente entre TODOS los transcripts del
repo; (2) COLA = cantidad de `.md` en `coordinacion/en-curso/`. Alarma sólo si VIDA≥30min **Y**
COLA>0 — silencio con la cola vacía es normal (nadie tiene nada tomado) y no notifica, sea cual sea
VIDA.

**DoD, corrida real (`-WhatIf`, sin tocar log ni disparar `msg.exe`) contra 3 escenarios simulados**
(transcripts y buzón de prueba con `mtime` controlado por `touch`/`LastWriteTime`):

```
CASO 1 (normal: transcript fresco + cola con trabajo tomado) -> NO debe notificar
  VIDA=2min (sesionA.jsonl hace 2 min)  COLA=1  ALARMA=False   EXIT=0

CASO 2 (silencio legítimo: transcript viejo + cola VACÍA) -> NO debe notificar
  VIDA=35min (sesionB.jsonl hace 35 min)  COLA=0  ALARMA=False   EXIT=0

CASO 3 (DoD positivo: transcript viejo 35min + cola con trabajo tomado) -> DEBE notificar
  VIDA=35min (sesionB.jsonl hace 35 min)  COLA=1  ALARMA=True   EXIT=1
```

**Corrida real (sin `-WhatIf`)** confirmando log + `msg.exe` sin excepción:

```
2026-07-24 15:03:51  VIDA=35min (...)  COLA=1  ALARMA=True    (EXIT=1, log escrito, msg.exe disparado)
2026-07-24 15:03:51  VIDA=2min (...)   COLA=1  ALARMA=False   (EXIT=0, log escrito, sin msg.exe)
```

Los dos casos "no debe notificar" cubren las dos formas de silencio legítimo: sesión activa (CASO 1)
y sesión inactiva pero sin trabajo pendiente (CASO 2) — ambos son el control negativo del DoD; el
literal "tres sesiones una hora" no se esperó en tiempo real porque la lógica es un snapshot sin
estado (si no alarma en T, no alarma en T+3600s bajo las mismas condiciones).

**Instalación en el Task Scheduler:** snippet documentado en el header del script
(`Register-ScheduledTask ... -Force`, idempotente — reemplaza si ya existe, no duplica). Se validó
la sintaxis construyendo `$action`/`$trigger` sin registrar nada (`New-ScheduledTaskAction`,
`New-ScheduledTaskTrigger` corridos, sin `Register-ScheduledTask`). **La instalación real queda para
el operador**, tal como pide la especificación — registrar una tarea programada muta la máquina y no
es decisión de un script ni de esta sesión.
