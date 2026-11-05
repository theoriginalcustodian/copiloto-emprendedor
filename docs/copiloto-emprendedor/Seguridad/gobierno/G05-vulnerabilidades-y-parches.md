# G5 — Política de vulnerabilidades y parches
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

- **Detección:** Dependabot alerts + security updates (activos desde 2026-11-04); `pip-audit` y `npm audit` a incorporar a `scripts/ci/lint.sh`.
- **Plazos:** CVE crítico/explotable 72 h; alto 14 d; resto en el bump mensual.
- **SO:** `unattended-upgrades` activo; reinicio coordinado cuando exista `reboot-required`.
- **pyjwt/cryptography:** no se bumpean sin test adversarial de auth corriendo después, rollback escrito y smoke + durabilidad posteriores.
- **Aprobación:** lo táctico lo ejecuta la sesión con evidencia; majors y bumps de nativo (expo) los aprueba el operador.
- **Registro:** cada bump en BITACORA con rollback.
