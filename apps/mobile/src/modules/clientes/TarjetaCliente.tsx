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
 * 🔴 **El subtítulo cae al PRIMER dato que identifique**: documento, contacto, domicilio o notas. No
 * es adorno — desde que existe `forzar` (el alta de un homónimo legítimo), la cartera puede tener dos
 * clientes con el mismo nombre, y sin esto quedan **dos filas idénticas**: el emprendedor no puede
 * elegir a cuál facturarle. Se muestra uno solo, el más identificatorio disponible, para no convertir
 * la lista en una ficha.
 *
 * ⚠️ **Y no alcanza solo.** Dos homónimos recién creados a mano pueden no tener ningún dato: eso se
 * ataja en el ALTA, avisando antes de forzar (ver `FormularioCliente`), que es el único momento en que
 * alguien sabe en qué se diferencian.
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

  // El primero que exista, en orden de cuánto identifica. `null` si el cliente no tiene ninguno —y
  // ahí la fila queda con el nombre solo, que es honesto: no hay nada más que mostrar.
  const subtitulo =
    [doc, cliente.contacto, cliente.domicilio, cliente.notas]
      .map((x) => (x != null && x.trim() !== '' ? x.trim() : null))
      .find((x) => x != null) ?? null;

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
          {subtitulo != null && (
            <Text
              numberOfLines={1}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
              testID={`cliente-${cliente.id}-sub`}
            >
              {subtitulo}
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
