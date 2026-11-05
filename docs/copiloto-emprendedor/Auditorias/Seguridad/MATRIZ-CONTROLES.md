# MATRIZ-CONTROLES — control × marco × estado medido (corte 2026-11-05 @ff5fb289)

> Estado: `OK` (medido por efecto) · `PARCIAL` · `BRECHA` · `DECISIÓN` (en `DECISIONES-OPERADOR.md`).
> Un `OK` cita su evidencia; sin evidencia no hay `OK`. Los marcos son **referencia de mapeo**, no certificación.

| Control | SOC 2 | ISO 27001:2022 | ISO 27701 | Estado | Evidencia / hallazgo |
|---|---|---|---|---|---|
| Aislamiento multi-tenant (RLS + test adversarial por ruta) | CC6.1 | 8.3, 5.15 | 7.2.6 | **PARCIAL** | 42/42 rutas con test; 40 cortan en 422 antes de datos → ficha SM-S. `mp_link_dedup` FORCE RLS (SEC-A2-2) |
| Acceso remoto (SSH sólo llaves, fail2ban) | CC6.1, CC6.6 | 8.5, 8.20 | — | OK | sshd drop-in; SEC-A1-2 |
| Segmentación de red (ufw + DOCKER-USER) | CC6.6 | 8.20, 8.22 | — | OK | puertos 3000/8090/55444 cerrados (TCP connect); SEC-A1-1 |
| Privilegio mínimo de procesos | CC6.3 | 8.2, 8.18 | — | PARCIAL | sandbox 9.6→3.9; sigue root (SEC-D6) |
| Cabeceras de seguridad / superficie HTTP | CC6.6 | 8.9, 8.26 | — | OK | HSTS/CSP/XFO…, `/docs` 404; SEC-C2-1, C3-1 |
| Gestión de secretos | CC6.1 | 5.17, 8.24 | — | OK | `/etc/unreal-copilot` 700, `.env` 600; gitleaks + regla bearer; SEC-C11-1, C6-1 |
| Parches de SO | CC7.1 | 8.8 | — | OK | apt + reboot, kernel 6.8.0-147; SEC-B1-1 |
| Parches de dependencias | CC7.1 | 8.8 | — | PARCIAL | bump Python verificado (smoke 43/43); npm pendiente (SEC-D11); Dependabot ON |
| Logging sin datos personales | CC7.2 | 8.15 | 7.4.5 | OK | CUIT enmascarado (`GET …cuit=***` por efecto, 0 CUIT reales); SEC-C5-1 |
| Retención de logs | CC7.2 | 8.15 | 7.4.7 | OK | journald 500M/30d, 315M medidos; SEC-C5-2 |
| Backups y restore | A1.2, A1.3 | 8.13, 5.30 | — | **PARCIAL** | local diario, restore GoTrue 28/28; sin off-site (SEC-D1) |
| Cifrado en tránsito app→DB | CC6.7 | 8.24 | — | DECISIÓN | SEC-D2 |
| Autenticación de usuarios | CC6.1 | 5.17 | — | DECISIÓN | SEC-D3 (signup abierto, sin MFA) |
| Borrado / exportación por titular | P5, P6 | — | 7.3.2, 7.3.6 | **Implementado y medido en prod** | SEC-C8-1 (SEC-D8) · residual: backups |
| Inventario de terceros / subprocesadores | CC9.2 | 5.19–5.22 | 7.2.8 | PARCIAL | borrador G3/G8 con data map de C8 (sin DPA verificados) |
| Gestión de cambios (PR + CI propio + recibos) | CC8.1 | 8.32 | — | OK | ADR-001, `gate.sh`, ruleset `main-exige-pull-request` |
| Detección de vulnerabilidades en CI | CC7.1 | 8.8 | — | PARCIAL | gitleaks + secret scanning; pip-audit/npm audit aún no en `lint.sh` |
| Respuesta a incidentes | CC7.3–7.5 | 5.24–5.26 | 6.13.1 | PARCIAL | autosanación/DLQ existen; runbook G6 en BORRADOR |
| Gobierno documental | CC1–CC5 | 5.1, 5.2, 6.1 | 6.2 | PARCIAL | G1–G12 en BORRADOR, pendientes de aprobación |
