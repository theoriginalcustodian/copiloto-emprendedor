# G4 — Procedimiento de gestión de accesos
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

- **Admin de aplicación:** alta/baja con `asignar-claim-admin.sh`; se registra en BITACORA.
- **SSH:** sólo llaves (`sshd-00-hardening.conf`); alta/baja editando `authorized_keys` de root y registrando huella. Medido 2026-11-05: 2 llaves en `root` y 1 en el usuario `kaggle-tunnel` (túnel de la fábrica; revisar si sigue en uso al hacer la revisión trimestral).
- **Tokens de terceros:** viven en `/etc/unreal-copilot/*.env` (600 root); rotación al pasar a producción; ninguno en el repo.
- **GitHub:** colaboradores con `write` listados en SEC-A5-2 (1 hoy); el ruleset exige PR.
- **Revisión trimestral:** correr `scripts/auditoria-seguridad/collect-vps.sh`, comparar A1–A4 con la corrida anterior y registrar el resultado en BITACORA.
- **Baja inmediata:** ante la salida de una persona, revocar llave SSH y acceso GitHub el mismo día.
