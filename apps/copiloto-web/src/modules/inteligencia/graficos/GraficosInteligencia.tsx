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

import { Surface } from '../../../design-system';
import { GraficoBarras } from './GraficoBarras';
import { GraficoTorta } from './GraficoTorta';

/**
 * `GraficosInteligencia` — port de `apps/mobile/src/modules/inteligencia/graficos/GraficosInteligencia.tsx`.
 * Los 4 gráficos, cada uno con su propia carga (endpoints independientes, no comparten el `estado`
 * de la portada). Sin drill-down en esta pasada — mismo alcance que mobile: los primitivos ya
 * exponen `onSegmentoClick`, pero wirear las 4 formas de `?detalle=` queda para después.
 *
 * Repintado (Tarea 3, anatomía de función): cada tarjeta pasa a ser una card blanca
 * (`Surface variant="card"`, mismo criterio que `AdminScreen`/`inteligencia-screen__card` del
 * `InteligenciaScreen` hermano) — el mockup fuente (`#inteligencia .bloque`) envuelve TODAS sus
 * secciones, gráficos incluidos, en la misma card. La lógica de dibujo de `GraficoBarras`/
 * `GraficoTorta` NO se toca (contrato: "no los reinventes") — sólo el contenedor. Las etiquetas de
 * "Entró vs salió"/"En qué se me va"/"Margen por trabajo" pasan a la redacción exacta del mockup
 * (`Prototipo frontend/odobi-ui/prototipo/index.html`, bloque `#inteligencia`); "Facturación" no
 * tiene sección propia en ese mockup (es una vista adicional que ya existía acá) — queda con su
 * rótulo tal cual, sólo con la card nueva.
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
    <Surface variant="card" className="graficos-inteligencia__card" data-testid="inteligencia-grafico-facturacion">
      <p className="graficos-inteligencia__rotulo">Facturación</p>
      <div className="graficos-inteligencia__scroll">
        <GraficoBarras
          testId="grafico-facturacion"
          puntos={res.serie.map((p) => p.mes)}
          series={[
            {
              id: 'total',
              etiqueta: 'Facturado',
              color: 'var(--core)',
              valores: res.serie.map((p) => p.total),
            },
          ]}
          epigrafe={res.periodo !== '' ? res.periodo : undefined}
        />
      </div>
    </Surface>
  );
}

function TarjetaEntroVsSalio() {
  const leer = useCallback(() => leerGraficoEntroVsSalio(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testId="inteligencia-grafico-entro-vs-salio-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'serie') return null;

  return (
    <Surface variant="card" className="graficos-inteligencia__card" data-testid="inteligencia-grafico-entro-vs-salio">
      {/* Redacción exacta del mockup (`#inteligencia .bloque h4`: "Entró vs. salido"). */}
      <p className="graficos-inteligencia__rotulo">Entró vs. salido</p>
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
    </Surface>
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
    <Surface variant="card" className="graficos-inteligencia__card" data-testid="inteligencia-grafico-categorias">
      {/* Redacción exacta del mockup: "En qué se te va la plata" (la torta reemplaza las barras de
          categoría del mockup — contrato: "no reinventes GraficoTorta", ya tiene su paleta resuelta). */}
      <p className="graficos-inteligencia__rotulo">En qué se te va la plata</p>
      <GraficoTorta
        testId="grafico-categorias"
        porciones={porciones}
        orden={ordenEtiquetas}
        epigrafe={res.periodo !== '' ? res.periodo : undefined}
      />
    </Surface>
  );
}

function TarjetaMargenTrabajo() {
  const leer = useCallback(() => leerGraficoMargenTrabajo(), []);
  const res = useGrafico(leer);

  if (res == null) return <Cargando testId="inteligencia-grafico-margen-trabajo-cargando" />;
  if (res.status !== 'ok' || res.modo !== 'lista') return null;

  if (res.trabajos.length === 0 && res.sinIngreso.length === 0) {
    return (
      <Surface variant="card" className="graficos-inteligencia__card" data-testid="inteligencia-grafico-margen-trabajo">
        <p className="graficos-inteligencia__rotulo">Margen por trabajo</p>
        <p className="graficos-inteligencia__vacio" data-testid="inteligencia-grafico-margen-trabajo-vacio">
          Todavía no hay trabajos con presupuesto o factura para medir margen.
        </p>
      </Surface>
    );
  }

  return (
    <Surface variant="card" className="graficos-inteligencia__card" data-testid="inteligencia-grafico-margen-trabajo">
      <p className="graficos-inteligencia__rotulo">Margen por trabajo</p>
      {res.trabajos.length > 0 && (
        <div className="graficos-inteligencia__scroll">
          <GraficoBarras
            testId="grafico-margen-trabajo"
            puntos={res.trabajos.map((t) => t.etiqueta)}
            series={[
              {
                id: 'margen',
                etiqueta: 'Margen',
                color: 'var(--core)',
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
    </Surface>
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
