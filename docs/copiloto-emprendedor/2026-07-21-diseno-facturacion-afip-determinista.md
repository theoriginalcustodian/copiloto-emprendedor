# Diseño — Facturación AFIP determinista en el Copiloto

> **Fecha:** 2026-07-21 · **Estado:** 🟡 diseño abierto a revisión del operador, implementación NO arrancada
> **Gate:** 🟢 levantado — el spike emitió contra homologación real ([`spikes/afip-emit-pdf/RESULT.md`](../../spikes/afip-emit-pdf/RESULT.md))
> **Insumos:** benchmark del competidor ([Facturitas](2026-07-21-benchmark-facturitas-flujo-whatsapp.md)) · handoff de contexto ([2026-07-06](2026-07-06-HANDOFF-facturacion-afip-copiloto.md)) · contrato AfipSDK verificado en el spike

## 0. Las 3 decisiones del operador que mandan sobre todo lo demás

1. **El flujo es DETERMINISTA. El LLM no interviene nunca en el camino de decisión.** Una factura es un
   acto fiscal irreversible: quién decide qué se emite es código, no un modelo.
2. **Dos caminos, en este orden.** Primero el determinista (v1, este documento). Después, con el núcleo
   ya probado, se entrena al agente conversacional para que *proponga* facturas — nunca para que decida.
3. **La clave fiscal se carga una sola vez, en Ajustes, y NO se almacena.** Se usa para generar el
   certificado y se descarta. Lo que queda guardado (cifrado) es el certificado, que es lo único que hace
   falta para facturar.

## 1. El principio que hace que los dos caminos no se bifurquen

> **Una sola máquina de estados y un solo validador. Lo único que cambia entre los dos caminos es quién
> llena los slots.**

```
   Camino 1 (v1, determinista)          Camino 2 (fase 2, conversacional)
   formularios de la app                el agente propone valores desde el chat
            │                                        │
            └──────────────┬─────────────────────────┘
                           ▼
              ┌────────────────────────┐
              │  VALIDADOR PURO        │  ← funciones puras, sin red, sin Temporal, sin LLM
              │  (afip_rules.py)       │     acepta o rechaza. No negocia.
              └────────────────────────┘
                           ▼
              ┌────────────────────────┐
              │  MÁQUINA DE ESTADOS    │  ← workflow Temporal, transiciones por código
              │  (FacturaWorkflow)     │
              └────────────────────────┘
                           ▼
                    emisión AFIP
```

El LLM, cuando llegue, entra **por arriba**: propone un dict de slots. Si el validador lo rechaza, no se
emite y se le pide al usuario lo que falta. **El agente nunca tiene una vía para emitir salteando el
validador** — no porque le pidamos que no lo haga, sino porque no existe esa puerta.

Esto es lo que hace que el trabajo de la v1 sea la fundación de la fase 2 y no un descarte.

## 2. Capas

| Capa | Qué hace | Depende de |
|---|---|---|
| `afip_rules.py` | Validaciones fiscales puras + transiciones de estado. **Sin red, sin DB, sin Temporal.** | nada |
| `AfipGateway` | Boundary fail-closed sobre `afip.py`. Per-tenant. Hermano de `ComposioGateway`/`MercadoPagoGateway`. | `afip.py`, cert del tenant |
| `afip_credential_store` | Cert+key cifrados per-tenant. Molde: `mp_credential_store`. | Fernet, Postgres |
| `FacturaWorkflow` | Máquina de estados durable de UNA factura. | Temporal |
| `AfipOnboardingWorkflow` | Generación del certificado (RPA de AfipSDK, minutos). | Temporal |
| API + app | Formularios, Ajustes, entrega del PDF. | — |

**Por qué `afip_rules.py` va separado y sin dependencias:** es la única capa que decide si una factura es
legal. Tiene que poder testearse exhaustivamente sin levantar nada, y tiene que ser reusable por el camino
conversacional sin arrastrar Temporal. Si las reglas viven adentro del workflow, la fase 2 las duplica —
y una regla fiscal duplicada es una regla fiscal que se va a desincronizar.

## 3. La máquina de estados

```
                    ┌──────────┐
                    │ BORRADOR │ ← se crea al abrir "Nueva factura"
                    └────┬─────┘
                         │ signal: cargar_datos_venta
                    ┌────▼────────────┐
                    │ DATOS_VENTA_OK  │   fecha · condición de venta · tipo (prod/serv/ambos)
                    └────┬────────────┘   + fechas de servicio si aplica
                         │ signal: agregar_item / quitar_item   (N veces)
                    ┌────▼────────┐
                    │  ITEMS_OK   │       ≥1 ítem válido
                    └────┬────────┘
                         │ signal: cargar_cliente
                    ┌────▼────────────┐
                    │  CLIENTE_OK     │   cond. IVA receptor · doc tipo/nro (opcional según reglas)
                    └────┬────────────┘
                         │ (transición automática: el validador arma el payload completo)
                    ┌────▼────────────────────┐
                    │ ESPERANDO_CONFIRMACION  │ ← HITL. Espera indefinida. Acá vive el resumen.
                    └────┬───────────┬────────┘
       signal: confirmar │           │ signal: cancelar → CANCELADA (terminal)
                         │           │ signal: editar(campo) → vuelve al estado del campo
                    ┌────▼──────┐
                    │ EMITIENDO │ ← activity idempotente contra AFIP
                    └────┬──────┘
              ┌──────────┴──────────┐
        Resultado=A            Resultado=R/error
              │                      │
        ┌─────▼─────┐          ┌─────▼─────┐
        │  EMITIDA  │          │ RECHAZADA │ (terminal, con motivo de AFIP)
        └─────┬─────┘          └───────────┘
              │ activity: create_pdf
        ┌─────▼─────┐
        │ ENTREGADA │ (terminal) — PDF en el chat + [Guardar] [Compartir]
        └───────────┘
```

**Regla dura de la máquina:** ninguna transición depende de texto libre interpretado. Cada signal trae un
payload tipado, el validador puro lo acepta o lo rechaza, y sólo entonces cambia el estado. Un signal
inválido **no rompe el workflow ni avanza el estado**: registra el error y lo expone por query.

**Estado consultable en todo momento** (`@workflow.query`): `estado`, `slots` cargados, `faltantes`,
`errores`, `total_calculado`. Es lo que pinta la UI — no hay estado de factura viviendo en el front.

### Por qué esto es Temporal y no una tabla con un campo `estado`

- **El borrador sobrevive a todo.** El usuario cierra la app a mitad de carga, se le corta el 4G, se le
  muere la batería: el borrador está intacto. Sin código de recuperación escrito por nosotros.
- **La espera de confirmación no tiene límite.** El HITL puede durar horas. Es un signal, no un timeout.
- **La emisión es irreversible.** `workflow_id = factura-{cliente_id}-{idem_key}` ⇒ Temporal rechaza el
  duplicado por construcción. Doble tap del botón no emite dos facturas.
- **El onboarding tarda minutos** y es justo donde el competidor se cae (§7 del benchmark: sin ETA, y
  cuando el usuario pregunta "¿qué hago ahora?" el bot le repite el mismo mensaje). Con heartbeats y
  query de progreso damos estado real. Es ventaja competitiva concreta, no infraestructura por gusto.

## 4. 🔴 La clave fiscal no puede pasar por Temporal

**El problema:** los argumentos de un workflow y de sus activities quedan grabados **en claro en el event
history**. Si la clave fiscal entra como argumento, queda persistida para siempre en el historial — que es
exactamente lo que la decisión del operador quiere evitar. Cifrar la columna de la DB no sirve de nada si
el secreto viaja igual por el history.

**La solución — claim-check para secretos:**

```
1. La app manda usuario + clave fiscal al endpoint HTTPS.           (la clave existe: en tránsito)
2. El endpoint la cifra y la guarda en `afip_secret_handoff`         (la clave existe: en reposo, TTL 15 min)
   con TTL corto. Obtiene un `handle` opaco (UUID).
3. Arranca AfipOnboardingWorkflow(cliente_id, cuit, handle).         ← al history sólo va el handle
4. La activity `generar_certificado` lee la clave por el handle,
   llama a AfipSDK (create-cert + auth-web-service),
   y BORRA la fila del handoff en un `finally`.                      (la clave deja de existir)
5. Se guardan cert+key cifrados con Fernet en `afip_credentials`.    (lo único que persiste)
```

Desde ese momento el emprendedor factura con el certificado. **La clave fiscal no vuelve a hacer falta**
hasta que el certificado venza (~2 años) o haya que autorizar un web service nuevo.

**Garantías que sí podemos escribir en el copy de Ajustes, sin mentir:**
- La clave no se guarda: se usa para vincular tu cuenta con ARCA y se descarta.
- No queda en el historial de ejecución ni en logs.
- Lo que guardamos es el certificado, cifrado.

Y una que **no** debemos escribir: *"ni siquiera nosotros podemos verla"* referido a algo que guardamos
cifrado de forma reversible. Con este diseño no hace falta prometerlo, porque directamente no la guardamos.

**Higiene obligatoria de la clave en tránsito:** nunca en logs, nunca en mensajes de error, nunca en el
`repr` de un objeto, nunca en un `print` de debug. Tipo dedicado que enmascare en `__repr__`.

## 5. Las reglas fiscales (el corazón del validador)

Todas puras, todas testeadas contra casos adversariales. Las 3 primeras son las que ARCA ya pagó caro.

| # | Regla | Origen |
|---|---|---|
| R1 | `DocTipo=99` (consumidor final) ⇒ `CondicionIVAReceptorId=5` **siempre**. Nunca `Cond=1` con `DocTipo=99`. | RG 5616/2024 · error 10243 que ARCA sufrió en prod |
| R2 | Emisor monotributo/exento ⇒ comprobante tipo **C** (11). RI→RI(CUIT) ⇒ **A** (1). RI→consumidor final ⇒ **B** (6) con `Cond=5` forzado. | handoff ARCA |
| R3 | En Factura C la clave `Iva` se **omite** (no se manda array vacío) y `ImpNeto`=total, `ImpIVA`=0, `ImpOpEx`=0. | verificado en el spike |
| R4 | `CbteFch` dentro de ±10 días de la fecha real. | doc AfipSDK |
| R5 | Consumidor final sin identificar ⇒ tope de importe (el competidor usa $10.000.000). **A confirmar el valor vigente contra normativa** — no copiarlo del competidor sin verificar. | benchmark C17 · `[PENDIENTE VERIFICAR]` |
| R6 | Concepto 2 o 3 (servicios) ⇒ `FchServDesde`, `FchServHasta`, `FchVtoPago` obligatorias. | doc AfipSDK |
| R7 | El perfil fiscal del emisor debe estar completo antes de emitir: razón social, domicilio, condición IVA, **ingresos brutos**, **inicio de actividades**. | descubierto en el spike: el template PDF los exige |
| R8 | Suma de subtotales de ítems == `ImpTotal`. Redondeo a 2 decimales explícito. | aritmética fiscal |

⚠️ **R5 y el resto de los topes se verifican contra normativa vigente, no contra el competidor.** Que
Facturitas use $10M no prueba que sea el número correcto hoy.

## 6. Perfil fiscal en Ajustes (consecuencia directa del spike)

El spike descubrió que el template del PDF exige campos que el handoff no listaba. Van todos en Ajustes,
cargados **una vez**, no por factura:

- **Identidad ARCA:** CUIT, usuario ARCA *(se guarda)*, clave fiscal *(NO se guarda — §4)*.
- **Perfil de emisión:** razón social, domicilio comercial, condición frente al IVA, **ingresos brutos**,
  **fecha de inicio de actividades**, punto de venta.

Sin perfil completo, el botón de facturar no se habilita. Fail-closed: es preferible bloquear la emisión a
emitir un comprobante con datos fiscales mal formados.

## 7. Idempotencia y el camino de rechazo

- **Idempotencia de emisión:** `idem_key` generada al crear el borrador ⇒ `workflow_id` único. La activity
  de emisión, además, hace *check-before-act*: consulta `getLastVoucher` y verifica si el comprobante ya
  fue autorizado antes de reintentar (evita doble emisión si el reintento ocurre después de que AFIP
  respondió pero antes de que nosotros lo registráramos).
- **Retry acotado, no infinito.** Lección ya pagada en este repo (PR #114): un fallo de tool con retry
  infinito colgó el chat. La activity de emisión lleva `retry_policy` con `maximum_attempts`, y un rechazo
  de negocio de AFIP (`Resultado="R"`) **no se reintenta** — es un resultado, no un fallo.
- ⚠️ **El camino de rechazo NO está validado empíricamente.** El spike sólo ejercitó el camino feliz. Hay
  que forzar un rechazo real de AFIP en homologación antes de dar por buena la rama `RECHAZADA`.

## 8. Entrega del comprobante

El template `invoice-c` de AfipSDK devuelve una factura fiscal completa, con QR, presentable tal cual
(evidencia: `spikes/afip-emit-pdf/out/tpl-1.png`). No hace falta maquetar HTML propio.

- La URL del PDF **expira a las 24 h** ⇒ re-hosteo inmediato. Guarda legal.
- En el chat: recuadro del PDF + **[Guardar]** (descarga local) + **[Compartir]** (Web Share API nativa).
  Sin botón [Enviar]: "mandámelo por mail" es una acción conversacional, no un botón (scope ya fijado).
- 🔴 **Bloqueante antes de producción:** el QR del template declara `"moneda":"ARS"` y AFIP usa `"PES"`.
  Verificar contra el validador oficial de comprobantes. Si rechaza ⇒ modo custom (ya probado y funcionando).

## 9. Qué tomamos del competidor y qué no

Del benchmark (§8 tiene la tabla completa). Lo que más importa para la v1:

- **Sí:** identidad progresiva (pedir CUIT → confirmar quién sos → recién ahí la clave); disclaimer de
  seguridad pegado al campo, no en un link; resumen total antes de emitir; HITL con **[Confirmar]
  [Cancelar] [Editar y confirmar]** — la tercera opción es la que evita rehacer todo por un dato.
- **No:** esperas sin ETA ni progreso (tenemos Temporal, damos progreso real); el verbo "cancelar" para
  una factura ya emitida (fiscalmente eso es una Nota de Crédito, y hay que decirlo); nombres de botón que
  no comunican el tradeoff ("Factura Rápida" no dice qué resigna).

## 10. Orden de implementación

Cada fase cierra con evidencia ejecutable, y los tests corren **en el VPS**.

| Fase | Qué | Cierra cuando |
|---|---|---|
| F1 | `afip_rules.py` + suite de tests (incluye casos adversariales de R1/R2) | los tests pasan en el VPS |
| F2 | `AfipGateway` + `afip_credential_store` (Fernet) + tablas `afip_*` con RLS | test de aislamiento cross-tenant en verde |
| F3 | `AfipOnboardingWorkflow` + claim-check del secreto + endpoints de Ajustes | onboarding E2E con CUIT real en homologación |
| F4 | `FacturaWorkflow` (máquina de estados) + activities de emisión y PDF | factura emitida E2E desde la API, con replay-verify |
| F5 | App: Ajustes (perfil + ARCA) y flujo de nueva factura | emisión E2E desde el device |
| F6 | Entrega: PDF en el chat + [Guardar]/[Compartir] + re-hosteo | comprobante recibido y abierto en el device |

**Fase 2 (después, no ahora):** el agente conversacional propone slots contra el mismo validador.

## 11. Pendientes que bloquean producción (no el diseño)

1. Validar el QR emitido contra el verificador oficial de AFIP (riesgo `ARS`/`PES`, §8).
2. Ejercitar el camino de rechazo real de AFIP (§7).
3. Confirmar el tope vigente de consumidor final sin identificar (R5).
4. Onboarding con CUIT propio y certificado real — el spike usó el CUIT de testing compartido.
5. Cert de producción + punto de venta habilitado a WS + `production:true`.
