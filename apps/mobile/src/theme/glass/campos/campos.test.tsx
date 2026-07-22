import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

// Jest (jest-expo) -- describe/it/expect son globales. `render` de RNTL 14 es ASYNC (devuelve
// Promise) -- mismo patrón que `primitivos.test.tsx`/`PantallaAjustes.test.tsx`: hay que `await`-earlo.

import { ThemeProvider } from '../../ThemeProvider';
import { CampoFecha } from './CampoFecha';
import { CampoNumero } from './CampoNumero';
import { CampoSecreto } from './CampoSecreto';
import { CampoSelect, type OpcionSelect } from './CampoSelect';
import { CampoTexto } from './CampoTexto';
import { EnvolturaCampo } from './EnvolturaCampo';
import { FilaBotones } from './FilaBotones';

async function envolver(nodo: React.ReactElement) {
  return render(<ThemeProvider>{nodo}</ThemeProvider>);
}

describe('EnvolturaCampo', () => {
  it('renderiza sus children', async () => {
    await envolver(
      <EnvolturaCampo testID="vidrio">
        <Text>adentro</Text>
      </EnvolturaCampo>,
    );
    expect(screen.getByTestId('vidrio')).toBeTruthy();
    expect(screen.getByText('adentro')).toBeTruthy();
  });

  it('🔴 tiene una base OPACA bajo el gradiente — si no, el escritorio se lee dentro del campo', async () => {
    // El bug que este test frena: los campos entran sobre un `transparentModal`, así que detrás está
    // el escritorio, y el gradiente `s1/s2` es blanco translúcido (α .04-.14). Sin una capa opaca
    // debajo, el texto del fondo se cuela en el renglón donde se escribe y se guarda un CUIT
    // equivocado. La base tiene que ser un color OPACO (hex sólido, no `rgba(...,α<1)` ni transparente).
    const { getByTestId } = await envolver(<EnvolturaCampo testID="vidrio" />);

    const capas = getByTestId('vidrio').children as unknown[];
    const fondos = capas
      .filter((c): c is { props: { style?: unknown } } => typeof c === 'object' && c !== null && 'props' in c)
      .map((c) => c.props.style)
      .flat(Infinity)
      .map((s) => (typeof s === 'object' && s !== null ? (s as { backgroundColor?: string }).backgroundColor : undefined))
      .filter((c): c is string => typeof c === 'string');

    // Al menos un `backgroundColor` opaco: hex de 6/8 dígitos SIN alpha < 1. Un `rgba(...,0.x)` o
    // `transparent` no taparía nada — que es exactamente el bug.
    const hayOpaco = fondos.some((c) => /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c) && !/^#[0-9a-f]{6}00$/i.test(c));
    expect(hayOpaco).toBe(true);
  });
});

describe('CampoTexto', () => {
  it('renderiza la etiqueta y el valor', async () => {
    await envolver(<CampoTexto etiqueta="Razón social" valor="Mi Negocio" onChange={() => {}} testID="ct" />);
    expect(screen.getByText('Razón social')).toBeTruthy();
    expect(screen.getByTestId('ct-input').props.value).toBe('Mi Negocio');
  });

  it('renderiza el error cuando viene una string no vacía', async () => {
    await envolver(
      <CampoTexto etiqueta="Domicilio" valor="" onChange={() => {}} error="Campo requerido" testID="ct" />,
    );
    expect(screen.getByTestId('ct-error')).toBeTruthy();
    expect(screen.getByText('Campo requerido')).toBeTruthy();
  });

  it('sin error, no renderiza el nodo de error', async () => {
    await envolver(<CampoTexto etiqueta="Domicilio" valor="" onChange={() => {}} testID="ct" />);
    expect(screen.queryByTestId('ct-error')).toBeNull();
  });

  it('dispara onChange con el texto tipiado', async () => {
    const onChange = jest.fn();
    await envolver(<CampoTexto etiqueta="Razón social" valor="" onChange={onChange} testID="ct" />);
    await fireEvent.changeText(screen.getByTestId('ct-input'), 'Nuevo valor');
    expect(onChange).toHaveBeenCalledWith('Nuevo valor');
  });
});

describe('CampoSecreto', () => {
  it('oculta el valor (secureTextEntry) y muestra el aviso pegado al campo', async () => {
    await envolver(
      <CampoSecreto
        etiqueta="Clave fiscal"
        valor=""
        onChange={() => {}}
        aviso="Tu clave fiscal no se guarda."
        testID="cs"
      />,
    );
    expect(screen.getByTestId('cs-campo-input').props.secureTextEntry).toBe(true);
    expect(screen.getByTestId('cs-aviso')).toBeTruthy();
    expect(screen.getByText('Tu clave fiscal no se guarda.')).toBeTruthy();
  });

  it('sin aviso, no renderiza el nodo de aviso', async () => {
    await envolver(<CampoSecreto etiqueta="Clave fiscal" valor="" onChange={() => {}} testID="cs" />);
    expect(screen.queryByTestId('cs-aviso')).toBeNull();
  });
});

describe('CampoNumero -- valor string de punta a punta', () => {
  it('nunca convierte a number: onChange recibe siempre un string', async () => {
    const onChange = jest.fn();
    await envolver(<CampoNumero etiqueta="Precio unitario" valor="" onChange={onChange} testID="cn" />);
    await fireEvent.changeText(screen.getByTestId('cn-input'), '1250.50');
    expect(onChange).toHaveBeenCalledWith('1250.50');
    expect(typeof onChange.mock.calls[0][0]).toBe('string');
  });

  it('rechaza letras y símbolos -- sólo pasan dígitos y un separador decimal', async () => {
    const onChange = jest.fn();
    await envolver(<CampoNumero etiqueta="Precio unitario" valor="" onChange={onChange} testID="cn" />);
    await fireEvent.changeText(screen.getByTestId('cn-input'), '12ab.34,56xy');
    // Un solo separador decimal sobrevive (el primero); letras y separadores extra se descartan.
    expect(onChange).toHaveBeenCalledWith('12.3456');
  });

  it('usa teclado decimal-pad', async () => {
    await envolver(<CampoNumero etiqueta="Precio unitario" valor="" onChange={() => {}} testID="cn" />);
    expect(screen.getByTestId('cn-input').props.keyboardType).toBe('decimal-pad');
  });
});

describe('CampoSelect', () => {
  const OPCIONES: OpcionSelect[] = [
    { valor: 'contado', etiqueta: 'Contado' },
    { valor: 'cuenta_corriente', etiqueta: 'Cuenta corriente' },
    { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  ];

  it('marca la opción elegida (accessibilityState.selected)', async () => {
    await envolver(
      <CampoSelect etiqueta="Condición de venta" opciones={OPCIONES} valor="tarjeta" onChange={() => {}} testID="cs" />,
    );
    expect(screen.getByTestId('cs-opcion-tarjeta').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('cs-opcion-contado').props.accessibilityState.selected).toBe(false);
  });

  it('dispara onChange con el valor de la opción tocada', async () => {
    const onChange = jest.fn();
    await envolver(
      <CampoSelect etiqueta="Condición de venta" opciones={OPCIONES} valor="contado" onChange={onChange} testID="cs" />,
    );
    await fireEvent.press(screen.getByTestId('cs-opcion-cuenta_corriente'));
    expect(onChange).toHaveBeenCalledWith('cuenta_corriente');
  });
});

describe('CampoFecha', () => {
  function Arnes({ inicial = '' }: { inicial?: string }) {
    const [iso, setIso] = useState(inicial);
    return (
      <>
        <CampoFecha etiqueta="Inicio de actividades" valor={iso} onChange={setIso} testID="cf" />
        <Text testID="cf-resultado">{iso}</Text>
      </>
    );
  }

  it('arma el ISO correcto con una fecha válida', async () => {
    await envolver(<Arnes />);
    await fireEvent.changeText(screen.getByTestId('cf-dia'), '07');
    await fireEvent.changeText(screen.getByTestId('cf-mes'), '03');
    await fireEvent.changeText(screen.getByTestId('cf-anio'), '2024');
    expect(screen.getByTestId('cf-resultado').props.children).toBe('2024-03-07');
  });

  it('devuelve \'\' con una fecha inválida (31/02 no existe)', async () => {
    await envolver(<Arnes />);
    await fireEvent.changeText(screen.getByTestId('cf-dia'), '31');
    await fireEvent.changeText(screen.getByTestId('cf-mes'), '02');
    await fireEvent.changeText(screen.getByTestId('cf-anio'), '2024');
    expect(screen.getByTestId('cf-resultado').props.children).toBe('');
  });

  it('respeta el 29/02 en año bisiesto y lo rechaza en año no bisiesto', async () => {
    await envolver(<Arnes />);
    await fireEvent.changeText(screen.getByTestId('cf-dia'), '29');
    await fireEvent.changeText(screen.getByTestId('cf-mes'), '02');
    await fireEvent.changeText(screen.getByTestId('cf-anio'), '2024'); // bisiesto
    expect(screen.getByTestId('cf-resultado').props.children).toBe('2024-02-29');

    await fireEvent.changeText(screen.getByTestId('cf-anio'), '2023'); // no bisiesto
    expect(screen.getByTestId('cf-resultado').props.children).toBe('');
  });

  it('devuelve \'\' mientras la fecha está incompleta', async () => {
    await envolver(<Arnes />);
    await fireEvent.changeText(screen.getByTestId('cf-dia'), '07');
    await fireEvent.changeText(screen.getByTestId('cf-mes'), '03');
    expect(screen.getByTestId('cf-resultado').props.children).toBe('');
  });
});

describe('FilaBotones', () => {
  it('dispara onPress del botón tocado', async () => {
    const onPress = jest.fn();
    await envolver(
      <FilaBotones
        testID="fb"
        botones={[{ etiqueta: 'Confirmar', onPress, variante: 'primario' }]}
      />,
    );
    await fireEvent.press(screen.getByTestId('fb-boton-0'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('NO dispara onPress si el botón está deshabilitado', async () => {
    const onPress = jest.fn();
    await envolver(
      <FilaBotones
        testID="fb"
        botones={[{ etiqueta: 'Confirmar', onPress, deshabilitado: true }]}
      />,
    );
    await fireEvent.press(screen.getByTestId('fb-boton-0'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
