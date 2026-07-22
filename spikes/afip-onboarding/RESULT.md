# RESULT — spike `afip-onboarding`

> **Fecha:** 2026-07-21 · **Dónde:** VPS `unreal-copilot` · **Ambiente:** homologación (`dev`)
> **Credenciales:** CUIT real del operador + clave fiscal, autorizadas explícitamente. Los valores no
> se transcriben acá: viven en `/root/.secrets/` del VPS (chmod 600) y en un `.txt` gitignored local.
> **Qué cierra:** el único tramo del producto que nunca se había ejercitado — el alta de un emprendedor
> que llega **sin certificado**. Todo lo anterior usaba el CUIT de testing compartido de AfipSDK, que ya
> viene con uno.

## Veredicto: 🟢 el onboarding automático funciona

```
[1] control      → {'AppServer': 'OK', 'DbServer': 'OK', 'AuthServer': 'OK'}
[2] createCert   → cert 1208 chars · key 1706 chars · "-----BEGIN CERTIFICATE-----"
[3] createWSAuth → {"status": "created"}
[4] con el cert nuevo → getLastVoucher(pto 1, tipo 11) = 4
```

El paso [4] es el que importa: **no alcanza con que AfipSDK devuelva un certificado**, hay que
comprobar que ese certificado efectivamente habla con el web service. Un alta que "salió bien" pero
deja un certificado que no puede facturar es exactamente el fallo que aparecería recién cuando el
usuario intenta su primera factura.

## 🐛 Bug encontrado — habría roto la primera alta real

El alias del certificado **no puede tener guiones**:

```
{"statusCode":400,"data_errors":{"alias":"El campo Alias del certificado solo puede
contener letras y numeros"}}
```

`ALIAS_CERT` estaba hardcodeado como `"copiloto-emprendedor"` en `afip_onboarding_activities.py`.
Corregido a `"copilotoemprendedor"`. **Ningún test unitario podía cazar esto** — el fake aceptaba
cualquier alias. Sólo aparece tocando el servicio real.

## Lo que ejercitó

El spike llama al **código real de F3** (`AfipGateway.crear_certificado` / `autorizar_web_service`), no
a un script paralelo. Lo que se probó es lo que se va a deployar.

## Estado del CUIT en homologación

- Último comprobante Factura C, punto de venta 1: **4** → las próximas serían 5 y 6.
- Certificado y key guardados en `/root/.secrets/afip-david-cert.json` (chmod 600, fuera del repo)
  para el E2E de emisión.

## Lo que NO prueba

- **Producción.** Esto fue homologación: el certificado no tiene efecto fiscal y las facturas que se
  emitan con él tampoco. Para producción hace falta `create-cert-prod` + punto de venta habilitado a
  web services + `production: true`.
- El alta vía el **workflow** de Temporal (se ejercitó el gateway directo). El workflow ya tiene sus
  tests contra el Temporal real, pero con activities falsas.
- Qué pasa si la clave fiscal es incorrecta o si AFIP pide 2FA — no se ejercitó ningún camino de error.
