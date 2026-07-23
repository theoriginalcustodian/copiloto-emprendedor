/**
 * **Movimiento reducido: se apaga lo que DECORA, se conserva lo que INFORMA.**
 *
 * El test que importa acá no es *«se apagan las animaciones»* —eso es fácil y no protege de nada—:
 * es el de la **línea**. Un barrido que apague todo lo que se mueve rompería la onda de audio, que es
 * la única respuesta a *«¿me está escuchando?»*, y dejaría el punto de grabación en su estado tenue,
 * que **significa «no estoy grabando»**. Las dos serían regresiones invisibles: nadie las ve salvo
 * quien tiene el ajuste puesto, que es justamente quien no puede reportarlas fácil.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { ScrollView } from 'react-native-gesture-handler';

import { BotonVoz } from '../modules/chat/BotonVoz';
import { ThemeProvider } from './ThemeProvider';

const leerAjuste = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');

async function envolver(nodo: React.ReactElement) {
  return render(<ThemeProvider>{nodo}</ThemeProvider>);
}

/** `BotonVoz` necesita un `scrollRef` real (para `simultaneousWithExternalGesture`) — este archivo
 *  no prueba el gesto (ver `BotonVoz.test.tsx`), sólo necesita un ref válido para montar. */
function botonVoz() {
  function Arnes() {
    const scrollRef = useRef<ScrollView>(null);
    return <BotonVoz onIniciar={() => {}} onSoltarSinFijar={() => {}} onFijar={() => {}} scrollRef={scrollRef} />;
  }
  return <Arnes />;
}

beforeEach(() => {
  jest.clearAllMocks();
  leerAjuste.mockResolvedValue(false);
});

describe('movimiento reducido', () => {
  it('🔴 se PREGUNTA por el ajuste — sin esto, el resto del archivo no prueba nada', async () => {
    // El control de que el cableado existe. Si nadie consulta el ajuste, los tests de abajo pasarían
    // igual con la app ignorándolo por completo.
    await envolver(botonVoz());

    await waitFor(() => expect(leerAjuste).toHaveBeenCalled());
  });

  it('el botón de voz SIGUE ESTANDO con el ajuste activo — se apaga el latido, no el control', async () => {
    // La regresión que este test frena: "apagar la animación" resuelto escondiendo el elemento.
    // Quien pide menos movimiento quiere una app quieta, no una app con menos botones.
    leerAjuste.mockResolvedValue(true);

    await envolver(botonVoz());

    await waitFor(() => expect(leerAjuste).toHaveBeenCalled());
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
    expect(screen.getByTestId('boton-voz-nucleo')).toBeTruthy();
    // Y conserva su nombre: apagar movimiento no puede costarle el nombre a un control.
    expect(
      screen.getByLabelText('Mantené apretado para grabar. Deslizá hacia arriba para fijar sin soltar.'),
    ).toBeTruthy();
  });

  it('🔴 si la lectura del ajuste FALLA, la app queda como es hoy', async () => {
    // La dirección del default está elegida: un fallo de lectura no puede apagarle las animaciones a
    // alguien que nunca las pidió apagar. El error se traga —no hay nada que el usuario pueda hacer—
    // pero no puede tumbar el render.
    leerAjuste.mockRejectedValue(new Error('sin soporte'));

    await envolver(botonVoz());

    await waitFor(() => expect(leerAjuste).toHaveBeenCalled());
    expect(screen.getByTestId('boton-voz')).toBeTruthy();
  });
});

describe('la línea: decora vs informa', () => {
  it('🔴 `Onda` NO consulta el ajuste — su movimiento ES el dato', async () => {
    // Control de FUENTE, no de render: la onda dibuja el nivel del micrófono a ~10 fps y montarla acá
    // pediría un grabador vivo. Lo que se fija es la decisión, que es lo que se puede perder en un
    // refactor: si alguien "completa" el barrido metiéndole el hook, este test lo frena y el
    // comentario le explica por qué. Sin la onda, quien no oye no tiene forma de saber si el
    // micrófono lo está tomando.
    const fuente = require('fs').readFileSync(
      require('path').join(__dirname, '../modules/captura/Onda.tsx'),
      'utf8',
    );

    expect(fuente).not.toContain('useMovimientoReducido');
  });

  it('🔴 el punto de grabación queda ENCENDIDO fijo, nunca tenue', async () => {
    // El estado tenue de ese punto significa «no estoy grabando». Resolver "no parpadear" dejándolo
    // tenue mostraría exactamente lo contrario de lo que pasa — y el usuario descubriría que no se
    // grabó cuando ya no se puede repetir.
    const fuente = require('fs').readFileSync(
      require('path').join(__dirname, '../modules/captura/HudGrabacion.tsx'),
      'utf8',
    );

    const bloque = fuente.slice(fuente.indexOf('if (movimientoReducido)'));
    expect(bloque.slice(0, 120)).toContain('op.setValue(1)');
  });
});
