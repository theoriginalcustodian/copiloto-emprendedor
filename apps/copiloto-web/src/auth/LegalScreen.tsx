import { Button, Surface } from '../design-system';
import './login.css';

/**
 * BETA-2.a (`contrato_planificacion-a-todos_SPRINT-beta-el-mapa.md`): páginas de ToS/Privacidad,
 * linkeadas desde `SignupScreen`. Contenido: **plantilla estándar genérica**, autorizada por el
 * operador (decisión #2, `dato_planificacion-a-frontend_decisiones-resueltas-y-respuesta-signup-
 * publico.md`) — no requiere esperar texto propio del operador. Sigue marcada como plantilla en el
 * propio texto: no es una revisión legal específica del negocio, y no se debe confundir con eso.
 *
 * Reusa `login.css` (mismo `.app-frame`/`Surface` que Login/Signup) — cero CSS nuevo para una
 * pantalla de puro texto.
 */

export type LegalKind = 'tos' | 'privacidad';

export interface LegalScreenProps {
  kind: LegalKind;
  onVolver: () => void;
}

const TITULOS: Record<LegalKind, string> = {
  tos: 'Términos y Condiciones',
  privacidad: 'Política de Privacidad',
};

function CuerpoTos() {
  return (
    <>
      <p>
        <strong>1. Aceptación.</strong> Al crear una cuenta y usar Copiloto del Emprendedor
        ("el Servicio"), aceptás estos términos. Si no estás de acuerdo, no uses el Servicio.
      </p>
      <p>
        <strong>2. El Servicio.</strong> Copiloto del Emprendedor es un asistente conversacional
        que ayuda a emprendedores a gestionar tareas de su negocio (facturación, gastos, ingresos,
        clientes, presupuestos e integraciones con terceros). Está en etapa beta: puede tener
        cambios frecuentes, interrupciones y funcionalidad incompleta.
      </p>
      <p>
        <strong>3. Cuenta y uso aceptable.</strong> Sos responsable de mantener la confidencialidad
        de tus credenciales y de toda actividad bajo tu cuenta. No uses el Servicio para fines
        ilegales, para vulnerar la seguridad del sistema, ni para cargar contenido que infrinja
        derechos de terceros.
      </p>
      <p>
        <strong>4. Integraciones de terceros.</strong> El Servicio puede conectar con proveedores
        externos (por ejemplo Gmail, Drive, Sheets, HubSpot, Mercado Pago) mediante autorización
        explícita tuya. El uso de esos servicios se rige además por los términos de cada proveedor.
      </p>
      <p>
        <strong>5. Limitación de responsabilidad.</strong> El Servicio se ofrece "tal cual", sin
        garantías de disponibilidad continua o ausencia de errores. En la medida permitida por la
        ley, no somos responsables por daños indirectos derivados del uso del Servicio.
      </p>
      <p>
        <strong>6. Cancelación.</strong> Podés dejar de usar el Servicio y solicitar la baja de tu
        cuenta en cualquier momento. Podemos suspender cuentas que incumplan estos términos.
      </p>
      <p>
        <strong>7. Cambios.</strong> Podemos actualizar estos términos; los cambios relevantes se
        van a comunicar dentro del Servicio.
      </p>
      <p>
        <strong>8. Ley aplicable.</strong> Estos términos se rigen por las leyes de la República
        Argentina.
      </p>
    </>
  );
}

function CuerpoPrivacidad() {
  return (
    <>
      <p>
        <strong>1. Qué datos recopilamos.</strong> Datos de cuenta (email), datos de negocio que
        vos cargás o que el Servicio genera al operar en tu nombre (facturas, gastos, ingresos,
        clientes, presupuestos), y datos de las integraciones que autorizás explícitamente
        (Gmail, Drive, Sheets, HubSpot, Instagram, Calendar, Mercado Pago).
      </p>
      <p>
        <strong>2. Para qué los usamos.</strong> Para operar el Servicio en tu nombre (ej.
        redactar y enviar comprobantes, registrar movimientos), para dar soporte, y para mejorar
        el producto. No vendemos tus datos a terceros.
      </p>
      <p>
        <strong>3. Con quién los compartimos.</strong> Con los proveedores que vos conectás
        explícitamente (vía OAuth/Composio) y con proveedores de infraestructura necesarios para
        operar el Servicio (hosting, procesamiento de pagos). Cada proveedor externo procesa datos
        bajo su propia política de privacidad.
      </p>
      <p>
        <strong>4. Aislamiento entre cuentas.</strong> Los datos de cada emprendedor están
        aislados de los de otros emprendedores que usan el Servicio (multi-tenant con controles de
        acceso a nivel de base de datos).
      </p>
      <p>
        <strong>5. Retención y baja.</strong> Conservamos tus datos mientras la cuenta esté activa.
        Podés solicitar la eliminación de tu cuenta y de los datos asociados en cualquier momento.
      </p>
      <p>
        <strong>6. Tus derechos.</strong> Podés acceder, corregir o eliminar tus datos personales
        conforme a la Ley 25.326 de Protección de Datos Personales (Argentina).
      </p>
      <p>
        <strong>7. Cambios.</strong> Podemos actualizar esta política; los cambios relevantes se
        van a comunicar dentro del Servicio.
      </p>
    </>
  );
}

export function LegalScreen({ kind, onVolver }: LegalScreenProps) {
  return (
    <div className="app-frame login-screen" data-testid={`legal-screen-${kind}`}>
      <div className="login-screen__inner">
        <div className="login-screen__brand">
          <span className="login-screen__brand-title">{TITULOS[kind]}</span>
        </div>

        <Surface variant="card" blur className="login-screen__card">
          <p
            role="note"
            className="login-screen__alert login-screen__alert--warning"
            data-testid="legal-screen-placeholder-notice"
          >
            Plantilla estándar genérica — no es una revisión legal específica de este negocio.
          </p>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {kind === 'tos' ? <CuerpoTos /> : <CuerpoPrivacidad />}
          </div>
        </Surface>

        <Button type="button" onClick={onVolver} className="login-screen__submit">
          Volver
        </Button>
      </div>
    </div>
  );
}
