/**
 * Lo que el FRONTEND hace con `categoria` / `criticidad` / `verbo` de cada tarjeta (BL-J5, K-06).
 *
 * Las tres son propiedades **de la regla** y las decide el detector del backend: acá no se deduce
 * nada. Antes (`categoriaTarjeta.ts`, borrado) el cliente adivinaba la categoría por el nombre de la
 * regla; que cada plataforma la decida distinto fue lo que produjo las divergencias que esta ola
 * corrige. Ahora sólo se **lee**.
 *
 * Fail-soft con un backend previo al campo: si NINGUNA tarjeta trae `categoria`, `hayCategorias` da
 * `false` y las pantallas no dibujan los chips (un chip que filtra a vacío sería mentir). «Todo» no
 * filtra, así que la lista completa se ve igual.
 */
import type { TableroMiDia, TarjetaMiDia } from '../api';

export const CATEGORIAS = ['todo', 'cobros', 'arca', 'presupuestos', 'tuyas'] as const;
export type CategoriaTarjeta = (typeof CATEGORIAS)[number];

/** El rótulo de cada chip, en el orden en que se muestran. */
export const ETIQUETA_CATEGORIA_TARJETA: Record<CategoriaTarjeta, string> = {
  todo: 'Todo',
  cobros: 'Cobros',
  arca: 'ARCA',
  presupuestos: 'Presupuestos',
  tuyas: 'Tuyas',
};

/** Las tarjetas que muestra un chip. «Todo» no filtra; `categoria: null` sólo aparece en «Todo». */
export function filtrarPorCategoria(
  tarjetas: readonly TarjetaMiDia[],
  categoria: CategoriaTarjeta,
): readonly TarjetaMiDia[] {
  if (categoria === 'todo') return tarjetas;
  return tarjetas.filter((t) => t.categoria === categoria);
}

/** ¿El backend está mandando categorías? Sin esto, los chips no se muestran. */
export function hayCategorias(tablero: TableroMiDia | null): boolean {
  return tablero?.solapas.some((s) => s.tarjetas.some((t) => t.categoria != null)) ?? false;
}

/**
 * Las tarjetas críticas para el banner de arriba de las solapas. Sólo las que siguen abiertas: una
 * crítica ya en «Hechas» no es una alerta.
 */
export function tarjetasCriticas(tablero: TableroMiDia | null): readonly TarjetaMiDia[] {
  if (tablero == null) return [];
  return tablero.solapas
    .filter((s) => s.id !== 'hecha')
    .flatMap((s) => s.tarjetas)
    .filter((t) => t.criticidad === 'critico');
}
