import { useLocalSearchParams } from 'expo-router';

import type { LegalKind } from '@copiloto/core';

import { PantallaLegal } from '../src/modules/ajustes/PantallaLegal';

const KINDS_VALIDOS: readonly LegalKind[] = ['tos', 'privacidad'];

/** Mismo criterio de guarda que `funcionDeParam` en `ajustes-soporte.tsx`: un `kind` que no
 *  matchea el enum cerrado (deep-link roto) degrada a `'tos'` en vez de reventar. */
function kindDeParam(v: string | string[] | undefined): LegalKind {
  const crudo = Array.isArray(v) ? v[0] : v;
  return KINDS_VALIDOS.includes(crudo as LegalKind) ? (crudo as LegalKind) : 'tos';
}

/** Ruta de ToS/Privacidad (BL-O6 parte A) — se llega desde `PantallaCuenta`, pantalla HOJA. */
export default function PantallaLegalRoute() {
  const params = useLocalSearchParams<{ kind?: string }>();
  return <PantallaLegal kind={kindDeParam(params.kind)} />;
}
