import type { ActividadItem } from '@copiloto/core';

import { Surface } from '../../design-system';
import { FilaActividad } from '../actividad/FilaActividad';
import './escritorio.css';

/**
 * `EscritorioScreen` — M-WEB módulo 7: port de
 * `apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx` a `copiloto-web`. Mismo mecanismo
 * (grid de tiles + actividad reciente debajo), NO reemplazado por navegación de sidebar — es una
 * decisión de UX ya tomada por el operador ("móvil y web deben ser espejos"), no una redundancia
 * con el `Rail` de escritorio.
 *
 * Composición pura, igual que mobile: sin lógica de navegación ni de red acá — el fetch de
 * actividad y el mapeo `FuncionKey -> TabKey` los cablea el shell (Task de wiring posterior), vía
 * `onFuncion`/`onAbrirGasto`/`onAbrirCliente`/`onVerRecientes`.
 *
 * El grid no scrollea horizontal como en mobile (acá no hay el mismo problema de ancho acotado):
 * 9 tiles entran cómodos en un CSS grid de 3 columnas, mismo criterio de grid plano que
 * `connections-screen__grid`.
 */
export type FuncionKey =
  | 'facturacion'
  | 'ingresos'
  | 'gastos'
  | 'presupuestos'
  | 'clientes'
  | 'midia'
  | 'inteligencia'
  | 'contabilidad'
  | 'ajustes';

interface DefinicionTile {
  key: FuncionKey;
  label: string;
  icono: string;
}

/**
 * Mismo orden que `TILES` en mobile — las primeras cuatro son las OPERATIVAS (facturar, cobrar,
 * gastar, presupuestar), no un orden cronológico de cuándo se construyó cada función. Ver el
 * docstring de `apps/mobile/src/modules/escritorio/EscritorioFunciones.tsx` para el porqué
 * completo; acá se hereda el orden ya validado, no se vuelve a decidir.
 *
 * Íconos: emoji directo, mismo criterio que `ICONO_POR_TIPO` de `FilaActividad` — web no tiene un
 * catálogo `GlassIcon` propio, así que no se inventa uno para 9 tiles.
 */
export const TILES: readonly DefinicionTile[] = [
  { key: 'facturacion', label: 'Facturación', icono: '🧾' },
  { key: 'ingresos', label: 'Ingresos', icono: '📈' },
  { key: 'gastos', label: 'Gastos', icono: '💸' },
  { key: 'presupuestos', label: 'Presupuestos', icono: '📝' },
  { key: 'clientes', label: 'Clientes', icono: '👤' },
  { key: 'midia', label: 'Mi día', icono: '🕐' },
  { key: 'inteligencia', label: 'Inteligencia de Negocio', icono: '📊' },
  { key: 'contabilidad', label: 'Contabilidad', icono: '📁' },
  { key: 'ajustes', label: 'Ajustes', icono: '⚙️' },
];

export const KEYS_OPERATIVAS: readonly FuncionKey[] = [
  'facturacion',
  'ingresos',
  'gastos',
  'presupuestos',
];

export interface EscritorioScreenProps {
  /** Un handler único para todas las funciones del grid — el tile tocado se identifica por `key`.
   *  El mapeo `FuncionKey -> TabKey` del shell lo hace quien monte este componente, no acá. */
  onFuncion?: (key: FuncionKey) => void;
  /** Las últimas operaciones REALES del emprendedor. Este componente NO consulta: recibe — el
   *  fetch vive en el shell, igual que en mobile. */
  actividad?: readonly ActividadItem[];
  /** `true` mientras el shell trae la primera página — para no pintar el vacío antes de tiempo. */
  cargandoActividad?: boolean;
  onAbrirGasto?: (id: number) => void;
  onAbrirCliente?: (id: number) => void;
  /** Tocar el encabezado "Actividad reciente" → entra a la lista completa. Si no se pasa, el
   *  encabezado se muestra sin flecha, no tapeable. */
  onVerRecientes?: () => void;
}

export function EscritorioScreen({
  onFuncion,
  actividad = [],
  cargandoActividad = false,
  onAbrirGasto,
  onAbrirCliente,
  onVerRecientes,
}: EscritorioScreenProps = {}) {
  return (
    <div className="escritorio-screen" data-testid="pantalla-escritorio">
      <header className="escritorio-screen__header">
        <h1 className="escritorio-screen__title">Funciones</h1>
      </header>

      <div className="escritorio-screen__grid" data-testid="escritorio-grid">
        {TILES.map((t) => (
          <Surface
            key={t.key}
            variant="tile"
            className="escritorio-tile"
            data-testid={`tile-${t.key}`}
            role="button"
            tabIndex={0}
            aria-label={t.label}
            onClick={() => onFuncion?.(t.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onFuncion?.(t.key);
              }
            }}
          >
            <span className="escritorio-tile__icono" aria-hidden="true">{t.icono}</span>
            <span className="escritorio-tile__label">{t.label}</span>
          </Surface>
        ))}
      </div>

      <button
        type="button"
        className="escritorio-screen__encabezado-recientes"
        data-testid="escritorio-encabezado-recientes"
        onClick={onVerRecientes}
        disabled={onVerRecientes == null}
      >
        <span>Actividad reciente</span>
        {onVerRecientes != null && <span aria-hidden="true">›</span>}
      </button>

      <div className="escritorio-screen__actividad" data-testid="escritorio-actividad">
        {!cargandoActividad && actividad.length === 0 && (
          <p className="escritorio-screen__vacio" data-testid="escritorio-actividad-vacia">
            Todavía no hay movimientos. Lo que hagas va a aparecer acá.
          </p>
        )}
        {actividad.map((item) => (
          <FilaActividad
            key={item.id}
            item={item}
            onAbrirGasto={onAbrirGasto}
            onAbrirCliente={onAbrirCliente}
          />
        ))}
      </div>
    </div>
  );
}
