/**
 * Pantalla principal del copiloto — el shell real: `PanelDeslizable` con el escritorio de 6 funciones
 * detrás (Capa 0) y la conversación adelante (Capa 1). Reemplaza el `index.tsx` que `git mv` renombró
 * a `spike.tsx` al arrancar el sprint mobile-first — ver el docstring de ese archivo.
 *
 * Ensambla piezas de otros frentes de este mismo sprint, todavía en construcción en paralelo:
 *   - `ChatView` real (F5) — hoy un placeholder intencional (ver `PlaceholderChat` abajo).
 *   - Las 5 pantallas de función (`src/modules/{ajustes,recientes,redes,metricas,facturacion}/**`,
 *     otros agentes de este sprint) — hoy `ContenidoFuncionPendiente` (abajo): un placeholder
 *     honesto, no un stub que finja funcionar. Importar esos módulos desde acá antes de que su forma
 *     final esté asentada arriesgaría un mismatch silencioso (tipo/export equivocado, verde falso) —
 *     el mismo criterio que ya usó `shell.test.tsx` para `@copiloto/core`. La integración real cablea
 *     `CONTENIDO_POR_FUNCION[key]` a cada pantalla cuando el port de cada módulo aterrice; ES el único
 *     punto a tocar.
 *
 * Cómo abren/cierran las 6 funciones: `CapaFuncion` (`src/modules/escritorio/CapaFuncion.tsx`) — capa
 * dentro de esta misma pantalla, NO ruta de expo-router. Ver el docstring de ese archivo para el
 * porqué (handoff del tirón del glass de función).
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CapaFuncion } from '../src/modules/escritorio/CapaFuncion';
import { EscritorioFunciones, TILES, type FuncionKey } from '../src/modules/escritorio/EscritorioFunciones';
import { PanelDeslizable } from '../src/shell/PanelDeslizable';
import { useTema } from '../src/theme/ThemeProvider';

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

/** Placeholder intencional del contenido de una función mientras su módulo real se porta en paralelo
 *  (ver docstring del archivo). Deliberadamente genérico: no simula datos ni comportamiento de
 *  ninguna función puntual — sería un stub, no un placeholder. */
function ContenidoFuncionPendiente({ label }: { label: string }) {
  const tema = useTema();
  return (
    <View style={styles.contenidoPendiente} testID="capa-funcion-contenido-pendiente">
      <Text
        style={{
          color: tema.color.textoTenue,
          fontFamily: tema.fuente.mono,
          fontSize: 12,
          textAlign: 'center',
          lineHeight: 18,
        }}
      >
        {label.toUpperCase()} SE CABLEA EN LA INTEGRACIÓN{'\n'}(módulo en construcción paralela)
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
        <CapaFuncion
          testID={`capa-funcion-${definicionActiva.key}`}
          titulo={definicionActiva.label}
          icono={definicionActiva.icono}
          onCerrar={() => setFuncionActiva(null)}
        >
          <ContenidoFuncionPendiente label={definicionActiva.label} />
        </CapaFuncion>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  placeholderChat: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  contenidoPendiente: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
