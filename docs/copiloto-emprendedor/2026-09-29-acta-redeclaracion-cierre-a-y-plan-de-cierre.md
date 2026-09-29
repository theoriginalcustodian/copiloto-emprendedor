# Acta · Re-declaración del Cierre A + plan de cierre de la beta

**Fecha:** 2026-09-29 · **Firma:** Operador (decisión tomada en sesión) · **Redacta:** planificación
**SHA medido:** `2d4b311383e683bfd175b26cf346c37baa25d452` (`origin/main`)
**Reemplaza:** §11.3 de `2026-09-21-plan-implementacion-beta-odobi-autonomo.md`

---

## 1. Por qué existe esta acta

El Cierre A tenía **7 criterios**. El nº5 exigía «APK `preview` (build #2) instalado en el device,
con el barrido `BL-Q3` hecho sobre él», y el 22/09 el operador movió **device/EAS al sprint
siguiente** (`memoria/device-tests-al-final-telefono-limpio.md`).

**Un criterio de cierre que contiene algo declarado fuera de alcance no puede cumplirse nunca.** El
sprint no se estiró por lentitud: se estiró porque su condición de término era inalcanzable por
decisión propia, y cada vuelta terminaba en «está casi todo, menos esto que no se puede tocar». La
fila `SOP7` del tablero ya lo decía con esas palabras desde hace días; nadie sacó la conclusión.

### Lo que la medición NEGÓ, y conviene dejar escrito

| hipótesis que teníamos | qué dijo la medición |
|---|---|
| «se re-trabaja todo tres veces» | **Falso.** 1,51 PRs por ítem; 62 de 87 ids cerraron en un solo PR. |
| «vamos lento» | **Falso.** El 21/09 se mergearon **85 PRs en un día**. |
| «hay 8 ramas con trabajo perdido» | **Falso.** Las 8 son residuo: 44 archivos verificados por contenido en `main`, con canario negativo. |
| «4 ítems del backlog están ciegos» | **Falso.** `BL-P4` y `BL-P7` tienen DoD `[x]` con evidencia; `BL-J1` y `BL-Q5` son parciales conocidos. |

**Lo que la medición sí sostiene:** 4 días consecutivos con **0 commits en cualquier rama** (24–27/09)
· el esfuerzo migró a meta-trabajo (últimos 7 días: `fix`+`docs` = **72 %** de los PRs, `feat` = 19 %;
**10 784 líneas** en `docs/`+`memoria/`+`scripts/` contra **4 431** en `apps/*`+`motor/`) · y el
criterio de cierre inalcanzable de arriba.

---

## 2. El Cierre A re-declarado — 6 criterios, todos medibles hoy

Medido sobre **un mismo SHA** de `main`.

| # | criterio | estado al 29/09 |
|---|---|---|
| 1 | Todos los DEC con acta (§2) | 🟢 **13/13 firmados** por el operador el 21/09. Deuda menor: el acta de `DEC-11` no registra los valores hex ni el par `textoTenue`. |
| 2 | Todos los ítems de §3.1 cerrados con su DoD | 🟠 **abierto.** 62 del backlog + 6 agregados por el plan. Falta el control que mide fila-a-fila contra el EFECTO en `main` (fila `PLANDRIFT`). |
| 3 | Matriz re-medida: ✅ en web **y** mobile para toda pantalla **spec** de `BL-P5` | 🟠 **abierto.** 29 de **54** ids. Decisión del operador (29/09): **(a′) reabrir auditoría y republicar los 54** sobre el SHA actual. |
| 4 | `smoke_beta_e2e.py` verde contra prod y `BL-B1` verde sobre el último deploy | 🟠 **abierto.** El instrumento **existe** (`deploy/copiloto/smoke_beta_e2e.py`, corre en el VPS); falta la corrida sobre este SHA. |
| ~~5~~ | ~~APK `preview` build #2 en el device + barrido `BL-Q3`~~ | ⚫ **SALE del Cierre A.** Pasa a ser **criterio de ENTRADA del sprint siguiente**, no de salida de éste. |
| 6 | `git ls-files` de `*.otf` vacío · gitleaks verde sobre `HEAD` | 🟢 **cumplido.** 0 `.otf` en `main`; gitleaks corrió en el `pre-push` de hoy sobre esta rama: `no leaks found`. |
| 7 | Runbook de Cierre B (§13) en `main`, con cada interruptor listo | 🟢 **en `main`** (§13.1 Interruptores). Deuda: §13.2 nombra el token de 60fps.design que el operador **retiró de la cola el 29/09** — hay que actualizar ese renglón. |

**Binario:** el Cierre A cierra cuando 2, 3 y 4 estén en verde sobre un mismo SHA. Nada más entra.

---

## 3. Fuera de alcance, por decisión del 29/09

| qué | decisión | dónde va |
|---|---|---|
| **Device / EAS / APK** | diferido (22/09, reafirmado hoy) | criterio de entrada del sprint siguiente |
| **`BL-O4` observabilidad** | **sale del sprint.** Backend midió que el gap es mayor que su DoD: el backend **no expone `/metrics`** y el stack de `fleet-platform` nunca se desplegó en el VPS. El DoD suponía «prender alertas». | sprint siguiente, con el alcance **real** escrito: instrumentar → desplegar → alertar |
| **Token de 60fps.design** | retirado de la cola por el operador | lo maneja él, fuera de toda sesión |

El **fix de raíz que backend ya hizo en `fleet-platform`** (`inject_alert_receiver()` appendeaba el
receiver *después* de `inhibit_rules:`, con lo que `route.receiver` apuntaba a un nombre inexistente
— el mecanismo de alertas **nunca se había ejercitado end-to-end en ningún consumidor**) **se mergea
igual**: es valor para toda la flota y no depende de este sprint.

---

## 4. La cola, ordenada — 3 bloques, y sólo el primero lo ve un tester

### Bloque 1 · «La beta funciona» — 4 defectos de producto

| id | qué | dueño |
|---|---|---|
| `FACTINT` | facturar desde presupuesto **cae** con `int()` sobre `None` — función caída | backend |
| `FHMONTO` | el monto de `fact-hitl` no coincide con lo pedido | backend |
| `AGCAID` | «Ver agenda» se muestra con Calendar caído | FE1 |
| `APPSM` | `AppsScreen`: código muerto en desktop | FE1 |

**Cierra cuando:** los 4 en `main` + deploy + `smoke_beta_e2e.py` verde contra prod (que es también
el criterio 4). **Nada más entra a este bloque** — cero instrumentos nuevos, cero entradas de memoria.

### Bloque 2 · «El Cierre A se puede firmar» — criterios 2 y 3

- **Criterio 3:** auditoría republica los **54** ids sobre el SHA actual (decisión (a′)).
- **Criterio 2:** construir el control de `PLANDRIFT` — cada fila `pendiente` se mide contra
  `git cat-file -e origin/main:<artefacto>`, **no** contra un número de PR. Esto ya está escrito como
  DoD y sin construir; es lo que dejó 6 filas mintiendo el 28/09.
- Cerrar la deuda del acta `DEC-11` (hex + `textoTenue`) y actualizar §13.2 del runbook.

### Bloque 3 · Higiene — barato, paralelizable, sin bloquear a nadie

`CIVERDE2` (hecho, PR #710) · `PROTOCOM` (4 hallazgos P-1..P-4 de auditoría) · `DOCANC` · `COCHANGE`
· `REFSAUS` · los 3 worktrees **sucios** con trabajo sin commitear (`b6-ctl-fe1`, `wt-plan2`,
`wt-seed-midia`) · los 8 worktrees que el podador conserva y que un barrido por contenido da por
residuo — **discrepancia entre dos instrumentos, se resuelve antes de borrarlos**.

---

## 5. Las 4 reglas de proceso que salen de la medición

1. **Separar «la beta funciona» de «el sprint cierra».** Son dos cosas y confundirlas fue la causa
   raíz de esta acta.
2. **Techo de meta-trabajo:** por cada PR de `docs/`+`memoria/`+`scripts/`, uno de `apps/`+`motor/`.
   Hoy la razón es **2,4 a 1 en contra del producto**.
3. **Un espacio de numeración.** `K-NN`, `H-A*-N` y `DEC-N` se mapean a `BL-*` o se retiran: **53 de
   66** ítems del backlog citan otro espacio, y por eso todo conteo de avance sale mal.
4. **Cierre por EFECTO.** Ninguna fila cambia de estado por lo que alguien reporta, sino por
   `git cat-file -e origin/main:<artefacto>` — con `git fetch` previo, porque sin él se interroga la
   copia local y no el remoto.

---

## 6. Higiene aplicada hoy (evidencia, no promesa)

- **Worktrees: 34 → 17**, contado con `git worktree list`. Los 3 **sucios** se conservaron: tienen
  trabajo que no está en ninguna rama.
- **`podar-worktrees.sh` estaba ciego:** su filtro miraba un path fijo (`.claude/worktrees/`) mientras
  las 4 sesiones trabajan en `C:/gfw-src/`. De 34 worktrees clasificaba **2** e imprimía «0 sucios».
  Ahora la base es parámetro y el resumen declara **siempre** cuántos entraron al análisis. PR #710.
- **`ci-verde.sh`:** el rollup ilegible salía por `exit 1`, indistinguible de un CI en rojo. Ahora
  sale por `2` («no pude medir»), con el caso 5 en su test. Mismo PR.
