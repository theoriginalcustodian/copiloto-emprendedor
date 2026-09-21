import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ETIQUETA_ORIGEN_GASTO, type OrigenGasto } from '@copiloto/core';

import '../../design-system/themes.css';
import { FormularioGasto } from './FormularioGasto';

const ORIGENES: OrigenGasto[] = ['voz', 'foto', 'manual'];

describe('FormularioGasto — origen de la propuesta (BL-C4)', () => {
  it.each(ORIGENES)('muestra de dónde salió el gasto cuando origen=%s', (origen) => {
    render(<FormularioGasto origen={origen} onCreado={vi.fn()} onCancelar={vi.fn()} />);
    const linea = screen.getByTestId('gasto-origen');
    expect(linea).toHaveTextContent(ETIQUETA_ORIGEN_GASTO[origen]);
    expect(linea).toHaveAttribute('data-origen', origen);
  });

  it('las tres etiquetas son distintas entre sí (el usuario distingue una lectura de foto de algo que tipeó)', () => {
    expect(new Set(ORIGENES.map((o) => ETIQUETA_ORIGEN_GASTO[o])).size).toBe(ORIGENES.length);
  });
});
