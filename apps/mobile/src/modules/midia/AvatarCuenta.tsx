/**
 * `AvatarCuenta` — **la única puerta a Ajustes** (Ola 4, `odobi-ui/CLAUDE.md` §Modelo de capas).
 *
 * 🔴 **Ajustes salió del escritorio y no se reemplazó por otro tile: se entra por acá.** Es el patrón
 * de Gmail/YouTube, y el motivo por el que el sistema lo eligió es que el escritorio nombra **lugares
 * donde está tu información** — Ajustes no es información del negocio, es la app hablando de sí misma.
 *
 * ⚠️ **Y por eso el avatar carga una responsabilidad que un adorno no tendría: es el ÚNICO camino.**
 * El sistema lo compensa con salvaguardas explícitas (§Decisión A): el **punto de estado** de este
 * avatar, la conexión caída como tarjeta en Mi día, y el consentimiento just-in-time al ejecutar. Si
 * alguna vez se saca el punto, se saca media salvaguarda — no es decoración.
 *
 * El punto entra por `avisa`: Mi día lo enciende cuando el catálogo trae ≥ 1 servicio `caido`
 * (K-09 / BL-J4). Si el catálogo no responde queda apagado: un punto que avisa de algo que no se
 * sabe es peor que ninguno.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

export interface AvatarCuentaProps {
  /** Qué se dibuja adentro: la inicial del negocio. Vacío o ausente → el signo neutro. */
  inicial?: string;
  /** Hay algo que mirar en Ajustes (una conexión caída, por ejemplo). Ver el docstring. */
  avisa?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function AvatarCuenta({ inicial, avisa = false, onPress, testID = 'avatar-cuenta' }: AvatarCuentaProps) {
  const tema = useTema();
  const letra = (inicial ?? '').trim().slice(0, 1).toUpperCase();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      // El nombre dice a dónde lleva, no qué es: "avatar" no es un destino. Con el punto encendido
      // el estado viaja en el mismo nombre, que es lo único que lee un lector de pantalla.
      accessibilityLabel={avisa ? 'Tu cuenta y ajustes — hay algo para mirar' : 'Tu cuenta y ajustes'}
      onPress={onPress}
      style={pressableStyle(styles.zona)}
    >
      <View style={[styles.circulo, { backgroundColor: tema.color.superficieAlta, borderColor: tema.color.borde }]}>
        <Text
          style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
          testID={`${testID}-inicial`}
        >
          {letra !== '' ? letra : '·'}
        </Text>
      </View>
      {avisa && (
        <View
          testID={`${testID}-punto`}
          style={[styles.punto, { backgroundColor: tema.color.acento, borderColor: tema.color.fondo }]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 44×44 de área tocable aunque el círculo mida 36: es el piso de target de WCAG 2.5.8, y acá pesa
  // más que en cualquier otro control porque no hay una segunda forma de llegar a Ajustes.
  zona: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  circulo: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  punto: { position: 'absolute', top: 4, right: 4, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
