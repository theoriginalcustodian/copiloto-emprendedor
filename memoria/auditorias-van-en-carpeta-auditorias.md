---
name: auditorias-van-en-carpeta-auditorias
description: REGLA (operador 2026-08-06) — TODO lo relacionado con auditorías se guarda en docs/copiloto-emprendedor/Auditorias/, nunca suelto en docs/
metadata:
  type: project
---

**Regla del operador (2026-08-06):** todo documento de auditoría vive en
**`docs/copiloto-emprendedor/Auditorias/`** — nunca suelto en `docs/copiloto-emprendedor/`.

Cubre: el loop Fable (`eval-fable5-*`, handoffs de auditoría), los mapas de clases de error, las
re-verificaciones contra código pusheado, mapas de superficie, y cualquier auditoría futura (seguridad,
perf, resiliencia). Al generar un doc de auditoría nuevo → crearlo directamente ahí y sumarlo al
`Auditorias/README.md` (índice + estado vigente).

- Asentado también en `CLAUDE.md` (§1 árbol + §5 referencias) para que esté siempre en contexto.
- Doc maestro vigente: `Auditorias/2026-08-04-listado-problemas-fixes-reverificado.md`.
- El loop reutilizable de 4 fases: [[loop-auditoria-fable-analisis-opus-contratos-e2e]].
- El hito de re-verificación 2026-08-04: [[reverificacion-auditoria-fable-2026-08-04]].
