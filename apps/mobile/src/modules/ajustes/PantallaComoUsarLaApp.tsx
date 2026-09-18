import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { leerCapacidades, type GuiaCapacidades } from '@copiloto/core';

import { dejarPendiente } from '../chat/mensajePendiente';
import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaComoUsarLaApp` — **la ayuda, en un solo lugar** (Ola 5).
 *
 * 🔴 **Es la fusión de dos pantallas, no una tercera.** Había `PantallaComoHablarle` (la guía de
 * capacidades, alimentada por `GET /capacidades`) y, escondidas adentro de Mi cuenta, dos filas que
 * abrían un chat de soporte con `funcion: 'como_uso_la_app'`. O sea: la guía por un lado, preguntar
 * por otro, y el emprendedor teniendo que adivinar cuál de las dos servía para su duda. Acá son una.
 *
 * 🔴 **Los temas abren el CHAT PRINCIPAL, no un chat propio** (`odobi-ui/CLAUDE.md`, el puente de la
 * Decisión C). La nota del sistema es explícita: *«un chat de ayuda propio sería la misma duplicación
 * que sacamos con la solapa "Preguntar" de Inteligencia»*. Dos hilos que saben cosas distintas del
 * mismo negocio obligan a recordar en cuál preguntaste. Tocar un tema deja la pregunta en el buzón
 * (`mensajePendiente`) y cierra el glass; el chat de abajo la manda al recuperar el foco, **con los
 * datos del emprendedor a mano**, que es lo que una ayuda escrita no puede hacer.
 *
 * 🔴 **Los ejemplos siguen viniendo de `GET /capacidades`, no escritos acá.** Es la propiedad que
 * hacía valiosa a la pantalla anterior y no se pierde en la fusión: el endpoint publica una capacidad
 * **sólo si su tool está viva**, así que el DoD —*«los ejemplos coinciden con lo que existe»*— es
 * cierto por construcción. La versión escrita a mano ya había nacido con el bug: recomendaba
 * *«facturale 80 mil a la panadería»* cuando `emitir_factura` no existía.
 *
 * ⚠️ **Y por eso, si la guía no está disponible, se dice — pero los TEMAS siguen ahí.** Son dos
 * fuentes independientes: los temas son del producto (no cambian con el deploy del backend), los
 * ejemplos son del contrato. Que se caiga una no puede llevarse la otra.
 */

type Estado = 'cargando' | 'ok' | 'no_disponible';

/**
 * Los cinco temas del prototipo, con su orden y su texto.
 *
 * `pregunta` es lo que se le dice al copiloto, en primera persona y en voseo — no el título del
 * tema. El título nombra un asunto («Cargar un gasto hablando»); lo que entra al chat tiene que ser
 * una pregunta que alguien haría de verdad, o la conversación arranca torcida.
 */
export const TEMAS_AYUDA: readonly { titulo: string; detalle: string; pregunta: string }[] = [
  {
    titulo: 'Cargar un gasto hablando',
    detalle: 'Lo más rápido de todo: apretás el mic y contás qué pagaste',
    pregunta: '¿Cómo cargo un gasto hablando?',
  },
  {
    titulo: 'Emitir tu primera factura',
    detalle: 'Qué te va a pedir y por qué te lo muestra antes de emitir',
    pregunta: '¿Cómo emito mi primera factura?',
  },
  {
    titulo: 'Conectar Mercado Pago',
    detalle: 'Qué ve Odobi de tus cobros, y cómo cortarlo cuando quieras',
    pregunta: '¿Cómo conecto Mercado Pago y qué vas a poder ver?',
  },
  {
    titulo: 'Entender Mi día',
    detalle: 'De dónde salen los avisos y por qué algunos se cierran solos',
    pregunta: '¿De dónde salen los avisos de Mi día?',
  },
  {
    titulo: 'Corregir algo que salió mal',
    detalle: 'Se corrige ANTES de guardar, en la card. Después no se edita',
    pregunta: '¿Cómo corrijo algo que cargué mal?',
  },
];

export function PantallaComoUsarLaApp() {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>('cargando');
  const [guia, setGuia] = useState<GuiaCapacidades | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await leerCapacidades();
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setGuia(res.guia);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  /** Deja la pregunta dicha en el chat principal y cierra el glass. Ver el docstring del módulo. */
  function preguntar(pregunta: string) {
    dejarPendiente(pregunta);
    router.back();
  }

  // `capacidades` vacío NO es lo mismo que `no_disponible`: el endpoint contestó y dice que hoy no
  // hay ninguna tool viva. Es rarísimo, pero mostrarlo como «no disponible» ocultaría una poda
  // demasiado agresiva justo cuando hay que verla.
  const sinCapacidades = estado === 'ok' && (guia?.capacidades.length ?? 0) === 0;

  return (
    <MarcoGlass titulo="Cómo usar la app" icono="comoHablarle" testID="pantalla-como-usar">
      <ScrollFormulario
        testID="como-usar-contenido"
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
      >
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Lo que más se pregunta, contestado en dos minutos.
        </Text>

        <Text style={rotulo(tema)}>EMPEZÁ POR ACÁ</Text>
        {TEMAS_AYUDA.map((t, i) => (
          <Row
            key={t.titulo}
            testID={`como-usar-tema-${i}`}
            accessibilityLabel={t.titulo}
            onPress={() => preguntar(t.pregunta)}
          >
            <View style={styles.tema}>
              <Text
                style={{
                  color: tema.color.acentoTinta,
                  fontFamily: tema.fuente.uiSemibold,
                  fontSize: tema.tipo.base,
                  width: 20,
                }}
              >
                {i + 1}
              </Text>
              <View style={styles.bloque}>
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
                  {t.titulo}
                </Text>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>{t.detalle}</Text>
              </View>
            </View>
          </Row>
        ))}

        <Text testID="como-usar-pie" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Cada tema te lo explico en el chat, con tus propios datos. Si no está lo que buscás,
          preguntame ahí mismo.
        </Text>

        <Text style={rotulo(tema)}>LO QUE LE PODÉS PEDIR</Text>

        {estado === 'cargando' && <ActivityIndicator testID="como-usar-cargando" color={tema.color.acento} />}

        {estado === 'no_disponible' && (
          <Text testID="como-usar-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
            No pudimos traer la guía ahora. Igual podés escribirle a tu copiloto como le hablarías a
            alguien que te ayuda.
          </Text>
        )}

        {estado === 'ok' && guia != null && (
          <>
            {/* 🔴 El encabezado desactiva la lectura equivocada ANTES de mostrar la lista. Una tabla
                de frases invita a leerse como comandos; si el emprendedor cree que tiene que decirlas
                exactas, la guía lo empeoró. */}
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
              Hablale como le hablarías a alguien que te ayuda. Estos son ejemplos, no fórmulas: si te
              falta un dato, te lo pide; si entendió mal, lo corregís en la tarjeta.
            </Text>

            {sinCapacidades && (
              <Text testID="como-usar-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                Tu copiloto todavía no tiene funciones habilitadas.
              </Text>
            )}

            {guia.capacidades.map((c) => (
              <Row key={c.tool} testID={`como-usar-${c.tool}`}>
                <View style={styles.bloque}>
                  <Text style={rotulo(tema)}>{c.rotulo}</Text>
                  {c.ejemplos.map((e) => (
                    <Text
                      key={e}
                      style={{ color: tema.color.texto, fontFamily: tema.fuente.ui, fontSize: tema.tipo.base }}
                    >
                      «{e}»
                    </Text>
                  ))}
                </View>
              </Row>
            ))}

            {/* Las fechas van aparte porque no son una capacidad: son un modificador de todas. Y
                salen de la MISMA tabla medida contra el resolvedor que usa el backend — no de una
                lista paralela que podría decir otra cosa. */}
            {guia.fechas.entiendo.length > 0 && (
              <Row testID="como-usar-fechas">
                <View style={styles.bloque}>
                  <Text style={rotulo(tema)}>Fechas</Text>
                  <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                    {guia.fechas.entiendo.map((f) => `«${f}»`).join(' · ')}
                  </Text>
                  {guia.fechas.siNoEsta != null && (
                    <Text
                      testID="como-usar-fechas-si-no-esta"
                      style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
                    >
                      {guia.fechas.siNoEsta}
                    </Text>
                  )}
                </View>
              </Row>
            )}
          </>
        )}
      </ScrollFormulario>
    </MarcoGlass>
  );
}

const rotulo = (tema: ReturnType<typeof useTema>) => ({
  color: tema.color.acentoTinta,
  fontFamily: tema.fuente.mono,
  fontSize: tema.tipo.chico,
  letterSpacing: 1.2,
  textTransform: 'uppercase' as const,
});

const styles = StyleSheet.create({
  tema: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  bloque: { flex: 1, gap: 4 },
});
