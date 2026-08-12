# Auditorías — Copiloto del Emprendedor

> **Carpeta canónica de TODO lo relacionado con auditorías** (decisión del operador, 2026-08-06).
> Cualquier auditoría nueva —externa (Fable), de clases de error, de seguridad, de re-verificación,
> handoffs de auditoría, mapas de superficie— se guarda **acá**, no suelta en `docs/copiloto-emprendedor/`.

## El loop de auditoría (cómo se trabaja)
`Fable 5 zero-context AUDITA` → `Opus ANALIZA + DISEÑA fixes de raíz + CONTRATA` → `backend/frontend IMPLEMENTAN + E2E device`.
Detalle: `memoria/loop-auditoria-fable-analisis-opus-contratos-e2e.md`.

## Índice

| Fecha | Documento | Qué es |
|---|---|---|
| 2026-07-23 | `2026-07-23-eval-fable5-global.md` | 1ª pasada de Fable (zero-context, report-only) — 7 hallazgos + menores |
| 2026-07-23 | `2026-07-23-HANDOFF-procesar-auditoria-fable.md` | Handoff Fase 2 del loop (analizar + diseñar + contratar) |
| 2026-07-23 | `2026-07-23-HANDOFF-consultar-el-grafo-de-codigo.md` | Cómo consultar el grafo de código (MCP graphity-code) para auditar |
| 2026-07-23 | `2026-07-23-mapa-clases-error-insumo-fable-v2.md` | Mapa de 9 clases de error + 5 dimensiones (barrido de instancias) |
| 2026-07-23 | `2026-07-23-eval-fable5-v2-dirigida.md` | 2ª pasada de Fable dirigida por el mapa (confirma/refuta/rankea) |
| 2026-08-04 | `2026-08-04-listado-problemas-fixes-reverificado.md` | **Listado maestro:** 11 problemas re-verificados vs código pusheado + fix de raíz + decisiones del operador |
| 2026-08-06 | `2026-08-06-plan-de-implementacion.md` | **Plan accionable:** los 11 ítems con qué/por qué/fix/ubicación/esfuerzo + estado de ejecución |
| 2026-08-12 | `2026-08-12-reverificacion-beta.md` | **Re-verificación pre-beta (VIGENTE):** los 11 vs `main @ debe5623` tras el sprint de beta — 0 cerrados, C2/C3 mejoraron a parcial, **C4.1 bloqueante de beta** |
| 2026-08-12 | `2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md` | **Plan de auditoría vigente:** las 3 pasadas hacia producción — superficie medida, orden y decisiones del operador |
| 2026-08-12 | `2026-08-12-pasada-0-triaje-y-capas-de-CI.md` | Pasada 0 — Parte A (triaje) **ya cubierta** por la re-verificación; queda la Parte B: capas de seguridad en el CI |
| 2026-08-12 | `2026-08-12-pasada-1-seguridad.md` | Pasada 1 — seguridad (`/claude-security`, scope backend), mapa BOLA de los ~30 endpoints con ID en ruta |
| 2026-08-12 | `2026-08-12-pasada-2-robustez.md` | Pasada 2 — robustez: lo que rompe con datos reales, concurrencia y fallos parciales |
| 2026-08-12 | `2026-08-12-pasada-3-pulido-y-eficiencia.md` | Pasada 3 — pulido y eficiencia (va última: es la que muta el código) |
| 2026-08-12 | `2026-08-12-DoD-cierre-auditorias-y-fixes.md` | **🎯 NORMATIVO:** criterio binario de "terminado" para auditorías **+ fixes + e2e**, reparto por sesión y reglas de autonomía sin operador. Los contratos del buzón lo citan. |
| 2026-08-12 | `2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md` | **📌 VIVO:** las 9 filas diferidas de la ronda, cada una con dueño y fecha + lo que se descartó y no vuelve a auditarse. Los contratos se archivan a los 90 min; esto no. |
| 2026-08-12 | `2026-08-12-pasada-1-seguridad-HALLAZGOS.md` | **Hallazgos Pasada 1:** 0 P0 · 1 P1 · 4 P2 + mapa BOLA de los 33 endpoints (control positivo) |
| 2026-08-12 | `2026-08-12-pasada-2-robustez-HALLAZGOS.md` | **Hallazgos Pasada 2:** 0 P0 · 4 P1 · 3 P2 + evidencia de que el moat Temporal está bien construido |
| 2026-08-12 | `2026-08-12-pasada-3-pulido-y-eficiencia-HALLAZGOS.md` | **Hallazgos Pasada 3:** 0 P0 · 0 P1 · 3 P2 · 1 P3 — casi todo control positivo |
| 2026-08-12 | `2026-08-12-G8-INFORME-DE-CIERRE-de-la-ronda.md` | **🏁 EMPEZAR POR ACÁ:** informe de cierre (G8) que consolida las 3 pasadas + el estado final de los 11 + los nuevos. Sustituye a leer los 19 archivos sueltos |

## Estado vigente

**🏁 Empezá por `2026-08-12-G8-INFORME-DE-CIERRE-de-la-ronda.md`** — consolida todo lo de abajo. Lo
que sigue queda como referencia histórica del camino, no como punto de entrada.

**Resultado de la ronda (2026-08-12): 0 P0 nuevos en las tres pasadas.** Lo más grave del ciclo
—C4.1, el alta abierta— **no fue un hallazgo nuevo: era una fila del backlog marcada ⚠️ PARCIAL desde
el 2026-08-04**. El riesgo no estaba escondido, estaba registrado y sin dueño. **C4.1 y C6 quedaron
cerrados y verificados**; el resto de los 11 está repartido en los lotes B/C (backend) o en el
registro de deuda con dueño y fecha. **5 de los 8 gates del DoD cerrados**; los 3 abiertos
(G2/G3/G8) dependen del mismo disparador: que backend mergee los lotes B y C.

**Diagnóstico previo (histórico):** `2026-08-12-reverificacion-beta.md` (re-verificación pre-beta tras ~325 commits):
**3 resueltos, 3 parciales, 6 vivos, 1 bajo.** El sprint de beta no cerró ningún ítem del backlog; C2 y C3
mejoraron a parcial. El listado maestro con el
detalle de fixes de raíz sigue siendo `2026-08-04-listado-problemas-fixes-reverificado.md`; el plan accionable,
`2026-08-06-plan-de-implementacion.md`. Memorias: `memoria/reverificacion-auditoria-fable-2026-08-04.md`.

**Plan de auditoría:** `2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md` — 3 pasadas hacia
producción (seguridad · robustez · pulido). **✅ EJECUTADAS las tres el 2026-08-12**, cada una con su
informe `*-HALLAZGOS.md`. Tomó la re-verificación de arriba como insumo: los 6 vivos tenían pasada
destino asignada y no se re-descubrieron.
