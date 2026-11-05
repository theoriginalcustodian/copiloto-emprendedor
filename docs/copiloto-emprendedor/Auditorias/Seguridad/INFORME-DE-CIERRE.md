# INFORME DE CIERRE — hardening SOC 2 / ISO 27001 / ISO 27701 (2026-11-04/05)

> Re-medición F4 con los MISMOS recolectores, evidencia en `evidencia/2026-11-05-f4/`. Corte @7c216319.
> Los marcos son referencia de mapeo, no certificación. G1–G12 siguen en BORRADOR hasta que el operador los apruebe.

## Diferencia antes → después (medido)
| Hallazgo | Antes | Después (F4) |
|---|---|---|
| SEC-A1-1 puertos | ufw inactivo; 3000/8090/55444 alcanzables | ufw activo; 3000/8090/55444 cerrados por TCP connect externo (8090 y 3000 aún escuchan en el host, filtrados) |
| SEC-A1-2 sshd | password sí, X11, MaxAuthTries 6 | `passwordauthentication no`, `x11forwarding no`, `maxauthtries 3`, keepalive 300 |
| SEC-A1-3 sandbox | 9.6 UNSAFE ×3 | 3.9 OK ×3 (sigue root: SEC-D6) |
| SEC-B1-1 SO | 125 pkgs, kernel 6.8.0-52 | kernel 6.8.0-147, sin reboot pendiente, 2 líneas pendientes |
| SEC-B1-2 Python | 27 vulns en 6 paquetes | `pip-audit -r requirements.txt`: 50 deps, 0 vulnerables |
| SEC-C2-1 / C3-1 cabeceras y `/docs` | ninguna cabecera; `/docs` público | HSTS, CSP, XFO, nosniff, Referrer, Permissions; `/docs` y `/openapi.json` 404 |
| SEC-A2-2 RLS | 4 tablas sin cobertura | `mp_link_dedup` FORCE + policy; ratchet 42→0; resta `tasks` (app ajena, SEC-D9) |
| SEC-C5-1 CUIT en logs | 20 líneas/24 h | 0 con CUIT real; `cuit=***` observado en el journal tras el deploy |
| SEC-C10-1 backups | ninguno | diario local + restore GoTrue 28/28 (sin off-site: SEC-D1) |
| SEC-A5-1 Dependabot | desactivado | activo |
| SEC-B1-3 npm | 3 críticas/15 altas | **sin cambio** (SEC-D11, MAYOR: toca nativo) |

## Estado de producción tras los cambios
Smoke 43/43 y durabilidad VERDE sobre `ff5fb289`. PRs: #1669, #1671, #1673, #1674, #1675.

## Abierto (todo en DECISIONES-OPERADOR.md)
SEC-D1 off-site · SEC-D2 TLS Postgres de fusion · SEC-D3 signup/MFA · SEC-D6 usuario no-root · SEC-D8 borrado/exportación por tenant · SEC-D9 apps inactivas y sus `.env` · SEC-D10 BYPASSRLS · SEC-D11 npm/expo-router. SEC-D10 quedó MEDIDO (roles acotados; residual: la consola lee `copiloto_mensajes` de todos los tenants). SEC-D9 medido: los tokens de 6 apps inactivas siguen vivos → revocar. Además, 40 rutas con prueba cross-tenant profunda pendiente (ficha SM-S).

## Limitaciones declaradas
- nmap desde la PC inválido (proxy local); cierre externo por TCP connect.
- Caso 7 del wrapper headless (escritura bloqueada) sin control positivo propio.
- Pasada ciega Fable y revisión Opus de G1–G12: **intentadas y fallidas** (3 corridas, «Autocompact thrashing», ≈ USD 30 sin resultado; ver HALLAZGOS.md). Sustituidas por una revisión determinista de cifras (2 correcciones). Relanzar requiere arreglar el contexto base de headless.
- C7 cerrado en fuente Y en el APK compilado `ef143e95` (0 hallazgos, con control positivo; ver HALLAZGOS.md). No se corrió docker-bench; la higiene de contenedores se midió con `docker inspect` (ninguno privileged, sin docker.sock).

## DoD del plan (§1)
Cumplido: instrumentos con control positivo, hallazgos con evidencia, correcciones con rollback y re-medición. **No cumplido:** punto 7 (G1–G12 aprobados) y pasada ciega final.
