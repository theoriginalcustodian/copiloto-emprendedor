/**
 * SM-P16 — las DOS mitades del arrastre desde el cuerpo: la decisión del Pan (panel) y la costura que la
 * alimenta (la lista escribe `enTope`). Un verde de una sola mitad es cómo se cuela este defecto.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';

import { ThemeProvider } from '../theme/ThemeProvider';
import { ListaMensajes } from '../modules/chat/ListaMensajes';
import { ArrastreCuerpoContext } from './arrastreCuerpo';
import { decidirArrastreCuerpo } from './PanelDeslizable';

describe('decidirArrastreCuerpo (mitad del panel)', () => {
  it('activa: panel arriba, lista en el tope, dedo hacia abajo pasado el umbral', () => {
    expect(decidirArrastreCuerpo(13, true, 0)).toBe('activar');
    expect(decidirArrastreCuerpo(80, true, 0)).toBe('activar');
  });

  it('espera: un toque quieto o un movimiento corto sigue siendo de la tarjeta/botón de adentro', () => {
    expect(decidirArrastreCuerpo(0, true, 0)).toBe('esperar');
    expect(decidirArrastreCuerpo(12, true, 0)).toBe('esperar');
    expect(decidirArrastreCuerpo(-8, true, 0)).toBe('esperar');
  });

  it('falla: lista fuera del tope → el dedo es del scroll', () => {
    expect(decidirArrastreCuerpo(40, false, 0)).toBe('fallar');
  });

  it('falla: dedo hacia ARRIBA → empuja contenido, no baja el panel', () => {
    expect(decidirArrastreCuerpo(-9, true, 0)).toBe('fallar');
  });

  it('falla: panel ABAJO → el cuerpo es invisible, no hay nada que arrastrar desde acá', () => {
    expect(decidirArrastreCuerpo(40, true, 700)).toBe('fallar');
    expect(decidirArrastreCuerpo(40, true, 1.5)).toBe('fallar');
  });
});

describe('ListaMensajes escribe `enTope` (mitad de la lista)', () => {
  const msgs = [{ id: 'm1', role: 'user', text: 'hola', ts: 1 }] as never;

  async function montar() {
    const enTope = { value: true } as SharedValue<boolean>;
    await render(
      <ThemeProvider>
        <ArrastreCuerpoContext.Provider value={{ enTope, refGestoCuerpo: { current: null } }}>
          <ListaMensajes messages={msgs} onChoice={() => {}} onResolverTarjeta={() => {}} />
        </ArrastreCuerpoContext.Provider>
      </ThemeProvider>,
    );
    return { enTope, lista: screen.getByTestId('lista-mensajes') };
  }

  const scroll = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y }, contentSize: { height: 1000, width: 360 }, layoutMeasurement: { height: 600, width: 360 } } });

  it('fuera del tope → false; de vuelta al tope → true', async () => {
    const { enTope, lista } = await montar();
    await fireEvent.scroll(lista, scroll(120));
    expect(enTope.value).toBe(false);
    await fireEvent.scroll(lista, scroll(0));
    expect(enTope.value).toBe(true);
  });

  it('absorbe el redondeo del offset (≤ 1 px sigue siendo el tope)', async () => {
    const { enTope, lista } = await montar();
    await fireEvent.scroll(lista, scroll(300));
    await fireEvent.scroll(lista, scroll(0.6));
    expect(enTope.value).toBe(true);
  });

  it('sin proveedor (Soporte, tests aislados) no rompe ni escribe nada', async () => {
    await render(<ThemeProvider><ListaMensajes messages={msgs} onChoice={() => {}} onResolverTarjeta={() => {}} /></ThemeProvider>);
    await fireEvent.scroll(screen.getByTestId('lista-mensajes'), scroll(50));
    expect(screen.getByTestId('lista-mensajes')).toBeTruthy();
  });
});
