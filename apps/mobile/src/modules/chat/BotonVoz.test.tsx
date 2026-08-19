import { render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { Gesture, type FlatList } from 'react-native-gesture-handler';

// Jest (jest-expo) -- describe/it/expect/jest son globales, no se importan de vitest.

import { ECUALIZADOR_BARRAS } from '../../theme/glass/ecualizadorPalette';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { BotonVoz, UMBRAL_FIJAR_PX, type BotonVozProps } from './BotonVoz';

/**
 * `GestureDetector` está mockeado GLOBALMENTE como passthrough en `jest.setup.js`, así que **el
 * cableado nativo** del gesto (arbitración contra el scroll, umbrales de activación, hilo de UI) NO
 * se puede ejercitar acá -- eso sigue siendo DoD de device.
 *
 * 🔴 **Lo que sí se puede, y desde 2026-08-19 se DEBE:** el mock hace `requireActual` de todo lo que
 * no sea `GestureDetector`/`FlatList`, así que `Gesture.Pan()` es el REAL. Al espiar `Gesture.Pan` se
 * obtiene el recognizer que el componente construyó, y `gesto.handlers` guarda los callbacks crudos
 * que registró (`onBegin`/`onUpdate`/`onFinalize`). Invocarlos en el orden en que RNGH los emite
 * ejercita **la lógica de decisión del gesto** -- que es exactamente donde vivía el bug de la fase
 * trabada (ver el docstring de `gesto` en `BotonVoz.tsx`). El device valida que RNGH emita ese orden;
 * estos tests validan que el componente REACCIONE bien a él, y cazan la regresión sin device --
 * que ya no habrá: el `SM-A217M` se fue el 2026-08-19.
 */
function ArnesConScrollRef(props: Partial<Omit<BotonVozProps, 'scrollRef'>>) {
  const scrollRef = useRef<FlatList>(null);
  return (
    <ThemeProvider>
      <BotonVoz
        onIniciar={jest.fn()}
        onSoltarSinFijar={jest.fn()}
        onFijar={jest.fn()}
        {...props}
        scrollRef={scrollRef}
      />
    </ThemeProvider>
  );
}

async function montar(props: Partial<Omit<BotonVozProps, 'scrollRef'>> = {}) {
  await render(<ArnesConScrollRef {...props} />);
}

/** Los callbacks crudos que el componente registró en el recognizer (`BaseGesture.handlers`, RNGH
 *  v2.32 `handlers/gestures/gesture.ts:182-225`). No es API pública de RNGH, pero es estable y es la
 *  ÚNICA forma de ejercitar la decisión del gesto con `GestureDetector` mockeado a passthrough. */
interface HandlersDelGesto {
  onBegin?: (evento: unknown) => void;
  onUpdate?: (evento: { translationY: number }) => void;
  onFinalize?: (evento: unknown, exito: boolean) => void;
}

/**
 * Monta y devuelve el recognizer que el componente construyó, más los espías de los constructores
 * que el fix del 2026-08-19 eliminó -- para poder afirmar por AUSENCIA, no sólo por presencia.
 */
async function montarCapturandoElGesto(props: Partial<Omit<BotonVozProps, 'scrollRef'>> = {}) {
  const espiaPan = jest.spyOn(Gesture, 'Pan');
  const espiaLongPress = jest.spyOn(Gesture, 'LongPress');
  const espiaSimultaneous = jest.spyOn(Gesture, 'Simultaneous');

  await montar(props);

  expect(espiaPan).toHaveBeenCalledTimes(1);
  const recognizer = espiaPan.mock.results[0].value as { handlers: HandlersDelGesto };
  return { handlers: recognizer.handlers, espiaLongPress, espiaSimultaneous };
}

/**
 * El orden en que RNGH emite los callbacks de UN Pan: `onBegin` (dedo baja) -> N x `onUpdate`
 * (dedo se mueve) -> `onFinalize` (dedo se levanta; RNGH garantiza el par con `onBegin`).
 *
 * Sin `act()` a propósito: los tres callbacks del componente sólo invocan las props (acá `jest.fn()`),
 * no disparan un solo `setState` -- el estado de "ya fijé" vive en un `ref`, y el que sí re-renderiza
 * (`fijado`) es del padre. Envolver esto en el `act` de RNTL fue un error propio: ese `act` devuelve
 * un thenable, llamarlo sin `await` deja el scope abierto y **rompe todo render posterior del
 * archivo** (se vio así: este describe verde en su primer test y 14 fallos en cascada después).
 */
function gestoCompleto(handlers: HandlersDelGesto, desplazamientosY: number[]) {
  handlers.onBegin?.({});
  desplazamientosY.forEach((translationY) => handlers.onUpdate?.({ translationY }));
  handlers.onFinalize?.({}, true);
}

describe('BotonVoz -- 🔴 regresión: deslizar-para-fijar NO puede enviar (bug de device 2026-08-19)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cruzar el umbral fija y NO envía -- `fijar()` corre ANTES de `soltar()`, no al revés', async () => {
    const onIniciar = jest.fn();
    const onFijar = jest.fn();
    const onSoltarSinFijar = jest.fn();
    const { handlers } = await montarCapturandoElGesto({ onIniciar, onFijar, onSoltarSinFijar });

    // `translationY` NEGATIVO = el dedo subió. Cruza el umbral por 1px: prueba la relación con la
    // constante real, no un número mágico que quedaría verde aunque el umbral cambiara.
    gestoCompleto(handlers, [-(UMBRAL_FIJAR_PX + 1)]);

    expect(onIniciar).toHaveBeenCalledTimes(1);
    expect(onFijar).toHaveBeenCalledTimes(1);
    // 🔴 ESTE es el bug que se está protegiendo. Con `Gesture.Simultaneous(LongPress, Pan)` esto
    // valía 1: el LongPress se cancelaba solo con el dedo todavía apoyado, su `.onEnd()` disparaba
    // igual (ignoraba el flag `success`) y `soltar()` enviaba ANTES de que el Pan cruzara el umbral
    // -- dejando los controles flotantes sobre una grabación ya cortada (fase 'listo' trabada).
    expect(onSoltarSinFijar).not.toHaveBeenCalled();
  });

  it('quedarse por DEBAJO del umbral envía directo y no fija (el camino que el fix no podía romper)', async () => {
    const onFijar = jest.fn();
    const onSoltarSinFijar = jest.fn();
    const { handlers } = await montarCapturandoElGesto({ onFijar, onSoltarSinFijar });

    gestoCompleto(handlers, [-(UMBRAL_FIJAR_PX - 1)]);

    expect(onFijar).not.toHaveBeenCalled();
    expect(onSoltarSinFijar).toHaveBeenCalledTimes(1);
  });

  it('apretar y soltar SIN moverse envía -- por eso son `onBegin`/`onFinalize` y no `onStart`/`onEnd`', async () => {
    const onIniciar = jest.fn();
    const onSoltarSinFijar = jest.fn();
    const { handlers } = await montarCapturandoElGesto({ onIniciar, onSoltarSinFijar });

    // Sin un solo `onUpdate`: el Pan nunca ACTIVA, así que `onStart`/`onEnd` no dispararían nunca y
    // el toque simple quedaría muerto. `onBegin`/`onFinalize` sí disparan.
    gestoCompleto(handlers, []);

    expect(onIniciar).toHaveBeenCalledTimes(1);
    expect(onSoltarSinFijar).toHaveBeenCalledTimes(1);
  });

  it('deslizar hacia ABAJO no fija por más que supere el umbral en magnitud', async () => {
    const onFijar = jest.fn();
    const onSoltarSinFijar = jest.fn();
    const { handlers } = await montarCapturandoElGesto({ onFijar, onSoltarSinFijar });

    gestoCompleto(handlers, [UMBRAL_FIJAR_PX + 200]); // positivo = hacia abajo

    expect(onFijar).not.toHaveBeenCalled();
    expect(onSoltarSinFijar).toHaveBeenCalledTimes(1);
  });

  it('seguir deslizando después de fijar no reavisa -- `onFijar` es idempotente por cruce', async () => {
    const onFijar = jest.fn();
    const { handlers } = await montarCapturandoElGesto({ onFijar });

    // RNGH emite `onUpdate` en cada frame mientras el dedo se mueve: decenas de eventos por encima
    // del umbral en un deslizamiento real.
    gestoCompleto(handlers, [-(UMBRAL_FIJAR_PX + 1), -(UMBRAL_FIJAR_PX + 40), -(UMBRAL_FIJAR_PX + 90)]);

    expect(onFijar).toHaveBeenCalledTimes(1);
  });

  it('`disabled` frena un SEGUNDO arranque desde dentro de `comenzar()`, sin apagar el gesto', async () => {
    const onIniciar = jest.fn();
    const { handlers } = await montarCapturandoElGesto({ onIniciar, disabled: true });

    gestoCompleto(handlers, []);

    // La guarda es síncrona (`disabledRef`), NO `.enabled(false)` ni una dependencia del `useMemo`:
    // apagar el gesto en el instante en que arranca la captura fue el bug de device del 2026-08-12.
    expect(onIniciar).not.toHaveBeenCalled();
  });

  it('🔴 el gesto es UNO SOLO: sin `Gesture.LongPress` ni `Gesture.Simultaneous`', async () => {
    const { espiaLongPress, espiaSimultaneous } = await montarCapturandoElGesto();

    // Dos recognizers componiendo el mismo ciclo tienen ciclos de vida independientes y se
    // desincronizan -- la causa raíz. `Pressable` de documed y este Pan comparten el invariante:
    // empezar, medir y soltar son el MISMO gesto.
    expect(espiaLongPress).not.toHaveBeenCalled();
    expect(espiaSimultaneous).not.toHaveBeenCalled();
  });
});

describe('BotonVoz -- hold-graba/soltar-envía/deslizar-fija (cableado nativo verificado en device)', () => {
  it('monta sin reventar con el gesto armado contra un scrollRef real', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.getByTestId('boton-voz-nucleo')).toBeTruthy();
  });

  it('deshabilitado (ya hay una captura en curso) lo marca en accessibilityState', async () => {
    await montar({ disabled: true });
    expect(screen.getByTestId('boton-voz').props.accessibilityState?.disabled).toBe(true);
  });

  it('sin `disabled`, accessibilityState no marca deshabilitado', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('🔴 ya NO tiene `onPress` -- el gesto entero es hold/deslizar/soltar, sin toque simple', async () => {
    await montar();
    // Un `Pressable`/`onPress` plano ya no es la interacción: `GestureDetector` (mockeado a
    // passthrough) es lo único que envuelve el núcleo. Si alguien reintrodujera un `onPress` suelto,
    // este test lo cazaría por la ausencia de la prop en el tipo (`BotonVozProps` ya no la declara,
    // ver el error de tsc que este archivo dejó de tener tras el contrato de reescritura).
    expect(screen.getByTestId('boton-voz').props.onPress).toBeUndefined();
  });
});

describe('BotonVoz -- isotipo ODOBI (ODOBI8 §A, reemplaza el micrófono heredado)', () => {
  it('renderiza los 4 trazos del isotipo, con el stroke-width compensado por logoScale (34/24)', async () => {
    await montar();
    // `react-native-svg` está mockeado a Views que REENVIAN sus props (ver `jest.setup.js`), así que
    // `d`/`strokeWidth` quedan legibles tal cual se los pasamos -- mismo patrón que `GlassIcon.test`.
    const trazo1 = screen.getByTestId('boton-voz-isotipo-trazo-1');
    const trazo2 = screen.getByTestId('boton-voz-isotipo-trazo-2');
    const trazo3 = screen.getByTestId('boton-voz-isotipo-trazo-3');
    const trazo4 = screen.getByTestId('boton-voz-isotipo-trazo-4');

    expect(trazo1.props.d).toBe('M11 3.5a8.5 8.5 0 1 0 0 17');
    expect(trazo2.props.d).toBe('M11 7.5a4.5 4.5 0 1 0 0 9');
    expect(trazo3.props.d).toBe('M16.5 8.8a4.8 4.8 0 0 1 0 6.4');
    expect(trazo4.props.d).toBe('M19.5 6.5a9 9 0 0 1 0 11');

    // 1.7 (stroke-width base del mock, viewBox 24) / (34/24) = 1.2 -- si alguien cambia el tamaño del
    // botón (34) o el viewBox (24) sin actualizar el otro, este número se mueve y el test lo caza.
    expect(trazo1.props.strokeWidth).toBeCloseTo(1.2);
  });

  it('deshabilitado atenúa el isotipo igual que atenuaba el micrófono (opacity 0.45)', async () => {
    await montar({ disabled: true });
    expect(screen.getByTestId('boton-voz-isotipo').props.opacity).toBe(0.45);
  });

  it('sin `disabled`, el isotipo va a opacidad plena', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz-isotipo').props.opacity).toBe(1);
  });
});

describe('BotonVoz -- ecualizador estático (ODOBI8 §B, decorativo, sin reactividad a audio real)', () => {
  it('renderiza exactamente las 7 barras del contrato, con las alturas/colores de ecualizadorPalette', async () => {
    await montar();
    expect(ECUALIZADOR_BARRAS).toHaveLength(7);

    ECUALIZADOR_BARRAS.forEach((barra, indice) => {
      const nodo = screen.getByTestId(`boton-voz-ecualizador-barra-${indice}`);
      const estilo = Array.isArray(nodo.props.style) ? Object.assign({}, ...nodo.props.style) : nodo.props.style;
      expect(estilo.height).toBe(barra.altura);
      expect(estilo.backgroundColor).toBe(barra.color);
    });
  });

  it('es puramente decorativo -- no compite con el gesto del botón que tiene debajo', async () => {
    await montar();
    expect(screen.getByTestId('boton-voz-ecualizador').props.pointerEvents).toBe('none');
  });
});
