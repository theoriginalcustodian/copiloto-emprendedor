import { Text } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/** Feedback de BL-D2: el dedo ya pasó el umbral a la izquierda; soltar descarta la grabación. */
export function AvisoCancelar() {
  const tema = useTema();
  return (
    <Text
      testID="voz-cancelar-aviso"
      accessibilityLiveRegion="polite"
      style={{ color: tema.color.peligro, fontSize: tema.tipo.base, fontWeight: '700', textAlign: 'center' }}
    >
      Soltá para cancelar
    </Text>
  );
}
