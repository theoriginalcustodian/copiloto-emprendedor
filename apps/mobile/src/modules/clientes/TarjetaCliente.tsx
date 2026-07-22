import { StyleSheet, Text, View } from 'react-native';

import type { Cliente } from '@copiloto/core';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaCliente` — una línea de la cartera.
 *
 * 🔴 **El documento se muestra sólo si existe**, y nunca se inventa una etiqueta para su ausencia.
 * Un cliente sin documento es el caso NORMAL de esta cartera —se derivó de un presupuesto, donde el
 * documento es opcional—, así que un "sin CUIT" en rojo marcaría como incompleta a la mitad de las
 * fichas. Lo que falta se ve porque no está, no porque se lo señale.
 *
 * 🔴 **`origen: 'derivado'` no se marca.** Es el default de una cartera que se armó sola; etiquetar
 * el caso mayoritario es ruido. Se marca lo que el emprendedor cargó a mano, que es la excepción y
 * además es el dato con el que vamos a saber si la cartera se armó sola o la cargaron.
 */

const ETIQUETA_DOC: Record<number, string> = { 80: 'CUIT', 96: 'DNI' };

export interface TarjetaClienteProps {
  cliente: Cliente;
  onPress?: (cliente: Cliente) => void;
}

export function TarjetaCliente({ cliente, onPress }: TarjetaClienteProps) {
  const tema = useTema();
  const doc =
    cliente.docNro != null && cliente.docNro !== ''
      ? `${ETIQUETA_DOC[cliente.docTipo ?? 0] ?? 'Doc'} ${cliente.docNro}`
      : null;

  return (
    <Tile
      onPress={onPress != null ? () => onPress(cliente) : undefined}
      testID={`cliente-${cliente.id}`}
    >
      <View style={styles.fila}>
        <View style={styles.izquierda}>
          <Text
            numberOfLines={1}
            style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}
            testID={`cliente-${cliente.id}-nombre`}
          >
            {cliente.nombre}
          </Text>
          {(doc != null || cliente.contacto != null) && (
            <Text
              numberOfLines={1}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
              testID={`cliente-${cliente.id}-sub`}
            >
              {[doc, cliente.contacto].filter((x) => x != null).join(' · ')}
            </Text>
          )}
        </View>
        {cliente.origen !== 'derivado' && (
          <Text
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
            testID={`cliente-${cliente.id}-origen`}
          >
            {cliente.origen === 'voz' ? '🎙' : '✎'}
          </Text>
        )}
      </View>
    </Tile>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  izquierda: { flex: 1, gap: 2 },
});
