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

// preg-datos (C-D5): la card `datos_negocio`. Los payloads son los que emite
// `apps/copiloto/datos_card.py` (medidos en vivo el 2026-10-13), no armados a mano.
describe('ArtifactView — datos_negocio (preg-datos)', () => {
  const ESTE_MES = {
    kind: 'datos_negocio',
    data: {
      titulo: 'Este mes',
      cifras: [
        { k: 'Entró', v: '$0,00' },
        { k: 'Salió', v: '$0,00' },
        { k: 'Queda', v: '$0,00' },
        { k: 'Facturado', v: '$0,00' },
        { k: 'Cobrado', v: '$0,00' },
      ],
      chip: 'Al 13 de octubre',
      nota: 'Mercado Pago está desconectado: lo que entró puede estar incompleto. Reconectalo para ver el número real.',
    },
  };

  it('pinta el título, las 5 cifras en orden y el chip', () => {
    render(<ArtifactView card={ESTE_MES} />);
    expect(screen.getByTestId('datos-negocio-titulo')).toHaveTextContent('Este mes');
    expect(screen.getByTestId('datos-negocio-chip')).toHaveTextContent('Al 13 de octubre');
    ['Entró', 'Salió', 'Queda', 'Facturado', 'Cobrado'].forEach((clave, i) => {
      expect(screen.getByTestId(`datos-negocio-cifra-${i}`)).toHaveTextContent(clave);
    });
    expect(screen.queryByTestId('datos-negocio-cifra-5')).not.toBeInTheDocument();
  });

  it('🔴 pinta la `nota` cuando viene: es la salvedad que cambia cómo se lee el número', () => {
    render(<ArtifactView card={ESTE_MES} />);
    expect(screen.getByTestId('datos-negocio-nota')).toHaveTextContent(/Mercado Pago está desconectado/);
  });

  it('con más de una cifra y chip null: no pinta píldora vacía', () => {
    render(
      <ArtifactView
        card={{
          kind: 'datos_negocio',
          data: {
            titulo: 'Lo que te deben',
            cifras: [
              { k: 'Total', v: '$205.000,00' },
              { k: 'Vencido', v: '$120.000,00' },
            ],
            chip: null,
            nota: '«Vencido» es lo emitido hace más de 30 días y todavía impago.',
          },
        }}
      />,
    );
    expect(screen.getByTestId('datos-negocio-cifra-0')).toHaveTextContent('$205.000,00');
    expect(screen.getByTestId('datos-negocio-cifra-1')).toHaveTextContent('$120.000,00');
    expect(screen.queryByTestId('datos-negocio-chip')).not.toBeInTheDocument();
  });

  it('sin `nota` no pinta un renglón vacío, y el valor se pinta TAL CUAL', () => {
    render(
      <ArtifactView
        card={{
          kind: 'datos_negocio',
          data: {
            titulo: 'Facturado por mes',
            cifras: [{ k: 'septiembre 2026', v: '$2.500,00 · 3 comprobantes' }],
            chip: 'Últimos 6 meses',
            nota: null,
          },
        }}
      />,
    );
    expect(screen.queryByTestId('datos-negocio-nota')).not.toBeInTheDocument();
    expect(screen.getByText('$2.500,00 · 3 comprobantes')).toBeInTheDocument();
  });

  it('sin cifras legibles no renderiza nada (queda el texto del bubble), igual que un kind desconocido', () => {
    const { container } = render(
      <ArtifactView card={{ kind: 'datos_negocio', data: { titulo: 'En qué gastaste', cifras: [], chip: null, nota: null } }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('control negativo: un kind desconocido con forma parecida sigue sin renderizar nada', () => {
    const { container } = render(
      <ArtifactView card={{ kind: 'datos_otros', data: ESTE_MES.data }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each(THEMES)('renderiza la card de datos bajo el tema "%s" sin romper', (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<ArtifactView card={ESTE_MES} />);
    expect(screen.getByTestId('datos-negocio')).toBeInTheDocument();
  });
});
