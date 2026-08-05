import { useState } from 'react';

import { PantallaAjustes, type AjusteKey } from './PantallaAjustes';
import { PantallaAndamiaje } from './PantallaAndamiaje';
import { PantallaComoHablarle } from './PantallaComoHablarle';
import { PantallaPerfilNegocio } from './negocio/PantallaPerfilNegocio';
import { PantallaAfipSetup } from './afip/PantallaAfipSetup';
import './ajustes.css';

type SubVista = 'perfilNegocio' | 'facturacionAfip' | 'miPlan' | 'comoHablarle';

export interface AjustesScreenProps {
  /** `cuenta` y `apariencia` (decisión de planificación, M-WEB módulo 13) ya viven fusionados en
   *  `AccountScreen` -- navegan al tab `account`. `apps` ya es el tab `connections` existente.
   *  Estas 3 keys salen del módulo; el resto queda en un sub-view interno (ver `SubVista`). */
  onNavegarTab?: (tab: 'connections' | 'account') => void;
}

/**
 * Contenedor de `ajustes` (M-WEB módulo 13) — orquesta el menú (`PantallaAjustes`) y sus 4
 * sub-pantallas propias (`perfilNegocio`/`facturacionAfip`/`miPlan`/`comoHablarle`) con
 * navegación LOCAL (mismo criterio que `PresupuestosScreen`/`InteligenciaScreen`: `useState`, sin
 * router). Las otras 3 entradas del menú (`apps`/`cuenta`/`apariencia`) no tienen pantalla propia
 * en web -- ya existen como tabs del shell, así que delegan vía `onNavegarTab`.
 */
export function AjustesScreen({ onNavegarTab }: AjustesScreenProps = {}) {
  const [vista, setVista] = useState<SubVista | null>(null);

  const handleAjuste = (key: AjusteKey) => {
    switch (key) {
      case 'apps':
        onNavegarTab?.('connections');
        return;
      case 'cuenta':
      case 'apariencia':
        onNavegarTab?.('account');
        return;
      default:
        setVista(key);
    }
  };

  if (vista == null) {
    return <PantallaAjustes onAjuste={handleAjuste} />;
  }

  return (
    <div className="ajustes-subvista">
      <button
        type="button"
        className="ajustes-subvista__volver"
        data-testid="ajustes-volver"
        onClick={() => setVista(null)}
      >
        ‹ Ajustes
      </button>
      {vista === 'perfilNegocio' && <PantallaPerfilNegocio />}
      {vista === 'facturacionAfip' && <PantallaAfipSetup />}
      {vista === 'comoHablarle' && <PantallaComoHablarle />}
      {vista === 'miPlan' && (
        <PantallaAndamiaje
          titulo="Mi plan"
          icono="📊"
          mensaje="Todavía no hay planes disponibles para elegir — esto llega en otra etapa."
        />
      )}
    </div>
  );
}
