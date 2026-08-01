---
name: mover-la-identidad-de-red-en-vez-de-reconfigurar-consumidores
description: Al migrar un servicio de host, mover la IP (privada o primary) al destino cuesta un call de API y deja a los consumidores intactos; reconfigurarlos es N cambios, N deploys y N formas de olvidarse uno
metadata:
  type: project
---

**LEER antes de planificar cualquier migración de host.** La pregunta correcta no es *"¿qué apps
tengo que reconfigurar?"* sino *"¿puedo mover la dirección en lugar de la configuración?"*.

## El caso (2026-07-27, migración de Temporal)

`arca-frontend` apuntaba al cluster con `TEMPORAL_ADDRESS=10.10.0.2:7233` — **IP privada**, no
hostname. Al migrar Temporal a otro VPS había dos caminos:

| | Reconfigurar consumidores | Mover la IP |
|---|---|---|
| Cambios | editar env + redeploy del frontend fiscal | 2 calls de API (detach/attach) |
| Riesgo | olvidarse un consumidor que no apareció en el grep | ninguno: la dirección no cambió |
| Verificación | probar cada app | `nc -zv 10.10.0.2 7233` desde el consumidor |

Se movió la IP. **El frontend no se enteró de la migración**: mismo valor de env, sin redeploy, sin
reinicio. Verificado desde su propio contenedor: `10.10.0.2 (10.10.0.2:7233) open`.

Aplica a los dos tipos de dirección de Hetzner:
- **IP privada** de una red/vSwitch → `detach_from_network` del origen + `attach_to_network` del
  destino con `ip:` explícita.
- **Primary IP pública** → sobrevive al borrado del servidor si tiene `auto_delete: false`; queda
  reservada (~$0,60/mes) y se reasigna. Si está en `true`, **se destruye con el servidor**.

## Por qué rinde más de lo que parece

El grep encuentra lo que está escrito; **no encuentra lo que no está en tu perímetro** (un n8n cloud,
un frontend de un tercero, un webhook registrado hace meses). Mover la dirección hace que esa
incertidumbre deje de importar: no necesitás enumerar a todos los consumidores si ninguno tiene que
cambiar. Es convertir un problema de cobertura —que nunca podés cerrar del todo— en uno de
configuración, que sí.

## El chequeo que hay que hacer ANTES de diseñar la migración

**¿Hay dominios que codifican la IP en el hostname?** Si los consumidores usan
`servicio.1-2-3-4.sslip.io`, la IP **es** el nombre: perderla no rompe una config, rompe el DNS y los
certificados TLS de golpe. En esta flota había 9 dominios así en `unreal-copilot` y 1 en
`arca-temporal`. Un `duckdns` sin updater en el host tiene el mismo problema: el registro es estático.

## Límite

No aplica si el destino necesita convivir con el origen (entonces las direcciones deben coexistir), ni
si la IP está en otra ubicación/zona de red — Hetzner exige que la red sea de la misma `network_zone`.

Related: [[la-deuda-vencida-no-siempre-se-paga-en-un-paso]] · [[verificar-que-el-camino-recomendado-existe]] ·
detalle completo en `docs/copiloto-emprendedor/2026-07-27-migracion-temporal-a-v010.md`
