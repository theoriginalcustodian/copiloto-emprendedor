# G3 — Inventario de activos y mapa de datos
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

## Activos
| Activo | Dónde | Notas |
|---|---|---|
| Backend web/worker/soporte | VPS `unreal-copilot` (3 units systemd) | sandbox aplicado |
| Reverse proxy | Caddy, hosts sslip `copiloto.*` y `mp.*` | cabeceras + `/docs` 404 |
| Auth | GoTrue dedicada (`copiloto-auth`) + Postgres local | backup local diario |
| Orquestación | Temporal (127.0.0.1:7233) + `temporal-postgres` | backup local diario |
| Datos de negocio | Postgres de fusion (10.0.0.3), schema `uc_factory` | RLS FORCE; sin TLS (D2) |
| Memoria de grafo | Graphity (instancia compartida, tenant dedicado) | sin borrado por tenant |
| Repo | GitHub público | secret scanning + push protection |

## Mapa de datos por tercero (insumo C8; DPA sin verificar)
| Tercero | Datos que recibe | Observación |
|---|---|---|
| Composio | tokens OAuth de Gmail/Drive/Sheets/Calendar/HubSpot/Instagram | sin llamada de borrado en el código |
| MercadoPago | credenciales por vendedor, pagos | tokens cifrados con Fernet |
| ARCA (afipsdk) | CUIT, certificado y clave fiscal (cifrados en DB) | el CUIT ya no se loguea |
| Graphity | episodios/hechos de actividad por tenant | sin borrado por tenant |
| Proveedores LLM | contenido de conversación | verificar no-entrenamiento (G8) |
| GoTrue | email, hash de contraseña | sin función de baja en la app |
