# Spike K-09 — ¿cómo se sabe que una conexión «se cayó»?

**Método:** lectura de código (no se revocó una credencial MP real en vivo — no hay sandbox de vendedor
MP en este entorno; declarado, no asumido).

## Hallazgos

| Servicio | Antes | Consecuencia |
|---|---|---|
| MercadoPago | Sólo existía `expires_at` y la presencia de fila. `mp_refresh_activities._refresh_sync` devolvía `{"reason":"needs_reauth"}` cuando MP rechazaba el `refresh_token` y **no persistía nada** | «caído» y «nunca conectado» eran indistinguibles: `/catalog` decía `connected:false` en ambos |
| MP, desconexión voluntaria | `delete_all` borra la fila | Correctamente = `nunca_conectado` (no es caída: lo decidió la persona) |
| Composio | `list_connections` devuelve `{id,toolkit,status}`; `_STATUS_RANK` = ACTIVE 3, INITIALIZING/INITIATED 2, EXPIRED 1 | `EXPIRED` es el único estado de caída conocido; INITIATED/INITIALIZING son intentos en curso |

## Decisión
- MP: columna `mp_credentials.reauth_desde timestamptz NULL` (migración aditiva idempotente
  `_ensure_mp_reauth`). La marca el refresh al recibir `needs_reauth`; `save`/`update_tokens` la limpian.
  `salud()` = `caido` si `reauth_desde` no es NULL **o** `expires_at` ya venció sin renovarse.
- Composio: caído = algún `EXPIRED` sin otra cuenta `ACTIVE` del mismo toolkit. No se incluyen estados
  no verificados (INACTIVE/FAILED).
- Una sola definición (`conexiones_salud.py`) para `/catalog.status`, `caja.incompleta` y la regla
  `conexion_caida` del tablero.

## Sin verificar en vivo
La transición real «MP revoca el token → el ciclo de refresh cae en `MercadoPagoAuthError`» está cubierta
por test con gateway que lanza `MercadoPagoAuthError`, no contra MP real.
