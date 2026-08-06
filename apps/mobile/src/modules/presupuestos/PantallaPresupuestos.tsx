import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listarPresupuestos, obtenerPresupuesto, type Presupuesto } from '@copiloto/core';

import { DetallePresupuesto } from './DetallePresupuesto';
import { FormularioPresupuesto } from './FormularioPresupuesto';
import { TarjetaPresupuesto } from './TarjetaPresupuesto';
import { BuscadorActividad } from '../actividad/BuscadorActividad';
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaPresupuestos` — la función "Presupuestos" del escritorio: listado, alta y detalle, todo en
 * UN solo `MarcoGlass`.
 *
 * 🔴 **Un glass, no una ruta por paso.** Mismo criterio que Facturación, y por el mismo motivo ya
 * pagado: *"apilar 5 modales para un formulario es justo lo que rompió la app"* (`empujarUnaVez`). El
 * alta es una vista de esta pantalla; el detalle es un overlay LOCAL. Ninguno toca el stack.
 *
 * 🔴 **Tres disparadores de recarga, y ninguno sobra** — la lección de "Mis comprobantes", donde la
 * lista cargaba al montar y nada más, y el operador vio hasta la factura N° 15 mientras la 18 ya
 * existía:
 *   1. **al montar** — la primera pintura;
 *   2. **al crear** un presupuesto — el cambio que produjo esta misma pantalla;
 *   3. **al tirar hacia abajo** — y este es el único que cubre lo que cambió AFUERA (el copiloto
 *      creando un presupuesto por chat, u otro dispositivo). Sin él, el dato viejo se ve idéntico al
 *      fresco y no hay forma de que el usuario pida "volvé a preguntar".
 *
 * 🔴 **El listado trae SÓLO los vigentes.** Lo decide el backend (`NOT EXISTS` en SQL), no un filtro
 * de acá: filtrar del lado del cliente con `reemplazadoPor` sería correcto sólo si toda la cadena de
 * reemplazos entrara en la página pedida — una respuesta que a veces acierta. El historial se pide
 * explícito.
 *
 * 🔴 **No conoce `expo-router`.** La navegación a Facturación entra por `onFacturar`, que cablea la
 * ruta — igual que el resto de los módulos, y lo que permite testear esta pantalla sin navegación.
 */

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/** Qué se está mostrando en el cuerpo. El detalle NO entra acá: es un overlay que se superpone. */
type Vista = 'listado' | 'formulario';

export interface PantallaPresupuestosProps {
  /** Id que llegó desde la lista de actividad — abre su detalle al montar. */
  presupuestoIdInicial?: number;
  /**
   * Lleva al gate de confirmación de factura con el borrador ya armado.
   *
   * 🔴 El id que llega es de un **BORRADOR**, no de una factura emitida: `POST .../facturar` no
   * emite. Quien implemente esto tiene que depositar al usuario en el gate que ya existe, nunca
   * emitir por su cuenta.
   */
  onFacturar: (facturaId: string) => void;
}

export function PantallaPresupuestos({ onFacturar, presupuestoIdInicial }: PantallaPresupuestosProps) {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [vista, setVista] = useState<Vista>('listado');
  const [corrigiendo, setCorrigiendo] = useState<Presupuesto | null>(null);
  const [detalle, setDetalle] = useState<Presupuesto | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  /**
   * `silencioso` = no pasar por `cargando`. Una RE-carga ocurre sobre una lista que el usuario está
   * mirando: mandarla al spinner la haría desaparecer y volver, un parpadeo que sugiere que algo se
   * perdió. La carga inicial sí lo pasa, porque ahí no hay nada que preservar.
   */
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

  /**
   * Abrir directo un ítem que llegó por la lista de actividad.
   *
   * 🔴 **Se busca por id, no se confía en la lista.** Quien navega acá sólo trae un número; el objeto
   * puede no estar en la página cargada —o la lista puede estar vieja—. Si no se encuentra, no se
   * abre nada: es preferible a un detalle vacío que parece roto.
   */
  useEffect(() => {
    if (presupuestoIdInicial == null) return;
    let cancelado = false;
    void obtenerPresupuesto(presupuestoIdInicial).then((res) => {
      if (cancelado || !vivo.current) return;
      if (res.status === 'ok') setDetalle(res.presupuesto);
    });
    return () => { cancelado = true; };
  }, [presupuestoIdInicial]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    await cargar(true);
    if (vivo.current) setRefrescando(false);
  }

  function alCrear(nuevo: Presupuesto) {
    setVista('listado');
    setCorrigiendo(null);
    // Se RELEE en vez de insertar el objeto devuelto en la lista local: el alta puede haber
    // reemplazado a otro, y ese otro tiene que DESAPARECER del listado vigente. Insertar a mano
    // dejaría los dos visibles — justo el problema que el filtro del backend resuelve.
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

  return (
    <MarcoGlass titulo="Presupuestos" icono="presupuestos" testID="pantalla-presupuestos">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="presupuestos-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'error' && (
        <View style={styles.centro}>
          <Text testID="presupuestos-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tus presupuestos. Tirá hacia abajo para reintentar.
          </Text>
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="presupuestos-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Los presupuestos todavía no están disponibles en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && (
        <ScrollFormulario
          testID="presupuestos-lista"
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
          refreshControl={
            // El tirón es el ÚNICO disparador que cubre lo que cambió afuera de esta pantalla.
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="presupuestos-refresh"
            />
          }
        >
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
              <FilaBotones
                testID="presupuestos-acciones"
                botones={[
                  {
                    etiqueta: 'Nuevo presupuesto',
                    onPress: () => {
                      setCorrigiendo(null);
                      setVista('formulario');
                    },
                    variante: 'primario',
                    testID: 'presupuestos-nuevo',
                  },
                ]}
              />

              {/* 🔴 Decisión C: la lista rica de presupuestos (con estado, el toggle de historial) NO
                  se toca — la envuelve el buscador. Sin query, se muestra intacta; con query, pega a
                  `/actividad?funcion=presupuestos&q=` y muestra el card uniforme. */}
              <BuscadorActividad funcion="presupuestos" testIDBase="presupuestos-busqueda" placeholder="Buscar un presupuesto">
              {!hayPresupuestos && (
                <Text
                  testID="presupuestos-vacio"
                  style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
                >
                  {verHistorial
                    ? 'No hay presupuestos en el historial.'
                    : 'Todavía no hiciste ningún presupuesto. También podés pedírselo al copiloto por chat.'}
                </Text>
              )}

              {presupuestos.map((p) => (
                <TarjetaPresupuesto key={p.id} presupuesto={p} onPress={setDetalle} />
              ))}

              {/* El historial existe porque corregir un presupuesto lo saca del listado vigente, y el
                  emprendedor puede necesitar el que ya le mandó a su cliente. */}
              <FilaBotones
                compacto
                testID="presupuestos-historial-botones"
                botones={[
                  {
                    etiqueta: verHistorial ? 'Ver sólo los vigentes' : 'Ver también los reemplazados',
                    onPress: () => setVerHistorial((v) => !v),
                    testID: 'presupuestos-toggle-historial',
                  },
                ]}
              />
              </BuscadorActividad>
            </>
          )}
        </ScrollFormulario>
      )}

      {/* 🔴 El detalle se monta ACÁ, fuera del scroll, y no dentro de la lista. Un overlay
          `position:absolute` montado dentro del área scrolleable se posiciona contra el CONTENIDO del
          scroll —que con veinte cards mide miles de píxeles— y queda centrado lejísimos de lo que el
          usuario está viendo: se monta, existe, responde, y simplemente está fuera de cuadro.
          Verificado en device el 2026-07-21 con el detalle de comprobantes. */}
      {detalle != null && (
        <DetallePresupuesto
          presupuesto={detalle}
          onCerrar={() => setDetalle(null)}
          onFacturar={facturarDesdeDetalle}
          onCorregir={abrirCorreccion}
          // El estado cambió en la hoja: se pisa la fila de la lista de atrás con lo que devolvió el
          // backend. Sin esto, cerrar el detalle deja el listado mostrando el estado anterior —
          // idéntico a que la acción no hubiera surtido efecto, y el emprendedor la repite.
          onEstadoCambiado={(actualizado) => {
            setPresupuestos((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)));
            setDetalle(actualizado);
          }}
        />
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
