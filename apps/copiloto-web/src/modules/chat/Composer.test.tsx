import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { ModeProvider, useMode, type ActiveMode } from '../../shell/modeStore';
import { Composer, type ComposerProps } from './Composer';

const GMAIL_MODE: ActiveMode = { key: 'gmail', label: 'Mail', category: 'comunicacion' };
const UNKNOWN_CATEGORY_MODE: ActiveMode = { key: 'svc', label: 'Servicio', category: 'categoria-nueva' };

/** Componente de test-only: setea el modo activo ANTES de que `Composer` renderice, vía el mismo
 * `useMode()` que usaría `AppsScreen` en producción (mismo criterio que `ModeProbe` en
 * AppsScreen.test.tsx: un consumidor hermano manipula el Context compartido). */
function ModeSetter({ mode }: { mode: ActiveMode }) {
  const { setMode } = useMode();
  useEffect(() => setMode(mode), [mode, setMode]);
  return null;
}

/**
 * `onSendAudio` (Task 19) tiene un default `vi.fn()` acá para no tener que tocar cada `it(...)`
 * existente que llamaba `renderComposer({sendStatus, onSend})` antes de que el mic real existiera
 * — los tests de `MicButton`/`onSendAudio` en sí viven en `MicButton.test.tsx`.
 */
function renderComposer(props: Partial<ComposerProps> = {}, initialMode?: ActiveMode) {
  const merged: ComposerProps = { sendStatus: 'idle', onSend: vi.fn(), onSendAudio: vi.fn(), ...props };
  return render(
    <ModeProvider>
      {initialMode && <ModeSetter mode={initialMode} />}
      <Composer {...merged} />
    </ModeProvider>,
  );
}

describe('Composer', () => {
  it('Enter envía el mensaje y limpia el input (sin modo activo -> mode=null)', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    const textarea = screen.getByPlaceholderText('Escribí tu mensaje…');
    fireEvent.change(textarea, { target: { value: 'Hola' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Hola', null);
    expect(textarea).toHaveValue('');
  });

  it('Shift+Enter NO envía', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    const textarea = screen.getByPlaceholderText('Escribí tu mensaje…');
    fireEvent.change(textarea, { target: { value: 'Hola' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('vacío/solo espacios no envía (botón enviar deshabilitado)', () => {
    const onSend = vi.fn();
    renderComposer({ sendStatus: 'idle', onSend });
    expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();

    const textarea = screen.getByPlaceholderText('Escribí tu mensaje…');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('muestra el copy de durabilidad cuando sendStatus=waiting', () => {
    renderComposer({ sendStatus: 'waiting', onSend: vi.fn() });
    expect(screen.getByText(/Podés cerrar la app, te sigo respondiendo/)).toBeInTheDocument();
  });

  it('muestra alerta de error cuando sendStatus=error', () => {
    renderComposer({ sendStatus: 'error', onSend: vi.fn() });
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos enviar tu mensaje. Probá de nuevo.');
  });

  it('deshabilita el input mientras sendStatus=sending', () => {
    renderComposer({ sendStatus: 'sending', onSend: vi.fn() });
    expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeDisabled();
  });

  describe('modo activo (Feature addendum 2026-07-03)', () => {
    it('sin modo activo: NO muestra el chip', () => {
      renderComposer({ sendStatus: 'idle', onSend: vi.fn() });
      expect(screen.queryByTestId('active-mode-chip')).not.toBeInTheDocument();
    });

    it('con modo activo: adapta el placeholder y muestra el chip "Modo Mail"', () => {
      renderComposer({ sendStatus: 'idle', onSend: vi.fn() }, GMAIL_MODE);

      expect(screen.getByPlaceholderText('Modo Mail: mandá un mail a…')).toBeInTheDocument();
      expect(screen.getByTestId('active-mode-chip')).toHaveTextContent('Modo Mail');
    });

    it('categoría sin hint conocido degrada a un hint genérico (no rompe)', () => {
      renderComposer({ sendStatus: 'idle', onSend: vi.fn() }, UNKNOWN_CATEGORY_MODE);
      expect(screen.getByPlaceholderText('Modo Servicio: contame qué necesitás…')).toBeInTheDocument();
    });

    it('cada envío con modo activo incluye la key del modo en el 2do argumento', () => {
      const onSend = vi.fn();
      renderComposer({ sendStatus: 'idle', onSend }, GMAIL_MODE);

      const textarea = screen.getByPlaceholderText('Modo Mail: mandá un mail a…');
      fireEvent.change(textarea, { target: { value: 'Mandale un mail a Juan' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSend).toHaveBeenCalledWith('Mandale un mail a Juan', 'gmail');
    });

    it('la ✕ del chip limpia el modo (vuelve a placeholder/chip generales)', () => {
      renderComposer({ sendStatus: 'idle', onSend: vi.fn() }, GMAIL_MODE);

      fireEvent.click(screen.getByRole('button', { name: 'Salir del modo' }));

      expect(screen.queryByTestId('active-mode-chip')).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText('Escribí tu mensaje…')).toBeInTheDocument();
    });

    it('foco blando: con modo activo, cualquier texto se envía igual (nunca bloquea)', () => {
      const onSend = vi.fn();
      renderComposer({ sendStatus: 'idle', onSend }, GMAIL_MODE);

      const textarea = screen.getByPlaceholderText('Modo Mail: mandá un mail a…');
      fireEvent.change(textarea, { target: { value: 'Cobrale $5.000 a Juan' } });
      expect(screen.getByRole('button', { name: 'Enviar mensaje' })).not.toBeDisabled();
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSend).toHaveBeenCalledWith('Cobrale $5.000 a Juan', 'gmail');
    });
  });

  describe('mic (Task 19)', () => {
    it('ya no muestra el mic deshabilitado "próximamente" — hay un MicButton real y habilitado', () => {
      renderComposer();
      expect(screen.queryByLabelText('Grabar audio (próximamente)')).not.toBeInTheDocument();
      expect(screen.getByTestId('mic-button')).toBeEnabled();
    });

    it('deshabilita el mic mientras sendStatus=sending (mismo criterio que el textarea)', () => {
      renderComposer({ sendStatus: 'sending' });
      expect(screen.getByTestId('mic-button')).toBeDisabled();
    });
  });
});
