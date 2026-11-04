# SM-N19 · DoD 3 — test rojo si un presupuesto se persiste sin confirmar, y su control positivo

**Test:** `apps/copiloto/tests/test_sm_n19_presupuesto_no_se_persiste_sin_confirmar.py` · **Medido:** 2026-11-04.

La premisa de la ficha quedó refutada (el presupuesto N° 4 lo guardó frontend1 por ADB, ver `SM-N19.md`), pero el DoD 3 sigue siendo exigible: fija el contrato para que el camino «guardar sin card» no pueda aparecer sin que algo se ponga rojo. Si el DoD 2 se retira (no había camino que arreglar), eso es decisión de registro de planificación y se escribe explícito; éste no se retira.

## Las dos mitades (sin ellas no se distingue «el gate funciona» de «ya no se guarda nunca»)

| Mitad | Test | Qué afirma |
|---|---|---|
| 🔴 proponer no persiste | `test_proponer_un_presupuesto_NO_persiste_nada` | La tool `registrar_presupuesto` devuelve la card (`presupuesto_propuesto`), `is_write=False`, **no llama** a `PresupuestoStore.crear/crear_idem` (espiados) y deja 0 filas |
| 🟢 control positivo | `test_CONTROL_la_misma_card_confirmada_por_POST_SI_persiste` | La MISMA card, confirmada por `POST /presupuestos`, deja 1 fila |
| 🔴 nadie más crea | `test_el_unico_camino_de_produccion_que_crea_presupuestos_es_el_POST_confirmado` | Barrido AST de `apps/copiloto` y `motor`: el único archivo que importa `presupuesto_store` y llama `.crear*()` es `presupuestos_web.py` |
| 🎯 control del barrido | `test_CONTROL_el_barrido_ve_un_camino_nuevo_si_aparece` | Un `.crear_idem()` ajeno se detecta, `self.crear_idem()` y `.listar()` no, y el barrido ve el camino legítimo (no está ciego) |

## Evidencia (VPS)

- `4 passed`.
- Mutación: un archivo nuevo que importa `PresupuestoStore` y llama `.crear_idem()` → el barrido cae con `'apps/copiloto/mutante_n19.py'` en la diferencia (`1 failed, 3 passed`); archivo borrado después.
- Primer intento del barrido: 3 archivos en vez de 1 — `cliente_store.py` y `gasto_store.py` **nombran** `presupuesto_store` en un comentario y llaman a su propio `self.crear*`. Se afinó a import real por AST y receptor distinto de `self`; sin eso el test habría quedado rojo por un falso positivo, que es como se desarman los guards.

## Lo que sigue pendiente (no es de backend)

DoD 4: dictar → card → **corregir** → confirmar, en device. La corrida de `SM-N19.md` es por texto y termina en Descartar.
