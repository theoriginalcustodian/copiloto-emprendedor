import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { RecordingOverlay } from './RecordingOverlay';

describe('RecordingOverlay', () => {
  it('unlocked: muestra el hint de soltar/deslizar y NO los botones fijos de Eliminar/Enviar', () => {
    render(<RecordingOverlay elapsedMs={3000} locked={false} onCancel={vi.fn()} onSend={vi.fn()} />);

    // El "↑" va en un <span> aparte (fidelidad del diseño) -> el texto queda partido en varios
    // nodos; matcheo por regex sobre el texto directo del <p> (getNodeText ignora el span hijo).
    expect(screen.getByText(/Soltá para enviar · deslizá/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar audio' })).not.toBeInTheDocument();
  });

  it('locked: muestra Eliminar/Enviar (no el hint) y dispara los callbacks correctos', () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();
    render(<RecordingOverlay elapsedMs={1000} locked onCancel={onCancel} onSend={onSend} />);

    expect(screen.queryByText(/Soltá para enviar/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar audio' }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('BL-W1: locked con onPause/onResume — Pausar ↔ Reanudar según `paused`; sin los callbacks no se ofrece', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const { rerender } = render(
      <RecordingOverlay elapsedMs={0} locked onPause={onPause} onResume={onResume} onCancel={vi.fn()} onSend={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(onPause).toHaveBeenCalledTimes(1);
    rerender(
      <RecordingOverlay elapsedMs={0} locked paused onPause={onPause} onResume={onResume} onCancel={vi.fn()} onSend={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
    rerender(<RecordingOverlay elapsedMs={0} locked onCancel={vi.fn()} onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument();
  });

  it('formatea el timer transcurrido como mm:ss', () => {
    render(<RecordingOverlay elapsedMs={65_000} locked={false} onCancel={vi.fn()} onSend={vi.fn()} />);
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('con 0ms muestra 00:00 (no crashea con valores límite)', () => {
    render(<RecordingOverlay elapsedMs={0} locked={false} onCancel={vi.fn()} onSend={vi.fn()} />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});
