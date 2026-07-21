# HANDOFF → sesión FRONTEND · Guardado en Drive + detalle de factura al tocar la card

> **De:** sesión backend · **Fecha:** 2026-07-21
> **Estado: desplegado y verificado en el VPS.** Todo lo de abajo responde HOY.
> **Al terminar tu parte, avisame por acá** — el operador pidió que yo pruebe el flujo completo
> después de que vos termines. Ver §6, que tiene un matiz importante sobre eso.

---

## 0. Los dos pedidos del operador

1. **Guardar la factura en el Drive del emprendedor**, con un ajuste que lo autorice. Si el ajuste
   está apagado, avisar que el link de descarga muere a las 24 h.
2. **Al tocar una card de "Mis facturas", abrir un glass más chico** con toda la información del
   comprobante.

El backend de los dos está listo. Lo que sigue es tuyo.

---

## 1. Ajuste "Guardar mis facturas en Drive"

```
POST /afip/ajustes      { "cuit": "20269996065", "guardar_en_drive": true }
  200 -> { "ok": true, "guardar_en_drive": true }
  409 -> { "detail": "todavía no cargaste tus datos fiscales para ese CUIT" }
```

El valor actual se lee del perfil que ya pedís:

```
GET /afip/perfil?cuit=...  ->  { "perfil": { ..., "guardar_en_drive": false } }
```

**Default `false`.** Subir los datos fiscales de alguien a una cuenta de Drive no puede pasar sin que
lo pida.

**El 409 importa:** si el CUIT no tiene perfil no hay fila que actualizar, y un UPDATE sobre cero filas
"funciona" en SQL. Sin ese 409 el usuario vería el toggle prendido en pantalla y la base sin nada
guardado. Mostralo como "primero completá tus datos fiscales", no como error genérico.

**Requiere Drive conectado en Apps.** Si no lo está, el archivado falla con
`error_drive: ConnectionRequired` — la factura sale igual. Si podés, no dejes prender el toggle sin
Drive conectado, o al menos avisá.

---

## 2. Los campos nuevos de la factura

`GET /afip/facturas/{id}` (el que ya poleás) ahora trae **`drive`**:

```jsonc
"drive": { "guardado": true,  "file_id": "1tnAN…", "link": "https://drive.google.com/uc?id=…&export=download", "compartido": true }
"drive": { "guardado": false, "motivo": "desactivado" }              // el ajuste está apagado
"drive": { "guardado": false, "motivo": "error_drive: ConnectionRequired" }  // Drive no conectado
"drive": { "guardado": false, "motivo": "sin_pdf_para_archivar" }    // no hubo PDF que guardar
```

Y `GET /afip/comprobantes` suma **`drive_file_id`**, **`drive_link`**, **`doc_tipo`**, **`doc_nro`**,
**`receptor_nombre`**.

### El aviso de las 24 h cuelga del HECHO, no del ajuste

```js
const seSalvo = Boolean(c.drive_link);       // en el listado
// o, en el workflow:  estado.drive?.guardado
if (!seSalvo) mostrarAvisoDe24Horas();
```

**No lo cuelgues de `guardar_en_drive`.** Con el ajuste prendido y el archivado fallado, el aviso
igual tiene que salir: si no, el usuario cree que su factura está guardada y no lo está — peor que no
avisar nunca. Es la misma forma del bug que encontraste vos con `estado === 'emitida'`: la intención
no es el hecho.

### Descargar usa `drive_link`, y ojo con cuál link

`drive_link` es el `webContentLink` de Drive: **descarga el archivo**. El otro link que devuelve Drive
(`webViewLink`) abre el visor y el usuario termina en una página en vez de con su PDF. Ya te mando el
correcto; no lo cambies por el que aparezca en la UI de Drive.

**Orden sugerido para los botones:** si hay `drive_link`, usalo (no vence). Si no, `pdf_url` mientras
viva. El archivo de Drive queda compartido por link al guardarse —decisión del operador— así que
Compartir funciona sin llamadas extra.

---

## 3. ⚠️ CAMBIO DE CONTRATO: `terminado`

**Antes** se derivaba de la lista de estados terminales. **Ahora es un flag explícito del workflow:
"no voy a escribir nada más".** Fallaba en los dos bordes:

- La factura se marca `entregada` **antes** de archivarse en Drive. Cortando el polling ahí, `drive`
  quedaba `null` para siempre sobre una factura que segundos después sí tenía su copia. **Me pasó a mí
  escribiendo el E2E de esto** — el mismo error que vos documentaste ayer, cometido de nuevo.
- Una factura sin PDF queda en estado `emitida`, que no figuraba entre los terminales: `terminado`
  nunca se volvía `true` y el cliente poleaba para siempre un workflow ya cerrado.

**Para vos:** seguí cortando por `terminado` — ahora sí garantiza que `pdf` y `drive` ya están. Si en
algún lado quedó un corte por `estado`, ese es el que hay que sacar.

---

## 4. El glass de detalle (pedido 2)

**No hace falta endpoint nuevo.** Con la fila que `GET /afip/comprobantes` ya te da armás la pantalla
entera, sin ida y vuelta al servidor: el tap abre el glass con datos que ya tenés en memoria.

| Campo | Qué es |
|---|---|
| `nro`, `punto_venta`, `tipo_cbte` | número del comprobante (11=C, 6=B, 1=A) |
| `cae`, `cae_vto` | autorización de AFIP y su vencimiento |
| `fecha_emision`, `total` | |
| `receptor_nombre`, `doc_tipo`, `doc_nro` | **a quién se le facturó** — nuevo |
| `estado` | `emitida` · `anulada` · `nota_credito` |
| `cbte_asoc_nro` | si está anulada, el número de la NC que la anuló |
| `pdf_url` | link de AfipSDK — **vence a las 24 h** |
| `drive_link`, `drive_file_id` | copia permanente, si se archivó |

**`estado` en el listado no es el mismo vocabulario que en el workflow.** El listado sale de la base
(`emitida`/`anulada`/`nota_credito`); `entregada` es un estado del workflow y no aparece acá. Si tu
card compara contra `entregada` mirando el listado, nunca va a matchear.

**Las facturas anteriores a hoy no tienen `receptor_nombre`** (son 20 en el tenant de pruebas): el
campo viene `null`. No es un bug, es que el dato no existía. Manejá el vacío sin romper.

---

## 5. Cómo probarlo vos

```bash
ssh unreal-copilot
cd /opt/uc-repos/copiloto
/opt/uc-copiloto-venv/bin/python deploy/copiloto/e2e_archivado_drive.py
```

Corrida de hoy, toda verde:

```
[1] ajuste APAGADO   → CAE=86290621776176 · drive={"guardado": false, "motivo": "desactivado"}
[2] ajustes          → 409 sin perfil · 200 con perfil · releído: guardar_en_drive=True
[3] ajuste PRENDIDO sin Drive → CAE=86290621776472 · estado=entregada · la emisión NO se rompe
[4] archivado REAL   → PDF de AFIP subido al Drive real, compartido,
                       y descargado SIN credenciales devolviendo %PDF
```

Y el detalle del receptor: factura N° 15 a "Juan Pérez SRL", releída del listado con `doc_tipo=80`,
`doc_nro=20111111112`, `receptor_nombre="Juan Pérez SRL"`.

---

## 6. Lo que te pido, y un matiz sobre "probar desde el teléfono"

**Avisame cuando termines tu parte.** El operador quiere que yo pruebe el flujo completo después.

Pero seamos exactos con qué puedo probar yo: **no tengo el teléfono.** Puedo ejercitar el camino HTTP
que usa la app —y lo hago, es lo de arriba— pero *"tocar la card y ver si abre el glass"* no lo puede
verificar ningún script mío. Eso lo probás vos en device, o el operador.

Esa distinción ya nos costó caro dos veces esta semana: el gate de jsdom no vio que el teclado tapaba
el campo de la clave fiscal, y mi E2E HTTP no habría visto nunca que el `ScrollView` dejaba de
scrollear. **Verde por HTTP no es verde en device.**

Entonces, propongo el reparto:
- **Vos:** el glass de detalle, el toggle de ajustes y los botones, probados en device con captura.
- **Yo:** el backend por HTTP contra el VPS + reviso cualquier hallazgo tuyo del lado del servidor.
- **El operador:** la pasada final con las dos cosas juntas.

---

## 7. Una deuda que sigue abierta y ahora se nota más

**Las notas de crédito no generan PDF** (TODO en `afip_anulacion_workflow.py`). Con el archivado en
Drive esto queda más visible: la factura original va a tener su copia permanente y la NC que la anula
no va a tener nada. Sigue sin ser de este sprint, pero cuando se implemente, el archivado la toma sola
—es el mismo camino— sin que vos toques nada.

---

## 8. Tu pregunta sobre el bloqueo de clave en ARCA

**No tengo el número firme** y coincido con vos: no es algo para averiguar gastando intentos de la
clave del operador. No pongas "te quedan N intentos" con una cifra inventada — un número falso ahí es
peor que no decir nada. Si querés algo en el copy, algo como *"si fallás varias veces seguidas, ARCA
puede bloquear tu clave"* es cierto sin comprometerse a un número que no verificamos.
