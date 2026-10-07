import { Text } from 'react-native';

import {
  LEGAL_AVISO_PLANTILLA,
  LEGAL_DESCARGO,
  LEGAL_TITULOS,
  LEGAL_VERSION,
  parrafosDe,
  type LegalKind,
} from '@copiloto/core';

import { ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

export interface PantallaLegalProps {
  kind: LegalKind;
}

/**
 * Pantalla legal en mobile (BL-O6 parte A, 2026-09-22) — port de `LegalScreen` web
 * (`apps/copiloto-web/src/auth/LegalScreen.tsx`), mismo contenido compartido
 * (`packages/core/src/legal.ts`) para que el texto no diverja entre plataformas.
 *
 * El aviso de plantilla queda **a propósito** (ver docstring de la versión web): retirarlo es
 * decisión del operador, no de esta pantalla.
 *
 * Descargo de responsabilidad (2026-09-28, firmado por el operador): `LEGAL_DESCARGO`, PROVISORIO
 * hasta revisión de un abogado — ver docstring en `packages/core/src/legal.ts`.
 */
export function PantallaLegal({ kind }: PantallaLegalProps) {
  const tema = useTema();

  return (
    <MarcoGlass titulo={LEGAL_TITULOS[kind]} icono="cuenta" testID={`legal-screen-${kind}`}>
      <ScrollFormulario
        testID={`legal-screen-${kind}-contenido`}
        contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
      >
        <Text
          testID="legal-screen-placeholder-notice"
          style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico }}
        >
          {LEGAL_AVISO_PLANTILLA}
        </Text>

        <Text
          testID="legal-screen-descargo"
          style={{ color: tema.color.acentoTinta, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico }}
        >
          {LEGAL_DESCARGO}
        </Text>

        {parrafosDe(kind).map((parrafo) => (
          <Text key={parrafo.titulo} style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
            <Text style={{ fontFamily: tema.fuente.uiSemibold }}>{parrafo.titulo}</Text> {parrafo.cuerpo}
          </Text>
        ))}

        <Text
          testID="legal-screen-version"
          style={{ color: tema.color.textoTenue, fontFamily: tema.fuente.mono, fontSize: tema.tipo.chico }}
        >
          Versión {LEGAL_VERSION}
        </Text>
      </ScrollFormulario>
    </MarcoGlass>
  );
}
