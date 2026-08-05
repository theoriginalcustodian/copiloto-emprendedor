import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { formatearImporte, listarImpagos, type ComprobanteImpago } from '@copiloto/core';

/**
 * `SeccionMeDeben` — **la plata que facturaste y todavía no entró.**
 *
 * Port de `apps/mobile/src/modules/facturacion/SeccionMeDeben.tsx`. Misma lógica de negocio; sólo
 * cambia el sustrato (`div`/`p` en vez de `View`/`Text`).
 *
 * 🔴 **Sección de Facturación, no pantalla aparte.** Misma decisión que «Mis comprobantes»: lo que se
 * debe *son* las facturas emitidas, y separarlo en otro destino obligaría a preguntarse en cuál de los
 * dos lugares está una factura concreta. Se ve arriba del listado completo porque es la pregunta que se
 * hace primero al abrir Facturación.
 *
 * 🔴 **El total lo suma el BACKEND (`totalAdeudado`) y se muestra tal cual.** Sumar acá daría un
 * segundo número para la misma pregunta; el día que difieran —un redondeo, una página que no llegó— el
 * emprendedor ve dos verdades y deja de creerle a las dos. Y es plata: los importes viajan como string
 * decimal y no pasan por `Number` en ningún punto de este archivo.
 *
 * 🔴 **Vacío y "no pudimos consultar" NO son la misma pantalla.** «No te debe nadie» es la frase más
 * tranquilizadora que puede decir esta app, y dicha sobre la ausencia total del dato es una mentira
 * que nadie va a cuestionar. El cliente distingue los dos casos (`no_disponible` vs `[]`) y acá se
 * pintan distinto.
 */

type EstadoLista = 'cargando' | 'ok' | 'no_disponible';

export interface SeccionMeDebenHandle {
  /** Vuelve a preguntar. La usa la pantalla después de un cobro y en el tirón-para-actualizar. */
  recargar: () => Promise<void>;
}

export interface SeccionMeDebenProps {
  testID?: string;
}

/**
 * Cuánto hace que está impaga, **dicho como lo diría alguien**. `dias` puede ser `null` —el backend no
 * lo calculó— y ahí no se escribe nada: «hace 0 días» sobre una factura de marzo es peor que el
 * silencio.
 */
function antiguedad(dias: number | null): string | null {
  if (dias == null) return null;
  if (dias <= 0) return 'de hoy';
  if (dias === 1) return 'de ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace más de un mes' : `hace más de ${meses} meses`;
}

export const SeccionMeDeben = forwardRef<SeccionMeDebenHandle, SeccionMeDebenProps>(
  function SeccionMeDeben({ testID = 'facturacion-me-deben' }, ref) {
    const [estado, setEstado] = useState<EstadoLista>('cargando');
    const [filas, setFilas] = useState<readonly ComprobanteImpago[]>([]);
    const [total, setTotal] = useState<string | null>(null);
    const vivo = useRef(true);

    const cargar = useCallback(async () => {
      try {
        const res = await listarImpagos();
        if (!vivo.current) return;
        if (res.status === 'ok') {
          setFilas(res.comprobantes);
          setTotal(res.totalAdeudado);
          setEstado('ok');
          return;
        }
        setEstado('no_disponible');
      } catch {
        if (vivo.current) setEstado('no_disponible');
      }
    }, []);

    useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

    useEffect(() => {
      vivo.current = true;
      void cargar();
      return () => {
        vivo.current = false;
      };
    }, [cargar]);

    return (
      <section className="facturacion-me-deben" data-testid={testID}>
        <h2 className="facturacion-me-deben__titulo">Te deben</h2>

        {estado === 'cargando' && (
          <div className="facturacion-screen__loading" data-testid={`${testID}-cargando`}>
            <span className="seccion-cobro__spinner" aria-hidden="true" />
          </div>
        )}

        {estado === 'no_disponible' && (
          // No «no te debe nadie»: eso sería afirmar sobre un dato que no tenemos.
          <p className="facturacion-me-deben__aviso" data-testid={`${testID}-no-disponible`}>
            No pudimos consultar las facturas impagas.
          </p>
        )}

        {estado === 'ok' && filas.length === 0 && (
          <p className="facturacion-me-deben__aviso" data-testid={`${testID}-vacia`}>
            No tenés facturas impagas.
          </p>
        )}

        {estado === 'ok' && filas.length > 0 && (
          <>
            {total != null && (
              <p className="facturacion-me-deben__total" data-testid={`${testID}-total`}>
                {formatearImporte(total)}
              </p>
            )}
            <div className="facturacion-me-deben__lista">
              {filas.map((f) => {
                const bajo = [f.nro != null && f.receptorNombre != null ? `N° ${f.nro}` : null, antiguedad(f.dias)]
                  .filter((x): x is string => x != null)
                  .join(' · ');
                return (
                  <div className="facturacion-me-deben__fila" key={f.id} data-testid={`${testID}-fila-${f.id}`}>
                    <div className="facturacion-me-deben__fila-textos">
                      <p className="facturacion-me-deben__fila-nombre">
                        {/* Sin nombre de receptor no se inventa «Cliente»: los comprobantes anteriores
                            al 2026-07-21 no lo tienen, y el número identifica igual. */}
                        {f.receptorNombre ?? (f.nro != null ? `N° ${f.nro}` : 'Sin datos del cliente')}
                      </p>
                      {bajo !== '' && <p className="facturacion-me-deben__fila-detalle">{bajo}</p>}
                    </div>
                    {/* El SALDO, no el total: si le pagaron la mitad, lo que le deben es la otra mitad. */}
                    {f.saldo != null && (
                      <p className="facturacion-me-deben__fila-saldo" data-testid={`${testID}-saldo-${f.id}`}>
                        {formatearImporte(f.saldo)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    );
  },
);
