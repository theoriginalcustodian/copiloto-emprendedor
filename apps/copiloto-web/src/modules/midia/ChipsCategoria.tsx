import {
  CATEGORIAS,
  ETIQUETA_CATEGORIA_TARJETA,
  hayCategorias,
  tarjetasCriticas,
  type CategoriaTarjeta,
  type IdSolapa,
  type TableroMiDia,
} from '@copiloto/core';

import { Surface } from '../../design-system';

/**
 * Los chips de categoría del prototipo (BL-W7): filtran la solapa activa por `t.categoria` — que
 * decide el detector del backend (BL-J5, K-06), no la vista. «Todo» es el default y no filtra.
 * Con un backend previo al campo (ninguna tarjeta trae categoría) no se dibujan: un chip que filtra a
 * vacío mentiría.
 *
 * Borde y texto, SIN relleno: son atajos para mirar, no decisiones — con fill competirían con los
 * botones de acción de las tarjetas, que sí ejecutan algo.
 */
export function ChipsCategoria({
  activa,
  onCambiar,
  tablero,
}: {
  activa: CategoriaTarjeta;
  onCambiar: (c: CategoriaTarjeta) => void;
  tablero: TableroMiDia | null;
}) {
  if (!hayCategorias(tablero)) return null;
  return (
    <div className="midia-chips" data-testid="midia-chips" role="group" aria-label="Filtrar por categoría">
      {CATEGORIAS.map((c) => {
        const seleccionada = c === activa;
        return (
          <button
            key={c}
            type="button"
            className={`midia-chip${seleccionada ? ' midia-chip--activo' : ''}`}
            data-testid={`midia-chip-${c}`}
            aria-pressed={seleccionada}
            onClick={() => onCambiar(c)}
          >
            {ETIQUETA_CATEGORIA_TARJETA[c]}
          </button>
        );
      })}
    </div>
  );
}

/** El contador del prototipo: «3 para hoy · 1 en curso · 1 crítico». */
export function ContadorTablero({ tablero }: { tablero: TableroMiDia | null }) {
  if (tablero == null) return null;
  const cuenta = (id: IdSolapa) => tablero.solapas.find((s) => s.id === id)?.tarjetas.length ?? 0;
  const paraHoy = cuenta('para_hoy');
  const enCurso = cuenta('haciendo');
  const criticas = tarjetasCriticas(tablero).length;
  if (paraHoy === 0 && enCurso === 0) return null;

  return (
    <p className="midia-contador" data-testid="midia-contador">
      {paraHoy} para hoy · {enCurso} en curso{criticas > 0 ? ` · ${criticas} crítico${criticas === 1 ? '' : 's'}` : ''}
    </p>
  );
}

/**
 * El banner de alerta crítica (`.alerta` del prototipo): arriba de las solapas porque es transversal a
 * los tres estados. Sólo para `criticidad: 'critico'` — lo que ROMPE el negocio; usa el bloque, que ya
 * significa peso, en vez de un color de alarma. Sin tarjeta crítica no existe.
 */
export function BannerCritico({ tablero }: { tablero: TableroMiDia | null }) {
  const criticas = tarjetasCriticas(tablero);
  if (criticas.length === 0) return null;
  return (
    <Surface variant="bloque" className="midia-alerta" data-testid="midia-alerta" role="alert">
      {criticas.map((t) => (
        <div key={t.id} className="midia-alerta__item" data-testid={`midia-alerta-${t.id}`}>
          <p className="midia-alerta__texto">{t.texto}</p>
          {t.verbo != null && <span className="midia-alerta__accion">{t.verbo}</span>}
        </div>
      ))}
    </Surface>
  );
}
