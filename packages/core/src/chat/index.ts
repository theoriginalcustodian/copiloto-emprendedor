export * from './ports';
export * from './chatMachine';
export * from './motivoFallo';
export * from './hitl';
export * from './modo';
// `gasto_propuesto` — la card editable del gasto dictado. Propone, NO guarda: el write lo hace la app
// cuando el emprendedor toca Guardar. Ver el docstring del módulo.
export * from './gastoPropuesto';
export * from './clientePropuesto';
// `ingreso_propuesto` — CONFIRMADO en device (hito 8, PR#111/#112): el backend emite exactamente lo
// que este módulo espera. Ver `avance_backend-a-todos_hito8-ingreso-propuesto-verificado-en-device`.
export * from './ingresoPropuesto';
// `presupuesto_propuesto` — `data` SÍ está confirmada (contrato de backend §2.4); sólo el `kind` es
// [ASSUMED_PENDING_VERIFY]. Ver el docstring del módulo.
export * from './presupuestoPropuesto';
// `factura_propuesta` — hito 9: `data` confirmada por el contrato §2.1; sólo el `kind` es
// [ASSUMED_PENDING_VERIFY]. Ver el docstring del módulo.
export * from './facturaPropuesta';
