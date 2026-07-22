---
name: copiloto-oauth-google-propio
description: Conectar apps de Google lleva al dashboard de Composio porque usamos SU app OAuth; el arreglo es cliente propio, y los scopes que se pidan deciden si Google exige auditoría paga
metadata:
  type: project
---

# 🔑 El OAuth de Google es de Composio, no nuestro — y los scopes deciden el costo del trámite

**Abierto el 2026-07-21. Bloquea la adopción real de Apps** (Drive, Gmail, Docs, Sheets, Calendar).
Runbook completo para ejecutar:
`docs/copiloto-emprendedor/2026-07-21-runbook-oauth-google-propio.md` (en la rama de facturación).

## El síntoma y la causa

*"Cuando quiero conectar las apps me redirige a una pantalla de login de Composio, no a la OAuth de
Google"*. **No es un bug nuestro.** Medido contra la API real: 7 de 8 auth configs son
`is_composio_managed=true`, y para ésas Composio **retiró** `initiate` (400
`ComposioLegacyConnectedAccountsEndpointRetiredError`) dejando sólo su link hospedado, que resuelve a
`dashboard.composio.dev`. El endpoint del copiloto entrega el único link que la cuenta permite hoy.

Para un producto que se vende no se sostiene: el emprendedor pasa por la pantalla de un tercero que no
es Google ni nosotros.

## 🔴 Lo que casi se cuela sin mirar: los scopes por defecto son los CAROS

Google clasifica los permisos en **no sensible → sensible → restringido**, y el nivel decide el
trámite: restringido exige **auditoría de seguridad por un tercero pago**, de meses. Lo que Composio
pide por defecto cae justo ahí:

- `https://mail.google.com/` — leer, enviar y **borrar** todo el correo → **restringido**
- `https://www.googleapis.com/auth/drive` — todo el Drive → **restringido** (lo piden los *tres*:
  drive, docs y sheets)
- más `contacts.readonly`, `user.birthday.read`, `user.phonenumbers.read`, `user.addresses.read`

Nadie lo elige: viene puesto. Si el trámite se hace sin mirar, la app queda atada a una auditoría cara
por funciones que no usamos.

## La decisión del operador (2026-07-21): ningún permiso restringido

```
userinfo.email · userinfo.profile · gmail.send · drive.file · documents · spreadsheets · calendar.events
```

**El hallazgo que lo hizo posible:** `drive.file` (no sensible) es aceptado **también** por las APIs de
Docs y Sheets — verificado en la doc oficial de cada una. Así Drive queda acotado a los archivos que
el copiloto crea, sin perder capacidad. Y como `documents`/`spreadsheets` son **sensibles pero no
restringidos**, incluirlos no cambia el tipo de verificación: el copiloto puede trabajar con
documentos que el emprendedor ya tiene, gratis en términos de trámite.

Lo que se resigna: **leer el correo** (`gmail.readonly` es restringido) → `GMAIL_FETCH_EMAILS` no
funciona. Diferido hasta que haya usuarios pidiéndolo; *«mejor tener el producto andando que pagar una
auditoría por una función que nadie usó»*.

## Datos que no se adivinan

- **Redirect URI**, exacto y sin barra final — sale de la propia API de Composio, que lo declara como
  default de los cinco toolkits: `https://backend.composio.dev/api/v1/auth-apps/add`.
  Si no coincide carácter por carácter → `redirect_uri_mismatch`.
- **Modo Testing: los permisos caducan a los 7 días** (verificado en la doc de Google). Cada usuario
  reconecta una vez por semana. ⚠️ Cuando algo "se desconecte solo", es esto — no un bug.
- Tipo de credencial: **Aplicación web**, aunque el cliente sea móvil: el intercambio del token lo
  hace el servidor de Composio.

## 🔴 Deuda de código que hay que pagar ANTES de crear las configs

`motor/clients/agent/providers/composio_gateway.py:_auth_config_id` devuelve **la primera** auth
config del toolkit. Con la nuestra y la de Composio conviviendo, elige una de las dos **sin criterio y
sin error**: el síntoma sería "a veces conecta bien y a veces va al dashboard". Hay que preferir
explícitamente la no-gestionada.
**Propietario:** BACKEND. **Condición de pago:** antes de crear la primera auth config custom.

Y `authorize()` usa `connected_accounts.link` (el hospedado). Con config propia, `initiate` debería
volver a estar disponible y llevar directo a Google — `[ASSUMED_PENDING_VERIFY]`: es lo que el mensaje
de error implica por contraste y `telegram` (única `managed=False` de la cuenta) prueba que el tipo
existe, pero no se confirma sin credenciales reales.

## El paso que no se saltea al tener las credenciales

**Ejecutar una tool de cada toolkit con una cuenta conectada.** Recortar scopes es lo correcto, pero
si alguno quedó corto la tool falla en **runtime** (`insufficientPermissions`), no al conectar. Hay que
verlo funcionar, no suponerlo. Y hay que reconectar las cuentas viejas: quedan atadas a la config
anterior.

## Fuera de este trámite

**Play Store es aparte** y no depende de esto. Ahí lo que suele pinchar es el cobro (Google exige su
facturación para bienes digitales — MercadoPago puede chocar) y el permiso de micrófono del dictado.
`[PENDIENTE VERIFICAR]` — no medido, anotado para que no aparezca de sorpresa.

Ver también [[copiloto-servicios-composio-plugin]] y [[composio-gateway-ladrillo]].
