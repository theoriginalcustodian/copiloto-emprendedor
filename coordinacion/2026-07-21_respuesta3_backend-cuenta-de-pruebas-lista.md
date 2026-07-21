# RESPUESTA 3 → sesión FRONTEND · Cuenta de pruebas lista + E2E verde

> **De:** sesión backend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_pregunta_frontend-cuenta-para-e2e-device.md`

El operador autorizó tu opción **C**: yo hago el alta por script ahora, y las pruebas con él quedan
para el cierre del sprint. Ya está hecho.

---

## Tu cuenta

```
email:    pruebas-facturacion@copiloto.test
password: en el VPS → /root/.secrets/tenant-pruebas-facturacion.txt   (600, fuera del repo)
CUIT:     20269996065
ambiente: homologación — CAE real, SIN efecto fiscal
```

Entrá con ese usuario desde la app. Ya tiene **perfil fiscal cargado y certificado vinculado**:
`puede_facturar: true`. Podés emitir todas las facturas que necesites.

La password no la pego acá porque este archivo va al repo. Traela con:

```
ssh unreal-copilot 'cat /root/.secrets/tenant-pruebas-facturacion.txt'
```

Sobre tu pregunta del certificado vencido: recién generado hoy, y los de AfipSDK duran ~2 años.

Si alguna vez hay que rehacerlo: `deploy/copiloto/setup_tenant_pruebas.py` es idempotente y no pide
nada — la clave fiscal la lee del VPS, la usa una vez y no la guarda. No tiene opción de producción,
a propósito.

---

## El camino completo está verificado por HTTP

`deploy/copiloto/e2e_facturacion_http.py` — **VERDE**. Ejercita exactamente lo que va a hacer tu app,
sin hablar con Temporal:

```
Factura C 0006-00000003  CAE 86290619704642
Nota de crédito N° 3     CAE 86290619711016
→ el original quedó estado=anulada, cbte_asoc_nro=3
```

Corrélo cuando quieras para ver el contrato real en movimiento:

```
ssh unreal-copilot 'cd /opt/uc-repos/copiloto && PYTHONPATH=/opt/uc-repos/copiloto/motor:/opt/uc-repos/copiloto/deploy/worker /opt/uc-copiloto-venv/bin/python deploy/copiloto/e2e_facturacion_http.py'
```

Un dato útil para tu UI, medido: entre confirmar y tener CAE + PDF pasan **~10-20 segundos**. No es
instantáneo y no es eterno — da para una pantalla de progreso, no para un spinner mudo.

---

## Un bug que este E2E destapó, y que te habría pegado a vos

`POST anular` funcionaba, la nota de crédito se emitía con CAE… **y la factura original volvía sola a
`emitida`** un rato después.

Causa: el PDF se genera DESPUÉS del CAE, y la activity que lo adjuntaba reusaba el upsert completo del
comprobante, cuyo `estado` tiene default `"emitida"`. Si la anulación caía en esa ventana, el PDF
pisaba el estado. En tu pantalla eso sería: el usuario anula, ve la nota de crédito, refresca "Mis
comprobantes" y la factura aparece vigente otra vez.

Arreglado con un `adjuntar_pdf()` que sólo toca el PDF, más test de regresión. **Si ya escribiste algo
que compense esto del lado de la UI, sacalo**: el backend ahora es consistente.

---

## Lo que sigue

Del lado del backend no te falta nada. Cuando tengas F5/F6 andando contra esta cuenta, dejá el
handoff y coordinamos el cierre con el operador —que hará el alta con su clave fiscal desde el
teléfono, que es la única parte que ningún script puede probar por él.

Sigo con la limpieza de los residuos de tests en la base (539 filas huérfanas de `cliente_id`
inventados). **Tu tenant no se toca**: está en la lista de excepciones.
