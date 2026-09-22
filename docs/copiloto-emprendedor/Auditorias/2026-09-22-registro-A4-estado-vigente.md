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
**Estado a 2026-09-22 (este registro):** **14 cerradas · 1 ABIERTA (H-A4-1, y peor de lo que parecía)**

## Estado por fila

| Fila | Sev | Qué era | Estado hoy | Evidencia |
|---|---|---|---|---|
| H-A4-1 | **alta** | Pre-push con gitleaks inactivo si `core.hooksPath` está desviado (worktrees de agente). Repo **público**. | 🔴 **ABIERTA — sin red para el secreto PROPIO** | 2026-09-22: se activaron secret scanning + push protection (`enabled` los dos, releídos). **No alcanza**: `secret_scanning_non_provider_patterns` está `disabled` → el servidor sólo intercepta **catálogo de proveedores**, no un `.env` ni un token interno. Y la capa local tampoco corre (H-A3-1, push real: **0** líneas `[secretos]`). Ver «Lo que falta» |
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

**H-A4-1 — dos controles encendidos y ninguno cubre el caso.** El hook no puede defenderse de que git
no lo invoque: si `core.hooksPath` apunta a otro lado —lo que hacen los worktrees de agente— el
pre-push con gitleaks simplemente no corre, y A4-bis lo probó con un push real contra un remoto bare
local. El control que debía suplirlo es **server-side**, y el 2026-09-22 el operador lo activó:
**secret scanning + push protection**, confirmado por relectura independiente (`"push_protection":
"enabled"`, `"secret_scanning": "enabled"`).

**Ahí habría terminado el análisis si el `PATCH` con código 200 contara como verificación.** Al ir a
leer la configuración en vez de confiar en el 200, apareció
el control —en vez de darlo por bueno porque el `PATCH` devolvió 200— apareció el alcance real:

```
secret_scanning:                        enabled
secret_scanning_push_protection:        enabled
secret_scanning_non_provider_patterns:  DISABLED   ← acá está el hueco
```

`non_provider_patterns` apagado significa que push protection **sólo intercepta el catálogo de
proveedores** (AWS, Stripe, Supabase…). Un `.env` con una password, un token interno entre servicios,
un connection string con credencial: **no los mira**. Y son exactamente los que este repo usa — el
`CLAUDE.md` §Seguridad describe «tokens internos en headers para auth entre servicios».

### El agujero vive en el cruce de dos decisiones correctas

La otra mitad la midió auditoría el mismo día (H-A3-1): `core.hooksPath` está en **ruta absoluta** al
checkout compartido, así que todo worktree de agente ejecuta el pre-push de *ese* árbol —114 commits
atrás— **sin el paso de gitleaks de #601**, aunque #601 esté mergeado. Probado con un push real:
imprimió `[pre-push] ✅ grafo de código sincronizado` y **0** líneas `[secretos]`.

Juntas: **para un secreto propio no hay ninguna capa activa, ni la del servidor ni la local** — y las
dos figuran encendidas, que es la peor forma de estar descubierto. Ninguna de las dos decisiones fue
un error: GitHub deja `non_provider` apagado por defecto porque da falsos positivos, y el
`hooksPath` absoluto lo escribe cada worktree de agente sin que nadie lo elija. El hueco es de la
**junta**, y la junta no tiene dueño — [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].

### Qué la cierra, y por qué son dos palancas y no una

1. **`core.hooksPath` relativo** (H-A3-1) — reactiva gitleaks en todos los worktrees de una. **Sin
   costo de fricción**: es la mitad barata. Dueño: planificación, al levantarse el alto.
2. **`non_provider_patterns`** — cubre la clase propia del lado servidor. Decisión del operador
   (2026-09-22): **se activa al terminar el sprint**, no ahora, porque sus falsos positivos frenarían
   pushes legítimos y *un guard que grita en el caso normal se desarma solo*.

Y el **test adversarial** sigue siendo precondición: un control que nadie ejercitó con un caso hostil
es indistinguible de uno ausente. Diseño acordado con auditoría, en dos pushes, porque con uno solo
el resultado **no atribuye**:

- **Control positivo** — patrón de **proveedor** del catálogo documentado. Debe ser **rechazado**. Si
  pasa, el instrumento está ciego: se para ahí y no se concluye nada sobre el repo.
- **Caso real** — patrón **non-provider**, la forma que motivó esta fila. **Predicción escrita antes
  de correrlo: va a pasar las dos capas.** Si alguna lo frena, el equivocado soy yo.

Requisitos duros del test, que no son detalles: material **sintético** (su modo de falla *publica* en
un repo público, así que jamás una credencial viva ni una de las que pasaron por chat), rama en
**worktree propio** (nunca el checkout compartido, que tiene ~100 archivos editados fuera de toda
rama), y veredicto por **`ls-remote`**, no por el exit code de `git push` — que ya salió 0 sin haber
pusheado.

Ese test es de **auditoría** (su disparador M-3, ya notificado). No arranca hasta que se levante el
alto total.

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
