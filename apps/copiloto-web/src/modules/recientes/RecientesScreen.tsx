import { useCallback, useEffect, useRef, useState } from 'react';

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { FilaActividad } from '../actividad';
import './recientes.css';

const SKELETON_ROWS = 4;
/** Igual al default del backend — mismo criterio que `ActividadScreen`/`ListaActividad` mobile. */
const LIMITE_PAGINA = 20;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * `RecientesScreen` — port de `apps/mobile/src/modules/recientes/PantallaRecientes.tsx`. Mobile
 * extrajo `ListaActividad` para que "Recientes" (toda la actividad, sin filtro) y `/actividad?funcion=X`
 * compartan la misma máquina de estados; en web esa máquina ya vive en `ActividadScreen`
 * (`apps/copiloto-web/src/modules/actividad/`), que es exactamente el feed completo + buscador.
 * Como acá no hay buscador (mobile tampoco lo tiene en Recientes — vive por función, no acá) y
 * `ActividadScreen` no expone un modo "sin buscador", esta pantalla reusa las piezas de datos del
 * módulo Actividad (`FilaActividad`, `listarActividad`) en vez de duplicarlas, y no la pantalla
 * entera. Botón "Actualizar" en vez de `RefreshControl` — mismo criterio que el resto de M-WEB.
 */
export function RecientesScreen() {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  // `vivo.current = true` dentro del setup del efecto (no sólo `useRef(true)`) por StrictMode —
  // mismo motivo documentado en GastosScreen/ActividadScreen.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargarPrimera = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return listarActividad({ limit: LIMITE_PAGINA })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setItems([]);
          setCursor(null);
          return;
        }
        setItems(res.items);
        setCursor(res.cursor);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargarPrimera();
  }, [cargarPrimera]);

  async function actualizar() {
    setActualizando(true);
    await cargarPrimera(true);
    if (vivo.current) setActualizando(false);
  }

  function cargarMas() {
    if (cursor == null || cargandoMas || estado !== 'ok') return;
    setCargandoMas(true);
    listarActividad({ limit: LIMITE_PAGINA, cursor })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'ok') {
          // Se concatena y se pisa el cursor — mismo criterio que ActividadScreen: un id repetido se
          // ve duplicado en pantalla, mejor que deduplicar acá y esconder un bug de paginación.
          setItems((previos) => [...previos, ...res.items]);
          setCursor(res.cursor);
        }
        setCargandoMas(false);
      })
      .catch(() => {
        if (vivo.current) setCargandoMas(false);
      });
  }

  const hayItems = items.length > 0;

  return (
    <div className="recientes-screen" data-testid="pantalla-recientes">
      <header className="recientes-screen__header">
        <h1 className="recientes-screen__title">Recientes</h1>
        {estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="recientes-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </header>

      {estado === 'cargando' && (
        <div className="recientes-screen__loading" data-testid="recientes-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={56} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="recientes-screen__empty" data-testid="recientes-error">
          <p>No pudimos cargar tu actividad. Tirá para reintentar.</p>
          <Button variant="cancel" onClick={() => void cargarPrimera()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="recientes-screen__empty" data-testid="recientes-no-disponible">
          Tu actividad todavía no está disponible en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="recientes-screen__body">
          {!hayItems && (
            <p className="recientes-screen__empty" data-testid="recientes-vacio">
              Todavía no hay movimientos. Lo que factures, presupuestes o gastes va a aparecer acá.
            </p>
          )}

          <div className="recientes-screen__lista" data-testid="recientes-lista">
            {items.map((item) => (
              <FilaActividad key={item.id} item={item} />
            ))}
          </div>

          {hayItems && cursor != null && (
            <Button
              variant="ghost"
              onClick={cargarMas}
              disabled={cargandoMas}
              data-testid="recientes-cargar-mas"
            >
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
