import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../theme/glass/presion';
import { SKINS, type NombreSkin, type Tokens } from '../../theme/tokens';
import { useSkin, useTema } from '../../theme/ThemeProvider';
import { ETIQUETA_SKIN, ORDEN_SKINS } from './skinsCatalogo';

/**
 * Qué colores de la paleta cruda de cada skin se muestran como "muestra" en su card. ODOBI usa un
 * solo acento en las 3 pieles (§1 del DoD) -- lo que las distingue es el LIENZO, no el acento --
 * por eso se siguen mostrando los 4: `fondo`/`superficieAlta` son los que realmente varían entre
 * `claro`/`oscuro`/`nocturno`, `acento`/`accent2` confirman visualmente que el acento es el mismo.
 */
function muestrasDe(paleta: Tokens): string[] {
  return [paleta.color.acento, paleta.glass.accent2, paleta.color.fondo, paleta.color.superficieAlta];
}

interface SkinCardProps {
  nombre: NombreSkin;
  activo: boolean;
  onPress: () => void;
  /** El tema ACTIVO (no el de esta card) -- sólo para geometría/tipografía compartida del shell
   * (radios, espacios, fuente). Nunca para pintar la muestra de color: ver docstring del módulo. */
  temaActivo: Tokens;
}

/**
 * Una card por skin, pintada con SUS PROPIOS tokens (`SKINS[nombre]`) y no con `useTema()` -- ese es
 * el punto entero de esta pantalla: *"el usuario tiene que ver el tema antes de elegirlo"*. Si esta
 * card usara el tema activo, las 5 cards se verían idénticas salvo la que ya está elegida.
 */
function SkinCard({ nombre, activo, onPress, temaActivo }: SkinCardProps) {
  const paleta = SKINS[nombre];
  const muestras = muestrasDe(paleta);

  return (
    <Pressable
      testID={`skin-card-${nombre}`}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={ETIQUETA_SKIN[nombre]}
      onPress={onPress}
      // Escala: la card tiene caja propia (fondo, borde, radio) y elegir un skin es la acción más
      // "física" de esta pantalla. Opacidad quedaba descartada de entrada -- atenuar una card cuyo
      // punto ENTERO es mostrar sus colores reales falsearía justamente lo que se está eligiendo.
      style={pressableStyle([
        styles.card,
        {
          backgroundColor: paleta.color.fondo,
          // El anillo de selección usa el acento del tema ACTIVO -- pero cuando `activo` es true,
          // `nombre === skin` por construcción (ver `PantallaSkins`), así que ese acento YA ES el
          // acento propio de esta paleta. No hay caso en que el anillo "no coincida" con la card.
          borderColor: activo ? temaActivo.color.acento : paleta.color.borde,
          borderWidth: activo ? 2 : 1,
          borderRadius: temaActivo.radio.lg,
          padding: temaActivo.espacio.md,
          gap: temaActivo.espacio.sm,
        },
      ])}
    >
      <View style={styles.encabezadoCard}>
        <Text
          style={{ color: paleta.color.texto, fontSize: temaActivo.tipo.base, fontFamily: temaActivo.fuente.uiSemibold }}
        >
          {ETIQUETA_SKIN[nombre]}
        </Text>
        {activo && (
          <Text
            testID={`skin-card-${nombre}-activo`}
            style={{ color: paleta.color.acento, fontSize: temaActivo.tipo.chico, fontFamily: temaActivo.fuente.uiSemibold }}
          >
            ✓ Activo
          </Text>
        )}
      </View>

      {/* La muestra real: 4 chips tomados de la paleta CRUDA de este skin -- nunca del tema activo. */}
      <View style={[styles.muestras, { gap: temaActivo.espacio.xs }]}>
        {muestras.map((color, i) => (
          <View
            key={i}
            testID={`skin-card-${nombre}-muestra-${i}`}
            style={[styles.chip, { backgroundColor: color, borderColor: paleta.color.borde }]}
          />
        ))}
      </View>
    </Pressable>
  );
}

/**
 * Pantalla Skins -- los 5 temas viven en su propia pantalla, una card por skin CON LA MUESTRA DE SUS
 * COLORES REALES (no un nombre en una lista). Se llega desde el tile "Skins" del grid de Ajustes
 * (`PantallaAjustes.tsx`).
 *
 * La selección/persistencia/aplicación instantánea sale de `useSkin()` (`ThemeProvider.tsx`) -- este
 * componente sólo es la VISTA, no la lógica.
 */
export function PantallaSkins() {
  const tema = useTema();
  const [skin, setSkin] = useSkin();

  return (
    // Mismo ícono que el tile de entrada en el grid de Ajustes ('apariencia') -- entrar por un ícono
    // y llegar a otro desorienta.
    <MarcoGlass titulo="Skins" icono="apariencia" testID="pantalla-skins">
      <ScrollView
      // 🔴 `flex:1` en el ScrollView MISMO, no sólo en su contenedor. Un ScrollView sin flex se
      // mide por su CONTENIDO: aunque el padre esté acotado, el hijo se estira más allá y lo
      // que sobra se recorta (overflow:hidden del vidrio) sin poder desplazarse. Verificado en
      // device: la lista de integraciones quedaba cortada en MercadoPago y el gesto no hacía nada.
      style={styles.scroll}
        contentContainerStyle={[styles.contenedor, { padding: tema.espacio.md, gap: tema.espacio.md }]}
      >
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Elegí el skin de la app. Se aplica al instante y queda guardado para la próxima sesión.
        </Text>
        {ORDEN_SKINS.map((nombre) => (
          <SkinCard
            key={nombre}
            nombre={nombre}
            activo={nombre === skin}
            onPress={() => setSkin(nombre)}
            temaActivo={tema}
          />
        ))}
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contenedor: { gap: 16 },
  card: { borderWidth: 1 },
  encabezadoCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muestras: { flexDirection: 'row' },
  chip: { width: 32, height: 32, borderRadius: 8, borderWidth: 1 },
});
