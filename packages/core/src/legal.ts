/**
 * Contenido legal compartido entre web y mobile (BL-O6 parte A). Un solo lugar para
 * `LEGAL_VERSION` y el texto: la parte B (aceptación registrada) necesita la misma versión desde
 * los dos lados, y un texto que nace duplicado se desalinea la primera vez que alguno cambie.
 *
 * Terceros verificados contra el código real (no contra el backlog) el 2026-09-22:
 * Composio (`motor/clients/agent/providers/composio_gateway.py`), ARCA/AFIP
 * (`apps/copiloto/afip_gateway.py`), Mercado Pago (`motor/clients/agent/providers/mercadopago_gateway.py`),
 * OpenRouter/OpenAI/Groq (`motor/clients/agent/providers/{llm,vision,stt}.py` — el LLM del chat NO
 * es uno solo) y Google (login OAuth, `apps/mobile/src/modules/auth/oauth.ts`). Graphity queda
 * fuera de "terceros": es infraestructura propia self-hosted, no un proveedor externo.
 */

export const LEGAL_VERSION = '2026-09-22';

/**
 * Aviso de plantilla que las dos apps muestran sobre el texto legal. Vive acá y no copiado en cada app:
 * retirarlo es decisión del operador, y debe ser UNA edición. Si se borra de una app y no de la otra,
 * sólo una suite queda roja. Este export no decide nada: el aviso sigue vigente.
 */

/**
 * PROVISORIO — pendiente de revisión legal, dueño: operador (BL-O6, firmado 2026-09-28).
 * El acta había diferido el texto legal completo a Cierre B por no estar listo; se implementó
 * ToS/Privacidad igual (parte A) pero sin este descargo, y quedó ausente ~1 semana sin dueño
 * visible. No se retira el aviso de plantilla genérica (decisión aparte, sigue vigente) — este
 * descargo es un párrafo adicional, redactado por planificación (copy, no arquitectura), sin
 * fecha de reemplazo porque no la tiene: el reemplazo real lo escribe un abogado.
 */
export const LEGAL_DESCARGO =
  'Odobi es una herramienta de gestión. La información, los cálculos y los documentos que genera —presupuestos, comprobantes y resúmenes de actividad— tienen carácter orientativo y no constituyen asesoramiento contable, impositivo, legal ni financiero. No reemplazan la intervención de un profesional matriculado ni la consulta a los organismos correspondientes. La verificación de los datos, la emisión de comprobantes fiscales y el cumplimiento de las obligaciones tributarias son responsabilidad exclusiva del usuario. Odobi no garantiza la exactitud, integridad ni vigencia de la información que obtiene de servicios de terceros.';

export type LegalKind = 'tos' | 'privacidad';

export const LEGAL_TITULOS: Record<LegalKind, string> = {
  tos: 'Términos y Condiciones',
  privacidad: 'Política de Privacidad',
};

export interface LegalParrafo {
  titulo: string;
  cuerpo: string;
}

export const TOS_PARRAFOS: readonly LegalParrafo[] = [
  {
    titulo: '1. Aceptación.',
    cuerpo:
      'Al crear una cuenta y usar Odobi ("el Servicio"), aceptás estos términos. Si no estás de acuerdo, no uses el Servicio.',
  },
  {
    titulo: '2. El Servicio.',
    cuerpo:
      'Odobi es un asistente conversacional que ayuda a emprendedores a gestionar tareas de su negocio (facturación, gastos, ingresos, clientes, presupuestos e integraciones con terceros). Está en etapa beta: puede tener cambios frecuentes, interrupciones y funcionalidad incompleta.',
  },
  {
    titulo: '3. Cuenta y uso aceptable.',
    cuerpo:
      'Sos responsable de mantener la confidencialidad de tus credenciales y de toda actividad bajo tu cuenta. No uses el Servicio para fines ilegales, para vulnerar la seguridad del sistema, ni para cargar contenido que infrinja derechos de terceros.',
  },
  {
    titulo: '4. Integraciones y proveedores externos.',
    cuerpo:
      'Con tu autorización explícita, el Servicio conecta con Composio (para operar Gmail, Drive, Sheets y Docs), ARCA (para emitir comprobantes fiscales cuando activás facturación) y Mercado Pago (para gestionar cobros cuando conectás tu cuenta). Además, el Servicio usa proveedores de inteligencia artificial para funcionar: OpenRouter (el chat), OpenAI (lectura de fotos de comprobantes) y Groq (transcripción de notas de voz). El uso de estos servicios se rige además por los términos de cada proveedor.',
  },
  {
    titulo: '5. Limitación de responsabilidad.',
    cuerpo:
      'El Servicio se ofrece "tal cual", sin garantías de disponibilidad continua o ausencia de errores. En la medida permitida por la ley, no somos responsables por daños indirectos derivados del uso del Servicio.',
  },
  {
    titulo: '6. Cancelación.',
    cuerpo:
      'Podés dejar de usar el Servicio y solicitar la baja de tu cuenta en cualquier momento. Podemos suspender cuentas que incumplan estos términos.',
  },
  {
    titulo: '7. Cambios.',
    cuerpo: 'Podemos actualizar estos términos; los cambios relevantes se van a comunicar dentro del Servicio.',
  },
  {
    titulo: '8. Ley aplicable.',
    cuerpo: 'Estos términos se rigen por las leyes de la República Argentina.',
  },
];

export const PRIVACIDAD_PARRAFOS: readonly LegalParrafo[] = [
  {
    titulo: '1. Qué datos recopilamos.',
    cuerpo:
      'Datos de cuenta (email), datos de negocio que vos cargás o que el Servicio genera al operar en tu nombre (facturas, gastos, ingresos, clientes, presupuestos), y datos de las integraciones que autorizás explícitamente (Gmail, Drive, Sheets y Docs vía Composio; cobros vía Mercado Pago; comprobantes fiscales vía ARCA). Si iniciás sesión con Google, recibimos tu email y el identificador de tu cuenta de Google.',
  },
  {
    titulo: '2. Para qué los usamos.',
    cuerpo:
      'Para operar el Servicio en tu nombre (ej. redactar y enviar comprobantes, registrar movimientos), para dar soporte, y para mejorar el producto. No vendemos tus datos a terceros.',
  },
  {
    titulo: '3. Con quién los compartimos.',
    cuerpo:
      'Con los proveedores que vos conectás explícitamente (Composio, ARCA, Mercado Pago), con los proveedores de inteligencia artificial que procesan tus mensajes para que el asistente funcione (OpenRouter para el chat, OpenAI para leer fotos de comprobantes, Groq para transcribir notas de voz), y con Google cuando elegís iniciar sesión con esa cuenta. Cada proveedor externo procesa datos bajo su propia política de privacidad. La memoria de conversación del asistente (Graphity) es infraestructura propia: no es un tercero externo.',
  },
  {
    titulo: '4. Aislamiento entre cuentas.',
    cuerpo:
      'Los datos de cada emprendedor están aislados de los de otros emprendedores que usan el Servicio (multi-tenant con controles de acceso a nivel de base de datos).',
  },
  {
    titulo: '5. Tu clave fiscal.',
    cuerpo:
      'Si activás facturación, tu certificado y clave fiscal de ARCA se guardan cifrados y se usan sólo para emitir comprobantes en tu nombre. Nunca se muestran en el chat ni se comparten con otro proveedor.',
  },
  {
    titulo: '6. Retención y baja.',
    cuerpo:
      'Conservamos tus datos mientras la cuenta esté activa. Podés solicitar la eliminación de tu cuenta y de los datos asociados en cualquier momento.',
  },
  {
    titulo: '7. Tus derechos.',
    cuerpo:
      'Podés acceder, corregir o eliminar tus datos personales conforme a la Ley 25.326 de Protección de Datos Personales (Argentina).',
  },
  {
    titulo: '8. Cambios.',
    cuerpo: 'Podemos actualizar esta política; los cambios relevantes se van a comunicar dentro del Servicio.',
  },
];

export function parrafosDe(kind: LegalKind): readonly LegalParrafo[] {
  return kind === 'tos' ? TOS_PARRAFOS : PRIVACIDAD_PARRAFOS;
}
