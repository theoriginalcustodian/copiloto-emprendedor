import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTema } from '../../theme/ThemeProvider';
import { AvisoCancelar } from './AvisoCancelar';

/**
 * Las pistas del gesto de voz — lo que el prototipo ODOBI llama `rec-hint` («deslizá para cancelar ‹») y
 * `lock-col` (candado + flecha), `Prototipo frontend/odobi-ui/prototipo/index.html:2939-2950`, y que el
 * nativo no dibujaba: el usuario tenía que ADIVINAR que deslizando hacia arriba se fija y hacia la
 * izquierda se cancela (filas `bloqueado` y `grabando`, DEVICE15 / TRIAJE15).
 *
 * No es decoración: el deslizar-para-fijar es **la alternativa que exige WCAG 2.5.1** para un gesto que
 * obliga a sostener presión (`mockups/03-home-conversacional/DECISIONES.md:110`), y una alternativa que
 * nadie sabe que existe no cumple el criterio.
 *
 * Presentacional puro: lo comparten `ChatView` y `MicFuncion` (el mismo composer en contexto de
 * formulario), que son quienes saben `cancelando`/`cerca` por `BotonVoz`.
 */

// Los trazos de Phosphor (viewBox 256) que dibuja el prototipo (`ICO_VOZ.lock`/`.caret`/`.chev`).
const TRAZO_CANDADO =
  'M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96Zm112,152H48V96H208V208Z';
const TRAZO_FLECHA_ARRIBA =
  'M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z';
const TRAZO_CHEVRON_IZQ =
  'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z';

export interface PistasGestoVozProps {
  /** El dedo ya pasó el umbral a la izquierda: en vez de las pistas, el aviso «Soltá para cancelar». */
  cancelando: boolean;
  /** El dedo ya está cerca de fijar: el candado se tiñe antes de soltar (`BotonVoz.onCerca`). */
  cerca: boolean;
}

/**
 * Mientras se graba SIN fijar: «‹ Deslizá para cancelar» + la pista del candado. Al armar la
 * cancelación las reemplaza el `AvisoCancelar` (mismo lugar, misma fila).
 */
export function PistasGestoVoz({ cancelando, cerca }: PistasGestoVozProps) {
  const tema = useTema();
  if (cancelando) return <AvisoCancelar />;

  const colorIcono = cerca ? tema.color.acentoTexto : tema.color.texto;
  return (
    <View testID="voz-pistas" style={estilos.fila} pointerEvents="none">
      <View testID="voz-pista-cancelar" style={estilos.grupo}>
        <Svg width={13} height={13} viewBox="0 0 256 256" accessibilityElementsHidden>
          <Path d={TRAZO_CHEVRON_IZQ} fill={tema.color.textoTenue} />
        </Svg>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base - 2 }}>Deslizá para cancelar</Text>
      </View>
      <View
        testID="voz-pista-candado"
        accessible
        accessibilityLabel="Deslizá hacia arriba para fijar la grabación"
        style={[
          estilos.candado,
          {
            backgroundColor: cerca ? tema.glass.ub2 : tema.color.superficieAlta,
            borderRadius: tema.radio.completo,
          },
        ]}
      >
        <Svg width={17} height={17} viewBox="0 0 256 256">
          <Path d={TRAZO_CANDADO} fill={colorIcono} />
        </Svg>
        <Svg width={15} height={15} viewBox="0 0 256 256">
          <Path d={TRAZO_FLECHA_ARRIBA} fill={colorIcono} />
        </Svg>
      </View>
    </View>
  );
}

/**
 * «En pausa» en TEXTO, no sólo la onda quieta: el estado no puede depender únicamente de que algo
 * deje de moverse (WCAG 1.4.1) — `DECISIONES.md:109`, `index.html:2946`. Ocupa el lugar de la onda.
 */
export function EstadoEnPausa() {
  const tema = useTema();
  return (
    <Text
      testID="voz-en-pausa"
      accessibilityLiveRegion="polite"
      style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, fontWeight: '700', textAlign: 'center' }}
    >
      En pausa
    </Text>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  candado: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 },
});
