# G7 — Plan de continuidad y restore
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

- **Qué se respalda:** Postgres de GoTrue y de Temporal (`uc-backup-local.timer`, 03:30 UTC, `pg_dump -Fc`, `/var/backups/uc`, 7 días). La DB de negocio vive en fusion; su respaldo no está verificado desde acá.
- **Prueba de restore:** 2026-11-05, GoTrue restaurada en contenedor efímero, 28/28 verificaciones. Repetir trimestralmente y registrar la fecha.
- **RPO/RTO hoy:** RPO 24 h; RTO ≈ 2 h mientras el VPS exista. **Sin copia off-site** (SEC-D1): si el VPS se pierde, el RPO real es indefinido.
- **Rollback de despliegue:** `deploy.sh` idempotente + backups de units y Caddyfile en `/root/aud-*`.
