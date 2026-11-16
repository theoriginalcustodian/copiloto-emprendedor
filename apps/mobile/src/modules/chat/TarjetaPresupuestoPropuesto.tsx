import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import {
  formatearImporteSinCentavosCero,
  mailtoMandarPresupuesto,
  obtenerPresupuesto,
  type ChatMessage,
  type Presupuesto,
  type PresupuestoPropuesto,
  type SugerenciasPresupuesto,
} from '@copiloto/core';

import { BotonWhatsApp } from '../../theme/BotonWhatsApp';
import { FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';
import { AVISO_CONECTAR_GOOGLE, CLAVE_AVISO_CONECTAR_GOOGLE, useAvisoUnaVez } from '../../util/avisoUnaVez';
import { compartirPresupuesto } from '../presupuestos/compartirPresupuesto';
import { FormularioPresupuesto } from '../presupuestos/FormularioPresupuesto';
import { inicialesDePresupuesto } from '../voz/inicialesDePropuesta';
import { Recibo } from './Recibo';
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
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>(resuelto?.estado ?? 'editando');
  const [numero, setNumero] = useState<number | null>(resuelto?.estado === 'guardado' ? resuelto.numero : null);
  // Sólo de sesión viva: es lo que devolvió el alta, con su estado y su enlace «Doc».
  const [creado, setCreado] = useState<Presupuesto | null>(null);
  // Al rehidratar: el mensaje guarda el `id`, no una copia, y de lo releído salen importe y cliente (SM-N5). Un
  // mensaje anterior a ese campo, o una relectura que falla, deja el recibo con el título y el N°.
  const [releido, setReleido] = useState<Presupuesto | null>(null);
  const idPorReleer = creado == null && resuelto?.estado === 'guardado' ? resuelto.id : undefined;
  // `sugerencias.mandarPorMail` sólo viene con un Doc ya generado (backend `presupuesto_sugerencias.py`).
  const [sugerencias, setSugerencias] = useState<SugerenciasPresupuesto | null>(null);

  useEffect(() => {
    if (idPorReleer == null) return;
    let vivo = true;
    void obtenerPresupuesto(idPorReleer)
      .then((res) => {
        if (vivo && res.status === 'ok') setReleido(res.presupuesto);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [idPorReleer]);

  // Sin documento de Google el recibo ofrece compartir el texto; por qué no hay documento se dice UNA vez.
  const datos = creado ?? releido;
  const avisarGoogle = useAvisoUnaVez(
    CLAVE_AVISO_CONECTAR_GOOGLE,
    estado === 'guardado' && datos != null && datos.docLink == null,
  );

  if (estado === 'guardado') {
    const detalle: string[] = [];
    if (datos != null) {
      detalle.push(
        [formatearImporteSinCentavosCero(datos.total), datos.receptor.nombre]
          .filter((v) => v.trim() !== '')
          .join(' · '),
      );
    }
    if (creado != null) {
      // Sólo recién guardado: al rehidratar el estado no se muestra, porque el recibo es de cuando se anotó y
      // el presupuesto pudo haberse aprobado después.
      const situacion = [
        ...(creado.estado === 'pendiente' ? ['Pendiente'] : []),
        ...(creado.docLink != null ? ['Doc listo para mandar'] : []),
      ];
      if (situacion.length > 0) detalle.push(situacion.join(' · '));
    }
    const docLink = creado?.docLink ?? null;
    const mandarPorMail = sugerencias?.mandarPorMail ?? null;
    return (
      <Recibo
        testID={`${testID}-guardado`}
        tono="exito"
        titulo={`Presupuesto anotado${numero != null ? ` — N° ${numero}` : ''}`}
        detalle={detalle}
        enlace={docLink != null ? { texto: 'Doc', onPress: () => void Linking.openURL(docLink) } : undefined}
      >
        {avisarGoogle && (
          <Text testID={`${testID}-guardado-aviso-google`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            {AVISO_CONECTAR_GOOGLE}
          </Text>
        )}
        {/* Compartir SIEMPRE (Martin 14/11): con documento va su link, sin él el presupuesto como texto — antes,
            sin Google conectado, un presupuesto guardado no tenía cómo salir del teléfono. «Mandalo por mail» es
            el chip del `pres-ciclo` del prototipo y sólo existe con documento: abre el `mailto:` con su link. */}
        {datos != null && (
          <View testID={`${testID}-guardado-botones`} style={{ gap: tema.espacio.sm }}>
            <BotonWhatsApp testID={`${testID}-guardado-compartir`} onPress={() => void compartirPresupuesto(datos)} />
            {creado != null && mandarPorMail != null && (
              <FilaBotones
                testID={`${testID}-guardado-botones-mail`}
                botones={[
                  {
                    etiqueta: 'Mandalo por mail',
                    onPress: () =>
                      void Linking.openURL(
                        mailtoMandarPresupuesto(
                          { numero: creado.numero, contacto: creado.receptor.contacto },
                          mandarPorMail.docLink,
                        ),
                      ).catch(() => undefined),
                    variante: 'secundario',
                    testID: `${testID}-guardado-mandar-por-mail`,
                  },
                ]}
              />
            )}
          </View>
        )}
      </Recibo>
    );
  }

  if (estado === 'descartado') {
    return <TarjetaPropuestaTerminal testID={`${testID}-descartado`} tono="tenue" texto="No lo guardamos." />;
  }

  return (
    <TarjetaPropuestaShell
      testID={testID}
      // Martin 14/11: resumen, igual que la de gasto. Se conserva lo que este aviso tenía de propio: guardar
      // no le manda nada al cliente.
      titulo="Nuevo presupuesto"
      aviso="Todavía no se guardó nada. Al guardar, a tu cliente no le llega nada: se lo mandás vos."
    >
      <FormularioPresupuesto
        mensajeId={mensajeId}
        resumido
        iniciales={inicialesDePresupuesto(propuesta)}
        onCreado={(p, sug) => {
          setNumero(p.numero);
          setCreado(p);
          setSugerencias(sug);
          setEstado('guardado');
          onResolver?.({ estado: 'guardado', numero: p.numero, id: p.id });
        }}
        etiquetaCancelar="Descartar"
        onCancelar={() => {
          setEstado('descartado');
          onResolver?.({ estado: 'descartado' });
        }}
        testID={`${testID}-formulario`}
      />
    </TarjetaPropuestaShell>
  );
}
