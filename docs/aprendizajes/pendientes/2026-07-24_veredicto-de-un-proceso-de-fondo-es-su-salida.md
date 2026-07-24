---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# El veredicto de un proceso de fondo es su salida, no su código de retorno

**Evidencia:** la sincronización del grafo reportó `exit 0` con `GraphityError: timeout` dentro
(`tasks/b12f3vc5e.output`). Consecuencia vigente: **el grafo no tiene el hito 9.**

**Qué falló:** un pipe (`cmd | tail`) devuelve el status del último proceso, no del comando. El verde
no era una medición del sync: era una medición de `tail`. Y un instrumento así no falla — **confirma**:
da permiso para seguir.

**Gancho a construir:** envoltorio de sincronización que (a) use `set -o pipefail` o capture el status
del comando real, (b) grepee su propia salida buscando el patrón de error, y (c) **cierre con un
control positivo automático**: buscar en el grafo un símbolo que sólo existe en el último commit
publicado, y fallar ruidoso si no aparece.

**DoD binario:**
- Sync exitoso → el control positivo encuentra el símbolo nuevo; exit 0.
- **Control negativo:** forzar un fallo del sync (endpoint inalcanzable) → el envoltorio sale distinto
  de cero **y** lo dice en una línea. Si sale 0, el gancho no engancha.
