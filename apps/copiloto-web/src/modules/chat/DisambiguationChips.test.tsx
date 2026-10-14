import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import type { ReplyChoice } from '../../lib/api';
import { DisambiguationChips } from './DisambiguationChips';

const CHOICES: ReplyChoice[] = [
  { label: 'Juan Pérez', value: 'juan_perez' },
  { label: 'Juan Gómez', value: 'juan_gomez' },
];

describe('DisambiguationChips', () => {
  it('renderiza un chip por choice', () => {
    render(<DisambiguationChips choices={CHOICES} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Juan Pérez' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Juan Gómez' })).toBeInTheDocument();
  });

  it('click en un chip envía el callback con (value, label) — BL-D4: el label es lo que se pinta', () => {
    const onSelect = vi.fn();
    render(<DisambiguationChips choices={CHOICES} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Juan Gómez' }));
    expect(onSelect).toHaveBeenCalledWith('juan_gomez', 'Juan Gómez');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // SM-D1 (2026-10-14): hoy ningún productor del backend emite más de 2 choices (canario invertido
  // `test_choices_a_lo_sumo_dos_canario.py`), así que el «3+» sólo se ejercita acá, inyectando N sin backend.
  it('SM-D1: con 5 choices pinta 5 chips y cada uno devuelve SU value (ninguno se recorta ni se pisa)', () => {
    const cinco: ReplyChoice[] = [1, 2, 3, 4, 5].map((n) => ({ label: `Ana ${n}`, value: `cliente:${n}` }));
    const onSelect = vi.fn();
    render(<DisambiguationChips choices={cinco} onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Ana 5' }));
    expect(onSelect).toHaveBeenCalledWith('cliente:5', 'Ana 5');
    fireEvent.click(screen.getByRole('button', { name: 'Ana 3' }));
    expect(onSelect).toHaveBeenLastCalledWith('cliente:3', 'Ana 3');
  });
});
