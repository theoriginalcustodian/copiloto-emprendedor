import { useCallback, useEffect, useRef, useState } from 'react';

import { formatearImporte, leerPortada, type Portada } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { ChatInteligencia } from './ChatInteligencia';
import { GraficosInteligencia } from './graficos/GraficosInteligencia';
import './inteligencia.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';
type Vista = 'resumen' | 'preguntar';

const OPCIONES_VISTA: readonly { valor: Vista; etiqueta: string }[] = [
  { valor: 'resumen', etiqueta: 'Resumen' },
  { valor: 'preguntar', etiqueta: 'Preguntar' },
];

/**
 * `InteligenciaScreen` — port de `apps/mobile/src/modules/inteligencia/PantallaInteligencia.tsx` a
 * `copiloto-web`. Misma lógica: portada (caja, mes, serie mensual, mejores clientes, por cobrar) +
 * los 4 gráficos debajo, dentro del mismo scroll; el chat de preguntas libres es una solapa aparte
 * (mismo criterio que mobile — un `flex:1` con su propio scroll no puede anidarse abajo de contenido
 * que no es suyo). Lo que NO se porta 1:1: `RefreshControl` (gesto táctil) → botón "Actualizar"
 * explícito, mismo criterio que `GastosScreen`/`ClientesScreen`.
 *
 * `null` no es `0`: un KPI que no vino se muestra como «—», nunca como «$0» — el helper `kpi()`
 * centraliza esa regla.
 */
export function InteligenciaScreen() {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [portada, setPortada] = useState<Portada | null>(null);
  const [vista, setVista] = useState<Vista>('resumen');
  const [actualizando, setActualizando] = useState(false);
  // Ver el comentario equivalente en GastosScreen/ClientesScreen: `vivo.current = true` va DENTRO
  // del setup del efecto (no sólo en `useRef(true)`) por StrictMode.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return leerPortada()
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setPortada(null);
          return;
        }
        setPortada(res.portada);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function actualizar() {
    setActualizando(true);
    await cargar(true);
    if (vivo.current) setActualizando(false);
  }

  /** Un importe para un KPI: «—» si no vino, nunca «$0». */
  const kpi = (v: string | null) => (v != null ? formatearImporte(v) : '—');

  return (
    <div className="inteligencia-screen" data-testid="pantalla-inteligencia">
      <header className="inteligencia-screen__header">
        <h1 className="inteligencia-screen__title">Inteligencia de Negocio</h1>
        {vista === 'resumen' && estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="inteligencia-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </header>

      <div className="inteligencia-screen__solapas" data-testid="inteligencia-solapas">
        {OPCIONES_VISTA.map((o) => (
          <button
            key={o.valor}
            type="button"
            data-testid={`inteligencia-solapa-${o.valor}`}
            aria-pressed={o.valor === vista}
            className={
              o.valor === vista
                ? 'inteligencia-screen__solapa inteligencia-screen__solapa--activa'
                : 'inteligencia-screen__solapa'
            }
            onClick={() => setVista(o.valor)}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>

      {vista === 'preguntar' ? (
        <ChatInteligencia />
      ) : (
        <div className="inteligencia-screen__body">
          {estado === 'cargando' && (
            <div className="inteligencia-screen__loading" data-testid="inteligencia-cargando">
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <Skeleton key={i} height={64} radius={16} />
              ))}
            </div>
          )}

          {estado === 'error' && (
            <div className="inteligencia-screen__empty" data-testid="inteligencia-error">
              <p>No pudimos cargar el resumen de tu negocio.</p>
              <Button variant="cancel" onClick={() => void cargar()}>
                Reintentar
              </Button>
            </div>
          )}

          {estado === 'no_disponible' && (
            <p className="inteligencia-screen__empty" data-testid="inteligencia-no-disponible">
              El resumen de tu negocio todavía no está disponible en tu copiloto.
            </p>
          )}

          {estado === 'ok' && portada != null && (
            <div className="inteligencia-screen__contenido" data-testid="inteligencia-portada">
              {/* CAJA — el número grande, lo primero que se mira. */}
              <div data-testid="inteligencia-caja">
                <p className="inteligencia-screen__caja-etiqueta">EN CAJA</p>
                <p className="inteligencia-screen__caja-valor">{kpi(portada.caja.saldo)}</p>
              </div>

              {/* EL MES — cinco números, en una grilla de dos columnas. */}
              <p className="inteligencia-screen__rotulo">ESTE MES</p>
              <div className="inteligencia-screen__grilla-kpis">
                {(
                  [
                    ['Ingresos', portada.mes.ingresos, 'var(--ok-fg)'],
                    ['Gastos', portada.mes.gastos, 'var(--danger-fg)'],
                    ['Rentabilidad', portada.mes.rentabilidad, 'var(--btn-bg)'],
                    ['Facturado', portada.mes.facturado, 'var(--text)'],
                    ['Cobrado', portada.mes.cobrado, 'var(--text)'],
                  ] as const
                ).map(([etiqueta, valor, color]) => (
                  <div
                    key={etiqueta}
                    className="inteligencia-screen__kpi-celda"
                    data-testid={`inteligencia-mes-${etiqueta.toLowerCase()}`}
                  >
                    <span className="inteligencia-screen__kpi-etiqueta">{etiqueta}</span>
                    <span className="inteligencia-screen__kpi-valor" style={{ color }}>
                      {kpi(valor)}
                    </span>
                  </div>
                ))}
              </div>

              {/* POR COBRAR — con lo vencido resaltado, que es lo accionable. */}
              <div className="inteligencia-screen__fila-entre" data-testid="inteligencia-por-cobrar">
                <span className="inteligencia-screen__fila-entre-label">Por cobrar</span>
                <span className="inteligencia-screen__fila-entre-valor">{kpi(portada.porCobrar.total)}</span>
              </div>
              {portada.porCobrar.vencido != null && (
                <p className="inteligencia-screen__vencido" data-testid="inteligencia-vencido">
                  {formatearImporte(portada.porCobrar.vencido)} vencido
                </p>
              )}

              {/* SERIE MENSUAL — barras proporcionales, sin librería: ingresos vs gastos por mes. */}
              {portada.serieMensual.length > 0 && (
                <div data-testid="inteligencia-serie">
                  <p className="inteligencia-screen__rotulo">MES A MES</p>
                  <SerieBarras portada={portada} />
                </div>
              )}

              {/* MEJORES CLIENTES — degrada a vacío si Clientes no está. */}
              <p className="inteligencia-screen__rotulo">MEJORES CLIENTES</p>
              {portada.mejoresClientes.length === 0 ? (
                <p className="inteligencia-screen__vacio-chico" data-testid="inteligencia-clientes-vacio">
                  Todavía no hay clientes con ventas registradas.
                </p>
              ) : (
                portada.mejoresClientes.map((c) => (
                  <div
                    key={c.cliente}
                    className="inteligencia-screen__fila-entre"
                    data-testid={`inteligencia-cliente-${c.cliente}`}
                  >
                    <span className="inteligencia-screen__fila-entre-label">{c.cliente}</span>
                    <span className="inteligencia-screen__fila-entre-valor inteligencia-screen__fila-entre-valor--acento">
                      {kpi(c.total)}
                    </span>
                  </div>
                ))
              )}

              {/* LOS 4 GRÁFICOS — cada uno con su propia carga, endpoints independientes de la portada. */}
              <div className="inteligencia-screen__graficos" data-testid="inteligencia-graficos-seccion">
                <GraficosInteligencia />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Barras de la serie mensual, `<div>`s de alto proporcional — sin librería de gráficos, mismo
 * enfoque que `GraficoBarras`. La altura se normaliza contra el máximo de la serie; un mes sin dato
 * (`null`) no dibuja barra, no dibuja una de alto cero que se leería como «cero».
 */
function SerieBarras({ portada }: { portada: Portada }) {
  const nums = portada.serieMensual.flatMap((p) =>
    [p.ingresos, p.gastos].filter((v): v is string => v != null).map(Number),
  );
  const max = nums.length > 0 ? Math.max(...nums, 1) : 1;
  const ALTO = 80;

  return (
    <div className="inteligencia-screen__serie-fila">
      {portada.serieMensual.map((p) => {
        const barra = (valor: string | null, color: string) => {
          if (valor == null) {
            return <div className="inteligencia-screen__barra" style={{ height: 1, backgroundColor: 'var(--label)' }} />;
          }
          const h = Math.max(2, (Number(valor) / max) * ALTO);
          return <div className="inteligencia-screen__barra" style={{ height: h, backgroundColor: color }} />;
        };
        return (
          <div key={p.mes} className="inteligencia-screen__serie-col" data-testid={`inteligencia-barra-${p.mes}`}>
            <div className="inteligencia-screen__serie-barras">
              {barra(p.ingresos, 'var(--ok-fg)')}
              {barra(p.gastos, 'var(--danger-fg)')}
            </div>
            {/* `2026-04` → `04`: la etiqueta corta cabe; el año se repite y no aporta acá. */}
            <span className="inteligencia-screen__serie-etiqueta">{p.mes.slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}
