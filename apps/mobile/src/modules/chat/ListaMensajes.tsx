import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlatList, Pressable } from 'react-native-gesture-handler';
import type { ListRenderItemInfo } from 'react-native';

import {
  leerClientePropuesto,
  leerFacturaPropuesta,
  leerGastoPropuesto,
  leerIngresoPropuesto,
  leerPresupuestoPropuesto,
  mapearGate,
  type ChatMessage,
  type Gate,
} from '@copiloto/core';

import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { pressableStyle } from '../../theme/glass/presion';
import { Marca } from '../../theme/Marca';
import { useTema } from '../../theme/ThemeProvider';
import { Burbuja } from './Burbuja';
import { TarjetaClientePropuesto } from './TarjetaClientePropuesto';
import { TarjetaFacturaPropuesta } from './TarjetaFacturaPropuesta';
import { TarjetaGastoPropuesto } from './TarjetaGastoPropuesto';
import { TarjetaIngresoPropuesto } from './TarjetaIngresoPropuesto';
import { TarjetaPresupuestoPropuesto } from './TarjetaPresupuestoPropuesto';

const TEXTO_VACIO =
  'Contame qué necesitás: mandar un mail, buscar algo en tus archivos, revisar tus métricas, o cobrar con MercadoPago. Antes de ejecutar algo importante, siempre te lo muestro para que lo confirmes.';

export interface ListaMensajesProps {
  messages: ChatMessage[];
  /** `opts.payload` viaja hasta `useChat().send` — queda disponible para un gate futuro que necesite
   * mandar datos extra junto con la confirmación (ver `SendOptions.payload` en `useChat.ts`). Ningún
   * gate de este sprint lo usa todavía. */
  onChoice: (value: string, opts?: { payload?: Record<string, unknown> | null }) => void;
}

interface TarjetaConfirmacionProps {
  gate: Gate;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Tarjeta del gate de confirmación genérico (`mapearGate`, `@copiloto/core/chat`) — cualquier reply
 * cuyos `choices` sean exactamente el par confirmar/cancelar (ej. "vas a mandar este mail a Juan,
 * ¿confirmás?"). Fork ADAPTADO del `TarjetaRevisionClinica` de DocuMed
 * (`_staging/documed/apps/mobile/src/modules/chat/ListaMensajes.tsx`) — no un port literal:
 *
 * 🔴 **El origen la hacía un textarea EDITABLE** (el médico corregía el markdown de una nota clínica
 * antes de firmarla). Acá no hay nada de negocio que el usuario deba re-escribir a mano: la
 * confirmación de negocio real de este producto (ver `apps/copiloto-web/src/modules/chat/
 * HitlCard.tsx`, ya en producción) es de SOLO LECTURA — el usuario lee lo que el copiloto va a hacer
 * y aprieta Confirmar o Cancelar, nunca edita el texto. Portar el textarea tal cual habría sido
 * clonar una UX pensada para "corregir un borrador clínico" a un dominio donde no existe ese borrador
 * -- jerga sin equivalente natural, justo lo que la consigna de terminología pide evitar. Por eso acá
 * `gate.markdown` se muestra como texto plano, no editable.
 */
function TarjetaConfirmacion({ gate, onConfirm, onCancel }: TarjetaConfirmacionProps) {
  const tema = useTema();

  // Mismo nivel de vidrio que el gate de DocuMed ("informe"): flota DENTRO de la conversación, con su
  // propio ocluyente -- sin esto el chat de atrás se leería A TRAVÉS de la superficie donde el
  // usuario confirma lo que se va a ejecutar.
  return (
    <CristalVidrio nivel="informe" testID="tarjeta-confirmacion" style={styles.tarjetaGate}>
      <View style={[styles.contenidoGate, { padding: tema.espacio.md, gap: tema.espacio.sm }]}>
        <View style={styles.encabezadoGate}>
          <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: tema.color.acento }} />
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '700' }}>
            Confirmá antes de continuar
          </Text>
        </View>
        <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: Math.round(tema.tipo.base * 1.4) }}>
          {gate.markdown}
        </Text>
        <View style={[styles.accionesGate, { gap: tema.espacio.sm }]}>
          <Pressable
            testID="tarjeta-confirmacion-confirmar"
            onPress={onConfirm}
            style={pressableStyle([
              styles.botonGate,
              { backgroundColor: tema.color.acento, borderRadius: tema.radio.md },
            ])}
          >
            <Text style={{ color: tema.color.acentoTexto, fontSize: tema.tipo.base, fontWeight: '700' }}>
              {gate.confirmLabel}
            </Text>
          </Pressable>
          <Pressable
            testID="tarjeta-confirmacion-cancelar"
            onPress={onCancel}
            style={pressableStyle([
              styles.botonGate,
              { backgroundColor: tema.color.superficieAlta, borderRadius: tema.radio.md },
            ])}
          >
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}>
              {gate.cancelLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </CristalVidrio>
  );
}

interface FilaMensajeProps {
  mensaje: ChatMessage;
  onChoice: ListaMensajesProps['onChoice'];
}

/**
 * Una fila de la lista — el mismo árbol de decisión que antes (gasto/cliente/ingreso/presupuesto/
 * factura propuestos -> gate confirmar/cancelar -> burbuja lisa), ahora aislado en su propio
 * componente memoizado. Con `ScrollView` + `.map` daba igual: React re-renderizaba las 300 filas
 * en cada mensaje nuevo porque todas vivían en un solo árbol. `FlatList` sólo re-renderiza lo que
 * cambia SI el `renderItem` no es una arrow function inline (si lo fuera, `React.memo` no podría
 * comparar props y memoizar no serviría de nada) — de ahí que viva afuera, no inline en el JSX.
 */
const FilaMensaje = memo(function FilaMensaje({ mensaje, onChoice }: FilaMensajeProps) {
  if (mensaje.role === 'user') {
    return <Burbuja role="user" text={mensaje.text} />;
  }

  // El gasto dictado va ANTES del gate: es una card propia y no lleva `choices`, así que
  // `mapearGate` la ignoraría y caería en `Burbuja` — el emprendedor vería el texto del
  // copiloto y ningún lugar donde corregir el monto.
  const propuesta = leerGastoPropuesto(mensaje.card);
  if (propuesta) {
    return <TarjetaGastoPropuesto propuesta={propuesta} />;
  }

  // Mismo motivo que el gasto: `cliente_propuesto` no lleva `choices`, así que `mapearGate` la
  // ignoraría y esto caería en `Burbuja` — se vería el texto del copiloto y ningún lugar donde
  // corregir el nombre que el LLM entendió mal.
  const clientePropuesto = leerClientePropuesto(mensaje.card);
  if (clientePropuesto) {
    // 🔴 `mensaje.text` VIAJA a la card. La card reemplaza a la burbuja, así que lo que no se
    // pase acá no se ve nunca — y ahí es donde el backend explica un documento que no cierra.
    return <TarjetaClientePropuesto propuesta={clientePropuesto} texto={mensaje.text} />;
  }

  // `ingreso_propuesto` — CONFIRMADO en device (hito 8, PR#111/#112).
  const ingresoPropuesto = leerIngresoPropuesto(mensaje.card);
  if (ingresoPropuesto) {
    return <TarjetaIngresoPropuesto propuesta={ingresoPropuesto} />;
  }

  // 🔴 [ASSUMED_PENDING_VERIFY] sólo en el `kind` — `data` ya está confirmada (contrato §2.4 de
  // Presupuestos). Si backend nunca manda este `kind`, esta rama no dispara y cae a `Burbuja`.
  const presupuestoPropuesto = leerPresupuestoPropuesto(mensaje.card);
  if (presupuestoPropuesto) {
    return <TarjetaPresupuestoPropuesto propuesta={presupuestoPropuesto} />;
  }

  // 🔴 [ASSUMED_PENDING_VERIFY] sólo en el `kind` — `data` ya está confirmada (contrato de hito
  // 9 §2.1). Si backend nunca manda `factura_propuesta`, esta rama no dispara y cae a `Burbuja`.
  const facturaPropuesta = leerFacturaPropuesta(mensaje.card);
  if (facturaPropuesta) {
    return <TarjetaFacturaPropuesta propuesta={facturaPropuesta} />;
  }

  const gate = mapearGate(mensaje);
  if (gate) {
    return (
      <TarjetaConfirmacion
        gate={gate}
        onConfirm={() => onChoice(gate.confirmValue)}
        onCancel={() => onChoice(gate.cancelValue)}
      />
    );
  }

  return <Burbuja role="assistant" text={mensaje.text} />;
});

/**
 * Lista de mensajes — fork mobile de `ListaMensajes.tsx` de DocuMed. Por mensaje decide qué
 * renderizar (ver `FilaMensaje`):
 *  - usuario -> `Burbuja` simple.
 *  - asistente cuyo `choices` es el par confirmar/cancelar (`mapearGate`, `@copiloto/core/chat`) ->
 *    `TarjetaConfirmacion`, NUNCA `Burbuja` — es el único HITL de este sprint.
 *  - asistente sin gate -> `Burbuja` de texto plano.
 *
 * Un `choices` que NO sea el par confirmar/cancelar (desambiguación multi-opción) no tiene UI
 * dedicada en este hito — mismo alcance que el origen; se ve el texto de la burbuja igual, sin chips.
 *
 * Auto-scroll al último mensaje en cada cambio (best-effort: `scrollToEnd` puede no existir bajo el
 * test-renderer).
 *
 * 🟢 **C6 (cotas de chat y listas):** `ScrollView` + `.map()` montaba TODOS los mensajes del
 * historial (hasta `MAX_MENSAJES_HISTORIAL = 300`, ver `chatMachine.ts`) como vistas nativas vivas,
 * sin importar cuántas entraran en pantalla. `FlatList` virtualiza: sólo monta lo visible + el
 * colchón de `windowSize`, y recicla vistas fuera de rango.
 *
 * 🔴 **`FlatList` de `react-native-gesture-handler`, no de `react-native` — y el `ref` se expone
 * hacia afuera.** Convención del repo (`ScrollFormulario`/`Tile`): mezclar el responder system de RN
 * con gestos de RNGH dentro del mismo árbol dejó un toque sin dueño (ver `contrato_..._dictado-por-
 * voz-sin-glass...`, el bug real de device). `BotonVoz` flota ENCIMA de esta lista con un gesto RNGH
 * propio (mantener apretado / deslizar); para que conviva con el scroll sin comerse el toque, su Pan
 * necesita `simultaneousWithExternalGesture(refDeEstaLista)` — por eso el `ref` que este componente
 * recibe apunta DIRECTO al `FlatList` nativo de RNGH, el mismo que ya usa para su propio
 * `scrollToEnd` interno, no un objeto envoltorio.
 */
export const ListaMensajes = forwardRef<FlatList<ChatMessage>, ListaMensajesProps>(
  function ListaMensajes({ messages, onChoice }, refExterno) {
    const tema = useTema();
    const listRef = useRef<FlatList<ChatMessage>>(null);
    useImperativeHandle(refExterno, () => listRef.current as FlatList<ChatMessage>, []);

    useEffect(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, [messages.length]);

    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<ChatMessage>) => <FilaMensaje mensaje={item} onChoice={onChoice} />,
      [onChoice],
    );
    const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

    return (
      <FlatList
        testID="lista-mensajes"
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.contenido, { padding: tema.espacio.md, gap: tema.espacio.sm }]}
        removeClippedSubviews
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        ListEmptyComponent={
          <View testID="chat-vacio" style={styles.vacio}>
            <Marca size={64} tono="superficie" />
            <Text
              style={{
                color: tema.color.texto,
                fontSize: tema.tipo.titulo,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: tema.espacio.md,
              }}
            >
              ¿En qué te ayudo?
            </Text>
            <Text
              style={{
                color: tema.color.textoTenue,
                fontSize: tema.tipo.base,
                lineHeight: Math.round(tema.tipo.base * 1.5),
                textAlign: 'center',
                marginTop: tema.espacio.sm,
              }}
            >
              {TEXTO_VACIO}
            </Text>
          </View>
        }
      />
    );
  },
);

const styles = StyleSheet.create({
  contenido: { flexGrow: 1 },
  vacio: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  // El borde/sombra/radio los pone `CristalVidrio` (nivel informe); acá sólo el ancho del cristal.
  tarjetaGate: { alignSelf: 'stretch' },
  contenidoGate: { alignSelf: 'stretch' },
  encabezadoGate: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accionesGate: { flexDirection: 'row' },
  botonGate: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
});
