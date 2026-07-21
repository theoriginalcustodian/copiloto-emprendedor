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

## App (sesión frontend, arranca con el handoff)

- [ ] **F5** Ajustes: perfil fiscal + alta ARCA. Clave fiscal con el aviso de seguridad debajo, se pide **una sola vez**. Sin perfil completo, facturar deshabilitado.
- [ ] **F6** Emisión: formularios del flujo determinista + resumen + HITL **[Confirmar] [Cancelar] [Editar y confirmar]** + comprobante con [Guardar]/[Compartir].
- [ ] La card de descarga avisa que el PDF **expira a las 24 h** y después se baja del portal de AFIP. **No almacenamos el comprobante.**
- [ ] Gate visual multi-tema, cero hex literales.

## Cierre del sprint

- [ ] **E2E completo desde el device**: alta → emitir → recibir PDF → anular → consultar. Con evidencia.

## Bloquea producción (no el sprint)

- [ ] QR validado contra el verificador oficial (riesgo `ARS` vs `PES`).
- [ ] Tope de consumidor final sin identificar confirmado contra normativa.
