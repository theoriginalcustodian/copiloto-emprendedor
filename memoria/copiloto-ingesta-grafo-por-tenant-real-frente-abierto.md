---
name: copiloto-ingesta-grafo-por-tenant-real-frente-abierto
description: FRENTE ABIERTO (post-chat IN, MAYOR) — no existe ingesta automática de eventos reales de un emprendedor al grafo; solo la demo sintética del hito 5. El chat de IN degrada honesto ("no tengo ese dato") pero 3 de 15 preguntas quedan sin datos reales hasta construirla
metadata:
  type: project
---

**Estado (2026-07-23):** en producción **nadie** invoca `construir_datasets_evento` /
`construir_datasets_estado` / `GrafoWriter` (backend lo grepeó). El único dato en Graphity es el dataset
**sintético del hito 5** (`negocio_key="copiloto-demo-hito5"`, `group="copiloto-negocio"`), cargado a
mano una vez para el spike. **No hay worker/activity que sincronice eventos reales de un emprendedor → el
grafo.**

**Por qué NO bloquea el chat de IN (v1):** `buscar_grafo` filtra por `group_ids=["negocio-{cliente_id}"]`
(un graph lógico por tenant, aislado — nunca comparte el `copiloto-negocio` de la demo). Un tenant real
tiene ese graph vacío → `buscar_grafo` devuelve `[]` → el chat responde *"No tengo ese dato"*, que es la
degradación **correcta** del DoD §5, no un bug. Coherente con [[desplegado-no-significa-con-clientes]]
(hoy hay cero usuarios reales).

**La deuda visible (fijada por PLANIFICACIÓN, no diferida a "cuando cierre el chat"):** las preguntas
**5/11/12** de §9 del contrato IN (precio histórico · proveedor · última venta al cliente) responden "no
tengo ese dato" en **todo tenant real** hasta que exista la ingesta. Las otras **12 son SQL puras** →
andan con datos reales desde el día uno. **12/15 reales + 3 que degradan honesto = v1 legítimo.**

**Es un frente propio, MAYOR, post-chat.** Construir la ingesta ahora sería adelantar una fase no
aprobada. Cuando se abra, distinguir de sus vecinos: NO es
[[copiloto-trazabilidad-operaciones-fact-triple]] (ese es el fact-triple de operaciones para trazar el
SoT) ni [[copiloto-automatizaciones-recurrentes-candidato]] (Schedule/signal). Es el **cable evento-real
→ grafo por tenant**: qué dispara la escritura (¿cada operación confirmada? ¿un batch?), con qué
identidad (uuid5, ver [[graphity-tenant-dedicado-y-ontologia-scoped]]) y respetando el aislamiento
`negocio-{cliente_id}`.
