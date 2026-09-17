/**
 * `BloqueCifra` — **LA cifra del negocio en esta pantalla**, y sólo eso.
 *
 * 🔴 **Una por pantalla, nunca dos.** La regla es de `odobi-ui/CLAUDE.md` §5, en mayúsculas:
 * *«EL BLOQUE NEGRO SIGNIFICA "UNA CIFRA DE TU NEGOCIO", y sólo eso»*. Cuando se usó también para
 * otras cosas dejó de significar nada. Si una pantalla necesita un segundo destacado, ese segundo
 * NO es un bloque: es una card, una fila o un rótulo.
 *
 * **De dónde sale.** La renovación del 19/08 (gramática de Monzo) nació de un diagnóstico medido:
 * el fondo de Monzo nunca es blanco y sus cards sí, por eso no necesitan borde; nuestro inverso
 * —lienzo claro con cards claras— obligaba a un borde de 1 px alrededor de todo, y eso era lo
 * «insulso». **El golpe de color diario no lo da la terracota: lo da este bloque.** De hecho el
 * acento quedó reducido a señal (≤10%) justamente porque el contraste lo aporta esta superficie.
 *
 * 🔴 **No es «negro»: es máximo contraste contra el lienzo.** Los tokens `bloque`/`bloqueTexto`
 * invierten con la piel (negro tostado + crema en la clara; crema + negro tostado en la oscura).
 * Implementarlo con un negro fijo deja la piel oscura ilegible.
 *
 * ⚠️ **La jerarquía secundaria de adentro va en ARENA (`bloqueApoyo`), no en terracota.** El acento
 * #DE7250 sobre el negro tostado no separa lo suficiente; la arena sobre negro tostado da 8.46:1.
 * Ésa es la razón por la que la arena existe en la paleta.
 *
 * ⚠️ **Sin borde.** El relieve lo da la elevación 0 4px 18px negro tostado al 7% del sistema, no
 * una línea — la renovación del 19/08 retiró los bordes de 1 px de todas las superficies.
 */
import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTema } from './ThemeProvider';

export interface BloqueCifraProps extends PropsWithChildren {
  /** El rótulo de arriba: qué es la cifra («Gastado en agosto», «Saldo en caja»). */
  rotulo: string;
  /** La cifra, ya formateada. Va a `tipo.cifra` (40) y en la familia display. */
  cifra: string;
  /** Chip opcional bajo la cifra: el contexto que la vuelve legible («Al 19 de agosto»,
   *  «Mes anterior: $148.500», «−18% vs julio»). */
  chip?: string;
  /** Contenido extra dentro del bloque — el desglose, el par Entró/Salió. */
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

export function BloqueCifra({ rotulo, cifra, chip, children, style, testID }: BloqueCifraProps) {
  const tema = useTema();

  return (
    <View
      testID={testID}
      style={[
        styles.raiz,
        {
          backgroundColor: tema.color.bloque,
          borderRadius: tema.radio.lg,
        },
        elevacion(tema.color.sombra),
        style,
      ]}
    >
      <Text
        testID={testID ? `${testID}-rotulo` : undefined}
        style={{ color: tema.color.bloqueApoyo, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico }}
      >
        {rotulo}
      </Text>

      <Text
        testID={testID ? `${testID}-cifra` : undefined}
        style={[styles.cifra, { color: tema.color.bloqueTexto, fontFamily: tema.fuente.display, fontSize: tema.tipo.cifra }]}
      >
        {cifra}
      </Text>

      {chip != null && (
        <View style={[styles.chip, { backgroundColor: tema.color.bloqueChip, borderRadius: tema.radio.completo }]}>
          <Text
            testID={testID ? `${testID}-chip` : undefined}
            style={{ color: tema.color.bloqueApoyo, fontFamily: tema.fuente.ui, fontSize: tema.tipo.chico }}
          >
            {chip}
          </Text>
        </View>
      )}

      {children != null && <View style={styles.cuerpo}>{children}</View>}
    </View>
  );
}

/* La elevación del sistema (§5): 0 4px 18px negro tostado al 7%. En Android `elevation` no acepta
   color ni radio, así que se aproxima con el valor que da una sombra equivalente — es la misma
   limitación que ya documenta `relieve.ts`. */
const elevacion = (sombra: string) =>
  Platform.select({
    ios: {
      shadowColor: sombra,
      shadowOpacity: 0.07,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 6 },
  });

const styles = StyleSheet.create({
  raiz: { padding: 26, paddingBottom: 22, gap: 6 },
  cifra: { lineHeight: 44, letterSpacing: -0.8 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, marginTop: 4 },
  cuerpo: { marginTop: 16, gap: 12 },
});
