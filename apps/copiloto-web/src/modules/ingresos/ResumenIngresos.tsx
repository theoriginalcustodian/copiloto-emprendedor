import { formatearImporte, type ResumenIngresos as ResumenIngresosDato } from '@copiloto/core';

import { Surface } from '../../design-system';

export interface ResumenIngresosProps {
  resumen: ResumenIngresosDato;
}

/**
 * "Bloque negro" de Ingresos (Tarea 3, gramática Monzo, CLAUDE.md §5) — mismo tratamiento visual
 * que `ResumenMes` de `gastos` (`Surface variant="bloque"`, ya existente, no se modifica acá).
 *
 * Backend cerró el gap que este componente escaló (`GET /ingresos/resumen`, PR#488, mergeado
 * ~15min después de mi propio `hallazgo_` al buzón): ya no hay que fabricar el label recortando
 * alcance — `resumen.total` viene RECORTADO por período desde `CobroStore.total_periodo()`, mismo
 * criterio de fechas que `GastoStore.resumen()`. `mesAnterior` es `string | null` (`null` = "sin
 * datos ese mes", nunca `'0.00'` fabricado — ver el docstring de `ResumenIngresos` en
 * `packages/core`).
 */
export function ResumenIngresos({ resumen }: ResumenIngresosProps) {
  return (
    <Surface variant="bloque" className="ingresos-resumen" data-testid="ingresos-resumen">
      <p className="ingresos-resumen__label" data-testid="ingresos-resumen-label">
        Cobraste este mes
      </p>
      <p className="ingresos-resumen__total" data-testid="ingresos-resumen-total">
        {formatearImporte(resumen.total)}
      </p>
      {resumen.mesAnterior != null && (
        <span className="ingresos-resumen__comp" data-testid="ingresos-resumen-comp">
          Mes anterior: {formatearImporte(resumen.mesAnterior)}
        </span>
      )}
    </Surface>
  );
}
