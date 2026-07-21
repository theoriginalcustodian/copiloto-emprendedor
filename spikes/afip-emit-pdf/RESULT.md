# RESULT — spike `afip-emit-pdf`

> **Fecha:** 2026-07-21 · **Dónde corrió:** VPS `unreal-copilot` (178.105.191.1), venv `/opt/uc-afip-spike-venv`, Python 3.12.3 — nunca en la PC.
> **Qué validó:** los 3 supuestos críticos del handoff §8, contra **AFIP homologación real** (no mock).
> **Credenciales:** `access_token` de AfipSDK del operador (cuenta paga), CUIT de testing compartido `20409378472`, punto de venta 1.
> **Regla:** todo lo de acá abajo salió de una corrida observada. Lo que no se probó, dice que no se probó.

## Veredicto: 🟢 GATE LEVANTADO — se puede diseñar el `AfipGateway`

| # | Supuesto crítico | Resultado | Evidencia |
|---|---|---|---|
| S1 | ¿`afip.py` emite de verdad desde Python? | ✅ **SÍ** | 4 facturas C emitidas en homologación. Última: `CAE=86290616997729`, nº 14681 |
| S2 | ¿Cuál es el shape real de la respuesta del WS? | ✅ **Documentado abajo** | `out/2_respuesta_next_voucher.json` · `out/3_voucher_info.json` |
| S3 | ¿El template PDF incrusta el QR o hay que hacer HTML custom? | ✅ **El template SÍ lo incrusta** — invierte lo que asumía el handoff | render `out/tpl-1.png` + QR decodificado |

## Lo que se instaló (para el `requirements.txt` cuando toque)

- `afip.py==1.2.0` (SDK oficial de AfipSDK) — instala limpio, sin dependencias problemáticas.
- `segno==1.6.6` — **ya no hace falta** para el camino principal (ver S3), queda como plan B.

## S1 — la emisión funciona

`afip.ElectronicBilling.createNextVoucher(data)` devuelve, textual:

```json
{"CAE": "86290616895615", "CAEFchVto": "2026-07-31", "voucherNumber": 14678}
```

⚠️ **La clave es `voucherNumber` (camelCase), no `voucher_number`** como la nombra la doc. La primera corrida
del spike falló silenciosamente por esto: leía `voucher_number`, obtenía `0`, y se salteaba los pasos de PDF
sin que nada explotara. **No leerle el shape a la doc — leérselo al WS.**

`createNextVoucher` resuelve la numeración solo (`getLastVoucher` + 1). No hay que llevar contador propio.

## S2 — shape completo de la respuesta

`getVoucherInfo(nro, ptoVta, cbteTipo)` → `{"ResultGet": {...}}`. Campos que importan para persistir y auditar:

```json
{"Resultado": "A", "CodAutorizacion": "86290616918140", "EmisionTipo": "CAE",
 "FchVto": "20260731", "FchProceso": "20260721093650",
 "CbteDesde": 14679, "CbteHasta": 14679, "CbteFch": "20260721",
 "ImpTotal": 1, "ImpNeto": 1, "ImpIVA": 0, "CondicionIVAReceptorId": 5, "PtoVta": 1, "CbteTipo": 11}
```

- `Resultado: "A"` = aprobado. (No se capturó una respuesta `"R"`/`"O"` — **no se probó el camino de rechazo**, ver pendientes.)
- Las fechas del WS vienen en `yyyymmdd` (string), mientras que `createNextVoucher` devuelve el vto del CAE en ISO `yyyy-mm-dd`. **Dos formatos distintos en la misma operación** — normalizar en el gateway.

## S3 — el QR: el template lo trae, y el handoff se equivocaba

El handoff §3.2 decía *"la doc dice que el SDK NO genera el QR → armar HTML custom"*. **Falso para el template.**
Se generaron los dos PDFs y se renderizaron a 300 dpi:

- **Template `invoice-c`** (`out/tpl-1.png`): factura fiscal completa y prolija — encabezado con letra **C** y cód. 011, datos del emisor, del receptor, tabla de ítems, importe total, **QR abajo a la izquierda**, CAE y vencimiento. Directamente presentable.
- **Custom HTML + segno** (`out/cst-1.png`): funciona, pero es un HTML crudo que habría que maquetar entero a mano.

**Ambos QR decodifican y apuntan a `www.afip.gob.ar/fe/qr/` con el payload correcto.**

⚠️ **Control corrido antes de creer el resultado:** a 90 dpi el decodificador devolvió **0 QR en ambos PDFs** —
incluido el custom, cuyo QR generamos nosotros y sabíamos que estaba. Ese cero no era un hallazgo sobre el
template: era el instrumento fallando por resolución. A 300 dpi ambos decodifican. *Un vacío del propio
instrumento no es evidencia.*

### 🔴 Riesgo abierto: el QR del template declara la moneda como `ARS`, no `PES`

QR del template, decodificado:
```json
{"ver":1,"fecha":"2026-07-21","cuit":20409378472,"ptoVta":1,"tipoCmp":11,"nroCmp":14680,
 "importe":1,"moneda":"ARS","ctz":1,"tipoDocRec":99,"nroDocRec":0,"tipoCodAut":"E","codAut":86290616939150}
```

La tabla de monedas de AFIP usa **`PES`** para pesos argentinos (`ARS` es el código ISO 4217, no el de AFIP), y
el payload que efectivamente se mandó al WS iba con `MonId: "PES"`. **Probado:** pasarle `currency_id: "PES"` en
los params del template **no cambia el QR** — sigue emitiendo `"ARS"`. Está hardcodeado del lado de AfipSDK.

- **Qué NO sabemos:** si el verificador de comprobantes de AFIP rechaza o tolera `ARS` en ese campo. No se probó
  escanear el QR contra el validador oficial. **No asumir que está bien solo porque el PDF se ve bien.**
- **Acción pendiente antes de producción:** validar un QR emitido contra el verificador público de AFIP; si
  rechaza → reportarlo a AfipSDK o caer al modo custom (donde controlamos el payload, ya probado y funcionando).

## Lo que falló, y por qué no bloquea

| Paso | Error | Interpretación |
|---|---|---|
| `getSalesPoints()` | `(602) Sin Resultados - Metodo FEParamGetPtosVenta` | Esperado: el CUIT de testing **compartido** no tiene puntos de venta declarados. `createNextVoucher` con `PtoVta=1` funciona igual. **No usar `getSalesPoints` como precondición** — con CUIT propio habría que re-verificar. |
| `createPDF` template (1er intento) | HTTP 400 con lista de campos | Regalo: el error enumeró los **campos obligatorios reales** del template (ver abajo). |

### Campos obligatorios del template `invoice-c` — más que los del handoff

El handoff §3.2 listaba los params. La realidad exige además, y con estos formatos:

- `issue_date` y `cae_due_date` en **DD/MM/YYYY** (no ISO — el WS devuelve ISO, hay que convertir).
- `receiver_document_type` y `concept` son **enteros**, no strings legibles.
- Obligatorios que el handoff no listaba: `issuer_gross_income`, `issuer_activity_start_date`,
  `receiver_address`, `sale_condition`, `net_amount_taxed`, `net_amount_untaxed`, `exempt_amount`.

👉 **Consecuencia de diseño:** el perfil fiscal del emprendedor (ingresos brutos, inicio de actividades,
domicilio comercial, razón social, condición IVA) tiene que estar **cargado antes** de poder emitir el PDF.
Son datos de alta, no del flujo de cada factura.

## Guardrail fiscal: verificado en el payload

`DocTipo=99` (consumidor final) + `CondicionIVAReceptorId=5` fue **aceptado**. Es la combinación que exige la
RG 5616/2024 y que ARCA ya pagó caro (error 10243 con `Cond=1`). En Factura C la clave `Iva` se **omite**
(no se manda array vacío) — confirmado, la emisión pasó así.

## Pendientes que este spike NO cubrió

1. **Camino de rechazo** (`Resultado: "R"`, `Observaciones`, `Errores`) — solo se ejercitó el camino feliz.
2. **CUIT propio con certificado real** — todo corrió con el CUIT de testing compartido. El onboarding
   (`create-cert-dev/prod`, `auth-web-service-*`) no se tocó.
3. **Validación del QR contra el verificador oficial de AFIP** (riesgo `ARS` de arriba).
4. **La URL del PDF expira a las 24h** (`file_expiration` en la respuesta) — no se probó el re-hosteo.
5. **Producción** — todo fue homologación.

## Reproducir

```bash
scp spike.py unreal-copilot:/opt/uc-spikes/afip-emit-pdf/
ssh unreal-copilot "cd /opt/uc-spikes/afip-emit-pdf && \
  AFIP_ACCESS_TOKEN=\$(cat /root/.secrets/afip-spike.token) \
  /opt/uc-afip-spike-venv/bin/python spike.py"
```

El token vive en el VPS en `/root/.secrets/afip-spike.token` (chmod 600), fuera del repo. En la PC está en
`afip sdk tincho toc.txt`, ya listado en `.gitignore` (línea 14).

⚠️ Cada corrida **emite una factura real en homologación** (consume numeración). Es homologación, no producción.
