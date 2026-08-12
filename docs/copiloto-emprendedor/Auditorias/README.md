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
| 2026-08-12 | `2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md` | **Plan vigente:** estrategia de las 3 pasadas hacia producción — inventario, orden y decisiones del operador |
| 2026-08-12 | `2026-08-12-pasada-0-triaje-y-capas-de-CI.md` | Pasada 0 — triaje de los 9 hallazgos abiertos + capas de seguridad en el CI |
| 2026-08-12 | `2026-08-12-pasada-1-seguridad.md` | Pasada 1 — seguridad (`/claude-security`, scope backend), mapa BOLA de los ~30 endpoints con ID en ruta |
| 2026-08-12 | `2026-08-12-pasada-2-robustez.md` | Pasada 2 — robustez: lo que rompe con datos reales, concurrencia y fallos parciales |
| 2026-08-12 | `2026-08-12-pasada-3-pulido-y-eficiencia.md` | Pasada 3 — pulido y eficiencia (va última: es la que muta el código) |

> ⚠️ **Corrección 2026-08-12.** Este índice listaba `2026-08-06-plan-de-implementacion.md` como "plan
> accionable vigente". **Ese archivo nunca existió en `main`**: se escribió en el checkout compartido
> (325 commits detrás) y no llegó a ninguna rama. La entrada se retira. El seguimiento de los 11
> problemas lo retoma la Pasada 0. Failure mode registrado en
> `memoria/el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama.md`.

## Estado vigente

**Plan activo:** las 3 pasadas de auditoría hacia producción →
`2026-08-12-ESTRATEGIA-tres-pasadas-de-auditoria.md`. Estado: **planificado, sin ejecutar**
(decisión del operador 2026-08-12: primero se documenta el plan completo, después se ejecuta).

**Deuda que arrastra:** `2026-08-04-listado-problemas-fixes-reverificado.md` — 11 problemas
(2 resueltos, 3 parciales, 6 vivos) cuyo estado real contra `main` de hoy **no está re-verificado**;
ese triaje es la Pasada 0. Memoria del hito: `memoria/reverificacion-auditoria-fable-2026-08-04.md`.
