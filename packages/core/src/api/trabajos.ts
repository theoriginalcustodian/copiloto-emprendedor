import type { EslabonTrabajo } from './inteligencia';
import { leerGraficoMargenTrabajo } from './inteligencia';
import { LIMITE_LISTADO_PRESUPUESTOS, listadoTruncado, listarPresupuestos } from './presupuestos';

/**
 * `trabajos` — **el "trabajo" como sujeto propio del cliente**, que hasta hoy no tenía módulo.
 *
 * Un *trabajo* es la cadena `presupuesto → comprobante → cobro`, y el backend lo referencia por
 * **cualquiera** de sus tres eslabones (`TrabajoStore.resolver`, `apps/copiloto/trabajo_store.py`).
 * Este módulo existe por una razón concreta y medible: `PUT /gastos/{id}/imputacion` pide un
 * `(eslabon, ref)`, y para ofrecérselo al emprendedor hay que poder **listar sus trabajos** — algo
 * que ninguna capa sabía hacer (`git grep` el 2026-10-14: cero ocurrencias de la imputación del
 * gasto en `packages/core` y en los dos fronts).
 *
 * 🔴 **No hay endpoint `GET /trabajos`.** Esta capa lo compone de las dos fuentes que SÍ existen, y
 * eso no es un atajo: es la forma del backend. Ver `listarTrabajosImputables`.
 */

/** El trabajo al que se imputa un gasto: el par `(eslabon, ref)` que pide el backend. */
export interface DestinoTrabajo {
  eslabon: EslabonTrabajo;
  ref: number;
}

/** Un trabajo ofrecible como destino, con el texto que el emprendedor va a leer. */
export interface TrabajoImputable extends DestinoTrabajo {
  /**
   * Lo que se muestra en la lista. Nunca vacío: si la fuente no trajo nombre, cae a
   * `etiquetaDeDestino` (`Presupuesto #12`), porque una fila sin texto es una fila que no se puede
   * elegir.
   */
  etiqueta: string;
}

const NOMBRE_ESLABON: Record<EslabonTrabajo, string> = {
  presupuesto: 'Presupuesto',
  comprobante: 'Factura',
  cobro: 'Cobro',
};

/**
 * El nombre mínimo de un trabajo, **sin pedir nada a la red**: `Presupuesto #12`, `Factura #7`.
 *
 * 🔴 **Existe para que mostrar «a qué trabajo está imputado este gasto» no cueste una llamada.** La
 * imputación que trae `GET /gastos/{id}` son tres referencias y nada más (`imputacion_de()`,
 * `apps/copiloto/gasto_store.py:61`): no viaja la etiqueta. Resolverla exigiría listar trabajos cada
 * vez que se abre un detalle, y el detalle se abre mucho más seguido de lo que se imputa. La etiqueta
 * rica —el concepto del presupuesto— se usa donde sí hace falta elegir: `listarTrabajosImputables`.
 */
export function etiquetaDeDestino(destino: DestinoTrabajo): string {
  return `${NOMBRE_ESLABON[destino.eslabon]} #${destino.ref}`;
}

/** `true` si los dos apuntan al mismo trabajo. Comparar objetos con `===` no sirve. */
export function mismoTrabajo(a: DestinoTrabajo | null, b: DestinoTrabajo | null): boolean {
  if (a === null || b === null) return a === b;
  return a.eslabon === b.eslabon && a.ref === b.ref;
}

function clave(d: DestinoTrabajo): string {
  return `${d.eslabon}:${d.ref}`;
}

/**
 * Los trabajos a los que el emprendedor puede imputar un gasto, de más reciente a más viejo dentro
 * de cada fuente.
 *
 * 🔴 **Compone DOS fuentes a propósito, y ninguna alcanza sola** — medido contra el backend, no
 * supuesto:
 *
 * 1. `GET /presupuestos` (`listarPresupuestos`) — el eslabón **raíz** y el caso principal: *«cargué
 *    el gasto del trabajo que acabo de presupuestar»*. Un presupuesto recién creado todavía no tiene
 *    ni cobro ni gasto imputado.
 * 2. `GET /inteligencia/graficos/margen-trabajo` (`leerGraficoMargenTrabajo`) — agrega los trabajos
 *    que **no nacieron de un presupuesto**: una factura suelta, un cobro directo.
 *
 * **Por qué no basta la segunda, que sería una sola llamada:** su generador devuelve *«TODOS los
 * trabajos con al menos un cobro o un gasto imputado»* (`inteligencia_queries.py:481`). O sea, deja
 * afuera exactamente el presupuesto nuevo al que se le quiere imputar el primer gasto — el caso que
 * más importa. Un selector construido sólo con eso estaría vacío justo cuando se lo necesita, y vacío
 * se lee como «no tenés trabajos», que sería falso.
 *
 * **Y lo que esta función NO puede ofrecer, dicho acá en vez de descubierto después:** un
 * **comprobante o un cobro sin ningún movimiento** no aparece en ninguna de las dos fuentes (no hay
 * listador de comprobantes en esta capa, y el gráfico los omite hasta que tienen cobro o gasto). No
 * se compensa inventando: el día que exista `GET /comprobantes`, se suma como tercera fuente **acá**,
 * y las dos pantallas lo heredan sin tocarlas.
 *
 * `{ status: 'no_disponible' }` sólo si **las dos** fuentes fallan: con una viva, se devuelve lo que
 * hay — media lista es útil, y un `no_disponible` por la mitad caída esconde la mitad sana.
 */
export async function listarTrabajosImputables(): Promise<
  | {
      status: 'ok';
      trabajos: TrabajoImputable[];
      /**
       * `true` = la lista NO es completa (los presupuestos no entraron todos en la página). Siempre lo
       * emite esta función; es opcional en el TIPO sólo para no romper a quien arma el resultado a
       * mano (mocks de las pantallas). Ausente = «no se sabe que falten», nunca «completo garantizado».
       */
      truncado?: boolean;
    }
  | { status: 'no_disponible' }
> {
  const [presup, margen] = await Promise.all([
    listarPresupuestos({ limit: LIMITE_LISTADO_PRESUPUESTOS }).catch(() => ({ status: 'no_disponible' }) as const),
    leerGraficoMargenTrabajo().catch(() => ({ status: 'no_disponible' }) as const),
  ]);

  if (presup.status !== 'ok' && margen.status !== 'ok') return { status: 'no_disponible' };

  const vistos = new Set<string>();
  const trabajos: TrabajoImputable[] = [];
  const agregar = (destino: DestinoTrabajo, etiqueta: string) => {
    const k = clave(destino);
    if (vistos.has(k)) return;
    vistos.add(k);
    trabajos.push({ ...destino, etiqueta: etiqueta.trim() !== '' ? etiqueta.trim() : etiquetaDeDestino(destino) });
  };

  if (presup.status === 'ok') {
    for (const p of presup.presupuestos) {
      // El reemplazado NO se ofrece: corregir un presupuesto tres veces dejaría cuatro filas del
      // mismo trabajo y ninguna forma de saber cuál vale (mismo criterio que el listado por default).
      if (p.reemplazadoPor != null) continue;
      agregar({ eslabon: 'presupuesto', ref: p.id }, `${p.concepto} · #${p.numero}`);
    }
  }

  if (margen.status === 'ok' && margen.modo === 'lista') {
    for (const t of [...margen.trabajos, ...margen.sinIngreso]) {
      agregar({ eslabon: t.eslabon, ref: t.ref }, t.etiqueta);
    }
  }

  // `truncado`: la lista NO es completa porque los presupuestos no entraron todos en la página. Es el
  // dato que distingue «hay N» de «hay N de M»: sin él, un selector corto se lee como «no tenés ese
  // trabajo». Sólo mira los presupuestos —la otra fuente (el gráfico) no tiene tope de página—, y si esa
  // fuente falló no hay nada que comparar: `false`, porque la caída ya se vio como media lista.
  const truncado = presup.status === 'ok' && listadoTruncado(presup.presupuestos.length, presup.total);
  return { status: 'ok', trabajos, truncado };
}
