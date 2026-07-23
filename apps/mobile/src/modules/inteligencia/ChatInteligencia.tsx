import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { preguntarInteligencia, type FuenteInteligencia } from '@copiloto/core';

import { Burbuja } from '../chat/Burbuja';
import { Composer } from '../chat/Composer';
import { useTema } from '../../theme/ThemeProvider';
import { generarId } from '../../util/id';

/**
 * `ChatInteligencia` — **preguntarle al copiloto sobre el negocio en lenguaje natural** («¿cuánto
 * gasté en nafta este mes?»). Item #5 del `contrato_ADELANTAR`, la cáscara del §3.3.
 *
 * 🔴 **NO es el chat durable principal.** Aquel (`ChatView`/`useChat`) es una conversación permanente
 * con polling, voz y durabilidad Temporal. Éste es un **Q&A sincrónico** contra `POST /inteligencia/chat`:
 * pregunta → «pensando» → respuesta con sus fuentes. Reusa los primitivos de vidrio (`Burbuja`,
 * `Composer`) para verse igual, pero su máquina de estado es de una sola ida y vuelta, no el loop
 * durable — mezclarlos sería arrastrar la maquinaria del chat permanente a algo que no la necesita.
 *
 * 🔴 **[PROVISIONAL — grafo] — la costura vive en `preguntarInteligencia`, no acá.** Toda la forma de
 * la respuesta (`{respuesta, fuentes}`) depende del grafo (hito 5, en curso). Esta pantalla habla sólo
 * con esa función; el día que el grafo fije la forma real, se recablea el cliente y esto no se toca.
 *
 * 🔴 **Sin fondo ni marco propios** — igual que `ChatView`: vive DENTRO del contenedor de la función
 * de IN (donde lo monte la navegación, que es una decisión de placement pendiente). Un `backgroundColor`
 * acá taparía el vidrio de atrás.
 *
 * 🔴 **`no_disponible` NO es una respuesta vacía del chat.** Si el endpoint todavía no está desplegado,
 * `preguntarInteligencia` degrada a `no_disponible` y acá se dice con una burbuja honesta —«todavía no
 * está disponible»—, no con una respuesta en blanco que se leería como «el copiloto no supo qué
 * contestar». Y una respuesta REAL vacía (`''`, el grafo sin datos) tampoco se pinta en blanco: se
 * reemplaza por un texto que dice que no hay datos, no que la pregunta falló.
 */

type Rol = 'user' | 'assistant';

interface Turno {
  id: string;
  rol: Rol;
  texto: string;
  fuentes: readonly FuenteInteligencia[];
}

type Estado = 'idle' | 'pensando' | 'error';

const TEXTO_NO_DISPONIBLE =
  'El resumen de tu negocio todavía no está disponible en tu copiloto. Cuando lo esté, vas a poder preguntarle acá.';
const TEXTO_SIN_DATOS = 'Todavía no tengo datos para responder eso.';

export function ChatInteligencia() {
  const tema = useTema();
  const [turnos, setTurnos] = useState<readonly Turno[]>([]);
  const [estado, setEstado] = useState<Estado>('idle');
  const scrollRef = useRef<ScrollView>(null);
  const vivo = useRef(true);

  const agregar = useCallback((t: Turno) => setTurnos((prev) => [...prev, t]), []);

  const preguntar = useCallback(
    (texto: string) => {
      const limpio = texto.trim();
      if (limpio === '' || estado === 'pensando') return;

      agregar({ id: generarId(), rol: 'user', texto: limpio, fuentes: [] });
      setEstado('pensando');

      void (async () => {
        try {
          const res = await preguntarInteligencia(limpio);
          if (!vivo.current) return;
          if (res.status === 'no_disponible') {
            agregar({ id: generarId(), rol: 'assistant', texto: TEXTO_NO_DISPONIBLE, fuentes: [] });
            setEstado('idle');
            return;
          }
          // Una respuesta REAL vacía es un caso del grafo sin datos: se dice, no se pinta en blanco.
          const cuerpo = res.respuesta.respuesta.trim() === '' ? TEXTO_SIN_DATOS : res.respuesta.respuesta;
          agregar({ id: generarId(), rol: 'assistant', texto: cuerpo, fuentes: res.respuesta.fuentes });
          setEstado('idle');
        } catch {
          // Un error de un endpoint desplegado-pero-fallando (lo propaga el cliente): el composer lo
          // muestra como error real, no como «todavía no está». El usuario puede reintentar.
          if (vivo.current) setEstado('error');
        }
      })();
    },
    [estado, agregar],
  );

  return (
    <KeyboardAvoidingView testID="chat-inteligencia" behavior="padding" style={styles.contenedor}>
      <ScrollView
        ref={scrollRef}
        style={styles.lista}
        contentContainerStyle={[styles.listaContenido, { padding: tema.espacio.md, gap: tema.espacio.sm }]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {turnos.length === 0 && (
          <Text
            testID="chat-inteligencia-vacio"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center', padding: tema.espacio.lg }}
          >
            Preguntale a tu copiloto sobre tu negocio. Por ejemplo: «¿cuánto gasté este mes?» o «¿quién me
            debe?».
          </Text>
        )}

        {turnos.map((t) => (
          <View key={t.id} style={t.rol === 'user' ? styles.filaUsuario : styles.filaAsistente}>
            <Burbuja role={t.rol} text={t.texto} />
            {t.fuentes.length > 0 && <Fuentes fuentes={t.fuentes} testID={`chat-inteligencia-fuentes-${t.id}`} />}
          </View>
        ))}
      </ScrollView>

      <Composer
        sendStatus={estado === 'pensando' ? 'sending' : estado === 'error' ? 'error' : 'idle'}
        onSend={preguntar}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * Las fuentes que respaldan una respuesta, como chips debajo de la burbuja del asistente.
 *
 * 🔴 **[PROVISIONAL — grafo].** `tipo`/`ref` son la forma del §3.3; el chip los muestra tal cual sin
 * ramificar sobre ellos (un `tipo` desconocido se pinta igual). Cuando el grafo fije qué es una fuente
 * —y si `ref` es tappable a un detalle—, se decide acá; hoy es una etiqueta informativa.
 */
function Fuentes({ fuentes, testID }: { fuentes: readonly FuenteInteligencia[]; testID: string }) {
  const tema = useTema();
  return (
    <View testID={testID} style={styles.fuentes}>
      {fuentes.map((f, i) => (
        <View
          key={`${f.ref}-${i}`}
          style={[styles.chip, { backgroundColor: tema.glass.chip, borderColor: tema.color.borde }]}
        >
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.mono }}>
            {f.tipo !== '' ? `${f.tipo} · ${f.ref}` : f.ref}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // SIN `backgroundColor` a propósito — vive dentro del vidrio de la función de IN. Ver docstring.
  contenedor: { flex: 1 },
  lista: { flex: 1 },
  listaContenido: { flexGrow: 1 },
  filaUsuario: { alignItems: 'flex-end', gap: 4 },
  filaAsistente: { alignItems: 'flex-start', gap: 4 },
  fuentes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, maxWidth: '85%' },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
});
