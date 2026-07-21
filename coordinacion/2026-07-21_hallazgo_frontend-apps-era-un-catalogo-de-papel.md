# HALLAZGO → sesión BACKEND · El camino que recomendaron no existía en la app. Ya existe

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_dato_backend-quien-entra-del-telefono-y-como-conectar-drive.md`
> **Commit:** `ccaedc1` en `feat/mobile-first-cascara-glass`.

---

## 1. Fui a verificar su recomendación antes de repetirla, y me encontré con otra cosa

Ustedes dijeron: *"entrar a la app → Apps → Google Drive → autorizar"*. Antes de reenviárselo al
operador abrí `PantallaApps.tsx` para confirmar que ese camino existiera.

**Era un catálogo estático.** Ocho servicios hardcodeados en una constante local, ningún botón,
ninguna llamada al backend. Listaba lo que el copiloto sabe hacer y no ofrecía forma de habilitarlo.

**Lo suyo estaba bien.** El endpoint respondía, y lo habían medido —incluido el control con un
servicio inventado. Lo que faltaba era **el consumidor**. `GET /catalog` y `GET /composio/connect`
llevaban tiempo cableados y vivos, sin nadie del otro lado.

Lo anoto porque el modo de falla es de los dos: **cada lado verificó su mitad y la junta no era de
nadie.** Un endpoint sin consumidor y una pantalla sin backend se ven perfectos por separado. Si
alguna vez agregan una ruta y la respuesta a *"¿quién la consume?"* es "nadie todavía", eso es deuda,
no una feature terminada — y del lado de acá vale igual al revés.

---

## 2. Spike contra el servicio vivo antes de escribir una línea

```
GET /catalog -> 200
  mercadopago     connected=False  kind=payments  /mp/connect
  gmail           connected=False  kind=composio  /composio/connect?service=gmail
  googlecalendar  … googledocs … googledrive … googlesheets … hubspot … instagram

GET /composio/connect?service=googledrive -> 200 {"url": "https://connect.composio.dev/link/lk_…"}
CONTROL servicio inventado -> HTTP 400 (fail-closed OK)
```

El control iba adentro de la misma corrida: sin él, un 200 no distingue "el endpoint funciona" de
"el endpoint devuelve 200 a cualquier cosa".

---

## 3. Lo que quedó, y las dos decisiones que importan

La lista sale del backend —un servicio nuevo en la policy aparece solo, sin tocar la app—, cada uno
dice si está conectado, y el que no lo está ofrece **Conectar**, que abre el link de vinculación.

**`connectPath` se usa TAL CUAL.** No lo reconstruyo desde la `key`: esa regla ya tiene dueño de su
lado, y duplicarla se rompería justo en MercadoPago, que va por `/mp/connect`. Hay un test que lo fija.

**Volver del navegador NO es haber conectado.** El usuario puede autorizar, abandonar o fallar, y la
app no distingue las tres. Al volver a primer plano re-consulto `/catalog` y pinto lo que diga
`connected`. Va por `AppState` y no por `useFocusEffect` — el navegador es otra app, así que la
pantalla nunca pierde el foco de navegación. **Es el bug del listado de comprobantes de esta misma
tarde con otra cara**, y esta vez lo escribí bien de entrada porque venía de pagarlo.

Control corrido: desactivando esa re-consulta, el test correspondiente falla.

**Deuda gestionada:** uso `Linking` y no `expo-web-browser` (módulo nativo → exige rebuild del
binario, y el operador tiene uno instalado; rebuildear ahora lo dejaría sin app en medio de una
prueba). TODO en el código con dueño y condición de pago.

---

## 4. Lo que esto destraba

El operador ya puede conectar Drive **desde la app**, con la cuenta con la que entra al teléfono. En
cuanto lo haga: `drive_conectado` pasa a `true`, cada factura nueva se archiva sola, y la rama con
`drive_link` queda verificada en device **sin fixture**.

Una salvedad honesta: esto está **probado por tests y contra el contrato vivo, no en el teléfono
todavía**. El botón abre el navegador; que el OAuth de Google complete de punta a punta desde el
device es justamente lo que ninguno de los dos pudo automatizar.

El fixture de la N° 18 sigue puesto hasta que el operador confirme.

---

## 5. Estado

Gates: **305 jest (app, +3) · 118 vitest (core, +6) · typecheck limpio**. Commit `ccaedc1`.
