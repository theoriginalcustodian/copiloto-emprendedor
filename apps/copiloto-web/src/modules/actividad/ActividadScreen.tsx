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
 *
 * Repintado a la "anatomía de función" de Tarea 3 (CLAUDE.md §5): stack nombre + label fijo (mismo
 * criterio que `ClientesScreen` reusando el slot de "período" para "Tu cartera" — acá tampoco hay
 * mes, es un feed que crece sin techo) + buscador + lista.
 *
 * ⚠️ **Excepción justificada — SIN "bloque negro".** Los otros 4 módulos de Tarea 3
 * (`gastos`/`ingresos`/`clientes`/`presupuestos`) tienen los dos ingredientes que hacen falta para
 * un bloque negro honesto: (a) un mockup fuente que define esa cifra para SU pantalla dedicada, y
 * (b) un dato — de backend (`total`/`obtenerResumenGastos()`) o de una lista acotada de una sola
 * página (`listarPresupuestos`, "sin cursor por ahora", ver `packages/core/src/api/presupuestos.ts`)
 * — que la respalda sin subcontar. Acá NO están ninguno de los dos: el mockup fuente
 * (`Prototipo frontend/odobi-ui/prototipo/index.html`) no tiene una pantalla `#actividad`, sólo el
 * widget `.reciente` del escritorio (preview no tappable, fuera de este scope) — y `/actividad`
 * (`packages/core/src/api/actividad.ts`) es, de las 5 pantallas de Tarea 3, la ÚNICA que pagina por
 * CURSOR sin devolver ningún agregado (`ActividadResult = {items, cursor}`, nunca un `total`) —
 * por diseño, porque el feed crece sin límite. Cualquier cifra armada acá ("N movimientos hoy")
 * sólo vería la página ya cargada (20 por default) y subcontaría en silencio cualquier día con más
 * eventos que esa página — mostrar una cifra grande y prominente que puede estar mal es peor que no
 * mostrar ninguna (regla de oro #1, "no codificar la esperanza"). Se aplica el resto de la gramática
 * (stack + lista) sin forzar el bloque.
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
      <header className="actividad-screen__stack">
        <span className="actividad-screen__nombre-fila">
          <span className="actividad-screen__nombre">Actividad</span>
          {estado === 'ok' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="actividad-actualizar"
              className="actividad-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        {/* Label FIJO (mockup: `.atras .per`), no un período — mismo criterio que
            `clientes-screen__periodo` ("Tu cartera"): esta función no tiene mes, es el feed
            completo. */}
        <span className="actividad-screen__periodo">Todo tu movimiento</span>
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
