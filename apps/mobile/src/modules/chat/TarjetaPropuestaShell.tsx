import { Text, View } from 'react-native';

import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaPropuestaShell` — la cáscara común a toda card "esto entendí, revisalo antes de guardar".
 *
 * Extraída al sumar la 3ª card (`TarjetaIngresoPropuesto`, hito 8) — regla de tres: con 2 instancias
 * (`TarjetaGastoPropuesto`/`TarjetaClientePropuesto`) generalizar era adivinar el eje de variación; con
 * la 3ª, lo que se repite byte-a-byte es exactamente esto, y lo que varía queda AFUERA a propósito:
 *
 * 🔴 **Esto NO es un "esquema de campos".** Cada acción sigue dueña de su propio `Formulario*`
 * (`FormularioGasto`, `FormularioCliente`, `FormularioIngreso`…) con su validación real — reimplementar
 * eso acá de forma genérica sería la segunda copia que diverge, justo lo que la regla de tres vino a
 * evitar. La shell sólo orquesta: aviso + cita de lo dicho + el Formulario que ya existe, como `children`.
 *
 * 🔴 **Los estados TERMINALES no entran acá.** Gasto tiene 2 (guardado/descartado), Cliente tiene 3
 * (+ya_existe, el 409 por documento), Ingreso tiene 2 (guardado/descartado) pero SÓLO llega a
 * 'guardado' cuando el emprendedor dice explícitamente "Así está bien" (`onListo`) — mientras el
 * ingreso puede completarse, sigue mostrando el aviso de `falta` DENTRO de su propio
 * `FormularioIngreso`, no este Tile (2026-08-13: antes no tenía Tile propio y "Así está bien"
 * reusaba `onCancelar`, mostrando "No lo anotamos" sobre un ingreso ya guardado). No hay un enum
 * común a las tres — forzarlo angostaría a la mayoría. Cada `TarjetaXPropuesto` sigue renderizando
 * sus propios estados terminales, fuera de esta shell.
 */
export interface TarjetaPropuestaShellProps {
  /** *"Esto entendí. Revisalo y tocá X — todavía no lo Y."* — el verbo es de cada acción. */
  aviso: string;
  /**
   * Lo DICTADO, textual, citado entre «comillas» — contra ESTO se contrasta lo que la card entendió.
   * `null`/vacío no se pinta. 🔴 **Sólo para una cita literal de lo que dijo el usuario** (gasto,
   * ingreso): la explicación del COPILOTO (cliente, cuando un documento no cierra) no es una cita y se
   * lee mal entre comillas — esa se pasa como `children`, no acá.
   */
  cita?: string | null;
  testID: string;
  children: React.ReactNode;
}

export function TarjetaPropuestaShell({ aviso, cita, testID, children }: TarjetaPropuestaShellProps) {
  const tema = useTema();
  const citaLimpia = cita != null && cita.trim() !== '' ? cita.trim() : null;

  return (
    <Tile testID={testID}>
      <View style={{ gap: tema.espacio.sm }}>
        <Text testID={`${testID}-aviso`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          {aviso}
        </Text>

        {citaLimpia != null && (
          <Text
            testID={`${testID}-dicho`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontStyle: 'italic' }}
          >
            «{citaLimpia}»
          </Text>
        )}

        {children}
      </View>
    </Tile>
  );
}

/** El texto de un estado terminal simple (guardado/descartado) — un `Tile` con una línea de texto,
 *  repetido igual en gasto y cliente. `tono` elige el color; el llamador decide QUÉ dice. */
export interface TarjetaPropuestaTerminalProps {
  testID: string;
  tono: 'exito' | 'tenue';
  texto: string;
}

export function TarjetaPropuestaTerminal({ testID, tono, texto }: TarjetaPropuestaTerminalProps) {
  const tema = useTema();
  return (
    <Tile testID={testID}>
      <Text
        style={{
          color: tono === 'exito' ? tema.color.exito : tema.color.textoTenue,
          fontSize: tema.tipo.base,
          fontWeight: tono === 'exito' ? '600' : '400',
        }}
      >
        {texto}
      </Text>
    </Tile>
  );
}
