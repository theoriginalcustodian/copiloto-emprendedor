import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  ApiError,
  CATEGORIAS_GASTO,
  crearGasto,
  ETIQUETA_CATEGORIA,
  esDecimalPositivo,
  normalizarDecimal,
  type CategoriaGasto,
  type Gasto,
  type OrigenGasto,
} from '@copiloto/core';

import { CampoNumero, CampoSelect, CampoTexto, FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `FormularioGasto` — el alta manual, y **también** la card editable de la voz (§5 del contrato):
 * son el mismo formulario con distintos valores iniciales y distinto `origen`.
 *
 * 🔴 **Un solo componente para las dos puertas, a propósito.** La card de confirmación por voz tiene
 * que dejar **editar todos los campos** —"repetir un dictado es más tedioso que haber tipeado, y es
 * donde se abandona la función"—, o sea que es un formulario completo con valores pre-cargados. Dos
 * componentes distintos divergirían: el de voz se quedaría sin algún campo que el manual sí tiene, y
 * el emprendedor no podría corregir justo eso.
 *
 * 🔴 **Sólo el monto es obligatorio, y la validación de la app exige EXACTAMENTE eso — ni un campo
 * más.** Exigir de más traba el caso más común y, peor, **esconde bugs de las dos capas**: si la app
 * nunca deja mandar un body sin proveedor, nadie se entera de que el backend lo rechazaba mal.
 *
 * 🔴 **`fecha` no se manda si el usuario no la tocó.** Omitirla es lo que deja que el backend ponga
 * "hoy en Argentina"; calcularla acá con `new Date().toISOString()` daría el día siguiente después de
 * las 21:00 ART y movería el gasto de mes los días 30 y 31 — justo en el resumen.
 */

export interface ValoresInicialesGasto {
  monto?: string;
  categoria?: CategoriaGasto;
  proveedor?: string;
  medioPago?: string;
  descripcion?: string;
  fecha?: string;
  /** Lo que leyó el OCR, para poder medir su precisión después. Ver `Gasto.montoSugerido`. */
  montoSugerido?: string;
}

export interface FormularioGastoProps {
  /** `'manual'` en el alta; `'voz'` o `'foto'` cuando confirma algo que propuso el copiloto. */
  origen: OrigenGasto;
  iniciales?: ValoresInicialesGasto;
  onCreado: (gasto: Gasto) => void;
  onCancelar: () => void;
  testID?: string;
}

export function FormularioGasto({
  origen,
  iniciales,
  onCreado,
  onCancelar,
  testID = 'formulario-gasto',
}: FormularioGastoProps) {
  const tema = useTema();
  const [monto, setMonto] = useState(iniciales?.monto ?? '');
  const [categoria, setCategoria] = useState<CategoriaGasto>(iniciales?.categoria ?? 'otros');
  const [proveedor, setProveedor] = useState(iniciales?.proveedor ?? '');
  const [medioPago, setMedioPago] = useState(iniciales?.medioPago ?? '');
  const [descripcion, setDescripcion] = useState(iniciales?.descripcion ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El backend rechaza monto ausente, cero, negativo o no numérico con 400 (medido). Esta condición
  // es la MISMA, no una más estricta: si divergen, la app traba altas que el backend aceptaría.
  const puedeGuardar = esDecimalPositivo(monto) && !guardando;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await crearGasto({
        monto: normalizarDecimal(monto),
        origen,
        categoria,
        // Los opcionales vacíos NO se mandan: mandar `""` guardaría un proveedor vacío en vez de
        // dejarlo nulo, y después el listado mostraría una card con título en blanco.
        ...(proveedor.trim() !== '' ? { proveedor: proveedor.trim() } : {}),
        ...(medioPago.trim() !== '' ? { medioPago: medioPago.trim() } : {}),
        ...(descripcion.trim() !== '' ? { descripcion: descripcion.trim() } : {}),
        ...(iniciales?.fecha !== undefined ? { fecha: iniciales.fecha } : {}),
        ...(iniciales?.montoSugerido !== undefined ? { montoSugerido: iniciales.montoSugerido } : {}),
      });
      if (res.status === 'no_disponible') {
        setError('Los gastos todavía no están disponibles en tu copiloto.');
        setGuardando(false);
        return;
      }
      onCreado(res.gasto);
    } catch (err) {
      // El backend valida a mano justamente para dar un `detail` legible (`"falta monto"`). Se
      // muestra tal cual: re-escribirlo acá sería inventar un mensaje sobre un error que ya vino
      // explicado, y quedaría desincronizado el día que el backend agregue una validación nueva.
      //
      // `err.detail` y NO `err.body.detail`: `mapearError` ya extrae el string del body al construir
      // el `ApiError`. Bajar al `body` a mano es el camino largo — `body` existe para el caso que el
      // string NO cubre (dos causas del mismo status distinguibles por la presencia de un campo,
      // como los dos 409 de facturar), no para leer un texto que ya viene desempaquetado.
      const detalle = err instanceof ApiError ? err.detail : null;
      setError(detalle != null && detalle !== '' ? detalle : 'No pudimos guardar el gasto.');
      setGuardando(false);
    }
  }

  return (
    <View style={{ gap: tema.espacio.md }} testID={testID}>
      <CampoNumero
        etiqueta="Cuánto gastaste"
        valor={monto}
        onChange={setMonto}
        placeholder="15000,50"
        testID="gasto-monto"
      />

      {/* La sugerencia del OCR se muestra como CITA del ticket, sin ningún tratamiento que sugiera
          validación: nada de tilde verde ni "leído correctamente". Un checkmark al lado de un número
          alucinado le presta la autoridad de la app a una lectura del modelo. */}
      {iniciales?.montoSugerido != null && (
        <Text
          testID="gasto-monto-sugerido"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Del ticket leímos: {iniciales.montoSugerido}
        </Text>
      )}

      <CampoSelect
        etiqueta="Categoría"
        opciones={CATEGORIAS_GASTO.map((c) => ({ valor: c, etiqueta: ETIQUETA_CATEGORIA[c] }))}
        valor={categoria}
        onChange={(v) => setCategoria(v as CategoriaGasto)}
        testID="gasto-categoria"
      />

      <CampoTexto
        etiqueta="Proveedor (opcional)"
        valor={proveedor}
        onChange={setProveedor}
        maxLength={120}
        testID="gasto-proveedor"
      />

      <CampoTexto
        etiqueta="Cómo lo pagaste (opcional)"
        valor={medioPago}
        onChange={setMedioPago}
        maxLength={40}
        placeholder="efectivo, transferencia…"
        testID="gasto-medio-pago"
      />

      <CampoTexto
        etiqueta="Detalle (opcional)"
        valor={descripcion}
        onChange={setDescripcion}
        maxLength={500}
        multiline
        testID="gasto-descripcion"
      />

      {error != null && (
        <Text testID="gasto-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {error}
        </Text>
      )}

      <FilaBotones
        testID="gasto-acciones"
        botones={[
          { etiqueta: 'Cancelar', onPress: onCancelar, testID: 'gasto-cancelar' },
          {
            etiqueta: guardando ? 'Guardando…' : 'Guardar',
            onPress: () => void guardar(),
            variante: 'primario',
            deshabilitado: !puedeGuardar,
            testID: 'gasto-guardar',
          },
        ]}
      />
    </View>
  );
}
