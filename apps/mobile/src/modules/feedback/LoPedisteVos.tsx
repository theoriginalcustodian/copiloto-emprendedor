import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { listarFeedbackPropio, type FeedbackPropio } from '@copiloto/core';

import { useTema } from '../../theme/ThemeProvider';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** El mes en que se mandó («Julio»), como el `.cuando` del prototipo; `null` si la fecha no parsea. */
function mesDeEnvio(creadoEn: string | null): string | null {
  if (creadoEn == null) return null;
  const t = Date.parse(creadoEn);
  return Number.isNaN(t) ? null : MESES[new Date(t).getMonth()];
}

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
          {/* Estado (BL-J12/K-08) + el mes en que se mandó, que es lo que dibuja el prototipo (`.cuando`). */}
          <View style={{ flexDirection: 'row', gap: tema.espacio.sm }}>
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
            {mesDeEnvio(it.creadoEn) != null && (
              <Text
                testID={`lo-pediste-vos-${it.id}-mes`}
                style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
              >
                · {mesDeEnvio(it.creadoEn)}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
