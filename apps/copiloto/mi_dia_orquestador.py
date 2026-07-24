"""Orquesta el pipeline completo del hito 7 (contrato §1): DETECTAR → PRIORIZAR → REDACTAR → ENTREGAR.

Un solo punto de entrada, `avanzar_tablero()`. Hoy lo llama `GET /mi-dia/tablero` en cada request
— interino: corre el detector completo en el camino de lectura, no en un Schedule.

⚠️ DEUDA DELIBERADA Y VISIBLE. El contrato §1.1 pide Temporal Schedule (una corrida diaria, durable,
con historial de por qué un día no salió nada). Correrlo desde el GET funciona hoy (determinista,
mismo resultado que tendría el Schedule) pero: (a) recalcula todo en cada tablero abierto, más caro
de lo necesario; (b) sin Schedule no hay "una vez a la mañana" ni recuperación si el server se
reinicia a mitad de una corrida. Propietario: BACKEND. Condición de pago: cuando el Schedule +
workflow estén listos (`temporal-developer`/`temporal-ai-patterns` obligatorias, contrato §4) —
el cambio es sólo QUIÉN llama a `avanzar_tablero`, la función y su contrato no cambian.
"""
from __future__ import annotations

from typing import Callable

from mi_dia_detector import (REGLA_FACTURAS_IMPAGAS_VIEJAS, REGLA_PRESUPUESTOS_ENFRIANDOSE,
                             REGLA_TRABAJO_MARGEN_NEGATIVO, REGLAS_AUTO_CIERRE,
                             AvisosEmitidosStore, detectar_todos)
from mi_dia_tarjeta_store import TarjetaStore

_PLANTILLAS = {
    REGLA_PRESUPUESTOS_ENFRIANDOSE:
        lambda d: (f"El presupuesto {d.get('numero') or ''} de {d.get('cliente') or 'un cliente'} "
                  f"lleva más de 30 días sin respuesta."),
    REGLA_FACTURAS_IMPAGAS_VIEJAS:
        lambda d: (f"La factura {d.get('nro') or ''} de {d.get('cliente') or 'un cliente'} sigue "
                  f"impaga hace {d.get('dias')} días."),
    REGLA_TRABAJO_MARGEN_NEGATIVO:
        lambda d: f"El trabajo de {d.get('etiqueta') or 'un cliente'} te dejó ${d.get('margen')} en contra.",
}


def _redactar_plantilla(regla: str, datos: dict) -> str:
    """REDACTAR con plantilla (contrato §1: "si el LLM se cae, el aviso sale igual con la
    plantilla"). Construir esto PRIMERO, y el LLM como mejora encima después, es la versión
    robusta — nunca al revés: así el DoD "con el LLM caído, el aviso sale igual" es gratis, no un
    caso especial a mantener aparte."""
    plantilla = _PLANTILLAS.get(regla)
    return plantilla(datos or {}) if plantilla else f"Aviso: {regla}."


def avanzar_tablero(conn_factory: Callable, cliente_id: str) -> dict:
    """Corre el pipeline entero y devuelve el tablero YA actualizado
    (`TarjetaStore.listar_tablero`).

    - **ENTREGAR:** por cada regla, filtra los candidatos silenciados (`AvisosEmitidosStore`) y
      crea tarjeta + emite silencio SÓLO para los nuevos.
    - **Reconciliar (§2.1):** para `REGLAS_AUTO_CIERRE`, cierra las tarjetas cuyo candidato ya no
      está en la verdad CRUDA de `detectar_todos()` — no en la lista filtrada por silencio, porque
      un candidato silenciado sigue siendo VERDADERO (ver docstring de `detectar_todos`); filtrar
      por silencio acá cerraría por error tarjetas de algo que sigue vigente.
    """
    crudos = detectar_todos(conn_factory, cliente_id)
    avisos = AvisosEmitidosStore(conn_factory, cliente_id)
    tarjetas = TarjetaStore(conn_factory, cliente_id)

    for regla, candidatos in crudos.items():
        silenciados = avisos.silenciados(regla)
        for c in candidatos:
            if str(c["entidad_id"]) in silenciados:
                continue
            texto = _redactar_plantilla(regla, c["datos"])
            tarjetas.crear_si_no_existe(regla, c["entidad_tipo"], c["entidad_id"], texto, c["datos"])
            avisos.emitir(regla, c["entidad_tipo"], c["entidad_id"],
                          dias_silencio=c["dias_silencio"], datos=c["datos"])
        if regla in REGLAS_AUTO_CIERRE:
            vigentes = {str(c["entidad_id"]) for c in candidatos}
            tarjetas.cerrar_resueltas(regla, vigentes)

    return tarjetas.listar_tablero()
