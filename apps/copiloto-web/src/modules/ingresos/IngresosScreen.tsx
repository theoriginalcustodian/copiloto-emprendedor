import { useCallback, useEffect, useRef, useState } from 'react';

import { borrarIngreso, formatearImporte, listarIngresos, type Ingreso } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { FormularioIngreso } from './FormularioIngreso';
import { TarjetaIngreso } from './TarjetaIngreso';
import './ingresos.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';
type Vista = 'listado' | 'formulario';

/**
 * `IngresosScreen` — port de `apps/mobile/src/modules/ingresos/PantallaIngresos.tsx` a `copiloto-web`,
 * mismo molde que `GastosScreen` (ver ese archivo para el porqué de `vivo.current = true` DENTRO del
 * setup del efecto — StrictMode). El total lo suma el BACKEND, nunca la UI: dos números para la misma
 * pregunta es exactamente lo que este módulo existe para evitar (ver `PantallaIngresos.tsx`).
 *
 * No se porta: `RefreshControl` (no existe en web, reemplazado por botón "Actualizar") ni
 * `BuscadorActividad` (pertenece al módulo `actividad`, todavía no portado a web — fuera de scope).
 */
export function IngresosScreen() {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [total, setTotal] = useState<string | null>(null);
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
    return listarIngresos()
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setIngresos([]);
          setTotal(null);
          return;
        }
        setIngresos(res.ingresos);
        setTotal(res.total);
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
    <div className="ingresos-screen" data-testid="pantalla-ingresos">
      <header className="ingresos-screen__header">
        <h1 className="ingresos-screen__title">Ingresos</h1>
        {estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="ingresos-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
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
            <FormularioIngreso origen="manual" onGuardado={alGuardar} onCancelar={() => setVista('listado')} />
          ) : (
            <>
              {/* El total lo suma el BACKEND — sumarlo acá daría un segundo número para la misma
                  pregunta (ver docstring del módulo). */}
              {total != null && (
                <p className="ingresos-screen__total" data-testid="ingresos-total">
                  {formatearImporte(total)}
                </p>
              )}

              <Button onClick={() => setVista('formulario')} data-testid="ingresos-nuevo">
                Anotar que me pagaron
              </Button>

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
    </div>
  );
}
