# HANDOFF — Facturación electrónica AFIP en el Copiloto del Emprendedor

> **Fecha:** 2026-07-06 · **Estado:** 🟡 CONTEXTO CERRADO, IMPLEMENTACIÓN EN PAUSA · **Autor de origen:** sesión de contexto (Opus 4.8)
> **Propósito:** permitir retomar este trabajo desde CERO en una sesión distinta, sin re-investigar nada.
> **Regla rectora:** *no codificar la esperanza* — todo lo marcado `[VERIFICADO]` se validó empíricamente en la sesión de origen; todo `[a re-verificar]` cambió o va a cambiar y hay que medirlo de nuevo antes de actuar.

---

## 0. TL;DR — qué se quiere construir

El Copiloto del Emprendedor debe **emitir facturas electrónicas AFIP en nombre del emprendedor**, generar el **PDF** del comprobante, y **entregarlo** (email + descarga + compartir nativo). Es un **feature nuevo** dentro del copiloto (hoy no existe nada de AFIP en el código del copiloto — `[VERIFICADO]`: `grep -i afip` en `unreal-copilot` solo aparece en docs, nunca en código).

Flujo objetivo:
```
usuario pide facturar (chat)
  → HITL #1: el copiloto recolecta TODOS los datos necesarios (son ~8-12 campos)
  → HITL #2: confirmación pre-emisión mostrando los datos a enviar (revisar errores)
  → emitir vía AfipSDK (createVoucher → CAE)
  → generar PDF con QR (createPDF)
  → descargar + re-hostear en storage propio (la URL de AfipSDK expira a 24h; guarda legal)
  → recuadro del PDF en el chat (estilo documento de WhatsApp), NO se guarda auto:
       botones [Guardar] [Enviar] [Compartir]  (debajo del recuadro)
  → Enviar = email vía Composio Gmail   ·   Compartir = Web Share API nativa del móvil
```

---

## 1. 🚧 BLOQUEANTE DE ESTADO — leer ANTES de tocar nada

**La facturación está EN PAUSA por decisión del operador (2026-07-06).** El copiloto está en medio de una **reorganización / graduación a repo propio** (`copiloto-emprendedor`). Fases del operador:
- **Fase 0** — consolidar: mergear/cerrar las ramas con WIP sin mergear + reconciliar VPS↔git.
- **Fase 1** — boundary explícito del motor (`conversational_agent` deja de montarse por PYTHONPATH implícito).
- **Fase 2** — split del repo (`copiloto-emprendedor` propio con `git filter-repo`).
- **Fase 3** — infra propia (3 VPS dedicados, objetivo comercial).

**Consecuencia dura para este handoff:** **todos los paths `file:line` de la sección 6 van a MOVERSE** cuando el copiloto se separe a su repo. NO tomar los paths como fijos. Al retomar: **primero confirmar la estructura nueva** (dónde quedó `apps/copiloto`, el motor, el frontend) y recién ahí diseñar. Por eso NO se persistió memoria de proyecto con estos paths: sería codificar paths que sé que van a cambiar.

**Precondición para retomar facturación:** que Fase 0 y Fase 1 estén consolidadas. Preguntar al operador si ya lo están.

---

## 2. ALCANCE — decisiones CERRADAS con el operador (no re-litigar)

| # | Decisión | Estado |
|---|---|---|
| 1 | El copiloto **emite y envía** facturas AFIP en nombre del emprendedor (su CUIT + clave fiscal). | CERRADO |
| 2 | **Onboarding AFIP** (conectar cuenta) y **lecturas de comprobantes**: se **reutiliza el contrato de ARCA**, no se reinventa. | CERRADO |
| 3 | ⚠️ Reutilizar ARCA = reutilizar **contrato + payloads + guardrails + esquema + lecciones**, NO copiar los `.ts` 1:1. **ARCA es TypeScript; el Copiloto es Python** → se re-expresa en Python con el SDK oficial `afip.py`. | CERRADO |
| 4 | **Email de entrega = Composio Gmail** (ya integrado). El `send_to` nativo de AfipSDK queda como fallback. | CERRADO |
| 5 | **Entrega del PDF:** llega al chat en un **recuadro** (estilo doc de WhatsApp); **NO se guarda automático**. Botones **[Guardar] [Enviar] [Compartir]** debajo del recuadro. | CERRADO |
| 6 | **WhatsApp = botón "Compartir" nativo** (Web Share API del móvil), NO integración de WhatsApp Business. | CERRADO |
| 7 | **HITL en 2 puntos:** (a) recolección conversacional de todos los datos; (b) confirmación pre-emisión con los datos a enviar. | CERRADO |
| 8 | El **RPA / generación de certificado es responsabilidad de AfipSDK** (servicio PAGO). NO es nuestro riesgo (captcha/2FA/mantenimiento del portal los cubre el proveedor). | CERRADO |
| 9 | **"Leer facturas" / BI** = DESPUÉS (fase posterior). | DIFERIDO |
| 10 | La **emisión** también se apoya en el contrato de ARCA (MOT-01) re-expresado en Python. | CERRADO |

---

## 3. Contrato técnico AfipSDK (AUTO-CONTENIDO)

> Fuente: docs offline en `C:\Proyectos\Claude\Claude code\Agencia_IA_HyC\Aplicacion Arca\sdk afip\` (173 archivos `.md`). Sintetizado por 3 exploradores en la sesión de origen. `[VERIFICADO]` contra esos docs.
> **Auth de TODO:** `Authorization: Bearer <ACCESS_TOKEN>` (dashboard app.afipsdk.com). Base `https://app.afipsdk.com/api/`.
> **AfipSDK maneja el WSAA solo** (Ticket de Acceso 12h, cacheado, renovación automática). SDK Python: `pip install afip.py` → `Afip({"CUIT":..., "access_token":...})`. Node: `@afipsdk/afip.js`.
> CUIT de testing compartido sin cert propio: `20-40937847-2`.

### 3.1 Emisión (wsfe / FECAESolicitar)
- Método: `afip.ElectronicBilling.createNextVoucher(data)` → resuelve el nº solo, devuelve `{CAE, CAEFchVto, voucher_number}`. Alternativa: `createVoucher(data, includeResponse?)`.
- Numeración: fuente de verdad = AFIP, vía `getLastVoucher(ptoVta, cbteTipo)` (=`FECompUltimoAutorizado`) +1. `createNextVoucher` lo hace interno.
- Respuesta default: `{CAE, CAEFchVto (yyyy-mm-dd)}`. Con `includeResponse=true` → respuesta WS completa (shape Resultado A/R/O **NO documentado** en estas docs → `[a re-verificar]` contra código ARCA o probando).
- **Payload por tipo de comprobante** (esqueleto común: `CantReg, PtoVta, CbteTipo, Concepto, DocTipo, DocNro, CbteDesde/Hasta, CbteFch, ImpTotal, ImpTotConc=0, ImpNeto, ImpOpEx, ImpIVA, ImpTrib=0, MonId='PES', MonCotiz=1, CondicionIVAReceptorId`):

| eje | Factura A | Factura B | Factura C (Monotributo) |
|---|---|---|---|
| `CbteTipo` | 1 | 6 | 11 |
| `Iva[]` `{Id,BaseImp,Importe}` | **presente (oblig)** | **presente (oblig)** | **AUSENTE** (clave omitida) |
| importes | `ImpNeto`=neto, `ImpIVA`=iva | `ImpNeto`=neto, `ImpIVA`=iva | `ImpNeto`=total, `ImpIVA`=0, `ImpOpEx`=0 |
| receptor típico | RI (Cond=1) | Consumidor Final (Cond=5) | según receptor |

- Códigos: `CbteTipo` 1=FA, 6=FB, 11=FC · NC 3/8/13 · ND 2/7/12. `DocTipo` 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final. `Concepto` 1=Prod, 2=Serv, 3=Ambos (2/3 exigen `FchServDesde/Hasta/FchVtoPago`).
- **Notas crédito/débito** = mismo shape que su factura homóloga + `CbtesAsoc:[{Tipo,PtoVta,Nro}]` del comprobante original.
- **GOTCHAS `[VERIFICADO]`:** (1) bug de scoping en TODOS los ejemplos oficiales (`const` shadow adentro del `if` → `FchServ*` quedan `null`). (2) PtoVta de testing solo acepta `1`. (3) el método "dummy" miente (siempre OK). (4) `CbteFch` ±10 días de la fecha real. (5) error `(10016)` si el nº no es el próximo correlativo. (6) error `(11002)` si el PtoVta no está habilitado a WS.
- 🔴 **Guardrail crítico (del handoff ARCA, NO del SDK): `CondicionIVAReceptorId` RG 5616/2024.** Nunca `Cond=1` con `DocTipo=99` → AFIP rechaza (`RECHAZADO_ARCA`, error 10243). En ARCA esta validación vive SOLO en una función SQL (`resolver_fiscal()`) que el workflow **NO invoca** → hay que **replicarla como validación TS/Python explícita** antes de armar el payload. Regla:
  - Monotributo/Exento → siempre C(11), Cond según receptor.
  - RI → RI(CUIT) → A(1), Cond=1.
  - RI → Consumidor Final (doc_tipo=99) → B(6), **Cond=5 forzado**.
  - cualquiera → doc_tipo=99 → **siempre Cond=5**.

### 3.2 PDF + envío + QR
- Método: `afip.ElectronicBilling.createPDF(data)` → `POST /api/v1/pdfs`.
- **Modo TEMPLATE** (`template:{name:'invoice-a'|'invoice-b'|'invoice-c'|'credit-note-c'|'debit-note-c', params:{...}}`) vs **CUSTOM** (`html:"..."`, `options:{width,marginLeft/Right/Top/Bottom}` — 8/0.4=A4, 3.1/0.1=ticket).
- `send_to` (string, opcional, **nivel raíz**, NO dentro de `params`) = AfipSDK manda el PDF por email directo. Sin límites documentados (multi-dest/bounce/remitente = desconocido).
- Respuesta: `{id, file:<S3 url>, file_expiration, file_name, created_at}`. ⚠️ **La URL expira a las 24h** → descargar y re-hostear **inmediato** (obligación legal de guarda). Idempotencia: si ya tiene PDF guardado, no regenerar.
- **QR:** la doc standalone dice que **el SDK NO genera el QR** → armar texto (spec AFIP `QRespecificaciones.pdf`) + lib `qrcode`/`segno` + incrustar en HTML. ⚠️ **GAP `[a re-verificar]`:** no está confirmado si los templates nuevos (`invoice-a/b/c`) incrustan el QR automáticamente a partir de `cae/cuit/total`. **Si el QR es obligatorio (lo es) y el template NO lo hace → usar modo CUSTOM** con HTML propio (bonus: branding).
- `params` del template incluyen: `voucher_number, sales_point, issue_date, cae_due_date, issuer_cuit, cae, issuer_business_name, issuer_address, issuer_iva_condition, receiver_name, receiver_document_type/number, receiver_iva_condition (STRING legible, ej "Consumidor Final", NO el id numérico), currency_id:"ARS", currency_rate:1, concept, items:[{code,description,quantity,unit_price,subtotal}], vat_amount, tributes_amount, total_amount`. (A trae además `tributes[]` y `vat_breakdown[]`; C no.)

### 3.3 Onboarding / cert / lecturas (Automations = RPA, las mantiene AfipSDK)
- Patrón: `CreateAutomation(nombre, data, true)` → `{id, status:'complete', data:{...}}`.
- `create-cert-{dev,prod}`: `{cuit, username(=cuit login), password(clave fiscal), alias}` → devuelve `{cert, key}` PEM.
- `auth-web-service-{dev,prod}`: + `service:'wsfe'` → vincula cert↔wsfe (habilita facturar).
- **DELEGACIÓN (multi-tenant con UN cert propio del agente):** `delegate-web-service` (el cliente delega a tu CUIT) + `accept-web-service-delegation` (vos aceptás) + `auth-web-service-prod` con "Representado"=CUIT del cliente. **Alternativa a cert-por-emprendedor.** La doc NO recomienda cuál usar para multi-tenant → **decisión de diseño pendiente** (ver §7).
- Auth WSAA (si se necesita explícito): `POST /api/v1/afip/auth` body `{environment:'dev'|'prod', tax_id, wsid, force_create, cert?, key?}` → `{token, sign}`.
- Puntos de venta: `create-sales-point` (`numero, sistema:'FEEWS'|'MAW', nombreFantasia`) + `list-sales-points`.
- **Lecturas / BI (diferido):** `mis-comprobantes` (filtros t=E/R, fechaEmision… → array estilo portal) + `monotributo-info` (`{category, billed_amount, category_limit, next_due_date, next_due_amount}` → alertas recategorización/vencimiento).
- Ir a prod: cert prod + `auth-web-service-prod` + PtoVta habilitado a WS + `production:true`/`environment:'prod'`.

### 3.4 Gaps del SDK doc (cerrar contra código ARCA o probando)
- Shape de respuesta WS completa (Resultado A/R/O, Observaciones, Errores).
- Lista completa de params de `createVoucher` (ImpTrib/tributos, multimoneda).
- Si los templates de PDF incrustan el QR auto.
- Pricing/límites del plan AfipSDK, polling de automations, comportamiento con 2FA.

---

## 4. El handoff de ARCA (mapa de reutilización, con file:line del código TS)

Documento maestro ya existente, **leer entero al retomar**:
`C:\Proyectos\Claude\Claude code\Agencia_IA_HyC\Aplicacion Arca\docs_app_emprendedores\GUIA_INTEGRACION_ONBOARDING_AFIP_APP_EMPRENDEDORES.md`

Qué aporta (verificado empíricamente contra el repo `aplicacion-arca-fe`, recon 6 capas):
- Onboarding UTIL-02 (workflow + activities Automations) — reutilizable casi 1:1 de contrato.
- Emisión MOT-01 (payload `FECAESolicitar` armado + idempotencia 3 capas + SAGA) — el contrato exacto a re-expresar en Python.
- Consulta MOT-07.
- Gateway AfipSDK + WSAA (§5 del doc): los **5 grupos de Auth por familia de wsid** — para wsfe es `params.Auth={Token,Sign,Cuit:Number}` (grupo LEGACY_SOAP). Campos del gateway: `tax_id` (no `cuit`), `method` (no `operation`).
- Esquema DB (`cuits_config`, `fe_solicitudes`, `fe_comprobantes`) + cifrado pgcrypto + RLS.
- Los guardrails y bugs ya pagados (`CondicionIVAReceptorId`, `ws_autorizados=[]`, etc.).
- **§9 del doc = decisión MAYOR** de cómo reutilizar (A vendoring / B cluster compartido / C from-scratch). ⚠️ Ese §9 asume una app TS nueva; en NUESTRO caso (copiloto Python) la respuesta es distinta → ver §7 de este handoff.

---

## 5. Contrato del código destino (Copiloto) — `[VERIFICADO]` en la sesión, `[a re-verificar]` los paths tras el split

> ⚠️ **Los paths de abajo son de `main`/ramas del repo `unreal-copilot` al 2026-07-06. Van a MOVERSE con la graduación a `copiloto-emprendedor`.** Úsalos como mapa conceptual; re-localizá con `grep` sobre la estructura nueva antes de tocar.

### 5.1 Hallazgo de versión (crítico)
- El **motor ReAct** (`_run_react_turn`, gate por token, `WRITE_TOOLS`, `tool_catalog.py`, `make_tool_executor`) está **en `origin/main`** (PR #134, memoria dice LIVE), **NO en los worktrees viejos** (el worktree `uc-copiloto-web` local estaba -51 de origin/main y NO lo tenía; el worktree principal estaba -141). **Al retomar, la base es una rama FRESCA de `origin/main` del repo que corresponda.**
- El **frontend** (PWA React/TS) está en `apps/copiloto-web/src/`.
- El **backend** del copiloto está en `apps/copiloto/`.
- El **motor durable** (arquetipo que el copiloto reusa) en `deploy/skeleton_kit/archetypes/conversational_agent/reference/`.

### 5.2 Lo que YA existe y se REUSA (no reconstruir)
- **Gate HITL con card + botones `[VERIFICADO]`:** el motor ReAct parquea la escritura y emite una card de confirmación; el token es `f"{turn_ix}:{step}"`, fail-closed (si no matchea → no-op), con corte determinístico post-reject (`tool_choice="none"`) y test adversarial. El botón reusa `POST /chat {kind:'callback'}` — **no hay endpoint nuevo**. → sirve para el **HITL #2 (confirmación pre-emisión)**.
- **Molde de tool de 1ra clase (no-Composio):** `tool_catalog.py` → `SCHEMA` (function-calling) + `TOOL_INDEX["nombre"]=("tag",)` + runner `_run_*(name, arguments, ctx, confirmed, idem_key)` + branch en `make_tool_executor` + pertenencia a `WRITE_TOOLS`. El gate real es el `if not confirmed: return ToolResult(status="needs_confirmation", ...)` de cada runner. Precedentes: `mp_charge` (write+gate+dedup), `calendar_book` (write+gate), `consultar_actividad` (read, sin gate). → `emitir_factura` calca a `mp_charge`.
- **`Artifact(kind, data:{url})` clicable:** el runner puede devolver un artefacto → el frontend lo renderiza. En la rama del motor react hay `ArtifactView.tsx` con `payment_link → botón "Compartir" (Web Share API / clipboard)`. → **ese patrón se reusa para el recuadro del PDF** (`kind:"invoice_pdf"`). `[a re-verificar]` que `ArtifactView` esté en origin/main.
- **Storage cifrado per-tenant (molde MercadoPago):** `mp_credential_store.py` (tabla `uc_factory.mp_credentials`, unique `(cliente_id, seller_user_id)`, tokens cifrados con `FernetCrypto`, filtro explícito `WHERE cliente_id=%s` porque el rol bypassa RLS) + `crypto.py` (`FernetCrypto`, key en env `MP_FERNET_KEY`) + `context_factory.py` (wiring por-request desde `cliente_id`) + `mp_web.py` (router callback) + `mp_connect.py`. → **molde directo del onboarding AFIP + storage de cert/key.**
- **Frontend `HitlCard.tsx`** (design-system: `Button` variantes primary/cancel/ghost/danger, `Surface variant=card`, `Badge`, `MonoLabel`, `ServiceIcon`, `BottomSheet`, `Toast`). Card actual muestra `{service, label, name?, amount?, concept, preview?}`. Camino del click: `HitlCard.onConfirm` → `onChoice(value)` → `ChatScreen.handleChoice` → `useChat.send(value,{kind:'callback'})` → `POST /chat`. Theming multi-tema (4 temas) con gate **cero-hex-literal** (`chatNoHexLiterals.test.ts` — todo componente nuevo del módulo chat debe sumarse a ese test y usar `var(--token)`, no hex).

### 5.3 Lo que NO existe (100% nuevo) — las 2 brechas
1. **Recuadro de PDF + Guardar/Enviar/Compartir en el chat.** `[VERIFICADO]` el chat hoy es solo texto + cards de texto: **no hay** preview de documento (ni `<iframe>`/`<embed>`/render PDF), **no hay** descarga (`download` attr / `createObjectURL` ausentes), **no hay** `navigator.share` (ausente en `main`; **sí** existe en la rama del motor react vía `ArtifactView` para `payment_link`). Trabajo nuevo pero acotado: nuevo `kind:"invoice_pdf"` en `ArtifactView`/`MessageList` + layout de 3 botones + descarga + Web Share (con fallback desktop). El único binario que el front maneja hoy son blobs de **audio** (nota de voz), no PDFs.
2. **Slot-filling estructurado de "los bastantes datos".** `[VERIFICADO]` la recolección de datos hoy es **100% prompt** ("si falta un dato, pedílo"), sin acumulador estructurado de campos requeridos. Para agendar alcanza; para **facturar** (fiscal, irreversible, ~8-12 campos + guardrail `CondicionIVAReceptorId`) es frágil. **Recomendación de la sesión de origen (pendiente OK del operador):** además del prompt, una **validación estructurada de campos requeridos** — la tool `emitir_factura` NO emite hasta tener todos los campos válidos, reusando los guardrails de ARCA. → **es la única decisión de diseño con matiz de producto que quedó abierta.**

---

## 6. Arquitectura propuesta (BORRADOR — NO cerrado, sale del brainstorming)

- **3er boundary `AfipGateway`** (hermano de `ComposioGateway` y `MercadoPagoGateway`), fail-closed, per-tenant, en Python sobre `afip.py`. Contrato tentativo: `connect/onboard` · `emit_voucher(data)→{cae, cae_vto, nro, ...}` · `create_pdf(data)→{url}` · `get_vouchers(...)` (diferido).
- **Tools de 1ra clase del motor ReAct:**
  - `emitir_factura` — **write → gate HITL obligatorio** (fiscal e irreversible) + validación estructurada de campos + guardrail `CondicionIVAReceptorId`. Devuelve `Artifact(kind="invoice_pdf", data={url, cae, nro, ...})`.
  - `consultar_comprobantes` — read (sin gate), diferido con el BI.
- **Onboarding "conectar AFIP"** = sub-boundary per-tenant molde `mp_connect`: tabla `uc_factory.afip_credentials` (cert/key cifrados con `FernetCrypto`), endpoint que cifra+guarda. ⚠️ **No es gratis aunque ARCA lo tenga resuelto**: hay que instanciarlo en el copiloto (como se hizo "conectar MercadoPago"). Decisión pendiente: **cert-por-emprendedor** vs **delegación a un cert único** (§3.3).
- **Tablas en `uc_factory`** con **namespacing por app `afip_*`** (regla dura J27) + RLS `cliente_id` + filtro explícito.
- **Frontend:** `InvoiceCard.tsx` nuevo (recuadro PDF) + rama en `MessageList` + Web Share + descarga; sumar al gate cero-hex.

---

## 7. Decisiones de diseño ABIERTAS (resolver en brainstorming)

1. **Slot-filling estructurado sí/no** (recomendado sí) — único matiz de producto, pedir OK al operador.
2. **Onboarding: cert-por-emprendedor vs delegación** a un cert único del agente (§3.3). Afecta el flujo de conexión y el storage.
3. **QR en template vs modo custom** (§3.2) — depende de si los templates lo incrustan (`[a re-verificar]` con spike).
4. **Reusar `FernetCrypto` (como MP) vs pgcrypto/Vault (como ARCA)** para cifrar cert/key. Probablemente Fernet por coherencia con MP.
5. **Enviar por email: Composio Gmail (decidido) vs `send_to` nativo** como fallback — cablear ambos o solo Composio.

---

## 8. 🧪 Supuesto crítico / spike-first — ANTES de cerrar el diseño

**El único supuesto crítico no validado que queda es la EMISIÓN E2E**, porque el RPA/cert ya lo cubre AfipSDK (pago). Spike mínimo desechable (skill `/spike-first`):
1. Con el CUIT de testing (`20-40937847-2`) o un CUIT de prueba real + su clave fiscal, en **homologación**.
2. `afip.ElectronicBilling.createNextVoucher(...)` con una **Factura C de $1** → ¿llega el CAE?
3. `createPDF` modo custom con QR → ¿se descarga bien y el QR es válido?
4. Confirmar el shape de la respuesta WS completa (Resultado/Observaciones) que las docs no documentan.

Es **independiente del split del repo** → sobrevive la reorganización. El diseño de emisión sale del resultado de este spike, no de la asunción. Necesita un input del operador: **credenciales de prueba (CUIT + clave fiscal, o el CUIT compartido)**.

---

## 9. Próximos pasos (secuencia al retomar)

0. **Confirmar con el operador que Fase 0 y Fase 1 de la graduación están consolidadas.** Si no → esperar. (§1)
1. `/check-cross-sesion` + `git fetch` — verificar worktrees activos y no pisar sesiones paralelas.
2. **Re-localizar los paths** de §5 sobre la estructura NUEVA del repo (post-split). Base = rama fresca de `origin/main` del repo que corresponda.
3. **Spike de emisión E2E** (§8) — pedir credenciales de prueba al operador.
4. `superpowers:brainstorming` del diseño (AfipGateway + tools + onboarding + frontend), resolviendo §7.
5. `superpowers:writing-plans` → plan de implementación (probablemente SDD/TDD, como el MercadoPagoGateway PR #110).
6. Implementar sobre worktree aislado; tests **en el VPS** (`/opt/uc-...-venv`), nunca en la PC.

---

## 10. Referencias

**Docs fuente:**
- Handoff ARCA (mapa de reutilización, file:line del código TS): `Agencia_IA_HyC\Aplicacion Arca\docs_app_emprendedores\GUIA_INTEGRACION_ONBOARDING_AFIP_APP_EMPRENDEDORES.md`
- Docs offline AfipSDK (173 md): `Agencia_IA_HyC\Aplicacion Arca\sdk afip\` (índice en `INDICE_DOCUMENTACION.md`).

**Memorias del proyecto (unreal-copilot) relevantes:**
- `copiloto-emprendedor-roadmap` · `copiloto-motor-react-concatenadas` (motor ReAct, gate por token, tools 1ra clase) · `mercadopago-gateway-impl-followup` + `mercadopago-integracion-research` (molde de 2º boundary + storage cifrado) · `copiloto-economia-cogs` · `copiloto-frontend-movil-ux-estado` · `billing-system-sistema-compuesto` (regla J27 namespacing) · `agente-conversacional-hardening-3-lentes` · `copiloto-graduacion-fase0-fase1` (la reorganización en curso).

**PRs de contexto (repo `theoriginalcustodian/unreal-copilot`):**
- #110 MercadoPagoGateway (2º boundary — molde directo) · #134 motor ReAct · #137 consultar_actividad (tool read) · #97 walking skeleton del copiloto B · #112 cliente web PWA.

**Caveats no-codificar-la-esperanza (repetir mentalmente al retomar):**
- Los paths de §5/§6 **cambian con el split** → re-verificar.
- El motor ReAct vive en `origin/main`, NO en worktrees viejos → base = rama fresca.
- Los tests corren **en el VPS**, no en la PC.
- El onboarding AFIP **no es gratis** aunque ARCA lo tenga (hay que instanciarlo en el copiloto).
- El QR y el shape de respuesta WS son gaps → validar con spike, no asumir.

---

*Generado por la sesión de contexto de facturación (2026-07-06). Auto-contenido: no depende de ningún scratchpad efímero. Al retomar, empezar por §1 (bloqueante) y §9 (secuencia).*
