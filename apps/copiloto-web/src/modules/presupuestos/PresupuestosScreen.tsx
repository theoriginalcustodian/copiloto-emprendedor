import { useCallback, useEffect, useRef, useState } from 'react';

import { formatearImporte, listarPresupuestos, obtenerPresupuesto, type Presupuesto } from '@copiloto/core';

import { Button, Skeleton, Surface } from '../../design-system';
import { DetallePresupuesto } from './DetallePresupuesto';
import { FormularioPresupuesto } from './FormularioPresupuesto';
import { TarjetaPresupuesto } from './TarjetaPresupuesto';
import './presupuestos.css';

const SKELETON_ROWS = 3;

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';
type Vista = 'listado' | 'formulario';

/**
 * "Mes actual" en español, capitalizado (`"septiembre"` → `"Septiembre"`) — el `período` del stack
 * cuando no hay un dato de período propio del backend (a diferencia de `ResumenGastos.periodo`,
 * `/presupuestos` no manda uno). CLAUDE.md de la tarea: "usá el período real si existe el dato; si
 * no, mes actual".
 */
function mesActual(): string {
  const nombre = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date());
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/**
 * Suma de importes decimales SIN pasar por `number` — igual que `formatearImporte` evita el float,
 * pero ESO sólo formatea (ver su docstring: "esto no es aritmética"); acá sí hace falta sumar para
 * el bloque negro. Los montos son strings con SIEMPRE 2 decimales (contrato del backend,
 * `packages/core/src/api/presupuestos.ts`), así que se suman en centavos enteros (`BigInt`, sin
 * redondeo de punto flotante) y se devuelve el string que `formatearImporte` ya sabe mostrar. Un
 * valor con forma inesperada se descarta en vez de reventar el bloque entero por un dato roto de un
 * solo presupuesto.
 */
function sumarImportes(valores: string[]): string {
  let centavos = 0n;
  for (const valor of valores) {
    const limpio = valor.trim();
    const negativo = limpio.startsWith('-');
    const sinSigno = negativo ? limpio.slice(1) : limpio;
    if (!/^\d+\.\d{2}$/.test(sinSigno)) continue;
    const [entera, decimales] = sinSigno.split('.');
    const c = BigInt(entera) * 100n + BigInt(decimales);
    centavos += negativo ? -c : c;
  }
  const negativo = centavos < 0n;
  const abs = negativo ? -centavos : centavos;
  const decimales = (abs % 100n).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}${abs / 100n}.${decimales}`;
}

export interface PresupuestosScreenProps {
  /** Id que llegó desde la lista de actividad — abre su detalle al montar. */
  presupuestoIdInicial?: number;
  /**
   * Lleva al gate de confirmación de factura con el borrador ya armado. El id que llega es de un
   * BORRADOR, no de una factura emitida — quien la implemente deposita al usuario en el gate que ya
   * existe, nunca emite por su cuenta.
   */
  onFacturar: (facturaId: string) => void;
}

/**
 * `PresupuestosScreen` — M-WEB módulo 5: port de
 * `apps/mobile/src/modules/presupuestos/PantallaPresupuestos.tsx` a `copiloto-web`. MISMA lógica: el
 * listado trae SÓLO los vigentes salvo que se pida el historial, corregir es un alta con
 * `reemplazaA` (no hay edición), y el detalle es un overlay que se relee tras cambiar de estado para
 * no dejar la card de atrás mostrando el valor viejo. Lo que NO se porta 1:1: `RefreshControl` (gesto
 * táctil) → botón "Actualizar" explícito, mismo criterio que `GastosScreen`/`ClientesScreen`.
 *
 * Repintado (Tarea 3, CLAUDE.md §5, anatomía de función) sobre el mockup fuente
 * (`Prototipo frontend/odobi-ui/prototipo/index.html`, bloque `#presu`): stack (nombre + período) +
 * "bloque negro" (`Surface variant="bloque"`) + rótulo/alta + lista. El bloque negro NO muestra
 * "presupuestado este mes": muestra lo que sigue **esperando respuesta** — la única cifra accionable
 * de esta función, calcada del comentario del propio mockup (`#presu` en el CSS fuente): "un
 * presupuesto aceptado ya no pide nada, y uno rechazado tampoco". Se calcula sobre los VIGENTES
 * (`reemplazadoPor == null`) con `estado === 'pendiente'` exactamente — nunca sobre `estado === null`
 * ("el backend todavía no manda este campo", *no* "pendiente": ver el docstring de
 * `Presupuesto.estado` en core). Tratar `null` como pendiente inflaría la cifra con datos que no se
 * conocen.
 */
export function PresupuestosScreen({ onFacturar, presupuestoIdInicial }: PresupuestosScreenProps) {
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [vista, setVista] = useState<Vista>('listado');
  const [corrigiendo, setCorrigiendo] = useState<Presupuesto | null>(null);
  const [detalle, setDetalle] = useState<Presupuesto | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  // `vivo.current = true` DENTRO del setup del efecto — StrictMode, ver el comentario equivalente en
  // GastosScreen/ClientesScreen.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback(
    (silencioso = false): Promise<void> => {
      if (!silencioso) setEstado('cargando');
      return listarPresupuestos(verHistorial ? { incluirReemplazados: true } : {})
        .then((res) => {
          if (!vivo.current) return;
          if (res.status === 'no_disponible') {
            setEstado('no_disponible');
            setPresupuestos([]);
            return;
          }
          setPresupuestos(res.presupuestos);
          setEstado('ok');
        })
        .catch(() => {
          if (vivo.current) setEstado('error');
        });
    },
    [verHistorial],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Abrir directo un ítem que llegó por la lista de actividad — se busca por id, no se confía en la
   * lista cargada (puede no estar en la página, o estar vieja). Si no se encuentra, no se abre nada. */
  useEffect(() => {
    if (presupuestoIdInicial == null) return;
    let cancelado = false;
    obtenerPresupuesto(presupuestoIdInicial).then((res) => {
      if (cancelado || !vivo.current) return;
      if (res.status === 'ok') setDetalle(res.presupuesto);
    });
    return () => { cancelado = true; };
  }, [presupuestoIdInicial]);

  async function actualizar() {
    setActualizando(true);
    await cargar(true);
    if (vivo.current) setActualizando(false);
  }

  function alCrear(nuevo: Presupuesto) {
    setVista('listado');
    setCorrigiendo(null);
    // Se RELEE en vez de insertar el objeto en la lista local: el alta puede haber reemplazado a
    // otro, que tiene que DESAPARECER del listado vigente.
    void cargar(true);
    setDetalle(nuevo);
  }

  function abrirCorreccion(p: Presupuesto) {
    setDetalle(null);
    setCorrigiendo(p);
    setVista('formulario');
  }

  function facturarDesdeDetalle(facturaId: string) {
    setDetalle(null);
    onFacturar(facturaId);
  }

  const hayPresupuestos = presupuestos.length > 0;

  // Bloque negro: sólo los VIGENTES cuentan (un reemplazado ya no representa nada activo, esté o no
  // visible por el toggle de historial — `presupuestos` puede traerlos si `verHistorial` está prendido).
  const vigentes = presupuestos.filter((p) => p.reemplazadoPor == null);
  const sinContestar = vigentes.filter((p) => p.estado === 'pendiente');
  const aceptados = vigentes.filter((p) => p.estado === 'aprobado');
  const esperandoRespuesta = sumarImportes(sinContestar.map((p) => p.total));
  const comparacion = `${sinContestar.length} sin contestar · ${aceptados.length} aceptado${aceptados.length === 1 ? '' : 's'}`;
  const rotuloLista = verHistorial ? 'Historial' : 'Activos';

  return (
    <div className="presupuestos-screen" data-testid="pantalla-presupuestos">
      {/* Anatomía de función (Tarea 3, CLAUDE.md §5): stack con nombre + período, misma card blanca
          que el bloque negro de abajo (mismo `--r-xl`) — calcado de `.fn-stack .atras` del mockup. Web
          no lleva "Volver ‹" (Rail/TabBar propios, contrato "no se toca el modelo de capas"). */}
      <header className="presupuestos-screen__stack">
        <span className="presupuestos-screen__nombre-fila">
          <span className="presupuestos-screen__nombre">Presupuestos</span>
          {estado === 'ok' && vista === 'listado' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="presupuestos-actualizar"
              className="presupuestos-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        <span className="presupuestos-screen__periodo">{mesActual()}</span>
      </header>

      {estado === 'cargando' && (
        <div className="presupuestos-screen__loading" data-testid="presupuestos-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={64} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="presupuestos-screen__empty" data-testid="presupuestos-error">
          <p>No pudimos cargar tus presupuestos.</p>
          <Button variant="cancel" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="presupuestos-screen__empty" data-testid="presupuestos-no-disponible">
          Los presupuestos todavía no están disponibles en tu copiloto.
        </p>
      )}

      {estado === 'ok' && (
        <div className="presupuestos-screen__body">
          {vista === 'formulario' ? (
            <FormularioPresupuesto
              corrige={corrigiendo}
              onCreado={alCrear}
              onCancelar={() => {
                setVista('listado');
                setCorrigiendo(null);
              }}
            />
          ) : (
            <>
              {/* "Bloque negro" (gramática Monzo, CLAUDE.md §5) — ver el docstring de cabecera del
                  archivo para el porqué de "esperando respuesta" en vez de "presupuestado". */}
              <Surface variant="bloque" className="presupuestos-resumen" data-testid="presupuestos-resumen">
                <p className="presupuestos-resumen__label">Esperando respuesta</p>
                <p className="presupuestos-resumen__total" data-testid="presupuestos-resumen-total">
                  {formatearImporte(esperandoRespuesta)}
                </p>
                <span className="presupuestos-resumen__comparacion" data-testid="presupuestos-resumen-comparacion">
                  {comparacion}
                </span>
              </Surface>

              {/* Rótulo de sección + alta, misma fila (CLAUDE.md §5): el pill NUNCA es un FAB —
                  compite con el mic. "Nuevo presupuesto" es el verbo textual del repo. */}
              <div className="presupuestos-screen__fila-lbl">
                <span className="presupuestos-screen__lista-lbl">{rotuloLista}</span>
                <button
                  type="button"
                  className="presupuestos-screen__pill-nuevo"
                  onClick={() => {
                    setCorrigiendo(null);
                    setVista('formulario');
                  }}
                  data-testid="presupuestos-nuevo"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Nuevo presupuesto
                </button>
              </div>

              {!hayPresupuestos && (
                <p className="presupuestos-screen__empty" data-testid="presupuestos-vacio">
                  {verHistorial
                    ? 'No hay presupuestos en el historial.'
                    : 'Todavía no hiciste ningún presupuesto. También podés pedírselo al copiloto por chat.'}
                </p>
              )}

              <div className="presupuestos-screen__lista">
                {presupuestos.map((p) => (
                  <TarjetaPresupuesto key={p.id} presupuesto={p} onSelect={setDetalle} />
                ))}
              </div>

              {/* El historial existe porque corregir saca al anterior del listado vigente. */}
              <Button
                variant="ghost"
                onClick={() => setVerHistorial((v) => !v)}
                data-testid="presupuestos-toggle-historial"
              >
                {verHistorial ? 'Ver sólo los vigentes' : 'Ver también los reemplazados'}
              </Button>
            </>
          )}
        </div>
      )}

      {detalle != null && (
        <DetallePresupuesto
          presupuesto={detalle}
          onCerrar={() => setDetalle(null)}
          onFacturar={facturarDesdeDetalle}
          onCorregir={abrirCorreccion}
          // El estado cambió en la hoja: se pisa la fila de atrás con lo que devolvió el backend.
          onEstadoCambiado={(actualizado) => {
            setPresupuestos((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
            setDetalle(actualizado);
          }}
        />
      )}
    </div>
  );
}
