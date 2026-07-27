# Migración de Temporal: `arca-temporal-vps` → `arca-enterprise-v010`

> **Ejecutada:** 2026-07-27, ~21:45–22:15 UTC. Autorizada por el operador (migración completa + borrado del origen tras verificar).
> **Driver:** costo. `arca-temporal-vps` era un CPX32 a **$41,99/mes**; `v010` es un CX33 a **$8,99/mes**. Ahorro **$33/mes**.

---

## 1. Qué se movió

El cluster Temporal completo de la suite fiscal ARCA: `temporal-server` 1.29, `temporal-postgres`,
`temporal-ui`, `temporal-admin-tools`, `archival-sync`, y **7 workers** (`capa0`, `mot-1`, `mot-2`,
`bot`, `util`, `agt01`, `agt02`), con sus **4 schedules** activos.

`v010` ya corría Supabase self-host + observabilidad; ahora corre **ambas cosas**.

## 2. Verificaciones previas (lo que evitó romper algo)

| Riesgo evaluado | Resultado |
|---|---|
| ¿Algo apunta a `v010` y se rompería? | **No.** Grep en 6 VPS + PC: sólo docs y plantillas. Control inverso: 7 días de Kong con **0 respuestas 200**, sólo escáneres |
| ¿Cabe en 80 GB? | **Sí.** Los 99 GB del origen eran **85 GB de imágenes containerd** (266 imágenes, 27 activas). Datos reales ~20 GB |
| ¿Alcanza la RAM? | **Sí.** Temporal consume ~1.545 MB sin el `obs-*` duplicado. Total tras migrar: ~4.300 de 7.751 MB |
| Los 33 OOM del origen | **Falsa alarma.** Eran `obs-postgres-exporter` con `mem_limit` ajustado — un contenedor que **no se migró**. El host nunca estuvo bajo presión |
| ¿Qué apps apuntan al origen? | Sólo **una viva**: `arca-frontend` con `TEMPORAL_ADDRESS=10.10.0.2:7233` |

## 3. La jugada que evitó tocar las apps

`TEMPORAL_ADDRESS=10.10.0.2:7233` apunta por **IP privada**, no pública. En vez de reconfigurar el
frontend fiscal, se **movió la IP `10.10.0.2`** del origen a `v010` dentro del vSwitch
`arca-client-001-vswitch` (id `12275282`).

**`arca-frontend` no necesitó ningún cambio, ni redeploy, ni reinicio.**

Requisito adicional que lo confirmó: `/opt/temporal/.env` define `TEMPORAL_GRPC_BIND_IP=10.10.0.2`
— el server **bindea explícitamente** a esa IP, así que moverla no era optativo.

## 4. Ajustes necesarios en el destino

1. **Puerto de métricas `8000` → `8010`**: en `v010` el `8000` lo ocupa `supabase-kong`. Sin este
   cambio Docker habría fallado con *"port is already allocated"*.
2. **Imágenes de workers transferidas como binarios**: las 6 (`arca/worker-*`) son **locales, no
   están en ningún registry**. Se movieron con `docker save | docker load` por la red privada —
   0,77 GB comprimidos (comparten capas). Rebuildearlas habría sido un riesgo innecesario.
3. **No se migró** el stack `obs-*` (v010 ya tiene el suyo) ni `wiremock-sandbox`.

## 5. Secuencia del corte (~17 min de downtime)

```
21:45  Snapshots de origen (413350361, 43,7 GB) y destino (413350360, 6,92 GB) — ambos protegidos
21:46  Respaldo de los 3 secretos del vault de v010 + dump del schema rag
21:52  ENSAYO: temporal-server levanta healthy en v010 con bases vacías → se baja
21:58  Workers del origen parados
21:59  Re-dump final de las 3 bases con los workers ya parados (estado consistente)
22:00  Detach de la red del origen → libera 10.10.0.2
22:01  Attach de v010 con IP 10.10.0.2
22:03  Restauración de temporal (39 tablas, 4 namespaces), temporal_visibility, tenant_registry
22:05  temporal-server + ui + admin-tools arriba
22:07  Los 7 workers arriba, 6 colas con pollers activos
```

## 6. Evidencia de que funciona

El workflow `gap2-reconcile-stuck-states-workflow-2026-07-27T22:00:00Z`:

```
StartTime 22:04  ·  CloseTime 22:05  ·  Status COMPLETED  ·  TaskQueue arca-capa0
```

Estaba programado para las **22:00**, cuando los workers del origen ya estaban parados (21:58).
Temporal lo mantuvo encolado y **lo ejecutó el worker de `v010`** al levantar. **Ninguna ejecución
se perdió durante el corte** — que es exactamente lo que la durabilidad de Temporal debe garantizar.

Estado final: 12 contenedores `healthy`, ~3.800 MB de RAM libre, **0 OOM**, Supabase sin regresión.

## 7. Tropiezos y cómo se resolvieron

| Qué pasó | Causa real |
|---|---|
| Los 3 dumps "fallaron" en silencio | El directorio destino no existía; y el `if/else` reportó *"0 errores"* cuando el comando había fallado sin escribir a stderr |
| `pg_restore` no creaba tablas pero no daba error | La redirección `< archivo` se perdía dentro del heredoc. Ejecutado directo: EXIT=0 y 39 tablas |
| `docker compose stop` no paraba los workers | Nombres de proyecto distintos por archivo. Se paró por nombre de contenedor |
| Los workers no levantaban en el destino | `depends_on: temporal-server`, definido en otro compose. Se resuelve combinando `-f` |
| La red `temporal-net` creada a mano | Compose la quiere gestionar él. Se borró y la creó el compose |

**Lección transversal:** varios de estos fallaron **sin producir un error visible**. El `EXIT=0` tras
un pipe (`cmd | tail`) devuelve el status de `tail`, no del comando — por eso cada paso se validó con
un control positivo (contar tablas, listar objetos del dump, contar pollers) en vez de confiar en el
código de salida.

## 7.bis Cierre — origen borrado

`arca-temporal-vps` (id `133965597`) se **borró a las 22:18 UTC**, tras dos ciclos consecutivos de
schedules verdes ejecutados en `v010` (22:00 y 22:15) y con el frontend fiscal conectando por
`10.10.0.2:7233`.

Verificación post-borrado (22:19): 12 contenedores arriba, workflows del ciclo 22:15 `Completed`,
3.740 MB de RAM libre, Supabase 10 healthy, `arca-frontend` → `10.10.0.2:7233 open`, y el SSH al
origen da `Connection timed out` (ya no existe).

**Facturación:** de 6 servidores ($86,99/mes) a **5 ($44,95/mes)**. Como el destino ya existía y ya
se pagaba, el ahorro es el **CPX32 completo: $41,99/mes**, menos ~$0,87/mes del snapshot de rollback.
**Ahorro neto ≈ $41/mes.**

⚠️ La IP pública `91.99.221.187` tenía `auto_delete: true` y **se destruyó con el servidor**. Un
rollback desde el snapshot tendría otra IP pública; la privada `10.10.0.2` —la que usan las apps—
ya vive en `v010`.

## 8. Rollback disponible

- **Snapshot del origen** `413350361` (43,7 GB, protegido) — restaurar: IP `91.99.221.187`,
  red `12185311` ip `10.0.0.50`, red `12275282` ip `10.10.0.2`, firewall `11117270`.
- **Snapshot del destino** `413350360` (6,92 GB, protegido) — estado de `v010` previo a Temporal.
- Secretos del vault y dump del schema `rag` en `/root/_pre-migracion-20260727/` de `v010`.

## 9. Pendiente / deuda declarada

- **Tailscale**: el origen corría `tailscaled` (`arca-temporal-router`, tailnet `kaggle-fleet`) con un
  relay socat `100.64.0.1:7233 → 10.10.0.2:7233` para acceso desde Kaggle. Estaba **`offline`** (sin
  conexión al coordinador) desde antes de la migración. **No se replicó.** Si ese acceso overlay se
  necesita, hay que rehacerlo en `v010`; si no, corresponde jubilarlo formalmente.
- **`temporal.91-99-221-187.sslip.io`** (Caddy del origen) deja de existir. Era acceso administrativo
  y tenía **0 conexiones externas** al puerto 7233.
- Referencias en repos a `91.99.221.187` / `arca-temporal-vps`: plantillas `.env.example`,
  `infra-vps-panel.tsx` (display), spikes Kaggle. **Ninguna es config viva**, pero conviene
  actualizarlas para que la documentación no mienta.
