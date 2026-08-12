---
name: clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo
description: "Antes de rutear un hallazgo a un frente, abrir el código: el título del hallazgo no es evidencia"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T15:13:03.402Z
---

Un hallazgo heredado de un informe viejo **se re-abre en el código antes de clasificarlo o ruteárselo
a alguien**. El título del hallazgo es una etiqueta escrita por otro, no evidencia.

**Why:** el 2026-08-12 clasifiqué **C8 — "firma que ignora `payload`"** como vulnerabilidad
criptográfica (verificación de firma HMAC en `POST /mp/webhook`) y lo ruteé a la Pasada 1 de seguridad
como P0. Es una **firma de función**: `make_signal_anulacion` en `apps/copiloto/web.py` acepta
`payload` y no lo reenvía a `handle.signal()`; su gemelo `make_signal_factura` sí. O sea, pérdida
silenciosa de datos en una señal de Temporal — corrección, no seguridad. La ambigüedad de "firma" en
español (función vs. criptográfica) alcanzó para inventar un endpoint y un mecanismo que no existían.
El error llegó **mergeado a `main` en dos planes** (#387) y habría mandado a la sesión de auditorías
—que corre con modelo caro— a cazar una vulnerabilidad inexistente.

**How to apply:** al triar un backlog heredado, por cada ítem correr un `git grep` del símbolo que el
título menciona y leer las 5 líneas reales antes de asignarle severidad, frente y dueño. Cuesta un
comando por hallazgo. Y si el error ya se publicó, **corregirlo escrito, no borrado**: las otras
sesiones ya leyeron la versión vieja y el borrado silencioso no les avisa. Relacionado:
[[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[el-buzon-no-ve-lo-que-otra-sesion-ya-hizo-en-main]]
