import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import {
  ApiError,
  cambiosDeCliente,
  crearCliente,
  editarCliente,
  type Cliente,
  type DatosCliente,
  type DuplicadoCliente,
} from '@copiloto/core';

import { CampoSelect, CampoTexto, FilaBotones, type OpcionSelect } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';
import { generarId } from '../../util/id';

/**
 * `FormularioCliente` — el alta a mano y la edición, que son **el mismo formulario**.
 *
 * Contrato §6.bis (addendum del 2026-07-22). El alta manual existía en la prosa del contrato desde el
 * principio y **faltaba en la tabla de hitos**, que es lo único que las sesiones ejecutan; por eso
 * llegó tarde. La lección la escribió planificación y vale repetirla acá: *una responsabilidad
 * escrita en la prosa y ausente de la tabla no existe*.
 *
 * 🔴 **Sólo `nombre` es obligatorio, y no es una comodidad: es una regla dura.** Pedir el CUIT para
 * dejar guardar traba el caso más común —el cliente de mostrador del que sólo se sabe el nombre— **y
 * esconde bugs de las dos capas**, porque el formulario nunca llega a mandar el body que el backend
 * rechazaría: un desacuerdo entre ambos no da síntoma hasta que alguien pega por HTTP.
 *
 * 🔴 **`doc_tipo` NUNCA vale 99 en un cliente**, así que "Sin identificar" no está entre las opciones:
 * acá el 99 sería un *cliente* consumidor final, que es justo el registro fantasma que el contrato
 * §3.2 existe para evitar. Sin documento se manda `null`, que significa "no lo sé" — distinto de "no
 * tiene". (En `FormularioPresupuesto` el 99 SÍ es una opción legítima: ahí es el receptor de un
 * comprobante, no una fila de la cartera.)
 *
 * 🔴 **Editando, se manda SÓLO lo que cambió** (`cambiosDeCliente`). `POST /clientes/{id}` es parcial:
 * mandar el objeto entero con los campos vacíos **borra** lo que había — incluido el domicilio que
 * vino de las facturas de AFIP, que el emprendedor nunca tipeó y no sabe que puede perder. Ese bug se
 * ve idéntico a un guardado exitoso.
 *
 * 🔴 **El `409` no se pinta en rojo, y tiene DOS caras que no se resuelven igual.**
 *
 * - `por: "documento"` → es **el mismo cliente**. No hay nada que decidir: *"ya lo tenés"* y se lo
 *   lleva a su ficha. Lo maneja la pantalla, porque lo tipeado acá ya no sirve.
 * - `por: "nombre"` → **es una pregunta, y sólo el emprendedor la puede responder.** Dos clientes
 *   pueden llamarse igual de verdad (dos «Juan Pérez», dos «Kiosco»). Se queda **acá**, con lo
 *   tipeado intacto, y se ofrecen las dos salidas: abrir al homónimo, o crearlo igual con `forzar`.
 *
 * **Tratarlos igual es peor que el error, porque parece que funcionó:** el emprendedor se va creyendo
 * que cargó a su cliente cuando está mirando a otro. Y cerrar el formulario en el caso del nombre lo
 * dejaría sin ninguna maniobra —le pedimos un CUIT que no tiene— justo después de haber escrito que
 * exigir el documento traba el caso más común.
 *
 * El teclado ya está resuelto por la cáscara: este formulario vive dentro del `ScrollFormulario` de
 * `PantallaClientes` (revela el campo enfocado) + el `KeyboardAvoidingView` de `MarcoGlass`. Un
 * formulario del glass **no redimensiona**: el teclado se dibuja encima y además mata el scroll.
 */

/** 🔴 Sin el 99 a propósito — ver el docstring. */
const OPCIONES_DOC: OpcionSelect[] = [
  { valor: '', etiqueta: 'Sin documento' },
  { valor: '96', etiqueta: 'DNI' },
  { valor: '80', etiqueta: 'CUIT' },
];

export interface FormularioClienteProps {
  /** Si viene, es una edición: arranca con sus datos y manda sólo el diff. */
  edita?: Cliente | null;
  /**
   * Valores de arranque para un ALTA (no una edición): lo que el copiloto entendió de un dictado.
   *
   * 🔴 **Existe para que la card de voz reuse ESTE formulario y no uno propio.** Dos formularios
   * divergen: el de voz se queda sin algún campo que el manual sí tiene, y el emprendedor no puede
   * corregir justo ése. Mismo criterio que `FormularioGasto`.
   *
   * Su `origen` viaja al crear (`voz`), y por eso no se pisa acá.
   */
  iniciales?: DatosCliente | null;
  onGuardado: (cliente: Cliente) => void;
  /**
   * Choque por **documento**: es el mismo cliente y acá ya no hay nada que hacer — lo tipeado no
   * sirve. La pantalla avisa y ofrece abrirlo.
   */
  onDuplicado: (duplicado: DuplicadoCliente) => void;
  /**
   * El emprendedor eligió **abrir al homónimo**. Va directo a su ficha: ya leyó el aviso y ya decidió,
   * así que volver a mostrarle el mismo cartel con un botón sería un toque de más sobre algo resuelto.
   */
  onAbrirCliente: (cliente: Cliente) => void;
  onCancelar: () => void;
  testID?: string;
}

export function FormularioCliente({
  edita = null,
  iniciales = null,
  onGuardado,
  onDuplicado,
  onAbrirCliente,
  onCancelar,
  testID = 'formulario-cliente',
}: FormularioClienteProps) {
  const tema = useTema();
  // `edita` manda si está; si no, los `iniciales` del dictado; si no, vacío.
  const base = edita ?? iniciales;
  const [nombre, setNombre] = useState(base?.nombre ?? '');
  const [docTipo, setDocTipo] = useState(base?.docTipo != null ? String(base.docTipo) : '');
  const [docNro, setDocNro] = useState(base?.docNro ?? '');
  const [domicilio, setDomicilio] = useState(base?.domicilio ?? '');
  const [email, setEmail] = useState(base?.email ?? '');
  const [telefono, setTelefono] = useState(base?.telefono ?? '');
  const [notas, setNotas] = useState(base?.notas ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Choque por NOMBRE sin resolver: se queda acá, con lo tipeado, hasta que el humano decida. */
  const [homonimo, setHomonimo] = useState<DuplicadoCliente | null>(null);

  /**
   * 🔴 **La clave de idempotencia del ALTA — se guarda entre reintentos, se tira sólo cuando entró.**
   * Mismo patrón que `SeccionCobro.tsx`: si la red se corta después de que el backend ya creó el
   * cliente, el emprendedor ve un error y vuelve a tocar "Dar de alta". Con una clave nueva por toque
   * eso deja dos clientes idénticos; con la misma clave el backend devuelve el que ya existe. Sigue
   * siendo LA MISMA clave a través del paso "es otro, crearlo igual" (`forzar`): es el mismo gesto de
   * alta confirmado, no uno nuevo. Nunca se usa en la edición — `editarCliente` es PATCH parcial,
   * reintentar el mismo diff ya es seguro sin ella.
   */
  const claveAlta = useRef<string | null>(null);

  /**
   * Lo tipeado, en la forma del contrato. Un campo vacío viaja como `null` ("no lo sé"), no como `""`:
   * el string vacío es un dato afirmado, y `doc_nro: ""` haría que la deduplicación por documento lo
   * trate distinto de "sin documento" (ver los índices parciales de §3.3).
   */
  function loTipeado(): DatosCliente {
    const limpio = (v: string) => (v.trim() === '' ? null : v.trim());
    return {
      nombre: nombre.trim(),
      docTipo: docTipo === '' ? null : Number(docTipo),
      // Sin tipo de documento no hay número: mandar uno suelto sería un dato que nadie puede leer.
      docNro: docTipo === '' ? null : limpio(docNro),
      domicilio: limpio(domicilio),
      email: limpio(email),
      telefono: limpio(telefono),
      notas: limpio(notas),
      // Sólo al crear, y sólo si vino: en la edición el backend lo ignora y `cambiosDeCliente` no lo
      // emite. Es lo que después responde "¿la cartera se armó sola o la cargaron?".
      ...(edita == null && iniciales?.origen != null ? { origen: iniciales.origen } : {}),
    };
  }

  /**
   * 🔴 **No afirma el motivo cuando no lo sabe.** Con `por: "nombre"` medido se puede decir *"se llama
   * X"*; con un `por` ilegible, decirlo sería inventar la causa de algo que sí pasó — el mismo error
   * que evitamos del otro lado al no hablar de documentos a quien no tipeó ninguno. Genérico y cierto
   * le gana a específico y quizás falso.
   */
  function textoHomonimo(d: DuplicadoCliente): string {
    const quien = d.dueno?.nombre;
    const tieneNombre = quien != null && quien !== '';
    if (d.por === 'nombre') {
      return tieneNombre ? `Ya tenés un cliente que se llama ${quien}.` : 'Ya tenés un cliente con ese nombre.';
    }
    return tieneNombre ? `Ya tenés un cliente parecido: ${quien}.` : 'Ya tenés un cliente parecido en la cartera.';
  }

  /**
   * 🔴 **Van a quedar dos filas idénticas en la cartera.** Al forzar un homónimo justo después del
   * 409 —que es cuando pasa— lo normal es tener sólo el nombre cargado, y entonces los dos clientes
   * quedan **indistinguibles en la lista**: el emprendedor no puede elegir a cuál facturarle.
   *
   * ⛔ **Avisa, no bloquea.** Exigir un dato para poder forzar sería el tapón que este formulario
   * existe para no tener: quizá de verdad no sabe nada más todavía. Pero éste es **el único momento
   * en que alguien sabe en qué se diferencian** — después, nadie va a volver a la ficha a completarlo.
   */
  const quedaraIndistinguible =
    homonimo != null &&
    [docNro, domicilio, email, telefono, notas].every((v) => v.trim() === '');

  /** ⛔ Exactamente lo que exige el backend, ni un campo más. Ver el docstring del módulo. */
  const puedeGuardar = nombre.trim() !== '';

  async function guardar(forzar = false) {
    setEnviando(true);
    setError(null);
    try {
      const datos = loTipeado();
      let res;
      if (edita != null) {
        res = await editarCliente(edita.id, cambiosDeCliente(edita, datos), forzar ? { forzar: true } : undefined);
      } else {
        // Se asigna una sola vez por gesto de alta: si ya hay una clave en vuelo (este es un
        // reintento, o el paso "forzar" tras el 409), se reusa la misma.
        if (claveAlta.current === null) claveAlta.current = generarId();
        res = await crearCliente(datos, { ...(forzar ? { forzar: true } : {}), idemKey: claveAlta.current });
      }

      if (res.status === 'no_disponible') {
        setError(
          edita != null
            ? 'Todavía no podemos guardar cambios de clientes en tu copiloto.'
            : 'Todavía no podemos dar de alta clientes en tu copiloto.',
        );
        return;
      }
      if (res.status === 'duplicado') {
        // El choque por nombre NO sale de acá: es una pregunta, y cerrar el formulario le borraría al
        // emprendedor lo que escribió sin darle ninguna salida. La clave NO se tira: "crear igual" es
        // el mismo gesto, no uno nuevo.
        if (res.duplicado.por !== 'documento') {
          setHomonimo(res.duplicado);
          return;
        }
        // Terminal: el gesto de alta termina acá (se redirige al dueño), la clave ya cumplió su rol.
        claveAlta.current = null;
        onDuplicado(res.duplicado);
        return;
      }
      claveAlta.current = null;
      setHomonimo(null);
      onGuardado(res.cliente);
    } catch (e) {
      // El `detail` del backend explica qué campo falló mejor que cualquier texto nuestro.
      setError(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar el cliente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View testID={testID} style={{ gap: tema.espacio.md }}>
      <Text
        testID={`${testID}-titulo`}
        style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}
      >
        {edita != null ? `Editar ${edita.nombre}` : 'Nuevo cliente'}
      </Text>

      <CampoTexto
        testID={`${testID}-nombre`}
        etiqueta="Nombre"
        valor={nombre}
        onChange={setNombre}
        placeholder="ej.: Panadería Los Tilos"
        maxLength={200}
      />

      <CampoSelect
        testID={`${testID}-doc-tipo`}
        etiqueta="Tipo de documento"
        opciones={OPCIONES_DOC}
        valor={docTipo}
        onChange={setDocTipo}
      />
      {/* 🔴 También se muestra SIN tipo, si hay un número cargado. Es el caso que llega dictado: el
          backend manda `doc_nro` con `doc_tipo: null` **a propósito** cuando el dictado no da 11 ni
          7-8 dígitos, para que el emprendedor lo corrija. Con la condición sólo por tipo, ese número
          no se pintaba y `loTipeado` lo mandaba en `null`: el dato desaparecía de la pantalla Y del
          body, sin que nada fallara. */}
      {(docTipo !== '' || docNro.trim() !== '') && (
        <CampoTexto
          testID={`${testID}-doc-nro`}
          etiqueta="Número"
          valor={docNro}
          onChange={setDocNro}
          placeholder="ej.: 30712345678"
          keyboardType="number-pad"
        />
      )}
      {/* ⛔ Avisa, no bloquea — mismo criterio que el homónimo. Sin esto, elegir "Sin documento" con
          un número escrito lo tira en silencio, que se ve igual que un guardado bueno. */}
      {docTipo === '' && docNro.trim() !== '' && (
        <Text
          testID={`${testID}-doc-sin-tipo`}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Elegí si ese número es DNI o CUIT — si no, no lo vamos a poder guardar.
        </Text>
      )}

      <CampoTexto
        testID={`${testID}-domicilio`}
        etiqueta="Domicilio"
        valor={domicilio}
        onChange={setDomicilio}
        placeholder="ej.: Av. Mitre 1234"
        maxLength={200}
      />
      {/* 🔴 DOS campos, no uno de texto libre — y el teclado por tipo no es un mimo: es la diferencia
          entre cargar un teléfono en dos segundos o en diez. ⛔ Ninguno valida formato: el campo es
          opcional, así que una validación sólo se dispara con quien empezó a escribir y se arrepintió
          a medias. Un mail mal escrito se descubre MANDANDO, con el error real de vuelta. */}
      <CampoTexto
        testID={`${testID}-email`}
        etiqueta="Email"
        valor={email}
        onChange={setEmail}
        placeholder="ej.: panaderia@gmail.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={120}
      />
      <CampoTexto
        testID={`${testID}-telefono`}
        etiqueta="Teléfono"
        valor={telefono}
        onChange={setTelefono}
        placeholder="ej.: 11-5555-4444"
        keyboardType="phone-pad"
        maxLength={60}
      />
      <CampoTexto
        testID={`${testID}-notas`}
        etiqueta="Notas"
        valor={notas}
        onChange={setNotas}
        placeholder="Lo que quieras recordar de este cliente"
        maxLength={500}
      />

      {error != null && (
        <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {error}
        </Text>
      )}

      {/* 🔴 En tenue, no en rojo: no es un fallo, es una pregunta. Y las dos salidas están las dos —
          si las únicas fueran "abrí el otro" o "cancelá", el emprendedor entró a cargar un cliente y
          se va sin haber cargado nada, sin entender por qué. */}
      {homonimo != null && (
        <View style={{ gap: tema.espacio.sm }} testID={`${testID}-homonimo`}>
          <Text
            testID={`${testID}-homonimo-texto`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
          >
            {textoHomonimo(homonimo)}
          </Text>
          {quedaraIndistinguible && (
            <Text
              testID={`${testID}-homonimo-sin-datos`}
              style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
            >
              Si lo creás así, van a quedar dos clientes iguales en tu cartera. Agregale un teléfono,
              un domicilio o una nota y los vas a poder distinguir.
            </Text>
          )}

          <FilaBotones
            compacto
            testID={`${testID}-homonimo-acciones`}
            botones={[
              {
                // Reenvía EXACTAMENTE lo mismo, con la confirmación del humano. Nada se re-tipea.
                etiqueta: 'Es otro, crearlo igual',
                onPress: () => void guardar(true),
                variante: 'primario',
                deshabilitado: enviando,
                testID: `${testID}-homonimo-forzar`,
              },
              ...(homonimo.dueno != null
                ? [
                    {
                      etiqueta: 'Abrir ese',
                      onPress: () => onAbrirCliente(homonimo.dueno as Cliente),
                      testID: `${testID}-homonimo-abrir`,
                    },
                  ]
                : []),
            ]}
          />
        </View>
      )}

      <FilaBotones
        testID={`${testID}-botones`}
        botones={[
          {
            etiqueta: enviando ? 'Guardando…' : edita != null ? 'Guardar cambios' : 'Dar de alta',
            onPress: () => void guardar(),
            variante: 'primario',
            deshabilitado: !puedeGuardar || enviando,
            testID: `${testID}-guardar`,
          },
          { etiqueta: 'Cancelar', onPress: onCancelar, testID: `${testID}-cancelar` },
        ]}
      />
    </View>
  );
}
