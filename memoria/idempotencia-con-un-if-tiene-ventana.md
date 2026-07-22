---
name: idempotencia-con-un-if-tiene-ventana
description: Facturar dos veces creaba dos borradores; el arreglo obvio (consultar y reusar) deja una ventana de carrera y la variante USE_EXISTING duplica los ítems
metadata:
  type: project
---

# 🔁 "Si ya existe, devolvelo" NO es idempotencia — es una ventana

**2026-07-21.** `POST /presupuestos/{id}/facturar` devolvía **200 con otro `factura_id` cada vez**.
Cada llamada dejaba un borrador vivo del mismo trabajo; confirmando dos, el emprendedor emitía **dos
facturas con CAE** — irreversibles salvo nota de crédito. Lo midió la sesión FRONTEND corriendo su
propia verificación campo por campo en vez de creerle al `listo_` del backend.

## Por qué el botón se toca dos veces

No hace falta un usuario torpe: volver atrás del gate de confirmación y volver a entrar, un doble tap,
dos dispositivos, la tool del chat. **Y no protesta:** los dos borradores se ven perfectamente
normales por separado. Nada en la pantalla dice "de este trabajo ya hay uno".

## Las dos trampas del arreglo

**1. El `if` obvio tiene una ventana.** `si ya hay borrador: devolvelo` corre entre la consulta y la
creación — y los dos toques *simultáneos*, que son justo el caso que motiva el fix, caen adentro. El
bug sobrevive con menos probabilidad y peor diagnóstico. **La idempotencia tiene que apoyarse en una
primitiva atómica del sistema, no en una comparación propia.** Acá: `factura_id` derivado del recurso
(`presu-{id}`) + `id_conflict_policy=FAIL` → el segundo `start_workflow` lo rechaza **Temporal**.

**2. `USE_EXISTING` es la política que uno elegiría, y duplica los ítems.** Devuelve un handle
**indistinguible** de uno recién creado, así que el endpoint vuelve a mandar los signals de carga y el
borrador termina con todo por duplicado. **Peor que el bug original**, porque una factura con el doble
de todo se ve normal. Con `FAIL`, el `WorkflowAlreadyStartedError` es la señal de "ya existía" y los
signals se mandan sólo cuando el borrador es nuevo.

## Lo que hay que verificar antes de creerse el fix

- **Que el id fijo no bloquee el reintento.** Era el miedo: un presupuesto cuyo borrador se canceló
  quedaría imposible de facturar para siempre. Verificado contra el Temporal real: al cerrarse el
  workflow el id queda libre y el reintento abre un run nuevo. Dedujelo NO alcanza — es política de
  `WorkflowIDReusePolicy`, y se mide en 30 segundos.
- **El control diferencial sobre LA pieza.** Desactivar el `factura_id` determinístico (devolver un
  uuid por llamada = el comportamiento viejo) y confirmar que los tests de idempotencia **fallan**.
  Sin eso, el test podría estar midiendo el fake y no el endpoint — el fake tiene que modelar el
  rechazo del segundo arranque, o pasa igual sin idempotencia. Hermana de
  [[instrumentos-que-confirman-en-vez-de-verificar]].
- **El EFECTO, no la respuesta.** Un endpoint que devuelva el mismo id y *aun así* recargue los ítems
  pasa cualquier test que mire sólo el JSON del POST. Hay que leer el borrador
  (`GET /afip/facturas/{id}`) y contar los ítems: **2, no 4.**

## Lo que se llevó puesto de paso

El `factura_id` de un presupuesto dejó de ser un hex de 32 y pasó a `presu-{id}`. Es adivinable **a
propósito**: el workflow real es `factura-{cliente_id}-presu-N` y el prefijo lo pone siempre el token,
así que un tenant sólo alcanza el suyo. Pero **es un cambio de forma** que hay que avisarle al cliente
explícitamente — si valida el formato en algún lado, rompe en el device y no en el test.

Ver también [[copiloto-facturacion-afip]] y [[verificar-que-el-camino-recomendado-existe]]: es otra
costura entre dos capas donde cada lado tenía razón sobre su mitad.
