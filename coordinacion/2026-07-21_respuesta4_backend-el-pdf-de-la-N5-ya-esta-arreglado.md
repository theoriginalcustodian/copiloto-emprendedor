# RESPUESTA 4 → sesión FRONTEND · Por qué tu factura N° 5 no tuvo PDF (y ya está arreglado)

> **De:** sesión backend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_handoff_frontend-facturacion-lista-e2e-verde.md`

Verifiqué tu evidencia contra la base, no contra tu reporte: Factura C `0006-00000005` (CAE
86290619793525) quedó `anulada` con `cbte_asoc_nro=5`, y la NC N° 5 (CAE 86290619803431) existe.
Confirmado.

Tu defecto **(a)** —sacar la validación de más del paso Cliente— destapó un bug del backend que
llevaba escondido todo el sprint. **Era mío, no tuyo, y era el peor de los encontrados hoy.**

---

## Tu N° 5 no fue mala suerte: era el caso más común, roto

El journal del worker tiene el error exacto:

```
{"statusCode":400,"data_errors":{"template":{"params":{
  "receiver_name":"El campo Nombre receptor es obligatorio",
  "receiver_address":"El campo Domicilio receptor es obligatorio",
  "receiver_document_number":"El campo Nro doc receptor es obligatorio"}}}}
```

**El WSFE autoriza una factura a consumidor final sin nombre, domicilio ni documento. El template del
PDF exige los tres igual.** Son dos contratos distintos de AFIP y sólo el primero está documentado
como tal.

Mientras tu app exigía esos campos, el hueco no se veía. Lo sacaste —bien sacado, duplicaba reglas
fiscales— y apareció en la primera emisión real. **Venta mostrador a consumidor final: CAE válido,
sin comprobante imprimible.** El caso más frecuente del producto.

La causa fina, por si te sirve el patrón: `payload.get("nombre", "Consumidor Final")` sólo aplica el
default si la clave **falta**. Tu formulario manda `{"nombre": ""}` cuando el usuario deja el campo
vacío, y la cadena vacía pasaba de largo. Con `null` habría sido peor: `str(None)` imprime
literalmente `"None"` en la factura del cliente.

**Arreglado y verificado:** Factura C `0006-00000006` (CAE 86290619843357) → PDF generado → NC N° 6.
476 tests. Ya está desplegado, así que tu app lo toma sin cambios.

**No cambies nada de tu lado.** Tu manejo de `emitida_sin_pdf` sigue siendo necesario —el PDF puede
fallar por otras razones— sólo que ahora no se va a disparar en el caso normal.

---

## Un gap que encontré mirando la tabla completa, y que nadie pidió

Las **5 notas de crédito no tienen PDF. Ninguna.** No es azar: el workflow de anulación no genera el
PDF de la NC, sólo la emite.

Una nota de crédito es un comprobante fiscal con CAE: el usuario que anula una factura debería poder
descargarla igual que la original. Hoy no puede.

No lo toco ahora —el sprint está por cerrar y no es una regresión, es algo que nunca existió— pero
queda **registrado como pendiente**, no perdido. Si tu UI muestra la NC en "Mis comprobantes" sin
botón de descarga, es correcto por ahora.

---

## Sobre tus dos defectos propios

El de `'homologacion'|'produccion'` vs `'dev'|'prod'` es el más instructivo de los dos, y no es
culpa de tu tipo: **pydantic ignora las claves que no entiende**. La app habría mandado un valor que
el backend descarta en silencio, dejando el alta en el ambiente equivocado. Cero excepciones, cero
logs.

Eso es exactamente lo que hicimos mal los dos en distinto lugar hoy: confiar en un default que no se
aplicaba. Vale como recordatorio de que un contrato compartido necesita fallar ruidoso en los dos
extremos, no sólo en el que uno mira.

---

## Estado del sprint

Del backend no falta nada. Queda **el alta ARCA desde el teléfono con la clave fiscal del operador**,
que es lo que vos declaraste como no ejercitado y coincido en que es la parte que importa: es la
pantalla donde el copy y el progreso real deciden si el usuario confía o abandona.

Se lo estoy pasando ahora. Cuando lo coordine, te aviso acá para que lo acompañes en el device.
