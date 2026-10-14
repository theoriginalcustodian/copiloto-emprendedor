import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { formatearDuracion } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { sombraNivel } from '../../theme/glass/relieve';
import { Marca } from '../../theme/Marca';

export type RolBurbuja = 'user' | 'assistant';

/** El mismo disco que el avatar de la cuenta en el encabezado (`AvatarCuenta`, 36): una sola geometría de avatar. */
const AVATAR_ASISTENTE = 36;

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

  const cuerpo = (
      <View
        style={[
          styles.burbuja,
          sombraNivel(esUsuario ? g.relieve.burbujaUsuario : g.relieve.nivel1),
          {
            borderColor: esUsuario ? g.bd : g.s1,
            backgroundColor: g.s2,
            // Cola direccional: la esquina "sin redondear" apunta a quién habla.
            borderTopLeftRadius: tema.radio.lg,
            borderTopRightRadius: tema.radio.lg,
            borderBottomLeftRadius: esUsuario ? tema.radio.lg : tema.radio.sm,
            borderBottomRightRadius: esUsuario ? tema.radio.sm : tema.radio.lg,
            padding: tema.espacio.sm,
          },
        ]}
      >
        <LinearGradient
          colors={esUsuario ? [g.ub1, g.ub2] : [g.s1, g.s2]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Línea de luz superior: el canto iluminado que despega la burbuja. */}
        <View style={[styles.luzSuperior, { backgroundColor: g.hi }]} pointerEvents="none" />
        <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{text}</Text>
        {porVoz && (
          <Text testID="chat-bubble-voz" style={[styles.chipVoz, { color: tema.color.textoTenue }]}>
            {`Por voz · ${formatearDuracion(porVoz.duracionSeg)}`}
          </Text>
        )}
      </View>
  );

  if (!esUsuario) {
    return (
      <View style={[styles.fila, styles.filaAsistente, styles.filaConAvatar]}>
        <View testID="chat-bubble-avatar">
          <Marca size={AVATAR_ASISTENTE} tono="tinta" />
        </View>
        <View style={styles.cuerpoAsistente}>{cuerpo}</View>
      </View>
    );
  }

  return (
    <View style={[styles.fila, styles.filaUsuario]}>
      {cuerpo}
      {recibido && (
        <Text testID="chat-bubble-recibido" style={[styles.meta, { color: tema.color.exito }]}>
          {hora != null ? `${hora} ✓✓ recibido` : '✓✓ recibido'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { maxWidth: '85%', gap: 4 },
  filaUsuario: { alignSelf: 'flex-end' },
  filaAsistente: { alignSelf: 'flex-start' },
  // AVATARASIST: el isotipo a la izquierda, pegado al borde INFERIOR de la burbuja (como `.msg-row` del prototipo).
  filaConAvatar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  // `flexShrink` para que el texto largo ceda el ancho al avatar y no lo empuje fuera de la fila.
  cuerpoAsistente: { flexShrink: 1 },
  burbuja: {
    borderWidth: 1,
    overflow: 'hidden',
    // La sombra proyectada la pone `sombraNivel(...)` — ver el docstring del módulo.
  },
  luzSuperior: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  chipVoz: { fontSize: 12, marginTop: 4 },
  // Fuera de la burbuja, pegada a su borde derecho: es una línea de estado, no parte del mensaje.
  meta: { fontSize: 11, alignSelf: 'flex-end' },
});
