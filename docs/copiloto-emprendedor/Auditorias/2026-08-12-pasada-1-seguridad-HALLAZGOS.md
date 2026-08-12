# Pasada 1 — Seguridad · HALLAZGOS

> **2026-08-12, sesión auditoría (read-only).** Contra `origin/main @ ce855054` (worktree `audit/pasadas-1-2`).
> Método: mapa BOLA (OWASP API1) de los 33 endpoints con ID en la ruta, cubierto con 4 sub-agentes headless
> dirigidos por lote (más preciso y barato que el scan `/claude-security` no determinista — ver "fuera de
> alcance"). Objetivos 3-4 (webhook MP + uploads) por sub-agente aparte.

**Titular:** **0 BOLA fail-open en los 33 endpoints.** El aislamiento multitenant es real y estructural
(guard `WHERE cliente_id` en el store, o `workflow_id` namespaced por tenant en AFIP, o gate admin fuerte).
El path-traversal del catch-all SPA es seguro. Los hallazgos son de **cobertura de test**: endpoints cuyo
guard existe en código pero **carecen de test adversarial**, que por la regla dura del repo (`CLAUDE.md
§Seguridad`: *"control sin test adversarial = control no verificado"*) quedan `[UNVERIFIED]`.

**Balance:** 0 P0 · 1 P1 · 4 P2. El webhook de MercadoPago **no es forjable** (fail-closed real) y los
uploads **tienen límite de tamaño** (sin DoS) — ambos son evidencia positiva con matices menores.

---

### H-1 · 4 endpoints con guard pero SIN test adversarial en ningún nivel → `[UNVERIFIED]` · P1
Dónde y evidencia (guard presente, test ausente):
- `PATCH /conceptos/{concepto_id}` — guard `concepto_store.py:165,170` (`WHERE cliente_id=%s AND id=%s`).
- `DELETE /conceptos/{concepto_id}` — guard `concepto_store.py:203` (`desactivar`, mismo patrón).
  → `test_concepto_store.py` **no tiene ningún caso cross-tenant** (A vs B); solo edición con un tenant.
- `PUT /gastos/{gasto_id}/imputacion` — guard `trabajo_store.py:201,207` (`resolver()` valida tenencia + `WHERE cliente_id=%s AND id=%s`).
- `GET /trabajos/{eslabon}/{ref}/margen` — guard `trabajo_store.py:93..172` (todos los joins filtran `cliente_id`).
  → **no existe `test_trabajo_store.py`**; `test_gastos_web.py` no cubre `imputa`/`margen`. (Mismo hueco que
  el canario C5 de la re-verificación: `trabajo_store` sigue sin archivo de test.)
Falla: el código parece correcto, pero sin un test hostil (actor A intenta el recurso de B → 404/denegación)
un fail-open futuro no daría síntoma — el happy-path verde pasa igual si el aislamiento se rompe en un refactor.
Es exactamente el modo de falla de [[rls-activado-que-no-filtraba-el-dueno-esta-exento]] y de la regla dura.
Clase: 4 endpoints / 2 stores sin cobertura adversarial.
Dueño sugerido: backend. Fix: test adversarial de integración (Postgres real) por cada uno — crear `test_trabajo_store.py` y el caso A/B en `test_concepto_store.py`.

### H-2 · 8 endpoints AFIP con guard probado solo a nivel helper/store, no por endpoint HTTP hostil · P2
Dónde: 6 mutaciones de factura (`/afip/facturas/{id}/datos-venta|items|items/{i}|cliente|confirmar|cancelar`)
+ 2 de anulación (`/afip/anulaciones/{id}|/confirmar`) — todas guardadas por `web.py:231-237` (`_wf_id_factura`)
/ `web.py:240-241` (`_wf_id_anulacion`), que prefijan el `workflow_id` con el `cliente_id` del token.
Falla: el helper `_wf_id_factura` sí tiene test hostil (`test_afip_web_facturas.py:91` + `:108`), pero ninguno
de esos 8 endpoints ejercita el caso A-pide-lo-de-B sobre `signal`/`confirmar` específicamente. Riesgo bajo
(comparten el helper probado, sin lógica duplicada) pero no verificado end-to-end por endpoint. Igual para
`POST /presupuestos/{id}/facturar` y `PATCH /presupuestos/{id}/estado`: adversarial solo a nivel store
(`test_presupuesto_store.py:66,75`), no HTTP.
Clase: 8 endpoints con cobertura indirecta.
Dueño sugerido: backend. Fix: 1-2 tests paramétricos HTTP que rieguen el caso hostil sobre el helper compartido.

### H-3 · Path traversal del catch-all SPA — SEGURO (evidencia, no hallazgo) · P2 informativo
Dónde: `web.py:487-493` (`GET /{full_path:path}`).
Estado: `GET /../../etc/passwd` (y `%2e%2e%2f`) **no escapa** — doble cerrojo: (1) Starlette normaliza el path
antes de matchear la ruta; (2) `candidate.resolve().is_relative_to(d.resolve())` — si `resolve()` saca el
candidate fuera del webroot `d`, cae al `else` (sirve `index.html`, nunca el archivo ajeno). Sin lectura
arbitraria de disco. **No requiere acción.** Se documenta como control positivo verificado.

---

## Mapa BOLA completo — los 33 endpoints (evidencia del control positivo)

**Todos con guard. Ninguno con mecanismo NINGUNO.**

- **Admin (4):** guard `require_admin` (`auth.py:203`) con predicado **fuerte** — `app_metadata.copiloto_admin is True`,
  verificado empíricamente no auto-editable por el usuario (3 rutas de escalada probadas y bloqueadas,
  `auth.py:170-185`). `cliente_id` de las mutaciones se **resuelve server-side** (del trauma/ticket), nunca del
  body. Lecturas cross-tenant (`/admin/soporte/tickets/{id}`) son cross-tenant **por diseño** (rol
  `copiloto_consola`, SELECT-only, BYPASSRLS acotado). Tests: `test_admin_*` (403 usuario normal). **Sano.**
- **AFIP facturas/anulaciones (15):** `workflow_id` namespaced por `cliente_id` (`_wf_id_factura`/`_wf_id_anulacion`)
  o `WHERE cliente_id` en `cobro_store`/`afip_comprobante_store`. Tests adversariales presentes para GET factura,
  cobros y comprobantes (`test_afip_stores_integracion.py:388`, `test_cobros_y_catalogo.py:195,222`). Gap: H-2.
- **Clientes/gastos/mi-día (7):** `WHERE cliente_id=%s AND id=%s` en cada store. Tests adversariales presentes
  para clientes (`test_clientes_web.py:190,579`), gastos GET (`test_gastos_web.py:188`), mi-día
  (`test_mi_dia_tarjeta_store.py:82,92`, Postgres real). Gap: H-1 (imputacion + margen).
- **Presupuestos/conceptos/soporte (7):** `WHERE cliente_id` en cada store; soporte con test
  (`test_web_app.py:801`), presupuestos con test a nivel store. Gap: H-1 (conceptos) + H-2 (facturar/estado HTTP).

### H-4 · Webhook MercadoPago — NO forjable (evidencia), pero fail-silent para observabilidad · P2
Dónde: `mp_web.py:37-49` (`POST /mp/webhook`) → `mercadopago_gateway.py:108-121` (`verify_webhook`).
Estado: **fail-closed real.** Usa el SDK oficial (`WebhookSignatureValidator`) — sin bypass, sin flag de
debug que lo desactive. Una firma inválida se rechaza. **No forjable → sin `urgente_`.** Matices (P2, no P0):
- (a) El manifiesto HMAC firma solo 3 campos (`id;request-id;ts`), **no el body**. Mitigado porque
  `get_payment` re-consulta el pago real a MP con el token del tenant: un body alterado no cambia el monto
  cobrado. El riesgo residual (replay del mismo `id` con distinto body) queda cubierto por `mp_dedup_store`.
- (b) `except Exception: return False` en `mercadopago_gateway.py:119` es **fail-silent** — colapsa "firma
  atacante", "secreto ausente" y "bug del SDK" en el mismo `False` mudo. Es el **mismo sitio que H-3/D-A de
  Pasada 2**: seguro pero ciego. No es vulnerabilidad; es un blind-spot de observabilidad.
Dueño sugerido: backend + motor. Fix: distinguir en el log firma-inválida (esperable) de secreto-ausente/
error-SDK (alarma), sin abrir el fail-closed.

### H-5 · Uploads — con límite de tamaño (sin DoS) pero sin validación de tipo real · P2
Dónde: 4 endpoints — `/chat/audio` (`web.py:633`), `/soporte/chat/audio` (`web.py:712`),
`/feedback/audio` (`web.py:779`), `/chat/foto` (`web.py:804`).
Estado: **todos con cota de tamaño** (`MAX_AUDIO_BYTES=25MB`, `MAX_IMAGEN_BYTES=10MB`) — **sin DoS por
upload gigante**, control positivo. Gaps (P2, riesgo acotado):
- Ninguno valida **magic bytes**: confían en el `content_type` que declara el cliente. Los 3 de audio no
  tienen whitelist de tipo; `/chat/foto` tiene whitelist pero **solo por header**, falsificable.
- Daño máximo **acotado**: los archivos **nunca se persisten a disco** — van en memoria a Groq/OpenAI (STT)
  u OCR. Sin path traversal, sin escritura arbitraria, sin RCE. El peor caso es forzar un `422/502` del
  servicio externo. Por eso es P2, no P1.
Dueño sugerido: backend. Fix: sniff de magic bytes (`python-magic`/cabecera) + whitelist real por contenido
en los 4, antes de despachar al servicio externo.

## Fuera de alcance (declarado)
- No se corrió el scan completo de `/claude-security`. El objetivo nº1 (mapa BOLA) se cubrió con agentes
  dirigidos, más preciso y barato que el scan no determinista dada la restricción de economía de tokens del
  contrato (Fable). Alcance recortado y **declarado**, no silencioso ([[instrumentos-que-confirman-en-vez-de-verificar]]).
