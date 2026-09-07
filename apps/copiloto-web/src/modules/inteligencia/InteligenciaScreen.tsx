import { useCallback, useEffect, useRef, useState } from 'react';

import { formatearImporte, leerPortada, type Portada } from '@copiloto/core';

import { Button, Skeleton, Surface } from '../../design-system';
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
 * "Mes actual" en español, capitalizado — mismo criterio que `PresupuestosScreen.mesActual()`:
 * "usá el período real si existe el dato; si no, mes actual". A diferencia de `ResumenGastos`,
 * `Portada` (`packages/core/src/api/inteligencia.ts`) no trae un período propio.
 */
function mesActual(): string {
  const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date());
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/**
 * "Al 19 de agosto" — el chip de comparación del "bloque" de cifra (mockup: `.bi-port .comp`). La
 * caja es un saldo DE HOY (no un snapshot con fecha propia que mande el backend) — el "al" es la
 * fecha de hoy, calculada acá, nunca un dato inventado del wire.
 */
function alHoy(): string {
  const f = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(new Date());
  return `Al ${f}`;
}

/**
 * `InteligenciaScreen` — port de `apps/mobile/src/modules/inteligencia/PantallaInteligencia.tsx` a
 * `copiloto-web`, repintado a la anatomía de función (Tarea 3, CLAUDE.md §5): stack (nombre +
 * período) → "bloque" de cifra (Saldo en caja, LA cifra accionable de esta función — CLAUDE.md §5)
 * → contenido. Inteligencia de Negocio "responde, no registra": es la única función del lote sin
 * rótulo+pill de alta.
 *
 * Markup calcado del mockup fuente (`Prototipo frontend/odobi-ui/prototipo/index.html`,
 * `#inteligencia`) — ver el detalle de cada sección en su comentario local. Lo que NO se porta 1:1:
 * `RefreshControl` (gesto táctil "Tirá para actualizar") → botón "Actualizar" explícito, mismo
 * criterio que `GastosScreen`/`ClientesScreen`.
 *
 * `null` no es `0`: un KPI que no vino se muestra como «—», nunca como «$0» — el helper `kpi()`
 * centraliza esa regla.
 *
 * La solapa "Preguntar" (`ChatInteligencia`) NO es del mockup fuente — ese diseño ya la sacó
 * (`Prototipo frontend/odobi-ui/CLAUDE.md` ~L554: "sería la duplicación que ya sacamos con
 * 'Preguntar' de Inteligencia"), decisión de navegación fuera del alcance de este repintado
 * ("no se toca el modelo de capas"). Se mantiene tal cual funciona hoy — escalado a planificación
 * en `coordinacion/abierto/2026-09-07_hallazgo_frontend1-inteligencia-a-planificacion_solapa-preguntar-ya-deprecada-en-el-diseno.md`.
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
      {/* Stack (CLAUDE.md §5, calcado de `.fn-stack .atras` del mockup) — igual criterio que
          `GastosScreen`: web conserva su propio chrome (Rail/TabBar) en vez del "Volver ‹" mobile. */}
      <header className="inteligencia-screen__stack">
        <span className="inteligencia-screen__nombre-fila">
          <span className="inteligencia-screen__nombre">Inteligencia de Negocio</span>
          {vista === 'resumen' && estado === 'ok' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="inteligencia-actualizar"
              className="inteligencia-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        <span className="inteligencia-screen__periodo">{mesActual()}</span>
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
              {/* "BLOQUE" DE CIFRA — Saldo en caja, LA cifra accionable de esta función (CLAUDE.md
                  §5). Mockup: `.bi-port` — mismo tratamiento que `.resumen` (gastos/facturación),
                  con el agregado del mini-grid Entró/Salió (mockup: `.bi-grid`). Caja y Facturado
                  NUNCA se suman (regla dura del repo: una factura emitida no es caja hasta que se
                  cobra) — por eso el grid reusa `mes.ingresos`/`mes.gastos`, no `mes.facturado`. */}
              <Surface variant="bloque" className="inteligencia-screen__bloque" data-testid="inteligencia-caja">
                <p className="inteligencia-screen__bloque-etiqueta">Saldo en caja</p>
                <p className="inteligencia-screen__bloque-valor">{kpi(portada.caja.saldo)}</p>
                {portada.caja.saldo != null && (
                  <span className="inteligencia-screen__bloque-chip">{alHoy()}</span>
                )}
                <div className="inteligencia-screen__bloque-grid">
                  <div data-testid="inteligencia-caja-entro">
                    <span>Entró</span>
                    <b>{kpi(portada.mes.ingresos)}</b>
                  </div>
                  <div data-testid="inteligencia-caja-salio">
                    <span>Salió</span>
                    <b>{kpi(portada.mes.gastos)}</b>
                  </div>
                </div>
              </Surface>

              {/* ESTE MES — cuatro KPIs en grilla de 2 columnas (mockup: `.cinco`) + Rentabilidad
                  en fila completa con su explicación cuando falta el dato (mockup: `.kpi.sindato`,
                  "no es cero: es que todavía no se puede calcular" — nunca `$0`). */}
              <p className="inteligencia-screen__rotulo">Este mes</p>
              <div className="inteligencia-screen__grilla-kpis">
                {(
                  [
                    ['Ingresos', portada.mes.ingresos],
                    ['Gastos', portada.mes.gastos],
                    ['Facturado', portada.mes.facturado],
                    ['Cobrado', portada.mes.cobrado],
                  ] as const
                ).map(([etiqueta, valor]) => (
                  <Surface
                    key={etiqueta}
                    variant="tile"
                    className="inteligencia-screen__kpi-celda"
                    data-testid={`inteligencia-mes-${etiqueta.toLowerCase()}`}
                  >
                    <span className="inteligencia-screen__kpi-etiqueta">{etiqueta}</span>
                    <span className="inteligencia-screen__kpi-valor">{kpi(valor)}</span>
                  </Surface>
                ))}
                <Surface
                  variant="tile"
                  className={
                    portada.mes.rentabilidad == null
                      ? 'inteligencia-screen__kpi-celda inteligencia-screen__kpi-celda--ancha inteligencia-screen__kpi-celda--sindato'
                      : 'inteligencia-screen__kpi-celda inteligencia-screen__kpi-celda--ancha'
                  }
                  data-testid="inteligencia-mes-rentabilidad"
                >
                  <span className="inteligencia-screen__kpi-etiqueta">Rentabilidad</span>
                  <span className="inteligencia-screen__kpi-valor">{kpi(portada.mes.rentabilidad)}</span>
                  {portada.mes.rentabilidad == null && (
                    <small className="inteligencia-screen__kpi-nota" data-testid="inteligencia-rentabilidad-nota">
                      Falta asignar gastos a trabajos. No es cero: es que todavía no se puede calcular.
                    </small>
                  )}
                </Surface>
              </div>

              {/* POR COBRAR — mockup: `.bloque` con cifra "grande" + vencido resaltado (acento de
                  marca, no un rojo semántico aparte). */}
              <Surface variant="card" className="inteligencia-screen__card" data-testid="inteligencia-por-cobrar">
                <p className="inteligencia-screen__card-titulo">Por cobrar</p>
                <p className="inteligencia-screen__card-cifra">{kpi(portada.porCobrar.total)}</p>
                {portada.porCobrar.vencido != null && (
                  <p className="inteligencia-screen__card-sub" data-testid="inteligencia-vencido">
                    <span className="inteligencia-screen__vencido">
                      {formatearImporte(portada.porCobrar.vencido)} vencidos
                    </span>
                  </p>
                )}
              </Surface>

              {/* MEJORES CLIENTES — mockup: `.bloque#bi-clientes` con ranking; degrada a vacío si
                  Clientes no está. */}
              <Surface variant="card" className="inteligencia-screen__card" data-testid="inteligencia-clientes">
                <p className="inteligencia-screen__card-titulo">Mejores clientes</p>
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
              </Surface>

              {/* LOS GRÁFICOS — cada uno con su propia carga, endpoints independientes de la
                  portada (facturación, entró vs salió, en qué se te va la plata, margen por
                  trabajo). "Facturado en los últimos 12 meses" (medidor de tope de monotributo,
                  mockup: `.bloque` con `.medidor.sem-*`) queda afuera de esta pasada: ni el dato
                  agregado ni los tokens semánticos de semáforo existen hoy — ver el hallazgo en
                  `coordinacion/abierto/`. */}
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
