import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  agruparCapacidadesPorRotulo,
  leerCapacidades,
  TEMAS_AYUDA,
  type GuiaCapacidades,
} from '@copiloto/core';

import { dejarPendiente } from '../chat/mensajePendiente';
import { DockFuncion } from '../voz';
import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Chevron } from './Chevron';
import { FilaGrupo, GrupoFilas } from './GrupoFilas';
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
 * (`mensajePendiente`) y descarta **toda la pila de glass** (`router.dismissAll()`: esta pantalla
 * está apilada sobre Ajustes, que está sobre el chat — un `back()` dejaba la pregunta colgada en
 * Ajustes); el chat de abajo la manda al recuperar el foco, **con los datos del emprendedor a
 * mano**, que es lo que una ayuda escrita no puede hacer. Los cinco temas van al chat, igual que
 * en el prototipo (`index.html:3614`, handler único `data-tema`): ninguno abre otro flujo. Confirmado por
 * el operador el 2026-11-04, textual: *«como el prototipo»* — «emití tu primera factura» te lo explica en el
 * chat, no abre Facturación.
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

/** El campo del dock: el SEXTO tema, el de texto libre. */
const PLACEHOLDER_DOCK = 'Preguntame lo que quieras…';

type Estado = 'cargando' | 'ok' | 'no_disponible';

export { TEMAS_AYUDA };

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

  /**
   * Deja la pregunta dicha en el chat principal y descarta TODA la pila de glass hasta él. Esta
   * pantalla se abre desde Ajustes (`ajustes.tsx` → `/ajustes-como-usar`), o sea hay DOS glass
   * sobre el chat: `back()` volvía a Ajustes y la pregunta quedaba colgada hasta cerrarlo también.
   * Ver el docstring del módulo.
   */
  function preguntar(pregunta: string) {
    dejarPendiente(pregunta);
    router.dismissAll();
  }

  // `capacidades` vacío NO es lo mismo que `no_disponible`: el endpoint contestó y dice que hoy no
  // hay ninguna tool viva. Es rarísimo, pero mostrarlo como «no disponible» ocultaría una poda
  // demasiado agresiva justo cuando hay que verla.
  const sinCapacidades = estado === 'ok' && (guia?.capacidades.length ?? 0) === 0;

  return (
    <MarcoGlass titulo="Cómo usar la app" icono="comoHablarle" sinIcono testID="pantalla-como-usar">
      <ScrollFormulario
        testID="como-usar-contenido"
        contentContainerStyle={{ padding: tema.espacio.md, gap: 24, paddingBottom: 120 }}
      >
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22, paddingHorizontal: 4 }}>
          Lo que más se pregunta, contestado en dos minutos.
        </Text>

        {/* SM-N42 punto 4 -- los cinco temas viven en UNA tarjeta, separados por una línea fina. Rediseño (Martin
            15/11): el molde de las demás funciones — título afuera en display, tarjeta blanca de filas. */}
        <GrupoFilas
          rotulo="Empezá por acá"
          notaTestID="como-usar-pie"
          nota="Cada tema te lo explico en el chat, con tus propios datos. Si no está lo que buscás, preguntame ahí mismo."
        >
          {TEMAS_AYUDA.map((t, i) => (
            <FilaGrupo
              key={t.titulo}
              primera={i === 0}
              testID={`como-usar-tema-${i}`}
              accessibilityLabel={t.titulo}
              onPress={() => preguntar(t.pregunta)}
            >
              <View style={[styles.numero, { backgroundColor: tema.color.tileFuncion.arena }]}>
                <Text style={{ color: tema.color.tileFuncion.tinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                  {i + 1}
                </Text>
              </View>
              <View style={styles.bloque}>
                <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
                  {t.titulo}
                </Text>
                <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 }}>{t.detalle}</Text>
              </View>
              <Chevron />
            </FilaGrupo>
          ))}
        </GrupoFilas>

        <Text accessibilityRole="header" style={[rotulo(tema), { marginBottom: -6 }]}>Lo que le podés pedir</Text>

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
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, lineHeight: 24, paddingHorizontal: 4 }}>
              Hablale como le hablarías a alguien que te ayuda. Estos son ejemplos, no fórmulas: si te
              falta un dato, te lo pide; si entendió mal, lo corregís en la tarjeta.
            </Text>

            {sinCapacidades && (
              <Text testID="como-usar-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                Tu copiloto todavía no tiene funciones habilitadas.
              </Text>
            )}

            {!sinCapacidades && (
              <GrupoFilas>
                {agruparCapacidadesPorRotulo(guia.capacidades).map((grupo, i) => (
                  <FilaGrupo key={grupo.rotulo} primera={i === 0} testID={`como-usar-grupo-${i}`}>
                    <View style={styles.bloque}>
                      <Text style={subrotulo(tema)}>{grupo.rotulo}</Text>
                      {grupo.ejemplos.map((e) => (
                        <Text key={e} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}>
                          «{e}»
                        </Text>
                      ))}
                    </View>
                  </FilaGrupo>
                ))}
              </GrupoFilas>
            )}

            {/* Las fechas van aparte porque no son una capacidad: son un modificador de todas. Y
                salen de la MISMA tabla medida contra el resolvedor que usa el backend — no de una
                lista paralela que podría decir otra cosa. */}
            {guia.fechas.entiendo.length > 0 && (
              <GrupoFilas>
                <FilaGrupo primera testID="como-usar-fechas">
                <View style={styles.bloque}>
                  <Text style={subrotulo(tema)}>Fechas</Text>
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
                </FilaGrupo>
              </GrupoFilas>
            )}
          </>
        )}
      </ScrollFormulario>

      {/* Contrato 2026-11-05: el campo y el mic son el sexto tema (texto libre). Escrito o dictado cae en el
          MISMO `preguntar` que los cinco temas: cero hilo propio, cero `sendStatus`. */}
      <DockFuncion contexto="bi" placeholder={PLACEHOLDER_DOCK} onTexto={(t) => preguntar(t)} />
    </MarcoGlass>
  );
}

const rotulo = (tema: ReturnType<typeof useTema>) => ({
  color: tema.color.texto,
  fontFamily: tema.fuente.display,
  fontSize: tema.tipo.grande,
  paddingHorizontal: 4,
});

const subrotulo = (tema: ReturnType<typeof useTema>) => ({
  color: tema.color.texto,
  fontFamily: tema.fuente.uiSemibold,
  fontSize: tema.tipo.base,
});

const styles = StyleSheet.create({
  // Contenedor de la tarjeta única: pisa el padding/dirección de `Row` (que es una fila de lista).
  bloque: { flex: 1, gap: 4 },
  numero: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
