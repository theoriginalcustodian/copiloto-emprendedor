# PEDIDO → sesión BACKEND · Falta desconectar una app. La capacidad existe, el endpoint no

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Pedido del operador:** *"hay que configurar la opción para poder desconectar las apps conectadas
> también… esta función no la tiene actualmente"*.

---

## 1. Lo que hay, medido

| Pieza | Estado |
|---|---|
| `ComposioGateway.revoke(connection_id)` | **EXISTE** (`motor/clients/agent/providers/composio_gateway.py:230`) → `sdk.connected_accounts.delete(...)` |
| `list_connections(user_id)` | devuelve `{id, toolkit, status}` — **el `id` que `revoke` necesita ya está ahí** |
| Endpoint HTTP que lo exponga | **NO EXISTE**. No hay ninguna ruta de desconexión en `web.py` |
| `GET /catalog` | expone `connected`, **no** el `id` de la conexión |
| MercadoPago | **peor**: `MpCredentialStore` no tiene siquiera un método de borrado (`save`/`get`/`first_seller_user_id`/`update_tokens`) |

Así que es trabajo de ustedes en las dos ramas: en Composio falta el endpoint sobre una capacidad que
ya está; en MP falta también la capacidad.

---

## 2. Contrato que propongo, y por qué así

```
DELETE /composio/connection?service=<slug>     -> 200 {"desconectado": true}
                                               -> 404 si el tenant no tiene ese toolkit conectado
DELETE /mp/connection                          -> 200 {"desconectado": true}
```

**🔴 El `connection_id` NO viaja desde el cliente, ni siquiera como parámetro opcional.** Que el
endpoint reciba un id y lo pase a `revoke()` sería un BOLA de manual: cualquier tenant podría revocar
la conexión de otro con sólo probar ids. El endpoint tiene que resolver la conexión **del
`cliente_id` del JWT** (ustedes ya tienen `list_connections(cliente_id)` para eso) y revocar sólo si
el toolkit pertenece a ese tenant. Por eso pido el **slug** como parámetro, no el id — el slug no
identifica nada ajeno.

Por la regla dura del repo, eso pide **test adversarial**: tenant A intenta desconectar el toolkit de
B → denegado. Sin ese test el control queda `[UNVERIFIED]`, y ya nos pasó una vez que un guard
especificado nunca se codificara y viviera dos meses en prod.

**V-EXT antes de darlo por hecho:** ustedes ya se comieron un
`ComposioLegacyConnectedAccountsEndpointRetiredError` con `authorize()`. `connected_accounts.delete()`
puede estar en la misma situación. **No lo probé yo a propósito**: la única conexión ACTIVE del
sistema es la Google del operador en su cuenta personal, y revocarla para averiguarlo sería romperle
algo suyo para responder una duda mía. Prueben con una conexión desechable.

---

## 3. Una interacción que nadie miró todavía

**Si el emprendedor desconecta Drive teniendo `guardar_en_drive = true`, sus facturas dejan de
archivarse y nada se lo dice.** El ajuste queda prendido sobre una capacidad que ya no existe — la
misma forma del 409 que ustedes agregaron para el perfil inexistente.

No lo resuelvo solo porque la decisión es suya y hay dos caminos legítimos:

- **(a)** el backend apaga `guardar_en_drive` al revocar Drive → el estado nunca miente, pero muta
  un ajuste que el usuario no tocó.
- **(b)** el backend no toca nada y yo lo advierto en la confirmación → el usuario decide, pero si
  ignora el aviso queda un ajuste prendido sin efecto.

**Me inclino por (b)** y lo digo con el argumento, no como preferencia: apagar un ajuste que el
usuario configuró para arreglar una inconsistencia lo deja sin saber que cambió, y cuando reconecte
Drive va a creer que sigue archivando. Con (b), `drive_conectado: false` ya hace que mi pantalla diga
la verdad — el aviso existe desde hoy. Pero es su llamada.

---

## 4. Lo mío, cuando el contrato esté

UI de desconexión con confirmación que **nombra lo que se pierde** (no un "¿seguro?" pelado), y
re-consulta de `/catalog` después — no pintado optimista. Es la misma disciplina que ya está en
`Conectar`: la app no afirma un estado por haber disparado la acción que lo produciría.

Díganme si el contrato les cierra o prefieren otra forma, y lo implemento contra lo que acordemos.

---

## 5. Estado

Nada bloqueado de mi lado mientras tanto. Commit vigente: `ccaedc1` (Apps conecta).
