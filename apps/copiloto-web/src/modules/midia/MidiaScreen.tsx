import { useCallback, useEffect, useRef, useState } from 'react';

import {
  borrarTarjetaMiDia,
  cambiarEstadoTarjetaMiDia,
  formatearImporte,
  leerTablero,
  type IdSolapa,
  type TarjetaMiDia,
  type TableroMiDia,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';
import './midia.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

/**
 * `MidiaScreen` — M-WEB módulo 6: port de `apps/mobile/src/modules/midia/PantallaMiDia.tsx` (el
 * tablero del detector proactivo, 3 solapas) a `copiloto-web`.
 *
 * MISMA lógica que mobile: se relee al recuperar el foco (acá, al volver a la pestaña del browser
 * vía `visibilitychange` — equivalente web de `useFocusEffect`), tap expande/contrae, `estado` NO
 * se asume tras la mutación — se relee el tablero entero.
 *
 * Lo que NO se porta 1:1: el swipe (`ReanimatedSwipeable`) → botones "Empezar"/"Terminé"/"Borrar"
 * explícitos en la fila, mismo criterio que `ActividadScreen` reemplazando `FlatList`+swipe táctil
 * por controles de mouse/teclado — no hay gesto de swipe en desktop.
 */
const OPCIONES_SOLAPA: readonly { valor: IdSolapa; etiqueta: string }[] = [
  { valor: 'para_hoy', etiqueta: 'Para hoy' },
  { valor: 'haciendo', etiqueta: 'Haciendo' },
  // `id` es `hecha` (singular, confirmado backend PR#96); el TÍTULO visible sí es plural.
  { valor: 'hecha', etiqueta: 'Hechas' },
];

/** A qué solapa avanza cada una, y cómo se llama la acción. `hecha` no tiene entrada: es terminal —
 *  sólo queda la acción de borrar. */
const SIGUIENTE: Partial<Record<IdSolapa, { estado: IdSolapa; etiqueta: string }>> = {
  para_hoy: { estado: 'haciendo', etiqueta: 'Empezar' },
  haciendo: { estado: 'hecha', etiqueta: 'Terminé' },
};

export function MidiaScreen() {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<TableroMiDia | null>(null);
  const [solapaActiva, setSolapaActiva] = useState<IdSolapa>('para_hoy');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const res = await leerTablero();
      if (!vivo.current) return;
      if (res.status === 'ok') {
        setTablero(res.tablero);
        setEstado('ok');
        return;
      }
      setEstado('no_disponible');
    } catch {
      if (vivo.current) setEstado('no_disponible');
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();

    function alVolverElFoco() {
      if (document.visibilityState === 'visible') void cargar();
    }
    document.addEventListener('visibilitychange', alVolverElFoco);

    return () => {
      vivo.current = false;
      document.removeEventListener('visibilitychange', alVolverElFoco);
    };
  }, [cargar]);

  async function avanzar(t: TarjetaMiDia) {
    const siguiente = SIGUIENTE[solapaActiva];
    if (siguiente == null) return;
    const res = await cambiarEstadoTarjetaMiDia(t.id, siguiente.estado);
    if (res.status === 'ok') {
      void cargar();
      return;
    }
    if (res.status === 'estado_invalido') {
      setError(res.motivo);
      return;
    }
    setError('No se pudo mover la tarjeta. Probá de nuevo en un momento.');
  }

  async function borrar(t: TarjetaMiDia) {
    const res = await borrarTarjetaMiDia(t.id);
    if (res.status === 'ok') {
      void cargar();
      return;
    }
    setError('No se pudo borrar la tarjeta. Probá de nuevo en un momento.');
  }

  const solapa = tablero?.solapas.find((s) => s.id === solapaActiva) ?? null;

  return (
    <div className="midia-screen" data-testid="pantalla-midia">
      <header className="midia-screen__header">
        <h1 className="midia-screen__title">Mi día</h1>
      </header>

      <div className="midia-screen__solapas" data-testid="midia-solapas">
        {OPCIONES_SOLAPA.map((o) => {
          const seleccionada = o.valor === solapaActiva;
          return (
            <button
              key={o.valor}
              type="button"
              className={`midia-screen__solapa${seleccionada ? ' midia-screen__solapa--activa' : ''}`}
              data-testid={`midia-solapa-${o.valor}`}
              aria-pressed={seleccionada}
              onClick={() => setSolapaActiva(o.valor)}
            >
              {o.etiqueta}
            </button>
          );
        })}
      </div>

      {error != null && (
        <div className="midia-screen__error" data-testid="midia-error" role="alert">
          <p>{error}</p>
          <Button variant="ghost" onClick={() => setError(null)}>
            Cerrar
          </Button>
        </div>
      )}

      {estado === 'cargando' && (
        <div className="midia-screen__loading" data-testid="midia-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={64} radius={16} />
          ))}
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="midia-screen__empty" data-testid="midia-no-disponible">
          Tu día todavía no está disponible en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <>
          {(solapa == null || solapa.tarjetas.length === 0) && (
            <p className="midia-screen__empty" data-testid="midia-vacio">
              {solapaActiva === 'para_hoy'
                ? 'Hoy no tenés nada pendiente. Cuando el copiloto detecte algo, aparece acá.'
                : 'No hay tarjetas acá todavía.'}
            </p>
          )}

          {solapa != null && solapa.tarjetas.length > 0 && (
            <div className="midia-screen__lista" data-testid="midia-lista">
              {solapa.tarjetas.map((t) => (
                <TarjetaMiDiaRow
                  key={t.id}
                  tarjeta={t}
                  expandida={expandida === t.id}
                  etiquetaAvanzar={SIGUIENTE[solapaActiva]?.etiqueta ?? null}
                  onPress={() => setExpandida((prev) => (prev === t.id ? null : t.id))}
                  onAvanzar={() => void avanzar(t)}
                  onBorrar={() => void borrar(t)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaMiDiaRow({
  tarjeta,
  expandida,
  etiquetaAvanzar,
  onPress,
  onAvanzar,
  onBorrar,
}: {
  tarjeta: TarjetaMiDia;
  expandida: boolean;
  /** `null` en la solapa "hecha": no hay siguiente, sólo se puede borrar. */
  etiquetaAvanzar: string | null;
  onPress: () => void;
  onAvanzar: () => void;
  onBorrar: () => void;
}) {
  const detalle = [tarjeta.cliente, tarjeta.monto != null ? formatearImporte(tarjeta.monto) : null, tarjeta.fecha]
    .filter((x): x is string => x != null && x !== '')
    .join(' · ');

  return (
    <div className="midia-tarjeta" data-testid={`midia-tarjeta-${tarjeta.id}`}>
      <button
        type="button"
        className="midia-tarjeta__texto"
        onClick={onPress}
        aria-expanded={expandida}
        aria-label={expandida ? `${tarjeta.texto}, contraer` : `${tarjeta.texto}, expandir`}
      >
        <p className={`midia-tarjeta__frase${expandida ? '' : ' midia-tarjeta__frase--clamp'}`}>{tarjeta.texto}</p>
        {expandida && detalle !== '' && (
          <p className="midia-tarjeta__detalle" data-testid={`midia-tarjeta-${tarjeta.id}-detalle`}>
            {detalle}
          </p>
        )}
      </button>

      <div className="midia-tarjeta__acciones">
        {etiquetaAvanzar != null && (
          <Button variant="primary" onClick={onAvanzar} data-testid={`midia-tarjeta-${tarjeta.id}-avanzar`}>
            {etiquetaAvanzar}
          </Button>
        )}
        <Button variant="danger" onClick={onBorrar} data-testid={`midia-tarjeta-${tarjeta.id}-borrar`}>
          Borrar
        </Button>
      </div>
    </div>
  );
}
