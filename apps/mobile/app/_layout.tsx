/**
 * Layout raíz — versión mínima del spike F2.
 *
 * A propósito NO trae sesión, guard de auth, ni providers de dominio: este arranque existe para
 * medir el repliegue del vidrio, y cada provider de más es ruido en el hilo JS que contamina
 * justo la variable que vamos a medir. El layout completo llega en F5.
 *
 * Lo que SÍ está, y por qué cada cosa (heredado de documed, donde cada una costó un bug):
 *   - `GestureHandlerRootView` en la raíz: sin él, el Pan del panel no recibe eventos en Android.
 *   - `SafeAreaProvider` con `initialMetrics`: sin `initialWindowMetrics` el primer render entrega
 *     insets en 0 y los reales llegan al segundo, así que el handle nace pegado a la status bar y
 *     un frame después baja — se ve como "dos golpes". Justo el tipo de artefacto visual que
 *     podría confundirse con el hitch que venimos a medir.
 *   - Fuentes antes de renderizar: pintar con la fuente del sistema y re-flowear al cargar la real
 *     es un salto visual que ensuciaría la medición.
 */
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTema } from '../src/theme/ThemeProvider';

function Splash() {
  const tema = useTema();
  return (
    <View testID="splash" style={[styles.splash, { backgroundColor: tema.color.fondo }]}>
      <ActivityIndicator color={tema.color.acento} />
    </View>
  );
}

export default function LayoutRaiz() {
  const [fuentesListas] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          {/* Una sola pantalla. Las variantes de la Medición 1 se montan como capa dentro de
              `index.tsx`, sin router: la navegación NO es variable de este experimento — el defecto
              que se investiga ocurre DURANTE el arrastre, no al cerrar. Hubo acá dos rutas
              (`spike-a`/`spike-b`) para comparar mecanismos de cierre; se eliminaron cuando el
              handoff de DocuMed refutó esa hipótesis. */}
          {fuentesListas ? (
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
            </Stack>
          ) : (
            <Splash />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
