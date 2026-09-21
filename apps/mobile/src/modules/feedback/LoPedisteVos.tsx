import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { listarFeedbackPropio, type FeedbackPropio } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';

/**
 * «Lo pediste vos» (BL-J12, K-08) — el feedback PROPIO y si el equipo ya lo escuchó. Paridad con
 * `LoPedisteVos` de la web: la lógica de lectura/mapeo vive en `@copiloto/core`.
 *
 * 🔴 **Fail-soft**: es un agregado del formulario, no la pantalla. Si `GET /feedback` falla o no hay
 * nada enviado, no se dibuja NADA (ni error ni sección vacía).
 *
 * `version` sube cuando el padre confirma un envío nuevo, para que aparezca sin recargar.
 */
export function LoPedisteVos({ version = 0 }: { version?: number }) {
  const tema = useTema();
  const [items, setItems] = useState<FeedbackPropio[]>([]);

  useEffect(() => {
    let vivo = true;
    void listarFeedbackPropio()
      .then((lista) => {
        if (vivo) setItems(lista);
      })
      .catch(() => {
        // Silencio deliberado: ver el docstring del componente.
      });
    return () => {
      vivo = false;
    };
  }, [version]);

  if (items.length === 0) return null;

  return (
    <View testID="lo-pediste-vos" style={{ gap: tema.espacio.sm }}>
      <Text
        accessibilityRole="header"
        style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.base }}
      >
        Lo pediste vos
      </Text>
      {items.map((it) => (
        <View
          key={it.id}
          testID={`lo-pediste-vos-${it.id}`}
          style={{ gap: 2, paddingVertical: tema.espacio.xs }}
        >
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{it.texto}</Text>
          {it.escuchado ? (
            <Text
              testID={`lo-pediste-vos-${it.id}-escuchado`}
              style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.chico }}
            >
              Escuchado
            </Text>
          ) : (
            <Text
              testID={`lo-pediste-vos-${it.id}-pendiente`}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
            >
              Enviado
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
