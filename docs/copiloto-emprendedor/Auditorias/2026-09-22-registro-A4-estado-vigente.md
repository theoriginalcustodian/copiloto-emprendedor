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
| H-A4-1 | **alta** | Pre-push con gitleaks inactivo si `core.hooksPath` está desviado (worktrees de agente). Repo **público**. | 🔴 **ABIERTA — sin red para el secreto PROPIO** | 2026-09-22: se activaron secret scanning + push protection (`enabled` los dos, releídos). **No alcanza**: `secret_scanning_non_provider_patterns` está `disabled` → el servidor sólo intercepta **catálogo de proveedores**, no un `.env` ni un token interno. La capa **local** cambió de estado el mismo día y conviene no arrastrar el diagnóstico viejo: `core.hooksPath` vale hoy `.githooks` — **relativa** (remedido post-reboot) — y #649 le puso a `gate.sh` un check **fail-closed** que marca TODOS los jobs `failed` si deja de serlo. Sigue abierta por la mitad **server-side**. Ver «Lo que falta» |
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

1. **`core.hooksPath` relativo** (H-A3-1) — **ya no está pendiente, y el que la cerró no fue el
   valor sino el detector.** Remedido el 2026-09-22 post-reboot, con control positivo
   (`git -C <path inexistente>` debe fallar):

   ```
   git config --show-origin --get core.hooksPath
     file:.git/config    .githooks        ← relativa, y lo mismo en los 6 worktrees de agente
   git show "origin/main:.githooks/pre-push" | grep -n secretos-check
     15: ... bash "$SCRIPT_DIR/scripts/secretos-check.sh" --refs-stdin || {
   ```

   Con ruta **relativa** cada worktree corre **su propio** pre-push, así que la capa local está
   **armada** en una rama en/después de #601 y **apagada** en una de base vieja — el checkout
   compartido es el segundo caso (**cero** líneas `secretos-check` en su `.githooks/pre-push`), y eso
   es por su árbol viejo, no por un hook desviado. El push real de A3 con **0** líneas `[secretos]`
   sigue siendo un hecho; lo que cambia es a qué se atribuye.

   Lo durable no es el valor — que nadie versiona y que se vuelve a torcer solo — sino que #649 le
   puso a `gate.sh` un check **fail-closed**: si `core.hooksPath != .githooks`, marca **todos** los
   jobs `failed` y escribe un recibo ROJO. Su propio comentario lo dice mejor que yo: *«un fix sin
   control fail-closed no es un fix, es una reincidencia programada»* — y lo escribió porque
   H-A3-1 se había arreglado a mano y **se reabrió en menos de 24 h**. El mecanismo que la tuerce
   (Claude Code escribiéndola al crear un worktree de agente) sigue activo; lo que ya no es, es
   **silencioso**. [[el-guard-que-caza-a-su-propio-autor]]

   ⚠️ Y el instrumento: mi primer `grep -c` sobre `origin/main:.githooks/pre-push` dio **0** y era
   mentira — Git Bash mangló el path (`origin\main;.githooks\pre-push`, fatal) y `grep -c` contó las
   cero líneas del error. Con `MSYS_NO_PATHCONV=1` aparecen las dos.
   [[git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos]]
2. **`non_provider_patterns`** — cubre la clase propia del lado servidor. Decisión del operador
   (2026-09-22): **se activa al terminar el sprint**, no ahora, porque sus falsos positivos frenarían
   pushes legítimos y *un guard que grita en el caso normal se desarma solo*.

Y el **test adversarial** sigue siendo precondición: un control que nadie ejercitó con un caso hostil
es indistinguible de uno ausente. El diseño pasó de **dos pushes a tres** justamente por la medición
de arriba: con la capa local **armada** en un worktree al día, un «fue rechazado» no dice **quién** lo
rechazó — dos causas suficientes y el resultado no atribuye
([[dos-causas-suficientes-el-test-no-atribuye]]):

- **Control positivo** — patrón de **proveedor** del catálogo, worktree **al día**. Debe ser
  **rechazado**. Si pasa, el instrumento está ciego: se para ahí y no se concluye nada sobre el repo.
- **Caso real, worktree al día** — patrón **non-provider**. Predicción: **lo frena el hook local**,
  no el servidor. Eso NO cierra esta fila: prueba la capa que ya sabemos armada.
- **Caso real, worktree de BASE VIEJA** (pre-push sin `secretos-check`) — la única capa que queda es
  la del servidor, con `non_provider_patterns` apagado. **Predicción escrita antes de correrlo: pasa.**
  Ése es el push que ejercita de verdad la fila. Si alguna capa lo frena, el equivocado soy yo.

Requisitos duros del test, que no son detalles: material **sintético** (su modo de falla *publica* en
un repo público, así que jamás una credencial viva ni una de las que pasaron por chat), rama en
**worktree propio** (nunca el checkout compartido, que tiene ~100 archivos editados fuera de toda
rama), y veredicto por **`ls-remote`**, no por el exit code de `git push` — que ya salió 0 sin haber
pusheado.

Ese test es de **auditoría** (su disparador M-3). El alto total se levantó el 2026-09-22 tras el
reinicio de la PC y auditoría tiene el **verde explícito**, con el diseño de tres pushes de arriba.

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
