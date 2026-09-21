import {
  CATEGORIAS,
  ETIQUETA_CATEGORIA_TARJETA,
  type CategoriaTarjeta,
  type IdSolapa,
  type TableroMiDia,
} from '@copiloto/core';

/**
 * Los chips de categoría del prototipo (BL-W7): filtran la solapa activa; «Todo» es el default y no
 * filtra. De qué categoría es cada tarjeta lo deriva el FRONTEND hoy — vive en UN solo módulo
 * borrable (`@copiloto/core` → `midia/categoriaTarjeta.ts`, compartido con mobile) que se borra
 * cuando llegue `BL-J5` (K-06). Estos chips no cambian ese día.
 *
 * Borde y texto, SIN relleno: son atajos para mirar, no decisiones — con fill competirían con los
 * botones de acción de las tarjetas, que sí ejecutan algo.
 */
export function ChipsCategoria({
  activa,
  onCambiar,
}: {
  activa: CategoriaTarjeta;
  onCambiar: (c: CategoriaTarjeta) => void;
}) {
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

/**
 * El contador del prototipo: «3 para hoy · 1 en curso».
 *
 * ⚠️ Falta «· 1 crítico», y no se inventa: la criticidad es una propiedad de la regla que hoy no viaja
 * en la tarjeta (K-06). Deducirla del nombre de la regla sería decidir, desde la vista, que un CAE por
 * vencer urge más que un margen negativo. Cuando llegue el campo, se agrega acá.
 */
export function ContadorTablero({ tablero }: { tablero: TableroMiDia | null }) {
  if (tablero == null) return null;
  const cuenta = (id: IdSolapa) => tablero.solapas.find((s) => s.id === id)?.tarjetas.length ?? 0;
  const paraHoy = cuenta('para_hoy');
  const enCurso = cuenta('haciendo');
  if (paraHoy === 0 && enCurso === 0) return null;

  return (
    <p className="midia-contador" data-testid="midia-contador">
      {paraHoy} para hoy · {enCurso} en curso
    </p>
  );
}
