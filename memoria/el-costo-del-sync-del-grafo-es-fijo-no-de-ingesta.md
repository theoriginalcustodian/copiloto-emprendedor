---
name: el-costo-del-sync-del-grafo-es-fijo-no-de-ingesta
description: El sync del grafo tarda ~5 min aunque mande 1 chunk — el costo es fijo (POST de ingesta + listado del reconcile), no «reingerir todo»
metadata:
  type: project
---

**Medido 2026-10-19** (`scripts/graph-sync.sh` con fases, sync real `951723→a65d27cb`):
`preparacion=1,5s extraccion=33s enriquecimiento=0,7s ingesta=145s (chunks_enviados=1, 3003 filas)
reconcile=122s (244 requests de listado, 0 borrados) control_positivo=2,6s` → **300 s**.

La hipótesis de partida —«se reingiere todo el repo»— era falsa: en los 22 syncs del detalle los
últimos 9 mandaron **0 chunks**. El checkpoint por hash de contenido ya saltea lo no cambiado
(`graphify-graphity-bridge/src/bridge/orchestrator/pipeline.py:155`). El contador «32660 filas
ingeridas» es el TOTAL del grafo, no lo enviado — por eso parecía reingesta completa.

**Why:** optimizar sin la medición por fase habría atacado `--since` (que sólo achica la ingesta, ya
casi nula) y dejado intactos los 267 s fijos.

**How to apply:** antes de tocar el bridge, leer `--- fases_ms:` en `.bridge/graph-sync-detalle.log`
(cada línea lleva `<ms>` desde el arranque). Candidatos, en orden de peso medido:
1. **ingesta 145 s por UN chunk de 3003 filas** — chunk posicional de 5000 filas: un cambio chico
   reenvía el chunk entero. Chunks direccionados por contenido (o más chicos) lo reducen.
2. **reconcile 122 s** — lista el grafo entero en páginas de 200 aunque no haya nada que borrar.
   El bridge ya sabe qué escribió: zombies = esperado_anterior − esperado_actual, sin listar.
3. extracción 33 s — graphify sobre el árbol entero.

Esos cambios son del **bridge** (compartido por la flota: DocuMed, Graphity, fleet-platform,
unreal-copilot) — decisión MAYOR, y al 2026-10-19 su `master` local está divergido de
`origin/master` (12 adelante / 3 atrás, varios ya mergeados por squash): hay que reconciliarlo
antes de apilar un PR encima.

**Segundo hallazgo, de la misma sesión:** git sólo espera al PROCESO del hook, no a sus fds. Un hijo
en background que herede stdout/stderr NO retiene un `git push > archivo`, pero SÍ un
`git push 2>&1 | tail` (el lector espera el EOF del pipe): medido 9 s vs 0 s en
`scripts/tests/test-pre-push-grafo-no-vetea.sh` caso 4. Por eso el `nohup` del pre-push redirige
las tres fds. Ver [[el-pipe-se-come-el-exit-code]] · [[instrumento-que-no-mira-nunca-falla]].

**Refuerzo (mismo día, primer push real con el background):** el push de BORRADO de una rama
relanzó el sync sobre el que seguía vivo. La 2ª corrida salió al instante por contención del lock,
escribió `rc=0` sobre el `en-curso` de la real y le truncó el `.log` con `>`. Sin síntoma: el `.rc`
decía «ok» de un sync que no había terminado (y el `.log` de la real quedó con bytes NUL: `grep` lo
trata como binario). 2ª medición, esa corrida: ingesta=347s con 3 chunks (~115 s/chunk),
reconcile=137s → 518 s, con el push en 5 s. Fix `fix/grafo-bg-no-relanzar`: el wrapper escribe su PID, el hook no
relanza si `kill -0` lo encuentra, y un rc=0 con el marcador sin mover (contención) no escribe.
Un estado «terminó» que puede escribir quien NO trabajó es [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]
al revés: absuelve.
