/**
 * `FilaBotones` — los CTA de un formulario, en píldoras de vidrio plano.
 *
 * 🔴 **Por qué NO usan `EnvolturaCampo`.** `EnvolturaCampo` es la superficie de un INPUT (gradiente
 * s1→s2, vidrio para que se escriba encima). Un botón de acción no se escribe: el color ES la
 * semántica (primario = acento, peligro = destructivo) y un gradiente encima la apagaría. El molde acá
 * es `HudGrabacion` (`modules/captura/HudGrabacion.tsx`, `BotonDescartar`/`BotonGhost`): `View` con
 * `backgroundColor`/`borderColor` planos, sin `LinearGradient`. `primario` toma `glass.chip` (el mismo
 * fondo translúcido de la píldora de enviar del `Composer`) + borde `color.acento`; `peligro` toma
 * `color.peligroFondo`/`peligroBorde`, igual que `BotonDescartar`.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { useTema } from '../../ThemeProvider';
import { pressableStyle } from '../presion';
import type { Tokens } from '../../tokens';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro';

export interface BotonFila {
  etiqueta: string;
  onPress: () => void;
  variante?: VarianteBoton;
  deshabilitado?: boolean;
  testID?: string;
}

export interface FilaBotonesProps {
  botones: BotonFila[];
  /**
   * Botones al ANCHO DE SU TEXTO en vez de repartirse la fila.
   *
   * 🔴 Existe por un defecto visto en device el 2026-07-21: en "Mis comprobantes" cada fila lleva los
   * datos del comprobante a la izquierda y un botón "Anular" a la derecha, y con el `flexGrow: 1` del
   * default el botón se estiraba y **expulsaba los textos de la fila** — quedaba un "Anular" flotando
   * solo, sin decir sobre QUÉ comprobante actuaba. Un botón destructivo sin sujeto es peligroso, no
   * feo.
   *
   * El default sigue siendo estirado porque es lo correcto para una fila de acciones a ancho completo
   * (el gate HITL del resumen, los pasos del formulario), que es el uso mayoritario.
   */
  compacto?: boolean;
  testID?: string;
}

function coloresDeVariante(variante: VarianteBoton, tema: Tokens): { fondo: string; borde: string; texto: string } {
  switch (variante) {
    case 'primario':
      return { fondo: tema.glass.chip, borde: tema.color.acento, texto: tema.color.acento };
    case 'peligro':
      return { fondo: tema.color.peligroFondo, borde: tema.color.peligroBorde, texto: tema.color.peligro };
    case 'secundario':
    default:
      return { fondo: tema.color.superficieAlta, borde: tema.color.borde, texto: tema.color.texto };
  }
}

export function FilaBotones({ botones, compacto = false, testID = 'fila-botones' }: FilaBotonesProps) {
  const tema = useTema();
  return (
    <View style={[styles.fila, compacto && styles.filaCompacta]} testID={testID}>
      {botones.map((boton, indice) => {
        const variante = boton.variante ?? 'secundario';
        const id = boton.testID ?? `${testID}-boton-${indice}`;
        const colores = coloresDeVariante(variante, tema);
        const deshabilitado = boton.deshabilitado === true;
        return (
          <Pressable
            key={id}
            testID={id}
            accessibilityRole="button"
            accessibilityState={{ disabled: deshabilitado }}
            disabled={deshabilitado}
            // Guard explícito además de `disabled`: el `Pressable` de gesture-handler respeta
            // `disabled` en device, pero un guard propio deja la garantía verificable en el TEST
            // (el runner de jsdom/jest-expo no ejercita el responder nativo -- ver `presion.test.tsx`
            // línea 13, mismo motivo por el que ese test es de fuente y no de render).
            onPress={() => {
              if (deshabilitado) return;
              boton.onPress();
            }}
            style={pressableStyle([
              styles.boton,
              compacto && styles.botonCompacto,
              { backgroundColor: colores.fondo, borderColor: colores.borde },
              deshabilitado && styles.apagado,
            ])}
          >
            <Text style={{ color: colores.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
              {boton.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // `flexShrink: 1` en la fila compacta: dentro de una fila horizontal con texto, el botón cede
  // ancho al texto en vez de empujarlo fuera.
  filaCompacta: { flexShrink: 1, flexWrap: 'nowrap' },
  botonCompacto: { flexGrow: 0, paddingHorizontal: 14 },
  boton: {
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  // Mismo criterio que `apagado` en `HudGrabacion`: un control deshabilitado tiene que LEERSE
  // deshabilitado, si no el usuario concluye que la app se colgó en vez de que el paso no aplica.
  apagado: { opacity: 0.5 },
});
