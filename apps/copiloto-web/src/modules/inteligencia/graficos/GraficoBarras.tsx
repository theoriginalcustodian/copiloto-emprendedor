import { formatearImporte } from '@copiloto/core';

/**
 * `GraficoBarras` — port de `apps/mobile/src/modules/inteligencia/graficos/GraficoBarras.tsx`. Mismo
 * enfoque: `<div>`s de alto proporcional, SIN librería de gráficos ni SVG (el original evita SVG a
 * propósito — "colores plenos, sin degradados" — y acá no hay ni siquiera el motivo de mobile de
 * reusar una dependencia ya presente; menos razón todavía para sumar una nueva en web).
 *
 * Sirve para el gráfico 1 (facturación, una serie) y el 2 (entró vs salió, dos series enfrentadas) —
 * `series` decide cuántas barras dibuja por punto, igual que el original.
 */

export interface SerieBarra {
  /** Clave estable de la serie (ej. `'entro'`/`'salio'`), va en el callback de click. */
  id: string;
  etiqueta: string;
  color: string;
  /** Un valor por punto, mismo índice que `puntos`. `null` = sin dato — no dibuja barra. */
  valores: readonly (string | null)[];
}

export interface GraficoBarrasProps {
  /** Las etiquetas del eje (meses, típicamente) — un punto por posición. */
  puntos: readonly string[];
  series: readonly SerieBarra[];
  /** `"Julio · 12 facturas"` — período/fuente siempre visible, mismo contrato que mobile. */
  epigrafe?: string;
  onSegmentoClick?: (punto: string, serieId: string) => void;
  testId?: string;
}

const ALTO = 110;

export function GraficoBarras({ puntos, series, epigrafe, onSegmentoClick, testId }: GraficoBarrasProps) {
  const max = Math.max(
    1,
    ...series.flatMap((s) => s.valores.filter((v): v is string => v != null).map((v) => Math.abs(Number(v)))),
  );

  return (
    <div className="grafico-barras" data-testid={testId}>
      {epigrafe != null && epigrafe !== '' && (
        <p className="grafico-barras__epigrafe" data-testid={testId ? `${testId}-epigrafe` : undefined}>
          {epigrafe}
        </p>
      )}

      {series.length > 1 && (
        <div className="grafico-barras__leyenda">
          {series.map((s) => (
            <div key={s.id} className="grafico-barras__leyenda-item">
              <span className="grafico-barras__leyenda-punto" style={{ backgroundColor: s.color }} />
              <span>{s.etiqueta}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grafico-barras__fila">
        {puntos.length === 0 && (
          <p className="grafico-barras__vacio" data-testid={testId ? `${testId}-vacio` : undefined}>
            Sin datos en este período.
          </p>
        )}

        {puntos.map((punto, indice) => (
          // `punto` es una ETIQUETA (mes, o el título de un trabajo) — no garantizada única (ej.: dos
          // trabajos del mismo día en Margen por Trabajo). El índice sí lo es.
          <div
            key={`${indice}-${punto}`}
            className="grafico-barras__columna"
            data-testid={testId ? `${testId}-punto-${punto}` : undefined}
          >
            <div className="grafico-barras__barras-punto">
              {series.map((s) => {
                const valor = s.valores[indice] ?? null;
                const clickeable = onSegmentoClick != null && valor != null;
                const alto = valor == null ? 1 : Math.max(2, (Math.abs(Number(valor)) / max) * ALTO);
                const color = valor == null ? 'var(--label)' : s.color;
                const estilo = { height: alto, backgroundColor: color };

                if (!clickeable) {
                  return (
                    <div
                      key={s.id}
                      className="grafico-barras__barra"
                      style={estilo}
                      data-testid={testId ? `${testId}-barra-${punto}-${s.id}` : undefined}
                    />
                  );
                }
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="grafico-barras__barra grafico-barras__barra--clickeable"
                    style={estilo}
                    onClick={() => onSegmentoClick(punto, s.id)}
                    aria-label={`${s.etiqueta} de ${punto}, ${formatearImporte(valor as string)}`}
                    data-testid={testId ? `${testId}-barra-${punto}-${s.id}` : undefined}
                  />
                );
              })}
            </div>
            <span className="grafico-barras__etiqueta-eje">{punto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
