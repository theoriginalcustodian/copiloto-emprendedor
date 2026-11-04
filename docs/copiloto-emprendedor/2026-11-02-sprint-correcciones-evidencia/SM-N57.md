# SM-N57: el único test adversarial del aislamiento de la MEMORIA corre en el gate

**Ficha:** SM-N57 · **Medido:** 2026-11-04 en el VPS, mismo runner del gate (`sync-test-backend.sh`).

## El cambio
`deploy/copiloto/sync-test-backend.sh` inyecta `GRAPHITY_BASE_URL` y `GRAPHITY_API_KEY` al `ssh` del runner,
leyéndolas **server-side** de `/etc/unreal-copilot/copiloto.env` (sólo esas dos). Verificado sin imprimir valores:
`BASE_URL len 30` (host `graphitymt.duckdns.org`), `API_KEY len 37`. Opt-out: `UC_TEST_SIN_GRAPHITY=1`.

## DoD 1 — corre y pasa, 0 skipped
`tests/test_memory_isolation_live.py::test_recall_isolation_cross_emprendedor PASSED` · `1 passed in 15.77s` · línea
`==> Grafo: ON` en el log del runner.

## DoD 2 — control positivo: el aislamiento invertido lo pone ROJO por LEAK
Mutante: `MemoryProvider._user_id` devuelve `f"{ns}-COMPARTIDO"` para todos (los dos emprendedores comparten user graph).

| | Resultado |
|---|---|
| Con el mutante | `FAILED` en `test_memory_isolation_live.py:92`: `AssertionError: LEAK: A vio el dato de B — ctx_a='… ZzwayneShoes … Z…'` · `1 failed in 12.76s` |
| Causa del rojo | el assert de **LEAK**, no un error de conexión: pasó antes el control positivo (`:88-91`, cada uno recupera lo propio) |
| Restaurado (`finally`) | `memory_provider.py` byte a byte idéntico; sin diff |

## DoD 3 y 4
DoD 3: declarado en `ADR-001 §13` (por qué sólo este test necesita credenciales y qué no cubre GitHub). DoD 4 no aplica:
se decidió **correrlo**, así que el control no queda `[UNVERIFIED]`. Se declara que `tests.yml` lo sigue saltando.
