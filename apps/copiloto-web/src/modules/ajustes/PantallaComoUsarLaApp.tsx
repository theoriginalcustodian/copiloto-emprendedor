import { useCallback, useEffect, useRef, useState } from 'react';

import { agruparCapacidadesPorRotulo, dejarPendiente, leerCapacidades, TEMAS_AYUDA, type GuiaCapacidades } from '@copiloto/core';

import { Skeleton } from '../../design-system';
import './ajustes.css';

type Estado = 'cargando' | 'ok' | 'no_disponible';

/**
 * `PantallaComoUsarLaApp` — **la ayuda, en un solo lugar** (Ola 5, BL-W12). Port 1:1 del puente
 * mobile (`apps/mobile/src/modules/ajustes/PantallaComoUsarLaApp.tsx`) — mismo docstring, mismo
 * porqué, sólo cambia el idioma de la UI (DOM en vez de glass).
 *
 * 🔴 **Es la fusión de dos pantallas, no una tercera.** Había `PantallaComoHablarle` (la guía de
 * `/capacidades`, ahora borrada) y los cinco temas de la versión BL-W9 de este mismo archivo, que
 * sólo abrían el chat. O sea: la guía por un lado, preguntar por otro, y el emprendedor teniendo que
 * adivinar cuál de las dos servía para su duda. Acá son una.
 *
 * 🔴 **Los temas abren el CHAT PRINCIPAL, no un chat propio** (decisión C, ver el puente mobile). Dos
 * hilos que saben cosas distintas del mismo negocio obligan a recordar en cuál preguntaste. Tocar un
 * tema deja la pregunta en el buzón (`dejarPendiente`, de core) y navega al chat.
 *
 * 🔴 **Los ejemplos siguen viniendo de `GET /capacidades`, no escritos acá** — la propiedad que hacía
 * valiosa a `PantallaComoHablarle` y no se pierde en la fusión: el endpoint publica una capacidad
 * SÓLO si su tool está viva, así que el DoD *«los ejemplos coinciden con lo que existe»* es cierto
 * por construcción.
 *
 * 🔴 **La guía agrupa por RÓTULO, no por `tool`** (`agruparCapacidadesPorRotulo`, de core, BL-W12) —
 * el catálogo publica dos `tool` distintas bajo «Presupuestos»; sin agrupar, el encabezado se repetía
 * y cada bloque mostraba sólo la mitad de los ejemplos.
 *
 * ⚠️ **Y por eso, si la guía no está disponible, se dice — pero los TEMAS siguen ahí.** Son dos
 * fuentes independientes: los temas son del producto, los ejemplos son del contrato. Que se caiga
 * una no puede llevarse la otra.
 */
export interface PantallaComoUsarLaAppProps {
  /** Lleva al chat principal. Lo inyecta el shell (`onNavegarTab?.('chat')` / `changeTab('chat')`). */
  onAbrirChat: () => void;
}

export function PantallaComoUsarLaApp({ onAbrirChat }: PantallaComoUsarLaAppProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [guia, setGuia] = useState<GuiaCapacidades | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await leerCapacidades();
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setGuia(res.guia);
      setEstado('ok');
      return;
    }
    setEstado('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  function preguntar(pregunta: string) {
    dejarPendiente(pregunta);
    onAbrirChat();
  }

  // `capacidades` vacío NO es lo mismo que `no_disponible`: el endpoint contestó y dice que hoy no
  // hay ninguna tool viva. Ver el mismo criterio en `capacidades.ts`.
  const sinCapacidades = estado === 'ok' && (guia?.capacidades.length ?? 0) === 0;
  const grupos = guia != null ? agruparCapacidadesPorRotulo(guia.capacidades) : [];

  return (
    <div className="como-hablarle-screen" data-testid="pantalla-como-usar">
      <h1 className="como-hablarle-screen__title">Cómo usar la app</h1>
      <p className="como-hablarle-screen__intro">Lo que más se pregunta, contestado en dos minutos.</p>

      <span className="como-usar-screen__seccion">EMPEZÁ POR ACÁ</span>
      <div className="como-hablarle-screen__lista">
        {TEMAS_AYUDA.map((tema, i) => (
          <button
            key={tema.titulo}
            type="button"
            className="como-usar-tema"
            data-testid={`como-usar-tema-${i}`}
            onClick={() => preguntar(tema.pregunta)}
          >
            <span className="como-usar-tema__titulo">{tema.titulo}</span>
            <span className="como-usar-tema__detalle">{tema.detalle}</span>
          </button>
        ))}
      </div>

      <p className="como-hablarle-screen__intro" data-testid="como-usar-pie">
        Cada tema te lo explico en el chat, con tus propios datos. Si no está lo que buscás,
        preguntame ahí mismo.
      </p>

      <span className="como-usar-screen__seccion">LO QUE LE PODÉS PEDIR</span>

      {estado === 'cargando' && (
        <div className="como-hablarle-screen__loading" data-testid="como-usar-cargando">
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
          <Skeleton height={56} radius={12} />
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="como-hablarle-screen__no-disponible" data-testid="como-usar-no-disponible">
          No pudimos traer la guía ahora. Igual podés escribirle a tu copiloto como le hablarías a
          alguien que te ayuda.
        </p>
      )}

      {estado === 'ok' && guia != null && (
        <div className="como-hablarle-screen__lista" data-testid="como-hablarle-lista">
          <p className="como-hablarle-screen__intro">
            Hablale como le hablarías a alguien que te ayuda. Estos son ejemplos, no fórmulas: si te
            falta un dato, te lo pide; si entendió mal, lo corregís en la tarjeta.
          </p>

          {sinCapacidades && (
            <p className="como-hablarle-screen__vacio" data-testid="como-usar-vacio">
              Tu copiloto todavía no tiene funciones habilitadas.
            </p>
          )}

          {grupos.map((grupo, i) => (
            <div key={grupo.rotulo} className="como-hablarle-bloque" data-testid={`como-usar-grupo-${i}`}>
              <span className="como-hablarle-bloque__rotulo">{grupo.rotulo}</span>
              {grupo.ejemplos.map((e) => (
                <p key={e} className="como-hablarle-bloque__ejemplo">
                  «{e}»
                </p>
              ))}
            </div>
          ))}

          {guia.fechas.entiendo.length > 0 && (
            <div className="como-hablarle-bloque" data-testid="como-usar-fechas">
              <span className="como-hablarle-bloque__rotulo">Fechas</span>
              <p className="como-hablarle-bloque__ejemplo">
                {guia.fechas.entiendo.map((f) => `«${f}»`).join(' · ')}
              </p>
              {guia.fechas.siNoEsta != null && (
                <p className="como-hablarle-bloque__aviso" data-testid="como-usar-fechas-si-no-esta">
                  {guia.fechas.siNoEsta}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
