import { Button, Surface } from '../design-system';
import './login.css';

/**
 * BETA-2.a (`contrato_planificacion-a-todos_SPRINT-beta-el-mapa.md`): páginas de ToS/Privacidad,
 * linkeadas desde `SignupScreen`. **SOLO el wiring** — el contenido es placeholder EXPLÍCITO
 * (marcado visualmente, no un texto legal real) hasta que el operador aporte el texto propio o
 * autorice una plantilla genérica (decisión operador #2, ver el contrato). No mezclar: nunca
 * publicar este placeholder como si fuera el texto final.
 *
 * Reusa `login.css` (mismo `.app-frame`/`Surface` que Login/Signup) — cero CSS nuevo para una
 * pantalla de puro texto.
 */

export type LegalKind = 'tos' | 'privacidad';

export interface LegalScreenProps {
  kind: LegalKind;
  onVolver: () => void;
}

const TITULOS: Record<LegalKind, string> = {
  tos: 'Términos y Condiciones',
  privacidad: 'Política de Privacidad',
};

export function LegalScreen({ kind, onVolver }: LegalScreenProps) {
  return (
    <div className="app-frame login-screen" data-testid={`legal-screen-${kind}`}>
      <div className="login-screen__inner">
        <div className="login-screen__brand">
          <span className="login-screen__brand-title">{TITULOS[kind]}</span>
        </div>

        <Surface variant="card" blur className="login-screen__card">
          <p
            role="note"
            className="login-screen__alert login-screen__alert--warning"
            data-testid="legal-screen-placeholder-notice"
          >
            🔴 Texto PLACEHOLDER — todavía no es el contenido legal final (pendiente decisión del
            operador: texto propio o plantilla genérica).
          </p>
          <p style={{ marginTop: 12 }}>
            Este es un texto de relleno para BETA-2.a. Acá va a vivir el contenido real de{' '}
            {TITULOS[kind].toLowerCase()} de Copiloto del Emprendedor una vez que esté definido.
          </p>
        </Surface>

        <Button type="button" onClick={onVolver} className="login-screen__submit">
          Volver
        </Button>
      </div>
    </div>
  );
}
