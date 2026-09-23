import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ApiError,
  LIMITE_CAMPO_CORTO,
  guardarPerfilNegocio,
  leerEjemploDeTono,
  leerPerfilNegocio,
  type FormalidadCopiloto,
  type LargoRespuesta,
  type PerfilNegocio,
} from '@copiloto/core';

import { CampoSelect, CampoTexto, FilaBotones, ScrollFormulario, type OpcionSelect } from '../../../theme/glass/campos';
import { MarcoGlass } from '../../../theme/glass/MarcoGlass';
import { useTema } from '../../../theme/ThemeProvider';

export const OPCIONES_FORMALIDAD: OpcionSelect[] = [
  { valor: 'formal', etiqueta: 'Formal' },
  { valor: 'cercano', etiqueta: 'Cercano' },
];

export const OPCIONES_LARGO: OpcionSelect[] = [
  { valor: 'breve', etiqueta: 'Breve' },
  { valor: 'detallado', etiqueta: 'Detallado' },
];

type EstadoCarga = 'cargando' | 'ok' | 'error' | 'no_disponible';

export interface PantallaTonoProps {
  /** Vuelve a «Mi negocio». */
  onVolver: () => void;
  /** Avisa el perfil ya guardado, para que la fila-resumen de Mi negocio no quede desactualizada. */
  onGuardado?: (perfil: PerfilNegocio) => void;
}

/**
 * «Cómo hablarle» (K-15 / BL-X7, DEC-6; espejo de web `PantallaTono`) — la pantalla ÚNICA del tono del
 * copiloto: Formalidad, Largo y Nombre, con un ejemplo de respuesta que se re-consulta cada vez que
 * cambia Formalidad o Largo, ANTES de guardar.
 *
 * El ejemplo lo deriva el BACKEND de la misma tabla que arma el prompt real (`leerEjemploDeTono`): acá
 * no hay copia del copy. Sin ejemplo (endpoint no desplegado o caído) se OMITE, no se inventa. Guardar
 * sigue siendo `guardarPerfilNegocio` parcial — sólo viajan las tres claves de tono.
 */
export function PantallaTono({ onVolver, onGuardado }: PantallaTonoProps) {
  const tema = useTema();
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [formalidad, setFormalidad] = useState<FormalidadCopiloto>('cercano');
  const [largo, setLargo] = useState<LargoRespuesta>('breve');
  const [nombre, setNombre] = useState('');
  const [ejemplo, setEjemplo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await leerPerfilNegocio();
        if (!vivo) return;
        if (res.status === 'no_disponible') return setEstadoCarga('no_disponible');
        if (res.perfil) {
          setFormalidad(res.perfil.formalidad);
          setLargo(res.perfil.largoRespuesta);
          setNombre(res.perfil.nombreCopiloto);
        }
        setEstadoCarga('ok');
      } catch {
        if (vivo) setEstadoCarga('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // El ejemplo sigue a la selección; `vivo` descarta la respuesta de una combinación que ya no es la
  // vigente.
  useEffect(() => {
    if (estadoCarga !== 'ok') return;
    let vivo = true;
    void leerEjemploDeTono(formalidad, largo).then((e) => {
      if (vivo) setEjemplo(e);
    });
    return () => {
      vivo = false;
    };
  }, [estadoCarga, formalidad, largo]);

  async function guardar() {
    setEnviando(true);
    setGuardado(false);
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio({ formalidad, largoRespuesta: largo, nombreCopiloto: nombre });
      if (res.status === 'no_disponible') return setEstadoCarga('no_disponible');
      if (res.status === 'modo_no_disponible') return setErrorGuardado(res.mensaje);
      setGuardado(true);
      onGuardado?.(res.perfil);
    } catch (e) {
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar los cambios. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <MarcoGlass titulo="Cómo hablarle" icono="miNegocio" testID="pantalla-tono">
      {estadoCarga === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="tono-cargando" color={tema.color.acento} />
        </View>
      )}
      {estadoCarga === 'error' && (
        <View style={styles.centro}>
          <Text testID="tono-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tu perfil. Probá de nuevo.
          </Text>
        </View>
      )}
      {estadoCarga === 'no_disponible' && (
        <View style={styles.centro}>
          <Text testID="tono-no-disponible" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}>
            Esta función todavía no está disponible en tu copiloto.
          </Text>
        </View>
      )}

      {estadoCarga === 'ok' && (
        <ScrollFormulario contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md }}>
          <CampoSelect
            testID="tono-formalidad"
            etiqueta="Tono"
            opciones={OPCIONES_FORMALIDAD}
            valor={formalidad}
            onChange={(v) => {
              setFormalidad(v as FormalidadCopiloto);
              setGuardado(false);
            }}
          />
          <CampoSelect
            testID="tono-largo"
            etiqueta="Largo de las respuestas"
            opciones={OPCIONES_LARGO}
            valor={largo}
            onChange={(v) => {
              setLargo(v as LargoRespuesta);
              setGuardado(false);
            }}
          />

          {ejemplo != null && (
            <View
              testID="tono-ejemplo-caja"
              style={{ backgroundColor: tema.color.superficieAlta, borderRadius: tema.radio.md, padding: tema.espacio.sm, gap: 2 }}
            >
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>Así te respondería</Text>
              <Text testID="tono-ejemplo" style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                {ejemplo}
              </Text>
            </View>
          )}

          <CampoTexto
            testID="tono-nombre"
            etiqueta="¿Cómo querés llamarlo?"
            valor={nombre}
            onChange={(v) => {
              setNombre(v);
              setGuardado(false);
            }}
            placeholder="ej.: Copi"
            maxLength={LIMITE_CAMPO_CORTO}
          />

          <FilaBotones
            testID="tono-botones"
            botones={[
              {
                etiqueta: enviando ? 'Guardando…' : 'Guardar',
                onPress: () => void guardar(),
                variante: 'primario',
                deshabilitado: enviando,
                testID: 'tono-guardar',
              },
              { etiqueta: 'Volver a Mi negocio', onPress: onVolver, testID: 'tono-volver' },
            ]}
          />

          {guardado && (
            <Text testID="tono-guardado" style={{ color: tema.color.exito, fontSize: tema.tipo.base }}>
              Listo, lo guardamos.
            </Text>
          )}
          {errorGuardado != null && (
            <Text testID="tono-error-guardado" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
              {errorGuardado}
            </Text>
          )}
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
