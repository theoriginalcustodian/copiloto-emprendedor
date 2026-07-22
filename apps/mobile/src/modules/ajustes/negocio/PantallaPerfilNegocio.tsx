import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  ApiError,
  LIMITE_CAMPO_CORTO,
  LIMITE_QUE_VENDE,
  guardarPerfilNegocio,
  leerPerfilNegocio,
  type AQuienVende,
  type FormalidadCopiloto,
  type GuardarPerfilNegocioRequest,
  type LargoRespuesta,
  type PerfilNegocio,
} from '@copiloto/core';

import {
  CampoSelect,
  CampoTexto,
  FilaBotones,
  ScrollFormulario,
  type OpcionSelect,
} from '../../../theme/glass/campos';
import { MarcoGlass } from '../../../theme/glass/MarcoGlass';
import { useTema } from '../../../theme/ThemeProvider';

/**
 * `PantallaPerfilNegocio` — Ajustes → "Mi negocio": qué vende el emprendedor, a quién, y cómo quiere
 * que le hable el copiloto.
 *
 * Contrato: `coordinacion/abierto/2026-07-21_contrato_backend-perfil-negocio-y-presupuestos.md` §1.
 * Todo lo que esta pantalla sabe del backend sale de `@copiloto/core` (`api/perfilNegocio.ts`) —
 * ningún `fetch`, ningún código HTTP, ninguna URL acá.
 *
 * 🔴 **Dos secciones que se guardan POR SEPARADO, y ese es el punto del POST parcial.** "Mi negocio"
 * (qué vende, a quién, nombre, horario) y "Cómo te habla el copiloto" (formalidad, largo, nombre) son
 * decisiones de distinto momento: el emprendedor puede querer cambiarle el tono al copiloto sin
 * volver a mirar lo que escribió sobre su negocio. Cada botón manda **sólo sus claves**; las ausentes
 * el backend no las toca. Un guardado que mandara el objeto entero haría que la sección que no se
 * está editando pise con lo que tenga en pantalla —que puede ser viejo— la que el usuario acaba de
 * cambiar en otro dispositivo.
 *
 * 🔴 **`perfil: null` NO es un error y es el caso MÁS común el primer día.** Todo tenant nuevo llega
 * así. Se pinta el formulario vacío, sin cartel de error y sin botón de reintentar: no hay nada que
 * reintentar, hay algo que completar.
 *
 * 🔴 **Acá NO se piden CUIT, razón social, domicilio ni condición IVA.** Ya viven en el perfil fiscal
 * (Ajustes → Facturación AFIP). Pedirlos otra vez sería la segunda copia de un dato que ya tenemos, y
 * las dos copias divergen solas — el usuario corrige una y la otra queda mintiendo sin avisar.
 *
 * 🔴 `ScrollFormulario` y no un `ScrollView` pelado: el teclado tapaba los campos y no había cómo
 * llegar a ellos (visto en device el 2026-07-21 en el alta de ARCA). Es además el `ScrollView` de
 * Gesture Handler, no el de `react-native` — esta pantalla vive dentro del `GestureDetector` de
 * `MarcoGlass` y dos sistemas de toque en el mismo árbol se disputan el dedo.
 */

const OPCIONES_A_QUIEN: OpcionSelect[] = [
  { valor: 'empresas', etiqueta: 'Empresas' },
  { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
  { valor: 'ambos', etiqueta: 'Ambos' },
];

const OPCIONES_FORMALIDAD: OpcionSelect[] = [
  { valor: 'formal', etiqueta: 'Formal' },
  { valor: 'cercano', etiqueta: 'Cercano' },
];

const OPCIONES_LARGO: OpcionSelect[] = [
  { valor: 'breve', etiqueta: 'Breve' },
  { valor: 'detallado', etiqueta: 'Detallado' },
];

interface Campos {
  queVende: string;
  aQuien: AQuienVende;
  nombreComercial: string;
  horarioAtencion: string;
  formalidad: FormalidadCopiloto;
  largoRespuesta: LargoRespuesta;
  nombreCopiloto: string;
}

/**
 * El estado inicial de un tenant que nunca configuró nada. Los enums arrancan en el valor más
 * habitual del oficio (le vende a los dos, habla cercano, responde corto) en vez de vacíos: un select
 * sin nada marcado obliga a elegir algo antes de poder guardar otra cosa.
 */
const CAMPOS_VACIOS: Campos = {
  queVende: '',
  aQuien: 'ambos',
  nombreComercial: '',
  horarioAtencion: '',
  formalidad: 'cercano',
  largoRespuesta: 'breve',
  nombreCopiloto: '',
};

function aCampos(p: PerfilNegocio): Campos {
  return {
    queVende: p.queVende,
    aQuien: p.aQuien,
    nombreComercial: p.nombreComercial,
    horarioAtencion: p.horarioAtencion,
    formalidad: p.formalidad,
    largoRespuesta: p.largoRespuesta,
    nombreCopiloto: p.nombreCopiloto,
  };
}

type EstadoCarga = 'cargando' | 'ok' | 'error' | 'no_disponible';
type EstadoGuardado = 'idle' | 'enviando' | 'ok' | 'error';

/** Qué sección se está guardando — para que el "Guardando…" aparezca en SU botón y no en los dos. */
type Seccion = 'negocio' | 'personalidad';

interface SeccionProps {
  titulo: string;
  testID: string;
  children: React.ReactNode;
}

function Seccion({ titulo, testID, children }: SeccionProps) {
  const tema = useTema();
  return (
    <View testID={testID} style={{ gap: tema.espacio.sm }}>
      <Text style={{ color: tema.color.texto, fontFamily: tema.fuente.uiSemibold, fontSize: tema.tipo.grande }}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

/**
 * 🔴 **Los ejemplos dicen «ej.:» y eso NO es cosmética: sin el prefijo, un dato guardado y una
 * sugerencia se leen igual.**
 *
 * Pasó en device el 2026-07-22, con el aparato en la mano: `que_vende` tenía **«Instalaciones»** —un
 * dato real, cargado por el emprendedor— y se leyó como sugerencia. Al tocar el campo para "llenarlo",
 * el texto nuevo se **concatenó**: quedó *«InstalacionesHerreria y portones a medida»*. El dato no se
 * perdió: se ensució, que es peor, porque nada avisa.
 *
 * **Por qué no alcanzaba con más contraste.** El valor ya se pinta con `color.texto` y el placeholder
 * con `color.textoTenue` — son distintos en el token y aun así se confundieron sobre el vidrio. Una
 * defensa que depende de que dos grises se distingan **en una pantalla al sol, en un teléfono
 * cualquiera**, falla justo cuando importa. El prefijo no depende de la percepción: un texto que
 * empieza con «ej.:» no puede ser algo que vos escribiste.
 *
 * Aplica a **este formulario en particular** porque es el único que llega **pre-cargado desde el
 * servidor con campos opcionales vacíos**: los dos estados conviven en la misma pantalla. En un alta
 * no hay valor guardado que confundir.
 */
export function PantallaPerfilNegocio() {
  const tema = useTema();
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('cargando');
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('idle');
  const [seccionEnCurso, setSeccionEnCurso] = useState<Seccion | null>(null);
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);

  function actualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    // Un cambio invalida el "Guardado" anterior: dejarlo en pantalla mientras el usuario edita diría
    // que lo que está viendo ya está a salvo, y no lo está.
    setEstadoGuardado('idle');
    setErrorGuardado(null);
  }

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await leerPerfilNegocio();
        if (!vivo) return;
        if (res.status === 'no_disponible') {
          setEstadoCarga('no_disponible');
          return;
        }
        // `perfil: null` → los campos quedan vacíos y la pantalla es un formulario, no un error.
        if (res.perfil) setCampos(aCampos(res.perfil));
        setEstadoCarga('ok');
      } catch {
        if (vivo) setEstadoCarga('error');
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  async function guardar(seccion: Seccion) {
    const parcial: GuardarPerfilNegocioRequest =
      seccion === 'negocio'
        ? {
            queVende: campos.queVende,
            aQuien: campos.aQuien,
            nombreComercial: campos.nombreComercial,
            horarioAtencion: campos.horarioAtencion,
          }
        : {
            formalidad: campos.formalidad,
            largoRespuesta: campos.largoRespuesta,
            nombreCopiloto: campos.nombreCopiloto,
          };

    setSeccionEnCurso(seccion);
    setEstadoGuardado('enviando');
    setErrorGuardado(null);
    try {
      const res = await guardarPerfilNegocio(parcial);
      if (res.status === 'no_disponible') {
        setEstadoCarga('no_disponible');
        setEstadoGuardado('idle');
        return;
      }
      // El POST devuelve el perfil COMPLETO ya actualizado: se re-siembran los campos desde la
      // respuesta en vez de dar por hecho que quedó lo que había en pantalla. Si otro dispositivo
      // cambió la otra sección, este es el momento en que aparece.
      setCampos(aCampos(res.perfil));
      setEstadoGuardado('ok');
    } catch (e) {
      // El 400 del backend nombra el campo o la regla que falló — mostrarlo es más útil que un
      // "no se pudo guardar" genérico, que deja al usuario adivinando cuál de los siete campos toca.
      setErrorGuardado(e instanceof ApiError ? (e.detail ?? e.message) : null);
      setEstadoGuardado('error');
    } finally {
      setSeccionEnCurso(null);
    }
  }

  const enviando = estadoGuardado === 'enviando';

  // `icono="chat"` y no `note`: `note` ya es "Datos personales" en el grid de Ajustes, y entrar por
  // un ícono para llegar a otro desorienta (regla del grid). De los tres libres del catálogo
  // (`mic`/`chat`/`clock`), `chat` es el defendible: la mitad de esta pantalla es literalmente cómo
  // conversa el copiloto, y la otra mitad es el contexto que usa para conversar.
  return (
    <MarcoGlass titulo="Mi negocio" icono="chat" testID="pantalla-perfil-negocio">
      {estadoCarga === 'cargando' && (
        <View style={styles.centro}>
          <ActivityIndicator testID="perfil-negocio-cargando" color={tema.color.acento} />
        </View>
      )}

      {estadoCarga === 'error' && (
        <View style={styles.centro}>
          <Text testID="perfil-negocio-error" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
            No pudimos cargar tu perfil. Probá de nuevo.
          </Text>
        </View>
      )}

      {estadoCarga === 'no_disponible' && (
        <View style={styles.centro}>
          <Text
            testID="perfil-negocio-no-disponible"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, textAlign: 'center' }}
          >
            Esta función todavía no está disponible en tu copiloto.
          </Text>
        </View>
      )}

      {estadoCarga === 'ok' && (
        <ScrollFormulario contentContainerStyle={{ padding: tema.espacio.md, gap: tema.espacio.lg }}>
          <Seccion titulo="Mi negocio" testID="perfil-negocio-seccion-negocio">
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Con esto el copiloto entiende de qué se trata tu trabajo y puede responderte mejor.
            </Text>
            <CampoTexto
              testID="perfil-negocio-que-vende"
              etiqueta="¿Qué vendés o qué servicio ofrecés?"
              valor={campos.queVende}
              onChange={(v) => actualizar('queVende', v)}
              placeholder="ej.: Instalaciones eléctricas domiciliarias y pequeñas obras"
              multiline
              maxLength={LIMITE_QUE_VENDE}
            />
            <CampoSelect
              testID="perfil-negocio-a-quien"
              etiqueta="¿A quién le vendés?"
              opciones={OPCIONES_A_QUIEN}
              valor={campos.aQuien}
              onChange={(v) => actualizar('aQuien', v as AQuienVende)}
            />
            <CampoTexto
              testID="perfil-negocio-nombre-comercial"
              etiqueta="Nombre comercial"
              valor={campos.nombreComercial}
              onChange={(v) => actualizar('nombreComercial', v)}
              placeholder="ej.: Electricidad Pérez"
              maxLength={LIMITE_CAMPO_CORTO}
            />
            <CampoTexto
              testID="perfil-negocio-horario"
              etiqueta="Horario de atención"
              valor={campos.horarioAtencion}
              onChange={(v) => actualizar('horarioAtencion', v)}
              placeholder="ej.: Lunes a viernes de 8 a 17"
              maxLength={LIMITE_CAMPO_CORTO}
            />
            <FilaBotones
              testID="perfil-negocio-guardar-negocio-botones"
              botones={[
                {
                  etiqueta: enviando && seccionEnCurso === 'negocio' ? 'Guardando…' : 'Guardar',
                  onPress: () => void guardar('negocio'),
                  variante: 'primario',
                  deshabilitado: enviando,
                  testID: 'perfil-negocio-guardar-negocio',
                },
              ]}
            />
          </Seccion>

          <Seccion titulo="Cómo te habla el copiloto" testID="perfil-negocio-seccion-personalidad">
            <CampoSelect
              testID="perfil-negocio-formalidad"
              etiqueta="Tono"
              opciones={OPCIONES_FORMALIDAD}
              valor={campos.formalidad}
              onChange={(v) => actualizar('formalidad', v as FormalidadCopiloto)}
            />
            <CampoSelect
              testID="perfil-negocio-largo"
              etiqueta="Largo de las respuestas"
              opciones={OPCIONES_LARGO}
              valor={campos.largoRespuesta}
              onChange={(v) => actualizar('largoRespuesta', v as LargoRespuesta)}
            />
            <CampoTexto
              testID="perfil-negocio-nombre-copiloto"
              etiqueta="¿Cómo querés llamarlo?"
              valor={campos.nombreCopiloto}
              onChange={(v) => actualizar('nombreCopiloto', v)}
              placeholder="ej.: Copi"
              maxLength={LIMITE_CAMPO_CORTO}
            />
            <FilaBotones
              testID="perfil-negocio-guardar-personalidad-botones"
              botones={[
                {
                  etiqueta: enviando && seccionEnCurso === 'personalidad' ? 'Guardando…' : 'Guardar',
                  onPress: () => void guardar('personalidad'),
                  variante: 'primario',
                  deshabilitado: enviando,
                  testID: 'perfil-negocio-guardar-personalidad',
                },
              ]}
            />
          </Seccion>

          {estadoGuardado === 'ok' && (
            <Text testID="perfil-negocio-guardado" style={{ color: tema.color.exito, fontSize: tema.tipo.base }}>
              Listo, lo guardamos.
            </Text>
          )}

          {estadoGuardado === 'error' && (
            <Text testID="perfil-negocio-error-guardado" style={{ color: tema.color.peligro, fontSize: tema.tipo.base }}>
              {errorGuardado ?? 'No pudimos guardar los cambios. Probá de nuevo.'}
            </Text>
          )}

          {/* Los datos fiscales viven en otra pantalla a propósito — decirlo evita que el
              emprendedor los busque acá y concluya que faltan. */}
          <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
            Tu CUIT, razón social y condición de IVA se cargan en Ajustes → Facturación AFIP.
          </Text>
        </ScrollFormulario>
      )}
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
