/**
 * `EnvolturaCampo` — el vidrio de un campo de formulario, dibujado en UN solo lugar.
 *
 * Extraída letra por letra del campo de texto del `Composer` del chat
 * (`modules/chat/Composer.tsx:113-135`, molde señalado por el operador): `View` con borde+radio+
 * `overflow:hidden` → `LinearGradient` (`glass.s1`→`glass.s2`, diagonal `{0.2,0}→{0.8,1}`) en
 * `absoluteFill` → una `luzSuperior` de 1px (`glass.hi`, inset 16 a cada lado). Ese campo YA resuelve
 * el vidrio de un input; volver a declararlo por cada campo de facturación habría sido exactamente lo
 * que el operador pidió evitar -- reinventar lo que ya existe (`CLAUDE.md` §3.ter).
 *
 * Todo campo de `campos/` pasa por acá -- incluido el chip de `CampoSelect`, que es la misma
 * superficie de vidrio en una caja más chica. Ninguno vuelve a declarar el `LinearGradient`.
 *
 * 🔴 **Base OPACA bajo el gradiente (decisión del operador, 2026-07-22 — "A: campos opacos").** El
 * gradiente `s1/s2` es blanco translúcido (α 0.04-0.14): sobre otra capa de vidrio lee como brillo,
 * pero cuando lo que hay detrás es el ESCRITORIO —toda función es un `transparentModal`, así que el
 * escritorio queda montado atrás— su texto se cuela **adentro del renglón donde se escribe**. Backend
 * lo midió en device: `ej.: Av. Mitre 1234os`, donde `os` era el final de «Presupuestos» del fondo.
 * No es estética: **un campo donde no se lee lo que se tipeó hace que se guarde un CUIT equivocado.**
 *
 * Por qué acá y sólo la superficie del input: el operador eligió A sobre "vidrio opaco en toda la
 * pantalla" (B). El `MarcoGlass` sigue traslúcido —el look de vidrio es orden suya—; lo único que deja
 * de transparentarse es **dónde se escribe**, que es exactamente donde el bleed importa. Al vivir en
 * `EnvolturaCampo`, vale para los ~40 campos de la app de una vez. La base es `superficieAlta` (hex
 * sólido, tema-aware) y NO el gradiente: el brillo translúcido se conserva encima, apilado sobre una
 * superficie que ahora tapa. En ambos temas, porque el token se deriva por tema.
 */
import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTema } from '../../ThemeProvider';

export interface EnvolturaCampoProps extends PropsWithChildren {
  /** Pinta el borde en `color.peligro` -- el mismo campo que trajo el `Faltante` del backend. */
  error?: boolean;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function EnvolturaCampo({ children, error = false, style, testID }: EnvolturaCampoProps) {
  const tema = useTema();
  return (
    <View
      testID={testID}
      style={[styles.campo, { borderColor: error ? tema.color.peligro : tema.color.borde }, style]}
    >
      {/* La base opaca. Va PRIMERA (debajo de todo): tapa lo que haya detrás de la pantalla, y el
          gradiente translúcido se apila encima conservando el brillo del vidrio. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tema.color.superficieAlta }]} pointerEvents="none" />
      <LinearGradient
        colors={[tema.glass.s1, tema.glass.s2]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.luzSuperior, { backgroundColor: tema.glass.hi }]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** Proporciones heredadas 1:1 del `Composer` -- no de los tokens de espaciado: gobiernan la FORMA del
 *  diseño de vidrio, no el color (eso sí sale de los tokens, regla cero-hex). */
const RADIO_CAMPO = 20;
const ALTO_MINIMO_CAMPO = 48;

const styles = StyleSheet.create({
  campo: {
    borderWidth: 1,
    borderRadius: RADIO_CAMPO,
    minHeight: ALTO_MINIMO_CAMPO,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  luzSuperior: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 },
});
