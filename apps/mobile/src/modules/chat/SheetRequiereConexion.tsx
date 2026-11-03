import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { etiquetaCondicion, type RequiereConexion } from '@copiloto/core';

import { LogoMarca, hayLogoDe } from '../apps/LogoMarca';
import { CristalVidrio } from '../../theme/glass/CristalVidrio';
import { FilaBotones } from '../../theme/glass/campos';
import { PHOSPHOR, VIEWBOX_PHOSPHOR } from '../../theme/glass/phosphor';
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
 * El glifo de cada fila del alcance (`.cs-fila .tile`, SM-I7). Sale de la `condicion` que manda el backend,
 * que es lo único que la app sabe de la capacidad: el texto no se interpreta, y deducir un glifo de él se
 * rompería en silencio el día que cambie la redacción. Un valor que esta versión no conoce cae en el general.
 */
const GLIFO_CONDICION: Record<string, string> = { solo_lectura: 'eye', requiere_ok: 'check' };
const GLIFO_CAPACIDAD = 'plugs-connected';

/** Los glifos que ESTE archivo nombra por su cuenta: el test los cruza contra `PHOSPHOR`. */
export const GLIFOS_DECLARADOS: readonly string[] = [...Object.values(GLIFO_CONDICION), GLIFO_CAPACIDAD];

/** `PHOSPHOR` es un objeto plano: `PHOSPHOR['toString']` existe. Sólo cuentan las claves propias. */
function existeGlifo(nombre: string | undefined): nombre is string {
  return nombre != null && Object.prototype.hasOwnProperty.call(PHOSPHOR, nombre) && PHOSPHOR[nombre]!.length > 0;
}

/**
 * SM-I7 · el glifo de una fila, en tres pasos y fail-safe: (1) el `icono` que mandó el backend, si EXISTE en
 * el set; (2) si falta o es desconocido, el derivado de `condicion`; (3) si ni eso, el genérico. Nunca devuelve
 * un nombre sin trazos: un tile vacío es una capacidad que el usuario no ve, y omitir la fila lo es aún peor.
 */
export function resolverGlifo(icono: string | undefined, condicion: string): string {
  if (existeGlifo(icono)) return icono;
  const derivado = GLIFO_CONDICION[condicion];
  return existeGlifo(derivado) ? derivado : GLIFO_CAPACIDAD;
}

function Glifo({ nombre, tamano, color }: { nombre: string; tamano: number; color: string }) {
  return (
    <Svg width={tamano} height={tamano} viewBox={VIEWBOX_PHOSPHOR} fill="none">
      {(PHOSPHOR[nombre] ?? PHOSPHOR[GLIFO_CAPACIDAD] ?? []).map((d, i) => (
        <Path key={i} d={d} fill={color} stroke="none" />
      ))}
    </Svg>
  );
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
            <View testID="sheet-requiere-conexion-alcance" style={{ gap: tema.espacio.sm }}>
              {conexion.alcance.map((a, i) => {
                // El backend manda la semántica (`solo_lectura`/`requiere_ok`); la etiqueta la pinta la app.
                // Es lo que dice el LÍMITE del permiso: sin ella la hoja pide acceso sin decir hasta dónde.
                const insignia = etiquetaCondicion(a.condicion);
                return (
                  <View key={`${i}-${a.texto}`} style={styles.fila}>
                    {/* El nombre de la capacidad ya está en el texto: el glifo no agrega nada que leer. */}
                    <View
                      testID={`sheet-requiere-conexion-icono-${i}`}
                      accessible={false}
                      style={[styles.tile, { backgroundColor: tema.color.tileFuncion.arena }]}
                    >
                      <Glifo
                        nombre={resolverGlifo(a.icono, a.condicion)}
                        tamano={18}
                        color={tema.color.tileFuncion.tinta}
                      />
                    </View>
                    <View style={styles.titulos}>
                      <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiMedium }}>
                        {a.texto}
                      </Text>
                      {insignia != null && (
                        <Text
                          testID={`sheet-requiere-conexion-condicion-${i}`}
                          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
                        >
                          {insignia}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* `.cs-pend` del prototipo: lo que el usuario estaba pidiendo y queda esperando. Opcional — sin él
              la hoja es la de siempre. */}
          {conexion.pendiente != null && (
            <View
              testID="sheet-requiere-conexion-pendiente"
              style={[styles.pendiente, { backgroundColor: tema.color.tileFuncion.arena, borderRadius: tema.radio.md, padding: tema.espacio.md }]}
            >
              <Glifo nombre="clock-counter-clockwise" tamano={16} color={tema.color.tileFuncion.tinta} />
              <Text style={[styles.textoPendiente, { color: tema.color.tileFuncion.tinta, fontSize: tema.tipo.chico, lineHeight: Math.round(tema.tipo.chico * 1.5) }]}>
                Apenas conectes sigo con lo tuyo:{' '}
                <Text style={{ fontFamily: tema.fuente.uiSemibold }}>{conexion.pendiente}</Text>.
              </Text>
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
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pendiente: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  textoPendiente: { flex: 1 },
});
