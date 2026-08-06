import { useState } from 'react';

import { PantallaAjustes, type AjusteKey } from './PantallaAjustes';
import { PantallaAndamiaje } from './PantallaAndamiaje';
import { PantallaApariencia } from './PantallaApariencia';
import { PantallaComoHablarle } from './PantallaComoHablarle';
import { PantallaPerfilNegocio } from './negocio/PantallaPerfilNegocio';
import { PantallaAfipSetup } from './afip/PantallaAfipSetup';
import './ajustes.css';

type SubVista = 'perfilNegocio' | 'facturacionAfip' | 'miPlan' | 'comoHablarle' | 'apariencia';

export interface AjustesScreenProps {
  /** `cuenta` navega al tab `account` existente (fusión con `AccountScreen`, M-WEB módulo 13).
   *  `apps` navega al tab `connections`. `apariencia` tiene sub-vista propia (ver `SubVista`) --
   *  revertido de "navega a account" el 2026-08-06 por pedido del operador: el selector de piel
   *  vivía escondido ahí (en el Rail de escritorio), "Apariencia" no mostraba ningún ajuste de
   *  apariencia. Ver `PantallaApariencia.tsx`. */
  onNavegarTab?: (tab: 'connections' | 'account') => void;
}

/**
 * Contenedor de `ajustes` (M-WEB módulo 13) — orquesta el menú (`PantallaAjustes`) y sus 5
 * sub-pantallas propias (`perfilNegocio`/`facturacionAfip`/`miPlan`/`comoHablarle`/`apariencia`)
 * con navegación LOCAL (mismo criterio que `PresupuestosScreen`/`InteligenciaScreen`: `useState`,
 * sin router). Las otras 2 entradas del menú (`apps`/`cuenta`) no tienen pantalla propia en web --
 * ya existen como tabs del shell, así que delegan vía `onNavegarTab`.
 */
export function AjustesScreen({ onNavegarTab }: AjustesScreenProps = {}) {
  const [vista, setVista] = useState<SubVista | null>(null);

  const handleAjuste = (key: AjusteKey) => {
    switch (key) {
      case 'apps':
        onNavegarTab?.('connections');
        return;
      case 'cuenta':
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
      {vista === 'apariencia' && <PantallaApariencia />}
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
