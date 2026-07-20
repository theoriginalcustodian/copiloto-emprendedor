/**
 * Barrel de los adaptadores de audio nativos (Task 2/3 acá; `almacen.native`/`indice.native`/
 * `hasher.native` los suman otras tareas en paralelo -- cada una agrega SU export acá, nadie pisa
 * el de otro).
 */
export { crearGrabadorNativo } from './grabador.native';
