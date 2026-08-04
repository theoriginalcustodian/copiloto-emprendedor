import { useCallback, useEffect, useState } from 'react';

import {
  CATEGORIAS_GASTO,
  ETIQUETA_CATEGORIA,
  esCategoriaValida,
  leerGraficoCategorias,
  leerGraficoEntroVsSalio,
  leerGraficoFacturacion,
  leerGraficoMargenTrabajo,
} from '@copiloto/core';

import { GraficoBarras } from './GraficoBarras';
import { GraficoTorta } from './GraficoTorta';

/**
 * `GraficosInteligencia` — port de `apps/mobile/src/modules/inteligencia/graficos/GraficosInteligencia.tsx`.
 * Los 4 gráficos, cada uno con su propia carga (endpoints independientes, no comparten el `estado`
 * de la portada). Sin drill-down en esta pasada — mismo alcance que mobile: los primitivos ya
 * exponen `onSegmentoClick`, pero wirear las 4 formas de `?detalle=` queda para después.
 */

function useGrafico<R>(leer: () => Promise<R>): R | null {
  const [resultado, setResultado] = useState<R | null>(null);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const res = await leer();
      if (vivo) setResultado(res);
    })();
    return () => {
      vivo = false;
    };
  }, [leer]);
  return resultado;
}

function Cargando({ testId }: { testId: string }) {
  return <div className="graficos-inteligencia__cargando" data-testid={testId} aria-hidden="true" />;
}

function TarjetaFacturacion() {
  const leer = useCallback(() => leerGraficoFacturacion(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testId="inteligencia-grafico-facturacion-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  return (
    <div data-testid="inteligencia-grafico-facturacion">
      <p className="graficos-inteligencia__rotulo">FACTURACIÓN</p>
      <div className="graficos-inteligencia__scroll">
        <GraficoBarras
          testId="grafico-facturacion"
          puntos={res.serie.map((p) => p.mes)}
          series={[
            {
              id: 'total',
              etiqueta: 'Facturado',
              color: 'var(--btn-bg)',
              valores: res.serie.map((p) => p.total),
            },
          ]}
          epigrafe={res.periodo !== '' ? res.periodo : undefined}
        />
      </div>
    </div>
  );
}

function TarjetaEntroVsSalio() {
  const leer = useCallback(() => leerGraficoEntroVsSalio(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testId="inteligencia-grafico-entro-vs-salio-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  return (
    <div data-testid="inteligencia-grafico-entro-vs-salio">
      <p className="graficos-inteligencia__rotulo">ENTRÓ VS SALIÓ</p>
      <div className="graficos-inteligencia__scroll">
        <GraficoBarras
          testId="grafico-entro-vs-salio"
          puntos={res.serie.map((p) => p.mes)}
          series={[
            { id: 'entro', etiqueta: 'Entró', color: 'var(--ok-fg)', valores: res.serie.map((p) => p.entro) },
            { id: 'salio', etiqueta: 'Salió', color: 'var(--danger-fg)', valores: res.serie.map((p) => p.salio) },
          ]}
          epigrafe={res.periodo !== '' ? res.periodo : undefined}
        />
      </div>
    </div>
  );
}

function TarjetaCategorias() {
  const leer = useCallback(() => leerGraficoCategorias(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testId="inteligencia-grafico-categorias-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  // `orden` colorea por ÍNDICE — se construye con las mismas etiquetas que se muestran, para que el
  // color de cada porción quede atado a la categoría, nunca a la posición en la respuesta.
  const ordenEtiquetas = CATEGORIAS_GASTO.map((c) => ETIQUETA_CATEGORIA[c]);
  const porciones = res.serie.map((p) => ({
    categoria: esCategoriaValida(p.categoria) ? ETIQUETA_CATEGORIA[p.categoria] : p.categoria,
    valor: p.total,
  }));

  return (
    <div data-testid="inteligencia-grafico-categorias">
      <p className="graficos-inteligencia__rotulo">EN QUÉ SE ME VA</p>
      <GraficoTorta
        testId="grafico-categorias"
        porciones={porciones}
        orden={ordenEtiquetas}
        epigrafe={res.periodo !== '' ? res.periodo : undefined}
      />
    </div>
  );
}

function TarjetaMargenTrabajo() {
  const leer = useCallback(() => leerGraficoMargenTrabajo(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testId="inteligencia-grafico-margen-trabajo-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'lista') return null;

  if (res.trabajos.length === 0 && res.sinIngreso.length === 0) {
    return (
      <div data-testid="inteligencia-grafico-margen-trabajo">
        <p className="graficos-inteligencia__rotulo">MARGEN POR TRABAJO</p>
        <p className="graficos-inteligencia__vacio" data-testid="inteligencia-grafico-margen-trabajo-vacio">
          Todavía no hay trabajos con presupuesto o factura para medir margen.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="inteligencia-grafico-margen-trabajo">
      <p className="graficos-inteligencia__rotulo">MARGEN POR TRABAJO</p>
      {res.trabajos.length > 0 && (
        <div className="graficos-inteligencia__scroll">
          <GraficoBarras
            testId="grafico-margen-trabajo"
            puntos={res.trabajos.map((t) => t.etiqueta)}
            series={[
              {
                id: 'margen',
                etiqueta: 'Margen',
                color: 'var(--btn-bg)',
                valores: res.trabajos.map((t) => t.margen),
              },
            ]}
          />
        </div>
      )}
      {res.sinIngreso.length > 0 && (
        <p className="graficos-inteligencia__vacio" data-testid="inteligencia-grafico-margen-trabajo-sin-ingreso">
          {res.sinIngreso.length} trabajo{res.sinIngreso.length === 1 ? '' : 's'} sin cobro registrado todavía —
          no entra{res.sinIngreso.length === 1 ? '' : 'n'} al margen.
        </p>
      )}
    </div>
  );
}

export function GraficosInteligencia() {
  return (
    <div className="graficos-inteligencia" data-testid="inteligencia-graficos">
      <TarjetaFacturacion />
      <TarjetaEntroVsSalio />
      <TarjetaCategorias />
      <TarjetaMargenTrabajo />
    </div>
  );
}
