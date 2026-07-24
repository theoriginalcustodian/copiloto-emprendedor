export * from './ports';
export * from './chatMachine';
export * from './motivoFallo';
export * from './hitl';
export * from './modo';
// `gasto_propuesto` — la card editable del gasto dictado. Propone, NO guarda: el write lo hace la app
// cuando el emprendedor toca Guardar. Ver el docstring del módulo.
export * from './gastoPropuesto';
export * from './clientePropuesto';
// `ingreso_propuesto` — [ASSUMED_PENDING_VERIFY], ver el docstring del módulo: misma convención que
// las dos de arriba (data = body de POST, kind abierto), sin medir todavía contra el backend real.
export * from './ingresoPropuesto';
// `presupuesto_propuesto` — `data` SÍ está confirmada (contrato de backend §2.4); sólo el `kind` es
// [ASSUMED_PENDING_VERIFY]. Ver el docstring del módulo.
export * from './presupuestoPropuesto';
