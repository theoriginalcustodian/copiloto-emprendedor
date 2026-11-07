import { ActivityIndicator, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

export interface AvisoDictadoProps {
  ocupado: boolean;
  aviso: string | null;
  /** Prefijo de los testID: `${testID}-ocupado` / `${testID}-aviso`. */
  testID: string;
}

/**
 * Estado visible del dictado por chat. Dos cosas, y las dos tienen que verse:
 *
 *  - **esperando**: la card tarda segundos; sin esto el usuario suelta el mic y no pasa nada;
 *  - **degradado**: si cayó a la precarga cruda, lo DICE. Un degradado silencioso hacia el caso benigno
 *    es lo que haría pasar por «funciona» un camino que no está extrayendo nada.
 *
 * Se monta ARRIBA del listado/formulario (mismo criterio que `errorFoto` en `PantallaGastos`): cuando cae
 * al texto crudo la pantalla abre el formulario, y un aviso dentro del listado no se vería.
 */
export function AvisoDictado({ ocupado, aviso, testID }: AvisoDictadoProps) {
  const tema = useTema();
  if (ocupado) {
    return (
      <View testID={`${testID}-ocupado`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ActivityIndicator color={tema.color.acento} />
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Entendiendo lo que dijiste…</Text>
      </View>
    );
  }
  if (aviso !== null) {
    return (
      <Text testID={`${testID}-aviso`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
        {aviso}
      </Text>
    );
  }
  return null;
}
