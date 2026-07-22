import { apiClient } from './client';
import type { ConDisponibilidad } from './afip';

/**
 * **`GET /capacidades` — lo que el copiloto sabe hacer HOY, para la pantalla de «cómo hablarle».**
 *
 * 🔴 **Este endpoint existe porque yo me negué a escribir la pantalla con las frases adentro.** El
 * `addendum_..._como-se-le-habla-al-copiloto` §3.1 traía la tabla de ejemplos lista para copiar, y uno
 * de esos ejemplos —*«facturale 80 mil a la panadería»*— prometía una tool que **no existe**
 * (`grep emitir_factura` → cero). Una guía con las frases escritas a mano es el mismo objeto que el
 * catálogo estático de Apps: lo vivo cambia por su cuenta, cada lado verifica su mitad, y la junta no
 * es de nadie. [[verificar-que-el-camino-recomendado-existe]]
 *
 * Backend lo construyó como **proyección** (PR #24, `tool_catalog.capacidades_vivas`): una capacidad se
 * publica **sólo si su tool está viva** en `TOOL_INDEX`. Entonces la poda de tools y el alta de
 * `emitir_factura` actualizan esta pantalla **solas**, y el DoD *«los ejemplos coinciden con lo que
 * existe»* pasa a ser cierto por construcción en vez de algo que alguien tiene que acordarse de
 * verificar. Verificar a mano funciona una vez.
 *
 * Verificado por HTTP el 2026-07-22 contra el vivo: `GET /capacidades` sin token → **401** (la ruta
 * existe y pide sesión), y el control negativo —una ruta inventada— → **200 con el HTML del SPA**. Sin
 * ese control, el `401` no distinguiría *«existe»* de *«cualquier cosa da 401»*.
 *
 * 🔴 **Acá NO hay lista de respaldo, y es a propósito.** Si el endpoint no está o falla, la pantalla
 * dice que no está. Una lista hardcodeada "por las dudas" sería exactamente el bug que este endpoint
 * vino a matar, reintroducido en la capa de abajo — y encima invisible, porque se vería igual de bien.
 */

/** Una cosa que el copiloto sabe hacer, con las frases que la disparan. */
export interface CapacidadCopiloto {
  /** El nombre de la tool viva. No se muestra: sirve para poder cruzar la pantalla con el backend. */
  tool: string;
  /** Cómo se llama de cara al emprendedor: «Gastos», «Ingresos», «Facturas»… */
  rotulo: string;
  /** Las frases que funcionan, tal cual las publica el backend. La app NO inventa ni completa. */
  ejemplos: readonly string[];
}

/** Las fechas que el resolvedor entiende de verdad, y qué hacer con las que no. */
export interface FechasQueEntiende {
  entiendo: readonly string[];
  /**
   * La salida para cualquier otro día. `null` si el backend no la mandó: **no se inventa un texto**
   * que le prometa al emprendedor un control que quizá no exista en esa pantalla.
   */
  siNoEsta: string | null;
}

export interface GuiaCapacidades {
  capacidades: readonly CapacidadCopiloto[];
  fechas: FechasQueEntiende;
}

interface CapacidadRaw {
  tool?: unknown;
  rotulo?: unknown;
  ejemplos?: unknown;
}

/** Las cadenas no vacías de un array desconocido. Cualquier otra cosa se descarta en silencio. */
function frases(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim());
}

/**
 * 🔴 **Una capacidad SIN ejemplos se descarta, no se pinta con la lista vacía.**
 *
 * La pantalla entera existe para mostrar **frases que funcionan**; un rótulo solo («Facturas») no
 * enseña nada y además se lee como una función rota. Y al revés de lo que parece, descartarla no
 * esconde nada: prometer de menos es gratis —si el emprendedor dice algo que anda y no estaba en la
 * lista, gana—, mientras que prometer de más *enseña a decir algo que falla* y quema la confianza en
 * todo lo demás. Es el mismo criterio con el que el backend decide qué publicar.
 */
function esCapacidadMostrable(c: CapacidadRaw): boolean {
  return typeof c?.rotulo === 'string' && c.rotulo.trim() !== '' && frases(c.ejemplos).length > 0;
}

function normalizar(c: CapacidadRaw): CapacidadCopiloto {
  return {
    tool: typeof c.tool === 'string' ? c.tool : '',
    rotulo: (c.rotulo as string).trim(),
    ejemplos: frases(c.ejemplos),
  };
}

/**
 * 🔴 **Un `GET` a una ruta no desplegada devuelve `200` con el HTML del SPA**, así que la ausencia del
 * endpoint no llega como excepción: llega como éxito con un cuerpo sin la clave. Sin este chequeo,
 * *«todavía no está la guía»* y *«el copiloto no sabe hacer nada»* serían la misma pantalla — y la
 * segunda es una afirmación tranquilizadora construida sobre la ausencia total del dato.
 */
function esRespuestaDelEndpoint(raw: unknown, clave: string): boolean {
  return typeof raw === 'object' && raw !== null && clave in raw;
}

/**
 * La guía viva. Cualquier fallo —red, endpoint ausente, cuerpo con otra forma— cae en
 * `no_disponible`: es la única respuesta honesta cuando lo que se iba a mostrar es *qué se puede
 * pedir*. Una guía a medias es peor que ninguna.
 */
export async function leerCapacidades(): Promise<ConDisponibilidad<{ guia: GuiaCapacidades }>> {
  try {
    const raw = await apiClient.get<{ capacidades?: CapacidadRaw[]; fechas?: unknown }>(
      '/capacidades',
    );
    if (!esRespuestaDelEndpoint(raw, 'capacidades')) return { status: 'no_disponible' };
    const filas = Array.isArray(raw.capacidades) ? raw.capacidades : [];
    const fechasRaw =
      typeof raw.fechas === 'object' && raw.fechas !== null
        ? (raw.fechas as { entiendo?: unknown; si_no_esta?: unknown })
        : {};
    return {
      status: 'ok',
      guia: {
        capacidades: filas.filter((c) => c != null && esCapacidadMostrable(c)).map(normalizar),
        fechas: {
          entiendo: frases(fechasRaw.entiendo),
          siNoEsta:
            typeof fechasRaw.si_no_esta === 'string' && fechasRaw.si_no_esta.trim() !== ''
              ? fechasRaw.si_no_esta.trim()
              : null,
        },
      },
    };
  } catch {
    return { status: 'no_disponible' };
  }
}
