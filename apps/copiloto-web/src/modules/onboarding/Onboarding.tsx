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

import { Button, Surface } from '../../design-system';
import './onboarding.css';

/** Cómo se llama cada permiso ante el usuario: dos permisos, no seis servicios (el alcance se dice ANTES). */
const FILAS: Record<PermisoDelHilo['id'], { titulo: string; detalle: string; boton: string }> = {
  mercadopago: { titulo: 'Cobrar', detalle: 'Mercado Pago', boton: 'Conectar Mercado Pago' },
  google: { titulo: 'Mail, agenda y archivos', detalle: 'Google', boton: 'Conectar Google' },
};

type Paso = 'promesa' | 'recibo';

/**
 * Onboarding de dos permisos y primer insight (K-14 / BL-X8). Dos actos del guión del mockup
 * `01-onboarding`: la promesa («¿Conectamos tus servicios?») y la promesa cumplida (el recibo con la
 * plata real). El reveal del splash NO es de acá (BL-X10).
 *
 * «Después» es una salida legítima del mismo tamaño que el resto: cierra el hilo y marca el
 * onboarding como hecho — lo que falte se pide cuando haga falta, sin bloquear. Los permisos ya
 * conectados se detectan por el catálogo y no se vuelven a pedir; si ya están los dos, el hilo
 * arranca en el recibo.
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
    <main className="onboarding" data-testid="onboarding">
      <h1 className="onboarding__titulo">¿Conectamos tus servicios?</h1>
      <p className="onboarding__texto">Son dos minutos y te digo algo que no sabés.</p>
      <Surface variant="tile" className="onboarding__permisos" data-testid="onboarding-permisos">
        {(permisos ?? []).map((p) => (
          <div key={p.id} className="onboarding__fila" data-testid={`onboarding-permiso-${p.id}`}>
            <div>
              <p className="onboarding__fila-titulo">{FILAS[p.id].titulo}</p>
              <p className="onboarding__fila-detalle">{FILAS[p.id].detalle}</p>
            </div>
            {p.conectado ? (
              <span className="onboarding__ok" data-testid={`onboarding-conectado-${p.id}`}>Conectado ✓</span>
            ) : (
              p.servicio != null && (
                <Button
                  onClick={() => void conectar(p)}
                  disabled={pidiendo != null}
                  data-testid={`onboarding-conectar-${p.id}`}
                >
                  {pidiendo === p.id ? 'Abriendo…' : FILAS[p.id].boton}
                </Button>
              )
            )}
          </div>
        ))}
      </Surface>
      <p className="onboarding__alcance" data-testid="onboarding-alcance">
        Solo leo lo que hace falta para ver tu negocio. Cada permiso se corta cuando quieras, desde Cuenta.
      </p>
      {error != null && (
        <p role="alert" className="onboarding__error" data-testid="onboarding-error">
          {error}
        </p>
      )}
      <Button variant="ghost" onClick={() => void terminar()} data-testid="onboarding-despues">
        Después
      </Button>
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

  return (
    <main className="onboarding" data-testid="onboarding-recibo">
      <h1 className="onboarding__titulo">Listo, ya veo tu negocio.</h1>
      <p className="onboarding__texto" data-testid="onboarding-insight" aria-live="polite">
        {insight === 'cargando' ? 'Mirando tus números…' : textoDelInsight(insight)}
      </p>
      <Button onClick={onEntrar} disabled={insight === 'cargando'} data-testid="onboarding-entrar">
        Entrar
      </Button>
    </main>
  );
}
