/**
 * El puente **tarjeta de Mi día → chat** (`hitl (a)`, decisión C-D5 «Opción A»: texto sembrado, 0 backend).
 *
 * El prototipo (`index.html:2748-2768`) abre el chat desde la acción de un aviso con un chip de contexto
 * («Desde tu aviso · Presupuesto · Lucía») y la conversación ya orientada a esa tarjeta. `POST /chat` no
 * tiene campo de contexto (`ChatIn {session_id, text, kind}`), así que **el contexto viaja en el texto**
 * y el chip es sólo UI. Si alguna vez se hace la Opción B (`ChatIn.contexto`), el contexto de tarjeta y el
 * hint de destino del dictado (`kind = "dictado:<destino>"`) tienen que entrar por UN solo mecanismo.
 *
 * 🔴 **No es un `dejarPendiente`.** El buzón de `mensajePendiente` *manda* el texto al recuperar el foco;
 * acá el texto se **siembra en el composer** y lo manda el emprendedor. El aviso trae acciones que acaban
 * en un mail a un tercero (recordatorio, reclamo): que el usuario lea qué se va a decir antes de que el
 * agente arme la card de confirmación no es fricción, es el último punto donde puede corregirlo.
 *
 * 🔴 **Sólo las tarjetas que detectó una regla** (`regla != null`). La tarjeta manual (la anotó el
 * emprendedor) trae el verbo «Borrar»: es una acción sobre la propia tarjeta, no un pedido al agente, y
 * mandarla al chat sería inventar un pedido que nadie hizo.
 *
 * 🔴 **El chip sólo nombra lo que la tarjeta sabe.** Sin categoría o sin cliente, esa parte no aparece:
 * `Desde tu aviso` a secas es verdad; `Desde tu aviso · Presupuesto · Cliente` con un cliente inventado, no.
 */
import type { TarjetaMiDia } from '../api';
import { CATEGORIAS, ETIQUETA_CATEGORIA_TARJETA, type CategoriaTarjeta } from '../midia/filtroTablero';

/** Lo que la tarjeta aporta al puente — un subconjunto, para que quien lo pruebe no arme una tarjeta entera. */
export type TarjetaParaChat = Pick<TarjetaMiDia, 'id' | 'texto' | 'verbo' | 'regla' | 'categoria' | 'cliente'>;

export interface AvisoAlChat {
  /** La tarjeta de Mi día de la que sale este aviso: es lo que `onVolver` devuelve para cerrar el ciclo. */
  tarjetaId: string;
  /** Lo que se siembra en el composer. Editable: el emprendedor lo manda (o no). */
  texto: string;
  /** El chip: «Desde tu aviso · Presupuestos · Lucía». Sólo UI, nunca viaja al backend. */
  contexto: string;
}

export const ROTULO_DESDE_TU_AVISO = 'Desde tu aviso';
export const ROTULO_VOLVER_AL_TABLERO = 'Volver al tablero';

/**
 * Cómo termina el viaje de un aviso (paso 5 del ciclo del prototipo, `index.html:2779-2781`: «el ciclo
 * cierra donde empezó: la tarjeta queda en estado resultado»). Quien vuelve del chat lo entrega a
 * `onVolverAlTablero`; sólo `hecha` toca la tarjeta. `sin_resolver` es volver sin haber resuelto nada, y
 * volver sin argumento (el chip «Desde tu aviso») tampoco la toca: salir de la charla no es resolver.
 */
export interface CierreAviso {
  tarjetaId: string;
  resultado: 'hecha' | 'sin_resolver';
}

function categoriaConocida(c: string | null): CategoriaTarjeta | null {
  return c != null && (CATEGORIAS as readonly string[]).includes(c) ? (c as CategoriaTarjeta) : null;
}

/**
 * La tarjeta → lo que se le lleva al chat, o `null` si esa tarjeta no tiene puente (manual, o sin verbo).
 */
export function avisoAlChat(t: TarjetaParaChat): AvisoAlChat | null {
  if (t.regla == null) return null;
  const verbo = t.verbo?.trim() ?? '';
  const aviso = t.texto.trim();
  if (verbo === '' || aviso === '') return null;

  const categoria = categoriaConocida(t.categoria);
  const partes = [
    ROTULO_DESDE_TU_AVISO,
    // «todo» es el chip que no filtra, no una categoría de la tarjeta.
    categoria != null && categoria !== 'todo' ? ETIQUETA_CATEGORIA_TARJETA[categoria] : null,
    t.cliente?.trim() || null,
  ].filter((p): p is string => p != null);

  return {
    tarjetaId: t.id,
    texto: `Sobre este aviso de Mi día: «${aviso}». Acción: ${verbo}`,
    contexto: partes.join(' · '),
  };
}
