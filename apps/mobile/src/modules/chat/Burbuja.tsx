import { StyleSheet, Text, View } from 'react-native';

import { formatearDuracion, segmentarNegrita } from '@copiloto/core';

import { elevacion } from '../../theme/BloqueCifra';
import { useTema } from '../../theme/ThemeProvider';

export type RolBurbuja = 'user' | 'assistant';

/** El mismo disco que el avatar de la cuenta en el encabezado (`AvatarCuenta`, 36): una sola geometría de avatar. */
export interface BurbujaProps {
  role: RolBurbuja;
  text: string;
  /** BL-J7 (H-A3-7) — el mensaje llegó por dictado (`useChat().enviarAudio`): chip «Por voz · m:ss»,
   * mismo criterio que `MicFuncion` fuera del chat. `undefined` en mensajes escritos: sin chip. */
  porVoz?: { duracionSeg: number };
  /**
   * fact-voz (d) — la meta del prototipo bajo la burbuja PROPIA: «10:12 ✓✓ recibido» (`index.html:2164`).
   * `true` sólo cuando el servidor aceptó el envío (`idMensajeSinConfirmar` del core decide cuál no);
   * ausente/`false` y no se pinta nada: un «recibido» sobre un envío que falló sería mentirle.
   * Sólo aplica a `role === 'user'`.
   */
  recibido?: boolean;
  /** La hora de la meta («9:12»). `null`/ausente = historial sin `creadoEn`: queda «✓✓ recibido» a secas. */
  hora?: string | null;
}

/**
 * Burbuja de chat — fork del `Burbuja.tsx` de DocuMed
 * (`_staging/documed/apps/mobile/src/modules/chat/Burbuja.tsx`). Vidrio LEVANTADO sobre el vidrio de
 * la conversación, no un bloque plano de color: la burbuja deja ver el fondo a través suyo y se
 * despega del panel por el borde, la línea de luz superior y la sombra proyectada.
 *
 * 🔴 **No porta el renderer de artefacto** (`TarjetaArtefacto` en el origen, específico de DocuMed —
 * fuera del alcance de este sprint: ver `ChatView.tsx`/informe del port). Si más adelante el backend
 * empieza a mandar `card`s propias del copiloto (ej. un resumen de cobro confirmado), ese renderer se
 * agrega acá cuando exista el diseño — hoy `Burbuja` sólo pinta texto.
 *
 * `overflow:'hidden'` recorta el gradiente al radio; la sombra la proyecta el contenedor padre (que
 * no recorta), y `backgroundColor` translúcido (`s2`) le da a Android el outline que necesita para
 * dibujarla sin volver la burbuja opaca. Cero-hex: todo sale de `useTema()`.
 *
 * 🔴 **AVATARASIST — el isotipo del asistente en TODO mensaje suyo** (`index.html:3191`, helper `O`: `msg-row` +
 * `quien` + `msg`, alineado al borde inferior de la burbuja). Es la `Marca` del design system en `tinta` (el
 * mismo círculo del avatar de Soporte): acá no hay un isotipo propio ni un asset. Es de la burbuja y no de
 * quien la monta porque el prototipo lo pinta en cada mensaje, no sólo en los de un módulo. La burbuja del
 * emprendedor NO lo lleva: en su lugar va la meta «✓✓ recibido».
 *
 * Relieve (ODOBI §2.4): la burbuja del ASISTENTE usa el nivel 1 neutro ("superficie en reposo");
 * la del USUARIO usa la sombra auxiliar del acento (`glass.relieve.burbujaUsuario` — DoD "sombras
 * auxiliares del acento", el mismo tono que UB2 a .4, distinta del nivel 1 neutro) porque es una
 * superficie de acento, no una card neutra. Ver `relieve.ts`.
 */
export function Burbuja({ role, text, porVoz, recibido = false, hora = null }: BurbujaProps) {
  const tema = useTema();
  const g = tema.glass;
  const esUsuario = role === 'user';

  // Martin 14/11: burbujas PLANAS. La del usuario en arena al 30 % —no ejecuta nada, así que no gasta
  // terracota (`CLAUDE.md`, pieza `.mio`)—; la de Odobi blanca con la elevación suave del sistema. Se fueron el
  // degradé, el borde y la línea de luz del vidrio, y el AVATAR: en una charla de a dos, el lado y el color ya
  // dicen quién habla, y el círculo negro con el isotipo adentro se repetía en cada mensaje sin informar nada.
  const cuerpo = (
    <View
      style={[
        styles.burbuja,
        // Los colores siguen saliendo de los tokens de burbuja de cada piel (SM-N43): en claro, arena-30 la
        // propia y blanca la de Odobi. Se pinta plano con el primer color del par.
        esUsuario
          ? { backgroundColor: g.mio1 }
          : [{ backgroundColor: g.asistente1 }, elevacion(tema.color.sombra)],
        // Cola direccional: la esquina menos redonda apunta a quién habla.
        esUsuario ? styles.colaUsuario : styles.colaAsistente,
      ]}
    >
      <Text
        style={[
          styles.texto,
          { color: esUsuario ? g.tintaMio : tema.color.texto, fontSize: tema.tipo.base },
        ]}
      >
        {/* El asistente contesta con **negrita**; lo del usuario es literal (si tipea asteriscos, se ven). */}
        {esUsuario
          ? text
          : segmentarNegrita(text).map((s, i) =>
              s.negrita ? (
                <Text key={i} style={styles.negrita}>
                  {s.texto}
                </Text>
              ) : (
                s.texto
              ),
            )}
      </Text>
      {porVoz && (
        <Text testID="chat-bubble-voz" style={[styles.chipVoz, { color: tema.color.textoTenue }]}>
          {`Por voz · ${formatearDuracion(porVoz.duracionSeg)}`}
        </Text>
      )}
    </View>
  );

  if (!esUsuario) {
    return <View style={[styles.fila, styles.filaAsistente]}>{cuerpo}</View>;
  }

  return (
    <View style={[styles.fila, styles.filaUsuario]}>
      {cuerpo}
      {recibido && (
        // En tenue, no en verde: es una línea de estado, y el color queda para lo que se toca (Decisión B).
        <Text testID="chat-bubble-recibido" style={[styles.meta, { color: tema.color.textoTenue }]}>
          {hora != null ? `${hora} ✓✓ recibido` : '✓✓ recibido'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { maxWidth: '82%', gap: 5 },
  filaUsuario: { alignSelf: 'flex-end' },
  filaAsistente: { alignSelf: 'flex-start' },
  burbuja: { borderRadius: 20, paddingVertical: 11, paddingHorizontal: 15 },
  colaUsuario: { borderBottomRightRadius: 6 },
  colaAsistente: { borderBottomLeftRadius: 6 },
  texto: { lineHeight: 22 },
  negrita: { fontWeight: '700' },
  chipVoz: { fontSize: 12, marginTop: 4 },
  // Fuera de la burbuja, pegada a su borde derecho: es una línea de estado, no parte del mensaje.
  meta: { fontSize: 11, alignSelf: 'flex-end', paddingRight: 4 },
});
