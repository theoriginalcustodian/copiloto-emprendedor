import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { pressableStyle } from '../../theme/glass/presion';
import { SKINS, type NombreSkin, type Tokens } from '../../theme/tokens';
import { usePreferenciaTema, useTema } from '../../theme/ThemeProvider';
import { ETIQUETA_OPCION, ORDEN_PREFERENCIAS } from './skinsCatalogo';

/**
 * Qué colores de la paleta cruda de cada skin se muestran como "muestra" en su card. ODOBI usa un
 * solo acento en las 3 pieles (§1 del DoD) -- lo que las distingue es el LIENZO, no el acento --
 * por eso se siguen mostrando los 4: `fondo`/`superficieAlta` son los que realmente varían entre
 * `claro`/`oscuro`, `acento`/`accent2` confirman visualmente que el acento es el mismo.
 */
function muestrasDe(paleta: Tokens): string[] {
  return [paleta.color.acento, paleta.glass.accent2, paleta.color.fondo, paleta.color.superficieAlta];
}

interface SkinCardProps {
  /** Sólo las pieles con paleta propia: «Como el teléfono» no es una piel, es una regla — va en su
   * propia fila (`FilaSistema`), como en el prototipo (`.lista-fila`, index.html:2406). */
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
      accessibilityLabel={ETIQUETA_OPCION[nombre]}
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
          {ETIQUETA_OPCION[nombre]}
        </Text>
        {activo && (
          <Text
            testID={`skin-card-${nombre}-activo`}
            style={{ color: paleta.color.acentoTinta, fontSize: temaActivo.tipo.chico, fontFamily: temaActivo.fuente.uiSemibold }}
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
 * «Como el teléfono»: no es una piel sino una REGLA (seguir al sistema), así que no lleva muestra de
 * color propia — es una fila con título y bajada, como `.lista-fila` del prototipo (index.html:2406).
 */
function FilaSistema({ activo, onPress, temaActivo }: Omit<SkinCardProps, 'nombre'>) {
  return (
    <Pressable
      testID="skin-card-sistema"
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={ETIQUETA_OPCION.sistema}
      onPress={onPress}
      style={pressableStyle([
        styles.filaSistema,
        {
          backgroundColor: temaActivo.color.superficie,
          borderColor: activo ? temaActivo.color.acento : temaActivo.color.borde,
          borderWidth: activo ? 2 : 1,
          borderRadius: temaActivo.radio.lg,
          padding: temaActivo.espacio.md,
        },
      ])}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: temaActivo.color.texto, fontSize: temaActivo.tipo.base, fontFamily: temaActivo.fuente.uiSemibold }}>
          {ETIQUETA_OPCION.sistema}
        </Text>
        <Text style={{ color: temaActivo.color.textoTenue, fontSize: temaActivo.tipo.chico }}>
          Cambia solo según tu sistema
        </Text>
      </View>
      {activo && (
        <Text
          testID="skin-card-sistema-activo"
          style={{ color: temaActivo.color.acentoTinta, fontSize: temaActivo.tipo.chico, fontFamily: temaActivo.fuente.uiSemibold }}
        >
          ✓ Activo
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Pantalla Apariencia (`apar`, index.html:2395) -- DOS pieles con la MUESTRA DE SUS COLORES REALES
 * (no un nombre en una lista) lado a lado, y «Como el teléfono» en su propia fila debajo. Se llega
 * desde el tile "Apariencia" del grid de Ajustes (`PantallaAjustes.tsx`).
 *
 * La selección/persistencia/aplicación instantánea sale de `usePreferenciaTema()`
 * (`ThemeProvider.tsx`) -- este componente sólo es la VISTA, no la lógica.
 *
 * ENMIENDA FUNDADA (mapeo `apar`, 2026-10-13): la muestra lleva 4 chips (fondo, superficie, acento,
 * acento2) y no los 2 puntos del prototipo (texto + terracota): el skin se elige mirando cómo
 * queda el lienzo, y `PantallaSkins.test` fija esos 4 como contrato de «ver antes de elegir».
 */
export function PantallaSkins() {
  const tema = useTema();
  const [preferencia, setPreferencia] = usePreferenciaTema();

  return (
    // Mismo ícono que el tile de entrada en el grid de Ajustes ('apariencia') -- entrar por un ícono
    // y llegar a otro desorienta. Título = «Apariencia», como el tile y el prototipo (antes «Skins»).
    <MarcoGlass titulo="Apariencia" icono="apariencia" testID="pantalla-skins">
      <ScrollView
      // 🔴 `flex:1` en el ScrollView MISMO, no sólo en su contenedor. Un ScrollView sin flex se
      // mide por su CONTENIDO: aunque el padre esté acotado, el hijo se estira más allá y lo
      // que sobra se recorta (overflow:hidden del vidrio) sin poder desplazarse. Verificado en
      // device: la lista de integraciones quedaba cortada en MercadoPago y el gesto no hacía nada.
      style={styles.scroll}
        contentContainerStyle={[styles.contenedor, { padding: tema.espacio.md, gap: tema.espacio.md }]}
      >
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Dos temas. Cambia el fondo y el texto; la marca, la tipografía y los componentes son los mismos.
        </Text>
        <Text
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiSemibold }}
        >
          Elegí el tema
        </Text>
        <View style={[styles.cardsFila, { gap: tema.espacio.md }]}>
          {ORDEN_PREFERENCIAS.filter((n): n is NombreSkin => n !== 'sistema').map((nombre) => (
            <View key={nombre} style={styles.cardColumna}>
              <SkinCard
                nombre={nombre}
                activo={nombre === preferencia}
                onPress={() => setPreferencia(nombre)}
                temaActivo={tema}
              />
            </View>
          ))}
        </View>
        <FilaSistema
          activo={preferencia === 'sistema'}
          onPress={() => setPreferencia('sistema')}
          temaActivo={tema}
        />
        <Text testID="skins-nota" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          El tema cambia el fondo y el texto. La terracota, la tipografía y los componentes son los mismos
          en los dos. Se aplica al instante y queda guardado para la próxima sesión.
        </Text>
      </ScrollView>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  contenedor: { gap: 16 },
  card: { borderWidth: 1 },
  cardsFila: { flexDirection: 'row' },
  cardColumna: { flex: 1 },
  filaSistema: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  encabezadoCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muestras: { flexDirection: 'row' },
  chip: { width: 32, height: 32, borderRadius: 8, borderWidth: 1 },
});
