import { useAudioPlayer, type AudioSource } from 'expo-audio';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRONUNCIACION_MARCA } from '@copiloto/core';

import { pressableStyle } from '../../theme/glass/presion';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import { IdentidadEntrada } from '../splash/IdentidadEntrada';

const LOCKUP_SIMBOLO = 54;
const ALTO_BOTON = 54;

export interface RevealEntradaProps {
  /** Etiquetas de las dos puertas (`TEXTOS_REVEAL`): el mismo reveal aterriza distinto según la sesión. */
  primario: string;
  secundario: string;
  onPrimario: () => void;
  onSecundario: () => void;
  testID?: string;
  /**
   * BL-X10 — asset empaquetado de la pronunciación («se dice o-DO-bi» en voz de marca). NO hay
   * ningún audio en el repo todavía (pedido a operador/Martín, `[ASSUMED_PENDING_VERIFY]`): sin
   * asset, el botón no se renderiza — sólo queda el texto, como hasta ahora. A diferencia de web
   * (BL-X12w, `speechSynthesis`), acá NO hay TTS de fallback: la voz de marca es un asset, no una
   * síntesis genérica.
   */
  pronunciacionAsset?: AudioSource | null;
}

/**
 * El reveal de la entrada (prototipo `#reveal`, `?ver=reveal|volver`): el lockup entero —el primer
 * momento donde la marca se presenta completa—, «se dice o-DO-bi» y dos puertas. **Es el MISMO motor**
 * para el primer ingreso y para el post-logout (`TEXTOS_REVEAL`): no se duplica el markup. BL-X10 le
 * suma la animación de entrada (`IdentidadEntrada`) sobre este componente; no hay un segundo splash.
 */
export function RevealEntrada({
  primario,
  secundario,
  onPrimario,
  onSecundario,
  testID = 'reveal-entrada',
  pronunciacionAsset,
}: RevealEntradaProps) {
  const tema = useTema();
  const reproductor = useAudioPlayer(pronunciacionAsset ?? null);

  function pronunciar() {
    reproductor.seekTo(0);
    reproductor.play();
  }

  return (
    <View testID={testID} style={[styles.raiz, { backgroundColor: tema.color.fondo, padding: tema.espacio.lg }]}>
      <View style={styles.medio}>
        <IdentidadEntrada>
          <View style={[styles.lockup, { gap: Math.round(LOCKUP_SIMBOLO * 0.3) }]}>
            <Marca size={LOCKUP_SIMBOLO} />
            <Text style={{ color: tema.color.acentoTinta, fontSize: 40, fontFamily: tema.fuente.display, fontWeight: '800', letterSpacing: -0.5 }}>
              Odobi
            </Text>
          </View>
        </IdentidadEntrada>
        <View style={styles.pronunciacion}>
          <Text testID={`${testID}-pronunciacion`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            {PRONUNCIACION_MARCA}
          </Text>
          {pronunciacionAsset != null && (
            <Pressable
              testID={`${testID}-pronunciar`}
              accessibilityRole="button"
              accessibilityLabel="Escuchar cómo se pronuncia Odobi"
              onPress={pronunciar}
              style={pressableStyle([styles.botonPronunciar, { backgroundColor: tema.color.acentoSuperficie }])}
            >
              <Text style={{ color: tema.color.acentoTexto, fontSize: 12 }}>▶</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ gap: tema.espacio.sm }}>
        <Pressable
          testID={`${testID}-primario`}
          accessibilityRole="button"
          accessibilityLabel={primario}
          onPress={onPrimario}
          style={pressableStyle([styles.boton, { backgroundColor: tema.color.acentoSuperficie, borderRadius: tema.radio.md, height: ALTO_BOTON }])}
        >
          <Text style={{ color: tema.color.acentoTexto, fontSize: tema.tipo.grande, fontWeight: '700' }}>{primario}</Text>
        </Pressable>
        <Pressable
          testID={`${testID}-secundario`}
          accessibilityRole="button"
          accessibilityLabel={secundario}
          onPress={onSecundario}
          style={pressableStyle([styles.boton, { height: ALTO_BOTON }])}
        >
          <Text style={{ color: tema.color.acentoTinta, fontSize: tema.tipo.grande, fontWeight: '600' }}>{secundario}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, justifyContent: 'space-between' },
  medio: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  lockup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pronunciacion: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botonPronunciar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  boton: { alignItems: 'center', justifyContent: 'center' },
});
