import { StyleSheet, Text, View } from 'react-native';

import type { RequiereConexion } from '@copiloto/core';

import { LogoMarca, hayLogoDe } from '../apps/LogoMarca';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

export interface SheetRequiereConexionProps {
  /** `null` = cerrado (no renderiza nada). */
  conexion: RequiereConexion | null;
  onConectar: () => void;
  onAhoraNo: () => void;
  ocupado?: boolean;
  error?: string | null;
}

/**
 * K-11 / BL-J8 — el sheet «conectá X» EN CONTEXTO: un panel anclado abajo, sobre el hilo (NO un `Modal`
 * ni una ruta: el chat sigue visible detrás, no navega fuera). Logo + nombre + el `alcance` del catálogo
 * y dos botones del MISMO tamaño — «Conectar» / «Ahora no» — sin jerarquía que empuje a aceptar.
 */
export function SheetRequiereConexion({ conexion, onConectar, onAhoraNo, ocupado = false, error = null }: SheetRequiereConexionProps) {
  const tema = useTema();
  if (conexion == null) return null;
  return (
    <View style={styles.ancla} pointerEvents="box-none" testID="sheet-requiere-conexion-ancla">
      <CristalVidrio nivel="menu" testID="sheet-requiere-conexion">
        <View style={{ padding: tema.espacio.lg, gap: tema.espacio.md }}>
          <View style={styles.cabecera}>
            {hayLogoDe(conexion.service) && <LogoMarca servicio={conexion.service} tamano={36} testID="sheet-requiere-conexion-logo" />}
            <View style={styles.titulos}>
              <Text accessibilityRole="header" style={{ color: tema.color.texto, fontSize: tema.tipo.grande, fontWeight: '600' }}>
                Conectá {conexion.label}
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                Para hacer eso necesito acceso a {conexion.label}.
              </Text>
            </View>
          </View>

          {conexion.alcance.length > 0 && (
            <View testID="sheet-requiere-conexion-alcance" style={{ gap: tema.espacio.xs }}>
              {conexion.alcance.map((a) => (
                <Text key={a} style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
                  • {a}
                </Text>
              ))}
            </View>
          )}

          {error != null && (
            <Text testID="sheet-requiere-conexion-error" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              {error}
            </Text>
          )}

          <FilaBotones
            testID="sheet-requiere-conexion-botones"
            botones={[
              { etiqueta: 'Conectar', onPress: onConectar, variante: 'primario', deshabilitado: ocupado, testID: 'sheet-requiere-conexion-conectar' },
              { etiqueta: 'Ahora no', onPress: onAhoraNo, variante: 'secundario', testID: 'sheet-requiere-conexion-ahora-no' },
            ]}
          />
        </View>
      </CristalVidrio>
    </View>
  );
}

const styles = StyleSheet.create({
  // Flota abajo sobre el hilo; `box-none` deja pasar los toques a lo que no es el panel.
  ancla: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulos: { flex: 1, gap: 2 },
});
