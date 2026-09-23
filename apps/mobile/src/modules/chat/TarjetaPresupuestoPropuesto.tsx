import { useState } from 'react';

import type { ChatMessage, PresupuestoPropuesto } from '@copiloto/core';

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
 *
 * 🔴 **Guard cross-remount — MIGRADO de patrón A a patrón B (GUARDM parte 2).** Nació con un guard
 * propio en `AsyncStorage` (K-01/BL-D1, PR #663: `copiloto-presupuesto-propuesto-resuelto:<mensajeId>`,
 * misma clave/forma que la web). Funcionaba, pero mobile no tiene ningún mecanismo de poda para esas
 * claves — a diferencia de la web, que ya podó su propio patrón A —, así que cada mensaje resuelto
 * dejaba una clave que nunca se borraba: la misma fuga que ya se había bloqueado para las otras 4 cards
 * de propuesta. Ahora `resuelto` (`mensaje.presupuestoResuelto`) vive DENTRO del mensaje persistido —
 * mismo mecanismo que `hitlRespondido`/`conexionDescartada`/`gastoResuelto` — y no hay nada que podar:
 * la marca muere con el mensaje. `mensajeId` se queda (lo sigue necesitando `FormularioPresupuesto` para
 * derivar la `idem_key`, mecanismo INDEPENDIENTE del guard de resolución que se migró acá).
 */

type Estado = 'editando' | 'guardado' | 'descartado';

export interface TarjetaPresupuestoPropuestoProps {
  propuesta: PresupuestoPropuesto;
  /** El `id` del `ChatMessage` que trae esta card — sólo para la `idem_key` de `FormularioPresupuesto`
   * (ver docstring del módulo). Ya NO es la clave de ningún guard local. */
  mensajeId: string;
  /** GUARDM parte 2 — `mensaje.presupuestoResuelto`. Ausente = sigue en `'editando'`. */
  resuelto?: ChatMessage['presupuestoResuelto'];
  /** Persiste la resolución en el mensaje (atada a `mensaje.id` por `ListaMensajes.tsx`). Opcional:
   * los tests que no verifican persistencia lo omiten sin romper nada. */
  onResolver?: (patch: NonNullable<ChatMessage['presupuestoResuelto']>) => void;
  testID?: string;
}

export function TarjetaPresupuestoPropuesto({
  propuesta,
  mensajeId,
  resuelto,
  onResolver,
  testID = 'presupuesto-propuesto',
}: TarjetaPresupuestoPropuestoProps) {
  // Patrón B: `resuelto` ya está disponible SINCRÓNICAMENTE (vive en el mensaje, no en un storage
  // async) — sin `useEffect` de lectura ni estado `leido` que gatee el primer render.
  const [estado, setEstado] = useState<Estado>(resuelto?.estado ?? 'editando');
  const [numero, setNumero] = useState<number | null>(resuelto?.estado === 'guardado' ? resuelto.numero : null);

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
        mensajeId={mensajeId}
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
          onResolver?.({ estado: 'guardado', numero: p.numero });
        }}
        onCancelar={() => {
          setEstado('descartado');
          onResolver?.({ estado: 'descartado' });
        }}
        testID={`${testID}-formulario`}
      />
    </TarjetaPropuestaShell>
  );
}
