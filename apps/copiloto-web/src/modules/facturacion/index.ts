// Barrel del módulo Facturación (M-WEB). PR1: wizard. PR2: comprobante + cobro. PR3: mis comprobantes
// + anulación + detalle. PR4: te deben + integración final.
export { PantallaFacturacion, type PantallaFacturacionProps } from './PantallaFacturacion';
export { derivarPasoVisible, esRechazoPorFaltaDeCertificado, type PasoVisible } from './maquinaEstado';
export { TarjetaComprobante, type TarjetaComprobanteProps } from './TarjetaComprobante';
export { SeccionCobro, type SeccionCobroProps } from './SeccionCobro';
export { SeccionMeDeben, type SeccionMeDebenHandle, type SeccionMeDebenProps } from './SeccionMeDeben';
export {
  SeccionMisComprobantes,
  type SeccionMisComprobantesHandle,
  type SeccionMisComprobantesProps,
} from './SeccionMisComprobantes';
export { DetalleComprobante, type DetalleComprobanteProps } from './DetalleComprobante';
export { nombreTipoComprobante, tituloComprobante, tituloComprobanteConTotal } from './etiquetasComprobante';
