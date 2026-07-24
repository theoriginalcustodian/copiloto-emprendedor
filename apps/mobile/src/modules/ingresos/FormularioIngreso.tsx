/**
 * `FormularioIngreso` — anotar que entró plata.
 *
 * 🔴 **Lo único obligatorio es el monto, y no es una comodidad: es la función.** Un formulario que
 * exige medio de pago y cliente para anotar que te pagaron es lo que hace que el emprendedor **deje
 * de anotar** — y la caja vuelve a mentir, que es el problema entero que Ingresos viene a resolver. El
 * backend acepta `{monto}` solo; exigir más acá sería validación de más, que además esconde bugs de
 * las dos capas. [[validacion-de-mas-en-la-ui-enmascara-bugs]]
 *
 * 🔴 **Lo que faltó se avisa DESPUÉS de guardar; el duplicado se pregunta ANTES.** No es una
 * inconsistencia: un dato que falta **se ve** y se completa cuando aparezca; un ingreso de más
 * **infla la caja y no se ve nunca**. Por eso el aviso de `falta` aparece con el ingreso ya guardado y
 * la pregunta del duplicado corta el guardado.
 *
 * 🔴 **Completar usa `PATCH` sobre el MISMO ingreso.** Si contestar el aviso creara un registro nuevo,
 * el aviso duplicaría la caja — exactamente el daño que se quiere evitar.
 */
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  completarIngreso,
  formatearImporte,
  normalizarDecimal,
  registrarIngreso,
  type FaltanteIngreso,
  type Ingreso,
} from '@copiloto/core';

import { CampoTexto, FilaBotones } from '../../theme/glass/campos';
import { useTema } from '../../theme/ThemeProvider';
import { generarId } from '../../util/id';

/** Cómo se le pide cada dato que faltó, en el idioma del emprendedor. */
const COMO_SE_PIDE: Record<FaltanteIngreso, string> = {
  cliente: 'de quién',
  medio: 'cómo te pagaron',
  concepto: 'por qué trabajo',
};

/**
 * Valores de arranque de un ingreso DICTADO — mismo criterio que `ValoresInicialesGasto`
 * (`FormularioGasto.tsx`): todos opcionales, y sólo `monto` importa para poder guardar. Sin esto no
 * hay card de voz posible para Ingresos, sólo el alta manual.
 */
export interface ValoresInicialesIngreso {
  monto?: string;
  cliente?: string;
  medio?: string;
  concepto?: string;
  /** 🔴 Silencioso: viaja al guardar pero NO tiene campo propio en este formulario — mismo criterio
   *  que `ValoresInicialesGasto.fecha`. El motor ya resolvió lo que se dictó («ayer», «el lunes»);
   *  omitirlo haría que el backend ponga "hoy" y un ingreso dictado como "lo de ayer" quedara mal. */
  fecha?: string;
}

export interface FormularioIngresoProps {
  iniciales?: ValoresInicialesIngreso;
  onGuardado: (ingreso: Ingreso) => void;
  onCancelar: () => void;
  testID?: string;
}

export function FormularioIngreso({
  iniciales,
  onGuardado,
  onCancelar,
  testID = 'ingreso-form',
}: FormularioIngresoProps) {
  const tema = useTema();
  const [monto, setMonto] = useState(iniciales?.monto ?? '');
  const [cliente, setCliente] = useState(iniciales?.cliente ?? '');
  const [medio, setMedio] = useState(iniciales?.medio ?? '');
  const [concepto, setConcepto] = useState(iniciales?.concepto ?? '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** El 409: hay un ingreso parecido. Se muestra y se deja decidir. */
  const [duplicado, setDuplicado] = useState<{ mensaje: string; candidato: Ingreso | null } | null>(null);
  /** Ya guardado, con lo que faltó. Se queda en pantalla para poder completarlo sin volver a empezar. */
  const [guardado, setGuardado] = useState<Ingreso | null>(null);

  /**
   * Misma regla que el cobro de una factura: **una clave por GESTO**, conservada entre reintentos y
   * descartada sólo cuando el ingreso entró. Sin esto, un corte de red después de que el backend
   * guardó deja dos ingresos — y un ingreso de más infla la caja sin verse.
   */
  const claveGesto = useRef<string | null>(null);

  async function guardar(confirmarDuplicado = false) {
    if (enviando) return;
    const crudo = monto.trim();
    // La ÚNICA validación, y es la del backend.
    if (crudo === '') {
      setError('Escribí cuánto te pagaron.');
      return;
    }
    // Mismo patrón que FormularioGasto: la coma decimal del teclado argentino no viaja cruda.
    const importe = normalizarDecimal(crudo);
    setEnviando(true);
    setError(null);
    const clave = claveGesto.current ?? generarId();
    claveGesto.current = clave;
    try {
      const res = await registrarIngreso({
        monto: importe,
        idemKey: clave,
        // Lo vacío NO viaja: mandar `medio: ''` guardaría una cadena en blanco donde debería quedar
        // el hueco que el backend reporta en `falta`.
        ...(cliente.trim() !== '' ? { clienteNombre: cliente.trim() } : {}),
        ...(medio.trim() !== '' ? { medio: medio.trim() } : {}),
        ...(concepto.trim() !== '' ? { concepto: concepto.trim() } : {}),
        ...(iniciales?.fecha !== undefined ? { fecha: iniciales.fecha } : {}),
        ...(confirmarDuplicado ? { confirmarDuplicado: true } : {}),
      });
      if (res.status === 'ok') {
        claveGesto.current = null;
        setDuplicado(null);
        setGuardado(res.ingreso);
        onGuardado(res.ingreso);
        return;
      }
      if (res.status === 'posible_duplicado') {
        setDuplicado({ mensaje: res.mensaje, candidato: res.candidato });
        return;
      }
      if (res.status === 'rechazado') setError(res.motivo);
      else setError('No pudimos anotarlo. Probá de nuevo.');
    } catch {
      setError('No pudimos anotarlo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  /** Completar lo que faltó, sobre el mismo ingreso. */
  async function completar() {
    if (guardado == null || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await completarIngreso(guardado.id, {
        ...(cliente.trim() !== '' ? { clienteNombre: cliente.trim() } : {}),
        ...(medio.trim() !== '' ? { medio: medio.trim() } : {}),
        ...(concepto.trim() !== '' ? { concepto: concepto.trim() } : {}),
      });
      if (res.status === 'ok') {
        setGuardado(res.ingreso);
        onGuardado(res.ingreso);
        return;
      }
      setError('No pudimos completarlo. Probá de nuevo.');
    } catch {
      setError('No pudimos completarlo. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const faltan = guardado?.falta ?? null;

  return (
    <View testID={testID} style={styles.form}>
      <CampoTexto
        etiqueta="Cuánto te pagaron"
        valor={monto}
        onChange={setMonto}
        placeholder="ej.: 85000"
        keyboardType="decimal-pad"
        testID={`${testID}-monto`}
      />
      {/* Los tres opcionales van DEBAJO y se dicen opcionales en la etiqueta: si parecieran
          obligatorios, el efecto sería el mismo que exigirlos. */}
      <CampoTexto
        etiqueta="De quién (opcional)"
        valor={cliente}
        onChange={setCliente}
        placeholder="ej.: Panadería La Esquina"
        testID={`${testID}-cliente`}
      />
      <CampoTexto
        etiqueta="Cómo te pagaron (opcional)"
        valor={medio}
        onChange={setMedio}
        placeholder="ej.: efectivo"
        testID={`${testID}-medio`}
      />
      <CampoTexto
        etiqueta="Por qué trabajo (opcional)"
        valor={concepto}
        onChange={setConcepto}
        placeholder="ej.: pintura del local"
        testID={`${testID}-concepto`}
      />

      {/* 🔴 La pregunta del duplicado. AVISA, NO PROHÍBE: el emprendedor sabe mejor que el sistema si
          le pagaron dos veces, así que el camino de "guardalo igual" siempre está. */}
      {duplicado != null && (
        <View testID={`${testID}-duplicado`} style={styles.aviso}>
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>{duplicado.mensaje}</Text>
          {duplicado.candidato != null && (
            <Text testID={`${testID}-duplicado-candidato`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              {duplicado.candidato.monto != null ? formatearImporte(duplicado.candidato.monto) : 'Sin monto'}
              {duplicado.candidato.fecha != null ? ` · ${duplicado.candidato.fecha}` : ''}
              {duplicado.candidato.clienteNombre != null ? ` · ${duplicado.candidato.clienteNombre}` : ''}
            </Text>
          )}
          <FilaBotones
            testID={`${testID}-duplicado-botones`}
            botones={[
              {
                etiqueta: 'Es otro cobro, anotalo',
                onPress: () => void guardar(true),
                variante: 'primario',
                deshabilitado: enviando,
                testID: `${testID}-confirmar-duplicado`,
              },
              {
                etiqueta: 'Es el mismo',
                onPress: onCancelar,
                variante: 'secundario',
                testID: `${testID}-descartar-duplicado`,
              },
            ]}
          />
        </View>
      )}

      {/* 🔴 El aviso de lo que faltó, con el ingreso YA GUARDADO. El texto lo arma la app pero la
          LISTA la calcula el backend: si la app decidiera qué falta, el aviso y el dato divergirían. */}
      {guardado != null && faltan != null && faltan.length > 0 && (
        <View testID={`${testID}-falta`} style={styles.aviso}>
          <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base }}>
            Anotado. No me dijiste {faltan.map((f) => COMO_SE_PIDE[f]).join(', ')} — si querés,
            completalo arriba y guardá de nuevo.
          </Text>
          <FilaBotones
            testID={`${testID}-falta-botones`}
            botones={[
              {
                etiqueta: enviando ? 'Guardando…' : 'Completar',
                onPress: () => void completar(),
                variante: 'primario',
                deshabilitado: enviando,
                testID: `${testID}-completar`,
              },
              { etiqueta: 'Así está bien', onPress: onCancelar, variante: 'secundario', testID: `${testID}-listo` },
            ]}
          />
        </View>
      )}

      {guardado != null && faltan != null && faltan.length === 0 && (
        <Text testID={`${testID}-completo`} style={{ color: tema.color.exito, fontSize: tema.tipo.base }}>
          Anotado, con todos los datos.
        </Text>
      )}

      {error != null && (
        <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {error}
        </Text>
      )}

      {/* Los CTA principales desaparecen una vez guardado: desde ahí la conversación es "completar o
          listo", y dejar «Anotar» ahí invitaría a guardarlo dos veces. */}
      {guardado == null && duplicado == null && (
        <FilaBotones
          testID={`${testID}-botones`}
          botones={[
            {
              etiqueta: enviando ? 'Anotando…' : 'Anotar',
              onPress: () => void guardar(),
              variante: 'primario',
              deshabilitado: enviando,
              testID: `${testID}-guardar`,
            },
            { etiqueta: 'Cancelar', onPress: onCancelar, variante: 'secundario', testID: `${testID}-cancelar` },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 12 },
  aviso: { gap: 8 },
});
