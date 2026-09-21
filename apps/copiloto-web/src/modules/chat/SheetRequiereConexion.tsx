import { BottomSheet, Button } from '../../design-system';
import { ServiceIcon } from '../../design-system/serviceIcons';

import type { RequiereConexion } from '@copiloto/core';

export interface SheetRequiereConexionProps {
  /** `null` = cerrado. */
  conexion: RequiereConexion | null;
  onConectar: () => void;
  onAhoraNo: () => void;
  /** Mientras se pide el link de vinculación: evita el doble toque. */
  ocupado?: boolean;
  /** Mensaje de error de «Conectar» (no pudimos pedir el link). */
  error?: string | null;
}

/**
 * K-11 / BL-J8 — el sheet «conectá X» EN CONTEXTO: el chat sigue detrás (es un `BottomSheet` sobre el
 * hilo, no una pantalla nueva). Ícono + nombre + el `alcance` que viene del catálogo, y dos acciones del
 * MISMO tamaño (mismo `Button`, sin jerarquía que empuje a aceptar): «Conectar» / «Ahora no».
 */
export function SheetRequiereConexion({ conexion, onConectar, onAhoraNo, ocupado = false, error = null }: SheetRequiereConexionProps) {
  return (
    <BottomSheet open={conexion != null} onClose={onAhoraNo} ariaLabel={conexion != null ? `Conectar ${conexion.label}` : 'Conectar'}>
      {conexion != null && (
        <div className="sheet-conexion" data-testid="sheet-requiere-conexion">
          <div className="sheet-conexion__cabecera">
            <ServiceIcon serviceKey={conexion.service} name={conexion.label} size={44} radius={12} />
            <div>
              <h2 className="sheet-conexion__titulo">Conectá {conexion.label}</h2>
              <p className="sheet-conexion__sub">Para hacer eso necesito acceso a {conexion.label}.</p>
            </div>
          </div>
          {conexion.alcance.length > 0 && (
            <ul className="sheet-conexion__alcance" data-testid="sheet-requiere-conexion-alcance">
              {conexion.alcance.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          {error != null && (
            <p className="sheet-conexion__error" role="alert" data-testid="sheet-requiere-conexion-error">
              {error}
            </p>
          )}
          <div className="sheet-conexion__acciones">
            <Button variant="primary" onClick={onConectar} disabled={ocupado} data-testid="sheet-requiere-conexion-conectar">
              Conectar
            </Button>
            <Button variant="cancel" onClick={onAhoraNo} data-testid="sheet-requiere-conexion-ahora-no">
              Ahora no
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
