---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# Una rama nueva dispara la sincronización COMPLETA del grafo, y el push parece colgado

**Evidencia:** `.githooks/pre-push:38,54` — `remote_sha == ZERO` ⇒ `full=1`. Frenó el hito 9 **dos
veces**; backend cortó el push creyéndolo colgado.

**Qué falló:** el hook lee «la rama no está en origin» como «el grafo no sabe nada del repo», y
resincroniza todo. No es un bug de rendimiento: es una inferencia equivocada sobre el estado del grafo.
Y el síntoma —un push que tarda minutos— es indistinguible de un cuelgue, justo cuando uno espera que
git tarde.

**Gancho a construir:** en `pre-push`, calcular el alcance con `git merge-base origin/main HEAD` en vez
de asumir `full` cuando la rama no existe en origin. Y que el hook **imprima** el alcance elegido y una
estimación, para que un push largo sea legible como esperado y no como cuelgue.

**DoD binario:**
- Push de una rama nueva con 1 commit → el hook informa alcance incremental y sincroniza sólo los
  archivos de ese commit.
- **Control negativo:** un repo cuyo grafo está genuinamente vacío → el hook sí elige `full`. Si elige
  incremental en ese caso, el gancho está mal: silenciaría el caso que debe atrapar.

---

## ✅ IMPLEMENTADO — 2026-07-24

**Gancho:** `.githooks/pre-push` cuenta filas `done` del checkpoint para saber si el grafo ya conoce el
repo, y usa `git merge-base origin/main HEAD` para el alcance. Imprime cuál eligió y cuántos archivos.

**DoD, corrida real** (push de `fix/control-positivo-sync-completo`, rama nueva, **sin** `--no-verify`):

```
[pre-push] alcance: incremental desde 8daab5ae95c0 (2 archivo(s) cambiado(s))
[graph-sync] sync incremental de copiloto-emprendedor desde 8daab5ae95c0…
copiloto-emprendedor: sync OK — 1 filas, 1 zombies borrados
```

Antes de este gancho, esa misma rama nueva habría disparado el camino `full`: **15.906 filas** — el
número medido en el sync completo de esta misma tarde. Pasó de minutos a segundos.

**Control negativo:** la rama `full` sigue viva para el caso de grafo genuinamente vacío
(`graph_conoce_el_repo()` devuelve falso → `full=1`). No se ejercitó con un checkpoint vacío real:
`[PENDIENTE DE EJERCITAR]` — el camino existe y está leído, pero no corrido. Se ejercita gratis la
próxima vez que se provisione el grafo de un repo nuevo.
