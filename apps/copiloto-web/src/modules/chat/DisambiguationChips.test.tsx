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

  it('click en un chip envía el callback con su value', () => {
    const onSelect = vi.fn();
    render(<DisambiguationChips choices={CHOICES} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Juan Gómez' }));
    expect(onSelect).toHaveBeenCalledWith('juan_gomez');
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
