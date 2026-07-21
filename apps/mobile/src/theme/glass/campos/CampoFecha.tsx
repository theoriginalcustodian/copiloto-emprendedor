/**
 * `CampoFecha` — tres `TextInput` cortos (DD/MM/AAAA) dentro de una sola `EnvolturaCampo`, sin
 * date-picker nativo. Misma razón que `CampoSelect`: un picker nativo abre superficie del sistema y
 * corta el vidrio en seco.
 *
 * Emite ISO `YYYY-MM-DD` sólo cuando los tres segmentos están completos Y la fecha es válida (días por
 * mes + bisiesto); en cualquier otro caso emite `''` -- nunca una fecha a medio construir ni una
 * inventada. El avance de foco (día → mes → año) es automático al completar cada segmento de 2 dígitos.
 *
 * 🔴 **Estado semi-controlado, a propósito.** El componente sostiene sus 3 segmentos en estado local
 * (necesario: no hay forma de mostrar "07" en un `TextInput` mientras el padre todavía sostiene `''`
 * porque la fecha no cerró) y lo siembra UNA vez desde `valor` al montar. Si el padre necesita resetear
 * el campo (p.ej. limpiar el formulario), tiene que remontarlo con una `key` distinta -- mismo patrón
 * que un `<input type="date">` no controlado. Sincronizar en cada cambio de `valor` habría requerido
 * pisar el tipeo a medio completar del usuario cada vez que el padre recibe el `''` intermedio, que es
 * exactamente el loop que este diseño evita.
 */
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTema } from '../../ThemeProvider';
import { EnvolturaCampo } from './EnvolturaCampo';

export interface CampoFechaProps {
  etiqueta: string;
  /** ISO `YYYY-MM-DD`, o `''` si no hay fecha (o está incompleta/es inválida). */
  valor: string;
  onChange: (iso: string) => void;
  error?: string;
  testID?: string;
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

function diasEnMes(mes: number, anio: number): number {
  const dias = [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dias[mes - 1];
}

/** `''` si los 3 segmentos no están completos o la fecha no existe en el calendario (p.ej. 31/02). */
function fechaValidaIso(dia: string, mes: string, anio: string): string {
  if (dia.length !== 2 || mes.length !== 2 || anio.length !== 4) return '';
  const d = Number(dia);
  const m = Number(mes);
  const a = Number(anio);
  if (m < 1 || m > 12) return '';
  if (d < 1 || d > diasEnMes(m, a)) return '';
  return `${anio}-${mes}-${dia}`;
}

function partesDeIso(iso: string): { dia: string; mes: string; anio: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { dia: '', mes: '', anio: '' };
  return { anio: m[1], mes: m[2], dia: m[3] };
}

/** Sólo dígitos, sin importar qué se haya pegado/tipeado -- un separador tipeado a mano no rompe el
 *  avance automático de foco porque nunca llega a contar para el `maxLength`. */
function soloDigitos(texto: string, maximo: number): string {
  return texto.replace(/[^0-9]/g, '').slice(0, maximo);
}

export function CampoFecha({ etiqueta, valor, onChange, error, testID = 'campo-fecha' }: CampoFechaProps) {
  const tema = useTema();
  const iniciales = partesDeIso(valor);
  const [dia, setDia] = useState(iniciales.dia);
  const [mes, setMes] = useState(iniciales.mes);
  const [anio, setAnio] = useState(iniciales.anio);
  const refMes = useRef<TextInput>(null);
  const refAnio = useRef<TextInput>(null);
  const hayError = error != null && error !== '';

  function actualizar(nuevoDia: string, nuevoMes: string, nuevoAnio: string) {
    setDia(nuevoDia);
    setMes(nuevoMes);
    setAnio(nuevoAnio);
    onChange(fechaValidaIso(nuevoDia, nuevoMes, nuevoAnio));
  }

  return (
    <View style={styles.contenedor} testID={testID}>
      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        {etiqueta}
      </Text>
      <EnvolturaCampo error={hayError} style={styles.envoltura} testID={`${testID}-vidrio`}>
        <TextInput
          testID={`${testID}-dia`}
          style={[styles.segmento, { color: tema.color.texto, fontFamily: tema.fuente.ui, fontSize: tema.tipo.base }]}
          value={dia}
          placeholder="DD"
          placeholderTextColor={tema.color.textoTenue}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(t) => {
            const limpio = soloDigitos(t, 2);
            actualizar(limpio, mes, anio);
            if (limpio.length === 2) refMes.current?.focus();
          }}
        />
        <Text style={[styles.separador, { color: tema.color.textoTenue }]}>/</Text>
        <TextInput
          ref={refMes}
          testID={`${testID}-mes`}
          style={[styles.segmento, { color: tema.color.texto, fontFamily: tema.fuente.ui, fontSize: tema.tipo.base }]}
          value={mes}
          placeholder="MM"
          placeholderTextColor={tema.color.textoTenue}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(t) => {
            const limpio = soloDigitos(t, 2);
            actualizar(dia, limpio, anio);
            if (limpio.length === 2) refAnio.current?.focus();
          }}
        />
        <Text style={[styles.separador, { color: tema.color.textoTenue }]}>/</Text>
        <TextInput
          ref={refAnio}
          testID={`${testID}-anio`}
          style={[styles.segmentoAnio, { color: tema.color.texto, fontFamily: tema.fuente.ui, fontSize: tema.tipo.base }]}
          value={anio}
          placeholder="AAAA"
          placeholderTextColor={tema.color.textoTenue}
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(t) => actualizar(dia, mes, soloDigitos(t, 4))}
        />
      </EnvolturaCampo>
      {hayError && (
        <Text
          testID={`${testID}-error`}
          style={[styles.error, { color: tema.color.peligro, fontFamily: tema.fuente.mono }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 6 },
  etiqueta: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  envoltura: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 4 },
  segmento: { width: 28, textAlign: 'center', paddingVertical: 12 },
  segmentoAnio: { width: 48, textAlign: 'center', paddingVertical: 12 },
  separador: { fontSize: 16 },
  error: { fontSize: 11, letterSpacing: 0.2 },
});
