# SM-N13: la consigna interna no llega al usuario al anotar en Mi día

**Ficha:** SM-N13 · **Fix:** `7811aad1` (ancestro de `origin/main`) · **Medido:** 2026-11-04 sobre `ee8626e7`.

## DoD 4 — la suite, corrida en el VPS, con su conteo

| Qué | Resultado | Cómo |
|---|---|---|
| Suite completa (`scripts/ci/backend.sh` por defecto: `tests` + `motor/backend/agent` + `motor/clients/agent`) con Postgres real | **2729 passed, 41 skipped** (los 41 son tests que necesitan GoTrue real u `OPENAI_API_KEY`; ninguno de N13) | `deploy/copiloto/test-db.sh --export` + `sync-test-backend.sh -rs`, rama `backend/lote-n13-n19-i7` sobre `ee8626e7` |
| Archivos que ejercen la consigna (manejo-de-errores, independiente) | **76 passed** | mismo runner |
| Mutación: la consigna reinyectada en `tool_catalog.py` | **1 failed** | manejo-de-errores, el control positivo del DoD |

«Durabilidad VERDE» que citaba el `cierre_` original es el smoke del deploy, **no** la suite. Este documento es el conteo que faltaba.

## La sonda contra el LLM real — ya versionada

`scripts/probe_n13_eco_consigna.py` (antes sólo vivía en un scratchpad efímero, y el DoD exige *la misma* sonda). Cuenta cuántas respuestas contienen la frase de la consigna en el `reply_text` que ve el usuario, con N=12 turnos reales:

| | Eco de la consigna |
|---|---|
| Antes del fix | **6/12** («Confirmáselo cuando puedas», «Confirmalo con una línea corta»…) |
| Después (`7811aad1`, desplegado) | **0/12** |

**Escribe en producción** (una tarjeta de Mi día por turno, tenant canónico): no es parte del gate y se corre a mano, con N chico.

## Una nota sobre el DoD 1

El grep `git grep "Confirmáselo en una línea corta"` da **1** hit en código de producción (más 2 en `test_plata_por_voz.py`, que son el control), y ese hit es el comentario de `tool_catalog.py:1435` que explica el fix: el criterio se satisface con su propia declaración. Lo que acredita el arreglo es la sonda de arriba (mide lo que el LLM dice) y la mutación (un test que cae si la consigna vuelve), no ese grep.
