import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import/no-unresolved -- `?raw` es una convención de Vite (import de
// texto crudo), mismo patrón que `desktopNoHexLiterals.test.ts`.
import desktopCss from './desktop.css?raw';

/**
 * Guard anti-regresión del scroll del rail.
 *
 * ⚠️ Qué mide y qué NO: esto es un guard de TEXTO sobre el CSS, no un gate de layout — jsdom no
 * hace layout, así que ningún test de esta suite puede ver si la barra realmente scrollea. El gate
 * real se corrió en navegador (Chromium, marcado de `Rail.tsx` + este mismo `desktop.css`) y quedó
 * medido en el PR: a 480px de alto, con el fix el último ítem llega a 412px con el rail terminando
 * en 480 (se alcanza); sin el fix queda en 559 (se pierde fuera de la pantalla).
 *
 * Este archivo existe sólo para que las dos declaraciones no se borren "limpiando" el CSS, porque
 * su ausencia NO da síntoma mientras los ítems entren en la ventana: el umbral medido es 625px de
 * alto, y a 700px la holgura es de 0px — o sea CERO ítems de margen. La próxima función que se
 * agregue al rail vuelve a romperlo, y de nuevo sin aviso.
 */
/**
 * Los comentarios del CSS se descartan ANTES de buscar las declaraciones. Sin esto el guard es
 * mudo: el comentario que explica por qué hace falta `min-height: 0` contiene esa misma cadena, así
 * que el test pasaba con la declaración BORRADA. Lo cazó el control diferencial (quitar la línea y
 * exigir rojo); sin ese control habría quedado un instrumento que confirma en vez de verificar.
 */
const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('rail — la lista de funciones scrollea sin arrastrar el bloque inferior', () => {
  const bloqueRailItems = sinComentarios(desktopCss).match(/\.rail__items\s*\{([^}]*)\}/)?.[1] ?? '';

  it('`.rail__items` existe como regla en desktop.css', () => {
    // Control positivo: si el selector se renombra, los dos asserts de abajo pasarían sobre un
    // string vacío y este guard se volvería mudo en vez de romperse.
    expect(bloqueRailItems.trim()).not.toBe('');
  });

  it('`.rail__items` declara overflow-y: auto', () => {
    expect(bloqueRailItems).toMatch(/overflow-y:\s*auto/);
  });

  it('`.rail__items` declara min-height: 0 — sin esto el overflow-y no se activa nunca', () => {
    // `min-height:auto` es el default de un hijo flex: le impide encogerse bajo su contenido, con
    // lo cual el contenedor nunca queda más chico que la lista y `overflow-y` no tiene qué recortar.
    expect(bloqueRailItems).toMatch(/min-height:\s*0/);
  });

  it('`.rail` NO declara overflow-y — el scroll va en la lista, no en el rail', () => {
    // En `.rail` el scroll arrastraría `.rail__bottom` (Skin + Usuario, la puerta a Ajustes) fuera
    // de la vista, y su `overflow: hidden` recorta `.rail__label` durante la animación de ancho.
    const bloqueRail = sinComentarios(desktopCss).match(/\n\.rail\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(bloqueRail.trim()).not.toBe('');
    expect(bloqueRail).not.toMatch(/overflow-y:/);
  });
});

/**
 * Guard anti-regresión de la barra que ROBA ANCHO con el rail replegado (2026-08-07).
 *
 * ⚠️ Mismo alcance que el bloque de arriba: es un guard de TEXTO, no un gate de layout. jsdom no
 * pinta scrollbars ni reparte ancho, así que ningún test de esta suite puede ver el bug. La medición
 * real se hizo en Chromium con la lista desbordando (12 funciones, ventana de 600px de alto), y el
 * diferencial quedó en el PR:
 *
 *     ANTES  `.rail__items` offsetWidth 39 · clientWidth 16 → 23px robados · `.rail__item` de 27px
 *     DESPUÉS offsetWidth 39 · clientWidth 39 → 0px robados · `.rail__item` de 39px
 *     (en ambos casos `scrollHeight 584 > clientHeight` → el desborde EXISTÍA: sin esa precondición
 *      el gate mide 0 robado por no haber barra, y da verde sin haber mirado nada)
 *
 * Por qué hace falta el guard: 23px robados de 39 dejan al `.rail__item` en 27px, y con
 * `padding: 11px 12px` eso son 3px de content box para un ícono de 21px con `flex-shrink: 0`. Y como
 * el síntoma sólo aparece cuando la lista desborda, borrar estas reglas NO da error en ninguna
 * ventana alta: vuelve en silencio la próxima vez que se agregue una función al rail (fue el 12º tab,
 * `Consola`, el que lo destapó).
 */
describe('rail — con el rail replegado la barra no reserva ancho', () => {
  const css = sinComentarios(desktopCss);
  const bloqueBarra =
    css.match(/\.rail:not\(\.rail--open\)\s+\.rail__items::-webkit-scrollbar\s*\{([^}]*)\}/)?.[1] ?? '';
  const bloqueLista =
    css.match(/\.rail:not\(\.rail--open\)\s+\.rail__items\s*\{([^}]*)\}/)?.[1] ?? '';

  it('las dos reglas del estado replegado existen (control positivo del guard)', () => {
    // Sin esto, un renombre del selector dejaría los asserts de abajo corriendo sobre strings
    // vacíos: pasarían siempre y el guard sería mudo — el mismo modo de falla que ya se cazó con
    // `min-height: 0` escondido en un comentario.
    expect(bloqueBarra.trim()).not.toBe('');
    expect(bloqueLista.trim()).not.toBe('');
  });

  it('Chromium/WebKit: la barra se declara con width 0 en estado replegado', () => {
    expect(bloqueBarra).toMatch(/width:\s*0/);
  });

  it('Firefox: `scrollbar-width: none` pisa el `thin` que hereda de `html`', () => {
    // `global.css` pone `scrollbar-width: thin` en `html`, y esa propiedad SE HEREDA — no alcanza con
    // apagar `::-webkit-scrollbar`, que Firefox ignora.
    expect(bloqueLista).toMatch(/scrollbar-width:\s*none/);
  });

  it('el fix apaga la BARRA, no el scroll — `.rail__items` sigue en overflow-y: auto', () => {
    // `overflow-y: hidden` también sacaría la barra, pero deshace la mitad del PR#295: deja las
    // últimas funciones inalcanzables mientras el rail está replegado. Este assert es lo único que
    // distingue el fix correcto del atajo que "también se ve bien".
    expect(bloqueRailItemsDelScroll(css)).toMatch(/overflow-y:\s*auto/);
    expect(bloqueLista).not.toMatch(/overflow-y:\s*hidden/);
  });
});

/** El bloque base de `.rail__items` (el que trae el `overflow-y`), sin el prefijo del estado. */
function bloqueRailItemsDelScroll(css: string): string {
  return css.match(/(?:^|\n)\.rail__items\s*\{([^}]*)\}/)?.[1] ?? '';
}
