/**
 * `CampoSecreto` — el ojo tiene que poder **cambiar** el enmascarado, no sólo dibujarse.
 *
 * El caso que motivó estos tests fue real y caro: el operador no pudo completar el alta de ARCA
 * porque tipeaba una clave de 15 caracteres con símbolos a ciegas (2026-07-21). Lo que se verifica
 * acá es el invariante que hace útil al control -- que `secureTextEntry` siga al toggle -- y no que
 * el ícono exista, que es lo que un test descuidado comprobaría.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '../../ThemeProvider';
import { CampoSecreto } from './CampoSecreto';

async function montar(props?: Partial<React.ComponentProps<typeof CampoSecreto>>) {
  return render(
    <ThemeProvider>
      <CampoSecreto etiqueta="Clave fiscal" valor="Pepe$2026" onChange={() => {}} {...props} />
    </ThemeProvider>,
  );
}

describe('CampoSecreto', () => {
  it('arranca enmascarado', async () => {
    await montar();
    expect(screen.getByTestId('campo-secreto-campo-input').props.secureTextEntry).toBe(true);
  });

  // `await fireEvent` -- en RNTL 14 el evento es asíncrono y sin el `await` se lee el árbol ANTES del
  // re-render: el test falla con el componente sano (pasó acá mismo la primera vez).
  it('el ojo revela la clave y vuelve a ocultarla', async () => {
    await montar();
    const input = () => screen.getByTestId('campo-secreto-campo-input');

    await fireEvent.press(screen.getByTestId('campo-secreto-ojo'));
    expect(input().props.secureTextEntry).toBe(false);

    await fireEvent.press(screen.getByTestId('campo-secreto-ojo'));
    expect(input().props.secureTextEntry).toBe(true);
  });

  it('el rótulo accesible dice la ACCIÓN, no el estado', async () => {
    await montar();
    // Oculto -> el botón ofrece mostrar. Es lo que lee un lector de pantalla antes de tocar.
    expect(screen.getByTestId('campo-secreto-ojo').props.accessibilityLabel).toBe('Mostrar la clave');
    await fireEvent.press(screen.getByTestId('campo-secreto-ojo'));
    expect(screen.getByTestId('campo-secreto-ojo').props.accessibilityLabel).toBe('Ocultar la clave');
  });

  it('nunca mayusculiza sola la primera letra (bug de documed en device)', async () => {
    await montar();
    expect(screen.getByTestId('campo-secreto-campo-input').props.autoCapitalize).toBe('none');
  });

  it('el aviso de seguridad se dibuja pegado al campo', async () => {
    await montar({ aviso: 'No guardamos tu clave.' });
    expect(screen.getByTestId('campo-secreto-aviso')).toBeTruthy();
  });
});
