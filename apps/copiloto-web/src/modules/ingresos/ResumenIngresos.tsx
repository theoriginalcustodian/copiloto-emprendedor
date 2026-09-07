import { formatearImporte } from '@copiloto/core';

import { Surface } from '../../design-system';

export interface ResumenIngresosProps {
  total: string;
}

/**
 * "Bloque negro" de Ingresos (Tarea 3, gramática Monzo, CLAUDE.md §5) — mismo tratamiento visual
 * que `ResumenMes` de `gastos` (`Surface variant="bloque"`, ya existente, no se modifica acá).
 *
 * ⚠️ Tiene MENOS dato del que pide el mockup fuente (`#ingresos .resumen`: label "Cobraste este
 * mes" + chip "Mes anterior: $367.000"). Verificado en las 3 capas (`packages/core`, `afip_web.py`,
 * `cobro_store.py`): no existe `/ingresos/resumen` — sólo `listarIngresos()`, cuyo `total` suma el
 * backend sobre hasta 100 filas más recientes **sin recorte por mes**. `CobroStore.total_periodo()`
 * ya tiene la lógica (mismo criterio de fechas que `GastoStore.resumen()`) pero nadie la expuso por
 * HTTP todavía. Detalle completo + costo de cerrarlo:
 * `coordinacion/abierto/2026-09-07_hallazgo_frontend1-ingresos-a-planificacion_falta-endpoint-resumen-ingresos.md`.
 *
 * Mientras tanto: el label dice **"Cobraste"**, no "Cobraste este mes" — afirmar un alcance mensual
 * sobre un dato que no lo tiene sería mentir (regla de oro #1). Sin chip de "Mes anterior": no hay
 * ese dato, y no se inventa un renglón para no dejarlo vacío.
 */
export function ResumenIngresos({ total }: ResumenIngresosProps) {
  return (
    <Surface variant="bloque" className="ingresos-resumen" data-testid="ingresos-resumen">
      <p className="ingresos-resumen__label" data-testid="ingresos-resumen-label">
        Cobraste
      </p>
      <p className="ingresos-resumen__total" data-testid="ingresos-resumen-total">
        {formatearImporte(total)}
      </p>
    </Surface>
  );
}
