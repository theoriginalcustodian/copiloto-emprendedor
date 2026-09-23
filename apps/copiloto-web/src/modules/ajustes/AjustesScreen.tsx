import { useState } from 'react';

import { PantallaAjustes, type AjusteKey } from './PantallaAjustes';
import { PantallaAndamiaje } from './PantallaAndamiaje';
import { PantallaApariencia } from './PantallaApariencia';
import { PantallaComoUsarLaApp } from './PantallaComoUsarLaApp';
import { PantallaFeedback } from './PantallaFeedback';
import { PantallaPerfilNegocio } from './negocio/PantallaPerfilNegocio';
import { PantallaTono } from './negocio/PantallaTono';
import { PantallaAfipSetup } from './afip/PantallaAfipSetup';
import './ajustes.css';

type SubVista = 'perfilNegocio' | 'tono' | 'facturacionAfip' | 'miPlan' | 'comoUsar' | 'apariencia' | 'feedback';

export interface AjustesScreenProps {
  /** `cuenta` navega al tab `account` existente (fusión con `AccountScreen`, M-WEB módulo 13).
   *  `apps` navega al tab `connections`. `chat` lo usa «Cómo usar la app» (BL-W12) para volver al
   *  chat principal con la pregunta ya dicha — ver `PantallaComoUsarLaApp.onAbrirChat`. `apariencia`
   *  tiene sub-vista propia (ver `SubVista`) -- revertido de "navega a account" el 2026-08-06 por
   *  pedido del operador: el selector de piel vivía escondido ahí (en el Rail de escritorio),
   *  "Apariencia" no mostraba ningún ajuste de apariencia. Ver `PantallaApariencia.tsx`. */
  onNavegarTab?: (tab: 'connections' | 'account' | 'chat') => void;
  /** «¿Algo no funciona?» de Feedback y el tile «Soporte técnico» (BL-W12) llevan los dos a la
   *  MISMA pantalla de soporte (`SoporteScreen`, funcion `soporte_tecnico`). Lo inyecta el shell. */
  onAbrirSoporte?: () => void;
}

/**
 * Contenedor de `ajustes` (M-WEB módulo 13) — orquesta el menú (`PantallaAjustes`) y sus 5
 * sub-pantallas propias (`perfilNegocio`/`facturacionAfip`/`miPlan`/`comoUsar`/`apariencia`)
 * con navegación LOCAL (mismo criterio que `PresupuestosScreen`/`InteligenciaScreen`: `useState`,
 * sin router). Las otras 3 entradas del menú (`apps`/`cuenta`/`soporte`) no tienen sub-vista propia
 * en web -- ya existen como tabs/pantallas del shell, así que delegan vía `onNavegarTab`/
 * `onAbrirSoporte`.
 */
export function AjustesScreen({ onNavegarTab, onAbrirSoporte }: AjustesScreenProps = {}) {
  const [vista, setVista] = useState<SubVista | null>(null);

  const handleAjuste = (key: AjusteKey) => {
    switch (key) {
      case 'apps':
        onNavegarTab?.('connections');
        return;
      case 'cuenta':
        onNavegarTab?.('account');
        return;
      case 'soporte':
        onAbrirSoporte?.();
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
      {vista === 'perfilNegocio' && <PantallaPerfilNegocio onAbrirTono={() => setVista('tono')} />}
      {vista === 'tono' && <PantallaTono />}
      {vista === 'facturacionAfip' && <PantallaAfipSetup />}
      {vista === 'comoUsar' && <PantallaComoUsarLaApp onAbrirChat={() => onNavegarTab?.('chat')} />}
      {vista === 'apariencia' && <PantallaApariencia />}
      {vista === 'feedback' && <PantallaFeedback onAbrirSoporte={onAbrirSoporte} contexto="ajustes" />}
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
