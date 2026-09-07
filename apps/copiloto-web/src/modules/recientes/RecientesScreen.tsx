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
 *
 * Repintado Tarea 3 (anatomía de función, CLAUDE.md §5): stack nombre + "Tu actividad" (label FIJO,
 * mismo criterio que `clientes-screen__periodo` — esta función tampoco tiene mes, es el feed
 * completo). **Sin bloque negro** — excepción documentada, no vacío por omisión:
 *
 * 1. No hay una cifra ACCIONABLE honesta que mostrar. El mockup fuente (`Prototipo
 *    frontend/odobi-ui/prototipo/index.html:271`, comentario de `.reciente`) lo dice explícito:
 *    *"el golpe de color de esta pantalla va abajo, en lo que ya pasó [...] nunca envuelve nada
 *    tocable (Decisión B): la actividad reciente es registro, no acción"* — y esa misma vista
 *    (el widget de escritorio) nunca lleva un número grande encima del feed, sólo el `<h4>` +
 *    las filas.
 * 2. El feed **mezcla signos y tipos** (`entra`/`sale`/`neutro`, plata y no-plata — ver
 *    `ActividadItem.signo`/`.monto` en `@copiloto/core`): sumar montos sería sumar entradas y
 *    salidas de naturaleza distinta bajo un solo número sin sentido de negocio, lo mismo que el
 *    repo evita en todos lados (nunca un total que mezcle lo que no se puede sumar).
 * 3. `GET /actividad` (`packages/core/src/api/actividad.ts`) sólo devuelve `{items, cursor}` — a
 *    diferencia de `/clientes` (`total` real de la cartera) no hay un agregado del servidor que
 *    describa "cuánto hay" en TODA la actividad, sólo la página cargada. Contar `items.length`
 *    mostraría un número que cambia con `LIMITE_PAGINA`, no un hecho del negocio — el mismo tipo
 *    de cifra fabricada que `clientes-resumen` evita al congelar `carteraBase` en vez de mostrar
 *    el subconjunto filtrado.
 *
 * Por eso tampoco lleva el rótulo "Últimos" + pill de alta de gastos/ingresos/clientes: acá no hay
 * un alta propia (los ítems se originan en otras funciones), así que no hay verbo que ponerle al
 * pill.
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
      {/* Stack nombre + label fijo (CLAUDE.md §5) — calcado del criterio de `clientes-screen__stack`:
          card blanca, baseline, `--r-xl`. "Tu actividad" en vez de un período: este feed no tiene
          mes, es todo lo que pasó (mismo texto ya usado en los estados de error/no_disponible de
          esta pantalla). */}
      <header className="recientes-screen__stack">
        <span className="recientes-screen__nombre-fila">
          <span className="recientes-screen__nombre">Recientes</span>
          {estado === 'ok' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="recientes-actualizar"
              className="recientes-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        <span className="recientes-screen__periodo">Tu actividad</span>
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
