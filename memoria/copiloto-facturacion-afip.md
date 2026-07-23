---
name: copiloto-facturacion-afip
description: Facturación AFIP en el Copiloto — backend Y frontend TERMINADOS, E2E verde desde el device. Falta sólo el alta con la clave fiscal del operador. Arquitectura determinista con Temporal. LEER PRIMERO al retomar facturación.
metadata:
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-07-21T17:03:18.111Z
---

**Facturación electrónica AFIP/ARCA.** Estado 2026-07-21: 🟢 **backend Y frontend terminados; E2E verde desde el device** (emitió y anuló con CAE real desde un SM-A217M). PR #6 abierto. **Falta SÓLO el alta ARCA desde el teléfono con la clave fiscal del operador** — lo único que ningún script puede probar por él.

**🎯 ARQUITECTURA:** flujo **DETERMINISTA — el LLM NUNCA interviene en el camino de decisión.** Máquina de estados durable en Temporal. El agente se entrenará DESPUÉS sobre el MISMO núcleo (`afip_rules.py`, validador puro) — un solo validador, una sola máquina de estados; lo que cambia es quién llena los slots.

**🔐 CLAVE FISCAL — NO se almacena.** Se usa para generar el certificado y se descarta. ⚠️ Tampoco puede pasar como argumento de workflow/activity (queda en claro en el event history PARA SIEMPRE) → **claim-check** (`afip_secret_handoff`, TTL 15 min, `DELETE...RETURNING`).

**🌐 AMBIENTE = DOS CREDENCIALES, no un flag.** El certificado se emite contra un ambiente concreto; homologación y producción son credenciales distintas. Unique `(cliente_id, cuit, ambiente)` + único parcial `WHERE activo`. Cambiar de ambiente = toggle, NO re-alta. Default `dev` en TODA la superficie: si el campo se pierde en un refactor, el peor caso es una factura de prueba, no un comprobante fiscal real.

**🐛 BUGS QUE SÓLO APARECIERON CONTRA AFIP/DEVICE REAL (ninguno lo cazaba un unit test):**
1. Alias del certificado sin guiones (`copilotoemprendedor`) — habría roto la PRIMERA alta real.
2. `voucherNumber` camelCase, no como dice la doc.
3. `afip.py` faltaba en el venv del copiloto.
4. Concepto servicios (2/3) exige `billing_from`/`billing_to`/`payment_due_date` en el PDF — costó una factura REAL.
5. Emisión clavada a homologación: la fábrica construía `AfipGateway` sin `production` → un tenant con credencial de prod no podía emitir por el camino del producto.
6. El PDF "desanulaba" facturas: se adjuntaba con `registrar()` (upsert completo, `estado` default "emitida"); como el PDF se genera DESPUÉS del CAE, una anulación en esa ventana se perdía. Fix: `adjuntar_pdf()`, UPDATE parcial.
7. Consumidor final emitía con CAE y SIN PDF (caso MÁS COMÚN). El WSFE autoriza sin nombre/domicilio/documento; el template del PDF los exige igual. Causa fina: `payload.get(k, default)` sólo cubre la clave AUSENTE, y el formulario manda `""`. Fix `afip_rules.receptor_desde_payload`.
8. El borrador sin certificado nacía terminal como `rechazada` ("AFIP rechazó tu factura"). Ahora `POST /afip/facturas` devuelve **409** sin abrir workflow.

**🔑 LECCIÓN TRANSVERSAL (la más cara del sprint):** *lo que AFIP acepta **autorizar** y lo que acepta **imprimir** son dos contratos distintos, y sólo el primero está documentado* (bugs 4 y 7).

**🧱 ARCHIVOS (`apps/copiloto/`):** `afip_rules.py` (R1-R11, máquina de estados, payloads WSFE y PDF, NC, `receptor_desde_payload`) · `afip_gateway.py` (`RechazoAfip` vs `ErrorAfip`) · `afip_credential_store.py` (cert cifrado + claim-check + `ClaveFiscal` que enmascara `__repr__`) · `afip_comprobante_store.py` (`adjuntar_pdf` ≠ `registrar`) · `afip_{onboarding,factura}_{workflow,activities}.py` · `afip_anulacion_workflow.py` · `afip_web.py` (16 endpoints). Scripts: `deploy/copiloto/{smoke_afip_http,e2e_facturacion_http,setup_tenant_pruebas,limpiar_residuos_test}.py`.

**🧪 Cuenta de pruebas:** `pruebas-facturacion@copiloto.test`, password en `/root/.secrets/tenant-pruebas-facturacion.txt` (600), CUIT del operador, homologación. Recrear con `setup_tenant_pruebas.py` (idempotente, sin opción de producción).

**📁 Archivado en Drive + detalle del receptor:**
- El PDF de AfipSDK **expira a las 24h** y no se re-hostea → se copia al Drive del emprendedor con `GOOGLEDRIVE_UPLOAD_FROM_URL` (baja server-side, nunca pasa por nuestro front-door): `FIND_FOLDER`→`CREATE_FOLDER` si falta→`UPLOAD_FROM_URL`→`CREATE_PERMISSION anyone/reader`. Ajuste `afip_perfil.guardar_en_drive`, **OFF por default** (409 si no hay perfil: un UPDATE sobre 0 filas "funciona" en SQL).
- Medido contra Drive real: recién subido da 401 a un extraño; con `anyone/reader`, 200. `UPLOAD_FROM_URL` devuelve `webContentLink` **y** `webViewLink` — Descargar usa el primero, el segundo abre el visor.
- Decisión deliberada: se comparte al ARCHIVAR, no al tocar "Compartir" (no depende de red justo al mandar la factura). Costo: link permanente con datos del cliente del emprendedor. Falla blando siempre — una factura con CAE es un hecho fiscal; `confirmed=True` porque el HITL es para lo que decide el AGENTE, acá autorizó el usuario en Ajustes.
- `terminado` dejó de derivarse del estado → flag explícito del workflow ([[dato-en-dos-tiempos-lector-de-un-tiempo]]): se marca `entregada` ANTES de archivarse, y una sin PDF quedaba en `emitida` (no terminal) poleando para siempre.
- `receptor_nombre`: el WSFE identifica por tipo+número de documento, el NOMBRE nunca se guardaba — parámetro con default (si no, rompe el replay de ejecuciones de 5 args). NULL, no `""`, cuando no hay.
- Migraciones aditivas → `afip_migrations.sql` (`provision_tables.py` con `CREATE TABLE IF NOT EXISTS` sirve para instalar de cero, no reconciliar tabla viva).
- `drive_conectado` en `GET /afip/estado` = TRES estados (`true`/`false`/**`null`**). `null` = "no pude averiguarlo" (Composio caído/no cableado), NO `false` — colapsarlos muestra "conectá tu Drive" a quien lo tiene conectado. `EXPIRED` cuenta como `false`. Va en LAS DOS ramas (tenant nuevo quedaba `undefined`). Patrón reusable para cualquier booleano que dependa de un tercero.
- ⚠️ Sin test unitario del `FacturaWorkflow` (deuda, propietario operador): el time-skipping de Temporal mata el `wait_condition` sin límite del HITL. Cubierto por `e2e_archivado_drive.py` contra el worker real.

**⚠️ DEUDA GESTIONADA ABIERTA:** (0) los 6 endpoints de signal devuelven `{"ok": true}` sin saber si el workflow aceptó — medido: `confirmar` con token inválido da 200 y no emite nada. TODO en `afip_web.py`, propietario operador, fix propuesto `202 Accepted`. (1) nota de crédito NO genera PDF — TODO en `afip_anulacion_workflow.py`, propietario operador, pago antes de producción. (2) Tope de consumidor final sin identificar `[PENDIENTE VERIFICAR]`. (3) QR declara `ARS` donde AFIP usa `PES` — fuera de nuestro alcance por decisión del operador. (4) Factura A/B no implementadas (fallan ruidoso a propósito). (5) `DATABASE_URL` de fusion se filtró en un transcript 2026-07-21 → ROTAR.

**💸 Producción:** Factura C `0006-00000008` (CAE 86294776469171) y `0006-00000009` (CAE 86294777469313), ambas anuladas con sus NC. Homologación: hasta N° 6 emitida/anulada. **483 tests verdes en el VPS.**

[[copiloto-tests-ensuciaban-la-base]] [[instrumentos-que-confirman-en-vez-de-verificar]] [[copiloto-motor-react-concatenadas]] [[tests-se-corren-en-vps]] [[copiloto-deploy-multitenant-vivo]]
