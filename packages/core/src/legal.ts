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

export const LEGAL_VERSION = '2026-11-13';

/**
 * Aviso de plantilla que las dos apps muestran sobre el texto legal. Vive acá y no copiado en cada app:
 * retirarlo es decisión del operador, y debe ser UNA edición. Si se borra de una app y no de la otra,
 * sólo una suite queda roja. Este export no decide nada: el aviso sigue vigente.
 */
export const LEGAL_AVISO_PLANTILLA = 'Plantilla estándar genérica — no es una revisión legal específica de este negocio.';

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

/**
 * Términos de Odobi (2026-11-13): mismo texto que `web/terminos.html` de la landing, en prosa porque
 * `LegalParrafo` no tiene listas. Reemplaza la plantilla genérica del 2026-09-22. Redactados para el
 * producto real (encargo + confirmación, factura a nombre del usuario, la plata no pasa por Odobi,
 * prueba de 30 días); siguen SIN revisión de un abogado matriculado, por eso `LEGAL_AVISO_PLANTILLA`
 * y `LEGAL_DESCARGO` no se tocan. El titular pasa a la SAS cuando exista.
 */
export const TOS_PARRAFOS: readonly LegalParrafo[] = [
  {
    titulo: '1. Quién presta el servicio.',
    cuerpo:
      'Odobi es un servicio de Martin Cairo, con domicilio en Rosario, Santa Fe, Argentina («Odobi», «nosotros»). Estos términos son el contrato entre vos y nosotros por el uso de la app y del sitio odobi.com.ar. Al crear tu cuenta o entrar con Google los aceptás. Si no estás de acuerdo, no uses Odobi. Qué datos guardamos y para qué está explicado en la Política de Privacidad, que forma parte de este acuerdo.',
  },
  {
    titulo: '2. Qué es Odobi y qué no es.',
    cuerpo:
      'Odobi es una herramienta de gestión para personas que trabajan por su cuenta. Le hablás o le escribís y te ayuda a emitir facturas en ARCA, crear links de cobro en Mercado Pago, armar presupuestos, anotar gastos e ingresos y consultar tus números. Odobi no es un estudio contable ni un asesor: lo que te muestra (totales, resúmenes, avisos, cálculos) es información para que decidas vos. No reemplaza a un contador ni a la consulta en ARCA u otros organismos, y no constituye asesoramiento contable, impositivo, legal ni financiero. Odobi está en etapa de lanzamiento: puede cambiar seguido, tener funciones incompletas o interrumpirse por momentos.',
  },
  {
    titulo: '3. Tu cuenta.',
    cuerpo:
      'Tenés que ser mayor de 18 años. Los datos que cargás, en especial los fiscales, tienen que ser verdaderos y tuyos: si cargás el CUIT de un negocio, declarás que sos el titular o que estás autorizado a facturar a su nombre. La cuenta es personal. Cuidá tu contraseña y avisanos si creés que alguien más entró: lo que se haga desde tu cuenta se considera hecho por vos.',
  },
  {
    titulo: '4. Lo que Odobi hace a tu nombre.',
    cuerpo:
      'Cuando le pedís una factura, un cobro o un mail, Odobi actúa por encargo tuyo y con los accesos que vos le diste. Antes de emitir una factura o generar un cobro te muestra el detalle y espera que lo confirmes: leé el cliente, el importe, el concepto y el tipo de comprobante. La factura se emite en ARCA con el certificado que generaste y a tu nombre: frente a ARCA y frente a tu cliente, quien factura sos vos. Una factura emitida no se borra: se anula con una nota de crédito. Recategorizarte, pagar el monotributo, presentar declaraciones y cumplir con cualquier otra obligación fiscal sigue a tu cargo, aunque Odobi te avise o te muestre números relacionados.',
  },
  {
    titulo: '5. Inteligencia artificial.',
    cuerpo:
      'Odobi entiende lo que le decís usando modelos de inteligencia artificial de otros proveedores: OpenRouter (la conversación), OpenAI (la lectura de las fotos que mandás) y Groq (la transcripción de tu voz). Esos modelos se pueden equivocar: escuchar mal un nombre, leer mal un importe o entender otra cosa. Por eso existe la confirmación del punto 4. Si algo no coincide con lo que pediste, corregilo antes de confirmar.',
  },
  {
    titulo: '6. Las cuentas que conectás.',
    cuerpo:
      'Odobi trabaja con servicios de otras empresas que vos decidís conectar: ARCA, Mercado Pago y Google (Gmail, Calendar, Drive, Docs y Sheets, a través de Composio). Tu plata no pasa por Odobi: los cobros entran directo a tu cuenta de Mercado Pago. Odobi crea el link y registra el pago; no recibe, retiene ni administra tu dinero, y las comisiones y los plazos de acreditación son los de Mercado Pago. Cada servicio tiene sus propios términos, que también aceptaste al abrir tu cuenta con ellos. Si alguno no responde, cambia sus reglas o suspende tu cuenta, hay funciones de Odobi que pueden dejar de andar, y eso no depende de nosotros. Podés desconectar cualquier cuenta cuando quieras.',
  },
  {
    titulo: '7. Precio y prueba gratis.',
    cuerpo:
      'Podés probar Odobi gratis durante 30 días, sin cargar una tarjeta. Durante la prueba no te cobramos nada. Si después Odobi pasa a tener un precio, te lo vamos a informar antes, con el importe total y la forma de pago, y no te vamos a cobrar nada que no hayas aceptado expresamente: si no aceptás, tu cuenta no genera ninguna deuda. Cuando contrates un plan pago por internet vas a tener derecho a arrepentirte dentro de los 10 días corridos desde que lo contrataste, sin dar motivos y sin costo, y a darte de baja por el mismo medio por el que te suscribiste.',
  },
  {
    titulo: '8. Uso permitido.',
    cuerpo:
      'Odobi es para administrar tu propio trabajo o negocio. No lo uses para emitir comprobantes por operaciones que no existieron o a nombre de alguien que no te autorizó; para actividades ilegales o que perjudiquen a otras personas; para intentar entrar a datos de otros usuarios, saltear las medidas de seguridad o sobrecargar el servicio; ni para copiar, revender o desarmar la app.',
  },
  {
    titulo: '9. Tus datos son tuyos.',
    cuerpo:
      'Todo lo que cargás o generás en Odobi (clientes, facturas, presupuestos, gastos, tu logo) es tuyo. Nos das permiso para guardarlo y procesarlo sólo en la medida necesaria para prestarte el servicio, como explica la Política de Privacidad. Podés pedirnos una copia de tus datos cuando quieras. Los datos de tus clientes los cargás vos: sos responsable de tener derecho a usarlos.',
  },
  {
    titulo: '10. Lo que es de Odobi.',
    cuerpo:
      'La app, la marca Odobi, el diseño y el software son nuestros o de quienes nos los licencian. Te damos un permiso personal, no exclusivo y no transferible para usar la app mientras tengas tu cuenta. Ese permiso no te da ningún otro derecho sobre el software ni sobre la marca.',
  },
  {
    titulo: '11. Disponibilidad y cambios en el servicio.',
    cuerpo:
      'Trabajamos para que Odobi esté disponible, pero no podemos prometer que funcione sin interrupciones ni sin errores. Podemos sumar, cambiar o quitar funciones. Si quitamos algo importante, te lo avisamos antes.',
  },
  {
    titulo: '12. Responsabilidad.',
    cuerpo:
      'Respondemos por prestar el servicio con cuidado y por lo que hagamos mal. No respondemos por datos que cargaste mal o comprobantes que confirmaste sin revisar; por decisiones impositivas, contables o comerciales que tomes a partir de lo que Odobi te muestra; por fallas, demoras o cambios de ARCA, Mercado Pago, Google u otros servicios que no manejamos; ni por el uso de tu cuenta por alguien a quien le diste o le dejaste tu contraseña. En la medida en que la ley lo permite, no respondemos por lucro cesante ni por daños indirectos. Nada de este punto limita la responsabilidad por dolo o culpa grave, ni los derechos que la ley te reconoce si usás Odobi como consumidor, que no se pueden renunciar.',
  },
  {
    titulo: '13. Baja y suspensión.',
    cuerpo:
      'Podés irte cuando quieras. Para borrar tu cuenta escribinos a martin.acairo@gmail.com desde el correo con el que te registraste. Eliminamos tus datos dentro de los 30 días, salvo lo que la ley nos obligue a conservar. Las facturas que emitiste siguen registradas en ARCA, porque son tuyas y del organismo. Podemos suspender o cerrar una cuenta que incumpla estos términos: salvo que haya una urgencia (un fraude, un riesgo de seguridad o una orden de autoridad), te avisamos antes y te damos la posibilidad de corregirlo y de llevarte tus datos.',
  },
  {
    titulo: '14. Cambios en estos términos.',
    cuerpo:
      'Si cambiamos algo importante, te lo avisamos en la app o por correo antes de que empiece a regir. Si no estás de acuerdo con el cambio, podés darte de baja sin costo.',
  },
  {
    titulo: '15. Ley aplicable y reclamos.',
    cuerpo:
      'Estos términos se rigen por las leyes de la República Argentina. Ante cualquier problema escribinos primero: casi todo se resuelve hablando. Si hace falta ir a la justicia, son competentes los tribunales ordinarios de la ciudad de Rosario. Si usás Odobi como consumidor, podés reclamar además ante los tribunales de tu domicilio y ante la autoridad de defensa del consumidor de tu provincia.',
  },
  {
    titulo: '16. Si bajaste Odobi del App Store.',
    cuerpo:
      'Este acuerdo es entre vos y Odobi, no con Apple. Apple no presta el servicio, no da soporte ni garantía sobre la app y no responde por reclamos vinculados a ella. El permiso de uso del punto 10 vale para los dispositivos Apple que sean tuyos o que controles, según las reglas del App Store. Apple puede hacer valer estos términos frente a vos como tercero beneficiario.',
  },
  {
    titulo: '17. Contacto.',
    cuerpo:
      'Por cualquier consulta sobre estos términos escribinos a martin.acairo@gmail.com.',
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

/** Forma mínima de `/me` que necesita `descripcionLegal`: opcionales a propósito, porque el cuarto
 * estado ES «el campo no llegó» y el tipo tiene que poder representarlo. */
export interface MeLegalCampos {
  legal_aceptado?: boolean;
  legal_version_aceptada?: string | null;
}

/**
 * BL-O6 (LEGALVERMICUENTA · «Informar», v2): qué versión legal aceptó este tenant, según los dos
 * campos de `/me`. Vive acá —no en cada app— para que el próximo fix llegue a web y a mobile.
 *
 * Tres estados reales más un caso que NO es ninguno de ellos: si el campo no llega (backend viejo,
 * respuesta sin el campo) se dice que no se pudo verificar. Colapsarlo en «nunca aceptó» mostraría
 * una mentira sin ninguna alarma (degradado prudente hacia el caso benigno).
 */
export function descripcionLegal(me: MeLegalCampos | null | undefined): string {
  if (!me) return 'Cargando tu versión aceptada…';
  if (typeof me.legal_aceptado !== 'boolean' || me.legal_version_aceptada === undefined) {
    return 'No pudimos verificar qué versión aceptaste.';
  }
  if (me.legal_version_aceptada === null) return 'Todavía no aceptaste ninguna versión.';
  if (me.legal_aceptado) return `Aceptaste la versión vigente (${me.legal_version_aceptada}).`;
  return `Aceptaste la versión ${me.legal_version_aceptada}, que ya no es la vigente.`;
}

/**
 * ¿Mostrar el botón «Aceptar» en Mi cuenta? (SM-C4, mobile no tiene alta: las cuentas que entran
 * por Google nunca pasaron por el SignupScreen web donde se registra la aceptación.)
 *
 * Es una OFERTA, no un guard: lo que decide es si se muestra un botón que registra la aceptación;
 * ninguna otra acción de la app depende de esto. Sólo `legal_aceptado === false` ofrece (nunca
 * aceptó, o aceptó una versión que ya no es la vigente). El campo ausente NO ofrece: si no se pudo
 * verificar, no se sabe si hace falta — el mismo cuarto estado de `descripcionLegal`.
 */
export function ofrecerAceptarLegal(me: MeLegalCampos | null | undefined): boolean {
  return !!me && me.legal_aceptado === false;
}
