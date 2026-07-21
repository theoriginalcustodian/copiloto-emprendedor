import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import type { EstadoFacturaResp, NuevoItem } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';
import { CampoNumero, CampoTexto, FilaBotones } from '../../theme/glass/campos';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { Row } from '../../theme/glass/Row';

/**
 * Paso 2 — Ítems. Lista + alta + borrado. 🔴 **`subtotal`/`total` los muestra tal cual los manda el
 * backend (`estado.items[].subtotal`, `estado.total`) -- ninguna suma ni multiplicación vive acá.** Es
 * la regla central del plan de facturación: dos calculadoras de importes (la app y AFIP) divergen, y
 * sólo el backend es la fiscal. `cantidad`/`precioUnitario` viajan y se muestran como STRING de punta a
 * punta (mismo criterio que `CampoNumero`).
 */
export interface PasoItemsProps {
  estado: EstadoFacturaResp;
  onAgregar: (item: NuevoItem) => Promise<void>;
  onQuitar: (indice: number) => Promise<void>;
  modoEdicion?: boolean;
  onVolverResumen?: () => void;
  testID?: string;
}

export function PasoItems({
  estado,
  onAgregar,
  onQuitar,
  modoEdicion = false,
  onVolverResumen,
  testID = 'facturacion-paso-items',
}: PasoItemsProps) {
  const tema = useTema();
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [precioUnitario, setPrecioUnitario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [quitando, setQuitando] = useState<number | null>(null);

  const listoLocal = descripcion.trim() !== '' && cantidad !== '' && precioUnitario !== '';

  async function agregar() {
    setEnviando(true);
    try {
      await onAgregar({ descripcion, cantidad, precioUnitario });
      setDescripcion('');
      setCantidad('');
      setPrecioUnitario('');
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(indice: number) {
    setQuitando(indice);
    try {
      await onQuitar(indice);
    } finally {
      setQuitando(null);
    }
  }

  return (
    <View testID={testID} style={[styles.contenedor, { gap: tema.espacio.md }]}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        Ítems
      </Text>

      {estado.items.length === 0 && (
        <Text testID={`${testID}-vacio`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Todavía no agregaste ningún ítem.
        </Text>
      )}

      {estado.items.map((item, indice) => (
        <Row key={`${item.descripcion}-${indice}`} testID={`${testID}-fila-${indice}`}>
          <View style={[styles.filaContenido, { gap: tema.espacio.sm }]}>
            <View style={styles.filaTextos}>
              <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiMedium, fontSize: tema.tipo.base }}>
                {item.descripcion}
              </Text>
              <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {item.cantidad} × {item.precioUnitario} = {item.subtotal}
              </Text>
            </View>
            <Pressable
              testID={`${testID}-eliminar-${indice}`}
              accessibilityRole="button"
              onPress={() => quitar(indice)}
              disabled={quitando === indice}
              style={pressableStyle(undefined, PRESS_FADE)}
            >
              <Text style={{ color: tema.color.peligro, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}>
                {quitando === indice ? 'Quitando…' : 'Eliminar'}
              </Text>
            </Pressable>
          </View>
        </Row>
      ))}

      <View style={{ gap: tema.espacio.sm }}>
        <CampoTexto etiqueta="Descripción" valor={descripcion} onChange={setDescripcion} testID={`${testID}-descripcion`} />
        <CampoNumero etiqueta="Cantidad" valor={cantidad} onChange={setCantidad} testID={`${testID}-cantidad`} />
        <CampoNumero
          etiqueta="Precio unitario"
          valor={precioUnitario}
          onChange={setPrecioUnitario}
          testID={`${testID}-precio-unitario`}
        />
        <FilaBotones
          testID={`${testID}-agregar-botones`}
          botones={[
            {
              etiqueta: enviando ? 'Agregando…' : 'Agregar ítem',
              onPress: agregar,
              variante: 'secundario',
              deshabilitado: !listoLocal || enviando,
              testID: `${testID}-agregar`,
            },
          ]}
        />
      </View>

      <Text testID={`${testID}-total`} style={{ color: tema.color.acento, fontFamily: tema.fuente.uiBold, fontSize: tema.tipo.grande }}>
        Total: {estado.total}
      </Text>

      {modoEdicion && onVolverResumen && (
        <FilaBotones
          testID={`${testID}-volver-botones`}
          botones={[{ etiqueta: 'Volver al resumen', onPress: onVolverResumen, testID: `${testID}-volver` }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
  filaContenido: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  filaTextos: { flexShrink: 1, gap: 2 },
});
