import { useCallback, useEffect, useRef, useState } from 'react';

import {
  crearConcepto,
  desactivarConcepto,
  editarConcepto,
  formatearImporte,
  listarConceptos,
  type Concepto,
} from '@copiloto/core';

import { Button, Skeleton } from '../../../design-system';

/**
 * `SeccionCatalogo` — port de `apps/mobile/src/modules/ajustes/negocio/SeccionCatalogo.tsx`. "Lo
 * que vendo", con su precio de referencia. Ajustes → Mi negocio.
 *
 * Pide los desactivados explícitamente (`incluirInactivos: true`): el backend los filtra por
 * defecto, y ésta es la ÚNICA pantalla desde donde se puede volver a ofrecer uno. Quitar es
 * DESACTIVAR, nunca borra — ver docstring de la versión mobile para el detalle completo.
 */
type EstadoCarga = 'cargando' | 'ok' | 'no_disponible';

export interface SeccionCatalogoProps {
  testID?: string;
}

export function SeccionCatalogo({ testID = 'catalogo' }: SeccionCatalogoProps) {
  const [carga, setCarga] = useState<EstadoCarga>('cargando');
  const [conceptos, setConceptos] = useState<readonly Concepto[]>([]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  /** `null` = el formulario está en modo alta. Un id = se está editando ese concepto. */
  const [editando, setEditando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const vivo = useRef(true);

  const cargar = useCallback(async () => {
    const res = await listarConceptos({ incluirInactivos: true });
    if (!vivo.current) return;
    if (res.status === 'ok') {
      setConceptos(res.conceptos);
      setCarga('ok');
      return;
    }
    setCarga('no_disponible');
  }, []);

  useEffect(() => {
    vivo.current = true;
    void cargar();
    return () => {
      vivo.current = false;
    };
  }, [cargar]);

  function limpiar() {
    setNombre('');
    setPrecio('');
    setEditando(null);
  }

  /** El precio va tal cual lo tipeó, sin `Number()` ni redondeo. Vacío = `null` explícito en la
   *  edición ("sacale el precio") y ausente en el alta ("no le puse"). */
  function precioParaGuardar(): string | null | undefined {
    const t = precio.trim();
    if (t !== '') return t;
    return editando != null ? null : undefined;
  }

  async function guardar() {
    if (guardando) return;
    const limpio = nombre.trim();
    if (limpio === '') {
      setAviso('Poné un nombre para poder guardarlo.');
      return;
    }
    setGuardando(true);
    setAviso(null);
    try {
      const p = precioParaGuardar();
      const res =
        editando != null
          ? await editarConcepto(editando, { nombre: limpio, ...(p !== undefined ? { precioReferencia: p } : {}) })
          : await crearConcepto({ nombre: limpio, ...(p !== undefined ? { precioReferencia: p } : {}) });
      if (!vivo.current) return;
      if (res.status === 'ok') {
        limpiar();
        await cargar();
        return;
      }
      if (res.status === 'duplicado') {
        const ya = res.existente;
        setAviso(
          ya != null && ya.nombre !== ''
            ? `Ya tenés «${ya.nombre}» en tu lista${ya.activo ? '.' : ', aunque está guardado como que ya no lo ofrecés.'}`
            : 'Ya tenés un concepto con ese nombre.',
        );
        return;
      }
      setAviso('No pudimos guardarlo. Probá de nuevo.');
    } catch (err) {
      if (vivo.current) setAviso(mensajeDeError(err));
    } finally {
      if (vivo.current) setGuardando(false);
    }
  }

  async function alternarActivo(c: Concepto) {
    if (guardando) return;
    setGuardando(true);
    setAviso(null);
    try {
      const res = c.activo ? await desactivarConcepto(c.id) : await editarConcepto(c.id, { activo: true });
      if (!vivo.current) return;
      // Se relee siempre, incluso con respuesta `ok`: el `DELETE` puede no devolver el concepto.
      if (res.status === 'ok') await cargar();
      else setAviso('No pudimos cambiarlo. Probá de nuevo.');
    } catch {
      if (vivo.current) setAviso('No pudimos cambiarlo. Probá de nuevo.');
    } finally {
      if (vivo.current) setGuardando(false);
    }
  }

  function editar(c: Concepto) {
    setEditando(c.id);
    setNombre(c.nombre);
    setPrecio(c.precioReferencia ?? '');
    setAviso(null);
  }

  return (
    <div className="catalogo-seccion" data-testid={testID}>
      <h2 className="catalogo-seccion__titulo">Lo que vendo</h2>
      <p className="catalogo-seccion__ayuda">
        Tu lista de trabajos con su precio de referencia, para armar presupuestos sin escribir lo
        mismo cada vez. Cambiar un precio acá no cambia los presupuestos que ya mandaste.
      </p>

      {carga === 'cargando' && (
        <div data-testid={`${testID}-cargando`}>
          <Skeleton height={48} radius={12} />
        </div>
      )}

      {carga === 'no_disponible' && (
        <p className="catalogo-seccion__no-disponible" data-testid={`${testID}-no-disponible`}>
          Tu lista de trabajos todavía no está disponible en tu copiloto.
        </p>
      )}

      {carga === 'ok' && conceptos.length === 0 && (
        <p className="catalogo-seccion__vacio" data-testid={`${testID}-vacio`}>
          Todavía no cargaste ninguno. Agregá el primero acá abajo.
        </p>
      )}

      {carga === 'ok' && conceptos.length > 0 && (
        <div className="catalogo-seccion__lista">
          {conceptos.map((c) => (
            <div key={c.id} className="catalogo-seccion__fila" data-testid={`${testID}-fila-${c.id}`}>
              <button
                type="button"
                className="catalogo-seccion__fila-info"
                data-testid={`${testID}-editar-${c.id}`}
                onClick={() => editar(c)}
                aria-label={`Editar ${c.nombre}`}
              >
                <p className="catalogo-seccion__fila-nombre">{c.nombre}</p>
                <p className="catalogo-seccion__fila-precio">
                  {c.precioReferencia != null ? formatearImporte(c.precioReferencia) : 'Sin precio de referencia'}
                  {c.activo ? '' : ' · ya no lo ofrecés'}
                </p>
              </button>
              <button
                type="button"
                className="catalogo-seccion__fila-alternar"
                data-testid={`${testID}-alternar-${c.id}`}
                onClick={() => void alternarActivo(c)}
                disabled={guardando}
              >
                {c.activo ? 'Ya no lo ofrezco' : 'Volver a ofrecerlo'}
              </button>
            </div>
          ))}
        </div>
      )}

      {carga !== 'no_disponible' && (
        <div className="catalogo-seccion__form">
          <label className="perfil-negocio-seccion__campo">
            <span className="perfil-negocio-seccion__etiqueta">
              {editando != null ? 'Editando' : 'Agregar un trabajo'}
            </span>
            <input
              data-testid={`${testID}-nombre`}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="ej.: Corte de pelo"
            />
          </label>
          <label className="perfil-negocio-seccion__campo">
            <span className="perfil-negocio-seccion__etiqueta">Precio de referencia (opcional)</span>
            <input
              data-testid={`${testID}-precio`}
              type="text"
              inputMode="decimal"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="ej.: 8000"
            />
          </label>
          <div className="perfil-negocio-screen__acciones" data-testid={`${testID}-botones`}>
            <Button
              onClick={() => void guardar()}
              disabled={guardando}
              data-testid={`${testID}-guardar`}
            >
              {guardando ? 'Guardando…' : editando != null ? 'Guardar cambios' : 'Agregar'}
            </Button>
            {editando != null && (
              <Button variant="cancel" onClick={limpiar} data-testid={`${testID}-cancelar`}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {aviso != null && (
        <p className="catalogo-seccion__aviso" data-testid={`${testID}-aviso`}>
          {aviso}
        </p>
      )}
    </div>
  );
}

/** El texto del backend si lo hay; si no, uno genérico. Nunca se traga la causa en silencio. */
function mensajeDeError(err: unknown): string {
  const detalle = (err as { detail?: unknown })?.detail;
  return typeof detalle === 'string' && detalle.trim() !== '' ? detalle : 'No pudimos guardarlo. Probá de nuevo.';
}
