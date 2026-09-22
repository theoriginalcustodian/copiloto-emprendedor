# Auditoría A4 «Cierre A» — registro de estado vigente

> **Qué es esto.** El **informe** de A4 vive en [`2026-09-22-auditoria-A4-cierre-A.md`](2026-09-22-auditoria-A4-cierre-A.md)
> y su tabla de hallazgos tiene una columna «**Qué cerraría**» — en condicional, porque se escribió
> antes de que existiera ningún fix. Este archivo es la otra mitad: **qué se cerró de verdad, y qué lo
> prueba.**
>
> **Por qué existe.** El 2026-09-22 la fila H-A4-3 seguía tratándose como defecto abierto cuando ya
> estaba cerrada **de los dos lados** desde hacía horas. Nadie se equivocó al cerrarla: los cierres se
> anunciaban en `coordinacion/`, que no está versionado y se archiva por TTL, así que **el cierre no
> tenía dónde anotarse de forma durable**. Quien abriera el informe leía la lista de hallazgos sin
> saber cuáles ya no existían. Regla del operador (2026-08-06): todo lo de auditorías vive en
> `docs/copiloto-emprendedor/Auditorias/`.
>
> **Cómo se mantiene:** cuando una fila cierra, se actualiza **acá**. El informe no se toca — es la
> foto del día de la auditoría y su valor es no moverse.

**Veredicto original:** *el Cierre A NO cierra* · entregado 2026-09-22 11:54Z (#641, `777d20a6`)
**Re-check A4-bis:** acotado a los ❌ · cerrado 2026-09-22
**Estado a 2026-09-22 (este registro):** **14 cerradas · 1 con el control activo, sin verificar**

## Estado por fila

| Fila | Sev | Qué era | Estado hoy | Evidencia |
|---|---|---|---|---|
| H-A4-1 | **alta** | Pre-push con gitleaks inactivo si `core.hooksPath` está desviado (worktrees de agente). Repo **público**. | 🟡 **CONTROL ACTIVO, SIN VERIFICAR** | 2026-09-22: se activaron **secret scanning + push protection** server-side (`gh api -X PATCH`, releído: ambos `enabled`). Eso es el control que el hook no podía dar. **Pero un control de seguridad sin test adversarial es un control no verificado**: falta el push hostil real contra el remoto. Ver «Lo que falta» |
| H-A4-2 | alta | Reveal X10 roto en el estado final del splash (la O tapa «dobi»). | ✅ CERRADA | #648 · A4-bis: solapamiento **0 px** en 7 tiempos |
| H-A4-3 | media | Rentabilidad = saldo de caja; el estado «no se puede calcular» del prototipo era inalcanzable. Junta backend↔web. | ✅ CERRADA | Backend #651 (`null` explícito) + FE1 #648 (UI del `null`). **La junta cerró de los dos lados** — se verificó el fallo típico del repo (un lado sí, el otro pinta `$0,00`) y no ocurrió |
| H-A4-4 | media | El chat de Soporte mostraba el rodillo de ejemplos del chat general. | ✅ CERRADA | #648 · A4-bis: rodillo = 0 |
| H-A4-5 | media | Facturación abría en el wizard, no en el resumen/emitidas. | ✅ CERRADA | #648 — **sólo web**; mobile diverge a propósito, derivado a triage aparte |
| H-A4-6 | baja | Fechas y período en ISO crudo en Gastos, Ingresos e Inteligencia. | ✅ CERRADA | #650, 11 sitios migrados a `formatearFecha*` |
| H-A4-7 | baja | Apariencia: layout y texto distintos del prototipo. | ✅ CERRADA | #648 |
| H-A4-8 | baja | Input de precio desbordaba 104 px a 390. | ✅ CERRADA | #650, `min-width: 0` en `presupuestos.css` |
| H-A4-9 | media | Tarjeta HITL ya respondida seguía accionable; un «Confirmar» tardío recibía «Listo 👍» sin ejecutar nada. | ✅ CERRADA | Backend #651 (callback honesto) + FE1 #648 (card deshabilitada persistente). A4-bis: **el «a medias» era error del propio informe A4** |
| H-A4-10 | media | Rate limit 60 req/min **por IP**: dos testers tras el mismo NAT se cortaban entre sí. | ✅ CERRADA | Backend #651, `_client_key()` por `cliente_id` del JWT |
| H-A4-11 | media | Un cobro de MP sin MP conectado pedía HITL igual. | ✅ CERRADA | Backend #651 · A4-bis: corta con `sheet-requiere-conexion` |
| H-A4-12 | baja | Monto HITL sin formato es-AR («$ 80000»). | ✅ CERRADA | #648, `formatearImporte` en web **y** mobile |
| H-A4-13 | baja | Cada corrida del smoke dejaba 2 `ConversationWorkflow` RUNNING huérfanos. | ✅ CERRADA | Backend #651, cleanup con `terminate()`, verificado en el log del propio smoke |
| H-A4-14 | info | Apps a 390: columnas desiguales. | ✅ CERRADA | #650, `minmax(0,1fr)` en el grid |
| H-A4-15 | info | «Crear una nueva cuenta» falta en el reveal (BETA-4b) y no figuraba en §0.2: pedía decisión de triage. | ✅ CERRADA — **no va** | Decisión del operador, 2026-09-22: el reveal queda como está. Coherente con una beta cerrada, donde las altas las hace el operador y nadie se registra solo. **Cero trabajo de código**: la fila cierra por decisión, no por fix |

## Lo que falta para que el Cierre A cierre

**H-A4-1 — el interruptor ya está puesto; falta el test hostil.** El hook no puede defenderse de que
git no lo invoque: si `core.hooksPath` apunta a otro lado —lo que hacen los worktrees de agente— el
pre-push con gitleaks simplemente no corre, y A4-bis lo probó con un push real contra un remoto bare
local. El control que sí lo cierra es **server-side**, y el 2026-09-22 el operador lo activó:
**secret scanning + push protection**, confirmado por relectura independiente (`"push_protection":
"enabled"`, `"secret_scanning": "enabled"`).

**Eso no cierra la fila todavía, y la distinción no es formalismo.** Regla dura del repo: *un control
de autorización o aislamiento que nadie ejercitó con un caso hostil es indistinguible de uno ausente*.
Acá aplica igual — el control server-side puede estar `enabled` y aun así no interceptar el patrón que
nos importa (un `.env` con una clave que el escáner no reconozca como tal). **Lo que cierra H-A4-1 es
un push adversarial real**: rama descartable, secreto con forma reconocible, `git push` → esperar
rechazo del servidor. Hasta que ese push exista y sea rechazado, la fila es 🟡, no ✅.

Ese test es de **auditoría** (es su disparador M-3, ya notificado).

**H-A4-15 — cerrada por decisión, no por fix.** El operador decidió el 2026-09-22 que «Crear una
nueva cuenta» **no va** en el reveal: en una beta cerrada las altas las hace él y nadie se registra
solo. Cero trabajo de código. Se registra acá porque una decisión que sólo vive en un chat envejece
igual que un cierre que sólo vive en el buzón — que es la razón por la que este archivo existe.

## Cómo se construyó este registro

Recopilación automatizada sobre `coordinacion/` (veredicto + todos los `cierre_`/`avance_` que
mencionan cada fila + el re-check A4-bis), con una regla dura: **no afirmar un cierre sin citar el
archivo o el PR que lo prueba, y escribir `SIN DATO` antes que completar por plausibilidad**.
Resultado del control: **14 filas con evidencia citada, 1 con `SIN DATO`, de 15**.

Un `cierre_` gana sobre un `avance_`; el re-check A4-bis gana sobre ambos cuando contradice.
