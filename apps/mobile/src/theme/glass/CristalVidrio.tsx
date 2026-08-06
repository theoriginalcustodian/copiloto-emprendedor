/**
 * `CristalVidrio` — el envoltorio de UNA superficie flotante (shell, HUD, gate de confirmación,
 * menú). Nombre heredado del rediseño Z-Depth de DocuMed — se conserva para no tocar los 9 imports
 * que ya lo consumen por este nombre (`ListaMensajes`, `DetalleComprobante`, `DetallePresupuesto`,
 * `PanelDeslizable`, `MarcoGlass`…), pero desde ODOBI hito 2 **ya no es vidrio**.
 *
 * 🔴 **ODOBI (§1.3 del DoD): "sin glass, color pleno + relieve".** Hasta el hito 1 este primitivo
 * apilaba un `LinearGradient(tint→tint2)` semitransparente sobre el color del tema — la superficie
 * dejaba ver lo de abajo, atenuado. Eso se retira acá: el cuerpo pasa a **color plano opaco** (§2.3,
 * ya aplanado en `tokens.ts`) y el relieve —lo que antes hacía el tinte apilado— lo da la SOMBRA
 * proyectada de `relieve.ts`, con el color cálido validado en el spike del hito 0.
 *
 * Antes de eso, durante mucho tiempo, montó un `BlurView` de `expo-blur` que en Android **nunca
 * desenfocó** (su `blurMethod` viene en `'none'`) y que a cambio pintaba un velo gris casi negro con
 * alfa `0.69 × intensity/100` (ver `TintStyle.kt` del paquete) — el "manchón" que ensuciaba la
 * pantalla y se comía el color del skin. Como el síntoma se atribuyó al wash, la opacidad se
 * recalibró seis veces (0.55 → 0.82 → 0.94 → 1 → 0.32 → 0.42) sin arreglar nunca la causa. `expo-blur`
 * ya no tiene un solo import real en el código (sólo esta mención histórica) — sale de `package.json`
 * en este mismo hito.
 *
 * Estructura (por qué así): RN no tiene `inset` nativo. Se reconstruye por capas:
 *   1. Contenedor EXTERNO — lleva la sombra proyectada (`relieve.ts`), SIN `overflow:hidden`
 *      (recortar mata la sombra).
 *   2. Contenedor INTERNO — `overflow:hidden` + radio + borde + color de fondo PLENO.
 *   3. Línea de luz superior (`inset 0 1.5px 0 hi` del diseño) — una hairline absoluta arriba.
 *   4. `children` encima de todo.
 *
 * Cero-hex: todo color sale de `useTema()` (ver `temaSinHex.test.ts`).
 */
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../ThemeProvider';
import { sombraNivel } from './relieve';

export type NivelCristal = 'conversacion' | 'grabacion' | 'takeover' | 'informe' | 'menu';

interface ConfigNivel {
  /** Qué superficie de `color.*` pinta el contenedor. `fondo` para las que SON la pantalla entera
   *  (conversación/grabación/takeover); `superficieAlta` para las que flotan ENCIMA de otra pantalla
   *  ya visible (informe/menú — mismo criterio que un modal sobre contenido). */
  superficie: 'fondo' | 'superficieAlta';
  /** Radio del contenedor. Diseño: cristales 40 · menú 20. */
  radio: number;
  /** Borde completo (informe/menú) vs sólo la línea superior de luz (conversacion/grabacion). */
  bordeCompleto: boolean;
  /** Ancla el panel al borde INFERIOR de la pantalla (nace desde abajo, se levanta) — invierte el
   *  offset de la sombra hacia arriba. `false` = flota y cae hacia abajo (informe/menú). */
  ancladoAbajo: boolean;
}

// Los 5 casos son distintas superficies flotantes, pero el MISMO nivel de relieve (nivel 4 ·
// "flotante" — shell/modal/bottom sheet, DoD §2.4): ninguna es una card en reposo dentro de una
// lista. Lo que cambia entre ellas es geometría de layout (radio/borde) y hacia qué lado ancla, no
// el color/opacidad/blur de la sombra — por eso todas comparten `tema.glass.relieve.nivel4` en vez
// de repetir su propio `{shadowOffset, shadowRadius, shadowOpacity, elevation}` (lo que hacía esta
// tabla hasta el hito 1: 5 números hardcodeados por variante, ya divergidos entre sí).
const NIVELES: Record<NivelCristal, ConfigNivel> = {
  conversacion: { superficie: 'fondo', radio: 40, bordeCompleto: false, ancladoAbajo: true },
  // `grabacion` es ALIAS de `conversacion`: mismo panel, por orden del operador ("el tamaño y formato
  // canónico es el del glass principal"). Dos tablas de valores para dos superficies que el usuario lee
  // como la misma cosa es exactamente cómo nació la divergencia que hubo que corregir a mano en cada
  // pantalla.
  grabacion: { superficie: 'fondo', radio: 40, bordeCompleto: false, ancladoAbajo: true },
  // 🔴 `takeover` — el HUD de una grabación VIVA. Ya era la única superficie 100% opaca antes de este
  // hito; con "color pleno" todas lo son ahora, así que deja de ser un caso especial en ESTE eje (sigue
  // siendo especial en otros: sin salida por gesto ni "Volver", ver `MarcoGlass.tsx`).
  takeover: { superficie: 'fondo', radio: 40, bordeCompleto: false, ancladoAbajo: true },
  // 🔴 `informe`/`menu` flotan DENTRO de otra pantalla ya visible (el gate de confirmación dentro del
  // chat/captura). Van a `superficieAlta` (la elevación más alta de `color.*`) en vez de `fondo` —
  // tienen que leerse como una card flotando ENCIMA, no como una pantalla propia.
  informe: { superficie: 'superficieAlta', radio: 40, bordeCompleto: true, ancladoAbajo: false },
  menu: { superficie: 'superficieAlta', radio: 20, bordeCompleto: true, ancladoAbajo: false },
};

export interface CristalVidrioProps extends PropsWithChildren {
  nivel?: NivelCristal;
  /** Estilo del contenedor EXTERNO (posición/tamaño). El radio y el recorte los pone el primitivo. */
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function CristalVidrio({ nivel = 'conversacion', style, testID, children }: CristalVidrioProps) {
  const tema = useTema();
  const cfg = NIVELES[nivel];

  return (
    <View
      testID={testID}
      style={[styles.externo, sombraNivel(tema.glass.relieve.nivel4, cfg.ancladoAbajo), style]}
    >
      <View
        style={[
          styles.interno,
          {
            borderRadius: cfg.radio,
            borderColor: tema.glass.bd,
            backgroundColor: tema.color[cfg.superficie],
            // conversacion/grabacion/takeover: sólo top (la capa nace del borde inferior de la
            // pantalla); informe/menú: borde completo (flotan aislados).
            borderTopWidth: 1,
            borderLeftWidth: cfg.bordeCompleto ? 1 : 0,
            borderRightWidth: cfg.bordeCompleto ? 1 : 0,
            borderBottomWidth: cfg.bordeCompleto ? 1 : 0,
          },
        ]}
      >
        {/* `inset 0 1.5px 0 hi` — línea de luz superior. */}
        <View style={[styles.luzSuperior, { backgroundColor: tema.glass.hi }]} pointerEvents="none" />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  externo: { backgroundColor: 'transparent' },
  interno: { flex: 1, overflow: 'hidden' },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, opacity: 0.9 },
});
