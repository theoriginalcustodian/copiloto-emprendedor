import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { avisoErrorLecturaFoto, datosGastoPropuesto, leerFotoGasto } from '@copiloto/core';

import { useCapturaFoto } from '../chat/useCapturaFoto';
import { pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';
import type { ValoresInicialesGasto } from './FormularioGasto';

export interface FotoFuncionProps {
  /** 200: la propuesta ya traducida a los valores del formulario — `origen` SIEMPRE es `'foto'`. */
  onLectura: (iniciales: ValoresInicialesGasto) => void;
  /** Cualquier error (413/415/422/502/503/401): el caller abre igual el alta en blanco — nunca
   * bloquea la carga manual (contrato §3). */
  onError: (mensaje: string) => void;
  disabled?: boolean;
}

/** Mismo trazo que `IconoCamara` de `chat/Composer.tsx` (Gastos Fase 2) — sin extraerlo a un módulo
 * compartido: es un ícono hoja de 6 líneas, no lógica; cada botón de este repo define el suyo. */
function IconoCamara({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

/**
 * `POST /gastos/leer-foto` (BL-J7, 3er ítem del DoD) — hermana mobile de
 * `apps/copiloto-web/.../gastos/FotoFuncion.tsx`. Reutiliza `useCapturaFoto` (Gastos Fase 2, YA
 * existe en `chat/useCapturaFoto.ts`: Alert nativo Cámara/Galería, permisos, `ArchivoSubida`) — este
 * componente sólo cambia A DÓNDE va el archivo: `/gastos/leer-foto` (K-10 hermano, sin sesión de
 * chat) en vez de `/chat/foto` (`useChat.enviarFoto`, que sí despacha y escribe al hilo).
 *
 * `archivo === null` (canceló el picker o negó el permiso) es un no-op silencioso — mismo criterio
 * que `ChatView.alElegirFoto`: el hook ya avisó con su propio `Alert` cuando corresponde.
 */
export function FotoFuncion({ onLectura, onError, disabled }: FotoFuncionProps) {
  const tema = useTema();
  const captura = useCapturaFoto();
  const [leyendo, setLeyendo] = useState(false);

  async function alTocar() {
    const archivo = await captura.elegir();
    if (archivo === null) return;
    setLeyendo(true);
    try {
      const res = await leerFotoGasto(archivo);
      const propuesta = datosGastoPropuesto(res.gasto);
      if (propuesta === null) {
        onError('No pude leer el ticket. Probá con otra foto o cargalo a mano.');
        return;
      }
      onLectura({
        monto: '', // BL-J7 §2/§3: `monto` SIEMPRE vacío — `montoSugerido` es sólo sugerencia tocable.
        montoSugerido: propuesta.montoSugerido ?? undefined,
        categoria: propuesta.categoria,
        proveedor: propuesta.proveedor ?? undefined,
        medioPago: propuesta.medioPago ?? undefined,
        descripcion: propuesta.descripcion ?? undefined,
        fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
      });
    } catch (err) {
      onError(avisoErrorLecturaFoto(err));
    } finally {
      setLeyendo(false);
    }
  }

  return (
    // testID="foto-funcion" en el contenedor -- paridad con `data-testid="foto-funcion"` del div
    // raíz web (BL-Q1, gate de paridad de testID por pantalla): mismo patrón que `mic-funcion`
    // (nombre del componente en la raíz, `-boton`/`-chip` en las partes internas).
    <View testID="foto-funcion">
      <Pressable
        testID="foto-funcion-boton"
        accessibilityRole="button"
        accessibilityLabel="Leer un gasto desde una foto del ticket"
        disabled={disabled || leyendo}
        onPress={() => void alTocar()}
        style={pressableStyle([
          styles.boton,
          {
            backgroundColor: tema.glass.chip,
            borderColor: tema.color.borde,
            borderWidth: 1,
            opacity: disabled || leyendo ? 0.5 : 1,
          },
        ])}
      >
        <IconoCamara color={tema.glass.accent2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  boton: { width: 38, height: 38, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
