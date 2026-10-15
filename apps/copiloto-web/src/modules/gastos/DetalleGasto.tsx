import { useEffect, useRef, useState } from 'react';

import {
  destinoDeImputacion,
  ETIQUETA_CATEGORIA,
  formatearFechaLarga,
  formatearImporte,
  imputarGasto,
  listarTrabajosImputables,
  obtenerGasto,
  rotuloDeImputacion,
  type DestinoTrabajo,
  type Gasto,
  type ImputacionGasto,
  type TrabajoImputable,
} from '@copiloto/core';

import { Button, Skeleton } from '../../design-system';

/**
 * Port de `apps/mobile/src/modules/gastos/DetalleGasto.tsx` — mismo criterio: se RE-PIDE por id
 * aunque la lista ya tenga el objeto (puede estar viejo), y mientras llega el fresco se pinta el
 * de la lista para evitar un salto en blanco. Sin editar ni borrar (contrato §12 del móvil, ídem
 * acá): un gasto se corrige antes de guardarlo, no en el detalle.
 */
type Estado = 'cargando' | 'ok' | 'no_encontrado' | 'no_disponible' | 'error';

const ETIQUETA_ORIGEN: Record<string, string> = {
  voz: 'Lo dictaste',
  foto: 'Salió de una foto',
};

export interface DetalleGastoProps {
  /** El de la lista — se usa para pintar de entrada mientras llega el fresco. */
  gasto: Gasto;
  onCerrar: () => void;
}

function Dato({ etiqueta, valor, testID }: { etiqueta: string; valor: string; testID: string }) {
  return (
    <p className="detalle-gasto__dato" data-testid={testID}>
      <span className="detalle-gasto__dato-etiqueta">{etiqueta}</span>
      <span className="detalle-gasto__dato-valor">{valor}</span>
    </p>
  );
}

/**
 * «¿De qué trabajo es este gasto?» — el bloque de **imputación**, gemelo de
 * `apps/mobile/src/modules/gastos/DetalleGasto.tsx`. Lo que decide qué mostrar vive en
 * `@copiloto/core` (`destinoDeImputacion`, `rotuloDeImputacion`, `listarTrabajosImputables`) y no acá:
 * el mismo defecto en dos pantallas gemelas es el que ya pagamos
 * (`memoria/dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una.md`).
 *
 * 🔴 **Tres estados, no dos.** `gasto.imputacion === null` no es «sin imputar»: es «este backend no
 * lo dijo» (la clave entró al GET el 2026-10-14). En ese caso el bloque **no se muestra**, porque
 * «sin imputar» es una afirmación sobre la plata del emprendedor y no se inventa. Sin imputar de
 * verdad son las tres referencias en `null`.
 *
 * 🔴 **Imputar no es obligatorio y esta pantalla no lo vuelve obligatorio** — lo dice el endpoint en
 * su propio docstring (`apps/copiloto/gastos_web.py:162`): *«el gasto ya entró a la caja sin esto;
 * si imputar se volviera un requisito, el emprendedor dejaría de cargar gastos»*. De ahí que el
 * texto del caso sin imputar explique la **consecuencia** (no cuenta en ningún margen) en vez de
 * pedir que lo arregle.
 */
type EstadoLista = 'cerrada' | 'cargando' | 'abierta' | 'no_disponible';

function BloqueTrabajo({ gasto }: { gasto: Gasto }) {
  // Se guarda la IMPUTACIÓN entera y no sólo el destino: el rótulo (`etiqueta`) viaja con ella, y
  // re-derivarlo desde el `ref` es lo que mostraba `#227` donde el selector decía `#3`.
  const [imputado, setImputado] = useState<ImputacionGasto | null>(gasto.imputacion);
  const destino: DestinoTrabajo | null = destinoDeImputacion(imputado);
  const [lista, setLista] = useState<EstadoLista>('cerrada');
  const [trabajos, setTrabajos] = useState<readonly TrabajoImputable[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El gasto fresco puede traer otra imputación que la del listado (se abrió el detalle con el
  // objeto viejo). Gana el del servidor, igual que el resto de la pantalla.
  useEffect(() => {
    setImputado(gasto.imputacion);
  }, [gasto.imputacion]);

  if (gasto.imputacion === null) return null;

  const abrir = async () => {
    setError(null);
    setLista('cargando');
    const res = await listarTrabajosImputables();
    if (res.status !== 'ok') {
      setLista('no_disponible');
      return;
    }
    setTrabajos(res.trabajos);
    setLista('abierta');
  };

  const escribir = async (nuevo: DestinoTrabajo | null) => {
    setGuardando(true);
    setError(null);
    try {
      const res = await imputarGasto(gasto.id, nuevo);
      if (res.status === 'no_encontrado') {
        // 404 cubre dos casos que el backend no distingue: el gasto o el trabajo. El texto no
        // afirma cuál de los dos, porque esta capa no lo sabe.
        setError('No encontramos ese gasto o ese trabajo.');
        return;
      }
      if (res.status !== 'ok') {
        setError('No pudimos guardar el trabajo. Probá de nuevo.');
        return;
      }
      setImputado(res.imputacion);
      setLista('cerrada');
    } catch {
      setError('No pudimos guardar el trabajo. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="detalle-gasto__trabajo" data-testid="detalle-gasto-trabajo">
      {destino !== null ? (
        <>
          <Dato
            etiqueta="Trabajo"
            valor={rotuloDeImputacion(imputado) ?? ''}
            testID="detalle-gasto-trabajo-imputado"
          />
          <div className="detalle-gasto__trabajo-acciones" data-testid="detalle-gasto-trabajo-acciones">
            <Button
              variant="ghost"
              onClick={() => void escribir(null)}
              disabled={guardando}
              data-testid="detalle-gasto-desimputar"
            >
              Quitar del trabajo
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="detalle-gasto__aviso" data-testid="detalle-gasto-sin-imputar">
            Sin imputar: este gasto no le baja el margen a ningún trabajo.
          </p>
          {lista === 'cerrada' && (
            <div className="detalle-gasto__trabajo-acciones" data-testid="detalle-gasto-trabajo-acciones">
              <Button
                variant="ghost"
                onClick={() => void abrir()}
                disabled={guardando}
                data-testid="detalle-gasto-imputar"
              >
                Imputar a un trabajo
              </Button>
            </div>
          )}
        </>
      )}

      {lista === 'cargando' && (
        <div data-testid="detalle-gasto-trabajos-cargando" className="detalle-gasto__loading">
          <Skeleton height={16} radius={8} />
        </div>
      )}

      {lista === 'no_disponible' && (
        <p className="detalle-gasto__aviso" data-testid="detalle-gasto-trabajos-no-disponible">
          No pudimos traer tus trabajos.
        </p>
      )}

      {lista === 'abierta' && trabajos.length === 0 && (
        <p className="detalle-gasto__aviso" data-testid="detalle-gasto-trabajos-vacio">
          Todavía no tenés trabajos a los que imputarlo.
        </p>
      )}

      {lista === 'abierta' && trabajos.length > 0 && (
        <div className="detalle-gasto__trabajos" data-testid="detalle-gasto-trabajos">
          {trabajos.map((t) => (
            <Button
              key={`${t.eslabon}:${t.ref}`}
              variant="cancel"
              onClick={() => void escribir({ eslabon: t.eslabon, ref: t.ref })}
              disabled={guardando}
              data-testid={`detalle-gasto-trabajo-${t.eslabon}-${t.ref}`}
            >
              {t.etiqueta}
            </Button>
          ))}
        </div>
      )}

      {error != null && (
        <p className="detalle-gasto__error" data-testid="detalle-gasto-trabajo-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function DetalleGasto({ gasto, onCerrar }: DetalleGastoProps) {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [fresco, setFresco] = useState<Gasto | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerGasto(gasto.id)
      .then((res) => {
        if (cancelado || !vivo.current) return;
        if (res.status === 'ok') {
          setFresco(res.gasto);
          setEstado('ok');
          return;
        }
        setEstado(res.status === 'no_encontrado' ? 'no_encontrado' : 'no_disponible');
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => { cancelado = true; };
  }, [gasto.id]);

  // Mientras llega el fresco se muestra el de la lista: es el mismo gasto y evita un salto en
  // blanco. Cuando llega, gana el del servidor.
  const g = fresco ?? gasto;
  const origen = ETIQUETA_ORIGEN[g.origen];

  return (
    <div className="detalle-gasto" data-testid="detalle-gasto">
      <div className="detalle-gasto__scroll" data-testid="detalle-gasto-scroll">
        <p className="detalle-gasto__monto" data-testid="detalle-gasto-monto">
          {formatearImporte(g.monto)}
        </p>

        {estado === 'cargando' && (
          <div data-testid="detalle-gasto-cargando" className="detalle-gasto__loading">
            <Skeleton height={16} radius={8} />
            <Skeleton height={16} radius={8} />
          </div>
        )}

        {estado === 'no_encontrado' && (
          <p className="detalle-gasto__aviso" data-testid="detalle-gasto-no-encontrado">
            No encontramos ese gasto.
          </p>
        )}

        {estado === 'no_disponible' && (
          <p className="detalle-gasto__aviso" data-testid="detalle-gasto-no-disponible">
            El detalle todavía no está disponible en tu copiloto.
          </p>
        )}

        {estado === 'error' && (
          <p className="detalle-gasto__error" data-testid="detalle-gasto-error">
            No pudimos cargar el detalle.
          </p>
        )}

        <div className="detalle-gasto__datos">
          <Dato etiqueta="Categoría" valor={ETIQUETA_CATEGORIA[g.categoria]} testID="detalle-gasto-categoria" />
          {/* H-A4-6: `g.fecha` llega "YYYY-MM-DD" (sin hora) del backend. `Larga` porque acá SÍ
              importa el año — es el detalle, no la card. */}
          <Dato etiqueta="Fecha" valor={formatearFechaLarga(g.fecha)} testID="detalle-gasto-fecha" />
          {g.proveedor != null && (
            <Dato etiqueta="Proveedor" valor={g.proveedor} testID="detalle-gasto-proveedor" />
          )}
          {g.medioPago != null && (
            <Dato etiqueta="Cómo lo pagaste" valor={g.medioPago} testID="detalle-gasto-medio-pago" />
          )}
          {origen != null && <Dato etiqueta="Origen" valor={origen} testID="detalle-gasto-origen" />}
        </div>

        {/* Lo que dictó, textual: el registro de lo que dijo antes de corregir. */}
        {g.descripcion != null && g.descripcion !== '' && (
          <p className="detalle-gasto__descripcion" data-testid="detalle-gasto-descripcion">
            «{g.descripcion}»
          </p>
        )}

        {g.montoSugerido != null && (
          <p className="detalle-gasto__sugerido" data-testid="detalle-gasto-monto-sugerido">
            Del ticket leímos: {formatearImporte(g.montoSugerido)}
          </p>
        )}

        {/* SM-E3: a qué trabajo pertenece el gasto. Va DESPUÉS de los datos y antes de las
            acciones: no es un dato del comprobante, es lo que decide si el margen de ese trabajo
            está completo. */}
        <BloqueTrabajo gasto={g} />

        <div className="detalle-gasto__acciones" data-testid="detalle-gasto-acciones">
          <Button variant="cancel" onClick={onCerrar} data-testid="detalle-gasto-cerrar">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
