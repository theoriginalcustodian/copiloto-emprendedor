import { StyleSheet, Text, View } from 'react-native';

import {
  estadoFacturacionCliente,
  facturacionDeCliente,
  subtituloDeCliente,
  textoMontoCliente,
  type Cliente,
} from '@copiloto/core';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaCliente` — una línea de la cartera.
 *
 * 🔴 **El documento se muestra sólo si existe**, y nunca se inventa una etiqueta para su ausencia.
 * Un cliente sin documento es el caso NORMAL de esta cartera —se derivó de un presupuesto, donde el
 * documento es opcional—, así que un "sin CUIT" en rojo marcaría como incompleta a la mitad de las
 * fichas. Lo que falta se ve porque no está, no porque se lo señale. (Una excepción MEDIDA, C-D1: la columna
 * del monto —que sin documento no puede atribuir facturas— dice «Sin CUIT cargado» en tono tenue, porque ahí
 * un «—» sin explicación se leería como «no compró». El subtítulo sigue sin marcar nada.)
 *
 * 🔴 **El subtítulo cae al PRIMER dato que identifique**: documento, teléfono, mail, domicilio o notas. No
 * es adorno — desde que existe `forzar` (el alta de un homónimo legítimo), la cartera puede tener dos
 * clientes con el mismo nombre, y sin esto quedan **dos filas idénticas**: el emprendedor no puede
 * elegir a cuál facturarle. Se muestra uno solo, el más identificatorio disponible, para no convertir
 * la lista en una ficha.
 *
 * ⚠️ **Y no alcanza solo.** Dos homónimos recién creados a mano pueden no tener ningún dato: eso se
 * ataja en el ALTA, avisando antes de forzar (ver `FormularioCliente`), que es el único momento en que
 * alguien sabe en qué se diferencian.
 *
 * 🔴 **La columna derecha dice lo que el listado MIDIÓ, con la regla del core** (`textoMontoCliente` +
 * `estadoFacturacionCliente`, las mismas que usa la web — no se reimplementan acá). Con el par
 * `monto_facturado` + `facturas_atribuibles`: «$importe · N comprobantes»; con `facturas_atribuibles: false`
 * «—» y «Sin CUIT cargado» (NUNCA un número: el `"0.00"` ahí es «no se puede saber», y pintarlo como
 * «Todavía sin comprar» afirmaría lo que no se midió). Si el backend no declaró el par, cae al conteo de
 * comprobantes y, sin él, a «—»: nunca un cero inventado. (Hasta el 2026-10-13 esta tarjeta NO pintaba el
 * monto y el cierre #1079 lo atribuía a «una decisión documentada en su docstring»: **no estaba escrita acá**.
 * Esto cierra esa deuda pintándolo, no enmendándola.)
 *
 * 🔴 **El subtítulo trae la condición IVA con documento** («CUIT 20-12345678-9 · Resp. Inscripto», el formato
 * del prototipo `index.html:2213`) y, sin documento, cae al primer dato identificatorio: es
 * `subtituloDeCliente`, del core, la misma regla que la web.
 *
 * 🔴 **«Se agregó solo» tampoco se pinta en la columna derecha** (el prototipo lo muestra como chip
 * `.estado.auto`): es la misma decisión de abajo aplicada al chip — ver la nota sobre `origen`.
 *
 * 🔴 **`origen: 'derivado'` no se marca.** Es el default de una cartera que se armó sola; etiquetar
 * el caso mayoritario es ruido. Se marca lo que el emprendedor cargó a mano, que es la excepción y
 * además es el dato con el que vamos a saber si la cartera se armó sola o la cargaron.
 */

export interface TarjetaClienteProps {
  cliente: Cliente;
  onPress?: (cliente: Cliente) => void;
}

export function TarjetaCliente({ cliente, onPress }: TarjetaClienteProps) {
  const tema = useTema();
  // El subtítulo y el slot de facturación son reglas del CORE (una sola para web y mobile).
  const subtitulo = subtituloDeCliente(cliente);
  const montoTexto = textoMontoCliente(cliente);
  // 📝 «Se agregó solo» NO se pinta (enmienda de la divergencia 1 de `clientes`, con motivo): el derivado es
  // el DEFAULT de la cartera y etiquetar el caso mayoritario es ruido; lo cuenta el BloqueCifra («N se
  // agregaron solos este mes», `PantallaClientes`). Se pasa `esAuto = true` y se descarta el chip `auto`:
  // así sólo sobreviven los estados MEDIDOS («Sin CUIT cargado», «Todavía sin comprar») y un listado sin el
  // par declarado NO cae a un «Todavía sin comprar» deducido.
  const medido = estadoFacturacionCliente(facturacionDeCliente(cliente), true);
  const estado = medido != null && !medido.auto ? medido : null;

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
        <View style={styles.derecha}>
          <Text
            numberOfLines={1}
            style={{ color: tema.color.texto, fontSize: tema.tipo.chico, fontWeight: '600' }}
            testID={`cliente-${cliente.id}-monto`}
          >
            {montoTexto}
          </Text>
          {estado != null && (
            <Text
              numberOfLines={1}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
              testID={`cliente-${cliente.id}-estado`}
            >
              {estado.texto}
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
  derecha: { alignItems: 'flex-end', gap: 2, maxWidth: '50%' },
});
