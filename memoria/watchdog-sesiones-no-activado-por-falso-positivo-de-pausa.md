---
name: watchdog-sesiones-no-activado-por-falso-positivo-de-pausa
description: Decisión del operador de NO registrar watchdog-sesiones.ps1 en Task Scheduler — no distingue "sprint pausado a propósito" de "sesión colgada"
metadata:
  type: feedback
---

`scripts/watchdog-sesiones.ps1` (Gancho 2 de F7.5, en `main`) queda **construido y documentado, pero
sin registrar** en el Task Scheduler de Windows. Decisión explícita del operador, 2026-07-24.

**Por qué:** el script sólo mira metadata de archivo — hace cuánto no escribe ninguna sesión de
copiloto-emprendedor + si `coordinacion/en-curso/` tiene algo sin cerrar. No sabe distinguir "se
colgó" de "el operador pausó el sprint a la mitad para priorizar otra cosa" (otro repo, otra
urgencia). El patrón real del operador incluye eso con frecuencia — no es una excepción, es su forma
de trabajar. Activarlo tal como está generaría un popup de Windows cada vez que eso pasa: ruido, no
señal.

**Cómo aplica:** no re-proponer activarlo salvo que cambie una de estas dos cosas:
1. El script gane una forma de distinguir pausa deliberada de colgada real — ej. un marker explícito
   que el operador (o la sesión, antes de cerrar) deje en `coordinacion/` ("pausa-deliberada: <hasta
   cuándo o hasta qué evento>"), y el watchdog lo respete y no alarme mientras esté vigente.
2. El operador cambia su forma de trabajar y deja de pausar sprints a la mitad.

Sin uno de esos dos, activarlo hoy es instalar una fuente de falsos positivos recurrente. El script
sigue disponible tal cual (`scripts/watchdog-sesiones.ps1`, comando de alta en su cabecera) para el
día que se resuelva la limitación.
