import { Surface } from '../../design-system';
import './ajustes.css';

/**
 * `PantallaAjustes` — M-WEB módulo 13: port de
 * `apps/mobile/src/modules/ajustes/PantallaAjustes.tsx` a `copiloto-web`. Mismo mecanismo que
 * `EscritorioScreen` (grid de tiles + callback genérico) — el mapeo `AjusteKey -> pantalla/tab` lo
 * hace el wiring del shell, no este componente.
 *
 * Mismas 6 entradas que mobile, mismo orden. El tile `apariencia` queda con su key intacta a
 * propósito: en web el selector de tema YA vive en `AccountScreen` (`useTheme()`/`THEMES`, 4 temas
 * `aurora`/`daylight`/`refined`/`ai`) — un sistema distinto de los 5 `SKINS` de mobile, y no existe
 * un `PantallaSkins` equivalente en web. A dónde apunta ese tile lo decide el shell.
 */
export type AjusteKey =
  | 'perfilNegocio'
  | 'facturacionAfip'
  | 'apps'
  | 'miPlan'
  | 'cuenta'
  | 'apariencia'
  | 'comoHablarle';

interface DefinicionTileAjuste {
  key: AjusteKey;
  label: string;
  icono: string;
}

/** Mismo orden que `TILES_AJUSTES` en mobile — ver ese archivo para el porqué de cada posición. */
const TILES_AJUSTES: readonly DefinicionTileAjuste[] = [
  { key: 'perfilNegocio', label: 'Mi negocio', icono: '💬' },
  { key: 'facturacionAfip', label: 'Facturación AFIP', icono: '🧾' },
  { key: 'apps', label: 'Apps conectadas', icono: '📁' },
  { key: 'miPlan', label: 'Mi plan', icono: '📊' },
  { key: 'cuenta', label: 'Mi cuenta', icono: '👤' },
  { key: 'apariencia', label: 'Apariencia', icono: '🎨' },
  { key: 'comoHablarle', label: 'Cómo hablarle', icono: '🎙️' },
];

export interface PantallaAjustesProps {
  /** Un handler único para las entradas del grid — el tile tocado se identifica por `key`. El
   *  mapeo `AjusteKey -> pantalla` del shell lo hace quien monte este componente, no acá. */
  onAjuste?: (key: AjusteKey) => void;
}

export function PantallaAjustes({ onAjuste }: PantallaAjustesProps = {}) {
  return (
    <div className="ajustes-screen" data-testid="pantalla-ajustes">
      <header className="ajustes-screen__header">
        <h1 className="ajustes-screen__title">Ajustes</h1>
      </header>

      <div className="ajustes-screen__grid" data-testid="ajustes-grid">
        {TILES_AJUSTES.map((t) => (
          <Surface
            key={t.key}
            variant="tile"
            className="ajustes-tile"
            data-testid={`ajuste-tile-${t.key}`}
            role="button"
            tabIndex={0}
            aria-label={t.label}
            onClick={() => onAjuste?.(t.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAjuste?.(t.key);
              }
            }}
          >
            <span className="ajustes-tile__icono" aria-hidden="true">{t.icono}</span>
            <span className="ajustes-tile__label">{t.label}</span>
          </Surface>
        ))}
      </div>
    </div>
  );
}
