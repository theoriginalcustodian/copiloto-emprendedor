import { dejarPendiente, TEMAS_AYUDA } from '@copiloto/core';

import './ajustes.css';

/**
 * `PantallaComoUsarLaApp` — los cinco temas de ayuda (BL-W9), port del puente mobile
 * (`apps/mobile/src/modules/ajustes/PantallaComoUsarLaApp.tsx`).
 *
 * 🔴 **Cada tema abre el CHAT PRINCIPAL con la pregunta ya dicha, no un chat de ayuda propio.** Un
 * chat aparte era la misma duplicación que el sistema sacó con la solapa «Preguntar» de Inteligencia:
 * dos hilos que saben cosas distintas del mismo negocio. Tocar un tema deja la pregunta en el buzón
 * (`dejarPendiente`, de core) y navega al chat; `ChatScreen` la manda al montarse, con los datos del
 * emprendedor a mano. No hay backend nuevo.
 */
export interface PantallaComoUsarLaAppProps {
  /** Lleva al chat principal. Lo inyecta el shell (`changeTab('chat')`). */
  onAbrirChat: () => void;
}

export function PantallaComoUsarLaApp({ onAbrirChat }: PantallaComoUsarLaAppProps) {
  return (
    <div className="como-hablarle-screen" data-testid="pantalla-como-usar">
      <h1 className="como-hablarle-screen__title">Cómo usar la app</h1>
      <p className="como-hablarle-screen__intro">Lo que más se pregunta, contestado en dos minutos.</p>
      <div className="como-hablarle-screen__lista">
        {TEMAS_AYUDA.map((tema, i) => (
          <button
            key={tema.titulo}
            type="button"
            className="como-usar-tema"
            data-testid={`como-usar-tema-${i}`}
            onClick={() => {
              dejarPendiente(tema.pregunta);
              onAbrirChat();
            }}
          >
            <span className="como-usar-tema__titulo">{tema.titulo}</span>
            <span className="como-usar-tema__detalle">{tema.detalle}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
