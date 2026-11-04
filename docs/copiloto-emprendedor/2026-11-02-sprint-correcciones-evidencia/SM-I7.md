# SM-I7: el `icono` que sirve el backend es el que la app dibuja — test de costura

**Ficha:** SM-I7 (lo que queda es de CONTRATO backend↔app; no necesita teléfono) · **Medido:** 2026-11-04.

## La premisa que venció

«Deploy FRENADO» ya no es cierto: manejo-de-errores midió en el VPS (2026-11-04 ~00:42 UTC) que el `catalog.py` desplegado tiene `icono` y el servicio reinició. Tampoco falta la captura. Quedaba afirmar la costura con un test, no por lectura.

## El test ya existía — y se SALTEABA donde corre el gate

`apps/copiloto/tests/test_alcance_condicion.py::test_ningun_icono_emitido_esta_fuera_de_PHOSPHOR` cruza todo `icono` que emiten `/catalog` y la card `requiere_conexion` contra las claves de `PHOSPHOR` (`apps/mobile/src/theme/glass/phosphor.ts`). Pero estaba bajo `skipif(not _PHOSPHOR_TS.exists())` y `sync-test-backend.sh` **no llevaba ese archivo al stage del VPS**:

```
SKIPPED [1] tests/test_alcance_condicion.py:207: el árbol de la app no está en este checkout
30 passed, 1 skipped
```

O sea que la costura sólo estaba ejercida en un checkout completo; en el runner del gate (`scripts/gate.sh` → `sync-test-backend.sh`) el test no corría y la afirmación quedaba «por lectura». Es el degradado prudente al caso benigno: un salto que no da síntoma.

## El cambio

- `deploy/copiloto/sync-test-backend.sh`: el `tar` lleva `apps/mobile/src/theme/glass/phosphor.ts` (mismo patrón que el fixture hermano de `requiere_conexion.cards.json`).
- `test_alcance_condicion.py`: se quita el `skipif`. Si el archivo falta, el test **falla**; no se saltea.

## Evidencia (VPS, mismo runner del gate)

| | Resultado |
|---|---|
| Antes | `30 passed, 1 skipped` |
| Después | `31 passed` (0 skipped) |
| Mutación: `coins` → `glifo-que-no-existe` en `catalog.py` | `3 failed, 28 passed`; el de costura cae con `AssertionError: ['glifo-que-no-existe']` |

La app tiene su lado: `SheetRequiereConexion.test.tsx` (a) cruza los glifos que el sheet declara contra `PHOSPHOR`, y `resolverGlifo` cae al glifo de la condición ante un nombre desconocido. Ese fallback es correcto como defensa en runtime; lo que le faltaba era que **alguien** viera cuándo el backend manda un nombre que no existe. Ahora lo ve el gate.
