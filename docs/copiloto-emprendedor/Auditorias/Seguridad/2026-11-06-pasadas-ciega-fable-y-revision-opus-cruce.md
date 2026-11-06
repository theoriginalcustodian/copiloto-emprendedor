# Pasadas ciegas (Fable) y revisión de G1–G12 (Opus): cruce con HALLAZGOS

> Medido 2026-11-06. Ambas corridas headless con contexto mínimo (cwd neutro, `--setting-sources ""`, solo Read/Grep/Glob).
> Crudos: `evidencia/2026-11-06/headless/F4-ciego2-fable.json` (USD 13,37, 148 turnos) y `F4-revG3-opus.json` (USD 1,57, 63 turnos).
> Caveat: ambos leyeron una **copia congelada** de la evidencia; lo posterior a esa copia aparece como "sin evidencia/contradicha" sin serlo. Se verificó en vivo lo verificable (abajo).

## 1. Revisión Opus de G1–G12 (99 afirmaciones)

40 respaldadas · **44 sin evidencia** · **15 contradichas**. Los G aprobados el 2026-11-06 **no deben leerse como "todo medido"**.

### Contradichas que NO lo son (evidencia vieja, verificado en vivo, `verificacion-en-vivo-dependabot-ruleset.txt`)
- *Dependabot ON* (G2/G5/G6): hoy `dependabot_security_updates: enabled`; hay alertas y PRs de dependabot. Opus solo vio el snapshot del 2026-11-04.
- *Ruleset exige PR* (G1/G4/G12): existe `main-exige-pull-request`, `active`. Opus solo vio el 404 de branch-protection (otro mecanismo).

### Contradichas/sin evidencia que SÍ son defectos de los docs (a corregir)
- **G2 BOLA "40 rutas pendientes"** está desactualizado: HALLAZGOS dice 100/100 cerrado. Corregir G2.
- **G1 "privilegio mínimo"** y **"cero secretos en el repo"**: los servicios corren como root (SEC-A1-3 parcial) y el token 60fps sigue en la historia (SEC-C6-1 abierto). Reformular como "aceptado con reserva".
- **G3/G10 sobre borrado** ("Composio/Graphity/GoTrue sin borrado") contradicen G10 y `sec-d8-e2e-prod.json` (SEC-D8 los borra). G3 quedó con texto previo a SEC-D8.
- **G3 hosts sslip "cabeceras + /docs 404"**: última medición muestra `/docs 200` y sin cabeceras (Fable H7 lo confirma). Medir o retirar el host.
- **G10 "supresión completa en ≤7 días"** vs logs con 30 d y SEC-C5-1 EN-FIX.
- **SEC-C5-1 "Cerrado, medido"** en G2 y MATRIZ:16 mientras HALLAZGOS:49 dice EN-FIX sin re-medición.
- Sin evidencia: DOCKER-USER, recibos de gate, Fernet/cifrado MP-ARCA en DB, plazos de G5/G6/G11, regiones y términos de proveedores (G8), `LEGAL_VERSION`, `copiloto_consola` SELECT-only. Son afirmaciones de política o de código que nunca tuvieron artefacto.
- Cerrado hoy por este trabajo: *adversarial de auth posterior al bump* (VERDE ×2 contra prod, tras arreglar el script) y *pip-audit recurrente* (PR #1745). Quedan sin cerrar: durabilidad posterior (próximo `deploy.sh`) y rollback por bump en BITACORA (hecho para SEC-B1-3).

## 2. Pasada ciega Fable (25 hallazgos: 19 CONFIRMADO / 6 SOSPECHA según su rótulo)

| Fable | Sev. | Estado vs HALLAZGOS |
|---|---|---|
| H1 autosanación ejecuta parche+test de un LLM en el host como root, sin contenedor | alta | **NUEVO** como riesgo (HALLAZGOS solo menciona la autosanación). Requiere decisión: contenedor sin red + token mínimo |
| H2 signup abierto, sin verificación de email, devuelve `cliente_id` ajeno al repetir el email | alta | Signup abierto = SEC-A3-1 (decisión del operador). **La enumeración es nueva y la reproduje hoy**: dos signups con el mismo email devuelven el mismo `cliente_id` (`17ba62d2…`) |
| H3 `deploy.sh` no instala `requirements.txt` pineado (solo `>=`) | alta | **NUEVO en docs**; coincide con lo que medí al desplegar el bump (hubo que hacer `pip install` manual) |
| H4 Postgres `ssl=off`, otro host | alta | = SEC-A2-1 DIFERIDO (D-diferido a migración de 4 VPS) |
| H5 todo corre como root, sudo NOPASSWD | alta | = SEC-A1-3 (parcial) + A1-2 |
| H6 secretos en claro en disco: clave fiscal AFIP del operador y passwords temporales de tenants migrados | alta | **NUEVO** (SEC-A4-1 cubre solo `.env` inactivos). Borrar con evidencia y rotar |
| H7 hosts sslip sin cabeceras y con `/docs` | media | Parcial: SEC-C2-1/C3-1 cubren el host público, no los sslip |
| H8 service_role/anon JWT de 10 años y secreto HS256 compartido | media | **NUEVO** |
| H9 access log de Caddy con CUIT en querystring | media | Variante nueva de SEC-C5-1 (que cubría uvicorn) |
| H10 supply chain: main sin protección, Dependabot apagado | media | **Desactualizado**: ya hay ruleset y Dependabot (verificado hoy) |
| H11 login sin freno de fuerza bruta | media | = SEC-D3 (abierto, espera build #2) |
| H12 borrado deja restos (tokens MP upstream, historias Temporal) | media | **NUEVO** como límite de SEC-D8 |
| H13 sin retención para comprobantes/pagos de terceros | media | Parcial (G10 retiene afip_comprobantes; sin plazo) |
| H14 ufw amplio + puertos Docker en 0.0.0.0 | media | = SEC-A1-1/A6-2 |
| H15 prod comparte VPS con cargas ajenas | media | = SEC-A6-1 (parcial) |
| H16 dependencias JS vulnerables | media | = SEC-B1-3 (106 alertas, triage hecho) |
| H17 imágenes Docker viejas | baja | **NUEVO** menor |
| H18 `/healthz` expone SHA | baja | = SEC-C3-2 |
| H19 `kaggle-tunnel` | baja | Ya registrado (G4/HALLAZGOS) |
| H20 rate limit en memoria, clave por X-Forwarded-For | baja | **NUEVO** (ligado a SEC-D3) |
| H21 CSP sin `script-src`, HSTS sin includeSubDomains | baja | Parcial (SEC-C2-1) |
| H22 datos personales del operador hardcodeados en repo público | baja | **NUEVO** |
| H23 trigger de auditoría desactivable por el mismo rol | baja | **NUEVO** |
| H24 Postgres sin log de conexiones, `tasks` sin RLS | baja | = SEC-A2-1/A2-2 |
| H25 política de divulgación incompleta | baja | = G11 pendiente |

**Nuevos de verdad: H1, H3, H6, H8, H12, H17, H20, H22, H23 (+ la enumeración de H2 y la variante H9).** El resto repite hallazgos ya registrados, aceptados o diferidos, o está desactualizado.

## 3. Lectura

- La pasada ciega **sí** encontró cosas que el equipo no tenía: H1 y H6 pesan más que casi todo el backlog abierto.
- Costó USD ~15; el 60 % de los hallazgos Fable repite lo conocido. La señal está en los 9–11 nuevos.
- La reserva de MATRIZ "sin pasada ciega" queda **cerrada**; se abre una nueva: "9 hallazgos nuevos sin triaje del operador".

## 4. Pendiente (sin ejecutar; MAYOR → operador)

1. Decidir H1 (contenedor para el gate de autosanación) y H6 (borrar `/root/.secrets/afip-david.txt` y `copiloto-migrated-creds.txt`, forzar cambio de claves).
2. Corregir los textos desactualizados de G1, G2, G3 y la fila de SEC-C5-1 en MATRIZ (táctico: lo hago en el siguiente PR).
3. `deploy.sh` con `pip install -r requirements.txt` (H3) y signup sin devolver ids ajenos (H2): tareas de código, sin decisión de fondo.
