# G10 — Política de retención y borrado
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

| Sink | Retención | Borrado |
|---|---|---|
| Logs (journald) | 30 d / 500 MB (medido) | automático |
| Backups locales | 7 d | automático |
| Postgres negocio (por tenant) | mientras la cuenta exista | **sin procedimiento** |
| GoTrue | mientras exista la cuenta | **sin función de baja en la app** |
| Graphity | indefinida | **sin borrado por tenant** |
| Composio connections | indefinida | **sin revocación en el código** |

**Borrado de tenant:** implementado (SEC-D8, #1696): suspender → Schedules/workflows → revocar Composio → borrar Graphity → borrar filas por `cliente_id` (`tenants` al final) → baja GoTrue → recibo de conteos en la auditoría. **Se retienen** `afip_comprobantes` (fiscal), `copiloto_auditoria` (append-only) y `copiloto_metering`. **Backups:** la supresión se completa cuando rota el último pg_dump con datos del tenant; la retención medida de `uc-backup-local` es de 7 días (`UC_BACKUP_RETENCION_DIAS`), así que la supresión queda completa en ≤7 días. El off-site futuro (SEC-D1) deberá heredar un tope igual o menor.
