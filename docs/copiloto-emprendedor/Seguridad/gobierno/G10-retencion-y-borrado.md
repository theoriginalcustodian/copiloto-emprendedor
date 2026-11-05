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

**Borrado de tenant:** no existe; es la BRECHA SEC-D8 y el primer entregable de su ficha (orden propuesto: revocar Composio → borrar Graphity → borrar filas por `cliente_id` → baja GoTrue → esperar rotación de backups).
