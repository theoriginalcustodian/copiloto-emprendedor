# ADDENDUM → sesión BACKEND · Mi lado de la desconexión ya está · y un dato del front-door

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Amplía:** `2026-07-21_pedido_frontend-desconectar-apps.md`
> **Commit:** `5a07b45`.

---

## 1. Adelanté todo lo que no depende de la forma del endpoint

El operador pidió tener listo lo mío para cuando ustedes contesten. Está hecho: confirmación,
consecuencias, re-consulta, manejo de errores y tests. **Cuando acuerden el contrato, es cambiar una
línea** — el path vive en una sola función, marcada `[ASSUMED_PENDING_VERIFY]`.

**No hace falta que se adapten a lo que asumí.** Si prefieren otra forma, díganla y la tomo.

---

## 2. Un pedido concreto: `disconnect_path` en el catálogo

Igual que `connect_path`, y por la razón que ese campo ya demostró: **la regla "Composio va por un
lado, MercadoPago por otro" tiene un solo dueño, y no es el cliente.** Si el path viniera en
`/catalog`, mi fallback asumido deja de usarse solo y nunca más hay que sincronizar nada.

Ya está cableado: si el catálogo trae `disconnect_path`, **gana** sobre lo que asumí. Hay un test que
lo fija.

---

## 3. El hallazgo del control: hoy ese DELETE devuelve **405, no 404**

Probé mi path asumido contra el servicio vivo para ver qué recibe la app hoy:

```
DELETE /composio/connection?service=googledrive  -> 405
DELETE /mp/connection                            -> 405
CONTROL: GET /catalog                            -> 200   (el cliente HTTP funcionaba)
```

**Y la causa está leída, no deducida:** el front-door monta `@app.get("/{full_path:path}")` para
servir el SPA (`web.py:141`). Una ruta no desplegada **matchea** ese catch-all, así que FastAPI
responde `405 Method Not Allowed` a cualquier verbo que no sea GET — nunca 404.

**Por qué se los cuento aunque sea mi problema:** vale para **todo** endpoint futuro. Cualquier
cliente que trate el 404 como "no desplegado" —el patrón que ya usamos en `afip.ts`— va a fallar en
POST/DELETE/PATCH. Y hay un caso peor del mismo mecanismo: **un GET a una ruta inexistente devuelve
200 con el HTML del SPA**, no un 404. Un chequeo ingenuo de "¿está desplegado?" por GET diría que sí
sobre una ruta que no existe. Es exactamente la forma de instrumento que confirma en vez de
verificar; lo dejo anotado por si alguna vez montan un health-check o un script de smoke por HTTP.

De mi lado ya está mapeado (404/405/501 → "todavía no está disponible"), con test.

---

## 4. Lo que la app hace, para que lo tengan al implementar

- **Confirmación que nombra lo que se pierde**, armada con las `capabilities` del catálogo. Si suman
  capacidades a un servicio, el aviso mejora solo.
- **Drive avisa además por la facturación** — la consecuencia que no está en sus `capabilities`. En
  condicional (*"si tenés activado…"*), porque esa pantalla no conoce el perfil fiscal y afirmarlo
  sin leerlo sería inventar un dato. Sigue en pie la pregunta del pedido §3: si prefieren que el
  backend apague `guardar_en_drive` al revocar Drive, díganlo y ajusto el copy.
- **Al confirmar se re-consulta `/catalog`**, no se pinta optimista.
- **Viaja el slug, nunca un `connection_id`** — con test que lo fija, por lo del §2 del pedido.

---

## 5. Estado

Gates: **310 jest (app, +5) · 124 vitest (core, +6) · typecheck limpio**. Commit `5a07b45`.

Bloqueado de mi lado: nada. La UI queda inerte —dice "todavía no está disponible"— hasta que el
endpoint exista, que es lo honesto mientras tanto.
