import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { LOGOS_PROVEEDOR } from '../apps/logosMarca';
import { PORTADA } from '../../theme/identidadPalette';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/** Alto de los botones de entrada: el mismo de «Entrar» (`ALTO_BOTON` de `PantallaLogin`). */
export const ALTO_BOTON_ENTRADA = 54;
const TAMANO_LOGO = 20;
/** Martin 12/11: el label de 20 «gritaba». 17 = el cuerpo de iOS; con Jakarta Bold alcanza. */
const TAMANO_LABEL = 17;

export type Proveedor = 'apple' | 'google' | 'mail';

export interface BotonProveedorProps {
  proveedor: Proveedor;
  etiqueta: string;
  onPress: () => void;
  cargando?: boolean;
  testID?: string;
}

/**
 * Botón «Continuar con…» de la portada de entrada (`PantallaMetodo`, fondo terracota fijo — `PORTADA`).
 *
 * - **Apple**: negro tostado con texto crema — el estilo «black» de la HIG de Sign in with Apple.
 * - **Google**: papel crema con la «G» de cuatro colores (Google Identity).
 * - **Mail**: sólo trazo de tinta, el de menos peso: va último.
 *
 * Los íconos van FIJOS al borde izquierdo y el texto centrado en el botón (patrón Tinder): como los
 * labels tienen largos distintos, así los tres íconos forman una columna y la pila se lee ordenada.
 */
export function BotonProveedor({ proveedor, etiqueta, onPress, cargando = false, testID }: BotonProveedorProps) {
  const tema = useTema();
  const colores =
    proveedor === 'apple'
      ? { fondo: PORTADA.tinta, texto: PORTADA.sobreTinta, borde: PORTADA.tinta }
      : proveedor === 'google'
        ? { fondo: PORTADA.papel, texto: PORTADA.tinta, borde: PORTADA.papel }
        : { fondo: 'transparent', texto: PORTADA.tinta, borde: PORTADA.tinta };
  const logo = LOGOS_PROVEEDOR[proveedor];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      disabled={cargando}
      onPress={onPress}
      style={pressableStyle([
        styles.boton,
        {
          backgroundColor: colores.fondo,
          borderColor: colores.borde,
          borderRadius: tema.radio.completo,
          height: ALTO_BOTON_ENTRADA,
          opacity: cargando ? 0.7 : 1,
        },
      ])}
    >
      {cargando ? (
        <ActivityIndicator color={colores.texto} />
      ) : (
        <>
          <View style={styles.icono}>
            <SvgXml testID={`${testID ?? proveedor}-logo`} xml={logo.xml} width={TAMANO_LOGO} height={TAMANO_LOGO} color={colores.texto} />
          </View>
          <Text style={{ color: colores.texto, fontSize: TAMANO_LABEL, fontFamily: tema.fuente.display, letterSpacing: -0.2 }}>{etiqueta}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, paddingHorizontal: 56 },
  icono: { position: 'absolute', left: 24, top: 0, bottom: 0, justifyContent: 'center' },
});
