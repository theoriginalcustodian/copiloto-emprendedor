---
name: graphity-backup-cron-tumba-el-api-4x-dia-60-90s
description: El pre-push hook de copiloto-emprendedor puede fallar con 503/RemoteProtocolError contra Graphity en una ventana predecible — no es degradación real.
metadata: 
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-08-05T12:46:46.342Z
---

El backup cron de Graphity (`/etc/cron.d/graphity-backup`) para `graphity-api` (`compose stop`) 4
veces al día — **03:30 / 09:30 / 15:30 / 21:30 hora local** — durante ~60-90s (a veces más si
`pg_dump`/dump de Neo4j tarda) antes de reiniciarlo. El `pre-push` hook de `copiloto-emprendedor`
(`.githooks/pre-push`) sincroniza el arco autopoiético contra Graphity en cada push a una rama donde
`origin/main` se movió; si el push cae dentro de esa ventana, el sync falla con `503` o
`httpx.RemoteProtocolError` y el hook, fail-closed, aborta el push entero.

**Why:** confirmado empíricamente 2026-08-05 (`docker inspect` + logs del VPS de Graphity, no
asumido) — un push a las 09:29-09:32 coincidió al segundo con el ciclo de backup de las 09:30. El
`/health` de Caddy puede seguir dando 200 durante la ventana (círculo cacheado), así que un healthcheck
simple NO detecta el downtime real del API.

**How to apply:** si `git push` en `copiloto-emprendedor` falla por el pre-push hook con 503/
`RemoteProtocolError` contra Graphity cerca de :30 en punto (cualquiera de los 4 horarios), es casi
seguro este ciclo de backup, no una degradación real — reintentar en ~90s suele alcanzar. Si sigue
fallando fuera de esa ventana, ahí sí investigar de verdad. El bypass documentado por el propio hook
es `git push --no-verify` (requiere autorización explícita del operador — el auto-mode classifier lo
bloquea si se intenta sin pedirlo). Graphity ya tiene pedido un retry-with-backoff en
`graphify-graphity-bridge` para este caso (no implementado aún, a la fecha de esta nota).
