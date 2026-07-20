import fs from 'fs';
import path from 'path';

// Jest (jest-expo) — describe/it/expect son globales.

import { PRESS_FADE, PRESS_SCALE, pressableStyle } from './presion';

/**
 * 🔴 **Por qué este test es de FUENTE y no de render.** Lo que habría que probar de verdad es "al
 * tocar un `Tile`, encoge". No se puede: el estado `pressed` de `Pressable` lo maneja el responder
 * nativo de Pressability, que el renderer de test no ejecuta. Medido — `fireEvent(tile, 'pressIn')`
 * (con y sin re-query del elemento) deja el slot de presión en `null`: el `style` resuelto sigue
 * siendo `[raiz, borderColor, sombra, null, null]`. Un `expect` sobre el estilo presionado ahí no
 * fallaría por el bug que buscamos, pasaría siempre — sería un verde vacío.
 *
 * Así que se prueba lo que SÍ es alcanzable: el canon existe con los valores del diseño, el helper
 * se comporta, y **nadie vuelve a definir la presión localmente**.
 *
 * 🔴 **Alcance del guard — y por qué antes NO servía.** Hasta 2026-07-20 los dos guards escaneaban
 * sólo `__dirname` (`src/theme/glass/`), que contiene 3 de los ~49 `Pressable` de la app: `Tile`,
 * `Row` y `MarcoGlass` — es decir, **el único lugar donde el defecto nunca existió**, porque el canon
 * salió justamente de ahí. Los `Pressable` que nacían sin feedback viven en `src/modules/**` y
 * `app/**`, fuera del escaneo: alguien podía escribir `pressed ? { opacity: 0.85 } : null` en
 * `modules/captura/` y los dos tests pasaban en verde. Ahora se escanea `apps/mobile/src` +
 * `apps/mobile/app` recursivamente.
 *
 * **Lo que este test NO cubre (dicho explícitamente, para no vender de más):**
 *   - Es un guard de **texto sobre el fuente**, no de comportamiento. Prueba que el canon se importa,
 *     no que se haya *usado* en el `Pressable` de ese archivo. Un archivo que importe `pressableStyle`
 *     y no se lo pase a su `Pressable` pasa el guard.
 *   - No detecta feedback definido con otro valor (`scale(.9)`, `opacity: .7`): el vector real medido
 *     es la **copia** de los valores canónicos, y eso es lo que se ataja.
 *   - No cubre `TouchableOpacity`/`android_ripple` — hoy la app no usa ninguno de los dos.
 */

/** `apps/mobile`, subiendo desde `src/theme/glass`. */
const RAIZ_APP = path.resolve(__dirname, '..', '..', '..');
const RAICES = ['src', 'app'].map((d) => path.join(RAIZ_APP, d));

/**
 * 🔴 **ALLOWLIST — incumplidores LEGÍTIMOS, no silenciados.** Cada entrada es una decisión, no una
 * excepción de conveniencia: si el guard molesta, se discute la entrada, no se borra el guard.
 * Rutas relativas a `apps/mobile`, con separador `/`.
 */
const PERMITIDOS: Record<string, string> = {
  // Vacía a propósito.
  //
  // documed permite acá `src/modules/captura/BotonVoz.tsx`, porque su botón de voz tiene animación
  // de presión propia (un latido `Animated.loop` 1 → 1.08) y meterle `PRESS_SCALE` compondría dos
  // escalas anidadas. Esa entrada NO se copia todavía: el archivo no existe en este repo (llega en
  // F6, con el dictado corto). Anotarlo por adelantado dejaría una entrada huérfana desde el día 0,
  // que es justo lo que el segundo test de este candado prohíbe — un permiso concedido a un archivo
  // que nadie escribió todavía silencia al guard sin que nadie se entere.
  //
  // Cuando `BotonVoz` llegue en F6, si necesita el permiso, se agrega ahí con su motivo.
};

/** Todos los `.ts`/`.tsx` bajo las raíces, sin tests ni el canon (que cita los valores a propósito). */
function fuentesDeLaApp(): string[] {
  const encontrados: string[] = [];

  const caminar = (dir: string): void => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const absoluto = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === 'node_modules' || entrada.name.startsWith('.')) continue;
        caminar(absoluto);
        continue;
      }
      if (!/\.tsx?$/.test(entrada.name)) continue;
      if (entrada.name.includes('.test.')) continue; // los tests citan los valores a propósito
      const relativo = path.relative(RAIZ_APP, absoluto).split(path.sep).join('/');
      if (relativo === 'src/theme/glass/presion.ts') continue; // el canon ES la definición
      encontrados.push(relativo);
    }
  };

  RAICES.forEach(caminar);
  return encontrados.sort();
}

function leer(relativo: string): string {
  return fs.readFileSync(path.join(RAIZ_APP, relativo), 'utf8');
}

describe('presion — el canon del feedback táctil', () => {
  it('PRESS_SCALE es el `:active scale(.95)` del template', () => {
    expect(PRESS_SCALE).toEqual({ transform: [{ scale: 0.95 }] });
  });

  it('PRESS_FADE es el acuse por opacidad .85', () => {
    expect(PRESS_FADE).toEqual({ opacity: 0.85 });
  });

  it('pressableStyle no aplica nada mientras no hay toque', () => {
    const base = { padding: 8 };
    expect(pressableStyle(base)({ pressed: false })).toEqual([base, null]);
  });

  it('pressableStyle suma el feedback al estar presionado, sin perder el base', () => {
    const base = { padding: 8 };
    expect(pressableStyle(base)({ pressed: true })).toEqual([base, PRESS_SCALE]);
  });

  it('pressableStyle usa PRESS_SCALE por defecto y respeta el feedback explícito', () => {
    expect(pressableStyle(undefined)({ pressed: true })).toEqual([undefined, PRESS_SCALE]);
    expect(pressableStyle(undefined, PRESS_FADE)({ pressed: true })).toEqual([undefined, PRESS_FADE]);
  });
});

describe('presion — guard contra la divergencia por copia', () => {
  // El vector real no es inventar un valor nuevo: es copiar la línea que `Tile`/`Row` tenían local.
  // Tolera `.95` y `0.95` porque las dos formas compilan igual y las dos son una copia.
  it('ningún archivo de src/ ni app/ redefine los valores de presión localmente', () => {
    const culpables = fuentesDeLaApp().filter((archivo) => {
      const src = leer(archivo);
      return /scale:\s*0?\.95/.test(src) || /opacity:\s*0?\.85/.test(src);
    });

    expect(culpables).toEqual([]);
  });

  // El import se busca por sufijo del especificador porque la ruta varía según dónde viva el archivo:
  // `./presion` en este directorio, `../../theme/glass/presion` en `modules/`, `../src/…` en `app/`.
  it('todo archivo de src/ o app/ que renderiza un Pressable importa el canon de presion', () => {
    const sinCanon = fuentesDeLaApp().filter((archivo) => {
      if (archivo in PERMITIDOS) return false;
      const src = leer(archivo);
      if (!src.includes('<Pressable')) return false;
      return !/from '[^']*\/presion'/.test(src) && !/from '\.\/presion'/.test(src);
    });

    expect(sinCanon).toEqual([]);
  });

  // 🔴 La allowlist es una lista de decisiones vivas, no un cajón: una entrada que dejó de hacer falta
  // es un permiso permanente concedido a un archivo que hoy cumple — silencia al guard sin que nadie
  // se entere. Pasó durante la escritura misma de este test: `app/spike-panel.tsx` entró a la lista y
  // minutos después otra sesión lo migró al canon, dejando la entrada muerta. Por eso una entrada es
  // huérfana si el archivo NO existe, si ya no tiene `Pressable`, o si YA IMPORTA el canon.
  it('ninguna entrada de la allowlist quedó huérfana o dejó de hacer falta', () => {
    const huerfanas = Object.keys(PERMITIDOS).filter((archivo) => {
      if (!fs.existsSync(path.join(RAIZ_APP, archivo))) return true;
      const src = leer(archivo);
      if (!src.includes('<Pressable')) return true;
      return /from '[^']*\/presion'/.test(src) || /from '\.\/presion'/.test(src);
    });

    expect(huerfanas).toEqual([]);
  });
});
