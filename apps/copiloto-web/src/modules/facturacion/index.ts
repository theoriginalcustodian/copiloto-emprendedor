// Barrel del módulo Facturación (M-WEB). PR1: wizard de creación. PR2: comprobante emitido + cobro.
export { PantallaFacturacion, type PantallaFacturacionProps } from './PantallaFacturacion';
export { derivarPasoVisible, esRechazoPorFaltaDeCertificado, type PasoVisible } from './maquinaEstado';
export { TarjetaComprobante, type TarjetaComprobanteProps } from './TarjetaComprobante';
export { SeccionCobro, type SeccionCobroProps } from './SeccionCobro';
export { nombreTipoComprobante, tituloComprobante, tituloComprobanteConTotal } from './etiquetasComprobante';
