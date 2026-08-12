import { type FormEvent, useRef, useState } from 'react';

import {
  completarIngreso,
  formatearImporte,
  normalizarDecimal,
  registrarIngreso,
  type FaltanteIngreso,
  type Ingreso,
  type OrigenIngreso,
} from '@copiloto/core';

import { Button } from '../../design-system';
import { generarId } from '../../util/id';

/** Cómo se le pide cada dato que faltó, en el idioma del emprendedor — mismo texto que
 *  `apps/mobile/src/modules/ingresos/FormularioIngreso.tsx` (`COMO_SE_PIDE`). */
const COMO_SE_PIDE: Record<FaltanteIngreso, string> = {
  cliente: 'de quién',
  medio: 'cómo te pagaron',
  concepto: 'por qué trabajo',
};

/**
 * Valores de arranque de un ingreso DICTADO — mismo criterio que `ValoresInicialesGasto`. `fecha` es
 * silenciosa: viaja al guardar pero no tiene campo propio en este formulario (el motor ya resolvió lo
 * dictado — omitirla haría que el backend ponga "hoy").
 */
export interface ValoresInicialesIngreso {
  monto?: string;
  cliente?: string;
  medio?: string;
  concepto?: string;
  fecha?: string;
}

export interface FormularioIngresoProps {
  iniciales?: ValoresInicialesIngreso;
  origen?: OrigenIngreso;
  onGuardado: (ingreso: Ingreso) => void;
  onCancelar: () => void;
  /**
   * Botón "Así está bien" del aviso post-guardado (`ingreso-listo`) — se pisa APARTE de `onCancelar`
   * porque, a diferencia de éste, se dispara con el ingreso YA guardado (sólo declina completar los
   * datos opcionales). Tratarlo como cancelar es lo que hacía mobile (mismo botón → `onCancelar`) y
   * es un bug real: un caller con estado terminal propio (la card web) mostraba "no se guardó" sobre
   * un ingreso que sí estaba en la base — medido en vivo contra prod, 2026-08-12. Opcional: sin
   * proveerlo cae a `onCancelar`, que es lo que ya hacía `IngresosScreen` (ahí "así está bien" y
   * "cancelar" llevan al mismo lugar — el listado — así que el default preserva su comportamiento).
   */
  onListo?: () => void;
}

/**
 * Port de `apps/mobile/src/modules/ingresos/FormularioIngreso.tsx` — MISMA lógica de negocio:
 * sólo el monto es obligatorio, el duplicado (409) se pregunta ANTES de guardar y corta el guardado,
 * lo que faltó se avisa DESPUÉS con el ingreso ya guardado y se completa con `completarIngreso`
 * (PATCH sobre el mismo registro, nunca uno nuevo). Ver ese archivo para el porqué de cada regla.
 */
export function FormularioIngreso({ iniciales, origen, onGuardado, onCancelar, onListo }: FormularioIngresoProps) {
  const [monto, setMonto] = useState(iniciales?.monto ?? '');
  const [cliente, setCliente] = useState(iniciales?.cliente ?? '');
  const [medio, setMedio] = useState(iniciales?.medio ?? '');
  const [concepto, setConcepto] = useState(iniciales?.concepto ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState<{ mensaje: string; candidato: Ingreso | null } | null>(null);
  const [guardado, setGuardado] = useState<Ingreso | null>(null);

  /** Misma clave por gesto que el mobile: conservada entre reintentos, descartada sólo al guardar. */
  const claveGesto = useRef<string | null>(null);

  async function guardar(event: FormEvent | null, confirmarDuplicado = false) {
    event?.preventDefault();
    if (enviando) return;
    const crudo = monto.trim();
    if (crudo === '') {
      setError('Escribí cuánto te pagaron.');
      return;
    }
    const importe = normalizarDecimal(crudo);
    setEnviando(true);
    setError(null);
    const clave = claveGesto.current ?? generarId();
    claveGesto.current = clave;
    try {
      const res = await registrarIngreso({
        monto: importe,
        idemKey: clave,
        ...(origen !== undefined ? { origen } : {}),
        ...(cliente.trim() !== '' ? { clienteNombre: cliente.trim() } : {}),
        ...(medio.trim() !== '' ? { medio: medio.trim() } : {}),
        ...(concepto.trim() !== '' ? { concepto: concepto.trim() } : {}),
        ...(iniciales?.fecha !== undefined ? { fecha: iniciales.fecha } : {}),
        ...(confirmarDuplicado ? { confirmarDuplicado: true } : {}),
      });
      if (res.status === 'ok') {
        claveGesto.current = null;
        setDuplicado(null);
        setGuardado(res.ingreso);
        onGuardado(res.ingreso);
        return;
      }
      if (res.status === 'posible_duplicado') {
        setDuplicado({ mensaje: res.mensaje, candidato: res.candidato });
        return;
      }
      if (res.status === 'rechazado') setError(res.motivo);
      else setError('No pudimos anotarlo. Probá de nuevo.');
    } catch {
      setError('No pudimos anotarlo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  async function completar() {
    if (guardado == null || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await completarIngreso(guardado.id, {
        ...(cliente.trim() !== '' ? { clienteNombre: cliente.trim() } : {}),
        ...(medio.trim() !== '' ? { medio: medio.trim() } : {}),
        ...(concepto.trim() !== '' ? { concepto: concepto.trim() } : {}),
      });
      if (res.status === 'ok') {
        setGuardado(res.ingreso);
        onGuardado(res.ingreso);
        return;
      }
      setError('No pudimos completarlo. Probá de nuevo.');
    } catch {
      setError('No pudimos completarlo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const faltan = guardado?.falta ?? null;

  return (
    <form className="formulario-ingreso" data-testid="formulario-ingreso" onSubmit={(e) => void guardar(e)}>
      <label className="formulario-ingreso__campo">
        <span className="formulario-ingreso__etiqueta">Cuánto te pagaron</span>
        <input
          data-testid="ingreso-monto"
          type="text"
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="85000"
          disabled={enviando || guardado != null}
        />
      </label>

      <label className="formulario-ingreso__campo">
        <span className="formulario-ingreso__etiqueta">De quién (opcional)</span>
        <input
          data-testid="ingreso-cliente"
          type="text"
          maxLength={120}
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          placeholder="ej.: Panadería La Esquina"
          disabled={enviando}
        />
      </label>

      <label className="formulario-ingreso__campo">
        <span className="formulario-ingreso__etiqueta">Cómo te pagaron (opcional)</span>
        <input
          data-testid="ingreso-medio"
          type="text"
          maxLength={40}
          value={medio}
          onChange={(e) => setMedio(e.target.value)}
          placeholder="ej.: efectivo"
          disabled={enviando}
        />
      </label>

      <label className="formulario-ingreso__campo">
        <span className="formulario-ingreso__etiqueta">Por qué trabajo (opcional)</span>
        <input
          data-testid="ingreso-concepto"
          type="text"
          maxLength={200}
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="ej.: pintura del local"
          disabled={enviando}
        />
      </label>

      {duplicado != null && (
        <div className="formulario-ingreso__aviso" data-testid="ingreso-duplicado" role="alert">
          <p>{duplicado.mensaje}</p>
          {duplicado.candidato != null && (
            <p className="formulario-ingreso__aviso-candidato" data-testid="ingreso-duplicado-candidato">
              {duplicado.candidato.monto != null ? formatearImporte(duplicado.candidato.monto) : 'Sin monto'}
              {duplicado.candidato.fecha != null ? ` · ${duplicado.candidato.fecha}` : ''}
              {duplicado.candidato.clienteNombre != null ? ` · ${duplicado.candidato.clienteNombre}` : ''}
            </p>
          )}
          <div className="formulario-ingreso__acciones">
            <Button
              onClick={() => void guardar(null, true)}
              disabled={enviando}
              data-testid="ingreso-confirmar-duplicado"
            >
              Es otro cobro, anotalo
            </Button>
            <Button variant="cancel" onClick={onCancelar} data-testid="ingreso-descartar-duplicado">
              Es el mismo
            </Button>
          </div>
        </div>
      )}

      {guardado != null && faltan != null && faltan.length > 0 && (
        <div className="formulario-ingreso__aviso" data-testid="ingreso-falta">
          <p>
            Anotado. No me dijiste {faltan.map((f) => COMO_SE_PIDE[f]).join(', ')} — si querés, completalo
            arriba y guardá de nuevo.
          </p>
          <div className="formulario-ingreso__acciones">
            <Button onClick={() => void completar()} disabled={enviando} data-testid="ingreso-completar">
              {enviando ? 'Guardando…' : 'Completar'}
            </Button>
            <Button variant="cancel" onClick={onListo ?? onCancelar} data-testid="ingreso-listo">
              Así está bien
            </Button>
          </div>
        </div>
      )}

      {guardado != null && faltan != null && faltan.length === 0 && (
        <p className="formulario-ingreso__completo" data-testid="ingreso-completo">
          Anotado, con todos los datos.
        </p>
      )}

      {error != null && (
        <p className="formulario-ingreso__error" data-testid="ingreso-error" role="alert">
          {error}
        </p>
      )}

      {guardado == null && duplicado == null && (
        <div className="formulario-ingreso__acciones" data-testid="ingreso-acciones">
          <Button type="button" variant="cancel" onClick={onCancelar} data-testid="ingreso-cancelar">
            Cancelar
          </Button>
          <Button type="submit" disabled={enviando} data-testid="ingreso-guardar">
            {enviando ? 'Anotando…' : 'Anotar'}
          </Button>
        </div>
      )}
    </form>
  );
}
