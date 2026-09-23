import { useState } from 'react';

import { formatearImporte, type ChatMessage, type GastoPropuesto } from '@copiloto/core';

import { FormularioGasto } from '../gastos/FormularioGasto';
import { TarjetaPropuestaShell, TarjetaPropuestaTerminal } from './TarjetaPropuestaShell';

/**
 * `TarjetaGastoPropuesto` — lo que el copiloto entendió de un gasto dictado, **editable antes de
 * guardar**.
 *
 * 🔴 **Es un formulario completo, no un "¿confirmás? sí/no"**, y es el corazón de §5 del contrato.
 * Un sí/no re-ejecuta los mismos argumentos: si Whisper transcribió *«cincuenta mil»* donde el
 * emprendedor dijo *«quince mil»*, sólo se puede **aceptar el error** o **repetir el dictado entero**.
 * Repetir un dictado es más tedioso que haber tipeado, y ahí es donde se abandona la función.
 *
 * 🔴 **Reusa `FormularioGasto` tal cual**, con los valores pre-cargados. No es ahorro de código: dos
 * componentes distintos divergirían, el de voz se quedaría sin algún campo que el manual sí tiene, y
 * el emprendedor no podría corregir justo ese.
 *
 * 🔴 **Nada se guardó todavía cuando esto aparece.** El texto lo dice explícito porque el modelo, sin
 * instrucción, cierra con *«listo, ya lo anoté»* — el emprendedor lo lee, no toca Guardar, y el gasto
 * se pierde creyendo los dos que estaba hecho. El backend ya se lo prohíbe al LLM; este cartel es la
 * segunda mitad, del lado que el usuario mira.
 *
 * 🔴 **Guard cross-remount (GUARDM parte 2) — antes esta card era `useState` puro, sin persistencia.**
 * Un remount del mensaje (scroll de la lista, recarga del hilo, reabrir la app) devolvía una card YA
 * resuelta a `'editando'`, y tocar Guardar ahí creaba un gasto duplicado. `resuelto` (derivado de
 * `mensaje.gastoResuelto` por `ListaMensajes.tsx`) siembra el estado inicial sincrónicamente — sin
 * `useEffect` async, a diferencia del guard viejo de Presupuesto (patrón A, `AsyncStorage`): el valor
 * ya está disponible en la prop, porque vive DENTRO del mensaje persistido (patrón B, mismo mecanismo
 * que `hitlRespondido`/`conexionDescartada`). `onResolver` persiste la transición vía
 * `useChat().marcarCardResuelta`.
 */

type Estado = 'editando' | 'guardado' | 'descartado';

export interface TarjetaGastoPropuestoProps {
  propuesta: GastoPropuesto;
  /** GUARDM parte 2 — `mensaje.gastoResuelto`. Ausente = sigue en `'editando'`. */
  resuelto?: ChatMessage['gastoResuelto'];
  /** Persiste la resolución en el mensaje (atada a `mensaje.id` por `ListaMensajes.tsx`). Opcional:
   * los tests que no verifican persistencia lo omiten sin romper nada. */
  onResolver?: (patch: NonNullable<ChatMessage['gastoResuelto']>) => void;
  testID?: string;
}

export function TarjetaGastoPropuesto({
  propuesta,
  resuelto,
  onResolver,
  testID = 'gasto-propuesto',
}: TarjetaGastoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>(resuelto?.estado ?? 'editando');
  const [guardado, setGuardado] = useState<string | null>(resuelto?.estado === 'guardado' ? resuelto.monto : null);

  if (estado === 'guardado') {
    return (
      <TarjetaPropuestaTerminal
        testID={`${testID}-guardado`}
        tono="exito"
        texto={`Gasto anotado${guardado != null ? `: ${formatearImporte(guardado)}` : ''}`}
      />
    );
  }

  if (estado === 'descartado') {
    return <TarjetaPropuestaTerminal testID={`${testID}-descartado`} tono="tenue" texto="No lo anotamos." />;
  }

  return (
    <TarjetaPropuestaShell
      testID={testID}
      aviso="Esto entendí. Revisalo y tocá Guardar — todavía no lo anoté."
      // Lo que dictó, textual: es contra ESTO que contrasta lo que la card entendió. Sin la cita, para
      // verificar el monto habría que acordarse de lo que uno mismo dijo.
      cita={propuesta.descripcion}
    >
      <FormularioGasto
        origen={propuesta.origen}
        iniciales={{
          monto: propuesta.monto,
          categoria: propuesta.categoria,
          // Se mandan sólo si vinieron: `?? undefined` y no `?? ''`, para que el formulario omita la
          // clave en el body en vez de guardar un string vacío.
          proveedor: propuesta.proveedor ?? undefined,
          medioPago: propuesta.medioPago ?? undefined,
          descripcion: propuesta.descripcion ?? undefined,
          // Sólo viene en `origen: 'foto'` — ver el docstring de `GastoPropuesto.montoSugerido`.
          montoSugerido: propuesta.montoSugerido ?? undefined,
          // 🔴 La fecha SÍ viaja acá, al revés que en el alta manual: el motor ya resolvió lo que se
          // dictó («ayer», «el lunes»). Omitirla haría que el backend ponga hoy y un gasto dictado
          // como "lo de ayer" quede con la fecha equivocada — y los días 30 y 31, en otro MES.
          fecha: propuesta.fecha !== '' ? propuesta.fecha : undefined,
        }}
        onCreado={(g) => {
          setGuardado(g.monto);
          setEstado('guardado');
          onResolver?.({ estado: 'guardado', monto: g.monto });
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
