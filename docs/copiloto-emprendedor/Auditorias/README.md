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
| 2026-08-06 | `2026-08-06-plan-de-implementacion.md` | **Plan accionable vigente:** los 11 ítems con qué/por qué/fix/ubicación/esfuerzo + estado de ejecución |

## Estado vigente
El documento maestro es **`2026-08-04-listado-problemas-fixes-reverificado.md`**: 11 problemas (2 resueltos,
3 parciales, 6 vivos), fix de raíz por cada uno, 3 decisiones del operador fijadas, y orden de ejecución.
Memoria del hito: `memoria/reverificacion-auditoria-fable-2026-08-04.md`.
