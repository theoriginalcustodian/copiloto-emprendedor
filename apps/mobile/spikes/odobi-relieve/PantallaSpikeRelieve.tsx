/**
 * ODOBI hito 0 — spike DESECHABLE del relieve cálido. Se borra al cerrar el contrato.
 *
 * Vive fuera de `src/` a propósito: usa hex crudo (los valores exactos del diseño), y `src/` está
 * bajo el guard `temaSinHex.test.ts` que lo prohíbe. Acá no aplica — es una pantalla de comparación
 * visual, no producto.
 *
 * Qué se está probando (contrato `2026-08-05_contrato_planificacion-a-todos_ODOBI-hito0-spike-relieve.md`):
 * Odobi apoya el relieve en sombras CÁLIDAS (marrón), no negras. En Android la sombra la pinta el
 * sistema vía `elevation`, y `shadowColor` no siempre se respeta. Si el tono cálido no se reproduce,
 * el relieve sale gris y se cae la identidad. La card 6 es el CONTROL (shadowColor:'#000'): si 1 y 6
 * se ven iguales en la captura, shadowColor se está ignorando.
 *
 * Reutiliza el patrón de `apps/mobile/src/theme/glass/CristalVidrio.tsx`:
 *   - RN no tiene `inset` → se simula con una View absoluta de 1-2px en el canto superior
 *     (`CristalVidrio.tsx:183`, `luzSuperior`).
 *   - La sombra proyectada usa el mismo shape `{shadowOffset, shadowRadius, shadowOpacity, elevation}`
 *     (`CristalVidrio.tsx:55-118`).
 *   - No hay `BlurView`: nunca desenfocó en Android (`CristalVidrio.tsx:8`), no se trae de vuelta.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

const LIENZO = '#EFE1C2';
const SUPERFICIE = '#F5EBD5';
const BORDE = 'rgba(255,252,244,0.7)';
const TEXTO = '#2E2A20';
const TEXTO_ACENTO = '#FBF3E2';

interface Sombra {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowRadius: number;
  shadowOpacity: number;
  elevation: number;
}

// Traducción de `box-shadow: offsetX offsetY blur spread color` del diseño (§2 del contrato) al
// shape de RN. RN no tiene `spread`; se absorbe aproximando shadowRadius/elevation. La card 5 (foco)
// es un anillo (`0 0 0 6px`), no una sombra proyectada — se resuelve con `borderWidth`, no con este shape.
const SOMBRA_REPOSO: Sombra = {
  // rgba(110,75,44,.3) — `0 10px 26px -12px`
  shadowColor: '#6E4B2C',
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 26,
  shadowOpacity: 0.3,
  elevation: 14,
};

const SOMBRA_CHICA: Sombra = {
  // rgba(70,50,30,.32) — `0 3px 8px`
  shadowColor: '#46321E',
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 8,
  shadowOpacity: 0.32,
  elevation: 6,
};

const SOMBRA_ACENTO: Sombra = {
  // rgba(126,36,23,.5) — `0 10px 26px -6px`
  shadowColor: '#7E2417',
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 26,
  shadowOpacity: 0.5,
  elevation: 16,
};

const SOMBRA_FLOTANTE: Sombra = {
  // rgba(110,75,44,.4) — `0 30px 60px -20px`
  shadowColor: '#6E4B2C',
  shadowOffset: { width: 0, height: 30 },
  shadowRadius: 60,
  shadowOpacity: 0.4,
  elevation: 24,
};

// Card 6 CONTROL — mismo shape que la card 1, sólo cambia shadowColor. Es la única diferencia
// permitida: si el marrón no se ve en Android, 1 y 6 colapsan a lo mismo y esa es la falla que se
// está buscando.
const SOMBRA_CONTROL: Sombra = { ...SOMBRA_REPOSO, shadowColor: '#000000' };

function LuzSuperior({ opacidad }: { opacidad: number }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.luzSuperior, { backgroundColor: `rgba(255,255,255,${opacidad})` }]}
    />
  );
}

function Etiqueta({ texto, color = TEXTO }: { texto: string; color?: string }) {
  return <Text style={[styles.etiqueta, { color }]}>{texto}</Text>;
}

export default function PantallaSpikeRelieve() {
  return (
    <ScrollView style={styles.lienzo} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>ODOBI — spike de relieve (hito 0)</Text>
      <Text style={styles.subtitulo}>
        Comparar 1 vs 6 en la captura: si se ven iguales, shadowColor se ignora en este device.
      </Text>

      {/* 1 — Superficie en reposo */}
      <View style={[styles.card, SOMBRA_REPOSO, { borderRadius: 16 }]}>
        <View style={[styles.interno, { borderRadius: 16 }]}>
          <LuzSuperior opacidad={0.7} />
          <Etiqueta texto="1 · Superficie en reposo" />
        </View>
      </View>

      {/* 2 — Elemento chico (píldora) */}
      <View style={[styles.card, styles.cardChica, SOMBRA_CHICA, { borderRadius: 999 }]}>
        <View style={[styles.interno, { borderRadius: 999 }]}>
          <LuzSuperior opacidad={0.35} />
          <Etiqueta texto="2 · Elemento chico" />
        </View>
      </View>

      {/* 3 — Acento elevado (fondo degradé cálido) */}
      <View style={[styles.card, SOMBRA_ACENTO, { borderRadius: 16, borderWidth: 0 }]}>
        <LinearGradient
          colors={['#C2452E', '#7E2417']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.interno, { borderRadius: 16 }]}
        >
          <LuzSuperior opacidad={0.35} />
          <Etiqueta texto="3 · Acento elevado" color={TEXTO_ACENTO} />
        </LinearGradient>
      </View>

      {/* 4 — Flotante (sin inset, sólo proyección grande) */}
      <View style={[styles.card, SOMBRA_FLOTANTE, { borderRadius: 16 }]}>
        <View style={[styles.interno, { borderRadius: 16 }]}>
          <Etiqueta texto="4 · Flotante" />
        </View>
      </View>

      {/* 5 — Foco / grabando: anillo, no sombra proyectada */}
      <View style={[styles.card, styles.cardAnillo, { borderRadius: 16 }]}>
        <View style={[styles.interno, { borderRadius: 16 }]}>
          <Etiqueta texto="5 · Foco / grabando" />
        </View>
      </View>

      {/* 6 — CONTROL: card 1 con shadowColor '#000' */}
      <View style={[styles.card, SOMBRA_CONTROL, { borderRadius: 16 }]}>
        <View style={[styles.interno, { borderRadius: 16 }]}>
          <LuzSuperior opacidad={0.7} />
          <Etiqueta texto="6 · CONTROL (shadowColor #000)" />
        </View>
      </View>
    </ScrollView>
  );
}

const cardBase: ViewStyle = {
  backgroundColor: 'transparent',
  marginBottom: 28,
  minHeight: 88,
};

const styles = StyleSheet.create({
  lienzo: { flex: 1, backgroundColor: LIENZO },
  contenido: { padding: 24, paddingBottom: 64 },
  titulo: { fontSize: 18, fontWeight: '700', color: TEXTO, marginBottom: 4 },
  subtitulo: { fontSize: 13, color: TEXTO, opacity: 0.7, marginBottom: 24 },
  card: cardBase,
  cardChica: { minHeight: 48, width: 160 },
  cardAnillo: {
    ...cardBase,
    borderWidth: 6,
    borderColor: 'rgba(194,69,46,0.16)',
  },
  interno: {
    flex: 1,
    minHeight: 88,
    overflow: 'hidden',
    backgroundColor: SUPERFICIE,
    borderColor: BORDE,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  luzSuperior: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
  },
  etiqueta: { fontSize: 14, fontWeight: '600' },
});
