/**
 * Pantalla principal del copiloto — el shell real: `PanelDeslizable` con el escritorio de 6 funciones
 * detrás (Capa 0) y la conversación adelante (Capa 1). Reemplaza el viejo `index.tsx` de exploración
 * del arranque del sprint mobile-first.
 *
 * `ChatView` (el chat real, `src/modules/chat`) está cableado en la Capa 1 del panel desde F5.
 *
 * 🔴 **Cómo abren las 6 funciones, y por qué cambió (2026-07-21).** Hasta acá esta pantalla montaba
 * `CapaFuncion` — una capa `Animated.View` `absoluteFill` como sibling DENTRO de esta misma pantalla,
 * sin `router.push`. Era una invención propia de este repo, no algo que documed tuviera: la app
 * canónica abre cada función como **ruta** de expo-router con `presentation: 'transparentModal'`, y
 * cada pantalla trae su propio `MarcoGlass`. En device, `CapaFuncion` se comía los toques — ningún
 * tile respondía, Apps no se podía abrir, el botón de grabación no reaccionaba, y el panel se
 * replegaba una vez y dejaba de responder (`coordinacion/2026-07-20_handoff_fixes-gestos-glass-mobile.
 * md`). La causa: una capa absoluta montada por encima de todo el árbol, capturando los eventos que
 * documed reparte entre rutas apiladas del stack de navegación.
 *
 * La corrección es clonar el mecanismo real: `alFuncion` ya no guarda estado local ni monta una capa
 * — navega. `CapaFuncion.tsx` se borró (junto con su test); el chrome de cada función (vidrio, handle,
 * título, "Volver") ahora lo aporta `MarcoGlass`, uno por pantalla, igual que `PantallaAjustes` y
 * `PantallaRecientes` ya lo hacían antes de esta convergencia.
 */
import { router } from 'expo-router';

import { ChatView } from '../modules/chat';
import { EscritorioFunciones, type FuncionKey } from '../modules/escritorio/EscritorioFunciones';
import { PanelDeslizable } from './PanelDeslizable';

/**
 * A qué ruta navega cada tile del escritorio — 1:1 con los archivos de `app/` (`apps.tsx`,
 * `ajustes.tsx`, etc.). `Record<FuncionKey, string>` y no un `switch`/lookup suelto a propósito: si
 * mañana entra una `FuncionKey` nueva sin su ruta, esto no compila — mismo criterio que tenía
 * `CONTENIDO_POR_FUNCION` antes de esta convergencia.
 */
const RUTA_POR_FUNCION: Record<FuncionKey, string> = {
  apps: '/apps',
  ajustes: '/ajustes',
  recientes: '/recientes',
  redes: '/redes',
  metricas: '/metricas',
  facturacion: '/facturacion',
};

export function PantallaPrincipal() {
  const alFuncion = (key: FuncionKey) => router.push(RUTA_POR_FUNCION[key]);

  return (
    <PanelDeslizable testID="panel-principal" fondo={<EscritorioFunciones onFuncion={alFuncion} />}>
      <ChatView />
    </PanelDeslizable>
  );
}
