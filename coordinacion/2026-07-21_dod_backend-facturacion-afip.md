# DoD — Sprint facturación AFIP (goal del sprint)

> Backend: rama `feat/facturacion-afip-determinista`, worktree `../_copiloto-afip-wt`.
> Diseño: `docs/copiloto-emprendedor/2026-07-21-diseno-facturacion-afip-determinista.md`
> **Binario: verde con evidencia o no está.** Tests en el VPS, nunca en la PC.
> **GOAL FINAL: emitir, anular y consultar facturas reales desde la app, E2E.**

## Backend — ✅ CERRADO (rama `feat/facturacion-afip-determinista`, pusheada)

- [x] Spike: CAE real en homologación + PDF con QR verificado.
- [x] **F1** validador fiscal puro (`afip_rules.py`).
- [x] **F2** `AfipGateway` + cert cifrado + claim-check + tablas `afip_*` con RLS. Adversarial cross-tenant contra Postgres real.
- [x] **F3** alta ARCA durable. **Clave fiscal fuera del event history, verificado contra el historial real.** Certificado generado con el CUIT del operador.
- [x] **F4** `FacturaWorkflow`: estados derivados de los slots, gate HITL por token, idempotencia en dos capas.
- [x] **F4b** nota de crédito con `CbtesAsoc` + consulta. No se puede anular dos veces.
- [x] Superficie HTTP completa (`/afip/facturas/*`, `/afip/comprobantes/*`).
- [x] **459 tests verdes en el VPS.**

**Verificado en PRODUCCIÓN** (autorización del operador, 2 facturas):

| Comprobante | CAE | Estado |
|---|---|---|
| Factura C 0006-00000008 · $1000 | 86294776469171 | anulada por NC N° 1 |
| Factura C 0006-00000009 · $1000 | 86294777469313 | anulada por NC N° 2 |

Pendiente sin bloqueo: el camino de rechazo de AFIP (`Resultado:"R"`) no se forzó nunca.

## App (sesión frontend) — ✅ CERRADO

- [x] **F5** Ajustes: perfil fiscal + alta ARCA, con el aviso de seguridad pegado al campo de clave.
- [x] **F6** Emisión: formularios + resumen + HITL de 3 botones + comprobante con [Guardar]/[Compartir].
- [x] La card avisa que el PDF **expira a las 24 h**. Ambiente visible en el resumen; en producción el
      botón dice **"Emitir factura real"**.
- [x] Gate visual multi-tema, cero hex literales. 265/266 jest, `tsc` limpio.

## Cierre del sprint

- [x] **E2E desde el device** (SM-A217M): emitir → PDF → consultar → anular → nota de crédito.
      Factura C `0006-00000005` (CAE 86290619793525) → NC N° 5 (CAE 86290619803431), verificado
      contra `GET /afip/comprobantes` y contra la base, no contra la pantalla.
- [ ] **El alta ARCA desde el teléfono con la clave fiscal del operador.** Único punto abierto: la
      cuenta de pruebas ya venía vinculada, así que F5 está construida y verificada en render pero el
      alta nunca corrió desde la app. Requiere al operador.

## Bloquea producción (no el sprint)

- [ ] La **nota de crédito no genera PDF** (deuda registrada en `afip_anulacion_workflow.py`).
- [ ] Tope de consumidor final sin identificar confirmado contra normativa.
- [ ] **Rotar la `DATABASE_URL` de fusion** — se filtró en el transcript de la sesión.
- [x] ~~QR contra el verificador oficial~~ — el operador lo declaró fuera de nuestro alcance.

## Lo que el sprint dejó además del feature

- 8 bugs que **ningún unit test podía cazar**: sólo aparecieron contra AFIP real o en device.
- La lección más cara: *lo que AFIP acepta **autorizar** y lo que acepta **imprimir** son dos
  contratos distintos, y sólo el primero está documentado.* Dos bugs distintos fueron exactamente eso.
- Los tests escribían en la base de producción (552 filas huérfanas). Cerrado con fixture de barrido.
