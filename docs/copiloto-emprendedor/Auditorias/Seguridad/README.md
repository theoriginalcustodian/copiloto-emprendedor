# Auditorías de seguridad — hardening SOC 2 · ISO 27001 · ISO 27701

> Subcarpeta de [`../`](../README.md) (la carpeta canónica de auditorías). Acá vive **todo** lo de la ronda de
> hardening pedida por el operador el 2026-11-04: plan, recolectores (evidencia), hallazgos, matriz de
> controles, decisiones y cierre. Los recolectores en sí viven en `scripts/auditoria-seguridad/`.

## Índice

| Fecha | Documento | Fase | Qué es |
|---|---|---|---|
| 2026-11-04 | [`2026-11-04-PLAN-auditoria-hardening-soc2-iso27001-iso27701.md`](2026-11-04-PLAN-auditoria-hardening-soc2-iso27001-iso27701.md) | F0 | **El plan:** 3 ejes (permisos · actualizaciones · exposición) en 11 frentes, 4 fases, DoD binario, matriz control→marcos, gaps de proceso, 10 observaciones-semilla @ `0212ba19` |

Los entregables de F1–F4 (`BITACORA.md`, `HALLAZGOS.md`, `MATRIZ-CONTROLES.md`, `DECISIONES-OPERADOR.md`,
`INFORME-DE-CIERRE.md`, `evidencia/<fecha>/`) se agregan a esta tabla cuando existen — no antes.

## Antecedentes en la carpeta madre

- [Pasada 1 — Seguridad (2026-08-12)](../2026-08-12-pasada-1-seguridad-HALLAZGOS.md): BOLA en 33 endpoints, 0 P0.
- [G8 — cierre de aquella ronda](../2026-08-12-G8-INFORME-DE-CIERRE-de-la-ronda.md) y [DEUDA viva](../2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md).
- [M-3 capa local de secretos](../2026-09-22-M-3-capa-local-secretos-test-adversarial.md) · [el escáner que cazaba la forma genérica](../2026-10-06-el-escaner-de-secretos-caza-la-forma-generica-y-falla-en-la-real.md).
