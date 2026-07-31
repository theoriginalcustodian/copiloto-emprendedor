---
name: copiloto-presupuestos-y-perfil-negocio
description: Presupuestos (Doc + card + botón facturar) y perfil del negocio implementados de las dos capas y verificados contra el vivo; qué se descartó y qué quedó abierto
metadata:
  type: project
---

# 💰 Presupuestos + perfil del negocio — implementado de las dos capas (2026-07-21)

**Backend:** `efac673` (rama `feat/facturacion-afip-determinista`, la que corre en prod).
**App:** `a185f95` · `82ea3f5` · `2519049` (rama `feat/mobile-first-cascara-glass`).
Diseño cerrado con el operador en `memoria/Ideas de implementacion/`.

## Qué hace

El emprendedor crea un presupuesto → se genera un **Google Doc** para mandarle al cliente → queda una
**card** con el resumen → y desde la card, **un botón convierte el presupuesto en factura** sin
retipear nada. El perfil del negocio (a qué se dedica, a quién le vende, horario, cómo quiere que le
hable el copiloto) se **inyecta en el system prompt** de cada turno.

## Las tres decisiones que NO hay que re-litigar

1. **La máquina de estados se descartó**, por decisión de producto del operador: *«la mayor parte de
   emprendedores no suele mantener la información actualizada… terreno complejo de sostener para una
   función que no va a usar casi nadie»*. Sobrevive **una** transición y es **derivada**, no
   almacenada: `facturado` sale de que exista el comprobante con CAE. *Un estado que nadie actualiza
   no es un dato, es una mentira que envejece.*

   ⚠️ **CORRECCIÓN 2026-07-24 — esta entrada quedó obsoleta y hay que leerla con cuidado.** Lo que se
   descartó fue el **pipeline** `enviado→aceptado→rechazado→facturado`. Lo que el hito 3 **sí
   construyó** es otra cosa, y está VIVO en `apps/copiloto/presupuesto_store.py:41`: tres categorías
   **`pendiente` / `aprobado` / `desestimado`** (ganado · perdido · **no sé**), con columna `estado` +
   `estado_actualizado_en`, mapa de `TRANSICIONES` y 409 en la capa web ante una transición inválida.
   Dos omisiones son deliberadas y están documentadas en el código: `desestimado→aprobado` no existe
   (se emite un presupuesto nuevo) y **no se puede volver a `pendiente`**, porque *«borra información
   que alguien declaró»*. `sin_respuesta` es un **matiz calculado** de pendiente, no un cuarto estado.

   El porqué del rediseño, textual del código: *«si los no-marcados contaran como rechazos, la tasa de
   conversión diría que se pierde el 80% de los presupuestos cuando en realidad no se sabe qué pasó — y
   un número mal una sola vez hace que el emprendedor no vuelva a mirar la pantalla»*. Es decir: el
   "no sé" explícito ES la decisión de producto, no una omisión.

   **Cómo se descubrió:** el barrido de domain-modeling del 2026-07-24 cazó la contradicción entre esta
   entrada (que decía "no re-litigar") y el handoff de diseño del 23 que marcaba los estados ✅ VIVO.
   Ganó el código. [[la-evidencia-vence-y-el-documento-no-lo-dice]]
2. **El Sheet de trazabilidad se descartó** (2026-07-21): *«tenemos todo en nuestra base de datos»*.
   `COPILOTO_PRESUPUESTOS_SHEET_ID` nunca se configuró y `sheet_fila` queda siempre `null`. Es código
   muerto a limpiar; FRONTEND confirmó que el campo está tipado pero **no se pinta en ninguna
   pantalla**, así que sacarlo no rompe nada. *(deuda menor, sin propietario asignado)*
3. **Las plantillas de email se descartaron** — perfil + soul ya resuelven "que suene a mí" para todos
   los mails, sin una capa más que mantener.

## Lo que costó caro y hay que recordar

- **`afip_comprobantes.workflow_id` NO guarda el `factura_id`**, guarda
  `factura-{cliente_id}-{factura_id}`. Cruzar por el id corto daría `facturado: false` **para siempre,
  sin error y sin log**. Hay un test que ata la construcción del store contra la de `web._wf_id_factura`.
- **El perfil se lee por turno, nunca se cachea.** La sesión es permanente (continue-as-new) y tanto
  `config` como `self._state` sobreviven al CAN: lo que se guarde ahí queda congelado para siempre y el
  usuario cambiaría su perfil sin efecto. Va en `system_extra`, **antes** del bloque de memoria, para
  preservar el prefijo de prompt-cache (lo estable primero).
- **Sin perfil el prompt queda byte a byte igual** que antes del frente — hay test. Es lo que permite
  que el A/B del soul aísle el efecto.
- **Facturar era idempotente-roto** y lo cazó FRONTEND verificando mi entrega en vez de creerle:
  ver [[idempotencia-con-un-if-tiene-ventana]].

## Estado

Backend terminado y desplegado (546 tests passed / 0 failed, E2E contra el vivo). App implementada.
**✅ device PASS — E2E 6/6 el 2026-07-23** (evidencia en `_evidencia/`, registrado en
`coordinacion/PLAN.md:82`). Este párrafo dijo *"falta la prueba en device"* durante seis días
**después** de que la prueba pasara: el dato vivía en el tablero y nadie lo trajo acá
([[propagar-cierre-a-docs-maestros]]).

Ver [[copiloto-facturacion-afip]] (el destino del botón) y
[[coordinacion-tres-sesiones-buzon]] (es el primer trabajo largo del régimen de tres sesiones).
