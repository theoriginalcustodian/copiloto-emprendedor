# G12 — Gestión de cambios
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

Se documenta lo que existe: rama + PR (sin push a `main`, ruleset `main-exige-pull-request`); Conventional Commits; gate propio `scripts/gate.sh` (core/web/mobile/lint/backend) con recibo `.ci-recibos/<sha>.json` y CI de GitHub como atestación; ADRs en `docs/copiloto-emprendedor/adr/` (ADR-001); deploy idempotente con smoke (43 checks) y prueba de durabilidad antes de declarar; rollback escrito por cambio en la BITACORA de seguridad.
