import { useTheme, type Theme } from '../../design-system/ThemeProvider';
import './ajustes.css';

/** Nombres es-AR del selector de tema — mismos IDs internos (`claro`/`oscuro`/`nocturno`) que
 *  `ThemeProvider`, solo la etiqueta visible. Duplicado deliberado de `Rail.tsx` (no exportado
 *  desde ahí, y ahora ese selector se retiró del rail — ver docstring de este componente). */
const THEME_LABELS: Record<Theme, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  nocturno: 'Nocturno',
};

/**
 * `PantallaApariencia` — sub-vista propia de `apariencia` en Ajustes (antes navegaba a `Cuenta`,
 * decisión revertida por pedido directo del operador 2026-08-06: el selector de piel vivía en el
 * Rail de escritorio, oculto ahí dentro de `AccountScreen` — "Apariencia" mostraba datos de cuenta,
 * no ajustes de apariencia). El selector se movió ACÁ desde dos lugares (`Rail.tsx` en escritorio,
 * la sección "Elegí el tema" de `AccountScreen.tsx` en mobile-web) para que exista un solo dueño.
 */
export function PantallaApariencia() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="apariencia-screen" data-testid="pantalla-apariencia">
      <h1 className="apariencia-screen__title">Apariencia</h1>
      <p className="apariencia-screen__intro">Elegí la piel del copiloto.</p>

      <div className="apariencia-screen__theme-grid" role="group" aria-label="Selector de tema">
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={t === theme}
            data-testid={`theme-pill-${t}`}
            className={[
              'apariencia-screen__theme-pill',
              t === theme ? 'apariencia-screen__theme-pill--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setTheme(t)}
          >
            {THEME_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
