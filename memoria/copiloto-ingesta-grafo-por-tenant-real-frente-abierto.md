---
name: copiloto-ingesta-grafo-por-tenant-real-frente-abierto
description: YA NO ES FRENTE (medido 2026-10-06) — la ingesta evento→grafo por tenant está cableada, desplegada y CORRIENDO: 23 Schedules vivos cada 15 min, último run COMPLETED con {cursor 0, sincronizados 0} porque `copiloto_eventos` tiene CERO filas en prod. Lo que falta es TRÁFICO, no código. El nombre del archivo dice «frente-abierto» y por eso siguió dirigiendo scope 2,5 meses después de cerrar
metadata:
  type: project
---

**El nombre de este archivo miente y se queda.** Dice `frente-abierto` y describía un estado de
**2026-07-23**; `BETA-G0` lo cerró y nadie volvió a mirar la entrada. El nombre no se cambia para no
romper los `[[enlaces]]`, así que el aviso va acá arriba: **no es un frente de implementación.**

## Lo medido el 2026-10-06 (por planificación, contra `origin/main` y contra el VPS)

| eslabón | evidencia |
|---|---|
| **Productores** | 6 stores de producción importan `registrar_evento`: `afip_comprobante_store.py:17`, `cobro_store.py:33`, `concepto_store.py:24`, `gasto_store.py:16`, `presupuesto_store.py:27`, `trabajo_store.py:35` |
| **Consumidor** | `grafo_sync_activities.py:60-63` lee `uc_factory.copiloto_eventos WHERE cliente_id=%s AND id > cursor`; `GrafoSyncWorkflow` lo orquesta; `worker_b.py:71-72,327,368,376` lo registra y le inyecta `conn_factory` |
| **Disparador** | `deploy/copiloto/deploy.sh:323-336` corre `ensure_grafo_sync_schedules.py` en cada deploy (`schedule_id = grafo-sync-{cliente_id}`, intervalo por env var) |
| **Vivo en prod** | **23 Schedules `grafo-sync-*`** listados contra `127.0.0.1:7233` del VPS, **todos disparados a las 18:45 UTC del 2026-10-06** |
| **Resultado real** | 3 runs leídos por handle: status `COMPLETED`, resultado **`{'cursor': 0, 'sincronizados': 0}`** |
| **La causa del 0** | `SELECT count(*) FROM uc_factory.copiloto_eventos` → **0**. No hay nada que ingerir |

⇒ **La ingesta funciona y no tiene qué comer.** Es [[desplegado-no-significa-con-clientes]] en su forma
más pura: cero usuarios ⇒ cero operaciones ⇒ cero eventos ⇒ `sincronizados: 0` es el resultado
**correcto**, no un síntoma.

## 🔴 Dos cosas que este caso enseña y valen más que el caso

1. **`sincronizados: 0` es indistinguible entre «no hay datos» y «el lector no ve los datos».** El
   control que los separa no está en el consumidor: es `count(*)` sobre la tabla **y** el grep de quién
   la **ESCRIBE** ([[la-costura-leia-un-campo-que-nadie-escribe]]). Sin esos dos, un 0 se lee como
   «anda bien» o como «está roto» según el humor del día.
2. **El paso del deploy que crea los Schedules es `fail-open`** (`deploy.sh:327`, `|| echo "(aviso: …)"`
   — deliberado: la Inteligencia de Negocio no es el camino crítico del chat). **Un deploy VERDE no
   prueba que el Schedule exista.** La única prueba es listarlos contra Temporal, que es lo que se hizo
   acá. Es la clase [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] aplicada a un paso opcional.

## Lo que SÍ queda, y no es implementar

- **Tráfico real.** Hasta que un emprendedor facture/cobre/gaste en prod, el grafo por tenant queda
  vacío y el chat de IN sigue degradando honesto («no tengo ese dato»).
- **Un ejercicio punta a punta del camino REAL.** ⚠️ Sembrar con `grafo_dataset.py` **no sirve como
  prueba del productor**: fabrica ~30 eventos para un tenant sintético *backdateados y salteándose los
  ganchos* (lo dice su propio docstring, `:30`). Ejercita el consumidor, no los 6 `registrar_evento`.
  Un verde ahí acreditaría la mitad que no se duda.

## Lo que decía esta entrada en 2026-07-23, y por qué NO se pierde

Entonces era verdad: nadie invocaba `construir_datasets_evento`/`construir_datasets_estado`/`GrafoWriter`,
y el único dato en Graphity era el dataset sintético del hito 5 (`negocio_key="copiloto-demo-hito5"`,
`group="copiloto-negocio"`). El razonamiento que sigue vigente es el del **aislamiento**: `buscar_grafo`
filtra por `group_ids=["negocio-{cliente_id}"]`, un graph lógico por tenant, que **nunca** comparte el
`copiloto-negocio` de la demo (ver [[graphity-tenant-dedicado-y-ontologia-scoped]]) — así que un tenant
real con graph vacío devuelve `[]` y el chat responde «no tengo ese dato»: la degradación **correcta** del
DoD §5, no un bug. Y la cuenta del contrato IN también sigue en pie: las preguntas **5/11/12** de §9
(precio histórico · proveedor · última venta al cliente) necesitan el grafo poblado; las otras **12 son
SQL puras** y andan con datos reales desde el día uno.

Vecinos con los que NO hay que confundirlo: [[copiloto-trazabilidad-operaciones-fact-triple]] (fact-triple
de operaciones para trazar el SoT) ni [[copiloto-automatizaciones-recurrentes-candidato]]
(Schedule/signal de automatizaciones).
