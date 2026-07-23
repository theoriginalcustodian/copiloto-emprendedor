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
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { destinoDe } from '../modules/actividad/destinoActividad';
import { ChatView } from '../modules/chat';
import { EscritorioFunciones, type FuncionKey } from '../modules/escritorio/EscritorioFunciones';
import { empujarUnaVez, reabrirNavegacion } from '../navegacion/empujarUnaVez';
import { PanelDeslizable } from './PanelDeslizable';

/**
 * A qué ruta navega cada tile del escritorio — 1:1 con los archivos de `app/` (`apps.tsx`,
 * `ajustes.tsx`, etc.). `Record<FuncionKey, string>` y no un `switch`/lookup suelto a propósito: si
 * mañana entra una `FuncionKey` nueva sin su ruta, esto no compila — mismo criterio que tenía
 * `CONTENIDO_POR_FUNCION` antes de esta convergencia.
 */
const RUTA_POR_FUNCION: Record<FuncionKey, string> = {
  facturacion: '/facturacion',
  ingresos: '/ingresos',
  gastos: '/gastos',
  presupuestos: '/presupuestos',
  clientes: '/clientes',
  midia: '/midia',
  inteligencia: '/inteligencia',
  contabilidad: '/contabilidad',
  ajustes: '/ajustes',
};

export function PantallaPrincipal() {
  // 🔴 El escritorio es la pantalla LANZADORA: cada vez que recupera el foco —al arrancar y al volver
  // de cualquier glass— reabre la puerta de navegación. Es la mitad que hace cumplir "un solo glass
  // hasta volver": al abrir uno, `empujarUnaVez` cierra la puerta; sólo este efecto la reabre. Clon
  // de `documed-front/apps/mobile/app/(tabs)/index.tsx`. Ver `empujarUnaVez.ts`.
  const [actividad, setActividad] = useState<readonly ActividadItem[]>([]);
  const [cargandoActividad, setCargandoActividad] = useState(true);
  const vivo = useRef(true);

  /**
   * 🔴 **La actividad se re-pide al RECUPERAR EL FOCO, no sólo al montar.** El escritorio es la
   * pantalla a la que se vuelve después de CADA operación: el emprendedor carga un gasto, cierra el
   * glass, y lo primero que ve es esta lista. Si sólo cargara al montar mostraría el estado de
   * **antes** de lo que acaba de hacer — y el dato viejo se ve **idéntico** al fresco, así que no
   * tiene forma de notar que le falta su propia operación. Es la lección de "Mis comprobantes", donde
   * el operador vio hasta la factura N° 15 mientras la 18 ya existía.
   *
   * No hay tirón para refrescar acá y no es un olvido: esto es la **capa de fondo de un panel
   * gestual**, no un scroll con `RefreshControl` — un gesto vertical propio competiría con el panel.
   * El foco cubre el caso real; lo que cambia desde otro dispositivo se ve al volver.
   *
   * Tampoco hay polling: gastaría batería para un caso que el foco ya cubre casi siempre.
   */
  useFocusEffect(
    useCallback(() => {
      reabrirNavegacion();
      let cancelado = false;
      void listarActividad({ limit: 20 })
        .then((res) => {
          if (cancelado || !vivo.current) return;
          // `no_disponible` deja la lista vacía y el texto honesto. **Nunca un fallback con datos
          // inventados**: convertiría cada caída del backend en una mentira silenciosa, que es
          // exactamente lo que hacía el mock que se borró.
          setActividad(res.status === 'ok' ? res.items : []);
          setCargandoActividad(false);
        })
        .catch(() => {
          if (!cancelado && vivo.current) {
            setActividad([]);
            setCargandoActividad(false);
          }
        });
      return () => {
        cancelado = true;
      };
    }, [])
  );

  // 🔴 `empujarUnaVez` y NO `router.push` directo. Verificado en device el 2026-07-21: dos toques
  // rápidos sobre un tile abren DOS glass apilados de la misma función, y un solo "Volver" cierra
  // uno — el segundo queda arriba, transparente, dejando ver el escritorio detrás mientras se traga
  // todos los toques. Se percibe exactamente como lo reportó el operador: *"cuando ingreso a apps y
  // luego salgo, al volver a la pantalla principal se queda bloqueada y no responde"*. La causa no
  // es el tile ni el gesto del panel (el instrumento mostró el `onBegin` llegando con `recorrido`
  // bien medido): es que la navegación no tenía invariante de "uno a la vez".
  const alFuncion = (key: FuncionKey) => empujarUnaVez(RUTA_POR_FUNCION[key]);

  /**
   * Tocar una operación de la lista la abre **en su función**, con su id.
   *
   * 🔴 `empujarUnaVez` y no `router.push`: dos toques rápidos apilarían dos glass de la misma
   * pantalla, y un solo "Volver" cerraría uno — el segundo queda arriba, transparente, tragándose los
   * toques. Ya se cazó en device.
   *
   * `destinoDe` devuelve `null` para los tipos sin destino, pero acá igual no llega: la fila no es
   * tocable en ese caso. La guarda está por si el mapeo y el pintado se desincronizan.
   */
  function alAbrirActividad(item: ActividadItem) {
    const destino = destinoDe(item);
    if (destino == null) return;
    empujarUnaVez({ pathname: destino.pathname, params: destino.params });
  }

  return (
    <PanelDeslizable testID="panel-principal" fondo={
        <EscritorioFunciones
          onFuncion={alFuncion}
          actividad={actividad}
          cargandoActividad={cargandoActividad}
          onAbrirActividad={alAbrirActividad}
          // El encabezado "Actividad reciente" entra a la lista COMPLETA. `empujarUnaVez` y no
          // `router.push`, igual que los tiles y las filas: dos toques rápidos apilarían dos glass.
          onVerRecientes={() => empujarUnaVez('/recientes')}
        />
      }>
      <ChatView />
    </PanelDeslizable>
  );
}
