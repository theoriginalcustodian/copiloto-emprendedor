import { useEffect, useRef, useState } from 'react';

import type { PresupuestoPropuesto } from '@copiloto/core';

import { almacenClave } from '../../adapters/almacen';
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

type Resolucion = { estado: 'guardado'; numero: number | null } | { estado: 'descartado' };

/**
 * 🔴 **Guard cross-remount (K-01 / BL-D1) — antes esta card era `useState` puro.** Un remount del mensaje
 * (scroll de la lista, recarga del hilo, reabrir la app) devolvía una card YA guardada a `'editando'`, y
 * tocar Guardar ahí creaba un presupuesto duplicado. Ahora `{estado, numero}` se persiste por `mensajeId`
 * (`assistant-<reply.id>`, estable entre recargas) en AsyncStorage, con la MISMA clave y forma que la web
 * (`copiloto-presupuesto-propuesto-resuelto:<id>`, `TarjetaPresupuestoPropuesto.tsx` de la PWA).
 *
 * Es marca LOCAL: tapa el remount, no el doble toque ni el reintento de red — eso lo cubre la `idem_key` de
 * `FormularioPresupuesto`. No cruza dispositivos (limitación aceptada por el contrato).
 *
 * Best-effort: si el almacén falla, la card vuelve a verse editable (comportamiento de antes), nunca rompe.
 */
const RESOLUCION_STORAGE_PREFIX = 'copiloto-presupuesto-propuesto-resuelto';

const claveResolucion = (mensajeId: string) => `${RESOLUCION_STORAGE_PREFIX}:${mensajeId}`;

function parsearResolucion(raw: string | null): Resolucion | null {
  if (raw == null) return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (typeof p !== 'object' || p === null || !('estado' in p)) return null;
    const r = p as Record<string, unknown>;
    if (r.estado === 'guardado') return { estado: 'guardado', numero: typeof r.numero === 'number' ? r.numero : null };
    if (r.estado === 'descartado') return { estado: 'descartado' };
  } catch {
    // JSON corrupto: se ignora, la card vuelve a verse editable.
  }
  return null;
}

export interface TarjetaPresupuestoPropuestoProps {
  propuesta: PresupuestoPropuesto;
  /** El `id` del `ChatMessage` que trae esta card — clave del guard cross-remount de arriba. */
  mensajeId: string;
  testID?: string;
}

export function TarjetaPresupuestoPropuesto({
  propuesta,
  mensajeId,
  testID = 'presupuesto-propuesto',
}: TarjetaPresupuestoPropuestoProps) {
  const [estado, setEstado] = useState<Estado>('editando');
  const [numero, setNumero] = useState<number | null>(null);
  // La lectura es async: hasta que vuelve NO se muestra el formulario (un toque a Guardar antes de saber
  // si ya estaba guardado sería justo el duplicado que este guard evita).
  const [leido, setLeido] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    void almacenClave.leer(claveResolucion(mensajeId)).then((raw) => {
      if (!vivo.current) return;
      const previa = parsearResolucion(raw);
      if (previa?.estado === 'guardado') {
        setNumero(previa.numero);
        setEstado('guardado');
      } else if (previa?.estado === 'descartado') {
        setEstado('descartado');
      }
      setLeido(true);
    });
    return () => {
      vivo.current = false;
    };
  }, [mensajeId]);

  function resolver(resolucion: Resolucion) {
    void almacenClave.guardar(claveResolucion(mensajeId), JSON.stringify(resolucion));
  }

  if (!leido) return null;

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
          resolver({ estado: 'guardado', numero: p.numero });
        }}
        onCancelar={() => {
          setEstado('descartado');
          resolver({ estado: 'descartado' });
        }}
        testID={`${testID}-formulario`}
      />
    </TarjetaPropuestaShell>
  );
}
