import { ETIQUETA_PREFERENCIA, type PielEfectiva } from '@copiloto/core';

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

/** Las dos pieles reales, lado a lado. «Como el teléfono» (regla, no piel) va aparte, abajo. */
const PIELES: readonly PielEfectiva[] = ['claro', 'oscuro'];

/**
 * `PantallaApariencia` — sub-vista propia de `apariencia` en Ajustes. BL-X4 (DA-5): dos pieles
 * (`Claro`/`Oscuro`, con muestra real) + «Como el teléfono», que sigue al sistema en vivo. La piel
 * `nocturno` se retiró: quien la tenía guardada pasa a `Oscuro` (ver `leerPreferenciaTema`).
 *
 * H-A4-7: layout del prototipo (`deck-assets/frames/proto-apar.png`) — Claro/Oscuro como 2 tiles
 * lado a lado (antes: 3 pills apiladas), «Como el teléfono» como fila propia con subtítulo, y una
 * nota explicativa al pie. Misma lógica de `useTheme`, sin cambios de comportamiento.
 */
export function PantallaApariencia() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="apariencia-screen" data-testid="pantalla-apariencia">
      <h1 className="apariencia-screen__title">Apariencia</h1>
      <p className="apariencia-screen__intro">
        Dos temas. Cambia el fondo y el texto; la marca, la tipografía y los componentes son los
        mismos.
      </p>

      <span className="apariencia-screen__etiqueta">Elegí el tema</span>

      <div className="apariencia-screen__tema-grid" role="group" aria-label="Selector de tema">
        {PIELES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === preference}
            data-testid={`theme-pill-${p}`}
            className={[
              'apariencia-screen__tema-tile',
              p === preference ? 'apariencia-screen__tema-tile--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setPreference(p)}
          >
            <Muestra piel={p} />
            <span>{ETIQUETA_PREFERENCIA[p]}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-pressed={preference === 'sistema'}
        data-testid="theme-pill-sistema"
        className={[
          'apariencia-screen__sistema-fila',
          preference === 'sistema' ? 'apariencia-screen__sistema-fila--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setPreference('sistema')}
      >
        <span className="apariencia-screen__sistema-textos">
          <span className="apariencia-screen__sistema-titulo">{ETIQUETA_PREFERENCIA.sistema}</span>
          <span className="apariencia-screen__sistema-detalle">Cambia solo según tu sistema</span>
        </span>
        <span className="apariencia-screen__sistema-chevron" aria-hidden="true">
          ›
        </span>
      </button>

      <p className="apariencia-screen__nota">
        <span aria-hidden="true">ⓘ</span> El tema cambia el fondo y el texto. La terracota, la
        tipografía y los componentes son los mismos en los dos.
      </p>
    </div>
  );
}
