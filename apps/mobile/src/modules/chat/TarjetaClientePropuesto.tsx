import { useState } from 'react';
import { Text, View } from 'react-native';

import type { Cliente, DatosCliente, DuplicadoCliente } from '@copiloto/core';

import { FormularioCliente } from '../clientes/FormularioCliente';
import { empujarUnaVez } from '../../navegacion/empujarUnaVez';
import { FilaBotones } from '../../theme/glass/campos';
import { Tile } from '../../theme/glass/Tile';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `TarjetaClientePropuesto` — lo que el copiloto entendió de un cliente **dictado**, editable antes de
 * darlo de alta. Hito 6 del contrato de Clientes.
 *
 * 🔴 **Propone, NO guarda — y el cartel lo dice.** El backend lo verificó con un control explícito
 * (contar filas después del turno: 0). El riesgo no es teórico: el modelo, sin instrucción, cierra con
 * *«listo, ya lo agregué»*; el emprendedor lo lee, no toca nada, y el cliente no existe. El backend ya
 * se lo prohíbe al LLM; este cartel es la otra mitad, del lado que el usuario mira.
 *
 * 🔴 **Reusa `FormularioCliente` tal cual.** Dos formularios divergen: el de voz se queda sin algún
 * campo que el manual sí tiene —y el dictado es justo donde más falta corregir, porque lo llenó un
 * LLM—. Mismo criterio que `TarjetaGastoPropuesto`.
 *
 * 🔴 **Las dos caras del 409 se resuelven distinto, y ninguna se pinta como error.**
 * - **Por nombre** (homónimo) → se queda DENTRO del formulario, con lo dictado intacto: es una
 *   pregunta que sólo el emprendedor puede responder (dos «Kiosco» pueden ser dos kioscos).
 * - **Por documento** → es el mismo cliente. Ya no hay nada que editar, así que la card se convierte
 *   en *«ya lo tenés»* con la salida a su ficha.
 *
 * 🔴 **«Abrir ese cliente» NAVEGA de verdad** (`empujarUnaVez` → `/clientes?clienteId=`). Ofrecer un
 * botón que no lleva a ningún lado es el defecto que este repo ya pagó: cada lado verifica su mitad y
 * la junta no es de nadie. Se usa `empujarUnaVez` y no `router.push` porque el chat vive en la pantalla
 * lanzadora: dos toques apilarían dos glass y la app queda trabada.
 *
 * ⚠️ **Pendiente de device:** este formulario tiene seis campos dentro del scroll del chat, que —a
 * diferencia de `PantallaClientes`— no es un `ScrollFormulario` que revele el campo enfocado. El
 * teclado del glass se dibuja encima y no empuja nada. Si tapa los últimos campos, la corrección va
 * acá, no en el formulario.
 */

type Estado =
  | { fase: 'editando' }
  | { fase: 'guardado'; cliente: Cliente }
  | { fase: 'ya_existe'; duplicado: DuplicadoCliente }
  | { fase: 'descartado' };

export interface TarjetaClientePropuestoProps {
  propuesta: DatosCliente;
  testID?: string;
}

/** Lleva a la ficha de ese cliente en la pantalla de Clientes, que ya sabe abrirla por id. */
function abrirFicha(id: number): void {
  empujarUnaVez({ pathname: '/clientes', params: { clienteId: String(id) } });
}

export function TarjetaClientePropuesto({
  propuesta,
  testID = 'cliente-propuesto',
}: TarjetaClientePropuestoProps) {
  const tema = useTema();
  const [estado, setEstado] = useState<Estado>({ fase: 'editando' });

  if (estado.fase === 'guardado') {
    return (
      <Tile testID={`${testID}-guardado`}>
        <Text style={{ color: tema.color.exito, fontSize: tema.tipo.base, fontWeight: '600' }}>
          Cliente agregado: {estado.cliente.nombre}
        </Text>
      </Tile>
    );
  }

  if (estado.fase === 'ya_existe') {
    const dueno = estado.duplicado.dueno;
    return (
      <Tile testID={`${testID}-ya-existe`}>
        <View style={{ gap: tema.espacio.sm }}>
          {/* 🔴 En tenue, no en rojo: "ya lo tenés" es un resultado útil, no un fallo. Y no se nombra
              el documento si no vino el dueño — explicar mal algo que sí pasó manda al emprendedor a
              buscar un dato que no puso. */}
          <Text
            testID={`${testID}-ya-existe-texto`}
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
          >
            {dueno != null
              ? `Ese cliente ya está en tu cartera: ${dueno.nombre}.`
              : 'Ese cliente ya está en tu cartera.'}
          </Text>
          {/* Sin dueño reconocible NO hay botón: inventar un id llevaría a la ficha equivocada, que
              es peor que un atajo de menos. */}
          {dueno != null && (
            <FilaBotones
              compacto
              testID={`${testID}-ya-existe-acciones`}
              botones={[
                {
                  etiqueta: 'Abrir ese cliente',
                  onPress: () => abrirFicha(dueno.id),
                  testID: `${testID}-ya-existe-abrir`,
                },
              ]}
            />
          )}
        </View>
      </Tile>
    );
  }

  if (estado.fase === 'descartado') {
    return (
      <Tile testID={`${testID}-descartado`}>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          No lo agregamos.
        </Text>
      </Tile>
    );
  }

  return (
    <Tile testID={testID}>
      <View style={{ gap: tema.espacio.sm }}>
        <Text
          testID={`${testID}-aviso`}
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}
        >
          Esto entendí. Revisalo y tocá Dar de alta — todavía no lo agregué.
        </Text>

        <FormularioCliente
          iniciales={propuesta}
          onGuardado={(cliente) => setEstado({ fase: 'guardado', cliente })}
          onDuplicado={(duplicado) => setEstado({ fase: 'ya_existe', duplicado })}
          // El homónimo se resolvió abriendo al otro: no se creó nada, y decirlo evita que se vaya
          // creyendo que además quedó cargado el suyo.
          onAbrirCliente={(c) => {
            setEstado({ fase: 'ya_existe', duplicado: { por: 'nombre', dueno: c } });
            abrirFicha(c.id);
          }}
          onCancelar={() => setEstado({ fase: 'descartado' })}
          testID={`${testID}-formulario`}
        />
      </View>
    </Tile>
  );
}
