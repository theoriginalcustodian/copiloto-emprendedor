import type { GastoPropuesto, IngresoPropuesto, PresupuestoPropuesto } from '@copiloto/core';

import type { ValoresInicialesGasto } from '../gastos/FormularioGasto';
import type { ValoresInicialesIngreso } from '../ingresos/FormularioIngreso';
import type { ValoresInicialesPresupuesto } from '../presupuestos/FormularioPresupuesto';

/**
 * Propuesta del motor → valores iniciales del formulario. **Una sola definición**, compartida por las
 * dos puertas que abren el mismo formulario con lo que el motor entendió:
 *
 *  - la card del chat (`chat/Tarjeta*Propuesto`), y
 *  - el dictado desde la función (`useDictadoPorFuncion` → `Pantalla*`).
 *
 * Antes cada tarjeta traía su mapeo inline: la segunda puerta lo habría copiado, y las dos copias
 * difieren el día que alguien arregla una (p. ej. la fecha `''` → omitir la clave).
 *
 * `cliente` no tiene mapeo: `DatosCliente` ya ES la forma de `iniciales` de `FormularioCliente`.
 */

export function inicialesDeGasto(p: GastoPropuesto): ValoresInicialesGasto {
  return {
    monto: p.monto,
    categoria: p.categoria,
    // Se mandan sólo si vinieron: `?? undefined` y no `?? ''`, para que el formulario omita la
    // clave en el body en vez de guardar un string vacío.
    proveedor: p.proveedor ?? undefined,
    medioPago: p.medioPago ?? undefined,
    descripcion: p.descripcion ?? undefined,
    // Sólo viene en `origen: 'foto'` — ver el docstring de `GastoPropuesto.montoSugerido`.
    montoSugerido: p.montoSugerido ?? undefined,
    // 🔴 La fecha SÍ viaja acá, al revés que en el alta manual: el motor ya resolvió lo que se
    // dictó («ayer», «el lunes»). Omitirla haría que el backend ponga hoy y un gasto dictado
    // como "lo de ayer" quede con la fecha equivocada — y los días 30 y 31, en otro MES.
    fecha: p.fecha !== '' ? p.fecha : undefined,
  };
}

export function inicialesDeIngreso(p: IngresoPropuesto): ValoresInicialesIngreso {
  return {
    monto: p.monto,
    cliente: p.clienteNombre ?? undefined,
    medio: p.medio ?? undefined,
    concepto: p.concepto ?? undefined,
    fecha: p.fecha !== '' ? p.fecha : undefined,
  };
}

export function inicialesDePresupuesto(p: PresupuestoPropuesto): ValoresInicialesPresupuesto {
  return {
    concepto: p.concepto,
    receptor: {
      nombre: p.receptor.nombre,
      docTipo: p.receptor.docTipo,
      docNro: p.receptor.docNro,
      contacto: p.receptor.contacto,
    },
    items: p.items,
  };
}
