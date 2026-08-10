import { useCallback, useEffect, useRef, useState } from 'react';

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import { FilaActividad } from './FilaActividad';
import './actividad.css';

const SKELETON_ROWS = 4;
/** Mismo valor que Clientes/Gastos — el debounce de búsqueda. */
const ESPERA_BUSQUEDA_MS = 350;
/** Igual al default del backend (`ListaActividad` mobile lo documenta explícito por la misma razón). */
const LIMITE_PAGINA = 20;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * `ActividadScreen` — M-WEB módulo 3: port de `apps/mobile/src/modules/actividad/ListaActividad.tsx`
 * + `BuscadorActividad.tsx` a `copiloto-web`, fusionados en una sola pantalla (acá no hay una lista
 * rica de una función específica de la que "actividad" sea una sección aparte — es la pantalla feed
 * completa, más parecida al buscador server-side de `ClientesScreen`).
 *
 * MISMA lógica que mobile: el feed pagina por CURSOR opaco (no offset — la lista crece mientras se
 * lee), y el final lo dice `cursor === null`, no el largo de la página. Lo que NO se porta 1:1:
 * `FlatList`+`onEndReached` (scroll infinito táctil) → botón "Cargar más" explícito, mismo criterio
 * que el botón "Actualizar" de `ClientesScreen` reemplazando `RefreshControl`.
 *
 * `onAbrirGasto`/`onAbrirCliente`/`onAbrirTicket`: callbacks de navegación a destino (ver
 * `destinoActividad.ts`). El shell los conecta después — acá sólo se propagan a `FilaActividad`,
 * que decide con ellos si el ítem es tappable.
 */
export interface ActividadScreenProps {
  onAbrirGasto?: (id: number) => void;
  onAbrirCliente?: (id: number) => void;
  onAbrirTicket?: (id: number) => void;
}

export function ActividadScreen({ onAbrirGasto, onAbrirCliente, onAbrirTicket }: ActividadScreenProps = {}) {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  // Ver el comentario equivalente en ClientesScreen/GastosScreen: `vivo.current = true` va DENTRO
  // del setup del efecto (no sólo en `useRef(true)`) por StrictMode.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarPrimera = useCallback(
    (silencioso = false): Promise<void> => {
      if (!silencioso) setEstado('cargando');
      return listarActividad({
        limit: LIMITE_PAGINA,
        ...(busquedaAplicada !== '' ? { q: busquedaAplicada } : {}),
      })
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
    },
    [busquedaAplicada],
  );

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
    listarActividad({
      limit: LIMITE_PAGINA,
      cursor,
      ...(busquedaAplicada !== '' ? { q: busquedaAplicada } : {}),
    })
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'ok') {
          // Se concatena y se pisa el cursor. Un id repetido se vería duplicado en pantalla — visible
          // y reportable, mejor que deduplicar acá y esconder un bug de la paginación.
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
  const buscando = busquedaAplicada !== '';

  return (
    <div className="actividad-screen" data-testid="pantalla-actividad">
      <header className="actividad-screen__header">
        <h1 className="actividad-screen__title">Actividad</h1>
        {estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="actividad-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </header>

      {estado === 'cargando' && (
        <div className="actividad-screen__loading" data-testid="actividad-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={56} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="actividad-screen__empty" data-testid="actividad-error">
          <p>No pudimos cargar tu actividad.</p>
          <Button variant="cancel" onClick={() => void cargarPrimera()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="actividad-screen__empty" data-testid="actividad-no-disponible">
          Tu actividad todavía no está disponible en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="actividad-screen__body">
          <label className="actividad-screen__buscar">
            <span>Buscar</span>
            <input
              data-testid="actividad-buscar"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en tus operaciones"
              autoCapitalize="none"
            />
          </label>

          {!hayItems && (
            <p className="actividad-screen__empty" data-testid="actividad-vacio">
              {buscando
                ? 'No encontramos ninguna operación con ese texto.'
                : 'Todavía no hay movimientos. Lo que hagas va a aparecer acá.'}
            </p>
          )}

          <div className="actividad-screen__lista">
            {items.map((item) => (
              <FilaActividad
                key={item.id}
                item={item}
                onAbrirGasto={onAbrirGasto}
                onAbrirCliente={onAbrirCliente}
                onAbrirTicket={onAbrirTicket}
              />
            ))}
          </div>

          {hayItems && cursor != null && (
            <Button
              variant="ghost"
              onClick={cargarMas}
              disabled={cargandoMas}
              data-testid="actividad-cargar-mas"
            >
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
