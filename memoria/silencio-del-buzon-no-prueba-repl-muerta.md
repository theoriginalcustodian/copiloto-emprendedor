---
name: silencio-del-buzon-no-prueba-repl-muerta
description: Que una sesión no autoree archivos en el buzón NO prueba que su REPL esté muerta — es un vacío del instrumento, no un hallazgo; y afirmar cómo está montado el sistema (crones/monitores) sin leer el archivo fuente es codificar la esperanza
metadata:
  type: feedback
---

**2026-07-24, dos afirmaciones falsas encadenadas, ambas desde un vacío mal leído:**

1. **"Ambas REPLs muertas."** Medí el ocio por el mtime de los archivos que cada sesión autorea en el
   buzón; backend y frontend estaban ambos "callados" hace 8-9 h → afirmé que las dos REPLs estaban
   muertas y que "sólo el operador puede revivirlas". **Falso para frontend:** minutos después el
   frontend leyó el contrato del buzón y mergeó PR#111 solo. Estaba vivo y productivo todo el tiempo.
   El silencio en el buzón describía el BUZÓN, no el proceso. Un vacío del instrumento
   ([[vacio-no-es-hallazgo-correr-el-control]]) tratado como dato.

2. **"No hay monitores instalados en las sesiones."** El operador preguntó por qué las otras sesiones
   no tenían monitores; afirmé que no existían, que sólo planificación se auto-manejaba. **Falso:**
   `coordinacion/CRONES.md` define un heartbeat para backend Y frontend (ambos `*/3 * * * *`), con la
   regla explícita *"SI NO HAY NOVEDADES, NO TE DUERMAS — SEGUÍ CON TU COLA"*. La arquitectura sí los
   contempla. Afirmé cómo estaba montado el sistema sin leer el archivo que lo define — el trigger
   exacto de la tabla de V-INT ("El sistema hace Z" → leer el código real, no la memoria).

**El control barato que evitaba las dos:** antes de afirmar "REPL muerta", correr el control — ¿la
sesión ACTÚA aunque no autoree? (el frontend acababa de mergear un PR: `git log`/`gh pr list` lo
mostraba). Antes de afirmar "no hay monitores", leer `CRONES.md` (1 `Read`). Los dos costaban segundos;
los dos me los salté porque el vacío "se sentía" como dato.

**El diagnóstico correcto, ya con evidencia:** frontend vivo (heartbeat corriendo, self-drive OK);
backend mudo porque **su cron no estaba corriendo** — los crones viven sólo en memoria de sesión
(§4.ter), mueren al cerrar la ventana y hay que **re-pegarlos al arrancar**. Un cron **no se puede
crear para otra sesión** (`CRONES.md` L10), así que planificación NO puede instalarle el heartbeat a
backend: sólo la ventana de backend puede. Reviven backend = el operador pega el bloque `## BACKEND`.

## 🔴 El instrumento preciso (lo que faltaba): el transcript JSONL

El mismo día volvió a fallar **el mismo control, por el instrumento**: `no-ocio-check.sh` medía la
actividad por el `mtime` de los archivos del buzón y reportó *"backend muerto 8½ h"* **mientras backend
escribía código a full** (su transcript tenía 132 menciones de `registrar_ingreso`, 24 de
`ingreso_propuesto`, y había invocado `temporal-developer` — literalmente el DoD de su contrato).

**El latido real es el transcript JSONL**, que Claude Code escribe en CADA turno:

```
~/.claude/projects/<slug-del-repo>/*.jsonl     # un .jsonl por sesión; mtime = último turno
```

Identificación sin cargarlo (pesan **cientos de MB — NUNCA leerlos enteros**):
`tail -c 1000000 <f> | grep -c 'sesión BACKEND'` (idem FRONTEND/PLANIFICACIÓN), marcador dominante gana.

**Las dos señales son distintas:** transcript = **VIDA**; buzón = **REPORTE**. Transcript fresco +
buzón viejo = *"trabaja sin reportar"* → recordatorio de `avance_`, **no** dead-man. El
dead-man's-switch se dispara **por el transcript, nunca por el buzón**. Implementado en
`scripts/no-ocio-check.sh`, asentado en COORDINACION §4.2.sexies y embebido en los prompts de los
crones de PARÁLISIS y OCIOSAS (`.claude/commands/monitoreo.md`).

**How to apply:**
- **Silencio en el buzón ≠ sesión muerta.** Antes de afirmar que una REPL murió, mirá su **transcript**
  (el control preciso) y/o acción externa (git log, PRs). Nunca sólo la autoría en el buzón.
- **Antes de afirmar cómo está montado el sistema** (crones, monitores, wiring, boundaries) → **leé el
  archivo fuente** (`CRONES.md`, `COORDINACION.md`, el config real), no la memoria de sesión. V-INT.
- El `no-ocio-check.sh` mide autoría de buzón como PISO conservador de actividad — está bien para
  disparar el dead-man's-switch (falso positivo barato: un push), pero NO es prueba de muerte. La
  prueba de vida es que la sesión ACTÚE.
