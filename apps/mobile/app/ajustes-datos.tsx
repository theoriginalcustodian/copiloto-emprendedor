import { PantallaAndamiaje } from '../src/modules/ajustes';

/**
 * Ruta del tile "Datos personales". Andamiaje HONESTO: el backend todavía no expone un perfil de
 * persona (`GET /me` sólo devuelve `cliente_id` + `email`), así que la pantalla lo DICE en vez de
 * simular campos que no se guardan en ningún lado.
 */
export default function AjustesDatosRoute() {
  return (
    <PantallaAndamiaje
      titulo="Datos personales"
      icono="note"
      testID="pantalla-ajustes-datos"
      mensaje={
        'Acá vas a poder editar tu nombre, tu teléfono y tus datos de contacto. Todavía no está: el ' +
        'backend guarda tu email y poco más. Tus datos FISCALES (CUIT, razón social, domicilio) sí ' +
        'están, y viven en Ajustes → Facturación AFIP.'
      }
    />
  );
}
