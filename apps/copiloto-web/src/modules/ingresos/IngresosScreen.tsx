import { useCallback, useEffect, useRef, useState } from 'react';

import { borrarIngreso, formatearFechaCorta, listarIngresos, obtenerResumenIngresos, type Ingreso, type ResumenIngresos as ResumenIngresosDato } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { DockFuncion } from '../voz';
import { FormularioIngreso } from './FormularioIngreso';
import { ResumenIngresos } from './ResumenIngresos';
import { TarjetaIngreso } from './TarjetaIngreso';
import './ingresos.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';
type Vista = 'listado' | 'formulario';

/**
 * `IngresosScreen` — port de `apps/mobile/src/modules/ingresos/PantallaIngresos.tsx` a `copiloto-web`,
 * mismo molde que `GastosScreen` (ver ese archivo para el porqué de `vivo.current = true` DENTRO del
 * setup del efecto — StrictMode). El total de la LISTA lo suma el BACKEND, nunca la UI: dos números
 * para la misma pregunta es exactamente lo que este módulo existe para evitar (ver
 * `PantallaIngresos.tsx`).
 *
 * Repintado a la "anatomía de función" de Tarea 3 (CLAUDE.md §5): stack nombre+período + "bloque
 * negro" (`ResumenIngresos`, vía `GET /ingresos/resumen` — PR#488, backend cerró el gap que este
 * módulo escaló al buzón el mismo día) + rótulo de sección "Últimos" con pill de alta "Anotar que
 * me pagaron" (verbo del repo, nunca "Nuevo ingreso") + lista. Mismo patrón de `Promise.all` que
 * `GastosScreen`: el resumen no bloquea la lista si falla, y viceversa.
 *
 * No se porta: `RefreshControl` (no existe en web, reemplazado por botón "Actualizar") ni
 * `BuscadorActividad` (pertenece al módulo `actividad`, todavía no portado a web — fuera de scope).
 */
export interface IngresosScreenProps {
  /** Lleva al chat principal: el dock del pie (SM-P7) deja el texto como pendiente y cambia de tab. */
  onAbrirChat?: () => void;
}

export function IngresosScreen({ onAbrirChat }: IngresosScreenProps = {}) {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [resumen, setResumen] = useState<ResumenIngresosDato | null>(null);
  const [vista, setVista] = useState<Vista>('listado');
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return Promise.all([listarIngresos(), obtenerResumenIngresos()])
      .then(([res, resResumen]) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setIngresos([]);
          setResumen(null);
          return;
        }
        setIngresos(res.ingresos);
        setResumen(resResumen.status === 'ok' ? resResumen.resumen : null);
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

  function alGuardar() {
    setVista('listado');
    void cargar(true);
  }

  function abrirFormularioEnBlanco() {
    setVista('formulario');
  }

  async function borrar(ingreso: Ingreso) {
    setError(null);
    const res = await borrarIngreso(ingreso.id);
    if (!vivo.current) return;
    // Se relee en vez de sacar la fila localmente: el TOTAL lo suma el backend, y quitarla acá
    // dejaría el total viejo al lado de la lista nueva (mismo criterio que el mobile).
    if (res.status === 'ok') await cargar(true);
    else setError('No pudimos borrarlo. Probá de nuevo.');
  }

  const hayIngresos = ingresos.length > 0;

  return (
    <div className="ingresos-screen dock-host" data-testid="pantalla-ingresos">
      {/* Anatomía de función (Tarea 3, CLAUDE.md §5): stack con nombre + período. Mismo criterio que
          `GastosScreen` — web no lleva "Volver ‹" (Rail/TabBar propios). El período no depende de
          `estado`: es el mes en curso, siempre disponible. */}
      <header className="ingresos-screen__stack">
        <span className="ingresos-screen__nombre-fila">
          <span className="ingresos-screen__nombre">Ingresos</span>
          {estado === 'ok' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="ingresos-actualizar"
              className="ingresos-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        {/* H-A4-6: `resumen.periodo` llega "YYYY-MM" (sin día) del backend — ISO crudo si se pinta
            tal cual. `formatearFechaCorta` ya resuelve un período sin día como su día 1. */}
        {resumen != null && <span className="ingresos-screen__periodo">{formatearFechaCorta(resumen.periodo)}</span>}
      </header>

      {estado === 'cargando' && (
        <div className="ingresos-screen__loading" data-testid="ingresos-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={64} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="ingresos-screen__empty" data-testid="ingresos-error-carga">
          <p>No pudimos cargar tus ingresos.</p>
          <Button variant="cancel" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="ingresos-screen__empty" data-testid="ingresos-no-disponible">
          Los ingresos todavía no están disponibles en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="ingresos-screen__body">
          {vista === 'formulario' ? (
            <FormularioIngreso
              origen="manual"
              onGuardado={alGuardar}
              onCancelar={() => setVista('listado')}
            />
          ) : (
            <>
              {resumen != null && <ResumenIngresos resumen={resumen} />}

              {/* Rótulo de sección + alta, en la misma fila (CLAUDE.md §5): el pill NUNCA es un FAB
                  — compite con el dock. "Anotar que me pagaron" es el verbo textual del repo, nunca
                  "Nuevo ingreso". El campo y el mic viven en el dock del pie (`DockFuncion`, SM-P7). */}
              <div className="ingresos-screen__fila-lbl">
                <span className="ingresos-screen__lista-lbl">Últimos</span>
                <div className="ingresos-screen__fila-lbl-acciones">
                  <button
                    type="button"
                    className="ingresos-screen__pill-nuevo"
                    onClick={abrirFormularioEnBlanco}
                    data-testid="ingresos-nuevo"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Anotar que me pagaron
                  </button>
                </div>
              </div>

              {!hayIngresos && (
                <p className="ingresos-screen__empty" data-testid="ingresos-vacio">
                  Todavía no entró nada. Cuando cobres, anotalo acá — o decíselo al copiloto hablando.
                </p>
              )}

              <div className="ingresos-screen__lista">
                {ingresos.map((i) => (
                  <TarjetaIngreso key={i.id} ingreso={i} onBorrar={(ing) => void borrar(ing)} />
                ))}
              </div>

              {error != null && (
                <p className="ingresos-screen__error" data-testid="ingresos-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {onAbrirChat && <DockFuncion onAbrirChat={onAbrirChat} placeholder="Contale un cobro al copiloto…" />}
    </div>
  );
}
