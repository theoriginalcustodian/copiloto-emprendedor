import { useEffect, useState } from 'react';

import {
  ApiError,
  LIMITE_CAMPO_CORTO,
  guardarPerfilNegocio,
  leerEjemploDeTono,
  leerPerfilNegocio,
  type FormalidadCopiloto,
  type LargoRespuesta,
} from '@copiloto/core';

import { Button, Skeleton } from '../../../design-system';

export const OPCIONES_FORMALIDAD: ReadonlyArray<{ valor: FormalidadCopiloto; etiqueta: string }> = [
  { valor: 'formal', etiqueta: 'Formal' },
  { valor: 'cercano', etiqueta: 'Cercano' },
];

export const OPCIONES_LARGO: ReadonlyArray<{ valor: LargoRespuesta; etiqueta: string }> = [
  { valor: 'breve', etiqueta: 'Breve' },
  { valor: 'detallado', etiqueta: 'Detallado' },
];

type EstadoCarga = 'cargando' | 'ok' | 'error' | 'no_disponible';

/**
 * «Cómo hablarle» (K-15 / BL-X7, DEC-6) — la pantalla ÚNICA del tono del copiloto: Formalidad, Largo
 * y Nombre, con un ejemplo de respuesta que se re-consulta cada vez que cambia Formalidad o Largo,
 * ANTES de guardar (el ejemplo se ve mientras se elige, no sólo después).
 *
 * El ejemplo lo deriva el BACKEND de la misma tabla que arma el prompt real (`leerEjemploDeTono`):
 * acá no hay copia del copy. Sin ejemplo (endpoint no desplegado o caído) se OMITE, no se inventa.
 * Guardar sigue siendo `guardarPerfilNegocio` parcial — sólo viajan las tres claves de tono.
 */
export function PantallaTono({ onGuardado }: { onGuardado?: () => void } = {}) {
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [formalidad, setFormalidad] = useState<FormalidadCopiloto>('cercano');
  const [largo, setLargo] = useState<LargoRespuesta>('breve');
  const [nombre, setNombre] = useState('');
  const [ejemplo, setEjemplo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await leerPerfilNegocio();
        if (!vivo) return;
        if (res.status === 'no_disponible') return setEstadoCarga('no_disponible');
        if (res.perfil) {
          setFormalidad(res.perfil.formalidad);
          setLargo(res.perfil.largoRespuesta);
          setNombre(res.perfil.nombreCopiloto);
        }
        setEstadoCarga('ok');
      } catch {
        if (vivo) setEstadoCarga('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // El ejemplo sigue a la selección. `vivo` descarta la respuesta de una combinación que ya no es la
  // vigente (cambiar rápido no puede dejar el ejemplo de la selección anterior).
  useEffect(() => {
    if (estadoCarga !== 'ok') return;
    let vivo = true;
    void leerEjemploDeTono(formalidad, largo).then((e) => {
      if (vivo) setEjemplo(e);
    });
    return () => {
      vivo = false;
    };
  }, [estadoCarga, formalidad, largo]);

  async function guardar() {
    setEnviando(true);
    setGuardado(false);
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio({ formalidad, largoRespuesta: largo, nombreCopiloto: nombre });
      if (res.status === 'no_disponible') return setEstadoCarga('no_disponible');
      if (res.status === 'modo_no_disponible') return setErrorGuardado(res.mensaje);
      setGuardado(true);
      onGuardado?.();
    } catch (e) {
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar los cambios. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="perfil-negocio-screen" data-testid="pantalla-tono">
      <h1 className="perfil-negocio-screen__title">Cómo hablarle</h1>

      {estadoCarga === 'cargando' && (
        <div className="perfil-negocio-screen__loading" data-testid="tono-cargando">
          <Skeleton height={48} radius={12} />
          <Skeleton height={48} radius={12} />
        </div>
      )}
      {estadoCarga === 'error' && (
        <p className="perfil-negocio-screen__error" data-testid="tono-error">No pudimos cargar tu perfil. Probá de nuevo.</p>
      )}
      {estadoCarga === 'no_disponible' && (
        <p className="perfil-negocio-screen__empty" data-testid="tono-no-disponible">Esta sección todavía no está disponible.</p>
      )}

      {estadoCarga === 'ok' && (
        <section className="perfil-negocio-seccion" data-testid="tono-seccion">
          <label className="perfil-negocio-seccion__campo">
            <span className="perfil-negocio-seccion__etiqueta">Tono</span>
            <select
              data-testid="tono-formalidad"
              value={formalidad}
              onChange={(e) => {
                setFormalidad(e.target.value as FormalidadCopiloto);
                setGuardado(false);
              }}
            >
              {OPCIONES_FORMALIDAD.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
          </label>
          <label className="perfil-negocio-seccion__campo">
            <span className="perfil-negocio-seccion__etiqueta">Largo de las respuestas</span>
            <select
              data-testid="tono-largo"
              value={largo}
              onChange={(e) => {
                setLargo(e.target.value as LargoRespuesta);
                setGuardado(false);
              }}
            >
              {OPCIONES_LARGO.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
          </label>

          {ejemplo != null && (
            <blockquote className="perfil-negocio-seccion__ejemplo" data-testid="tono-ejemplo" aria-live="polite">
              <span className="perfil-negocio-seccion__etiqueta">Así te respondería</span>
              {ejemplo}
            </blockquote>
          )}

          <label className="perfil-negocio-seccion__campo">
            <span className="perfil-negocio-seccion__etiqueta">¿Cómo querés llamarlo?</span>
            <input
              data-testid="tono-nombre"
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setGuardado(false);
              }}
              placeholder="ej.: Copi"
              maxLength={LIMITE_CAMPO_CORTO}
            />
          </label>

          <div className="perfil-negocio-screen__acciones">
            <Button onClick={() => void guardar()} disabled={enviando} data-testid="tono-guardar">
              {enviando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
          {guardado && <p className="perfil-negocio-screen__guardado" data-testid="tono-guardado">Listo, lo guardamos.</p>}
          {errorGuardado != null && (
            <p className="perfil-negocio-screen__error-guardado" data-testid="tono-error-guardado">{errorGuardado}</p>
          )}
        </section>
      )}
    </div>
  );
}
