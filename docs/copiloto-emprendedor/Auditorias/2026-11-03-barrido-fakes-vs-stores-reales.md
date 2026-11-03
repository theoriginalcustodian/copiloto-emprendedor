# Barrido: ¿cuántos fakes declaran una forma que su store real no cumple?

**Fecha:** 2026-11-03 · **Sesión:** backend · **Pedido:** planificación (auditoría acotada, NO ficha del sprint, `DEC-18`).
**Origen:** SM-N21 — el fake de `_run_marcar_factura_cobrada` devolvía `estado:"cobrada"`; el `CobroStore` real responde
`estado_cobro` (y su `estado` es el del comprobante, `'emitida'`). El test salía verde **por el fake**.
**Instrumento:** [`scripts/barrido_fakes_vs_stores.py`](../../../scripts/barrido_fakes_vs_stores.py) (AST, no ejecuta nada; `--ref <sha>` lee de git).

## Alcance (explícito, no silencioso)

| | |
|---|---|
| Clases fake/stub en `apps/copiloto/tests/` | **140** (`class …Fake/Stub/Falso/Mock`) |
| Pares auditados (fake → store real) | **24**, cortados por **plata, comprobantes, tenant** (regla: inventario > ~25) |
| Quedan AFUERA | ~116: cursores/conexiones (`_FakeCursor`/`_FakeConn`), clientes Temporal, gateways MP/Composio/GoTrue/Http, y los stores fuera de ese corte (feedback, grafo_sync, metering, reply, mp_dedup, soporte, trauma, recall) |

Pares: `CobroStore`×4 fakes · `PresupuestoStore`×3 · `GastoStore`×2 · `AfipComprobanteStore`×3 · `AfipCredentialStore`×6 ·
`AfipPerfilStore`×3 · `PerfilNegocioStore`×1 · `ClienteStore`×2 · `MpPaymentStore`/`MpCredentialStore` · `TarjetaStore` (lista completa y `path:línea` en el script, `PARES`).

## La pregunta mecánica, y por qué ELLA y no «¿las claves coinciden?»

Primera versión: comparar el **set de claves** que devuelve el fake contra el real. **Midió mal el caso propio**: contra `3b20a1f1^`
el N21 no salía (ambos tienen `estado` y `saldo`; `estado_cobro` no estaba en el fake pero tampoco lo leía el consumidor roto).
El fake **no mentía en el tipo ni en el nombre: mentía en qué campo responde la pregunta**. Lo que lo caza es el **dominio de valores**:

> **VALOR** — el fake responde `K=V` y en el real `V` es valor de **otra** clave `K2` (resuelto por `estado_de_cobro()` →
> `IMPAGA/PARCIAL/COBRADA`, incluyendo `A, B = "a", "b"`), no de `K`.

Veredicto binario: **SUCIO** si hay `VALOR` o `PARAM` (kwarg que el fake acepta y el real no). Se cuentan, pero **no deciden**, `info-INVENTA`,
`info-MÉTODO`, `info-OMITE`: son ruidosos por construcción (el real arma filas con `dict(zip(cols,…))`/SQL; el fake lleva su contabilidad: `_idem_key`, `sembrar`).

## Control positivo (obligatorio) — corrido

| Contra | `_CobroFake → CobroStore` |
|---|---|
| `3b20a1f1^` (antes del fix) | **SUCIO** · `VALOR _CobroFake.registrar responde estado='cobrada' (test_plata_por_voz.py:81) · en CobroStore 'cobrada' es valor de estado_cobro, no de estado (cobro_store.py:166)` y lo mismo con `'parcial'` |
| `origin/main` (hoy) | **LIMPIO** para ese par |

Dos falsos positivos del propio instrumento se cazaron y corrigieron en el camino (dejarlos habría sido un instrumento que condena en vez de medir):
constantes por asignación en tupla (`IMPAGA, PARCIAL, COBRADA = …`) no resueltas → el control salía ciego; y claves de subíndice (`propuesto["nombre"]`)
leídas como valores.

## Resultado sobre `origin/main`: 24 pares · 21 LIMPIO · 3 SUCIO — **0 verdes falsos de plata o aislamiento**

Los 3 sucios son `PARAM`, todos **ruidosos sin riesgo de verde falso** (una discrepancia de nombre de kwarg **falla fuerte**, no pasa en silencio):

| Par | Literal fake | Literal real | Por qué no es verde falso |
|---|---|---|---|
| `test_mp_web.py::_FakePayStore → MpPaymentStore` | `upsert_from_payment(self, p, *, seller_user_id)` (`:27`) | `upsert_from_payment(self, payment, *, seller_user_id)` (`mp_payment_store.py:18`) | prod llama posicional (`mp_web.py:53`); por keyword el fake daría `TypeError` |
| `test_mp_web.py::_FakeCredStore → MpCredentialStore` | `save(self, seller, **kw)` / `get(self, seller)` (`:21-22`) | `save(self, seller_user_id, *, …)` / `get(self, seller_user_id)` (`mp_credential_store.py:21,36`) | ídem: nombre de param, falla fuerte |
| `test_clientes_web.py::_FakeClienteStore → ClienteStore` | `_siguiente_homonimo(self, nombre)` (`:85`) | `_siguiente_homonimo(self, normalizado)` (`cliente_store.py:364`) | helper **privado** del fake, no lo llama prod |

## Lo que este barrido NO acredita (leer antes de citar el «0»)

1. **Sólo mide dicts con literales de string.** Un fake que devuelve `Decimal` donde el real devuelve `str`, o un campo cuyo dominio sale de una **columna SQL** (el `estado` del comprobante no tiene constantes en el real → dominio desconocido), queda fuera. El N21 se cazó porque el *otro* campo (`estado_cobro`) sí tiene dominio resuelto.
2. **24 de 140.** Los ~116 de afuera no se midieron (ver tabla de alcance).
3. **`info-OMITE`** (claves que producción lee y el fake no devuelve) quedó **sin triar**: 46 sólo en `_CobroFake` (info total, no sólo OMITE). Un fake mínimo es legítimo; el set no distingue legítimo de peligroso.
4. **Es un barrido, no un gate.** No corre en `scripts/ci/`; sin disparador, envejece (el mismo error de la atestación sin fecha).

## Remedio de fondo (ya aplicado para plata): el test que usa el store REAL

El barrido caza el síntoma; lo que cierra la clase es el test con el store real y prueba de que sale rojo con el código viejo
(`test_cobros_y_catalogo.py::test_N21_cobro_total_con_el_store_real_…`, PR #1522). Para los pares limpios, el siguiente paso barato
no es más AST sino un test de **contrato por par**: mismo caso contra fake y store real (parametrizado), que falla si divergen.
