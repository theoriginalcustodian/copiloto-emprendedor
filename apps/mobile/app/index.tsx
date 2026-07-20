/**
 * Pantalla principal del copiloto — el shell real: `PanelDeslizable` con el escritorio de 6 funciones
 * detrás (Capa 0) y la conversación adelante (Capa 1). Reemplaza el `index.tsx` que `git mv` renombró
 * a `spike.tsx` al arrancar el sprint mobile-first — ver el docstring de ese archivo.
 *
 * `ChatView` real llega en F5 — hoy hay un placeholder intencional (ver `PlaceholderChat` abajo).
 * Las 6 pantallas de función YA están cableadas en `CONTENIDO_POR_FUNCION`.
 *
 * Cómo abren/cierran las 6 funciones: `CapaFuncion` (`src/modules/escritorio/CapaFuncion.tsx`) — capa
 * dentro de esta misma pantalla, NO ruta de expo-router. Ver el docstring de ese archivo para el
 * porqué (handoff del tirón del glass de función).
 *
 * 🔴 **El contrato entre la capa y la pantalla, que se descubrió al integrar:** `CapaFuncion` aporta
 * el *chrome* (el vidrio, el ícono, el nombre, el Cerrar); cada pantalla aporta sólo su *contenido*.
 * Las pantallas nacieron como autónomas —con fondo opaco y título propios— y así montadas tapaban el
 * vidrio y duplicaban el nombre. Cada una tiene ahora un test que lo fija; si alguien vuelve a
 * ponerle `backgroundColor` a una pantalla de función, el glass desaparece y el test lo caza.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PantallaAjustes } from '../src/modules/ajustes';
import { PantallaApps } from '../src/modules/apps';
import { CapaFuncion } from '../src/modules/escritorio/CapaFuncion';
import { EscritorioFunciones, TILES, type FuncionKey } from '../src/modules/escritorio/EscritorioFunciones';
import { PantallaFacturacion } from '../src/modules/facturacion';
import { PantallaMetricas } from '../src/modules/metricas';
import { PantallaRecientes } from '../src/modules/recientes';
import { PantallaRedes } from '../src/modules/redes';
import { PanelDeslizable } from '../src/shell/PanelDeslizable';
import { useTema } from '../src/theme/ThemeProvider';

/**
 * Qué contenido monta cada función. Es el ÚNICO punto de wiring: agregar una función es agregar su
 * tile en `EscritorioFunciones` y su entrada acá.
 *
 * `Record<FuncionKey, ...>` y no un objeto suelto a propósito: si mañana entra una `FuncionKey`
 * nueva y nadie le da contenido, no compila. La alternativa —un lookup que devuelve `undefined`—
 * fallaría en runtime, en el teléfono, con una capa vacía y sin pista de por qué.
 */
const CONTENIDO_POR_FUNCION: Record<FuncionKey, React.ComponentType> = {
  apps: PantallaApps,
  ajustes: PantallaAjustes,
  recientes: PantallaRecientes,
  redes: PantallaRedes,
  metricas: PantallaMetricas,
  facturacion: PantallaFacturacion,
};

/** Placeholder intencional del chat (F5 lo reemplaza por `ChatView` real). Vive en Capa 1, dentro del
 *  cristal de conversación del panel — mismo lugar donde entra `ChatView`, así que este componente
 *  desaparece entero cuando F5 aterriza; no hay wiring adicional que deshacer. */
function PlaceholderChat() {
  const tema = useTema();
  return (
    <View style={styles.placeholderChat} testID="chat-placeholder">
      <Text
        style={{
          color: tema.color.texto,
          fontFamily: tema.fuente.uiSemibold,
          fontSize: tema.tipo.grande,
          textAlign: 'center',
        }}
      >
        Copiloto del Emprendedor
      </Text>
      <Text
        style={{
          color: tema.color.textoTenue,
          fontFamily: tema.fuente.ui,
          fontSize: tema.tipo.base,
          textAlign: 'center',
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        La conversación se cablea en la próxima fase del sprint. Deslizá hacia abajo para ver el
        escritorio de funciones.
      </Text>
    </View>
  );
}


const DEFINICION_POR_KEY = new Map(TILES.map((t) => [t.key, t]));

export default function PantallaPrincipal() {
  // La función cuya capa está abierta — `null` = ninguna. El escritorio es la única fuente de qué
  // tile se tocó; esta pantalla sólo decide qué hacer con esa key (abrir la capa).
  const [funcionActiva, setFuncionActiva] = useState<FuncionKey | null>(null);

  const alFuncion = (key: FuncionKey) => setFuncionActiva(key);
  const definicionActiva = funcionActiva ? DEFINICION_POR_KEY.get(funcionActiva) : undefined;

  return (
    <>
      <PanelDeslizable
        testID="panel-principal"
        fondo={<EscritorioFunciones onFuncion={alFuncion} onAbrirSpike={() => router.push('/spike')} />}
      >
        <PlaceholderChat />
      </PanelDeslizable>

      {/* La capa de función — mecanismo en `CapaFuncion.tsx`. Montar/desmontar acá (no un prop
          `visible` interno) es lo que decide cuándo hay UNA función abierta: nunca dos a la vez, y
          cerrar es simplemente sacarla del árbol. */}
      {definicionActiva ? (
        (() => {
          const Contenido = CONTENIDO_POR_FUNCION[definicionActiva.key];
          return (
            <CapaFuncion
              testID={`capa-funcion-${definicionActiva.key}`}
              titulo={definicionActiva.label}
              icono={definicionActiva.icono}
              onCerrar={() => setFuncionActiva(null)}
            >
              <Contenido />
            </CapaFuncion>
          );
        })()
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  placeholderChat: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
