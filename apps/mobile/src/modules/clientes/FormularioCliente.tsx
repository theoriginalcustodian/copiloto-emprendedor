import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  ApiError,
  cambiosDeCliente,
  crearCliente,
  editarCliente,
  type Cliente,
  type DatosCliente,
} from '@copiloto/core';

import { CampoSelect, CampoTexto, FilaBotones, type OpcionSelect } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

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
 * 🔴 **El `409` no se pinta en rojo.** Es el resultado útil: el documento ya es de otro cliente. Se
 * dice *"ya lo tenés"* y se ofrece abrirlo. Tratarlo como fallo empujaría a reintentar un alta que
 * nunca va a entrar.
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
  onGuardado: (cliente: Cliente) => void;
  /** Un documento repetido: el dueño ya existe. `duenoId` puede ser `null` (ver `clientes.ts`). */
  onDuplicado: (duenoId: number | null) => void;
  onCancelar: () => void;
  testID?: string;
}

export function FormularioCliente({
  edita = null,
  onGuardado,
  onDuplicado,
  onCancelar,
  testID = 'formulario-cliente',
}: FormularioClienteProps) {
  const tema = useTema();
  const [nombre, setNombre] = useState(edita?.nombre ?? '');
  const [docTipo, setDocTipo] = useState(edita?.docTipo != null ? String(edita.docTipo) : '');
  const [docNro, setDocNro] = useState(edita?.docNro ?? '');
  const [domicilio, setDomicilio] = useState(edita?.domicilio ?? '');
  const [contacto, setContacto] = useState(edita?.contacto ?? '');
  const [notas, setNotas] = useState(edita?.notas ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      contacto: limpio(contacto),
      notas: limpio(notas),
    };
  }

  /** ⛔ Exactamente lo que exige el backend, ni un campo más. Ver el docstring del módulo. */
  const puedeGuardar = nombre.trim() !== '';

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      const datos = loTipeado();
      const res =
        edita != null
          ? await editarCliente(edita.id, cambiosDeCliente(edita, datos))
          : await crearCliente(datos);

      if (res.status === 'no_disponible') {
        setError(
          edita != null
            ? 'Todavía no podemos guardar cambios de clientes en tu copiloto.'
            : 'Todavía no podemos dar de alta clientes en tu copiloto.',
        );
        return;
      }
      if (res.status === 'duplicado') {
        onDuplicado(res.duenoId);
        return;
      }
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
        placeholder="Panadería Los Tilos"
        maxLength={200}
      />

      <CampoSelect
        testID={`${testID}-doc-tipo`}
        etiqueta="Tipo de documento"
        opciones={OPCIONES_DOC}
        valor={docTipo}
        onChange={setDocTipo}
      />
      {docTipo !== '' && (
        <CampoTexto
          testID={`${testID}-doc-nro`}
          etiqueta="Número"
          valor={docNro}
          onChange={setDocNro}
          placeholder="30712345678"
          keyboardType="number-pad"
        />
      )}

      <CampoTexto
        testID={`${testID}-domicilio`}
        etiqueta="Domicilio"
        valor={domicilio}
        onChange={setDomicilio}
        placeholder="Av. Mitre 1234"
        maxLength={200}
      />
      <CampoTexto
        testID={`${testID}-contacto`}
        etiqueta="Contacto (teléfono o mail)"
        valor={contacto}
        onChange={setContacto}
        placeholder="11-5555-4444"
        autoCapitalize="none"
        maxLength={120}
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
