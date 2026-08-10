import { useLocalSearchParams } from 'expo-router';

import type { FuncionSoporte } from '@copiloto/core';

import { PantallaSoporte } from '../src/modules/soporte';

const FUNCIONES_VALIDAS: readonly FuncionSoporte[] = ['soporte_tecnico', 'como_uso_la_app'];

/** `funcion` llega como string por la URL — mismo criterio de guarda que `gastoId` en
 * `app/gastos.tsx`: un valor que no matchea el enum cerrado (deep-link roto, versión vieja
 * cacheada) degrada al default en vez de pasarlo tal cual al hook y que el backend lo rechace con
 * un 400 que el usuario no sabría interpretar. */
function funcionDeParam(v: string | string[] | undefined): FuncionSoporte {
  const crudo = Array.isArray(v) ? v[0] : v;
  return FUNCIONES_VALIDAS.includes(crudo as FuncionSoporte) ? (crudo as FuncionSoporte) : 'soporte_tecnico';
}

/** Ruta de "Soporte" (SOP5) — mismo patrón que `ajustes-feedback.tsx`: pantalla HOJA, no
 * lanzadora, se llega desde una de las DOS filas de `PantallaCuenta` (una por `funcion`). */
export default function PantallaSoporteRoute() {
  const params = useLocalSearchParams<{ funcion?: string }>();
  return <PantallaSoporte funcion={funcionDeParam(params.funcion)} />;
}
