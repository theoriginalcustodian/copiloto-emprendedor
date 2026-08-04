import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ETIQUETA_CATEGORIA,
  formatearImporte,
  obtenerResumenContabilidad,
  type ResumenContabilidad,
} from '@copiloto/core';

import { Badge, type BadgeVariant, Button, Skeleton, Surface } from '../../design-system';
import './contabilidad.css';

type Estado = 'cargando' | 'ok' | 'error' | 'no_disponible';

const SKELETON_ROWS = 4;

/**
 * `ContabilidadScreen` — M-WEB módulo 5: port de
 * `apps/mobile/src/modules/contabilidad/PantallaContabilidad.tsx` a `copiloto-web`. Sin backend
 * propio: agrega client-side sobre `obtenerResumenContabilidad` de `@copiloto/core`, ya consumida
 * por `gastos`/`clientes`. Mismo patrón de estados/`vivo.current` que `GastosScreen`/`ClientesScreen`;
 * `RefreshControl` (gesto táctil) se reemplaza por el botón "Actualizar" explícito.
 *
 * Reglas de negocio heredadas 1:1 de mobile (ver contrato §2/§4 citado en el port original):
 * caja y facturado NUNCA se suman (una factura emitida no es caja hasta que se cobra); `queda`
 * puede ser negativo y se muestra tal cual; los porcentajes de gastos se normalizan sobre la suma
 * real, no sobre 100; sin escala de monotributo vigente el backend manda `tope: null` y sólo se
 * muestra el acumulado de 12 meses, nunca un tope viejo como si fuera vigente.
 */
export function ContabilidadScreen() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [resumen, setResumen] = useState<ResumenContabilidad | null>(null);
  const [actualizando, setActualizando] = useState(false);
  // Mismo patrón que GastosScreen/ClientesScreen: `vivo.current = true` va DENTRO del setup del
  // efecto (no sólo `useRef(true)`) por el doble-invoke de StrictMode en dev.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    return obtenerResumenContabilidad()
      .then((res) => {
        if (!vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setResumen(null);
          return;
        }
        setResumen(res.resumen);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function actualizar() {
    setActualizando(true);
    await cargar(true);
    if (vivo.current) setActualizando(false);
  }

  return (
    <div className="contabilidad-screen" data-testid="pantalla-contabilidad">
      <header className="contabilidad-screen__header">
        <h1 className="contabilidad-screen__title">Contabilidad</h1>
        {estado === 'ok' && (
          <Button
            variant="ghost"
            onClick={() => void actualizar()}
            disabled={actualizando}
            data-testid="contabilidad-actualizar"
          >
            {actualizando ? 'Actualizando…' : 'Actualizar'}
          </Button>
        )}
      </header>

      {estado === 'cargando' && (
        <div className="contabilidad-screen__loading" data-testid="contabilidad-cargando">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={90} radius={16} />
          ))}
        </div>
      )}

      {estado === 'error' && (
        <div className="contabilidad-screen__empty" data-testid="contabilidad-error">
          <p>No pudimos cargar tu contabilidad.</p>
          <Button variant="cancel" onClick={() => void cargar()}>
            Reintentar
          </Button>
        </div>
      )}

      {estado === 'no_disponible' && (
        <p className="contabilidad-screen__empty" data-testid="contabilidad-no-disponible">
          La contabilidad todavía no está disponible en tu copiloto.
        </p>
      )}

      {estado === 'ok' && resumen != null && (
        <div className="contabilidad-screen__body" data-testid="contabilidad-contenido">
          <SeccionCaja caja={resumen.caja} />
          {resumen.gastos.porCategoria.length > 0 && <SeccionGastos porCategoria={resumen.gastos.porCategoria} />}
          <SeccionFacturado facturado={resumen.facturado} />
          {resumen.clientes.length > 0 && <SeccionClientes clientes={resumen.clientes} />}
        </div>
      )}
    </div>
  );
}

function SeccionCaja({ caja }: { caja: ResumenContabilidad['caja'] }) {
  // `queda` puede ser negativo — un mes en rojo es información, no un bug, y se muestra así.
  const negativo = caja.queda.trim().startsWith('-');

  return (
    <Surface variant="tile" className="contabilidad-caja" data-testid="contabilidad-caja">
      <p className="contabilidad-tile__etiqueta">Caja</p>
      <p
        className={`contabilidad-caja__queda${negativo ? ' contabilidad-caja__queda--negativo' : ''}`}
        data-testid="contabilidad-caja-queda"
      >
        {formatearImporte(caja.queda)}
      </p>
      <div className="contabilidad-caja__fila">
        <span className="contabilidad-tile__sub" data-testid="contabilidad-caja-entro">
          Entró {formatearImporte(caja.entro)}
        </span>
        <span className="contabilidad-tile__sub" data-testid="contabilidad-caja-salio">
          Salió {formatearImporte(caja.salio)}
        </span>
      </div>
      {caja.mesAnterior != null && (
        <p className="contabilidad-tile__sub" data-testid="contabilidad-caja-mes-anterior">
          Mes anterior: {formatearImporte(caja.mesAnterior.queda)}
        </p>
      )}
    </Surface>
  );
}

function SeccionGastos({ porCategoria }: { porCategoria: ResumenContabilidad['gastos']['porCategoria'] }) {
  // Sobre la suma REAL, no 100 — el contrato avisa que los porcentajes no están garantizados a cerrar.
  const suma = porCategoria.reduce((a, c) => a + c.porcentaje, 0);

  return (
    <Surface variant="tile" className="contabilidad-gastos" data-testid="contabilidad-gastos">
      <p className="contabilidad-tile__etiqueta">En qué se te va la plata</p>
      <div className="contabilidad-gastos__categorias">
        {porCategoria.map((c) => (
          <div key={c.categoria} className="contabilidad-gastos__fila" data-testid={`contabilidad-gastos-cat-${c.categoria}`}>
            <div className="contabilidad-gastos__encabezado">
              <span className="contabilidad-gastos__cat-label">{ETIQUETA_CATEGORIA[c.categoria]}</span>
              <span className="contabilidad-tile__sub">{formatearImporte(c.total)}</span>
            </div>
            <div className="contabilidad-gastos__barra-fondo">
              <div
                className="contabilidad-gastos__barra"
                style={{ width: suma > 0 ? `${(c.porcentaje / suma) * 100}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}

const VARIANTE_SEMAFORO: Record<string, BadgeVariant> = {
  verde: 'ok',
  amarillo: 'warning',
  rojo: 'danger',
};

function SeccionFacturado({ facturado }: { facturado: ResumenContabilidad['facturado'] }) {
  return (
    <Surface variant="tile" className="contabilidad-facturado" data-testid="contabilidad-facturado">
      <p className="contabilidad-tile__etiqueta">Facturado</p>
      <p className="contabilidad-facturado__periodo" data-testid="contabilidad-facturado-periodo">
        {formatearImporte(facturado.periodo)}
      </p>
      <p className="contabilidad-tile__sub" data-testid="contabilidad-facturado-doce-meses">
        Últimos 12 meses: {formatearImporte(facturado.doceMeses)}
      </p>

      {/* Fail-soft: sin escala vigente, `tope` viene `null` y se muestra SOLO el acumulado — nunca
          un tope viejo presentado como vigente. */}
      {facturado.tope != null && (
        <Badge
          variant={VARIANTE_SEMAFORO[facturado.tope.semaforo] ?? 'neutral'}
          className="contabilidad-facturado__tope"
        >
          <span data-testid="contabilidad-facturado-tope">{facturado.tope.porcentaje}% del tope monotributo</span>
        </Badge>
      )}
    </Surface>
  );
}

function SeccionClientes({ clientes }: { clientes: ResumenContabilidad['clientes'] }) {
  return (
    <Surface variant="tile" className="contabilidad-clientes" data-testid="contabilidad-clientes">
      <p className="contabilidad-tile__etiqueta">Mejores clientes</p>
      <div className="contabilidad-clientes__lista">
        {clientes.map((c) => (
          <div key={c.clienteRef} className="contabilidad-clientes__fila" data-testid={`contabilidad-cliente-${c.clienteRef}`}>
            <span className="contabilidad-clientes__nombre">{c.nombre}</span>
            <span className="contabilidad-tile__sub">{formatearImporte(c.total)}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}
