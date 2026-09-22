import {
  completarOnboarding,
  leerPortada,
  listarCatalogo,
  pedirLinkDeVinculacion,
  permisosCompletos,
  permisosDelHilo,
  primerInsight,
  textoDelInsight,
  type PermisoDelHilo,
  type PrimerInsight,
} from '@copiloto/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge, Button, Chip, MonoLabel, Surface } from '../../design-system';
import { Bubble } from '../chat/Bubble';
import '../chat/chat.css';
import './onboarding.css';

/** Cómo se llama cada permiso ante el usuario: dos permisos, no seis servicios (el alcance se dice ANTES). */
const FILAS: Record<PermisoDelHilo['id'], { titulo: string; detalle: string; boton: string }> = {
  mercadopago: { titulo: 'Cobrar', detalle: 'Mercado Pago', boton: 'Conectar Mercado Pago' },
  google: { titulo: 'Mail, agenda y archivos', detalle: 'Google', boton: 'Conectar Google' },
};

type Paso = 'promesa' | 'recibo';

/**
 * Onboarding de dos permisos y primer insight (K-14 / BL-X8 resto, contrato `2026-09-22_contrato_
 * planificacion-a-frontend1_BL-Q3-web-arreglos-D4-X10-X8.md` fila 3). «El onboarding es una
 * conversación, no un tour» (`mockups/01-onboarding/DECISIONES.md`): se dibuja con las MISMAS
 * burbujas (`Bubble`) y la MISMA tarjeta HITL (clases `hitl-card` de `chat.css`) que el hilo real,
 * no un formulario aparte — el guión es literal del prototipo (`prototipo/index.html` → `HILOS['onb-
 * promesa'/'onb-cumplida']`). Se monta ANTES de `ResponsiveShell` (ver `App.tsx`), así que no hay
 * tabbar mientras dura, sin depender de que el shell lo sepa.
 *
 * «Después» es una acción del mismo peso visual que «Conectar» (variant="cancel", no un link
 * fantasma): cierra el hilo y marca el onboarding como hecho — lo que falte se pide cuando haga
 * falta, sin bloquear. Los permisos ya conectados se detectan por el catálogo y no se vuelven a
 * pedir; si ya están los dos, el hilo arranca en el recibo.
 *
 * El OAuth sale de la SPA (`location.assign`): al volver el hilo se remonta, relee el catálogo y
 * refleja lo que el backend confirma — nunca se pinta «Conectado» por haber iniciado la acción.
 */
export function Onboarding({ onTerminar }: { onTerminar: () => void }) {
  const [paso, setPaso] = useState<Paso>('promesa');
  const [permisos, setPermisos] = useState<readonly PermisoDelHilo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<PermisoDelHilo['id'] | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  const cargarCatalogo = useCallback(async () => {
    try {
      const res = await listarCatalogo();
      if (!vivo.current) return;
      if (res.status === 'no_disponible') return;
      const p = permisosDelHilo(res.servicios);
      setPermisos(p);
      // Ya están los dos (de otra prueba, o recién autorizados): no se pide nada más.
      if (permisosCompletos(p)) setPaso('recibo');
    } catch {
      /* fail-soft: sin catálogo la promesa igual se ve y «Después» sigue disponible */
    }
  }, []);

  useEffect(() => {
    void cargarCatalogo();
    // Volver del OAuth en otra pestaña: se relee, no se supone.
    const alVolver = () => {
      if (document.visibilityState === 'visible') void cargarCatalogo();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [cargarCatalogo]);

  async function terminar() {
    await completarOnboarding(); // false = no se pudo marcar: se cierra igual y se reintenta al próximo arranque
    if (vivo.current) onTerminar();
  }

  async function conectar(permiso: PermisoDelHilo) {
    if (permiso.servicio == null) return;
    setError(null);
    setPidiendo(permiso.id);
    try {
      const res = await pedirLinkDeVinculacion(permiso.servicio.connectPath);
      if (!vivo.current) return;
      if (res.status === 'no_disponible') {
        setError(`Conectar ${FILAS[permiso.id].detalle} todavía no está disponible.`);
        return;
      }
      window.location.assign(res.url);
    } catch {
      if (vivo.current) setError(`No pudimos pedir el link de ${FILAS[permiso.id].detalle}. Probá de nuevo.`);
    } finally {
      if (vivo.current) setPidiendo(null);
    }
  }

  if (paso === 'recibo') return <Recibo onEntrar={() => void terminar()} />;

  return (
    <main className="onboarding-hilo" data-testid="onboarding">
      <Bubble role="assistant" text="Laburo así: vos me hablás, yo resuelvo. Pero primero necesito ver tu negocio." />
      <Bubble role="assistant" text="¿Conectamos tus servicios? Son dos minutos y te digo algo que no sabés." />
      <div className="chat-row chat-row--assistant" data-testid="onboarding-permisos">
        <Surface
          variant="card"
          blur
          className="hitl-card"
          role="group"
          aria-label="Tus servicios"
          data-testid="onboarding-tarjeta-servicios"
        >
          <div className="hitl-card__header">
            <div className="hitl-card__header-brand">
              <MonoLabel className="hitl-card__header-label">Tus servicios</MonoLabel>
            </div>
            <Badge variant="neutral">2 permisos</Badge>
          </div>
          {(permisos ?? []).map((p) => (
            <div key={p.id} className="hitl-card__field" data-testid={`onboarding-permiso-${p.id}`}>
              <MonoLabel>{FILAS[p.id].titulo}</MonoLabel>
              <p className="hitl-card__name">
                {FILAS[p.id].detalle}
                {p.conectado && (
                  <span className="onboarding__ok" data-testid={`onboarding-conectado-${p.id}`}>
                    {' '}
                    Conectado ✓
                  </span>
                )}
              </p>
              {!p.conectado && p.servicio != null && (
                <Button
                  onClick={() => void conectar(p)}
                  disabled={pidiendo != null}
                  data-testid={`onboarding-conectar-${p.id}`}
                >
                  {pidiendo === p.id ? 'Abriendo…' : FILAS[p.id].boton}
                </Button>
              )}
            </div>
          ))}
          <p className="hitl-card__concept" data-testid="onboarding-alcance">
            Solo leo lo que hace falta para ver tu negocio. Cada permiso se corta cuando quieras, desde Cuenta.
          </p>
          {error != null && (
            <p role="alert" className="hitl-card__concept" data-testid="onboarding-error">
              {error}
            </p>
          )}
          <div className="hitl-card__actions">
            <Button variant="cancel" onClick={() => void terminar()} data-testid="onboarding-despues">
              Después
            </Button>
          </div>
        </Surface>
      </div>
    </main>
  );
}

function Recibo({ onEntrar }: { onEntrar: () => void }) {
  const [insight, setInsight] = useState<PrimerInsight | 'cargando'>('cargando');
  useEffect(() => {
    let vivo = true;
    leerPortada()
      .then((res) => {
        if (vivo) setInsight(res.status === 'no_disponible' ? { tipo: 'sin_dato' } : primerInsight(res.portada));
      })
      .catch(() => {
        if (vivo) setInsight({ tipo: 'sin_dato' });
      });
    return () => {
      vivo = false;
    };
  }, []);

  const listo = insight !== 'cargando';
  const pregunta = listo && insight.tipo === 'dato';

  return (
    <main className="onboarding-hilo" data-testid="onboarding-recibo">
      <div className="chat-row chat-row--assistant" data-testid="onboarding-recibo-servicios">
        <Surface variant="bubble" blur className="propuesta-card--terminal propuesta-card--exito">
          Servicios conectados · Mercado Pago · Google
        </Surface>
      </div>
      <Bubble role="assistant" text="Listo, ya veo tu negocio." />
      <div data-testid="onboarding-insight" aria-live="polite">
        {listo ? <Bubble role="assistant" text={textoDelInsight(insight)} /> : <p className="onboarding-hilo__cargando">Mirando tus números…</p>}
      </div>
      {pregunta && (
        <>
          <Bubble role="assistant" text="¿Querés que te arme el detalle?" />
          <div className="disambiguation-chips" role="group" aria-label="Elegí una opción" data-testid="onboarding-chip-detalle">
            <Chip onClick={onEntrar}>Armame el detalle</Chip>
          </div>
        </>
      )}
      <Button onClick={onEntrar} disabled={!listo} data-testid="onboarding-entrar">
        Entrar
      </Button>
    </main>
  );
}
