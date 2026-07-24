import { useState } from 'react';

import type { PresupuestoPropuesto } from '@copiloto/core';

import { FormularioPresupuesto } from '../presupuestos/FormularioPresupuesto';
import { TarjetaPropuestaShell, TarjetaPropuestaTerminal } from './TarjetaPropuestaShell';

/**
 * `TarjetaPresupuestoPropuesto` — lo que el copiloto entendió de un presupuesto dictado, con sus
 * ítems editables **fila por fila** antes de guardar (hito 8, decisión de planificación en
 * `respuesta_..._base-es-precarga-no-esquema-y-la-card-de-presupuesto-es-lista-editable` §3).
 *
 * 🔴 **v1 = editar lo YA PARSEADO, no agregar/quitar filas desde la card.** `FormularioPresupuesto` sí
 * permite las dos cosas (son las mismas `agregarFila`/`quitarFila` del alta manual, no una versión
 * recortada) — la acotación es de ALCANCE del hito, no técnica: agregar/quitar es deuda GESTIONADA
 * (dueño: frontend; se paga si aparece el caso real de "el motor se olvidó un ítem"), anotada acá y no
 * silenciada.
 *
 * Reusa `FormularioPresupuesto` vía su prop `iniciales` (NO `corrige`): `corrige` es la corrección de
 * un presupuesto YA EMITIDO (`reemplazaA`, "Corregir el N° X") — un concepto distinto de "esto es lo
 * que entendí de tu dictado, todavía sin guardar", que es lo que esta card muestra.
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
