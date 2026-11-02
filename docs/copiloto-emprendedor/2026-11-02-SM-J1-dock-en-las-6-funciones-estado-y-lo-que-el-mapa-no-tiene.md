# SM-J1 — dock en las 6 funciones: qué quedó y qué se documenta como enmienda

> Medido 2026-11-02 sobre `frontend2/sm-j1-dock`. `DockFuncion` (SM-I2) reemplaza a `MicFuncion` (borrado).

| Función | Dock | Placeholder | Alta |
|---|---|---|---|
| Gastos | ✅ (SM-I2) | «Anotá un gasto, o hablá…» | pastilla + «Ticket» |
| Ingresos | ✅ | «Anotá un cobro, o hablá…» | «Anotar que me pagaron» |
| Presupuestos | ✅ | «Contame el presupuesto, o hablá…» | «Nuevo presupuesto» |
| Clientes | ✅ | «Nombre del cliente, o hablá…» | «Nuevo cliente» |
| Facturación | ❌ **sin contrato** | — | — |
| Inteligencia (`bi`) | ❌ **sin contrato** | — | — |

## Por qué Facturación e Inteligencia no llevan dock todavía
`ContextoTranscripcion` es `'gasto'|'ingreso'|'presupuesto'|'cliente'` (`packages/core/src/api/transcribir.ts:7`)
y cada dock **prellena un formulario**. Facturación es un asistente de pasos y Inteligencia es lectura:
no hay formulario que prellenar. Qué hace el texto ahí (¿arranca la factura? ¿pregunta al copiloto?) es
forma de endpoint → `pedido_` a planificación, no se inventa.

## Enmiendas fundadas (el mapa se corrige, la app se queda) — D4
- **BUSCAR** en Gastos: la app lo tiene y el mapa no; se queda.
- **«Te deben»** en Facturación: ídem.
- **Chip «N facturas · N impaga»**: NO se implementa. `ResumenFacturado.tsx:12-14`: la portada no trae
  conteos y derivarlos del listado paginado da un número que depende de cuántas páginas se bajaron.
- **«Últimos»**: ya existía en Ingresos (`rotuloLista`); se suma a Gastos.

## ENMIENDA FUNDADA — Facturación e Inteligencia NO llevan dock (veredicto de planificación, 2026-11-02)
`packages/core/src/api/transcribir.ts:7` admite exactamente `'gasto' | 'ingreso' | 'presupuesto' | 'cliente'`; no es una limitación accidental.
1. **El dock es un prellenador de formulario**: dictar o escribir → transcribir con un `contexto` → prellenar el formulario de esa función. Facturación es asistente (la factura se propone y se confirma por card) e Inteligencia es lectura: no hay destino. Un dock sin destino promete una acción que no existe (misma clase que SM-N17).
2. **Facturación, razón de seguridad**: emitir es irreversible; la vía canónica es la card HITL con confirmación explícita. Un dock que prellene por otro camino sería una segunda entrada a una acción irreversible. No es un dock faltante: es un dock que no debe existir.
3. **Ampliar `ContextoTranscripcion`** con dos valores sin destino sumaría superficie de contrato y ramas muertas en el backend.

Las dos funciones salen del denominador de J1 por enmienda; no quedan como deuda.
