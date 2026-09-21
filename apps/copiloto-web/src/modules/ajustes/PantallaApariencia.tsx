import { ETIQUETA_PREFERENCIA, PREFERENCIAS_TEMA, type PielEfectiva, type PreferenciaTema } from '@copiloto/core';

import { useTheme } from '../../design-system/ThemeProvider';
import './ajustes.css';

/**
 * Muestra REAL de una piel: un bloque `data-muestra` que hereda los tokens de esa piel (themes.css
 * declara los mismos tokens bajo `[data-muestra='…']`), así el usuario ve el tema ANTES de elegirlo
 * y la muestra no puede desincronizarse de la piel de verdad. Cero hex acá.
 */
function Muestra({ piel }: { piel: PielEfectiva }) {
  return (
    <span className="apariencia-screen__muestra" data-muestra={piel} aria-hidden="true">
      <span className="apariencia-screen__muestra-texto">Aa</span>
      <span className="apariencia-screen__muestra-acento" />
    </span>
  );
}

function MuestraDe({ preferencia }: { preferencia: PreferenciaTema }) {
  if (preferencia !== 'sistema') return <Muestra piel={preferencia} />;
  // «Como el teléfono»: las dos pieles juntas, porque cuál se ve depende del sistema.
  return (
    <span className="apariencia-screen__muestra-doble" aria-hidden="true">
      <Muestra piel="claro" />
      <Muestra piel="oscuro" />
    </span>
  );
}

/**
 * `PantallaApariencia` — sub-vista propia de `apariencia` en Ajustes. BL-X4 (DA-5): dos pieles
 * (`Claro`/`Oscuro`, con muestra real) + «Como el teléfono», que sigue al sistema en vivo. La piel
 * `nocturno` se retiró: quien la tenía guardada pasa a `Oscuro` (ver `leerPreferenciaTema`).
 */
export function PantallaApariencia() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="apariencia-screen" data-testid="pantalla-apariencia">
      <h1 className="apariencia-screen__title">Apariencia</h1>
      <p className="apariencia-screen__intro">Elegí la piel del copiloto.</p>

      <div className="apariencia-screen__theme-grid" role="group" aria-label="Selector de tema">
        {PREFERENCIAS_TEMA.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === preference}
            data-testid={`theme-pill-${p}`}
            className={[
              'apariencia-screen__theme-pill',
              p === preference ? 'apariencia-screen__theme-pill--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setPreference(p)}
          >
            <MuestraDe preferencia={p} />
            <span>{ETIQUETA_PREFERENCIA[p]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
