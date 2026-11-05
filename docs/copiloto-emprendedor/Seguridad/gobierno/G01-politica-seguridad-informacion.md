# G1 — Política de seguridad de la información
> **BORRADOR — pendiente de aprobación del operador.** Estado medido @ff5fb289 (2026-11-05). Marcos citados como referencia de mapeo, no como certificación. Evidencia: `docs/copiloto-emprendedor/Auditorias/Seguridad/`.

**Alcance:** Copiloto del Emprendedor (backend, PWA, mobile, VPS `unreal-copilot`, GoTrue, Temporal, Postgres de fusion, Graphity, integraciones Composio/MercadoPago/ARCA).
**Roles:** el operador (David Lin) es dueño de riesgo y aprueba lo MAYOR; las sesiones IA ejecutan lo táctico con evidencia verificable.

**Principios vigentes (ya operativos, elevados a política):**
1. Cero secretos en el repo (público); un secreto pegado en chat se considera comprometido y se rota al pasar a producción.
2. Aislamiento por tenant con RLS `FORCE` y **test adversarial** por control declarado; sin ese test el control es `[UNVERIFIED]`.
3. Todo cambio entra por PR con el gate propio (`scripts/gate.sh`, recibo por SHA); sin push directo a `main`.
4. Privilegio mínimo en procesos, red y credenciales; ufw + DOCKER-USER cerrados por defecto.
5. Determinista antes que LLM: lo que el código puede verificar no se delega a un modelo.
6. Nada se declara "listo" sin evidencia adjunta.

**Revisión:** anual y tras cada incidente. **Documentos hijos:** G2–G12.
