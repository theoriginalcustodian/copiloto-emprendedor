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

---

## ✅ IMPLEMENTADO — 2026-07-24

**Gancho:** `scripts/graph-sync.sh` (tres capas: `PIPESTATUS` del comando real · grep de patrones de
error aunque el status sea 0 · control positivo contra el servidor) +
`scripts/graphity_positive_control.py`.

**DoD, corrida real:**

```
[positive-control] ✅ 'scripts_graph_sync' (scripts/graph-sync.sh) está en Graphity
                      — uuid b4687a87-23dd-5fc4-afcf-8442232b3518
[graph-sync] ✅ grafo sincronizado y verificado
```

**Control negativo — el que decide si esto vale algo:**

```
uuid inexistente -> node_exists = False
uuid real        -> node_exists = True
DIFERENCIAL OK: el instrumento distingue presente de ausente.
```

Sin ese diferencial, un «está en Graphity» no probaría nada: un instrumento que siempre dice que sí
no verifica, **confirma**.

**Lo que casi lo vuelve decoración, y hubo que arreglar:** en el primer sync completo el control
respondió *«nada verificable en este rango»* — comparaba contra `HEAD~1` y los dos archivos del último
commit no caían en los directorios indexados. **El sync subió 15.906 filas y el control no miró ni
una.** Corregido: sin `--since` verifica un nodo cualquiera del grafo recién construido, y si graphify
no extrajo ninguno eso es fallo duro, no «no aplicable».

**El efecto que quedaba abierto también está cerrado:** el grafo **ya tiene el hito 9** — verificado
por consulta directa (`e2e_hito9_facturar_por_voz.py` y `.emitir()` de `copiloto/afip_gateway.py:185`
presentes, indexados hoy).
