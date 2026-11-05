# G2 — Registro de riesgos
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

Escala A/M/B (probabilidad, impacto). Dueño de todos: operador. Se revisa en cada ronda de auditoría.

| Riesgo | Activo | P | I | Control | Estado |
|---|---|---|---|---|---|
| Acceso cross-tenant (BOLA) | datos de emprendedores | B | A | RLS FORCE + 42 tests adversariales + `require_tenant` | Mitigado; 40 rutas con prueba profunda pendiente |
| Pérdida del VPS sin copia externa | DB locales, Temporal | M | A | backup local diario | **Abierto** (SEC-D1) |
| Fuga de secreto por repo público | credenciales | M | A | gitleaks + regla bearer + push protection | Mitigado; token 60fps aceptado |
| Ejecución de código en el proceso web (root) | VPS | B | A | sandbox systemd 3.9, sin capabilities | Parcial (SEC-D6) |
| CVE en dependencias | auth/cripto | M | M | Dependabot ON, bump Python verificado | npm pendiente (SEC-D11) |
| Datos fiscales (CUIT) en logs | contribuyentes | A | M | filtro `log_redact` + retención 30 d | Cerrado, medido |
| Sin mecanismo de supresión/portabilidad | titulares | M | M | — | **Mitigado** (SEC-D8, 2026-11-05; residual: backups locales hasta su rotación) |
| Tráfico app→DB sin TLS (red privada) | DB fusion | B | M | red privada Hetzner | Abierto (SEC-D2) |
| Registro abierto sin MFA/rate-limit | cuentas | M | B | RLS limita el daño | Decisión (SEC-D3) |
| Fuentes comerciales en historia pública | licencias | B | B | decisión de dejarlo (2026-10-12) | Aceptado |
