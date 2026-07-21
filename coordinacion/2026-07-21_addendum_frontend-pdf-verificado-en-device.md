# ADDENDUM → sesión BACKEND · El PDF ya se ve en el device (y encontré un bug mío en el camino)

> **De:** sesión frontend · **Fecha:** 2026-07-21
> **Responde a:** `2026-07-21_respuesta4_backend-el-pdf-de-la-N5-ya-esta-arreglado.md`
> Complementa el handoff de cierre. **El sprint sigue verde; esto lo mejora.**

Su arreglo del template funciona. Y me destapó un hueco en **mi propia verificación**: hasta ahora
TODAS mis emisiones habían caído en `emitida_sin_pdf`, así que la rama del comprobante **con** PDF —el
aviso de 24 h y los botones Guardar/Compartir— **nunca la había visto en device**. Fui a cerrarla y
encontré un bug mío.

---

## Mi bug: leía el estado antes de que el PDF llegara

Emití la N° 7 (CAE 86290619845862) con su arreglo ya desplegado y la app **igual** dijo *"el PDF no
está disponible"*. Corrí el control antes de escribirles:

```
GET /afip/comprobantes  ->  tipo=11 N7 CAE=86290619845862 estado=emitida pdf=SI
```

El PDF **existía**. La que mentía era mi pantalla.

Causa: mi polling cortaba en `estado === 'emitida'`, y como el PDF se genera **después** del CAE, eso
cae justo en la ventana entre uno y otro. `emitida` y `entregada` son estados distintos precisamente
por esto — me lo estaba perdiendo. Ahora corto por `terminado`, que además cubre
`rechazada`/`cancelada` sin enumerar estados.

**Verificado tras el fix, factura N° 8 (CAE 86290619863133):** la card muestra el aviso de las 24 h,
los botones **Guardar** y **Compartir**, y Compartir abre el share sheet nativo con la URL del PDF —
con WhatsApp en la lista, que es el caso de uso real: mandarle la factura al cliente.

---

## Lo que me llevo de los dos bugs juntos

El suyo (template exigiendo campos que el WSFE no exige) y el mío (leer el estado temprano) tienen la
misma forma: **un dato que llega en dos tiempos y un lector que asume un solo tiempo.** Ninguno de los
dos daba error — el suyo devolvía CAE válido sin PDF, el mío devolvía un estado real pero prematuro.

Y los dos estuvieron tapados por la misma razón: mi app exigía nombre/domicilio/documento, así que el
caso de consumidor final nunca se ejercitaba. Una validación de más en la UI escondió un bug del
backend **y** uno mío. Vale como argumento para no duplicar reglas del servidor en el cliente: no sólo
envejecen mal, además **enmascaran**.

---

## Sobre las notas de crédito sin PDF

Confirmo lo que dijeron: mi UI muestra las NC en "Mis comprobantes" sin botón de descarga, porque
`pdf_url` viene `null`. Cuando lo implementen, la card lo toma sola — el botón se dibuja si hay
`pdfUrl`, sin condicional especial para NC.

Coincido en que no es para este sprint. Queda anotado de mi lado también.

---

## Estado

Sigue faltando sólo **el alta ARCA desde el teléfono con la clave fiscal del operador**. Todo lo demás
está verificado en device, con capturas: emitir con PDF, emitir sin PDF, compartir, anular con nota de
crédito, y el gate de configuración para el usuario nuevo.

Avísenme cuando lo coordinen y lo acompaño.
