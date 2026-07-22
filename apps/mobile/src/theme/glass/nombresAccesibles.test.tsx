/**
 * **Todo control tocable tiene NOMBRE.** No es un test de accesibilidad "por si acaso": es el
 * invariante del que dependen dos cosas distintas y las dos importan.
 *
 * 1. **El lector de pantalla.** Un botón sin nombre se anuncia como «botón» y un campo sin nombre
 *    como «cuadro de edición». Una app entera así es literalmente inusable a ciegas.
 * 2. **El E2E por ADB.** Sin nombres, `uiautomator` no ve ningún elemento y la única forma de manejar
 *    la app es **tocar píxeles leídos de una captura**. Eso falla de la peor manera: anda hasta que
 *    una capa —el dev menu, un modal, el teclado— se pone encima, y entonces el toque va a otro lado
 *    y **la corrida sigue como si nada**. Medido por backend el 2026-07-22: un tap donde debía estar
 *    un tile abrió el menú de desarrollo, dos de dos, y el `BACK` para cerrarlo sacó de la app.
 *
 * 🔴 **Por qué el test vive acá, sobre los PRIMITIVOS, y no en cada pantalla.** Nombrar pantalla por
 * pantalla es una lista que hay que acordarse de mantener, y la próxima pantalla nace sin nombres.
 * Nombrando `FilaBotones`/`CampoTexto`/`Tile`/`Row` queda cierto **por construcción** para los ~40
 * campos y todos los CTA de la app, y un control nuevo nace nombrado. Es la diferencia entre una regla
 * escrita y una regla sostenida.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
import { render, screen } from '@testing-library/react-native';

import { CampoTexto } from './campos/CampoTexto';
import { CampoSecreto } from './campos/CampoSecreto';
import { FilaBotones } from './campos/FilaBotones';
import { Row } from './Row';
import { Tile } from './Tile';
import { ThemeProvider } from '../ThemeProvider';

async function envolver(nodo: React.ReactElement) {
  return render(<ThemeProvider>{nodo}</ThemeProvider>);
}

describe('nombres accesibles — los CTA', () => {
  it('🔴 cada botón se encuentra POR SU TEXTO, que es lo único que sabe quien lo busca', async () => {
    // El recorrido del E2E toca «Guardar», «Listo», «Deshacer» — nunca un `testID`, que es interno.
    await envolver(
      <FilaBotones
        botones={[
          { etiqueta: 'Guardar', onPress: () => {} },
          { etiqueta: 'Deshacer', onPress: () => {}, variante: 'peligro' },
        ]}
      />,
    );

    expect(screen.getByLabelText('Guardar')).toBeTruthy();
    expect(screen.getByLabelText('Deshacer')).toBeTruthy();
  });

  it('un botón deshabilitado SIGUE teniendo nombre — si no, desaparece justo cuando hay que explicarlo', async () => {
    // Un control apagado tiene que poder anunciarse: «Guardando…, botón, deshabilitado». Si perdiera
    // el nombre, quien no ve la pantalla no sabría qué se está esperando.
    await envolver(
      <FilaBotones botones={[{ etiqueta: 'Guardando…', onPress: () => {}, deshabilitado: true }]} />,
    );

    expect(screen.getByLabelText('Guardando…')).toBeTruthy();
  });
});

describe('nombres accesibles — los campos', () => {
  it('🔴 el input se llama como su etiqueta VISIBLE, no como nada', async () => {
    // La etiqueta es un `<Text>` hermano: sin declararlo, el input no se llama de ninguna manera y
    // todos los campos del formulario son el mismo campo para cualquiera que no vea la pantalla.
    await envolver(
      <CampoTexto etiqueta="Cuánto te pagaron" valor="" onChange={() => {}} testID="monto" />,
    );

    expect(screen.getByLabelText('Cuánto te pagaron')).toBeTruthy();
  });

  it('🔴 el campo NO cambia de nombre cuando hay error', async () => {
    // Concatenar el error al nombre lo haría renombrarse justo cuando quien lo busca —persona o
    // script— necesita que se siga llamando igual para poder volver a él y corregirlo.
    await envolver(
      <CampoTexto
        etiqueta="CUIT"
        valor="123"
        onChange={() => {}}
        error="Tiene que tener 11 dígitos"
        testID="cuit"
      />,
    );

    expect(screen.getByLabelText('CUIT')).toBeTruthy();
    // El error se ve, pero como texto propio — no disuelto adentro del nombre del campo.
    expect(screen.getByText('Tiene que tener 11 dígitos')).toBeTruthy();
  });

  it('el campo de clave hereda el nombre, y su ojo dice qué hace', async () => {
    await envolver(<CampoSecreto etiqueta="Clave fiscal" valor="" onChange={() => {}} testID="clave" />);

    expect(screen.getByLabelText('Clave fiscal')).toBeTruthy();
    expect(screen.getByLabelText('Mostrar la clave')).toBeTruthy();
  });
});

describe('nombres accesibles — las superficies tocables', () => {
  it('`Tile` y `Row` reenvían el nombre que les pasan', async () => {
    // Son los primitivos del escritorio y de las listas. Ya lo hacían antes de este archivo; el test
    // existe para que **siga siendo cierto**: sin él, un refactor del primitivo se lleva puestos
    // todos los nombres de la app a la vez y nada falla.
    await envolver(
      <>
        <Tile accessibilityLabel="Facturación" onPress={() => {}} testID="t" />
        <Row accessibilityLabel="Factura N° 42 · $85.000" onPress={() => {}} testID="r" />
      </>,
    );

    expect(screen.getByLabelText('Facturación')).toBeTruthy();
    expect(screen.getByLabelText('Factura N° 42 · $85.000')).toBeTruthy();
  });

  it('🔴 CONTROL — el buscador por nombre sabe decir que NO', async () => {
    // Sin esto, los cinco tests de arriba pasarían igual con un `getByLabelText` que encontrara
    // cualquier cosa. Un instrumento que nunca falla no verifica nada.
    await envolver(<FilaBotones botones={[{ etiqueta: 'Guardar', onPress: () => {} }]} />);

    expect(screen.queryByLabelText('Un botón que no existe')).toBeNull();
  });
});
