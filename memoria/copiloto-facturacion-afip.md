---
name: copiloto-facturacion-afip
description: Facturación AFIP en el Copiloto — backend Y frontend TERMINADOS, E2E verde desde el device. Falta sólo el alta con la clave fiscal del operador. Arquitectura determinista con Temporal. LEER PRIMERO al retomar facturación.
metadata:
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-07-21T17:03:18.111Z
---

**Facturación electrónica AFIP/ARCA.** Estado al **2026-07-21**: 🟢 **backend Y frontend terminados; E2E verde desde el device** (frontend emitió y anuló con CAE real desde un SM-A217M). Rama `feat/facturacion-afip-determinista` → **PR #6 abierto** (5 commits); frontend en `feat/mobile-first-cascara-glass`. **Falta SÓLO el alta ARCA desde el teléfono con la clave fiscal del operador** — lo único que ningún script puede probar por él. Coordinación completa en `coordinacion/2026-07-21_*`.

**🎯 ARQUITECTURA:** flujo **DETERMINISTA — el LLM NUNCA interviene en el camino de decisión.** Máquina de estados durable en Temporal. **Dos caminos:** (1) determinista = v1 HECHA; (2) el agente se entrena DESPUÉS sobre el MISMO núcleo. Un solo validador (`afip_rules.py`, puro) y una sola máquina de estados; lo único que cambia es quién llena los slots.

**🔐 CLAVE FISCAL — NO se almacena.** Se usa para generar el certificado y se descarta. ⚠️ **Tampoco puede pasar como argumento de workflow/activity**: los args quedan en claro en el event history PARA SIEMPRE. Solución: **claim-check** (`afip_secret_handoff`, TTL 15 min, `DELETE...RETURNING`). Verificado leyendo el history real.

**🌐 AMBIENTE = DOS CREDENCIALES, no un flag.** El certificado se emite contra un ambiente concreto: homologación y producción son credenciales distintas. Unique `(cliente_id, cuit, ambiente)` + único parcial `WHERE activo` (una sola activa). Cambiar de ambiente = toggle, NO re-alta. Default `dev` en TODA la superficie: si el campo se pierde en un refactor, el peor caso es una factura de prueba, no un comprobante fiscal real.

**🐛 BUGS QUE SÓLO APARECIERON CONTRA AFIP/DEVICE REAL (ninguno lo cazaba un unit test):**
1. **Alias del certificado sin guiones** (`copilotoemprendedor`) — habría roto la PRIMERA alta real.
2. **`voucherNumber` camelCase**, no como dice la doc.
3. **`afip.py` faltaba en el venv** del copiloto.
4. **Concepto servicios (2/3) exige `billing_from`/`billing_to`/`payment_due_date` en el PDF.** Costó una factura REAL en producción.
5. **La emisión estaba clavada a homologación**: la fábrica construía `AfipGateway(cuit, cert, key)` sin `production` → un tenant con credencial de prod no podía emitir por el camino del producto (sólo por script, que es como se había probado).
6. **El PDF "desanulaba" facturas**: se adjuntaba con `registrar()` —upsert completo con `estado` default "emitida"— y como el PDF se genera DESPUÉS del CAE, una anulación en esa ventana se perdía. Fix: `adjuntar_pdf()`, UPDATE parcial.
7. **Consumidor final emitía con CAE y SIN PDF** (el caso MÁS COMÚN). El WSFE autoriza sin nombre/domicilio/documento; **el template del PDF los exige igual**. Estaba tapado por una validación de más del frontend; salió en la primera emisión real desde el device. Causa fina: `payload.get(k, default)` sólo cubre la clave AUSENTE, y el formulario manda `""`. Fix en `afip_rules.receptor_desde_payload`.
8. **El borrador sin certificado nacía terminal** como `rechazada` → se lee como "AFIP rechazó tu factura". Ahora `POST /afip/facturas` devuelve **409** sin abrir workflow.

**🔑 LECCIÓN TRANSVERSAL (la más cara del sprint):** *lo que AFIP acepta **autorizar** y lo que acepta **imprimir** son dos contratos distintos, y sólo el primero está documentado.* Dos de los ocho bugs son exactamente eso (4 y 7).

**🧱 ARCHIVOS (`apps/copiloto/`):** `afip_rules.py` (validador PURO: R1-R11, máquina de estados, payloads WSFE y PDF, NC, `receptor_desde_payload`) · `afip_gateway.py` (`RechazoAfip` vs `ErrorAfip`) · `afip_credential_store.py` (cert cifrado + perfil + claim-check + `ClaveFiscal` que enmascara `__repr__` + `ambientes_vinculados`/`activar`) · `afip_comprobante_store.py` (`adjuntar_pdf` ≠ `registrar`) · `afip_{onboarding,factura}_{workflow,activities}.py` · `afip_anulacion_workflow.py` · `afip_web.py` (16 endpoints). **Scripts en `deploy/copiloto/`:** `smoke_afip_http.py`, `e2e_facturacion_http.py`, `setup_tenant_pruebas.py`, `limpiar_residuos_test.py`.

**🧪 Cuenta de pruebas:** `pruebas-facturacion@copiloto.test`, password en `/root/.secrets/tenant-pruebas-facturacion.txt` (600), CUIT del operador, homologación. Recrear con `setup_tenant_pruebas.py` (idempotente, sin opción de producción).

**📁 Archivado en Drive + detalle del receptor (2026-07-21 tarde — `87ea448` / `8ed01c4`):**
- El PDF de AfipSDK **expira a las 24 h** y no se re-hostea. Ahora se copia al Drive DEL EMPRENDEDOR con `GOOGLEDRIVE_UPLOAD_FROM_URL` (baja la URL server-side: el PDF nunca pasa por nuestro front-door). Flujo: `FIND_FOLDER` → `CREATE_FOLDER` si falta → `UPLOAD_FROM_URL` → `CREATE_PERMISSION anyone/reader`. Ajuste `afip_perfil.guardar_en_drive`, **OFF por default**, vía `POST /afip/ajustes` (409 si no hay perfil: un UPDATE sobre 0 filas "funciona" en SQL y el toggle quedaría prendido sobre nada).
- **Medido contra el Drive real:** un archivo recién subido da **HTTP 401** a un extraño; con `anyone/reader`, 200 y `%PDF`. `UPLOAD_FROM_URL` devuelve `webContentLink` **y** `webViewLink` en la misma respuesta — **Descargar usa el primero**; el segundo abre el visor, no el archivo.
- **Decisión del operador (deliberada):** se comparte al ARCHIVAR, no al tocar "Compartir", para que compartir no dependa de una llamada de red justo cuando el usuario manda la factura. Costo: link permanente por comprobante, con datos del CLIENTE del emprendedor.
- Falla **blando siempre**: una factura con CAE es un hecho fiscal. `confirmed=True` en el gateway porque el gate HITL es para lo que decide el AGENTE; acá autorizó el usuario en Ajustes.
- **`terminado` dejó de derivarse del estado** → flag explícito del workflow. Ver [[dato-en-dos-tiempos-lector-de-un-tiempo]]: la factura se marca `entregada` ANTES de archivarse, y una sin PDF quedaba en `emitida` (no terminal) poleando para siempre.
- **`receptor_nombre`**: el WSFE identifica por tipo+número de documento, así que el NOMBRE nunca se guardaba. Parámetro con default en `emitir_comprobante` (si no, rompe el replay de ejecuciones de 5 args). NULL, no `""`, cuando no hay.
- **Migraciones aditivas → `apps/copiloto/afip_migrations.sql`.** `provision_tables.py` usa `CREATE TABLE IF NOT EXISTS` y su guard ABORTA si faltan columnas: sirve para instalar de cero, no para reconciliar una tabla viva.
- **`drive_conectado` en `GET /afip/estado` = TRES estados** (`true`/`false`/**`null`**). `null` es "no pude averiguarlo" (Composio caído o no cableado) y **no** es `false`: colapsarlos hace que una caída del proveedor muestre "conectá tu Drive" a quien lo tiene conectado — un rastro pisando el hecho. `EXPIRED` cuenta como `false` (existe pero no sirve para subir). Va en LAS DOS ramas del endpoint: la del tenant nuevo devuelve un dict aparte y omitirlo lo dejaba `undefined` justo en la pantalla del usuario nuevo. **Patrón reusable para cualquier booleano que dependa de un tercero.**
- **⚠️ Sin test unitario del `FacturaWorkflow`** (deuda registrada, propietario operador): el entorno de test de Temporal no lo sostiene — time-skipping mata el `wait_condition` sin límite del HITL, `start_local` no levanta en el VPS. Cubierto por `deploy/copiloto/e2e_archivado_drive.py` contra el worker real.

**⚠️ DEUDA GESTIONADA ABIERTA:** (0) **los 6 endpoints de signal devuelven `{"ok": true}` sin saber si el workflow aceptó** — medido: `confirmar` con token inválido da 200 y no emite nada; el cliente sólo lo distingue poleando `motivo_codigo`. TODO en `afip_web.py`, propietario operador, fix propuesto `202 Accepted` + `{"aceptado": true}` (requiere coordinar con release del frontend). (1) **la nota de crédito NO genera PDF** — TODO en `afip_anulacion_workflow.py`, propietario operador, pago antes de producción. (2) Tope de consumidor final sin identificar `[PENDIENTE VERIFICAR]`. (3) **QR: el template declara `ARS` donde AFIP usa `PES`** — el operador lo declaró fuera de nuestro alcance. (4) Factura A/B no implementadas (fallan ruidoso a propósito). (5) **La `DATABASE_URL` de fusion se filtró en el transcript del 2026-07-21 → ROTAR.**

**💸 Producción (autorización de 2 facturas del operador):** Factura C `0006-00000008` (CAE 86294776469171) y `0006-00000009` (CAE 86294777469313), ambas anuladas con sus NC. Homologación: hasta la N° 6 emitida/anulada. **483 tests verdes en el VPS.**

[[copiloto-tests-ensuciaban-la-base]] [[instrumentos-que-confirman-en-vez-de-verificar]] [[copiloto-motor-react-concatenadas]] [[tests-se-corren-en-vps]] [[copiloto-deploy-multitenant-vivo]]
