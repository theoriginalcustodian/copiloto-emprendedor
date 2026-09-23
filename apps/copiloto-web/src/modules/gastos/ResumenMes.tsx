import { ETIQUETA_CATEGORIA, formatearFechaCorta, formatearImporte, type ResumenGastos } from '@copiloto/core';

import { Surface } from '../../design-system';

/**
 * `ResumenMes` — port de `apps/mobile/src/modules/gastos/ResumenMes.tsx` (mismo dato, misma regla
 * de normalización de barras — ver ese archivo para el porqué de "normalizar sobre la suma real,
 * no sobre 100" y "total 0.00 no es un vacío"), repintado a "bloque negro" (Tarea 3, gramática
 * Monzo, CLAUDE.md §5): "Gastado este mes" es la cifra ACCIONABLE de esta función. `Surface
 * variant="bloque"` — ver el comentario de cabecera de `themes.css` sobre el placeholder pendiente
 * en oscuro/nocturno.
 */
export interface ResumenMesProps {
  resumen: ResumenGastos;
}

export function ResumenMes({ resumen }: ResumenMesProps) {
  const sumaPorcentajes = resumen.porCategoria.reduce((a, c) => a + c.porcentaje, 0);

  return (
    <Surface variant="bloque" className="gastos-resumen" data-testid="gastos-resumen">
      {/* H-A4-6: `resumen.periodo` llega "YYYY-MM" (sin día) del backend — ISO crudo si se pinta
          tal cual. `formatearFechaCorta` ya resuelve un período sin día como su día 1. */}
      <p className="gastos-resumen__periodo" data-testid="gastos-resumen-periodo">
        Gastado en {formatearFechaCorta(resumen.periodo)}
      </p>
      <p className="gastos-resumen__total" data-testid="gastos-resumen-total">
        {formatearImporte(resumen.total)}
      </p>

      {resumen.mesAnterior != null && (
        <p className="gastos-resumen__mes-anterior" data-testid="gastos-resumen-mes-anterior">
          Mes anterior: {formatearImporte(resumen.mesAnterior)}
        </p>
      )}

      <div className="gastos-resumen__categorias">
        {resumen.porCategoria.map((c) => (
          <div key={c.categoria} className="gastos-resumen__fila" data-testid={`gastos-resumen-cat-${c.categoria}`}>
            <div className="gastos-resumen__encabezado">
              <span className="gastos-resumen__cat-label">{ETIQUETA_CATEGORIA[c.categoria]}</span>
              <span className="gastos-resumen__cat-total">{formatearImporte(c.total)}</span>
            </div>
            <div className="gastos-resumen__barra-fondo">
              <div
                className="gastos-resumen__barra"
                data-testid={`gastos-resumen-barra-${c.categoria}`}
                style={{ width: sumaPorcentajes > 0 ? `${(c.porcentaje / sumaPorcentajes) * 100}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
