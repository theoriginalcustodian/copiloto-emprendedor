import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  listarGastos,
  obtenerResumenGastos,
  type Gasto,
  type ResumenGastos,
} from '@copiloto/core';

import { FormularioGasto } from './FormularioGasto';
import { ResumenMes } from './ResumenMes';
import { TarjetaGasto } from './TarjetaGasto';
import { FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaGastos` — la función "Gastos" del escritorio: resumen del mes, listado y alta manual, todo
 * en UN solo `MarcoGlass`.
 *
 * 🔴 **Un glass, no una ruta por paso** — mismo criterio que Presupuestos y Facturación, por el mismo
 * motivo ya pagado: apilar modales para un formulario es justo lo que rompió la app (`empujarUnaVez`).
 *
 * 🔴 **Tres disparadores de recarga, y ninguno sobra** (la lección de "Mis comprobantes", donde la
 * lista cargaba al montar y nada más):
 *   1. **al montar**;
 *   2. **al crear** un gasto — el cambio que produjo esta misma pantalla;
 *   3. **al tirar hacia abajo** — el único que cubre lo que cambió AFUERA: el copiloto registrando un
 *      gasto por voz desde el chat, u otro dispositivo. Sin él, el dato viejo se ve idéntico al fresco.
 *
 * 🔴 **El resumen se re-pide junto con el listado, siempre.** Es un agregado del backend: crear un
 * gasto lo cambia, y refrescar sólo la lista dejaría el total del mes desactualizado al lado de la
 * card que acaba de aparecer. Dos números que se contradicen en la misma pantalla destruyen la
 * confianza en el que importa.
 *
 * 🔴 **El resumen NO bloquea la pantalla.** Si el listado responde y el resumen falla, se muestra el
 * listado: son dos endpoints, y tratarlos como uno haría que un fallo del agregado esconda los datos
 * que sí llegaron.
 */

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

type Vista = 'listado' | 'formulario';

export function PantallaGastos() {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [total, setTotal] = useState(0);
  const [resumen, setResumen] = useState<ResumenGastos | null>(null);
  const [vista, setVista] = useState<Vista>('listado');
  const [refrescando, setRefrescando] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  /**
   * `silencioso` = no pasar por `cargando`. Una RE-carga ocurre sobre una lista que el usuario está
   * mirando: mandarla al spinner la haría desaparecer y volver, un parpadeo que sugiere que algo se
   * perdió. La carga inicial sí lo pasa, porque ahí no hay nada que preservar.
   */
  const cargar = useCallback((silencioso = false): Promise<void> => {
    if (!silencioso) setEstado('cargando');
    // Los dos en paralelo: son independientes y encadenarlos duplicaría la espera en un teléfono.
    return Promise.all([listarGastos(), obtenerResumenGastos()])
      .then(([lista, res]) => {
        if (!vivo.current) return;
        if (lista.status === 'no_disponible') {
          setEstado('no_disponible');
          setGastos([]);
          setResumen(null);
          return;
        }
        setGastos(lista.gastos);
        setTotal(lista.total);
        // Un resumen caído NO tumba el listado. `null` = no se muestra la tarjeta, nada más.
        setResumen(res.status === 'ok' ? res.resumen : null);
        setEstado('ok');
      })
      .catch(() => {
        if (vivo.current) setEstado('error');
      });
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    await cargar(true);
    if (vivo.current) setRefrescando(false);
  }

  function alCrear() {
    setVista('listado');
    // Se RELEE en vez de insertar el objeto devuelto: el resumen es un agregado del backend y no se
    // puede recalcular a mano sin volver a hacer aritmética de plata del lado del cliente.
    void cargar(true);
  }

  const hayGastos = gastos.length > 0;

  return (
    <MarcoGlass titulo="Gastos" icono="wallet" testID="pantalla-gastos">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="gastos-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'error' && (
        <View style={styles.centro}>
          <Text testID="gastos-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tus gastos. Tirá hacia abajo para reintentar.
          </Text>
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="gastos-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Los gastos todavía no están disponibles en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && (
        <ScrollFormulario
          testID="gastos-lista"
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="gastos-refresh"
            />
          }
        >
          {vista === 'formulario' ? (
            <FormularioGasto origen="manual" onCreado={alCrear} onCancelar={() => setVista('listado')} />
          ) : (
            <>
              {resumen != null && <ResumenMes resumen={resumen} />}

              <FilaBotones
                testID="gastos-acciones"
                botones={[
                  {
                    etiqueta: 'Anotar un gasto',
                    onPress: () => setVista('formulario'),
                    variante: 'primario',
                    testID: 'gastos-nuevo',
                  },
                ]}
              />

              {!hayGastos && (
                <Text testID="gastos-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
                  Todavía no anotaste ningún gasto. También podés decírselo al copiloto hablando.
                </Text>
              )}

              {gastos.map((g) => (
                <TarjetaGasto key={g.id} gasto={g} />
              ))}

              {/* `total` es el conteo del TENANT, no el de la página: con 50 cards en pantalla y 137
                  gastos, decir "50" sería mentir por omisión. Sólo se muestra si difiere. */}
              {hayGastos && total > gastos.length && (
                <Text testID="gastos-total" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
                  Mostrando {gastos.length} de {total} gastos.
                </Text>
              )}
            </>
          )}
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
