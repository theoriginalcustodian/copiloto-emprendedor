# VPS `unreal-copilot` — inventario completo y runbook de restauración

> **Generado:** 2026-07-27, contra el servidor vivo (no contra documentación).
> **Motivo:** el operador evalúa apagar/eliminar el VPS para ahorrar costo. Antes hay que saber
> qué hay adentro y probar que la imagen vuelve sin fricción.
> **Estado:** snapshot `413216492` creado. **Nada fue eliminado.** El servidor sigue vivo.

---

## 1. Qué es este servidor (dato que corrige el supuesto inicial)

No es "el VPS del copiloto". Es un servidor compartido con **7 sistemas de 3 proyectos**.
Cualquier decisión de apagado los afecta a todos.

| Sistema | Unidades / contenedores | Notas |
|---|---|---|
| **Copiloto** (prod-beta) | `uc-copiloto-web`, `uc-copiloto-worker`, `copiloto-auth-{auth,proxy,db}`, `copiloto-test-db` | GoTrue dedicada. `copiloto-test-db` es la base de los pytest |
| **Documed** | `uc-documed-web`, `uc-documed-worker` | proyecto distinto, mismo VPS |
| **Clinic** | `clinic-bff`, `clinic-worker`, `clinic-frontend` (:3000) | + 801 MB en `/opt/clinic-web-build` |
| **Hermes / fábrica** | `hermes`, `hermes-dashboard`, `unreal-copilot-deepseek-worker` | la fábrica agéntica |
| **Temporal** | `temporal-server`, `temporal-ui`, `temporal-postgres`, `temporal-admin-tools`, `temporal-mcp` | el moat durable del copiloto |
| **Evolution API** | `evolution-api`, `evolution-postgres`, `evolution-redis` | WhatsApp. `evolution-manager` está `Exited (1)` hace 4 semanas |
| **Voz / varios** | `telnyx-voice`, `spike-voice`, `voz-web`, `unreal-copilot-wa-sender`, `uc-hitl-listener`, **`code-server` (VS Code remoto)** | + cron `obsidian_sync.sh` cada 5 min |

**Recursos:** CX33 (4 vCPU / 8 GB / 80 GB) en Nuremberg · 43 GB usados de 75 · uptime 41 días ·
€8,99/mes · 207 paquetes apt instalados a mano.

**Reclamable si algún día se quiere achicar:** 4,0 GB de build cache Docker + 5,34 GB de imágenes
sin usar ≈ **9,4 GB**. *No se ejecutó ningún prune* (instrucción: no eliminar nada).

---

## 2. Lo que **no** viaja dentro del snapshot

Esta es toda la fricción real de una restauración. El disco se clona; la identidad de red, no.

| Recurso | Valor exacto | Por qué importa |
|---|---|---|
| **Primary IP** | `178.105.191.1` — id `132724262`, `auto_delete: false` | **El punto crítico.** 9 de los 10 dominios codifican la IP en el hostname (`copiloto.178-105-191-1.sslip.io`, `mp.…`, `auth.…`, `temporal.…`, `hermes.…`, `voz.…`). Los 3 `duckdns` resuelven a esa IP y **no hay updater en el VPS**: el registro es estático. Los callbacks de MercadoPago y los redirect URIs de Google OAuth apuntan ahí. |
| **Red privada A** | `graphiti-net` (id `12185311`) → IP **`10.0.0.20`** | Compartida con `graphity-prod`, `arca-temporal`, `fusion-test`. `fusion-pg.env` referencia `10.0.0.20` |
| **Red privada B** | `arca-client-001-vswitch` (id `12275282`) → IP **`10.10.0.20`** | Compartida con 4 servidores del proyecto ARCA |
| **Firewall** | id `11142751` | Se aplica aparte del snapshot |

> La IP ya venía con `auto_delete: false` y label `preserve-on-restore-post-adr050` — alguien
> previó exactamente este escenario. Si esa bandera estuviera en `true`, borrar el servidor
> destruiría la IP y la restauración **no** sería cero fricción: serían 36 referencias a corregir
> en el repo más re-registrar OAuth y MercadoPago.

---

## 3. Verificación de arranque automático (lo que se pidió explícitamente)

Un snapshot sano no alcanza: si un contenedor tiene `restart: no` o un unit está `active` pero no
`enabled`, **no vuelve solo** tras el boot y la restauración parece rota sin estarlo.

### Se encontraron 3 fallos, los 3 corregidos antes del snapshot

| # | Qué | Estado previo | Fix aplicado | Verificado |
|---|---|---|---|---|
| 1 | `copiloto-test-db` | `restart: no` → no volvía | `docker update --restart unless-stopped` | ✅ `unless-stopped` |
| 2 | `uc-hitl-listener` | `active` pero **`disabled`** | `systemctl enable` | ✅ `enabled` |
| 3 | `spike-voice` | **unit `transient`** en `/run/systemd/transient` (tmpfs) — se perdía en cualquier reboot, con o sin snapshot | unit file materializado en `/etc/systemd/system/` + symlink en `multi-user.target.wants/` | ✅ symlink presente |

El #3 era el peligroso: un transient no deja rastro en disco, así que se habría perdido en silencio
y nadie sabría qué comando reponer. Quedó capturado como
`/opt/spikes/voice-ws/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8080`.

### Estado final verificado

- **18 units** `enabled` (incluye `docker`, `containerd`, `caddy`, `fail2ban`, `code-server@root`)
- **15 contenedores** con `restart: always` o `unless-stopped` — ninguno queda afuera
- **4 compose files** referenciados por los contenedores, los 4 presentes en disco:
  `/opt/agentic/docker-compose.agentic.yml` · `/opt/uc-repos/copiloto/deploy/copiloto/gotrue/docker-compose.gotrue.yml` ·
  `/root/evolution-api/docker-compose.yml` · `/usr/local/lib/hermes-agent/docker-compose.yml`
- **fstab** sin montajes externos (solo `/` y `/boot/efi` por UUID) → nada que re-adjuntar

⚠️ **Efecto lateral a tener en cuenta:** `evolution-manager` está `Exited (1)` con política `always`.
Al bootear, Docker **lo va a levantar**. Si estaba caído a propósito, hay que pararlo después del
primer arranque.

---

## 4. Cinturón de consistencia: dumps lógicos

El snapshot se tomó **en caliente** (sin apagar el servidor, para no bajar los 7 sistemas sin
autorización). Con 4 Postgres escribiendo, un snapshot en vivo puede pillar el filesystem a mitad
de una escritura. Mitigación: dumps lógicos tomados **antes**, en `/root/_pre-snapshot-20260727/dumps`
(23 MB total), con control positivo de que traen contenido real:

| Base | Tamaño | Contenido verificado |
|---|---|---|
| `temporal-postgres` | 9,6 MB | 11.336 líneas · 42 tablas |
| `evolution-postgres` | 13 MB | 22.609 líneas · 37 tablas |
| `copiloto-auth-db-1` | 284 KB | 3.019 líneas · 20 tablas |
| `copiloto-test-db` | 60 KB | 2.042 líneas · 17 tablas |

Si al restaurar una base viniera inconsistente, se repone desde su dump.

> **Para una imagen sin ninguna duda de consistencia** hay que apagar el servidor antes de
> snapshotear (2-5 min de downtime de los 7 sistemas). No se hizo por no tener autorización de bajar
> los servicios. Es la única mejora pendiente sobre esta imagen.

---

## 5. Qué código vive **solo** acá

`/opt/uc-repos/` tiene 34 directorios. Dos hallazgos:

- **`copiloto` y `documed` NO son repos git** — `deploy.sh` los rsyncea desde la PC. Su código está
  en GitHub; no hay riesgo de pérdida.
- **29 repos de la fábrica sí son git**, y **4 tienen commits sin pushear** — trabajo que existe
  únicamente en este disco:

  | Repo | Commits sin push |
  |---|---|
  | `flujo-c-demo` | 3 |
  | `uc-comp2-system` | 3 |
  | `uc-mixed-system` | 2 |
  | `subscription` | 1 |

  Además ~14 repos tienen archivos sin commitear. Todo eso viaja en el snapshot, pero si el objetivo
  fuera poder tirar la imagen algún día, conviene pushearlos antes.

**Secretos:** 21 archivos en `/etc/unreal-copilot/` (`copiloto.env`, `documed.env`, `fusion-pg.env`,
`documed_gcp_sa.json`, credenciales de GoTrue…). Existen **solo acá** — no están en ningún repo.
El snapshot es su único respaldo.

---

## 6. Runbook de restauración

```bash
# 1) Crear el servidor desde el snapshot
#    imagen: 413216492   ·   tipo: cx33   ·   ubicación: nbg1 (misma zona que las redes)

# 2) Asignar la primary IP — CRÍTICO, hacerlo antes de levantar servicios
#    primary IP id 132724262  (178.105.191.1)
#    Sin este paso: fallan los 9 dominios sslip.io, los 3 duckdns, MercadoPago y Google OAuth.

# 3) Adjuntar a las dos redes privadas con las IPs EXACTAS
#    red 12185311 (graphiti-net)            -> 10.0.0.20
#    red 12275282 (arca-client-001-vswitch) -> 10.10.0.20

# 4) Aplicar el firewall 11142751

# 5) Bootear y verificar (no hace falta arrancar nada a mano: todo está enabled)
ssh unreal-copilot 'systemctl --failed; docker ps --format "{{.Names}}\t{{.Status}}"'

# 6) Smoke E2E del copiloto — el criterio binario de éxito
ssh unreal-copilot '/opt/uc-copiloto-venv/bin/python /opt/uc-repos/copiloto/deploy/copiloto/smoke_beta_e2e.py'
#    10/10 = BETA-READY

# 7) Parar evolution-manager si no se lo quiere vivo (restart=always lo levanta solo)
```

**Costo si algún día se elimina el servidor:** snapshot ~€0,18/mes + primary IP reservada ~€0,60/mes
≈ **€0,80/mes**, contra los €8,99 del servidor → ahorro ~€8,20/mes.

---

## 7. Lo que queda **sin verificar** (honestidad sobre el alcance)

Este documento prueba que el servidor **está preparado** para reiniciar sin fricción: autostart
completo, dependencias de red identificadas, dumps tomados. **No prueba que la imagen restaure bien**
— eso exige crear un servidor desde ella y correr el smoke, y no se hizo porque implicaba consumir
la IP (que está ocupada por el servidor vivo) o aceptar un test parcial con IP distinta, que no
ejercita justamente la parte más frágil.

Mientras ese test no se corra, la afirmación honesta es: **imagen tomada y servidor preparado**,
no *"restauración verificada"*.
