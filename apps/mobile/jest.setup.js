// react-native-gesture-handler toca su modulo nativo (`_RNGestureHandlerModule.default.install`) al
// instalarse bajo jest-expo -- sin este setup oficial, CUALQUIER test cuyo arbol de imports toque
// gesture-handler (hoy: el shell, via el arbol que ahora incluye el panel de vidrio) revienta con
// "install is not a function". Es un hueco del ENTORNO de test, no del producto.
require('react-native-gesture-handler/jestSetup');

// reanimated 4 instala `react-native-worklets` (modulo nativo) AL IMPORTARSE -- sin mock, cualquier
// test cuyo arbol toque reanimated (hoy: `PanelDeslizable`, y todo lo que lo componga) revienta al
// require con "NativeWorklets install". El mock OFICIAL (`react-native-reanimated/mock`) NO sirve acá:
// su `src/mock.ts` re-importa el indice real de reanimated, que dispara el mismo install nativo. Este
// stub mínimo y SELF-CONTAINED provee exactamente la API que el codigo usa, sin tocar nativo. El
// comportamiento real del gesto/animacion se valida en el device (Fase 6) + lo valido el spike.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  // gesture-handler llama `Reanimated.default.createAnimatedComponent` al CARGAR `GestureDetector`.
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (Comp) => Comp },
    createAnimatedComponent: (Comp) => Comp,
    useSharedValue: (inicial) => ({ value: inicial }),
    useAnimatedStyle: () => ({}),
    // `EscritorioFunciones.tsx` (C6): el offset de scroll horizontal ya no pasa por `setState` -- va
    // directo a un `SharedValue` vía este handler. Bajo test no se dispara ningún scroll real (no hay
    // hilo de UI), así que basta con no reventar al invocarse: como los demás worklets de este mock,
    // la semántica animada real se valida en el device.
    useAnimatedScrollHandler: () => () => {},
    withTiming: (destino) => destino,
    withSpring: (destino) => destino,
    runOnJS: (fn) => fn,
    Extrapolation: { CLAMP: 'clamp' },
    interpolate: (x) => x,
    Easing: { bezier: () => () => 0, out: (fn) => fn, ease: () => 0 },
  };
});

// `react-native-worklets` instala su modulo nativo AL IMPORTARSE, igual que reanimated arriba --
// pero como paquete APARTE: el stub de `react-native-reanimated` de arriba no lo cubre porque ese
// mock nunca re-importa el indice real de worklets (por eso funciona). El hueco es que `BotonVoz.tsx`
// ahora importa `scheduleOnRN` DIRECTO desde `react-native-worklets` (no via reanimated) para
// despachar los callbacks del gesto al hilo JS -- sin este stub, ESE import ejecuta
// `NativeWorklets.native.ts` real y revienta con "Cannot read properties of undefined (reading
// 'loadUnpackers')". Mismo criterio que `runOnJS` arriba: en test no hay hilo UI real que cruzar, asi
// que ejecutar la funcion directo (sincronico) es equivalente para lo que los tests ejercitan (el
// gesto en si se valida en el device). Hueco del ENTORNO de test, no del producto.
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

// `GestureDetector` de gesture-handler consume, AL RENDERIZAR, ~10 internals de la integracion
// reanimated↔gesture-handler (`useEvent`/`useHandler`/`runOnUI`/`NativeEventsManager`/...), que el
// stub de reanimated de arriba no reproduce (y stubbearlos todos seria whack-a-mole fragil). En test
// no ejercitamos el gesto (se valida en el device + el spike), asi que `GestureDetector` es un
// passthrough: renderiza sus children sin cablear el gesto. El resto de gesture-handler
// (`GestureHandlerRootView`, `Gesture.Pan()`, ...) queda real via `requireActual`.
//
// 🔴 **`FlatList` (C6, virtualización de `ListaMensajes`) también se stubbea acá — y NO es opcional.**
// `VirtualizedList` (por dentro de `FlatList`) espera un `onLayout` real para saber cuánto contenido
// "llenar"; el test-renderer nunca se lo da, así que reprograma su fill-loop (`Batchinator`, timers
// reales) PARA SIEMPRE. Jest reutiliza el mismo proceso de worker para varios archivos de test: ese
// timer real sigue vivo después de que termina el archivo que montó el FlatList, y dispara
// `setState` fuera de cualquier `act()` en el PRÓXIMO archivo que corre en ese worker — se vio así:
// `PantallaSoporte.test.tsx` colgado (timeout 5s) sólo dentro de la suite completa, verde 9/9 en
// aislamiento. El stub reproduce el contrato observable que los tests ejercitan (`data`/`renderItem`/
// `keyExtractor`/`ListEmptyComponent`/`testID`/`ref.scrollToEnd`) con un `.map()` liso, sin
// virtualización real y sin un solo timer — el comportamiento de scroll/virtualización real se valida
// en el device. Hueco del ENTORNO de test, no del producto.
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  const React = require('react');
  const { View } = require('react-native');

  const FlatList = React.forwardRef(function FlatList(props, ref) {
    const { data, renderItem, keyExtractor, ListEmptyComponent, testID, contentContainerStyle } = props;
    React.useImperativeHandle(ref, () => ({ scrollToEnd: () => {} }), []);

    if (!data || data.length === 0) {
      const vacio = React.isValidElement(ListEmptyComponent)
        ? ListEmptyComponent
        : typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : null;
      return React.createElement(View, { testID, style: contentContainerStyle }, vacio);
    }

    return React.createElement(
      View,
      { testID, style: contentContainerStyle },
      data.map((item, index) =>
        React.createElement(
          View,
          { key: keyExtractor ? keyExtractor(item, index) : String(index) },
          renderItem({ item, index }),
        ),
      ),
    );
  });

  return {
    ...actual,
    GestureDetector: ({ children }) => children,
    FlatList,
  };
});

// El pulso infinito del boton de voz (`Animated.loop(...).start()` en `BotonVoz.tsx`) sigue
// programando updates para SIEMPRE. Durante el settle async de un render de arbol completo
// (`shell.test.tsx` via `renderRouter`), ese loop churnea el reconciler y vuelve el test FLAKY
// (pasa/falla segun timing) ademas de ensuciar con warnings de `act`. Ningun test asserta el loop
// (BotonVoz.test prueba el press-and-hold; Onda.test prueba funciones puras), asi que lo volvemos
// INERTE en el entorno de test. La animacion real del pulso se valida en el device. Es un hueco del
// ENTORNO de test, no del producto.
const { Animated: AnimatedCore } = require('react-native');
AnimatedCore.loop = () => ({ start: () => {}, stop: () => {}, reset: () => {} });

// Mock oficial de la libreria (README de @react-native-async-storage/async-storage): sin esto,
// ThemeProvider (que lee la preferencia de skin al montar) llama a un modulo nativo que no existe
// bajo Jest. AlmacenClave degrada en silencio ante el error, pero el mock evita el ruido en consola
// y deja probar la persistencia real del skin en tests futuros.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// `expo-audio` toca su modulo nativo AL IMPORTARSE (no al usarse), y `jest-expo` no trae mock de
// fabrica para sus hooks -- a diferencia de `expo-file-system`, que si lo tiene. Sin esto, CUALQUIER
// archivo que lo importe (Reproductor, PanelCaptura, ChatView via useVozComando) revienta con
// "Cannot find native module 'ExpoAudio'" antes de correr una sola linea de test.
//
// Es un hueco del ENTORNO de test, no del producto: los tests que necesitan controlar el reproductor
// o el grabador declaran su propio `jest.mock('expo-audio', ...)` y este queda pisado. Este mock solo
// existe para que importar la libreria no sea, en si mismo, un error.
// `react-native-svg` renderiza 11 iconos glass (Svg/Defs/RadialGradient/Filter/FeGaussianBlur/...) en
// el escritorio de la Capa 0. Los componentes REALES son pesados y de backend nativo: en el render de
// arbol completo (`shell.test.tsx` via `renderRouter`) el arbol NO ALCANZA A ASENTARSE y el test
// flakea/falla ("render function has not been called"). Los mockeamos a Views que REENVIAN sus props
// (asi `GlassIcon.test` puede leer `viewBox`/`width`/`height`) -- render barato, sin backend nativo.
// El SVG real se ve en el device. Hueco del ENTORNO de test, no del producto.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const paso = (nombre) => {
    const Comp = ({ children, ...props }) => React.createElement(View, props, children);
    Comp.displayName = nombre;
    return Comp;
  };
  const Svg = paso('Svg');
  return {
    __esModule: true,
    default: Svg,
    Svg,
    Defs: paso('Defs'),
    G: paso('G'),
    Path: paso('Path'),
    Circle: paso('Circle'),
    Rect: paso('Rect'),
    Line: paso('Line'),
    ClipPath: paso('ClipPath'),
    LinearGradient: paso('LinearGradient'),
    RadialGradient: paso('RadialGradient'),
    Stop: paso('Stop'),
    Filter: paso('Filter'),
    FeGaussianBlur: paso('FeGaussianBlur'),
  };
});

// `react-native-safe-area-context`: `useSafeAreaInsets()` (que `PanelDeslizable` usa para caer debajo
// de la status bar) necesita los contextos de la librería, que React Navigation (bajo expo-router)
// TAMBIÉN consume internamente. El mock OFICIAL de la librería (`jest/mock`) hace `...requireActual`
// (preserva esos contextos, así RN Navigation no revienta con "undefined passed to use()") y sólo pisa
// los hooks para devolver insets 0 sin provider nativo. Un mock hecho a mano que no reexporte los
// contextos rompe el árbol de expo-router. El inset real del dispositivo se valida en el device.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-audio', () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false, duration: 0, currentTime: 0, isLoaded: true }),
  useAudioRecorder: () => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
    record: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    uri: null,
    isRecording: false,
  }),
  requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  RecordingPresets: { HIGH_QUALITY: {}, LOW_QUALITY: {} },
}));

// `expo-image-picker` toca su módulo nativo al importarse, igual que `expo-audio` arriba -- sin esto
// CUALQUIER archivo que lo importe (`useCapturaFoto`, ChatView) revienta con "Cannot find native
// module" antes de correr un test. Cancelado por default (`assets: null`): los tests que necesitan
// una foto elegida declaran su propio `jest.mock('expo-image-picker', ...)`, que pisa este. Hueco del
// ENTORNO de test, no del producto.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: null }),
}));

// `useFonts` de `@expo-google-fonts/*` (que `app/_layout.tsx` usa para cargar Space Grotesk +
// JetBrains Mono) hace un `setState` ASÍNCRONO al terminar la carga (`setLoaded`), fuera de `act()`.
// En jest eso ensucia la consola con "environment not configured to support act(...)" y, peor,
// introduce una actualización async no determinista que hace FLAKEAR cualquier test que monte el
// layout raíz. Mockeamos `useFonts` para que devuelva `[true]` SÍNCRONO (fuentes "ya cargadas"): el
// layout renderiza contenido de una, sin update async. Las constantes de fuente son sólo claves de
// `fontFamily`; en test su valor real no importa. Hueco del ENTORNO de test, no del producto.
jest.mock('@expo-google-fonts/space-grotesk', () => ({
  useFonts: () => [true, null],
  SpaceGrotesk_400Regular: 'SpaceGrotesk_400Regular',
  SpaceGrotesk_500Medium: 'SpaceGrotesk_500Medium',
  SpaceGrotesk_600SemiBold: 'SpaceGrotesk_600SemiBold',
  SpaceGrotesk_700Bold: 'SpaceGrotesk_700Bold',
}));
jest.mock('@expo-google-fonts/jetbrains-mono', () => ({
  JetBrainsMono_400Regular: 'JetBrainsMono_400Regular',
  JetBrainsMono_500Medium: 'JetBrainsMono_500Medium',
}));

/**
 * `expo-router`: `useFocusEffect` necesita un contenedor de navegación real, y los tests del shell
 * montan `PantallaPrincipal` SUELTA, fuera del árbol de rutas.
 *
 * 🔴 El mock **ejecuta el callback**, no lo ignora. Un `() => {}` haría pasar los tests sin ejercitar
 * `reabrirNavegacion()` — que es justamente lo que este hook existe para correr: sin él la puerta de
 * `empujarUnaVez` queda cerrada para siempre después del primer glass y NINGÚN tile vuelve a abrir
 * nada. Un gate que no ejercita lo que dice cubrir es peor que no tenerlo: da verde igual cuando el
 * fix se rompe.
 *
 * Se preserva el resto del módulo con `requireActual` — `router`, `useLocalSearchParams` y demás los
 * usan otras pantallas, y pisarlos acá las rompería. Clonado de `documed-front/apps/mobile/jest.setup.js`.
 */
jest.mock('expo-router', () => {
  const real = jest.requireActual('expo-router');
  const { useEffect } = require('react');
  return { ...real, useFocusEffect: (cb) => useEffect(cb, [cb]) };
});
