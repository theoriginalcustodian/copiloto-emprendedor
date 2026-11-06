/**
 * El aviso de estado del dock (p. ej. «No se entendió el audio…») flota sobre la última burbuja: sin fondo
 * opaco se leían los dos textos superpuestos, y sin `flexShrink` el texto largo no envolvía y se salía de la
 * pantalla (medido en device, piel oscura, 2026-11-06).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { Composer } from './Composer';

describe('Composer aviso de estado legible', () => {
  it('el aviso tiene fondo opaco y el texto envuelve', async () => {
    await render(
      <ThemeProvider>
        <Composer sendStatus="error" onSend={() => {}} />
      </ThemeProvider>,
    );
    const fila = StyleSheet.flatten(screen.getByTestId('composer-status').props.style);
    expect(fila.backgroundColor).toBeTruthy();
    expect(fila.maxWidth).toBe('100%');
    const texto = screen.getByText(/Probá de nuevo/);
    expect(StyleSheet.flatten(texto.props.style).flexShrink).toBe(1);
  });
});
