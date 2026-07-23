import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { listarActividad, type ActividadItem } from '@copiloto/core';

import { FilaActividad } from './FilaActividad';
import { CampoTexto } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `BuscadorActividad` — el buscador **dentro de una función** (Gastos/Ingresos/Presupuestos/Facturación),
 * decisión C de planificación: la lista RICA de cada glass NO se toca; el buscador es una sección
 * aparte que pega a `/actividad?funcion=X&q=` y muestra el card **uniforme** (`FilaActividad`), donde
 * mezclar tipos no aplica pero la búsqueda cross-operación sí.
 *
 * 🔴 **Sección in-scroll, no una `FlatList`** — a propósito. La lista rica del glass vive dentro de un
 * `ScrollFormulario` (un `ScrollView`), y anidar una `FlatList` adentro rompe el scroll ("Virtualized
 * Lists should never be nested"). Los resultados de búsqueda se pintan como filas mapeadas (primera
 * página); si hay más, se avisa y se pide refinar, en vez de scroll infinito que acá no hace falta —
 * una búsqueda se estrecha, no se pagina. Mismo criterio que el buscador de Clientes (in-scroll,
 * reemplaza la lista mientras hay query), la única diferencia es que Clientes re-consulta su MISMO
 * endpoint y acá el buscador pega a `/actividad` (la lista rica sigue siendo la de `/gastos`, etc.).
 *
 * 🔴 **Debounce 350 ms + guarda de respuestas fuera de orden.** Sin esperar a que el usuario deje de
 * tipear, "nafta" son cinco búsquedas, y la de "naf" puede llegar DESPUÉS de la de "nafta" y pisar el
 * resultado bueno con uno viejo. El `cancelado` del cleanup del efecto descarta toda respuesta de una
 * query que el usuario ya abandonó — el mismo bug que el debounce de Clientes documenta.
 *
 * Cuando NO hay query, renderiza `children` tal cual: la lista rica del glass, intacta.
 */

const ESPERA_BUSQUEDA_MS = 350;

type EstadoBusqueda = 'buscando' | 'ok' | 'error' | 'no_disponible';

export interface BuscadorActividadProps {
  /** `facturacion | gastos | ingresos | presupuestos` — acota el feed a esta función. */
  funcion: string;
  /** Prefijo de los `testID` del buscador (`${base}-input`, `-buscando`, `-vacio`, `-error`, …). */
  testIDBase: string;
  /** La lista RICA del glass — se muestra cuando NO hay query. */
  children: ReactNode;
  placeholder?: string;
  /** Tocar un resultado. Ausente = las filas no son tocables (ver `FilaActividad`). */
  onAbrirItem?: (item: ActividadItem) => void;
}

/** Primera página de resultados; un `cursor` no nulo significa que hay más y conviene refinar. */
const LIMITE_BUSQUEDA = 20;

export function BuscadorActividad({
  funcion,
  testIDBase,
  children,
  placeholder = 'Buscar en tus operaciones',
  onAbrirItem,
}: BuscadorActividadProps) {
  const tema = useTema();
  const [texto, setTexto] = useState('');
  const [aplicada, setAplicada] = useState('');
  const [items, setItems] = useState<ActividadItem[]>([]);
  const [hayMas, setHayMas] = useState(false);
  const [estado, setEstado] = useState<EstadoBusqueda>('buscando');
  const vivo = useRef(true);
  useEffect(() => () => { vivo.current = false; }, []);

  // El debounce: la query se "aplica" sólo cuando pasan `ESPERA_BUSQUEDA_MS` sin teclas.
  useEffect(() => {
    const t = setTimeout(() => setAplicada(texto.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    if (aplicada === '') return;
    let cancelado = false;
    setEstado('buscando');
    listarActividad({ funcion, q: aplicada, limit: LIMITE_BUSQUEDA })
      .then((res) => {
        // `cancelado` descarta la respuesta de una query ya superada (el usuario siguió tipeando);
        // `vivo` descarta la de una pantalla ya cerrada.
        if (cancelado || !vivo.current) return;
        if (res.status === 'no_disponible') {
          setEstado('no_disponible');
          setItems([]);
          setHayMas(false);
          return;
        }
        setItems(res.items);
        setHayMas(res.cursor != null);
        setEstado('ok');
      })
      .catch(() => {
        if (!cancelado && vivo.current) setEstado('error');
      });
    return () => { cancelado = true; };
  }, [funcion, aplicada]);

  const buscando = aplicada !== '';

  return (
    <View style={styles.contenedor}>
      <CampoTexto
        etiqueta="Buscar"
        valor={texto}
        onChange={setTexto}
        placeholder={placeholder}
        autoCapitalize="none"
        testID={testIDBase}
      />

      {!buscando && children}

      {buscando && estado === 'buscando' && (
        <ActivityIndicator testID={`${testIDBase}-buscando`} color={tema.color.acento} />
      )}

      {buscando && estado === 'error' && (
        <Text testID={`${testIDBase}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          No pudimos buscar. Probá de nuevo en un momento.
        </Text>
      )}

      {buscando && estado === 'no_disponible' && (
        <Text testID={`${testIDBase}-no-disponible`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          La búsqueda todavía no está disponible en tu copiloto.
        </Text>
      )}

      {buscando && estado === 'ok' && items.length === 0 && (
        <Text testID={`${testIDBase}-vacio`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          No encontramos ninguna operación con ese texto.
        </Text>
      )}

      {buscando && estado === 'ok' && items.length > 0 && (
        <View style={{ gap: tema.espacio.sm }} testID={`${testIDBase}-resultados`}>
          {items.map((it) => (
            <FilaActividad key={it.id} item={it} onPress={onAbrirItem} />
          ))}
          {/* Primera página nada más: si el backend dice que hay más (`cursor` no nulo), se pide
              refinar en vez de paginar — una búsqueda se estrecha, no se scrollea. */}
          {hayMas && (
            <Text testID={`${testIDBase}-hay-mas`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Hay más resultados. Escribí un poco más para afinar la búsqueda.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 12 },
});
