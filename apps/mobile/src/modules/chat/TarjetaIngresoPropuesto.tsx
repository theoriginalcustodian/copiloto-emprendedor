import { useState } from 'react';

import { formatearImporte, type IngresoPropuesto } from '@copiloto/core';

import { FormularioIngreso } from '../ingresos/FormularioIngreso';
import { TarjetaPropuestaShell, TarjetaPropuestaTerminal } from './TarjetaPropuestaShell';

/**
 * `TarjetaIngresoPropuesto` — lo que el copiloto entendió de un ingreso dictado, editable antes de
 * guardar. 3ª card del patrón (hito 8, §2 del contrato de modos: "anotar ingreso" pasa de directo a
 * card editable en modo confirmación) — la que disparó la extracción de `TarjetaPropuestaShell`.
 *
 * 🔴 **`FormularioIngreso` sigue manejando su post-guardado INTERNAMENTE mientras el ingreso puede
 * completarse** (el aviso de `falta`, con Completar sobre el MISMO ingreso) — por eso `onGuardado`
 * NO transiciona la card por sí solo, a diferencia de Gasto/Cliente. Pero cuando el emprendedor
 * dice explícitamente "Así está bien" (declina completar los opcionales), mostrar el formulario para
 * siempre —o peor, tratarlo como 'descartado'— le mentiría: el ingreso YA está guardado. `onListo`
 * lleva la card a su Tile de éxito recién en ese punto, igual que la card web equivalente (bug real
 * medido en vivo contra prod, 2026-08-12: antes reusaba `onCancelar` y mostraba "No lo anotamos"
 * sobre un ingreso que sí tenía POST 201).
 */

type Estado = 'editando' | 'guardado' | 'descartado';

export interface TarjetaIngresoPropuestoProps {
  propuesta: IngresoPropuesto;
  testID?: string;
}

export function TarjetaIngresoPropuesto({
  propuesta,
  testID = 'ingreso-propuesto',
}: TarjetaIngresoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>('editando');
  // Se actualiza en `onGuardado` (sesión viva) para que el Tile de éxito, si `onListo` lo dispara
  // después, muestre el monto real y no un `null` de haberse leído sólo una vez al montar.
  const [monto, setMonto] = useState<string | null>(null);

  if (estado === 'guardado') {
    return (
      <TarjetaPropuestaTerminal
        testID={`${testID}-guardado`}
        tono="exito"
        texto={`Ingreso anotado${monto != null ? `: ${formatearImporte(monto)}` : ''}`}
      />
    );
  }

  if (estado === 'descartado') {
    return <TarjetaPropuestaTerminal testID={`${testID}-descartado`} tono="tenue" texto="No lo anotamos." />;
  }

  return (
    <TarjetaPropuestaShell
      testID={testID}
      aviso="Esto entendí. Revisalo y tocá Anotar — todavía no lo guardé."
      cita={propuesta.concepto}
    >
      <FormularioIngreso
        origen="voz"
        iniciales={{
          monto: propuesta.monto,
          cliente: propuesta.clienteNombre ?? undefined,
          medio: propuesta.medio ?? undefined,
          concepto: propuesta.concepto ?? undefined,
          fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
        }}
        onGuardado={(ingreso) => {
          /* Sigue montado: FormularioIngreso muestra su propia confirmación (con "falta"/"completo")
             mientras se puede completar. Sólo se guarda el monto para el Tile que `onListo` arma. */
          setMonto(ingreso.monto);
        }}
        onListo={() => setEstado('guardado')}
        onCancelar={() => setEstado('descartado')}
        testID={`${testID}-formulario`}
      />
    </TarjetaPropuestaShell>
  );
}
