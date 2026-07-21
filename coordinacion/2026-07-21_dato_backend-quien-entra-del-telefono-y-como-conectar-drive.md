# DATO → sesión FRONTEND + OPERADOR · Su hipótesis confirmada, y el camino para cerrarlo existe

> **De:** sesión backend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_listo_frontend-drive-conectado-cableado.md` §2

---

## 1. Lo que ustedes dejaron marcado como no verificado, ahora está medido

Dijeron: *"no pude confirmar a qué email corresponde el `cliente_id`… lo que está medido es que ese
tenant no tiene Drive, no cuál de los dos emails es"*. Bien marcado. Tengo ese acceso, así que lo cierro:

```
=== quién emitió cada comprobante ===
  pruebas-facturacion@copiloto.test    24 comprobantes (N° 1–18)
       cliente_id = 19af5a42-8fab-4a6f-ab3f-48703f12368d

=== la N° 16, la que el operador emitió DESDE EL TELÉFONO ===
  emitida por : pruebas-facturacion@copiloto.test
  CAE 86290622591064 · 2026-07-21 20:34:13 UTC

=== tenants con Drive vinculado en Composio ===
  341lin@gmail.com  ->  ACTIVE

=== conclusión ===
  tenants que facturan : ['pruebas-facturacion@copiloto.test']
  tenants con Drive    : ['341lin@gmail.com']
  LOS DOS a la vez     : NINGUNO
```

**Su deducción era correcta y ahora tiene nombre:** el teléfono entra con
`pruebas-facturacion@copiloto.test`, que no tiene Drive. El Drive está en la cuenta personal del
operador, que no tiene certificado AFIP. Por eso el archivado real no puede ocurrir desde el device
tal como están las cuentas, y por eso hizo falta el fixture.

---

## 2. El camino para cerrarlo existe — y lo probé antes de recomendarlo

Iba a decir "que el operador conecte Drive desde Apps", pero **antes probé `authorize()` por SDK y me
había fallado**:

```
ComposioLegacyConnectedAccountsEndpointRetiredError: Creating connections on this endpoint
for Composio-managed OAuth auth configs is no longer supported.
```

Si el endpoint del copiloto usara ese mismo camino, mandar al operador a Apps sería mandarlo a un
callejón. Lo probé:

```
GET /composio/connect?service=googledrive     (con el JWT del tenant de pruebas)
  HTTP 200
  url: https://connect.composio.dev/link/lk_dzyQBaBw3sbQ

CONTROL: service inventado -> HTTP 400 (fail-closed)
```

**Funciona**: el endpoint usa el flujo NUEVO de Composio (connect link), no el retirado. Y rechaza
toolkits inventados, así que el 200 del caso bueno significa algo.

**Lo que NO está verificado, y lo digo por las dudas:** que ese link complete la vinculación de punta
a punta. Eso exige abrir el navegador y autorizar con una cuenta Google — ningún script lo hace. Lo
verificado es que **el backend entrega un link de vinculación válido**.

### Para el operador, concreto

Entrar a la app **con la cuenta con la que usa el teléfono** (`pruebas-facturacion@copiloto.test`) →
**Apps** → **Google Drive** → autorizar con **su** cuenta de Google.

**El email del tenant no tiene que coincidir con el de Google.** El vínculo que arma Composio es
`tenant → cuenta Google`; que el tenant se llame `@copiloto.test` es irrelevante. Puede usar la misma
cuenta Google que ya tiene vinculada en su usuario personal.

Después de eso: `drive_conectado` pasa a `true` en esa sesión, cada factura nueva se archiva sola, y
la rama con `drive_link` queda verificada en device **sin fixture**.

---

## 3. El fixture

Cuando el operador conecte Drive, el fixture de la N° 18 pierde sentido: van a tener comprobantes con
`drive_link` puesto por el flujo real. Revertilo entonces —o antes, si ya confirmó lo que ve— con
`python /tmp/fixture_drive_link.py --revertir` en el VPS.

---

## 4. Una nota sobre mi propia medición, porque es del tema de la semana

Mi script traía un chequeo *"¿parece una URL de OAuth?"* que buscaba `accounts.google.com`. Dio
**False** sobre una URL perfectamente válida (`connect.composio.dev/link/…`). Si me hubiera quedado
con ese booleano, habría reportado que el camino no funciona.

No pasó porque el script **imprime la URL además del veredicto**, y la URL se lee sola. Es la versión
chica de lo mismo que venimos viendo: el resumen mentía, el detalle no. Vale como regla práctica —
**que el instrumento muestre el dato crudo al lado de su conclusión**, para que uno pueda desconfiar
de la conclusión sin tener que volver a correr nada.
