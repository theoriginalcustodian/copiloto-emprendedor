/**
 * De qué **categoría** es cada tarjeta del detector — lo que alimenta los chips del tablero
 * (Todo · Cobros · ARCA · Presupuestos · Tuyas), tal como los muestra el prototipo.
 *
 * 🔴 **Esto lo deriva el FRONTEND, y no debería.** Es el punto B-3 del pedido a backend
 * (`specs/mobile-coherencia.md` Parte 2): la categoría —y la criticidad, y el verbo de la acción—
 * son propiedades **de la regla**, o sea del dominio, y el que las conoce es el detector. Mientras no
 * viajen en la tarjeta, alguien tiene que decidirlas, y que ese alguien sea el frontend significa que
 * **cada plataforma puede decidirlas distinto** — que es exactamente cómo aparecieron las
 * divergencias que esta ola está corrigiendo.
 *
 * Por eso vive acá, solo, en un archivo de 40 líneas: el día que el campo llegue, **este archivo es
 * lo único que se borra**. Si el mapeo estuviera desparramado adentro de la pantalla, el connect
 * sería una arqueología.
 *
 * ⚠️ **No toda tarjeta cae en un chip, y está bien.** Las de márgenes y gastos (`trabajo`, `mes`) no
 * tienen chip propio en el prototipo: se ven en **Todo**, que es el default y muestra siempre todo.
 * La alternativa —inventarles un chip que el diseño no tiene— sería peor: un filtro que nadie pidió
 * es una pantalla más para mantener, y esconder una tarjeta detrás de un chip que no existe sería un
 * dato que desaparece.
 *
 * ⚠️ **Lo que NO se deriva acá, a propósito: la CRITICIDAD.** El prototipo tiene un banner de alerta
 * crítica separado y un contador que dice «… · 1 crítico». Deducir qué es crítico a partir del nombre
 * de la regla sería inventar una jerarquía sobre el negocio de otro: que un CAE esté por vencer sea
 * más o menos urgente que un margen negativo es una decisión de producto, no de la vista. Espera B-3.
 */
import type { TarjetaMiDia } from '@copiloto/core';

export const CATEGORIAS = ['todo', 'cobros', 'arca', 'presupuestos', 'tuyas'] as const;
export type CategoriaTarjeta = (typeof CATEGORIAS)[number];

/** El rótulo de cada chip, en el orden en que se muestran. */
export const ETIQUETA_CATEGORIA: Record<CategoriaTarjeta, string> = {
  todo: 'Todo',
  cobros: 'Cobros',
  arca: 'ARCA',
  presupuestos: 'Presupuestos',
  tuyas: 'Tuyas',
};

/** Las reglas del detector que hablan de ARCA. Nombres exactos de `mi_dia_detector.py`. */
const REGLAS_ARCA = ['cae_por_vencer', 'certificado_afip_por_vencer'];
/** La regla que habla de plata que te deben. */
const REGLAS_COBROS = ['facturas_impagas_viejas'];

/**
 * A qué chip pertenece una tarjeta. `null` = a ninguno en particular: se ve sólo en «Todo».
 *
 * `regla === null` son las tarjetas que cargó el emprendedor a mano — «Tuyas». Es el único caso que
 * NO depende de adivinar nada: la ausencia de regla es, literalmente, «esto no lo detecté yo».
 */
export function categoriaDe(t: TarjetaMiDia): Exclude<CategoriaTarjeta, 'todo'> | null {
  if (t.regla == null) return 'tuyas';
  if (REGLAS_ARCA.includes(t.regla)) return 'arca';
  if (REGLAS_COBROS.includes(t.regla)) return 'cobros';
  if (t.entidadTipo === 'presupuesto') return 'presupuestos';
  return null;
}

/** Las tarjetas que muestra un chip. «Todo» no filtra: muestra todas, siempre. */
export function filtrarPorCategoria(
  tarjetas: readonly TarjetaMiDia[],
  categoria: CategoriaTarjeta,
): readonly TarjetaMiDia[] {
  if (categoria === 'todo') return tarjetas;
  return tarjetas.filter((t) => categoriaDe(t) === categoria);
}
