import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';

import { almacenClave } from '../adapters/almacen';
import { useAvisoUnaVez } from './avisoUnaVez';

function Sonda({ clave, activo = true }: { clave: string; activo?: boolean }) {
  const mostrar = useAvisoUnaVez(clave, activo);
  return <Text testID="sonda">{mostrar ? 'aviso' : 'nada'}</Text>;
}

/** Una clave para los dos tests encadenados: el segundo depende de la marca que dejó el primero. */
const CLAVE = 'prueba-aviso-una-vez';

describe('useAvisoUnaVez', () => {
  it('inactivo no gasta el aviso', async () => {
    await render(<Sonda clave="prueba-inactivo" activo={false} />);
    expect(screen.getByTestId('sonda')).toHaveTextContent('nada');
    // `== null`: el almacén simulado devuelve `undefined` para una clave que no existe, el real `null`.
    expect((await almacenClave.leer('prueba-inactivo')) == null).toBe(true);
  });

  it('la primera vez lo muestra y deja la marca', async () => {
    await render(<Sonda clave={CLAVE} />);
    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('aviso'));
    expect(await almacenClave.leer(CLAVE)).toBe('1');
  });

  it('la segunda vez ya no lo muestra', async () => {
    await render(<Sonda clave={CLAVE} />);
    // La lectura es asíncrona: se le da tiempo a resolver antes de afirmar que sigue en «nada».
    await almacenClave.leer(CLAVE);
    expect(screen.getByTestId('sonda')).toHaveTextContent('nada');
  });
});
