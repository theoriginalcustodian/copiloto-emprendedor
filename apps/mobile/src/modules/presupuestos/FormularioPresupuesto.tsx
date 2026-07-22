import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import {
  ApiError,
  crearPresupuesto,
  formatearImporte,
  type NuevoItemPresupuesto,
  type Presupuesto,
} from '@copiloto/core';

import {
  CampoSelect,
  CampoTexto,
  FilaBotones,
  type OpcionSelect,
} from '../../theme/glass/campos';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * `FormularioPresupuesto` — el alta. Y también la corrección, que es la MISMA operación.
 *
 * 🔴 **No hay pantalla de edición, y no es una simplificación: es el contrato.** No existe `PUT` ni
 * `PATCH` — corregir un presupuesto es crear otro con `reemplaza_a` apuntando al anterior. Es append,
 * no mutación, y por eso el reemplazo **consume un número correlativo nuevo**: un presupuesto ya
 * enviado existe afuera del sistema, y dos documentos distintos circulando con el mismo N° 7 serían
 * indistinguibles para el emprendedor y para su cliente.
 *
 * Se le dice al usuario, arriba del formulario, cuando está corrigiendo. Que el número cambie sin
 * aviso sería la clase de sorpresa que hace desconfiar del sistema justo donde hay plata.
 *
 * 🔴 **El total NO se calcula acá.** Lo calcula el backend (`Σ cantidad × precio_unitario`). El
 * "aproximado" que se muestra abajo es una ayuda visual y **está etiquetado como tal**: una segunda
 * aritmética del dinero que se presente como definitiva es exactamente lo que el contrato evita
 * mandando los montos como string. Si difiere del backend, manda el backend.
 */

const OPCIONES_DOC: OpcionSelect[] = [
  { valor: '99', etiqueta: 'Sin identificar' },
  { valor: '96', etiqueta: 'DNI' },
  { valor: '80', etiqueta: 'CUIT' },
];

/** Una fila del formulario. Todo string: es lo que tipea el usuario y lo que viaja al backend. */
interface FilaItem {
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
}

const FILA_VACIA: FilaItem = { descripcion: '', cantidad: '1', precioUnitario: '' };

/**
 * Normaliza lo que se tipeó a un decimal que el backend acepta: coma → punto, sin espacios.
 *
 * 🔴 **Normaliza, no convierte.** El teclado numérico de Android entrega coma en configuración
 * regional argentina, y `"30000,50"` no es un decimal válido para el backend. Pasar por `Number` acá
 * arreglaría el separador y de paso metería el float que todo el contrato evita — el string sale
 * string.
 */
function aDecimal(texto: string): string {
  return texto.trim().replace(/\s/g, '').replace(',', '.');
}

/** Multiplica dos decimales string SIN float, para el aproximado. Ver el docstring del módulo. */
function multiplicarDecimal(a: string, b: string): string | null {
  const na = aDecimal(a);
  const nb = aDecimal(b);
  if (!/^\d+(\.\d+)?$/.test(na) || !/^\d+(\.\d+)?$/.test(nb)) return null;
  const decimales = (na.split('.')[1]?.length ?? 0) + (nb.split('.')[1]?.length ?? 0);
  // `BigInt` sobre los dígitos sin punto: exacto para cualquier cantidad de decimales.
  const producto = BigInt(na.replace('.', '')) * BigInt(nb.replace('.', ''));
  const s = producto.toString().padStart(decimales + 1, '0');
  const corte = s.length - decimales;
  return decimales === 0 ? s : `${s.slice(0, corte)}.${s.slice(corte)}`;
}

function sumarDecimal(a: string, b: string): string {
  const decimales = Math.max(a.split('.')[1]?.length ?? 0, b.split('.')[1]?.length ?? 0);
  const escala = (v: string) => {
    const [ent, dec = ''] = v.split('.');
    return BigInt(ent + dec.padEnd(decimales, '0'));
  };
  const suma = (escala(a) + escala(b)).toString().padStart(decimales + 1, '0');
  const corte = suma.length - decimales;
  return decimales === 0 ? suma : `${suma.slice(0, corte)}.${suma.slice(corte)}`;
}

/** El aproximado del total, o `null` si alguna fila todavía no es un número. */
export function totalAproximado(items: readonly FilaItem[]): string | null {
  let acumulado = '0';
  for (const it of items) {
    if (it.descripcion.trim() === '' && it.precioUnitario.trim() === '') continue;
    const parcial = multiplicarDecimal(it.cantidad, it.precioUnitario);
    if (parcial == null) return null;
    acumulado = sumarDecimal(acumulado, parcial);
  }
  return acumulado;
}

export interface FormularioPresupuestoProps {
  /** Si viene, el formulario arranca con sus datos y el alta lleva `reemplazaA` — es una corrección. */
  corrige?: Presupuesto | null;
  onCreado: (presupuesto: Presupuesto) => void;
  onCancelar: () => void;
  testID?: string;
}

export function FormularioPresupuesto({
  corrige = null,
  onCreado,
  onCancelar,
  testID = 'formulario-presupuesto',
}: FormularioPresupuestoProps) {
  const tema = useTema();
  const [concepto, setConcepto] = useState(corrige?.concepto ?? '');
  const [nombre, setNombre] = useState(corrige?.receptor.nombre ?? '');
  const [docTipo, setDocTipo] = useState(String(corrige?.receptor.docTipo ?? 99));
  const [docNro, setDocNro] = useState(corrige?.receptor.docNro ?? '');
  const [contacto, setContacto] = useState(corrige?.receptor.contacto ?? '');
  const [items, setItems] = useState<FilaItem[]>(
    corrige != null && corrige.items.length > 0
      ? corrige.items.map((i) => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
        }))
      : [{ ...FILA_VACIA }],
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function actualizarItem(indice: number, campo: keyof FilaItem, valor: string) {
    setItems((prev) => prev.map((it, i) => (i === indice ? { ...it, [campo]: valor } : it)));
  }

  function agregarFila() {
    setItems((prev) => [...prev, { ...FILA_VACIA }]);
  }

  function quitarFila(indice: number) {
    // Nunca se queda sin filas: un formulario de presupuesto sin ninguna línea no tiene qué mostrar
    // ni qué enviar, y el backend lo rechazaría con un 400 que el usuario no puede accionar.
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== indice)));
  }

  const itemsValidos: NuevoItemPresupuesto[] = items
    .filter((it) => it.descripcion.trim() !== '')
    .map((it) => ({
      descripcion: it.descripcion.trim(),
      cantidad: aDecimal(it.cantidad) || '1',
      precioUnitario: aDecimal(it.precioUnitario) || '0',
    }));

  /**
   * 🔴 **Exige exactamente lo que el backend exige, ni un campo más.** Pedir de más acá traba el caso
   * legítimo Y esconde bugs de las dos capas: el formulario nunca llega a mandar el body que el
   * backend rechazaría, así que un desacuerdo entre ambos no da síntoma hasta que alguien pega por
   * HTTP. El contrato pide `concepto`, `receptor.nombre` y ≥1 ítem — eso, y nada más.
   */
  const puedeGuardar = concepto.trim() !== '' && nombre.trim() !== '' && itemsValidos.length > 0;

  async function guardar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await crearPresupuesto({
        concepto: concepto.trim(),
        receptor: {
          nombre: nombre.trim(),
          docTipo: Number(docTipo),
          docNro: docNro.trim(),
          contacto: contacto.trim(),
        },
        items: itemsValidos,
        ...(corrige != null ? { reemplazaA: corrige.id } : {}),
      });
      if (res.status === 'no_disponible') {
        setError('Los presupuestos todavía no están disponibles en tu copiloto.');
        return;
      }
      onCreado(res.presupuesto);
    } catch (e) {
      setError(e instanceof ApiError ? (e.detail ?? e.message) : 'No pudimos guardar el presupuesto.');
    } finally {
      setEnviando(false);
    }
  }

  const aproximado = totalAproximado(items);

  return (
    <View testID={testID} style={{ gap: tema.espacio.md }}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        {corrige != null ? `Corregir el N° ${corrige.numero}` : 'Nuevo presupuesto'}
      </Text>

      {corrige != null && (
        <Text testID={`${testID}-aviso-correccion`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Se va a crear un presupuesto nuevo con número propio que reemplaza al N° {corrige.numero}. El
          anterior queda en el historial — así, si ya se lo mandaste a tu cliente, los dos documentos
          siguen siendo distinguibles.
        </Text>
      )}

      <CampoTexto
        testID={`${testID}-concepto`}
        etiqueta="Concepto"
        valor={concepto}
        onChange={setConcepto}
        placeholder="Instalación eléctrica"
        maxLength={120}
      />
      <CampoTexto
        testID={`${testID}-nombre`}
        etiqueta="Cliente"
        valor={nombre}
        onChange={setNombre}
        placeholder="Juan Pérez"
      />
      <CampoSelect
        testID={`${testID}-doc-tipo`}
        etiqueta="Tipo de documento"
        opciones={OPCIONES_DOC}
        valor={docTipo}
        onChange={setDocTipo}
      />
      {/* Sin documento no se puede pedir número — y "Sin identificar" es el default, así que el campo
          no aparece salvo que el usuario elija DNI o CUIT. */}
      {docTipo !== '99' && (
        <CampoTexto
          testID={`${testID}-doc-nro`}
          etiqueta="Número de documento"
          valor={docNro}
          onChange={setDocNro}
          keyboardType="number-pad"
        />
      )}
      <CampoTexto
        testID={`${testID}-contacto`}
        etiqueta="Contacto (mail o teléfono)"
        valor={contacto}
        onChange={setContacto}
        placeholder="juan@mail.com"
        autoCapitalize="none"
      />

      <Text style={[styles.etiqueta, { color: tema.color.textoTenue, fontFamily: tema.fuente.mono }]}>
        Ítems
      </Text>

      {items.map((it, i) => (
        <Row key={i} testID={`${testID}-item-${i}`}>
          <View style={styles.item}>
            <CampoTexto
              testID={`${testID}-item-${i}-descripcion`}
              etiqueta="Descripción"
              valor={it.descripcion}
              onChange={(v) => actualizarItem(i, 'descripcion', v)}
              placeholder="Mano de obra"
            />
            <View style={styles.filaNumeros}>
              <View style={styles.mitad}>
                <CampoTexto
                  testID={`${testID}-item-${i}-cantidad`}
                  etiqueta="Cantidad"
                  valor={it.cantidad}
                  onChange={(v) => actualizarItem(i, 'cantidad', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.mitad}>
                <CampoTexto
                  testID={`${testID}-item-${i}-precio`}
                  etiqueta="Precio unitario"
                  valor={it.precioUnitario}
                  onChange={(v) => actualizarItem(i, 'precioUnitario', v)}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            {items.length > 1 && (
              <Pressable
                testID={`${testID}-item-${i}-quitar`}
                onPress={() => quitarFila(i)}
                hitSlop={8}
                style={pressableStyle(styles.quitar, PRESS_FADE)}
              >
                <Text style={{ color: tema.color.peligro, fontSize: tema.tipo.chico }}>Quitar ítem</Text>
              </Pressable>
            )}
          </View>
        </Row>
      ))}

      <FilaBotones
        compacto
        testID={`${testID}-agregar-botones`}
        botones={[{ etiqueta: 'Agregar ítem', onPress: agregarFila, testID: `${testID}-agregar-item` }]}
      />

      {/* 🔴 "aproximado" en el texto, no decorativo: el total definitivo lo calcula el backend. */}
      {aproximado != null && (
        <Text testID={`${testID}-total-aproximado`} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
          Total aproximado: {formatearImporte(aproximado)} — el definitivo lo calcula el sistema al
          guardar.
        </Text>
      )}

      {error != null && (
        <Text testID={`${testID}-error`} style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
          {error}
        </Text>
      )}

      <FilaBotones
        testID={`${testID}-botones`}
        botones={[
          {
            etiqueta: enviando ? 'Guardando…' : 'Guardar presupuesto',
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

const styles = StyleSheet.create({
  item: { flex: 1, gap: 8 },
  filaNumeros: { flexDirection: 'row', gap: 8 },
  mitad: { flex: 1 },
  quitar: { alignSelf: 'flex-start' },
  etiqueta: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
});
