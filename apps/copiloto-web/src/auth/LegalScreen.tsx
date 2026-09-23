import { LEGAL_TITULOS, LEGAL_VERSION, parrafosDe, type LegalKind } from '@copiloto/core';
import { Button, Surface } from '../design-system';
import './login.css';

/**
 * BETA-2.a (`contrato_planificacion-a-todos_SPRINT-beta-el-mapa.md`): páginas de ToS/Privacidad,
 * linkeadas desde `SignupScreen`. Texto real (BL-O6 parte A, 2026-09-22): nombra los terceros
 * verificados contra el código (`packages/core/src/legal.ts`), compartido con mobile para que no
 * diverja. El aviso de plantilla sigue en pantalla a propósito — retirarlo es decisión del
 * operador (`contrato_..._BL-O6-legal-parte-A...md` §3), no un olvido.
 *
 * Reusa `login.css` (mismo `.app-frame`/`Surface` que Login/Signup) — cero CSS nuevo para una
 * pantalla de puro texto.
 */

export type { LegalKind };

export interface LegalScreenProps {
  kind: LegalKind;
  onVolver: () => void;
}

export function LegalScreen({ kind, onVolver }: LegalScreenProps) {
  return (
    <div className="app-frame login-screen" data-testid={`legal-screen-${kind}`}>
      <div className="login-screen__inner">
        <div className="login-screen__brand">
          <span className="login-screen__brand-title">{LEGAL_TITULOS[kind]}</span>
        </div>

        <Surface variant="card" blur className="login-screen__card">
          <p
            role="note"
            className="login-screen__alert login-screen__alert--warning"
            data-testid="legal-screen-placeholder-notice"
          >
            Plantilla estándar genérica — no es una revisión legal específica de este negocio.
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {parrafosDe(kind).map((parrafo) => (
              <p key={parrafo.titulo}>
                <strong>{parrafo.titulo}</strong> {parrafo.cuerpo}
              </p>
            ))}
          </div>
          <p className="login-screen__version" data-testid="legal-screen-version">
            Versión {LEGAL_VERSION}
          </p>
        </Surface>

        <Button type="button" onClick={onVolver} className="login-screen__submit">
          Volver
        </Button>
      </div>
    </div>
  );
}
