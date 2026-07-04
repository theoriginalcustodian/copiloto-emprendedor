// Barrel del módulo Conexiones (Task 20). `useConnections` se re-exporta para que el shell
// desktop (fase futura) pueda reusar la LÓGICA sin duplicarla (principio de arquitectura del
// módulo: lógica en el hook, presentación en los componentes).
export { ConnectionsScreen } from './ConnectionsScreen';
export { ServiceCard, type ServiceCardProps, type ServiceCardState } from './ServiceCard';
export {
  useConnections,
  type ConnectionsGroup,
  type ConnectionsStatus,
  type UseConnectionsResult,
} from './useConnections';
