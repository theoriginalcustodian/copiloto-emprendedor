import { useCallback, useEffect, useRef, useState } from 'react';

import { listarGastos, obtenerResumenGastos, type Gasto, type ResumenGastos } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { FormularioGasto } from './FormularioGasto';
import { ResumenMes } from './ResumenMes';
import { TarjetaGasto } from './TarjetaGasto';
import './gastos.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';
type Vista = 'listado' | 'formulario';

/**
 * `GastosScreen` — M-WEB spike 1 (`contrato_planificacion-a-frontend_MWEB-spike-gastos-portado-a-web.md`):
 * port de `apps/mobile/src/modules/gastos/PantallaGastos.tsx` a `copiloto-web`. Misma lógica de carga
 * (listado + resumen en paralelo, resumen no bloquea la lista si falla), mismo store compartido
 * (`@copiloto/core`, sin cambios). Lo que NO se porta 1:1: `RefreshControl` (gesto táctil de "tirar
 * para refrescar") no existe en web — se reemplaza por un botón "Actualizar" explícito.
 */
export function GastosScreen() {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ResumenGastos | null>(null);
  const [vista, setVista] = useState<Vista>('listado');
  const [actualizando, setActualizando] = useState(false);
  // `vivo.current = true` va DENTRO del setup del efecto, no sólo en `useRef(true)` -- en
  // StrictMode (dev) React invoca cada efecto setup→cleanup→setup de nuevo al montar; sin repetir
  // la asignación acá, el cleanup del primer paso deja `vivo.current` en `false` para siempre y
  // NINGÚN `cargar()` posterior puede actualizar estado (encontrado en este spike: la pantalla
  // quedaba en 'cargando' eterno en dev -- el fetch resolvía bien, pero el guard cortaba el
  // `setEstado` porque `vivo` nunca volvía a `true`). No se manifiesta en producción -- sin
  // StrictMode los efectos no se re-invocan -- pero el patrón original (sólo `useRef(true)` +
  // cleanup-only effect) es frágil ante exactamente lo que StrictMode existe para cazar.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return Promise.all([listarGastos(), obtenerResumenGastos()])
      .then(([lista, res]) => {
        if (!vivo.current) return;
        if (lista.status === 'no_disponible') {
          setEstado('no_disponible');
          setGastos([]);
          setResumen(null);
          return;
        }
        setGastos(lista.gastos);
        setTotal(lista.total);
        setResumen(res.status === 'ok' ? res.resumen : null);
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

  function alCrear() {
    setVista('listado');
    void cargar(true);
  }

  const hayGastos = gastos.length > 0;

  return (
    <div className="gastos-screen" data-testid="pantalla-gastos">
      <header className="gastos-screen__header">
        <h1 className="gastos-screen__title">Gastos</h1>
        {estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="gastos-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </header>

      {estado === 'cargando' && (
        <div className="gastos-screen__loading" data-testid="gastos-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={64} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="gastos-screen__empty" data-testid="gastos-error">
          <p>No pudimos cargar tus gastos.</p>
          <Button variant="cancel" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="gastos-screen__empty" data-testid="gastos-no-disponible">
          Los gastos todavía no están disponibles en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="gastos-screen__body">
          {vista === 'formulario' ? (
            <FormularioGasto origen="manual" onCreado={alCrear} onCancelar={() => setVista('listado')} />
          ) : (
            <>
              {resumen != null && <ResumenMes resumen={resumen} />}

              <Button onClick={() => setVista('formulario')} data-testid="gastos-nuevo">
                Anotar un gasto
              </Button>

              {!hayGastos && (
                <p className="gastos-screen__empty" data-testid="gastos-vacio">
                  Todavía no anotaste ningún gasto.
                </p>
              )}

              <div className="gastos-screen__lista">
                {gastos.map((g) => (
                  <TarjetaGasto key={g.id} gasto={g} />
                ))}
              </div>

              {hayGastos && total > gastos.length && (
                <p className="gastos-screen__total" data-testid="gastos-total">
                  Mostrando {gastos.length} de {total} gastos.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
