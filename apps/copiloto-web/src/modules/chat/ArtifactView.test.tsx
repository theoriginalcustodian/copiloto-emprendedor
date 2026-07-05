import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { THEMES } from '../../design-system/ThemeProvider';
import { ArtifactView } from './ArtifactView';

/**
 * Tests del render de artefactos clicables (Task 17). El `navigator.share` REAL (permission
 * prompt, hoja nativa del SO) no existe en jsdom — acá solo se cubre que el botón exista y que
 * invoque el handler correcto (`navigator.share` si está disponible, `clipboard.writeText` si no);
 * el comportamiento nativo se verifica en device (memoria `gate-jsdom-no-ve-gestos-tactiles`).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ArtifactView', () => {
  it('payment_link muestra botón Compartir + link', () => {
    render(<ArtifactView card={{ kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 5000 } }} />);
    expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pagar|link/i })).toHaveAttribute('href', 'https://mpago.la/x');
  });

  it('doc muestra link clicable a la fuente', () => {
    render(<ArtifactView card={{ kind: 'doc', data: { url: 'https://docs.google.com/d/1' } }} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://docs.google.com/d/1');
  });

  it('sheet/file/email_draft muestran link clicable con su propio label', () => {
    render(<ArtifactView card={{ kind: 'sheet', data: { url: 'https://sheets/1' } }} />);
    expect(screen.getByRole('link', { name: /planilla/i })).toHaveAttribute('href', 'https://sheets/1');
  });

  it('calendar_event muestra datos inline + link', () => {
    render(<ArtifactView card={{ kind: 'calendar_event', data: { url: 'https://cal/e', fields: { title: 'Turno' } } }} />);
    expect(screen.getByText(/turno/i)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://cal/e');
  });

  it('kind confirm (u otro no manejado) no renderiza nada — lo maneja HitlCard aparte', () => {
    const { container } = render(<ArtifactView card={{ kind: 'confirm', service: 'mercadopago', label: 'Mercado Pago' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('el botón Compartir llama a navigator.share cuando está disponible', () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } });
    render(<ArtifactView card={{ kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 5000 } }} />);
    fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://mpago.la/x' }));
  });

  it('sin navigator.share (fallback): el botón copia el link al portapapeles', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: writeTextMock } });
    render(<ArtifactView card={{ kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 5000 } }} />);
    fireEvent.click(screen.getByRole('button', { name: /compartir/i }));
    expect(writeTextMock).toHaveBeenCalledWith('https://mpago.la/x');
  });

  it.each(THEMES)('renderiza el artifact de pago bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<ArtifactView card={{ kind: 'payment_link', data: { url: 'https://mpago.la/x', amount: 5000 } }} />);
    expect(screen.getByRole('button', { name: /compartir/i })).toBeInTheDocument();
  });
});
