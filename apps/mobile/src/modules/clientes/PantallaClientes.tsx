import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  listarClientes,
  obtenerCliente,
  type Cliente,
  type DuplicadoCliente,
} from '@copiloto/core';

import { FichaCliente } from './FichaCliente';
import { FormularioCliente } from './FormularioCliente';
import { TarjetaCliente } from './TarjetaCliente';
import { CampoTexto, FilaBotones, ScrollFormulario } from '../../theme/glass/campos';
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
 * 🔴 **El alta a mano NO es un extra del alta por voz: es el camino que funciona siempre.** Sin
 * micrófono, sin señal, y sin que el LLM entienda un apellido. Por eso no espera al hito 5.
 *
 * 🔴 **La cartera vacía OFRECE el alta, no sólo informa que no hay nada.** El día 1 no hay facturas de
 * las que derivar: un vacío que sólo informa deja la función nacida muerta — es el mecanismo exacto
 * por el que se abandonó el Sheet de presupuestos.
 *
 * ⚠️ `POST /clientes` respondía **405 medido** cuando se escribió esto (hito 3 de backend sin
 * desplegar). El formulario existe igual porque la forma la fija el contrato y las dos suposiciones
 * del wire están aisladas en `clientes.ts`; si el `POST` no está, el alta degrada con un texto
 * honesto en vez de un error. Lo que NO se puede es declarar esto cerrado sin medirlo.
 *
 * 🔴 **Tres disparadores de recarga**, como en Presupuestos y Gastos: al montar, al cambiar la
 * búsqueda, y el tirón — que es el único que cubre lo que cambió AFUERA (el backfill del backend
 * corriendo, o el copiloto dando de alta por voz).
 */

type EstadoLista = 'cargando' | 'ok' | 'error' | 'no_disponible';

/** Lo que tarda en dispararse la búsqueda desde la última tecla. */
const ESPERA_BUSQUEDA_MS = 350;

/**
 * 🔴 **[CONNECT] Orden alfabético client-side — hasta que el store lo garantice.** El contrato de
 * «Clientes: listado completo, orden alfabético» pide alfabético, pero `GET /clientes` **no declara
 * garantizar el sort** (verificado con planificación: el orden del store está sin confirmar). Se ordena
 * acá para no depender de un orden que el backend no promete. `localeCompare('es', sensitivity:'base')`
 * agrupa como una guía telefónica: ignora mayúsculas y tildes (á junto a a), igual que el `unaccent`
 * con el que el backend busca — así el orden visible y el criterio de búsqueda hablan el mismo idioma.
 *
 * **La costura:** con paginación, esto ordena SÓLO la página cargada, no la cartera entera. El día que
 * el backend garantice `ORDER BY nombre`, se saca este sort (o queda como red de seguridad barata) y el
 * orden es global. Marcado `[CONNECT]` para que ese día sea un punto único.
 */
export function ordenarAlfabetico(clientes: readonly Cliente[]): Cliente[] {
  return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

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
  /** `null` = no hay formulario. `{edita: null}` = alta. `{edita: cliente}` = edición. */
  const [formulario, setFormulario] = useState<{ edita: Cliente | null } | null>(null);
  const [avisoDuplicado, setAvisoDuplicado] = useState<DuplicadoCliente | null>(null);
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

  /**
   * Después de guardar, la cartera tiene que MOSTRARLO. Un listado que sólo carga al montar muestra
   * dato viejo idéntico al fresco: el cliente recién creado no aparecería y el emprendedor lo daría
   * de alta otra vez. Se recarga en silencio (sin el spinner de pantalla completa) porque la lista
   * que ya está en pantalla sigue siendo válida mientras llega la nueva.
   */
  function alGuardar(cliente: Cliente) {
    setFormulario(null);
    setAvisoDuplicado(null);
    void cargar(true);
    // Se abre la ficha del que se acaba de tocar: cierra el bucle "¿se guardó?" con el dato, no con
    // un cartel de éxito que hay que creer.
    setFicha(cliente);
  }

  /**
   * Ese cliente ya existe (§3.4). **No es un error**: se avisa y se ofrece abrir al dueño, cuya ficha
   * viene entera en el `409`. Si no vino nada reconocible, el aviso se da igual — sin el botón:
   * inventar un id llevaría a la ficha equivocada, que es peor que un atajo de menos.
   */
  function alDuplicado(duplicado: DuplicadoCliente) {
    setFormulario(null);
    setAvisoDuplicado(duplicado);
  }

  /**
   * 🔴 **Se nombra al dueño, y por eso el motivo importa.** Decir *"ese documento ya es de X"* a quien
   * **no tipeó ningún documento** —el choque por nombre repetido, que el contrato §7 no listaba— es
   * explicar mal algo que sí pasó: el emprendedor busca un documento que no puso y concluye que la
   * app se equivocó. Sin nombre se cae a lo genérico, que es feo y cierto.
   */
  function textoDuplicado(d: DuplicadoCliente): string {
    const quien = d.dueno?.nombre;
    if (d.por === 'nombre') {
      return quien != null && quien !== ''
        ? `Ya tenés un cliente con ese nombre: ${quien}.`
        : 'Ya tenés un cliente con ese nombre.';
    }
    if (d.por === 'documento') {
      return quien != null && quien !== ''
        ? `Ese documento ya es de ${quien}.`
        : 'Ese documento ya es de un cliente que tenés en la cartera.';
    }
    return quien != null && quien !== ''
      ? `Ese cliente ya está en tu cartera: ${quien}.`
      : 'Ese cliente ya está en tu cartera.';
  }

  async function abrirDueno(id: number) {
    setAvisoDuplicado(null);
    const res = await obtenerCliente(id);
    if (res.status === 'ok' && vivo.current) setFicha(res.ficha.cliente);
  }

  const hayClientes = clientes.length > 0;
  const buscando = busquedaAplicada !== '';
  // Alfabético para MOSTRAR; el conteo («Mostrando X de Y») sigue saliendo de `clientes`/`total`, que
  // el orden no cambia. Ver `ordenarAlfabetico` [CONNECT].
  const clientesOrdenados = ordenarAlfabetico(clientes);

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
          {/* El formulario REEMPLAZA a la lista mientras está abierto: compartir el scroll con veinte
              cards deja los campos lejos del teclado, que acá se dibuja encima y no empuja nada. */}
          {formulario != null ? (
            <FormularioCliente
              edita={formulario.edita}
              onGuardado={alGuardar}
              onDuplicado={alDuplicado}
              onAbrirCliente={(c) => { setFormulario(null); setFicha(c); }}
              onCancelar={() => setFormulario(null)}
            />
          ) : (
            <>
              <FilaBotones
                testID="clientes-acciones"
                botones={[
                  {
                    etiqueta: 'Nuevo cliente',
                    onPress: () => { setAvisoDuplicado(null); setFormulario({ edita: null }); },
                    variante: 'primario',
                    testID: 'clientes-nuevo',
                  },
                ]}
              />

              {avisoDuplicado != null && (
                <View style={{ gap: tema.espacio.sm }} testID="clientes-duplicado">
                  {/* 🔴 En tenue, no en rojo: "ya lo tenés" es un resultado útil, no un fallo. */}
                  <Text
                    testID="clientes-duplicado-texto"
                    style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
                  >
                    {textoDuplicado(avisoDuplicado)}
                  </Text>
                  {avisoDuplicado.dueno != null && (
                    <FilaBotones
                      testID="clientes-duplicado-acciones"
                      compacto
                      botones={[
                        {
                          etiqueta: 'Abrir ese cliente',
                          onPress: () => void abrirDueno((avisoDuplicado.dueno as Cliente).id),
                          testID: 'clientes-duplicado-abrir',
                        },
                      ]}
                    />
                  )}
                </View>
              )}

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
                    : 'Tu cartera se va a armar sola con lo que factures y presupuestes — y mientras tanto podés cargar el primero a mano.'}
                </Text>
              )}

              {clientesOrdenados.map((c) => (
                <TarjetaCliente key={c.id} cliente={c} onPress={setFicha} />
              ))}
            </>
          )}

          {formulario == null && hayClientes && total > clientes.length && (
            <Text testID="clientes-total" style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Mostrando {clientes.length} de {total} clientes.
            </Text>
          )}
        </ScrollFormulario>
      )}

      {/* Fuera del scroll — ver el docstring de `FichaCliente`. */}
      {ficha != null && (
        <FichaCliente
          cliente={ficha}
          onCerrar={() => setFicha(null)}
          onEditar={(c) => { setFicha(null); setFormulario({ edita: c }); }}
        />
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
