import { Text, View } from 'react-native';

import type { DatosNegocio } from '@copiloto/core';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaDatosNegocio` — la respuesta de LECTURA a «¿cuánto entró este mes?», «¿quién me debe?»
 * (`datos_negocio`, preg-datos / C-D5). Forma del prototipo (`prototipo/index.html`, la card `preg`):
 * encabezado (título + chip) · una fila `clave → valor` por cifra · nota debajo. Sólo lectura: no hay
 * gate, propuesta ni acción.
 *
 * 🔴 **`valor` se pinta TAL CUAL.** Llega ya formateado por el backend (`$1.234,56`); acá no se
 * parsea ni se pasa por `formatearImporte` — un segundo formateo es un segundo camino al mismo número.
 *
 * 🔴 **La `nota` se pinta SIEMPRE que viene.** Es la salvedad que cambia cómo se lee el número
 * (Mercado Pago desconectado = «lo que entró puede estar incompleto»); sin ella la card muestra un
 * `$0,00` que el emprendedor lee como completo. `chip` y `nota` son opcionales y la card renderiza
 * igual sin ellos — sin píldora vacía ni renglón vacío.
 *
 * Con N cifras no hay un «valor grande» único: todas llevan el mismo peso, en el orden del backend.
 * Cada fila se lee de corrido para el lector de pantalla («Entró: $120.000,00»), no como dos textos
 * sueltos.
 */
export interface TarjetaDatosNegocioProps {
  datos: DatosNegocio;
}

export function TarjetaDatosNegocio({ datos }: TarjetaDatosNegocioProps) {
  const tema = useTema();
  return (
    <Tile testID="datos-negocio">
      <View style={{ gap: tema.espacio.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: tema.espacio.sm }}>
          <Text
            testID="datos-negocio-titulo"
            accessibilityRole="header"
            style={{ flexShrink: 1, color: tema.color.texto, fontSize: tema.tipo.base, fontWeight: '600' }}
          >
            {datos.titulo}
          </Text>
          {datos.chip != null && (
            <View
              style={{
                borderWidth: 1,
                borderColor: tema.color.borde,
                borderRadius: tema.radio.completo,
                paddingHorizontal: tema.espacio.sm,
                paddingVertical: tema.espacio.xs,
              }}
            >
              <Text testID="datos-negocio-chip" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                {datos.chip}
              </Text>
            </View>
          )}
        </View>
        {datos.cifras.map((cifra, i) => (
          <View
            key={`${i}-${cifra.clave}`}
            testID={`datos-negocio-cifra-${i}`}
            accessible
            accessibilityLabel={`${cifra.clave}: ${cifra.valor}`}
            style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: tema.espacio.md }}
          >
            <Text style={{ flexShrink: 1, color: tema.color.textoTenue, fontSize: tema.tipo.base }}>{cifra.clave}</Text>
            <Text
              style={{
                flexShrink: 1,
                textAlign: 'right',
                color: tema.color.texto,
                fontSize: tema.tipo.grande,
                fontFamily: tema.fuente.display,
              }}
            >
              {cifra.valor}
            </Text>
          </View>
        ))}
        {datos.nota != null && (
          <Text testID="datos-negocio-nota" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {datos.nota}
          </Text>
        )}
      </View>
    </Tile>
  );
}
