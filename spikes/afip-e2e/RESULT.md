# RESULT — E2E de facturación (F4 + F4b)

> **Fecha:** 2026-07-21 · **Ambiente:** homologación · **Dónde:** VPS `unreal-copilot`
> **Sin mocks en ningún tramo:** workflows de Temporal reales, activities reales, gateway real,
> certificado real del emprendedor (generado por el spike de onboarding) y Postgres real.

## Veredicto: 🟢 E2E COMPLETO EN VERDE

```
[2] borrador por signals            → estado: esperando_confirmacion · total: 1000.00 · faltantes: []
[3] gate HITL con token INVÁLIDO    → rechazado, sigue esperando (no-op)
[4] confirmar con el token correcto → FACTURA EMITIDA · CAE 86290618209882 · N° 0001-00000006
                                      PDF generado
[5] anular con nota de crédito      → NC EMITIDA · CAE 86290618210085 · N° 2
[6] consultar comprobantes          → tipo 13 N° 2 emitida
                                      tipo 11 N° 6 anulada · asoc 2
[7] anular DE NUEVO (adversarial)   → rechazado: "ya fue anulada con la nota de crédito N° 2"
```

**PDF verificado visualmente:** Factura C (cód. 011), datos del emisor y del receptor, ítem, importe
total $1000, CAE, vencimiento del CAE y **QR**. Presentable tal cual. (El render no se versiona: lleva
el CUIT del operador impreso.)

## Lo que este E2E prueba de verdad

- **La máquina de estados converge desde los slots.** El borrador se llena por signals tipados y el
  estado se deriva del contenido, no de un puntero mutable.
- **El gate HITL es fail-closed.** Un token que no corresponde a los datos actuales no emite: es un
  no-op con motivo. Sin eso, una card vieja podría autorizar una factura distinta de la que el usuario
  revisó.
- **La anulación es una nota de crédito de verdad**, con `CbtesAsoc` apuntando al original, y la
  factura queda marcada con el número de la NC que la neutralizó.
- **No se puede anular dos veces.** La regla vive en el validador puro, no en la UI.

## Bugs encontrados corriendo esto (ninguno lo cazaba un test unitario)

1. **`afip.py` no estaba instalado en el venv del copiloto** (sólo en el del spike). El workflow llegaba
   a emitir y moría con `ModuleNotFoundError`. Agregado a `requirements.txt` pineado en `1.2.0`.
2. **Carrera al arrancar:** si los signals llegan antes de que termine `cargar_contexto_factura`, el
   validador reporta `perfil_ausente` porque el perfil todavía es `None`. El workflow **se corrige solo**
   al asignarlo (recalcula), pero la UI no puede confiar en el primer estado que lee: tiene que esperar
   a que converja. **Esto es un requisito para la sesión de frontend.**

## Lo que NO prueba

- **Producción.** Todo fue homologación: los comprobantes no tienen efecto fiscal. Falta certificado de
  producción, punto de venta habilitado a web services y `production: true`.
- Servicios (concepto 2/3) contra AFIP — sólo se ejercitó concepto 1 (productos).
- Facturas A y B (no implementadas: `afip_rules` falla ruidoso a propósito).
- El camino de rechazo de AFIP (`Resultado: "R"`): el gateway lo distingue y no lo reintenta, pero no
  se forzó un rechazo real.

## Reproducir

```bash
ssh unreal-copilot
cd /opt/uc-spikes/afip-e2e
set -a; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/copiloto.env; set +a
AFIP_ACCESS_TOKEN=$(cat /root/.secrets/afip-spike.token) \
  /opt/uc-copiloto-venv/bin/python e2e_factura.py
```

Cada corrida emite una factura y una NC en homologación, y borra su tenant de prueba al terminar (los
comprobantes en AFIP quedan: no se pueden borrar, y es correcto que así sea).
