---
name: graphity-backup-cron-tumba-el-api-4x-dia-60-90s
description: Por qué el pre-push muere contra Graphity y cómo distinguir las causas: la ventana de backup 4x/día, los DOS hosts (uno puede estar vivo mientras el otro rechaza), y que ReadError/10054 no lo cubre ningún timeout; el /health no prueba que el API esté arriba — el mtime del checkpoint sí.
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

---

## Addenda 2026-09-30 — tres cosas que esta nota no decía y hacen fallar el diagnóstico

### 1. Hay **DOS** hosts de Graphity, y medir el equivocado dice «caído» cuando hay uno vivo

Medido 13:48 UTC, **fuera** de toda ventana de backup:

```
graphity.178-105-191-1.sslip.io/health  ->  000 en 1.29s    (conexión rechazada)
graphitymt.duckdns.org/health           ->  200 en 5.14s    (responde; GRAFOTMO la midió en 2.19s)
```

`graphitymt.duckdns.org` es la instancia contra la que el bridge de **este** repo sincroniza (es la que
GRAFOTMO usó para su E2E de 21m51s). Un parte que mide sólo el `sslip.io` concluye «el grafo está
caído» y manda a cuatro sesiones a esperar — con la otra viva. **Antes de declarar el grafo caído,
medí los dos y decidí cuál usa el bridge** (`src/bridge/client/graphity.py:85` lee
`GRAPHITY_BASE_URL` de la config de `<bridge>/config/`, no del entorno).

### 2. `ReadError [Errno 10054]` es un **tercer** modo, y ningún timeout lo cubre

Esta nota lista `503` y `RemoteProtocolError`; GRAFOTMO arregló el `WriteTimeout` con timeouts
granulares (PR #4 del bridge, `d6cb6af3`). El de hoy es otro:

```
httpx.ReadError: [Errno 10054] Se ha forzado la interrupción de una conexión existente por el host remoto
[graph-sync] ❌ el sync salió con status 1.
```

**Un timeout más largo no cubre un host que CORTA**, sólo a uno que tarda. Son fallas distintas con el
mismo síntoma visible (el push abortado), y por eso «ya lo arreglaron los timeouts» es una conclusión
falsa que se siente informada ([[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]]).

### 3. El `/health` sigue siendo insuficiente — y hoy me engañó a mí, con la advertencia escrita arriba

Usé `200 en 5.14s` para concluir «viva». **Esta misma nota ya dice que el 200 de Caddy puede estar
cacheado y no prueba que el API esté arriba**, y yo la leí después de medir. Lo que sí lo prueba, y es
igual de barato:

```
ls -la <bridge>/.bridge/checkpoint-<repo>.db     # mtime = la última vez que el API contestó de verdad
                                                  # hoy: hace ~8 min, con el push fallando
tail del log del push:  "[graph-sync] árbol en origin/main @ <sha> ✓"  ->  hubo diálogo con el API
```

**Corolario operativo:** el `sync completo` tarda ~20 min (21m51s medido). Un push que lleva 10 minutos
sin imprimir nada **no está colgado**, está en esa fase — y su exit code puede salir 0 sin haber
pusheado, así que el veredicto es `git ls-remote`
([[git-push-puede-salir-exit-0-sin-haber-pusheado]]).

### ⚠️ Y una corrección al `How to apply` de arriba: **el bypass `--no-verify` ya no existe**

Esa línea se escribió el **2026-08-05**. El repo pasó a **PÚBLICO el 2026-08-06**, un día después, y
ese mismo hook corre **gitleaks**: saltearlo es publicar un secreto en el instante del push. Hoy está
prohibido por `CLAUDE.md` y por la orden vigente de planificación, **con o sin autorización**. Lo que
se hace es: commitear local, reintentar, y verificar con `ls-remote`.
