import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { formatearImporte, leerTablero, type ColumnaTablero, type Tablero } from '@copiloto/core';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaMiDia` — el tablero Kanban del día (hito 7): presupuestos → facturado → por cobrar →
 * cobrado.
 *
 * 🔴 **[CONNECT] — contra CONTRATO §3.2, el endpoint `GET /mi-dia/tablero` todavía NO está vivo.** Toda
 * la pantalla habla con `leerTablero()`, el único punto que el connect toca. Degrada a `no_disponible`
 * y lo DICE — no simula tarjetas.
 *
 * 🔴 **Sólo LECTURA por ahora, y no es un recorte perezoso: es lo que el contrato define.** El §3.2
 * dice que el **drag entre columnas dispara una tool** («marcar presupuesto aprobado, factura cobrada»)
 * y que **esas tools las baja backend** — o sea que su contrato **no existe todavía**. Construir el
 * gesto de arrastre ahora sería atarlo a una acción imaginada. El board se renderiza entero; el drag
 * se agrega cuando su tool esté contratada, con la skill `swmansion-rn-gestures` en la mano (es
 * gesto-pesado y sólo verificable en device). Marcado abajo como el `[BLOQUEADO]` del hito.
 *
 * 🔴 **`ScrollView` de gesture-handler, no de react-native** — convención del repo (ver `Tile.tsx`):
 * la app cuelga de un `GestureHandlerRootView` y mezclar el responder system de RN con RNGH hace que
 * un tap corto quede sin dueño. Acá el board scrollea horizontal.
 */

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

export function PantallaMiDia() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await leerTablero();
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setTablero(res.tablero);
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

  const totalTarjetas = tablero?.columnas.reduce((n, c) => n + c.tarjetas.length, 0) ?? 0;

  return (
    <MarcoGlass titulo="Mi día" icono="clock" testID="pantalla-midia">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="midia-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="midia-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Tu día todavía no está disponible en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && tablero != null && (
        <>
          {totalTarjetas === 0 && (
            <View style={styles.centro}>
              <Text testID="midia-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}>
                Hoy no tenés nada pendiente. Cuando haya presupuestos o facturas por seguir, aparecen acá.
              </Text>
            </View>
          )}

          {totalTarjetas > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.board}
              testID="midia-board"
            >
              {tablero.columnas.map((col) => (
                <Columna key={col.id} columna={col} />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </MarcoGlass>
  );
}

function Columna({ columna }: { columna: ColumnaTablero }) {
  const tema = useTema();
  return (
    <View style={styles.columna} testID={`midia-columna-${columna.id}`}>
      <View style={styles.columnaHeader}>
        <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}>
          {columna.titulo}
        </Text>
        <Text style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico }}>
          {columna.tarjetas.length}
        </Text>
      </View>

      {columna.tarjetas.length === 0 ? (
        <Text testID={`midia-columna-${columna.id}-vacia`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, opacity: 0.6 }}>
          —
        </Text>
      ) : (
        columna.tarjetas.map((t) => (
          <Row key={t.id} testID={`midia-tarjeta-${t.id}`}>
            <View style={styles.tarjeta}>
              <Text numberOfLines={2} style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
                {t.titulo || 'Sin título'}
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {[t.cliente, t.monto != null ? formatearImporte(t.monto) : null, t.fecha]
                  .filter((x): x is string => x != null && x !== '')
                  .join(' · ')}
              </Text>
            </View>
          </Row>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  board: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 120 },
  columna: { width: 220, gap: 8 },
  columnaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tarjeta: { flex: 1, gap: 4 },
});
