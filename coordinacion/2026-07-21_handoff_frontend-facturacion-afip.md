# HANDOFF → sesión FRONTEND · Facturación AFIP

> **De:** sesión backend · **Fecha:** 2026-07-21 · **Estado del backend:** 🟢 TERMINADO Y VERIFICADO
> **Rama:** `feat/facturacion-afip-determinista` · worktree `../_copiloto-afip-wt` (6 commits)
> **Tu tarea:** F5 (Ajustes) y F6 (emisión + comprobante). El backend ya está: no hay que esperar nada.

---

## 0. Lo que ya funciona (no lo rehagas)

Emitir, generar el PDF, anular con nota de crédito y consultar — **verificado contra AFIP real, en
producción**, con el CUIT del operador:

| Comprobante | CAE | Estado |
|---|---|---|
| Factura C 0006-00000008 · $1000 | 86294776469171 | anulada por NC N° 1 |
| Factura C 0006-00000009 · $1000 | 86294777469313 | anulada por NC N° 2 |

459 tests verdes en el VPS. El alta ARCA (generar certificado desde usuario + clave fiscal) también está
probada de punta a punta.

**El flujo es DETERMINISTA: el LLM no interviene.** Vos mandás datos por endpoints, el backend valida con
reglas fiscales puras y decide. No hay prompt en el medio.

---

## 1. Contrato de API

Todo bajo `/afip/*`, todo con `Authorization: Bearer <jwt>` (el tenant sale del token, nunca del body).

### Ajustes — perfil fiscal y alta ARCA

```
GET  /afip/perfil?cuit=<cuit>          → {perfil: {...}|null}
POST /afip/perfil                       → {ok:true}  | 422 con [{codigo,campo,mensaje}]
     {cuit, razon_social, domicilio_comercial, condicion_iva,
      ingresos_brutos, inicio_actividades (YYYY-MM-DD), punto_venta}
     · condicion_iva ∈ "monotributo" | "responsable_inscripto" | "exento"

POST /afip/conectar                     → {ok:true, workflow_id, mensaje}
     {cuit, usuario, clave_fiscal}
GET  /afip/estado?cuit=<cuit>          → {conectado, ws_autorizados, perfil_completo,
                                           puede_facturar, onboarding:{paso, terminado, ok, motivo}}
```

`onboarding.paso` ∈ `iniciado · dando_de_alta · verificando · habilitado · fallido`. **Poleá `/afip/estado`
mientras `terminado` sea false**: el alta tarda minutos (AfipSDK entra al portal de ARCA por RPA).

### Facturación

```
POST   /afip/facturas                          {cuit}                 → {factura_id}
GET    /afip/facturas/{id}                                            → estado (ver §2)
POST   /afip/facturas/{id}/datos-venta         {fecha, concepto, condicion_venta,
                                                fecha_servicio_desde?, fecha_servicio_hasta?,
                                                fecha_vto_pago?}
POST   /afip/facturas/{id}/items               {descripcion, cantidad, precio_unitario, codigo?}
DELETE /afip/facturas/{id}/items/{indice}
POST   /afip/facturas/{id}/cliente             {condicion_iva, tipo_doc, nro_doc?, nombre?, domicilio?}
POST   /afip/facturas/{id}/confirmar           {token}                ← el token sale del estado
POST   /afip/facturas/{id}/cancelar
```

- `concepto`: 1 productos · 2 servicios · 3 ambos. **Con 2 o 3 las tres fechas de servicio son
  obligatorias** (el backend las exige y AFIP también).
- `tipo_doc`: 80 CUIT · 86 CUIL · 96 DNI · 99 consumidor final.
- `condicion_iva` del receptor: 1 RI · 4 exento · 5 consumidor final · 6 monotributo.
- Importes como **string** (`"1000.00"`), no float: son centavos, el float los rompe.

### Comprobantes

```
GET  /afip/comprobantes?cuit=<cuit>&limite=50  → {comprobantes:[{tipo_cbte, punto_venta, nro, cae,
                                                    cae_vto, fecha_emision, total, estado,
                                                    pdf_url, cbte_asoc_nro}]}
POST /afip/comprobantes/anular      {cuit, tipo_cbte, punto_venta, nro}  → {anulacion_id}
GET  /afip/anulaciones/{id}                                → {paso, original, errores, resultado}
POST /afip/anulaciones/{id}/confirmar
```

`estado` del comprobante ∈ `emitida · anulada · nota_credito`.

---

## 2. La máquina de estados (lo que devuelve `GET /afip/facturas/{id}`)

```json
{
  "estado": "esperando_confirmacion",
  "faltantes": [{"codigo": "sin_items", "campo": "items", "mensaje": "..."}],
  "items": [{"descripcion": "...", "cantidad": "1", "precio_unitario": "1000.00", "subtotal": "1000.00"}],
  "total": "1000.00",
  "token_confirmacion": "1:1000.00:99:0",
  "resultado": {"cae": "...", "nro": 9, "punto_venta": 6, "tipo_cbte": 11},
  "pdf": {"url": "https://...", "nombre": "...", "expira_at": null},
  "motivo": null,
  "terminado": false
}
```

`estado` ∈ `borrador → datos_venta_ok → items_ok → cliente_ok → esperando_confirmacion → emitiendo →
emitida → entregada`, con ramas `rechazada` y `cancelada`.

**El estado se DERIVA de los datos.** Si el usuario borra un ítem estando en `esperando_confirmacion`,
retrocede solo. No hay forma de quedar listo para emitir con la factura incompleta.

`faltantes[].codigo` es estable: usalo para resaltar el campo. `mensaje` ya viene redactado para mostrar.

---

## 3. Cinco cosas que el backend NO puede resolver por vos

**1. El primer estado puede mentir por ~1 segundo.** Al crear la factura, el workflow todavía está
cargando el perfil fiscal y `faltantes` puede traer `perfil_ausente`. **No es un error**: reconsultá hasta
que converja. Si mostrás el primer estado que llega, el usuario va a ver "falta cargar tus datos fiscales"
sobre un perfil que sí existe.

**2. El `token_confirmacion` cambia si cambian los datos.** Es a propósito: ata la confirmación al
contenido exacto que se mostró. Si el usuario edita algo después de ver el resumen y confirma con el token
viejo, el backend responde OK pero **no emite** — el estado sigue en `esperando_confirmacion` con un
`motivo`. Releé el token del estado justo antes de confirmar, y si aparece ese motivo, volvé a mostrar el
resumen.

**3. El PDF expira a las 24 h y NO lo re-hosteamos.** Decisión del operador. La card de descarga **tiene
que decirlo**: pasadas las 24 h el comprobante se baja del portal de AFIP. Un botón que falle en silencio
al otro día es peor que no ofrecerlo.

**4. "Anular" no es borrar.** Emite una **nota de crédito** — otro comprobante fiscal. El copy tiene que
nombrarlo. El competidor dice "cancelala" y eso sugiere una reversibilidad que no existe.

**5. Sin perfil fiscal completo, facturar va deshabilitado.** `puede_facturar` de `/afip/estado` es la
fuente: exige certificado **y** perfil. Mostrá el camino a Ajustes en vez de dejar que falle al final.

---

## 4. Pantallas

### F5 — Ajustes

Dos bloques. El de identidad ARCA lleva el flujo del competidor, que está bien resuelto (ver
`docs/copiloto-emprendedor/2026-07-21-benchmark-facturitas-flujo-whatsapp.md` §3):

1. **Perfil fiscal** — razón social, domicilio comercial, condición IVA, ingresos brutos, inicio de
   actividades, punto de venta. Se guarda con `POST /afip/perfil`, que **valida con las mismas reglas que
   la emisión**: si vuelve 422, pintá los campos con `detail[].campo`.
2. **Conectar con ARCA** — CUIT → confirmar identidad → recién ahí la clave fiscal. Debajo del campo de
   clave, el aviso de seguridad, no en un link aparte:

   > Tu clave fiscal no se guarda. Se usa una sola vez para vincular tu cuenta con ARCA y se descarta.

   Eso es literalmente cierto: la clave no se almacena en ninguna tabla ni queda en el historial de
   ejecución. **La pide una sola vez**, como pediste.

   Durante el alta, mostrá progreso real con `onboarding.paso` — no un "aguardá un momento" fijo.

### F6 — Emitir

Formularios paso a paso (no chat): datos de venta → ítems → cliente → **resumen** → comprobante.

- El resumen muestra todo lo que se va a emitir y los tres botones: **[Confirmar] [Cancelar] [Editar y
  confirmar]**. El tercero es el que evita rehacer todo por un dato mal cargado.
- El comprobante llega como card con el PDF + **[Guardar]** y **[Compartir]** (Web Share API), más el
  aviso de las 24 h.
- "Mis comprobantes" desde `GET /afip/comprobantes`, con la acción de anular.

Punto de entrada ya existente: `apps/mobile/src/modules/facturacion/PantallaFacturacion.tsx` (hoy es un
cascarón "PRÓXIMAMENTE"). Se monta dentro de `CapaFuncion`, que ya aporta vidrio y encabezado — **no
agregues fondo ni título propios**.

⚠️ **No existe un componente de input reutilizable** en `apps/mobile/src`: `PantallaLogin.tsx` usa
`TextInput` crudo. Vas a necesitar construir esa base primero; presupuestalo.

Gate visual: multi-tema, cero hex literales (`var(--token)`), y sumar los componentes nuevos al test de
`chatNoHexLiterals` si aplica al módulo.

---

## 5. Cómo probar sin romper nada

El backend está en la rama `feat/facturacion-afip-determinista`. Para levantarlo con AFIP real hace falta
`AFIP_ACCESS_TOKEN` en el env del servicio (hoy vive en `/root/.secrets/afip-spike.token` del VPS).

**Usá homologación para todo** (`ambiente="dev"`, que es el default del gateway): emite CAE real pero sin
efecto fiscal. Producción quedó verificada y no hace falta volver a tocarla — cada factura ahí es un
comprobante fiscal del operador.

E2E de referencia, que ejercita exactamente el mismo camino que va a hacer la app:
`spikes/afip-e2e/e2e_factura.py`.

---

## 6. Cuando termines

Dejá un handoff en esta misma carpeta avisando que la implementación está lista. **Hay un vigía
chequeando `coordinacion/` cada 10 minutos**, así que con dejar el archivo alcanza: la sesión de backend
lo detecta y corre el E2E completo desde el device, que es el DoD final del sprint.

Contame en ese handoff: qué quedó afuera, qué supuestos hiciste sobre el contrato, y cualquier lugar donde
el backend te haya obligado a un workaround — eso último es deuda mía, no tuya, y la quiero ver.
