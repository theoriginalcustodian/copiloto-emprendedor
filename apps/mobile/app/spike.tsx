/**
 * Pantalla del spike F2 — **Medición 1** del tirón del glass de función.
 *
 * Vive en `/spike`, NO en el inicio: la app que el operador prueba tiene que abrir en su shell
 * real. Se llega desde el escritorio, en una tile discreta.
 *
 * Diseño factorial 2×2 sobre las dos asimetrías que el handoff de DocuMed dejó vivas
 * (`coordinacion/2026-07-20_handoff_tiron-glass-funcion.md` §A1 y §A3):
 *
 *   - **forma del nodo animado**: `flex:1` (como `MarcoGlass` hoy) vs `absoluto` (como el chat, que
 *     no se traba, y como el spike que midió 60 fps / 0% jank en documed).
 *   - **ícono SVG con `<FeGaussianBlur>` dentro del subárbol que se traslada**: sí vs no.
 *
 * V1 es el **caso base**: reproduce `MarcoGlass` tal cual. Si V1 no exhibe el tirón, no hay nada
 * que comparar y el resto de la corrida no significa nada — es la lección más cara del handoff
 * (`adb shell input swipe` no reproduce el síntoma, y casi les hace culpar al filtro SVG por eso).
 *
 * # ⚠️ ESTA MEDICIÓN NO SE PUEDE AUTOMATIZAR
 *
 * Está verificado que el swipe sintético **no reproduce el defecto**: cero frames >40 ms, contra
 * uno de 150 ms con dedo humano. Hace falta que una persona arrastre. El sprint autónomo llega
 * hasta acá: deja el instrumento listo y la corrida queda pendiente del operador.
 *
 * # Cómo se corre
 *
 *   1. `adb logcat -c && adb logcat | grep SPIKE_REPLIEGUE > _evidencia/medicion1.log`
 *   2. Abrir cada variante y arrastrar el handle hacia abajo, LENTO, ~5 veces. Con el dedo.
 *   3. `node scripts/sprint-mobile/S7-parse-medicion1.mjs _evidencia/medicion1.log`
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MarcoSpike, type FormaNodo } from '../src/spike/MarcoSpike';
import { useTema } from '../src/theme/ThemeProvider';
import { FondoIluminado } from '../src/theme/glass/FondoIluminado';
import { PRESS_SCALE, pressableStyle } from '../src/theme/glass/presion';

interface Variante {
  etiqueta: string;
  titulo: string;
  forma: FormaNodo;
  conIconoSvg: boolean;
  nota: string;
}

const VARIANTES: Variante[] = [
  {
    etiqueta: 'V1-base',
    titulo: 'V1 — caso base',
    forma: 'flex',
    conIconoSvg: true,
    nota: 'MarcoGlass tal cual: flex:1 + ícono SVG adentro. Si acá NO se traba, la corrida no vale.',
  },
  {
    etiqueta: 'V2-absoluto',
    titulo: 'V2 — nodo absoluto',
    forma: 'absoluto',
    conIconoSvg: true,
    nota: 'A3 aislado: la forma del chat, que no se traba y que el spike de 60 fps validó.',
  },
  {
    etiqueta: 'V3-sin-svg',
    titulo: 'V3 — sin ícono SVG',
    forma: 'flex',
    conIconoSvg: false,
    nota: 'A1 aislado: saca el único <FeGaussianBlur> del repo de adentro de lo que se traslada.',
  },
  {
    etiqueta: 'V4-ambos',
    titulo: 'V4 — absoluto y sin SVG',
    forma: 'absoluto',
    conIconoSvg: false,
    nota: 'Las dos a la vez. Si V4 tampoco arregla, ninguna de las dos asimetrías es la causa.',
  },
];

export default function PantallaSpike() {
  const tema = useTema();
  // La variante abierta vive en el estado de ESTA pantalla, sin router: la navegación no es una
  // variable de la Medición 1 (el defecto ocurre durante el arrastre, no al cerrar).
  const [activa, setActiva] = useState<Variante | null>(null);

  return (
    <View style={[styles.raiz, { backgroundColor: tema.color.fondo }]}>
      <FondoIluminado />

      <ScrollView contentContainerStyle={styles.contenido}>
        <Text style={{ color: tema.color.texto, fontSize: tema.tipo.titulo, fontFamily: tema.fuente.uiBold }}>
          Spike F2 — Medición 1
        </Text>
        <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: 11, marginTop: 6, marginBottom: 4 }}>
          ARRASTRÁ LENTO CON EL DEDO · ~5 VECES POR VARIANTE
        </Text>
        <Text style={{ color: tema.color.textoTenue, fontSize: 12, marginBottom: 20, lineHeight: 17 }}>
          El swipe sintético no reproduce el defecto. Hace falta dedo humano.
        </Text>

        {VARIANTES.map((v) => (
          <Pressable
            key={v.etiqueta}
            testID={`abrir-${v.etiqueta}`}
            onPress={() => setActiva(v)}
            style={pressableStyle(
              [styles.tarjeta, { backgroundColor: tema.glass.s1, borderColor: tema.glass.bd }],
              PRESS_SCALE
            )}
          >
            <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: 16 }}>
              {v.titulo}
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
              {v.nota}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {activa ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <MarcoSpike
            titulo={activa.titulo}
            etiqueta={activa.etiqueta}
            forma={activa.forma}
            conIconoSvg={activa.conIconoSvg}
            alCerrar={() => setActiva(null)}
          >
            <View style={styles.cuerpoGlass}>
              <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: 12, textAlign: 'center' }}>
                ARRASTRÁ EL HANDLE HACIA ABAJO{'\n'}LENTO, CON EL DEDO
              </Text>
            </View>
          </MarcoSpike>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  contenido: { padding: 20, paddingTop: 72 },
  tarjeta: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12 },
  cuerpoGlass: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
