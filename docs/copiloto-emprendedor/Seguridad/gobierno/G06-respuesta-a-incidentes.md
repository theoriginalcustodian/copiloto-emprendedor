# G6 — Runbook de respuesta a incidentes
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

| Sev | Ejemplo | Responde | Plazo |
|---|---|---|---|
| S1 | acceso cross-tenant confirmado, fuga de secreto, caída total | operador + sesión backend | contener < 1 h |
| S2 | degradación, error sostenido en DLQ | sesión de guardia | < 1 día |
| S3 | hallazgo sin explotación | ronda de auditoría | siguiente ciclo |

**Detección:** autosanación, DLQ, smoke, alertas de gitleaks/Dependabot.
**Contención:** *secreto filtrado* → revocar y rotar en el proveedor primero, después purgar del repo y registrar; *cross-tenant* → desactivar la ruta y revisar RLS/logs; *caída* → rollback con `deploy.sh` y restore desde backup.
**Notificación a titulares y proveedores:** decide el operador; **[PENDIENTE: plazos legales aplicables (Ley 25.326 y contratos)]**.
**Cierre:** post-mortem corto con causa raíz y el test que habría cazado el defecto.
