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
