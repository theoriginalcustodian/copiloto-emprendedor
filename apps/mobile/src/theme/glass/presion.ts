/**
 * `presion` — el feedback táctil de toda superficie presionable de DocuMed. Fuente ÚNICA.
 *
 * 🔴 **Por qué existe el módulo.** Un `Pressable` que no responde al dedo no se percibe como "sobrio":
 * se percibe como **app trabada**. El toque no tiene acuse, así que el usuario no ve su toque — ve la
 * consecuencia varios frames después, cuando navegó o cambió la pantalla, y en el medio no sabe si el
 * botón registró. Ese hueco es el que hace que una app se sienta mecánica.
 *
 * 🔴 **Y por qué un módulo y no dos constantes sueltas.** La convención ya existía y era correcta, pero
 * vivía DUPLICADA y sin exportar: `Tile` tenía su `scale(.95)` local y `Row` su `opacity(.85)` local.
 * Al no haber de dónde importarla, cada `Pressable` nuevo nacía sin feedback — no por decisión, sino
 * porque copiar el valor a mano es más trabajo que omitirlo. Ni un `android_ripple`, ni un
 * `TouchableOpacity` compensando en otro lado. Es la misma divergencia por copia que ya se pagó en
 * `canonGlass.ts` y `relieve.ts`, con el agravante de que acá la copia nunca llegó a hacerse.
 *
 * 📏 **La cifra, con su método** (re-medida 2026-07-20; la versión anterior de este comentario decía
 * "42 y sólo 2" sin decir con qué se contó, y por eso nadie pudo reproducirla). Glob exacto:
 *
 *     grep -rn "<Pressable" src app --include="*.tsx" --include="*.ts" \
 *       | grep -v "\.test\." | grep -v "src/theme/glass/presion.ts"
 *
 *   - **40** ocurrencias en `src/` (código de app, sin tests) ← de acá salía el "42": sumaba 2
 *     ocurrencias que viven dentro de archivos `.test.tsx`, que no son superficie tocable.
 *   - **49** contando también `app/` (las rutas de expo-router), repartidas en 28 archivos.
 *   - Con feedback al momento de crear el módulo: **2**, los de este directorio.
 *
 * El guard que sostiene esto vive en `presion.test.tsx` y escanea `src/` + `app/` — lee ahí su
 * ALLOWLIST y, sobre todo, la lista explícita de lo que el guard NO cubre.
 *
 * **Cuál de los dos usar.** No son intercambiables por gusto: son dos geometrías distintas.
 *   - `PRESS_SCALE` → superficies con caja propia (tiles del escritorio, botones, cards). Encogerlas
 *     lee como "se hunde", que es la metáfora correcta para algo que se aprieta.
 *   - `PRESS_FADE`  → filas, links y controles anchos. Escalar una fila que ocupa el ancho de la
 *     pantalla se lee como un salto de layout, no como un toque: lo que se mueve es el texto de al
 *     lado. Ahí el acuse va por opacidad, que no desplaza nada.
 */
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * `:active scale(.95)` del template canónico (`App glass/DocuMed 3 …/DocuMed App.dc.html`, regla
 * `.dmt-w .dm-tile:active`). El valor sale del diseño, no de un gusto: más profundo empieza a leerse
 * como animación y no como acuse.
 */
export const PRESS_SCALE: ViewStyle = { transform: [{ scale: 0.95 }] };

/** Acuse por opacidad, para lo que no puede encoger sin arrastrar el layout de al lado. */
export const PRESS_FADE: ViewStyle = { opacity: 0.85 };

/**
 * Arma el `style={({ pressed }) => …}` de un `Pressable` en una sola llamada, para el caso común:
 * una superficie que SIEMPRE es presionable.
 *
 *   <Pressable style={pressableStyle(styles.boton)} onPress={…} />
 *   <Pressable style={pressableStyle(styles.fila, PRESS_FADE)} onPress={…} />
 *
 * 🔴 **No sirve cuando el `onPress` es opcional**, y por eso `Tile`/`Row` no lo usan. RN pone `pressed`
 * en `true` aunque no haya `onPress` (lo que apaga la pressability es `disabled`), así que un tile
 * decorativo se hundiría al tocarlo sin que pase nada — peor que no dar feedback: promete una acción
 * que no existe. En ese caso va el ternario explícito con el guard, como en `Tile.tsx`.
 */
export function pressableStyle(
  base?: StyleProp<ViewStyle>,
  feedback: ViewStyle = PRESS_SCALE,
): (state: { pressed: boolean }) => StyleProp<ViewStyle> {
  return ({ pressed }) => [base, pressed ? feedback : null];
}
