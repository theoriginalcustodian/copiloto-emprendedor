import { Text } from 'react-native';

import type { ArtefactoEnlace } from '@copiloto/core';

import { FilaBotones } from '../../theme/glass/campos';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';
import { abrirLink } from '../../util/abrirYCompartir';

export interface TarjetaArtefactoProps {
  artefacto: ArtefactoEnlace;
  testID?: string;
}

/**
 * `TarjetaArtefacto` — el artefacto que dejó una acción ya confirmada: el evento de Calendar o el
 * documento / planilla / archivo / borrador de mail (SM-D1, #1017). Gemela mobile de las ramas
 * `calendar_event` y `doc|sheet|file|email_draft` de `ArtifactView` (web); ambas leen el MISMO parser
 * (`leerArtefactoEnlace`). Sólo LECTURA + abrir: la acción ya ocurrió, no hay gate ni estado.
 *
 * Un evento sin `url` muestra el título y ningún botón — no se inventa un enlace.
 */
export function TarjetaArtefacto({ artefacto, testID = 'tarjeta-artefacto' }: TarjetaArtefactoProps) {
  const tema = useTema();
  const { titulo, url, etiqueta } = artefacto;
  return (
    <Tile testID={testID}>
      {titulo != null && (
        <Text
          testID={`${testID}-titulo`}
          style={{ color: tema.color.texto, fontSize: tema.tipo.base, marginBottom: url != null ? tema.espacio.sm : 0 }}
        >
          {titulo}
        </Text>
      )}
      {url != null && (
        <FilaBotones
          testID={`${testID}-botones`}
          botones={[
            {
              etiqueta,
              onPress: () => void abrirLink(url, 'el enlace'),
              variante: 'secundario',
              testID: `${testID}-abrir`,
            },
          ]}
        />
      )}
    </Tile>
  );
}
