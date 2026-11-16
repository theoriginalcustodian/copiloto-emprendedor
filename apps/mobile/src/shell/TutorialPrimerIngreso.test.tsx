import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text } from 'react-native';

import { ALTO_COMPOSER_REPOSO } from '../modules/chat/Composer';
import { ALTO_HANDLE } from './PanelDeslizable';

import { ThemeProvider } from '../theme/ThemeProvider';
import { PASOS_TUTORIAL, TutorialPrimerIngreso } from './TutorialPrimerIngreso';
import { pedirTutorial, tomarTutorialPendiente } from './tutorialPendiente';

async function montar() {
  const onFin = jest.fn();
  await render(
    <ThemeProvider>
      <TutorialPrimerIngreso onFin={onFin} muestraFunciones={<Text testID="muestra-funciones">Tus funciones</Text>} />
    </ThemeProvider>,
  );
  return onFin;
}

const tocar = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};
const siguiente = () => tocar('tutorial-siguiente');

describe('TutorialPrimerIngreso (Martin 13/11)', () => {
  it('son cuatro pasos y van en este orden: Mi día → hablarle → chat → funciones (con Ajustes adentro)', () => {
    expect(PASOS_TUTORIAL.map((p) => p.id)).toEqual(['midia', 'hablar', 'chat', 'funciones']);
    expect(PASOS_TUTORIAL[3].cuerpo).toMatch(/Ajustes/);
  });

  it('arranca en Mi día, dice en qué paso va y no muestra ninguna hoja', async () => {
    await montar();
    expect(screen.getByTestId('tutorial-titulo')).toHaveTextContent('Esto es Mi día');
    expect(screen.getByTestId('tutorial-progreso').props.accessibilityLabel).toBe('Paso 1 de 4');
    expect(screen.queryByTestId('tutorial-hoja-chat')).toBeNull();
    expect(screen.queryByTestId('tutorial-hoja-funciones')).toBeNull();
  });

  it('Mi día deja nítido el centro: esmerila los dos bordes', async () => {
    await montar();
    expect(screen.getByTestId('tutorial-velo-arriba')).toBeTruthy();
    expect(screen.getByTestId('tutorial-velo-abajo')).toBeTruthy();
  });

  it('«Acá me hablás» deja nítido SÓLO el campo: esmerila todo lo de arriba y no hay hojas', async () => {
    await montar();
    await siguiente();
    expect(screen.getByTestId('tutorial-titulo')).toHaveTextContent('Acá me hablás');
    expect(screen.getByTestId('tutorial-velo-arriba')).toBeTruthy();
    expect(screen.queryByTestId('tutorial-velo-abajo')).toBeNull();
    expect(screen.queryByTestId('tutorial-hoja-chat')).toBeNull();
  });

  it('🔴 el campo nítido NO incluye el margen seguro de abajo ni el asa: ahí asomaba el «Nada urgente por hoy.» de Mi día', async () => {
    await montar();
    await siguiente();
    const velo = StyleSheet.flatten(screen.getByTestId('tutorial-velo-arriba').props.style) as { height: number };
    const { height } = Dimensions.get('window');
    // lo nítido es estrictamente menos que la tira entera (asa + campo)
    expect(height - velo.height).toBeLessThan(ALTO_HANDLE + ALTO_COMPOSER_REPOSO);
  });

  it('«Deslizá hacia arriba» muestra la conversación con una charla de ejemplo, sin cursor', async () => {
    await montar();
    await siguiente();
    await siguiente();
    expect(screen.getByTestId('tutorial-titulo')).toHaveTextContent('Deslizá hacia arriba');
    const hoja = screen.getByTestId('tutorial-hoja-chat');
    expect(hoja).toHaveTextContent(/Pagué 15 mil de mercadería/);
    expect(hoja).toHaveTextContent(/Gasto para confirmar/);
    expect(hoja).toHaveTextContent(/15\.000/);
    expect(screen.queryByTestId('tutorial-mano')).toBeNull();
    expect(screen.queryByTestId('tutorial-hoja-funciones')).toBeNull();
  });

  it('«Deslizá hacia abajo» muestra el escritorio real que le pasan, y ya no la conversación', async () => {
    await montar();
    await siguiente();
    await siguiente();
    await siguiente();
    expect(screen.getByTestId('tutorial-titulo')).toHaveTextContent('Deslizá hacia abajo');
    expect(screen.getByTestId('tutorial-hoja-funciones')).toBeTruthy();
    expect(screen.getByTestId('muestra-funciones')).toBeTruthy();
    expect(screen.getByTestId('tutorial-barra-funciones')).toBeTruthy(); // la barra de donde se tira
    expect(screen.queryByTestId('tutorial-hoja-chat')).toBeNull();
  });

  it('en el paso de la conversación la barra de agarre está desde el principio, antes de que la hoja suba', async () => {
    await montar();
    await siguiente();
    await siguiente();
    expect(screen.getByTestId('tutorial-barra')).toBeTruthy();
  });

  it('el último paso dice «Listo», ya no ofrece saltar, y termina', async () => {
    const onFin = await montar();
    await siguiente();
    await siguiente();
    await siguiente();
    expect(screen.getByTestId('tutorial-siguiente')).toHaveTextContent('Listo');
    expect(screen.queryByTestId('tutorial-saltar')).toBeNull();
    await siguiente();
    expect(onFin).toHaveBeenCalledTimes(1);
  });

  it('«Saltar» termina en cualquier paso', async () => {
    const onFin = await montar();
    await siguiente();
    await tocar('tutorial-saltar');
    expect(onFin).toHaveBeenCalledTimes(1);
  });
});

describe('tutorialPendiente', () => {
  it('se toma UNA vez: pedirlo lo deja, leerlo lo vacía', () => {
    expect(tomarTutorialPendiente()).toBe(false);
    pedirTutorial();
    expect(tomarTutorialPendiente()).toBe(true);
    expect(tomarTutorialPendiente()).toBe(false);
  });
});
