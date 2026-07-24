import { useState } from 'react';

import type { IngresoPropuesto } from '@copiloto/core';

import { FormularioIngreso } from '../ingresos/FormularioIngreso';
import { TarjetaPropuestaShell, TarjetaPropuestaTerminal } from './TarjetaPropuestaShell';

/**
 * `TarjetaIngresoPropuesto` — lo que el copiloto entendió de un ingreso dictado, editable antes de
 * guardar. 3ª card del patrón (hito 8, §2 del contrato de modos: "anotar ingreso" pasa de directo a
 * card editable en modo confirmación) — la que disparó la extracción de `TarjetaPropuestaShell`.
 *
 * 🔴 **Sin estado 'guardado' propio, a diferencia de Gasto/Cliente.** `FormularioIngreso` ya maneja su
 * post-guardado INTERNAMENTE (el aviso de `falta`/"completo", con Completar sobre el MISMO ingreso) —
 * envolverlo en un Tile "Ingreso anotado" que lo reemplaza escondería justo esa UI de completar. Acá
 * la shell + el formulario SON la confirmación; sólo 'descartado' necesita su propio estado, porque
 * cancelar sí hace desaparecer el formulario entero.
 */

type Estado = 'editando' | 'descartado';

export interface TarjetaIngresoPropuestoProps {
  propuesta: IngresoPropuesto;
  testID?: string;
}

export function TarjetaIngresoPropuesto({
  propuesta,
  testID = 'ingreso-propuesto',
}: TarjetaIngresoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>('editando');

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
        iniciales={{
          monto: propuesta.monto,
          cliente: propuesta.clienteNombre ?? undefined,
          medio: propuesta.medio ?? undefined,
          concepto: propuesta.concepto ?? undefined,
          fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
        }}
        onGuardado={() => {
          /* FormularioIngreso ya muestra su propia confirmación (con "falta"/"completo"); acá no hay
             nada más que hacer — la card se queda montada, mostrando esa confirmación. */
        }}
        onCancelar={() => setEstado('descartado')}
        testID={`${testID}-formulario`}
      />
    </TarjetaPropuestaShell>
  );
}
