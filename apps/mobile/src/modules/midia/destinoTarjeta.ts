import type { DestinoTarjeta } from '@copiloto/core';

/**
 * H5b — de `destino` (semántica que emite el backend) a lo que la APP hace con él. El backend no conoce
 * pantallas de mobile; el vocabulario (`tipo`) lo fija el contrato `H5B-destino-en-la-tarjeta-critica` y el
 * ruteo es de acá. Función PURA a propósito: es la mitad que decide si el enum cerrado es seguro, y
 * una pura se ejercita con un valor inventado sin montar una pantalla.
 *
 * `null` = «no sé a dónde llevarte». Eso cubre cuatro casos con el MISMO resultado (y a propósito):
 * `destino` ausente (backend previo), un `tipo` que esta versión de la app no conoce (backend más nuevo
 * que la app instalada), un tipo conocido al que le falta lo que necesita (`conexion` sin `id`,
 * `comprobante` con un id que no es numérico) y un tipo del backend que ESTA app todavía no tiene
 * pantalla donde abrir (`presupuesto`, `trabajo`: ver más abajo). El efecto no es el mismo en los dos
 * lugares que la usan, y es a propósito: la acción crítica del banner (`BannerCritico`) cae a Ajustes; la
 * acción de `presentacion` queda como rótulo, porque ahí no hay una pantalla «por defecto» que no sea
 * adivinar. Nunca lanza ni devuelve algo a medias: un valor nuevo del backend no puede romper una app ya
 * instalada.
 *
 * Los cinco `tipo` que emite el backend (`TIPOS_DESTINO_ACCION`, `mi_dia_presentacion.py`) y qué hace
 * esta app con cada uno:
 * - `conexion` → la pantalla de esa conexión (`/apps?servicio=`).
 * - `comprobante` → el detalle del comprobante emitido (`/facturacion?comprobanteId=`). `destino.id` es
 *   el id de FILA de `afip_comprobantes` en las DOS reglas que lo emiten (facturas impagas: `CobroStore
 *   .impagos`; CAE por vencer: `AfipComprobanteStore.con_cae_vigente`), el mismo espacio de ids que lee
 *   `app/facturacion.tsx`.
 * - `certificado` → la pantalla de AFIP (`/ajustes-afip`), donde se carga/renueva el certificado. Es una
 *   hoja sin parámetros: `destino.id` (`cuit:ambiente`) no lo necesita y no se manda.
 * - `presupuesto` → **hueco declarado**: va a abrir el chat sembrado con la tarjeta (`avisoAlChat`, de
 *   frontend1) y esa función todavía no está en `main`. Hasta entonces `null` (rótulo).
 * - `trabajo` → **sin pantalla**: un trabajo es una cadena `eslabon:ref` (CONTEXT.md «Trabajo»), y la app
 *   no tiene ninguna pantalla de detalle de trabajo — `Inteligencia` sólo avisa que faltan gastos por
 *   asignar. `null` (rótulo) hasta que exista una; llevar a Inteligencia sería «una pantalla que no
 *   muestra ese trabajo», peor que un rótulo honesto.
 */
export type RutaDestino =
  | { tipo: 'conexion'; servicio: string }
  | { tipo: 'comprobante'; comprobanteId: string }
  | { tipo: 'certificado' };

/** Un id de fila de Postgres. `app/facturacion.tsx` aplica la misma guarda: un valor que no sea entero
 *  abriría «borrador nuevo» en vez de un error, que es peor que no navegar. */
const ID_NUMERICO = /^\d+$/;

export function rutaDeDestino(destino: DestinoTarjeta | null | undefined): RutaDestino | null {
  if (destino == null) return null;
  switch (destino.tipo) {
    case 'conexion':
      return destino.id != null ? { tipo: 'conexion', servicio: destino.id } : null;
    case 'comprobante':
      return destino.id != null && ID_NUMERICO.test(destino.id)
        ? { tipo: 'comprobante', comprobanteId: destino.id }
        : null;
    case 'certificado':
      return { tipo: 'certificado' };
    default:
      return null;
  }
}

/** A dónde empuja el shell cada ruta: la ÚNICA tabla ruta→pantalla de Mi día. Pura, sin importar
 *  `expo-router`: el shell la pasa a `empujarUnaVez`. */
export function hrefDeRuta(ruta: RutaDestino): string | { pathname: string; params: Record<string, string> } {
  switch (ruta.tipo) {
    case 'conexion':
      return { pathname: '/apps', params: { servicio: ruta.servicio } };
    case 'comprobante':
      return { pathname: '/facturacion', params: { comprobanteId: ruta.comprobanteId } };
    case 'certificado':
      return '/ajustes-afip';
  }
}
