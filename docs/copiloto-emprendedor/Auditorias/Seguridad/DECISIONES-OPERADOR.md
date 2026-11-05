# DECISIONES-OPERADOR — lo que NO se decidió sin vos (ronda 2026-11-04/05)

> Cada fila: qué se encontró, por qué no se tocó solo, la recomendación y el costo de no decidir.
> Todo lo táctico ya se ejecutó y está en `BITACORA.md` con rollback. Acá sólo queda lo MAYOR.

| # | Decisión | Hallazgo / evidencia | Recomendación | Si no se decide |
|---|---|---|---|---|
| D1 | **Copia off-site de backups** (hoy sólo local, `/var/backups/uc`, 7 d) | SEC-C10-1; la caída del VPS se lleva datos y backups juntos | Hetzner Storage Box o bucket S3-compatible con cifrado `age`; requiere que cargues la credencial (no se pega en chat) | RPO real = "lo que sobreviva al disco del VPS" |
| D2 | **TLS y `log_connections` en el Postgres de fusion** (10.0.0.3) | SEC-A2-1; servidor compartido fuera del alcance concedido | Activar `ssl=on` con cert propio + `sslmode=require` en `DATABASE_URL`; ventana de reinicio acordada con quien use fusion | Tráfico DB sin cifrar en red privada Hetzner (riesgo bajo-medio) |
| D3 | **Registro abierto en GoTrue** (`DISABLE_SIGNUP=false`), sin MFA ni rate-limit explícitos | SEC-A3-1 | Mantener abierto mientras haya beta pública; agregar rate-limit de GoTrue y ofrecer MFA al admin | Cualquiera puede crear cuenta (consume cuota, no accede a datos ajenos: RLS) |
| D4 | **Hosts sslip.io**: `mp.*` (0 requests/14 d) y `copiloto.*` (`GOTRUE_SITE_URL`) | HALLAZGOS "Decisiones" | Ya decidido: conservar ambos. Retirar `mp.*` cuando MercadoPago tenga dominio propio | — |
| D5 | **Token de 60fps.design** en la historia pública (24 d expuesto) | SEC-C6-1 | Ya aceptado por vos. Regla `uc-bearer-token-literal` en `.gitleaks.toml` evita reincidencia | Riesgo aceptado |
| D6 | **Servicios corren como `root`** (sandbox aplicado, pero no usuario dedicado) | SEC-A1-3 (9.6 → 3.9) | Crear usuario `uc-copiloto` y mover `/root/.composio` — toca la integración Composio; ficha propia, con smoke | Un RCE en el proceso obtiene uid 0 dentro del sandbox (sin capabilities) |
| D7 | **`ProtectHome` no aplicado** | rompe Composio (`/root/.composio`), smoke 35/8 | Se resuelve con D6 | — |
| D8 | **Borrado y exportación de datos por tenant** no existen | SEC-C8-1 (ISO 27701 7.3) | Ficha `SM-S` MAYOR: diseño de baja de tenant en Postgres + Graphity + Composio + GoTrue + backups | Sin mecanismo para atender un pedido de supresión/portabilidad |
| D9 | **Tablas de otras apps** (`tasks`, etc.) en la DB compartida y apps del VPS inactivas | HALLAZGOS SEC-A2-2 | Confirmar que se pueden retirar; entonces cerrar puertos/borrar contenedores y tablas | Superficie innecesaria |
| D10 | **`copiloto_consola` / `copiloto_autosanacion` con `BYPASSRLS`** | SEC-A2-2 | Verificar que su camino está acotado (ficha); si no, quitar el atributo | Dos roles saltean el aislamiento por diseño |
| D11 | **`decode-uri-component` / `expo-router` y bumps npm dev** | SEC-B1-3 | PR de bump de expo-router en rama de mobile (MAYOR, cambia el nativo → rebuild) | CVE transitivo en tooling de build, no en runtime |
| D12 | **Escaneo externo con nmap** inválido desde la PC | HALLAZGOS 2026-11-05 | Repetir desde otra red cuando convenga | Cierre externo probado sólo por TCP connect |
