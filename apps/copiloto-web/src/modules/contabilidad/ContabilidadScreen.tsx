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
 * Repintado (Tarea 3, CLAUDE.md §5, cierre del lote α — 7º y último módulo): NO se fusiona con
 * Inteligencia de Negocio (esa propuesta del mockup fuente diverge del repo y quedó fuera del
 * alcance de este repintado — decisión de planificación 2026-09-07). Se aplica la anatomía genérica
 * de función sobre el contenido que ya existía acá, sin plantilla visual 1:1 (el mockup no tiene un
 * bloque propio para esta pantalla porque asume la fusión).
 *
 * Regla de SUPERFICIE citada por planificación al decidir NO fusionar (sigue vigente para esta
 * pantalla sola): **caja y facturado nunca se suman — se dice con superficie, caja en el "bloque"
 * de cifra (`Surface variant="bloque"`, la ÚNICA cifra accionable de la función) y facturado en una
 * card blanca normal (`Surface variant="card"`)**, nunca ambos en el mismo número. Las otras 2
 * secciones (gastos por categoría, mejores clientes) son también reporte de sólo lectura — mismo
 * criterio de superficie que facturado (`card`, no `tile`: `tile` es Surface.tsx §"grid/fila", esto
 * son secciones completas del reporte, no celdas ni filas de lista).
 *
 * Reglas de negocio heredadas 1:1 de mobile (no tocadas por el repintado, ver contrato §2/§4 citado
 * en el port original): caja y facturado NUNCA se suman (una factura emitida no es caja hasta que se
 * cobra); `queda` puede ser negativo y se muestra tal cual. **Sin tinte de peligro dentro del
 * bloque — medido, no por precaución** (corrección de planificación 2026-09-07 a mi primera versión
 * conservadora: "medí los 6 pares antes de sacar el color, no lo saques porque sí"). `--danger-fg`
 * contra `--bloque-cifra-bg` (que invierte polaridad entre pieles) da:
 *   claro    `#b03549` vs `#1A1512` → 2,98:1
 *   oscuro   `#ff8fa0` vs `#F7F3EC` → 1,96:1
 *   nocturno `#ff8fa0` vs `#F7F3EC` → 1,96:1
 * Las 3 pieles fallan incluso el piso de 3:1 (texto grande) — el signo menos queda como única señal
 * en las 3, no sólo por default. Los porcentajes de gastos se normalizan sobre la suma real, no
 * sobre 100; sin escala de monotributo vigente el backend manda `tope: null` y sólo se muestra el
 * acumulado de 12 meses, nunca un tope viejo como si fuera vigente.
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
      {/* Anatomía de función (Tarea 3, CLAUDE.md §5): stack con nombre + período, misma card blanca
          que el bloque de abajo (mismo `--r-xl`) — calcado de `.fn-stack .atras` del mockup, mismos
          valores que `gastos-screen__stack`/`presupuestos-screen__stack` (misma anatomía en toda la
          app). Web no lleva "Volver ‹" (Rail/TabBar propios, contrato "no se toca el modelo de
          capas"). */}
      <header className="contabilidad-screen__stack">
        <span className="contabilidad-screen__nombre-fila">
          <span className="contabilidad-screen__nombre">Contabilidad</span>
          {estado === 'ok' && (
            <Button
              variant="ghost"
              onClick={() => void actualizar()}
              disabled={actualizando}
              data-testid="contabilidad-actualizar"
              className="contabilidad-screen__actualizar"
            >
              {actualizando ? 'Actualizando…' : 'Actualizar'}
            </Button>
          )}
        </span>
        {resumen != null && <span className="contabilidad-screen__periodo">{resumen.periodo}</span>}
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

/**
 * "Bloque" de cifra (gramática Monzo, Tarea 3) — Caja es LA cifra accionable de esta función (regla
 * de superficie citada arriba: nunca se suma con Facturado, que vive aparte en una card blanca).
 * `queda` puede ser negativo — se muestra tal cual, sin tinte de color: medido contra el docstring
 * de cabecera (2,98:1/1,96:1/1,96:1, las 3 pieles bajo el piso de 3:1), no por precaución sin medir.
 * "Entró/Salió" van como el chip de comparación (mismo rol que "Mes anterior" en
 * `gastos`/"N sin contestar" en `presupuestos` — un único chip por bloque); el saldo del mes
 * anterior, si existe, es una segunda línea muda debajo, no un segundo chip.
 */
function SeccionCaja({ caja }: { caja: ResumenContabilidad['caja'] }) {
  return (
    <Surface variant="bloque" className="contabilidad-resumen" data-testid="contabilidad-caja">
      <p className="contabilidad-resumen__label">Caja</p>
      <p className="contabilidad-resumen__total" data-testid="contabilidad-caja-queda">
        {formatearImporte(caja.queda)}
      </p>
      <span className="contabilidad-resumen__chip">
        <span data-testid="contabilidad-caja-entro">Entró {formatearImporte(caja.entro)}</span>
        {' · '}
        <span data-testid="contabilidad-caja-salio">Salió {formatearImporte(caja.salio)}</span>
      </span>
      {caja.mesAnterior != null && (
        <p className="contabilidad-resumen__mes-anterior" data-testid="contabilidad-caja-mes-anterior">
          Mes anterior: {formatearImporte(caja.mesAnterior.queda)}
        </p>
      )}
    </Surface>
  );
}

/**
 * Sección de sólo lectura (Tarea 3): card blanca (`Surface variant="card"`), no `tile` — es una
 * sección completa del reporte, no una fila/celda de lista (Surface.tsx §"tile: grid/fila").
 */
function SeccionGastos({ porCategoria }: { porCategoria: ResumenContabilidad['gastos']['porCategoria'] }) {
  // Sobre la suma REAL, no 100 — el contrato avisa que los porcentajes no están garantizados a cerrar.
  const suma = porCategoria.reduce((a, c) => a + c.porcentaje, 0);

  return (
    <Surface variant="card" className="contabilidad-gastos" data-testid="contabilidad-gastos">
      <p className="contabilidad-seccion__etiqueta">En qué se te va la plata</p>
      <div className="contabilidad-gastos__categorias">
        {porCategoria.map((c) => (
          <div key={c.categoria} className="contabilidad-gastos__fila" data-testid={`contabilidad-gastos-cat-${c.categoria}`}>
            <div className="contabilidad-gastos__encabezado">
              <span className="contabilidad-gastos__cat-label">{ETIQUETA_CATEGORIA[c.categoria]}</span>
              <span className="contabilidad-seccion__sub">{formatearImporte(c.total)}</span>
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

/**
 * Facturado — card blanca, NUNCA el bloque (regla de superficie de cabecera: sumar caja+facturado
 * cuenta la misma plata dos veces; separarlas en dos superficies distintas es cómo se lo comunica
 * sin texto de más).
 */
function SeccionFacturado({ facturado }: { facturado: ResumenContabilidad['facturado'] }) {
  return (
    <Surface variant="card" className="contabilidad-facturado" data-testid="contabilidad-facturado">
      <p className="contabilidad-seccion__etiqueta">Facturado</p>
      <p className="contabilidad-facturado__periodo" data-testid="contabilidad-facturado-periodo">
        {formatearImporte(facturado.periodo)}
      </p>
      <p className="contabilidad-seccion__sub" data-testid="contabilidad-facturado-doce-meses">
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
    <Surface variant="card" className="contabilidad-clientes" data-testid="contabilidad-clientes">
      <p className="contabilidad-seccion__etiqueta">Mejores clientes</p>
      <div className="contabilidad-clientes__lista">
        {clientes.map((c) => (
          <div key={c.clienteRef} className="contabilidad-clientes__fila" data-testid={`contabilidad-cliente-${c.clienteRef}`}>
            <span className="contabilidad-clientes__nombre">{c.nombre}</span>
            <span className="contabilidad-seccion__sub">{formatearImporte(c.total)}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}
