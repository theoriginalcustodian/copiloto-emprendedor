import { Text } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * SM-K5 / SM-Z5: el «›» de las filas que abren otra pantalla (mapa `cuenta` y `ajustes`).
 * Decorativo: el rol lo da la fila.
 *
 * Vive en su propio archivo —y no en `PantallaCuenta`— porque esa pantalla importa `../auth`, que
 * arrastra el módulo nativo de Google Sign-In: importar el chevron desde ahí rompía la carga de
 * cualquier suite que sólo quería la lista de Ajustes.
 */
export function Chevron() {
  const tema = useTema();
  return (
    <Text accessibilityElementsHidden importantForAccessibility="no" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.grande }}>
      ›
    </Text>
  );
}
