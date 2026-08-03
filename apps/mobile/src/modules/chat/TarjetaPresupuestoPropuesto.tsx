import { useState } from 'react';

import type { PresupuestoPropuesto } from '@copiloto/core';

import { FormularioPresupuesto } from '../presupuestos/FormularioPresupuesto';
import { TarjetaPropuestaShell, TarjetaPropuestaTerminal } from './TarjetaPropuestaShell';

/**
 * `TarjetaPresupuestoPropuesto` — lo que el copiloto entendió de un presupuesto dictado, con sus
 * ítems editables **fila por fila** antes de guardar (hito 8, decisión de planificación en
 * `respuesta_..._base-es-precarga-no-esquema-y-la-card-de-presupuesto-es-lista-editable` §3).
 *
 * Reusa `FormularioPresupuesto` **entero** vía su prop `iniciales` (NO `corrige`): `corrige` es la
 * corrección de un presupuesto YA EMITIDO (`reemplazaA`, "Corregir el N° X") — un concepto distinto de
 * "esto es lo que entendí de tu dictado, todavía sin guardar", que es lo que esta card muestra.
 *
 * 🔴 **Agregar/quitar filas y el catálogo YA están activos acá**, porque `FormularioPresupuesto` no
 * tiene un modo acotado que los oculte. Decisión del operador (2026-07-24,
 * `respuesta_planificacion-a-todos_hito-P-decidido-por-el-operador...`): se quedan así — restringirlos
 * sería construir algo nuevo para quitar una capacidad que nadie reportó como problema. "Corregir un
 * ítem que el motor entendió mal" y "agregar el que se olvidó" son la misma corrección para quien
 * dicta.
 */

type Estado = 'editando' | 'guardado' | 'descartado';

export interface TarjetaPresupuestoPropuestoProps {
  propuesta: PresupuestoPropuesto;
  testID?: string;
}

export function TarjetaPresupuestoPropuesto({
  propuesta,
  testID = 'presupuesto-propuesto',
}: TarjetaPresupuestoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>('editando');
  const [numero, setNumero] = useState<number | null>(null);

  if (estado === 'guardado') {
    return (
      <TarjetaPropuestaTerminal
        testID={`${testID}-guardado`}
        tono="exito"
        texto={`Presupuesto anotado${numero != null ? ` — N° ${numero}` : ''}`}
      />
    );
  }

  if (estado === 'descartado') {
    return <TarjetaPropuestaTerminal testID={`${testID}-descartado`} tono="tenue" texto="No lo guardamos." />;
  }

  return (
    <TarjetaPropuestaShell testID={testID} aviso="Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar — todavía no lo anoté.">
      <FormularioPresupuesto
        iniciales={{
          concepto: propuesta.concepto,
          receptor: {
            nombre: propuesta.receptor.nombre,
            docTipo: propuesta.receptor.docTipo,
            docNro: propuesta.receptor.docNro,
            contacto: propuesta.receptor.contacto,
          },
          items: propuesta.items,
        }}
        onCreado={(p) => {
          setNumero(p.numero);
          setEstado('guardado');
        }}
        onCancelar={() => setEstado('descartado')}
        testID={`${testID}-formulario`}
      />
    </TarjetaPropuestaShell>
  );
}
