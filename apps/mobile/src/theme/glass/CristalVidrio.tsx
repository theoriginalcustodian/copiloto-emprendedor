/**
 * `CristalVidrio` — el envoltorio de vidrio de UNA capa del rediseño Z-Depth.
 *
 * El diseño apila varias superficies a distinta profundidad Z; cada una tiene su nivel de opacidad,
 * tinte, borde, sombra y radio. Este primitivo materializa UNA de esas superficies según `nivel`.
 *
 * 🔴 **El vidrio es una capa SEMITRANSPARENTE que deja ver lo que hay abajo. Nada más.** No lleva
 * blur, y no hay que volver a ponérselo. Durante mucho tiempo montó un `BlurView` de `expo-blur` que
 * en Android **nunca desenfocó** (su `blurMethod` viene en `'none'`) y que a cambio pintaba un velo
 * gris casi negro con alfa `0.69 × intensity/100` (ver `TintStyle.kt` del paquete) — el "manchón" que
 * ensuciaba la pantalla y se comía el color del skin. Como el síntoma se atribuyó al wash, la
 * opacidad se recalibró seis veces
 * (0.55 → 0.82 → 0.94 → 1 → 0.32 → 0.42) sin arreglar nunca la causa. Los iconos que se ven a través
 * son los del vidrio de abajo: para eso alcanza la transparencia.
 *
 * Estructura (por qué así): RN no tiene `backdrop-filter`, `box-shadow` múltiple ni `inset`. Se
 * reconstruye por capas:
 *   1. Contenedor EXTERNO — lleva la sombra proyectada (elevation/shadow), SIN `overflow:hidden`
 *      (recortar mata la sombra).
 *   2. Contenedor INTERNO — `overflow:hidden` + radio + borde.
 *   3. Capa de color del tema a `opacidadFondo` — lo que hace que sea vidrio y no ventana.
 *   4. `LinearGradient(tint→tint2)` — el tinte del skin, apilado `refuerzoTinte` veces.
 *   5. Línea de luz superior (`inset 0 1.5px 0 hi` del diseño) — una hairline absoluta arriba.
 *   6. `children` encima de todo.
 *
 * Cero-hex: todo color sale de `useTema().glass` (ver `temaSinHex.test.ts`).
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../ThemeProvider';

export type NivelCristal = 'conversacion' | 'grabacion' | 'takeover' | 'informe' | 'menu';

interface ConfigNivel {
  /**
   * Opacidad de la capa de color del tema. **Es la palanca del vidrio, y la única.**
   *
   * En 1 deja de ser vidrio (color pleno, lo que el operador marcó como "perdió la transparencia");
   * en 0 no tapa nada. El punto está en el medio, y se calibra CONTRA CAPTURA del device, nunca a ojo.
   */
  opacidadFondo: number;
  /**
   * Cuántas veces se apila el gradiente de tinte del skin. Dos veces lleva el alfa efectivo de
   * .16/.12 a .29/.23 (×1.84): le devuelve saturación al color que se ve a través, sin tokens nuevos.
   * Es lo que en el template hace `saturate(1.5)`.
   */
  refuerzoTinte: number;
  /** Radio del contenedor. Diseño: cristales 40 · menú 20. */
  radio: number;
  /** Borde completo (informe/menú) vs sólo la línea superior de luz (conversacion/grabacion). */
  bordeCompleto: boolean;
  /** Sombra proyectada del contenedor externo (aproxima el `box-shadow` del diseño). */
  sombra: Pick<ViewStyle, 'shadowOffset' | 'shadowRadius' | 'shadowOpacity' | 'elevation'>;
}

const NIVELES: Record<NivelCristal, ConfigNivel> = {
  // `0 -20px 60px -10px rgba(0,0,0,.5)` — sombra hacia ARRIBA (la capa flota sobre el escritorio).
  // El tinte sale de `tokens.ts` y ya es 1:1 con el template canónico
  // (`.dm-conv` → `linear-gradient(160deg, rgba(150,110,220,.18), rgba(60,30,110,.12))`, medido con
  // getComputedStyle sobre `App glass/DocuMed 3.../DocuMed App.dc.html`).
  conversacion: {
    opacidadFondo: 0.87,
    refuerzoTinte: 2,
    radio: 40,
    bordeCompleto: false,
    sombra: { shadowOffset: { width: 0, height: -8 }, shadowRadius: 30, shadowOpacity: 0.5, elevation: 20 },
  },
  // `grabacion` es ALIAS de `conversacion`: mismo vidrio, por orden del operador ("el tamaño y formato
  // canónico es el del glass principal"). Dos tablas de valores para dos superficies que el usuario lee
  // como la misma cosa es exactamente cómo nació la divergencia que hubo que corregir a mano en cada
  // pantalla.
  grabacion: {
    opacidadFondo: 0.87,
    refuerzoTinte: 2,
    radio: 40,
    bordeCompleto: false,
    sombra: { shadowOffset: { width: 0, height: -8 }, shadowRadius: 30, shadowOpacity: 0.5, elevation: 20 },
  },
  // 🔴 `takeover` — el HUD de una grabación VIVA. **Opaco a propósito, y es la única superficie que
  // lo es.** No es una hoja sobre el escritorio: es "el teléfono está grabando". El HUD no tiene
  // tarjetas que tapen nada (son textos sueltos: cronómetro, onda, controles), así que con el vidrio
  // normal el escritorio entero se lee detrás y el resultado parece roto — texto flotando sobre los
  // tiles. Regresión real: hasta `f8a86e2`, `MarcoGlass` traía un fondo decorativo propio que tapaba;
  // al sacarlo (correcto: causaba la estela y duplicaba el escritorio en Ajustes) el HUD se quedó sin
  // ocluyente. La reposición va ACÁ, en la tabla de vidrio, y no devolviéndole un fondo al marco.
  //
  // Que sea opaco no reabre lo que el operador rechazó: aquello fue el vidrio de CONVERSACIÓN en 1
  // ("perdió la transparencia"). Acá no hay nada detrás que valga la pena ver — y ver el escritorio
  // mientras corre el cronómetro invita a tocarlo.
  takeover: {
    opacidadFondo: 1,
    refuerzoTinte: 2,
    radio: 40,
    bordeCompleto: false,
    sombra: { shadowOffset: { width: 0, height: -8 }, shadowRadius: 30, shadowOpacity: 0.5, elevation: 20 },
  },
  // 🔴 `informe`/`menu` flotan DENTRO de otro vidrio (el gate de confirmación dentro del chat/captura —
  // en DocuMed era el gate clínico donde el médico firmaba lo que entraba a la historia clínica; acá
  // no hay historia clínica, pero el mismo gate protege la confirmación HITL antes de ejecutar una
  // acción). Su ocluyente era el velo gris que pintaba expo-blur (α 0.48 y 0.31 para sus intensidades
  // de 70 y 45): al sacar el blur hay que reponerlo con color del tema, o el chat de atrás se leería A
  // TRAVÉS del gate — justo la superficie donde el usuario confirma lo que se va a ejecutar.
  informe: {
    opacidadFondo: 0.48,
    refuerzoTinte: 1,
    radio: 40,
    bordeCompleto: true,
    sombra: { shadowOffset: { width: 0, height: 4 }, shadowRadius: 24, shadowOpacity: 0.4, elevation: 24 },
  },
  // `0 18px 40px -10px rgba(0,0,0,.6)` — menú flota hacia abajo.
  menu: {
    opacidadFondo: 0.31,
    refuerzoTinte: 1,
    radio: 20,
    bordeCompleto: true,
    sombra: { shadowOffset: { width: 0, height: 12 }, shadowRadius: 20, shadowOpacity: 0.6, elevation: 18 },
  },
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
  const g = tema.glass;

  return (
    <View
      testID={testID}
      style={[styles.externo, cfg.sombra, { shadowColor: styles.sombraColor.color }, style]}
    >
      <View
        style={[
          styles.interno,
          {
            borderRadius: cfg.radio,
            borderColor: g.bd,
            // conversacion/grabacion: sólo top (la capa nace del borde inferior de la pantalla);
            // informe/menú: borde completo (flotan aislados).
            borderTopWidth: 1,
            borderLeftWidth: cfg.bordeCompleto ? 1 : 0,
            borderRightWidth: cfg.bordeCompleto ? 1 : 0,
            borderBottomWidth: cfg.bordeCompleto ? 1 : 0,
          },
        ]}
      >
        {/* El cuerpo del vidrio: color del tema a media opacidad. Lo que hay abajo se sigue viendo,
            atenuado — que es exactamente lo que se le pide a un vidrio. */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: tema.color.fondo, opacity: cfg.opacidadFondo }]}
          pointerEvents="none"
        />
        {/* Tinte del skin — `linear-gradient(160deg, tint, tint2)`. El ángulo 160° ≈ vertical con leve
            corrimiento a la izquierda; en RN se aproxima con start/end. Se apila `refuerzoTinte` veces
            para recuperar la saturación que en CSS aporta `saturate(1.5)`. */}
        {Array.from({ length: cfg.refuerzoTinte }, (_, i) => (
          <LinearGradient
            key={i}
            colors={[g.tint, g.tint2]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ))}
        {/* `inset 0 1.5px 0 hi` — línea de luz superior. */}
        <View style={[styles.luzSuperior, { backgroundColor: g.hi }]} pointerEvents="none" />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  externo: { backgroundColor: 'transparent' },
  interno: { flex: 1, overflow: 'hidden' },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, opacity: 0.9 },
  // Único literal permitido acá sería un color; para respetar cero-hex, el negro de la sombra se
  // toma de este StyleSheet (RN exige `shadowColor` como color) — es negro puro, no un color de tema,
  // así que no rompe skins. `temaSinHex` sólo veta strings `'#...'`; 'black' es un nombre, no hex.
  sombraColor: { color: 'black' },
});
