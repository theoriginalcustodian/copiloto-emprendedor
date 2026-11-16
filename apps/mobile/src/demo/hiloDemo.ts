import type { ChatMessage } from '@copiloto/core';

import { sembrarHiloLocal } from '../modules/chat/useChat';
import { respuestaDemo } from './respuestasDemo';

/**
 * ⚠️ MODO DEMO — sólo en desarrollo. Ver `modoDemo.ts`.
 *
 * El hilo de ejemplo: dos días de trabajo de un electricista con todas las tarjetas que el chat sabe mostrar —
 * gasto anotado, link de cobro de Mercado Pago, presupuesto con su documento, mail enviado, evento en Calendar,
 * cobro anotado— y, al final, una propuesta todavía abierta para ver el resumen editable.
 */

/** El presupuesto del hilo: tiene que existir en `respuestasDemo` (la tarjeta lo vuelve a leer por su id). */
const PRESUPUESTO = { id: 27, numero: 20 };

const SESION_DEMO = 'demo-hilo';
const DIA_MS = 24 * 60 * 60 * 1000;

function fechaIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function hiloDemo(ahora: number): ChatMessage[] {
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const ayer = hoy.getTime() - DIA_MS;
  // A qué hora del día cae cada mensaje; los de hoy nunca quedan en el futuro.
  const a = (base: number, hora: number, minuto: number) => Math.min(base + (hora * 60 + minuto) * 60_000, ahora - 60_000);
  let n = 0;
  const yo = (creadoEn: number, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id: `demo-${++n}`,
    role: 'user',
    text,
    creadoEn,
    ...extra,
  });
  const odobi = (creadoEn: number, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id: `demo-${++n}`,
    role: 'assistant',
    text,
    creadoEn,
    ...extra,
  });

  return [
    yo(a(ayer, 9, 12), 'Gasté 39.000 en mechas y discos en la Ferretería Industrial', { porVoz: { duracionSeg: 6 } }),
    odobi(a(ayer, 9, 12), 'Te lo dejo para revisar.', {
      card: {
        kind: 'gasto_propuesto',
        data: {
          monto: '39000',
          fecha: fechaIso(ayer),
          categoria: 'herramientas',
          proveedor: 'Ferretería Industrial Rosario',
          medio_pago: 'Débito',
          descripcion: 'Mechas y discos',
          origen: 'voz',
        },
      },
      gastoResuelto: { estado: 'guardado', monto: '39000' },
    }),

    yo(a(ayer, 11, 40), 'Cobrale 180.000 a Laura Benítez por la instalación del aire'),
    odobi(a(ayer, 11, 41), 'Listo. Este es el link de cobro para Laura; cuando pague te aviso y lo anoto solo.', {
      card: {
        kind: 'payment_link',
        data: { url: 'https://mpago.la/ejemplo-2Kd9xQ', amount: 180000, concept: 'Instalación de aire acondicionado' },
      },
    }),

    yo(a(ayer, 16, 5), 'Armame un presupuesto para Tomás Ledesma: instalación de aire acondicionado, 180.000', {
      porVoz: { duracionSeg: 8 },
    }),
    odobi(a(ayer, 16, 5), 'Armé el presupuesto. Revisalo antes de guardarlo.', {
      card: {
        kind: 'presupuesto_propuesto',
        data: {
          concepto: 'Instalación de aire acondicionado',
          receptor: { nombre: 'Tomás Ledesma', doc_tipo: 96, doc_nro: '35111555', contacto: 'tomas.ledesma@ejemplo.com' },
          items: [{ descripcion: 'Instalación de aire acondicionado', cantidad: '1', precio_unitario: '180000' }],
        },
      },
      presupuestoResuelto: { estado: 'guardado', numero: PRESUPUESTO.numero, id: PRESUPUESTO.id },
    }),
    yo(a(ayer, 16, 9), 'Mandáselo por mail a Tomás'),
    odobi(a(ayer, 16, 10), 'Enviado.', {
      card: {
        kind: 'recibo',
        service: 'gmail',
        recibo: { titulo: 'Mail enviado a Tomás Ledesma', meta: 'Con el presupuesto adjunto · desde tu Gmail' },
      },
    }),

    yo(a(hoy.getTime(), 8, 20), 'Agendame la visita a Panadería La Espiga mañana a las 9'),
    odobi(a(hoy.getTime(), 8, 20), 'Agendado para mañana a las 9.', {
      card: {
        kind: 'calendar_event',
        data: { url: 'https://calendar.google.com/calendar/event?eid=ejemplo', fields: { title: 'Visita · Panadería La Espiga' } },
      },
    }),

    yo(a(hoy.getTime(), 10, 35), 'Me pagó Silvina Ortiz 25.000 en efectivo por el cambio de tomas', { porVoz: { duracionSeg: 5 } }),
    odobi(a(hoy.getTime(), 10, 35), 'Te lo dejo para revisar.', {
      card: {
        kind: 'ingreso_propuesto',
        data: {
          monto: '25000',
          medio: 'Efectivo',
          cliente_nombre: 'Silvina Ortiz',
          concepto: 'Cambio de tomas',
          fecha: fechaIso(hoy.getTime()),
        },
      },
      ingresoResuelto: { estado: 'guardado', monto: '25000' },
    }),

    yo(a(hoy.getTime(), 12, 2), '¿Cómo vengo este mes?'),
    odobi(
      a(hoy.getTime(), 12, 2),
      'Venís bien: entró más que el mes pasado a esta altura y te quedan tres facturas por cobrar. La más vieja es la de Panadería La Espiga, de hace más de un mes; si querés, le mando un recordatorio.',
    ),

    yo(a(hoy.getTime(), 13, 15), 'Cargué nafta, 42.000', { porVoz: { duracionSeg: 3 } }),
    // La última queda ABIERTA: es donde se ve el resumen editable. En modo demo «Guardar» no guarda.
    odobi(a(hoy.getTime(), 13, 15), 'Te lo dejo para revisar.', {
      card: {
        kind: 'gasto_propuesto',
        data: { monto: '42000', fecha: fechaIso(hoy.getTime()), categoria: 'transporte', descripcion: 'Nafta', origen: 'voz' },
      },
    }),
  ];
}

/** Deja el hilo de ejemplo guardado para el usuario de muestra (el `cliente_id` que devuelve `/me` en demo). */
export async function sembrarHiloDemo(): Promise<void> {
  const me = respuestaDemo({ metodo: 'GET', path: '/me', headers: {} });
  const clienteId = typeof me === 'object' && me !== null ? (me as { cliente_id?: unknown }).cliente_id : undefined;
  if (typeof clienteId !== 'string' || clienteId === '') return;
  await sembrarHiloLocal(clienteId, SESION_DEMO, hiloDemo(Date.now()));
}
