import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { formatearImporte, leerGraficoMargenTrabajo, type TrabajoConMargen } from '@copiloto/core';

import { Tarjeta } from '../../theme/Tarjeta';
import { ScrollFormulario } from '../../theme/glass/campos';
import { conAlfa } from '../../theme/glass/conAlfa';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/**
 * Todos los trabajos con lo que dejó cada uno (Martin 15/11). Inteligencia muestra sólo el que más dejó y el
 * que menos; la lista entera vive acá, a un toque, para no llenar la portada. Lee el MISMO endpoint que el
 * bloque de Inteligencia: mismo cálculo, mismo orden (del que más deja al que menos).
 */
type Estado = { fase: 'cargando' } | { fase: 'error' } | { fase: 'ok'; trabajos: readonly TrabajoConMargen[]; sinIngreso: number };

function porcentaje(t: TrabajoConMargen): number | null {
  const cobrado = t.cobrado != null ? Number(t.cobrado) : NaN;
  const margen = t.margen != null ? Number(t.margen) : NaN;
  return cobrado > 0 && Number.isFinite(margen) ? (margen / cobrado) * 100 : null;
}

export function PantallaTrabajos() {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });

  useEffect(() => {
    let vivo = true;
    leerGraficoMargenTrabajo()
      .then((res) => {
        if (!vivo) return;
        if (res.status !== 'ok' || res.modo !== 'lista') return setEstado({ fase: 'error' });
        setEstado({ fase: 'ok', trabajos: res.trabajos, sinIngreso: res.sinIngreso.length });
      })
      .catch(() => {
        if (vivo) setEstado({ fase: 'error' });
      });
    return () => {
      vivo = false;
    };
  }, []);

  const tenue = { color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18 };
  const filas =
    estado.fase === 'ok'
      ? estado.trabajos.map((t) => ({ t, pct: porcentaje(t) })).sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity))
      : [];

  return (
    <MarcoGlass titulo="Cuánto te deja cada trabajo" icono="inteligencia" sinIcono testID="pantalla-trabajos">
      <ScrollFormulario testID="trabajos-contenido" contentContainerStyle={{ padding: tema.espacio.md, gap: 24, paddingBottom: tema.espacio.xl }}>
        {estado.fase === 'cargando' && <ActivityIndicator testID="trabajos-cargando" color={tema.color.acento} />}
        {estado.fase === 'error' && (
          <Text testID="trabajos-error" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}>
            No pude traer los trabajos ahora. Probá de nuevo en un rato.
          </Text>
        )}
        {estado.fase === 'ok' && filas.length === 0 && (
          <Text testID="trabajos-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}>
            Todavía no hay trabajos cobrados para medir cuánto te dejan.
          </Text>
        )}
        {filas.length > 0 && (
          <>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22, paddingHorizontal: 4 }}>
              Del que más te dejó al que menos. El porcentaje es la parte de lo cobrado que te quedó después de los gastos.
            </Text>
            <Tarjeta testID="trabajos-lista" style={styles.tarjeta}>
              {filas.map(({ t, pct }, i) => (
                <View
                  key={`${t.eslabon}-${t.ref}`}
                  testID={`trabajo-${t.eslabon}-${t.ref}`}
                  style={[styles.fila, i > 0 && { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) }]}
                >
                  <View style={styles.textos}>
                    <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>{t.etiqueta}</Text>
                    <Text style={tenue}>
                      {t.cobrado != null ? `Cobraste ${formatearImporte(t.cobrado)}` : 'Sin cobro'}
                      {t.gastado != null ? ` · gastaste ${formatearImporte(t.gastado)}` : ' · sin gastos anotados'}
                    </Text>
                    {t.margen != null && <Text style={tenue}>Te quedaron {formatearImporte(t.margen)}</Text>}
                  </View>
                  <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande }}>
                    {pct != null ? `${Math.round(pct)}%` : '—'}
                  </Text>
                </View>
              ))}
            </Tarjeta>
          </>
        )}
        {estado.fase === 'ok' && estado.sinIngreso > 0 && (
          <Text testID="trabajos-sin-ingreso" style={[tenue, { paddingHorizontal: 4 }]}>
            {estado.sinIngreso} trabajo{estado.sinIngreso === 1 ? '' : 's'} sin cobro registrado todavía — no aparece
            {estado.sinIngreso === 1 ? '' : 'n'} en la lista.
          </Text>
        )}
      </ScrollFormulario>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  tarjeta: { gap: 0, paddingVertical: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  textos: { flex: 1, gap: 2 },
});
