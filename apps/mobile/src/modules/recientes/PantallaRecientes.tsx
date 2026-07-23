import { listarActividad } from '@copiloto/core';

import { ListaActividad } from '../actividad/ListaActividad';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';

/**
 * "Recientes" — **toda** la actividad del emprendedor, con scroll infinito.
 *
 * ⚠️ **La máquina de estados (cursor, scroll infinito, tirón, guard de unmount, los cuatro estados) se
 * extrajo a `ListaActividad`** el 2026-07-22, para que el listado por función y el panel del swipe-left
 * del principal reusen exactamente el mismo componente sobre `/actividad` — una sola implementación, no
 * seis copias divergentes (la divergencia entre glasses fue la causa del bug del minimizado). Esta
 * pantalla es hoy sólo el marco + la fuente **sin filtro** (toda la actividad).
 *
 * 🔴 **La barra de búsqueda NO vive acá.** El buscador es por FUNCIÓN (`/actividad?funcion=X&q=`), no en
 * este listado global; y `q` hoy da 400 hasta que backend lo mergee (`[CONNECT]`). Una barra global que
 * no filtra sería peor que ninguna: el usuario escribe, ve la misma lista, y concluye que no hay
 * resultados.
 *
 * 🔴 **`fuente={listarActividad}`**: la función-módulo tal cual, referencia estable — sin envolverla en
 * un closure nuevo por render (que re-dispararía la carga en loop). Al no pasar `funcion`/`q`, trae la
 * actividad completa.
 */
export function PantallaRecientes() {
  return (
    <MarcoGlass titulo="Recientes" icono="clock" testID="pantalla-recientes">
      <ListaActividad
        fuente={listarActividad}
        testIDBase="recientes"
        textoVacio="Todavía no hay movimientos. Lo que factures, presupuestes o gastes va a aparecer acá."
        textoNoDisponible="Tu actividad todavía no está disponible en tu copiloto."
        textoError="No pudimos cargar tu actividad. Tirá hacia abajo para reintentar."
      />
    </MarcoGlass>
  );
}
