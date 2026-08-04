import { formatearImporte } from '@copiloto/core';

/**
 * `GraficoTorta` — port de `apps/mobile/src/modules/inteligencia/graficos/GraficoTorta.tsx`. El
 * original usa `react-native-svg` porque un círculo proporcional no se arma con `View`s como las
 * barras; acá el equivalente es SVG NATIVO del navegador (`<svg>`/`<path>` del DOM) — no es una
 * librería de gráficos, es la misma primitiva gráfica que ya usa cualquier ícono del design-system.
 * Cero degradados, colores plenos, mismo criterio que el original.
 *
 * Color CATEGÓRICO — sigue a la categoría (por posición en `orden`), no a la posición en la torta:
 * si un mes no tiene gasto en "sueldos", la porción de "sueldos" no existe, pero "transporte" sigue
 * siendo el mismo color que la vez pasada.
 */

export interface PorcionTorta {
  categoria: string;
  /** Decimal string o `null`. Una porción con `null`/`'0'`/`'0.00'` no se dibuja. */
  valor: string | null;
}

export interface GraficoTortaProps {
  porciones: readonly PorcionTorta[];
  /** El orden CANÓNICO de categorías — define qué color le toca a cada una, independiente del orden
   * en que vinieron las porciones de esta respuesta. */
  orden: readonly string[];
  epigrafe?: string;
  onSegmentoClick?: (categoria: string) => void;
  testId?: string;
}

const RADIO = 70;
const CENTRO = 80;

/**
 * Paleta categórica fija — port 1:1 de `CATEGORICO` en `apps/mobile/src/theme/tokens.ts`. Un solo
 * set literal, no theme-dependent (igual que el original: la identidad de una categoría no puede
 * cambiar con el skin). `themes.css` no tiene una variable equivalente porque nunca hizo falta hasta
 * este gráfico — no es una omisión de este port.
 */
const CATEGORICO: readonly string[] = [
  '#8c398b',
  '#eb5484',
  '#aa3900',
  '#929d00',
  '#00915d',
  '#00a7b8',
  '#1f57c5',
  '#876bed',
];

/** Un punto sobre la circunferencia, ángulo en radianes desde las 12 (no desde las 3). */
function puntoEnCirculo(anguloRad: number) {
  return {
    x: CENTRO + RADIO * Math.sin(anguloRad),
    y: CENTRO - RADIO * Math.cos(anguloRad),
  };
}

/** El `d` de un `<path>` de arco de torta entre dos ángulos (radianes, desde las 12, sentido horario). */
function arcoPath(anguloInicio: number, anguloFin: number): string {
  const inicio = puntoEnCirculo(anguloInicio);
  const fin = puntoEnCirculo(anguloFin);
  const grande = anguloFin - anguloInicio > Math.PI ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${inicio.x} ${inicio.y} A ${RADIO} ${RADIO} 0 ${grande} 1 ${fin.x} ${fin.y} Z`;
}

export function GraficoTorta({ porciones, orden, epigrafe, onSegmentoClick, testId }: GraficoTortaProps) {
  const conValor = porciones
    .map((p) => ({ ...p, num: p.valor != null ? Number(p.valor) : 0 }))
    .filter((p) => p.num > 0);
  const total = conValor.reduce((acc, p) => acc + p.num, 0);

  let acumulado = 0;
  const arcos = conValor.map((p) => {
    const anguloInicio = acumulado * 2 * Math.PI;
    const fraccion = total > 0 ? p.num / total : 0;
    acumulado += fraccion;
    const anguloFin = acumulado * 2 * Math.PI;
    const indiceOrden = orden.indexOf(p.categoria);
    const color = indiceOrden >= 0 ? CATEGORICO[indiceOrden % CATEGORICO.length] : 'var(--label)';
    return { ...p, anguloInicio, anguloFin, color, fraccion };
  });

  return (
    <div className="grafico-torta" data-testid={testId}>
      {epigrafe != null && epigrafe !== '' && (
        <p className="grafico-torta__epigrafe" data-testid={testId ? `${testId}-epigrafe` : undefined}>
          {epigrafe}
        </p>
      )}

      {arcos.length === 0 ? (
        <p className="grafico-torta__vacio" data-testid={testId ? `${testId}-vacio` : undefined}>
          Sin gastos en este período.
        </p>
      ) : (
        <div className="grafico-torta__cuerpo">
          <svg width={CENTRO * 2} height={CENTRO * 2} data-testid={testId ? `${testId}-svg` : undefined}>
            {arcos.map((a) =>
              // Un círculo completo (una sola categoría con el 100%) no se puede dibujar como un arco
              // "grande" de inicio=fin — SVG lo colapsa a nada. Se dibuja como dos semicírculos.
              a.fraccion >= 0.999 ? (
                <path
                  key={a.categoria}
                  d={`${arcoPath(0, Math.PI)} ${arcoPath(Math.PI, 2 * Math.PI)}`}
                  fill={a.color}
                  onClick={onSegmentoClick ? () => onSegmentoClick(a.categoria) : undefined}
                  style={onSegmentoClick ? { cursor: 'pointer' } : undefined}
                  data-testid={testId ? `${testId}-porcion-${a.categoria}` : undefined}
                />
              ) : (
                <path
                  key={a.categoria}
                  d={arcoPath(a.anguloInicio, a.anguloFin)}
                  fill={a.color}
                  onClick={onSegmentoClick ? () => onSegmentoClick(a.categoria) : undefined}
                  style={onSegmentoClick ? { cursor: 'pointer' } : undefined}
                  data-testid={testId ? `${testId}-porcion-${a.categoria}` : undefined}
                />
              ),
            )}
          </svg>

          <div className="grafico-torta__leyenda">
            {arcos.map((a) => (
              <div key={a.categoria} className="grafico-torta__leyenda-item">
                <span className="grafico-torta__leyenda-punto" style={{ backgroundColor: a.color }} />
                <span className="grafico-torta__leyenda-categoria">{a.categoria}</span>
                <span className="grafico-torta__leyenda-total">{formatearImporte(String(a.num))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
