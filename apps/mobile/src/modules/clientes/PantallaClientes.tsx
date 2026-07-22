import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listarClientes, obtenerCliente, type Cliente } from '@copiloto/core';

import { FichaCliente } from './FichaCliente';
import { TarjetaCliente } from './TarjetaCliente';
import { CampoTexto, ScrollFormulario } from '../../theme/glass/campos';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaClientes` — la cartera: listado, búsqueda y ficha, todo en UN `MarcoGlass`.
 *
 * 🔴 **La búsqueda la hace el BACKEND, no un `filter` local.** Ignora tildes y mayúsculas del lado del
 * servidor (`unaccent`), y con paginación un filtro local sólo miraría la página cargada: buscar
 * *"panaderia"* devolvería vacío mientras el cliente existe en la página 2. Una respuesta que a veces
 * acierta es peor que uno que siempre pregunta.
 *
 * 🔴 **La búsqueda espera a que el usuario deje de tipear** (350 ms). Sin eso, "panaderia" son nueve
 * peticiones, y las respuestas pueden llegar desordenadas: la de "pan" llegando después de la de
 * "panaderia" pisaría el resultado bueno con uno viejo. El `debounce` no es sólo ahorro de red — es
 * lo que evita que la lista muestre el resultado de una búsqueda que el usuario ya abandonó.
 *
 * 🔴 **Sin alta todavía, y a propósito.** `POST /clientes` responde **405** (medido el 2026-07-22): el
 * alta es el hito 3 del backend y no está desplegada. Un botón "Nuevo cliente" que abre un formulario
 * y falla al guardar es peor que no tenerlo — y escribir el request contra una forma no medida sería
 * adivinarla. Entra cuando baje su `avance_`.
 *
 * 🔴 **Tres disparadores de recarga**, como en Presupuestos y Gastos: al montar, al cambiar la
 * búsqueda, y el tirón — que es el único que cubre lo que cambió AFUERA (el backfill del backend
 * corriendo, o el copiloto dando de alta por voz).
 */

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/** Lo que tarda en dispararse la búsqueda desde la última tecla. */
const ESPERA_BUSQUEDA_MS = 350;

export interface PantallaClientesProps {
  /** Id que llegó desde la lista de actividad — abre su ficha al montar. */
  clienteIdInicial?: number;
}

export function PantallaClientes({ clienteIdInicial }: PantallaClientesProps = {}) {
  const tema = useTema();
  const [estado, setEstado] = useState<EstadoLista>('cargando');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [refrescando, setRefrescando] = useState(false);
  const [ficha, setFicha] = useState<Cliente | null>(null);
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  // El debounce: sólo cuando pasan `ESPERA_BUSQUEDA_MS` sin teclas, la búsqueda se "aplica".
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargar = useCallback(
    (silencioso = false): Promise<void> => {
      if (!silencioso) setEstado('cargando');
      return listarClientes(busquedaAplicada !== '' ? { q: busquedaAplicada } : {})
        .then((res) => {
          if (!vivo.current) return;
          if (res.status === 'no_disponible') {
            setEstado('no_disponible');
            setClientes([]);
            return;
          }
          setClientes(res.clientes);
          setTotal(res.total);
          setEstado('ok');
        })
        .catch(() => {
          if (vivo.current) setEstado('error');
        });
    },
    [busquedaAplicada],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /**
   * Abrir directo un ítem que llegó por la lista de actividad.
   *
   * 🔴 **Se busca por id, no se confía en la lista.** Quien navega acá sólo trae un número; el objeto
   * puede no estar en la página cargada —o la lista puede estar vieja—. Si no se encuentra, no se
   * abre nada y la pantalla queda en su listado: es preferible a un detalle vacío que parece roto.
   */
  useEffect(() => {
    if (clienteIdInicial == null) return;
    let cancelado = false;
    void obtenerCliente(clienteIdInicial).then((res) => {
      if (cancelado || !vivo.current) return;
      if (res.status === 'ok') setFicha(res.ficha.cliente);
    });
    return () => { cancelado = true; };
  }, [clienteIdInicial]);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    await cargar(true);
    if (vivo.current) setRefrescando(false);
  }

  const hayClientes = clientes.length > 0;
  const buscando = busquedaAplicada !== '';

  return (
    <MarcoGlass titulo="Clientes" icono="user" testID="pantalla-clientes">
      {estado === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="clientes-cargando" color={tema.color.acento} />
        </View>
      )}

      {estado === 'error' && (
        <View style={styles.centro}>
          <Text testID="clientes-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tu cartera. Tirá hacia abajo para reintentar.
          </Text>
        </View>
      )}

      {estado === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="clientes-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Tus clientes todavía no están disponibles en tu copiloto.
          </Text>
        </View>
      )}

      {estado === 'ok' && (
        <ScrollFormulario
          testID="clientes-lista"
          contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.md, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => void tirarParaRefrescar()}
              tintColor={tema.color.acento}
              colors={[tema.color.acento]}
              testID="clientes-refresh"
            />
          }
        >
          <CampoTexto
            etiqueta="Buscar"
            valor={busqueda}
            onChange={setBusqueda}
            placeholder="Nombre del cliente"
            autoCapitalize="none"
            testID="clientes-buscar"
          />

          {!hayClientes && (
            <Text testID="clientes-vacio" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
              {buscando
                ? 'No encontramos ningún cliente con ese nombre.'
                : 'Tu cartera se va a armar sola con lo que factures y presupuestes.'}
            </Text>
          )}

          {clientes.map((c) => (
            <TarjetaCliente key={c.id} cliente={c} onPress={setFicha} />
          ))}

          {hayClientes && total > clientes.length && (
            <Text testID="clientes-total" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Mostrando {clientes.length} de {total} clientes.
            </Text>
          )}
        </ScrollFormulario>
      )}

      {/* Fuera del scroll — ver el docstring de `FichaCliente`. */}
      {ficha != null && <FichaCliente cliente={ficha} onCerrar={() => setFicha(null)} />}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
