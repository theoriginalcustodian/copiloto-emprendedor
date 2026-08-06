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
import { LimiteDeError } from '../src/shell/LimiteDeError';
import { ThemeProvider, useTema } from '../src/theme/ThemeProvider';

/**
 * `<NavigationBar hidden />` de `expo-navigation-bar` — oculta la barra de botones de Android
 * (inmersivo), igual que la app canónica (`documed-front/apps/mobile/app/_layout.tsx`): la pantalla
 * única de vidrio no debe compartir el borde inferior con una franja opaca del sistema. El
 * componente es declarativo, se re-aplica solo en cada render, y en la era edge-to-edge el ocultado
 * trae el comportamiento transient-por-swipe del sistema — un swipe desde el borde la revela un
 * instante y se re-oculta sola, que es el auto-ocultado buscado.
 *
 * 🔴 **Se resuelve en runtime, no con un `import` directo, y eso NO es paranoia.** El módulo es
 * NATIVO: existe sólo si el APK instalado se compiló con él. El APK actual del device es anterior a
 * que `expo-navigation-bar` entrara al proyecto, así que el import estático tiraba
 * `ReferenceError: Property 'NavigationBar' doesn't exist` **durante el render del layout raíz** —
 * y con el layout raíz caído la app quedaba clavada en el splash, sin login ni chat. Un defecto
 * cosmético tumbando la app entera.
 *
 * Con esto, la barra se oculta en cuanto haya un build que traiga el módulo, y mientras tanto la app
 * funciona con la barra visible. Cuando se rehaga el APK, esto empieza a andar solo: nada que tocar.
 */
function BarraNavegacionOculta() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- ver el docstring: nativo opcional
    const mod = require('expo-navigation-bar');
    const Barra = mod?.NavigationBar;
    return Barra ? <Barra hidden /> : null;
  } catch {
    return null; // el APK no trae el módulo nativo todavía
  }
}

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
    // ODOBI hito 3 (DoD §2.6, "Display / marca") — asset LOCAL, no un paquete `@expo-google-fonts/*`
    // como las de arriba: el binario lo dejó el hito 3v (`assets/fonts/NeueEinstellung-Bold.otf`,
    // PR#264). `useFonts` de Expo admite mezclar ambos orígenes en una sola llamada.
    'NeueEinstellung-Bold': require('../assets/fonts/NeueEinstellung-Bold.otf'),
  });

  return (
    // `LimiteDeError` va POR FUERA de todo lo demás a propósito: si `ThemeProvider`, `SessionProvider`
    // o cualquier pantalla lanza en render, el árbol entero se desmonta y queda la pantalla negra.
    // Envolviéndolo desde afuera, el fallback sobrevive a la caída de cualquiera de esas capas.
    // Ojo: NO captura errores de handlers ni de código asíncrono (límite de React, no decisión).
    <LimiteDeError>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <BarraNavegacionOculta />
          <ThemeProvider>
          {fuentesListas ? (
            <SessionProvider>
              <Guard>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  {/* Las 6 funciones del escritorio, clonado 1:1 del array de `documed-front/apps/
                      mobile/app/_layout.tsx`: `transparentModal` + `slide_from_bottom` deja VISIBLE
                      la pantalla de atrás (el escritorio), y cada una trae su propio `MarcoGlass`
                      (vidrio + handle + título + "Volver"). Reemplaza a `CapaFuncion` — la capa
                      `absoluteFill` montada como sibling que este repo había inventado en su lugar,
                      y que en device se comía los toques (ningún tile respondía, el vidrio no se
                      arrastraba): ver `coordinacion/2026-07-20_handoff_fixes-gestos-glass-mobile.md`.
                      `contentStyle` transparente evita el fondo opaco nativo que taparía el vidrio. */}
                  {([
                    // Las 9 funciones del escritorio, en el orden de `TILES`.
                    'facturacion', 'ingresos', 'gastos', 'presupuestos', 'clientes',
                    'midia', 'inteligencia', 'contabilidad', 'ajustes',
                    // `apps` ya no es tile del escritorio —se llega desde Ajustes—, pero la pantalla
                    // es la misma y sigue siendo glass: sólo cambió desde dónde se entra.
                    'apps',
                    // ⚠️ `recientes` NO tiene tile desde el 2026-07-22 (su lista ya vive abajo del
                    // grid del escritorio), pero la pantalla se conserva porque aporta algo que esa
                    // lista no tiene: PAGINADO (`cargarMas`/`onEndReached`). Hoy queda inalcanzable
                    // y está reportado como tal — no se borró para no perder esa capacidad.
                    'recientes',
                    // Las sub-pantallas de Ajustes. Van con el MISMO tratamiento que las funciones
                    // del escritorio (transparentModal + slide desde abajo) porque son glass igual:
                    // se abren SOBRE Ajustes, que queda visible detrás.
                    'ajustes-afip', 'ajustes-skins', 'ajustes-cuenta',
                    'ajustes-mi-plan', 'ajustes-negocio',
                  ] as const).map(
                    (glass) => (
                      <Stack.Screen
                        key={glass}
                        name={glass}
                        options={{
                          headerShown: false,
                          presentation: 'transparentModal',
                          animation: 'slide_from_bottom',
                          contentStyle: { backgroundColor: 'transparent' },
                        }}
                      />
                    ),
                  )}
                </Stack>
              </Guard>
            </SessionProvider>
            ) : (
              <Splash />
            )}
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </LimiteDeError>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
