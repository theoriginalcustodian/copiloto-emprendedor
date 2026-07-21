/**
 * Layout raíz — con sesión (F5).
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
import { Stack, usePathname } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

// Import por SIDE EFFECT y lo más arriba posible: registra `http` + `almacenTokens` ante
// `@copiloto/core`. Sin esto, cualquier llamada al backend sale sin transporte configurado. Es la
// única vez que se ejecuta en toda la app.
import '../src/adapters/plataforma';
import { PantallaLogin, SessionProvider, useSession } from '../src/modules/auth';
import { ThemeProvider, useTema } from '../src/theme/ThemeProvider';

function Splash() {
  const tema = useTema();
  return (
    <View testID="splash" style={[styles.splash, { backgroundColor: tema.color.fondo }]}>
      <ActivityIndicator color={tema.color.acento} />
    </View>
  );
}

/** Rutas alcanzables sin sesión. Hoy no hay ninguna: toda la app vive detrás del guard de sesión. */
const RUTAS_LIBRES: string[] = [];

/**
 * Decide qué se ve según el estado de sesión. Tres estados, no dos: mientras `AsyncStorage` resuelve
 * el token guardado el estado es `verificando`, y ahí NO se puede mostrar el login — quien ya tenía
 * sesión vería la pantalla de login parpadear en cada arranque antes de entrar.
 */
function Guard({ children }: { children: React.ReactNode }) {
  const { estado } = useSession();
  const ruta = usePathname();

  if (RUTAS_LIBRES.includes(ruta)) return <>{children}</>;
  if (estado === 'verificando') return <Splash />;
  if (estado === 'autenticado') return <>{children}</>;
  return <PantallaLogin />;
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
          {/* Las variantes de la Medición 1 se montan como capa dentro de `index.tsx`, sin router:
              la navegación NO es variable de ese experimento — el defecto que se investiga ocurre
              DURANTE el arrastre, no al cerrar. Hubo acá dos rutas (`spike-a`/`spike-b`) para
              comparar mecanismos de cierre; se eliminaron cuando el handoff de DocuMed refutó esa
              hipótesis. */}
          {fuentesListas ? (
            <SessionProvider>
              <Guard>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                </Stack>
              </Guard>
            </SessionProvider>
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
