"""Derivador del grafo — capa 1: el MOTOR DE INVALIDACIÓN, agnóstico de ontología (Hito 5 §1.2).

El derivador convierte el log `copiloto_eventos` (§1.1) en escrituras al grafo. Tiene dos partes:

  1. **Este módulo — el motor de invalidación (supersesión):** lee el stream del log y decide, para
     cada arista de ESTADO, qué evento supera a cuál. Es PURA LÓGICA sobre el vocabulario del log
     (`entidad_tipo`, `entidad_id`, `campo`, `ocurrido_en`), sin tocar tipos de ontología ni Graphity.
  2. La capa de mapeo (aparte) que convierte cada evento en un `Dataset`/`Invalidacion` del grafo
     (`fact_template`, `source_targets`, identidad uuid5). Esa capa depende del addendum de ontología
     §1.3 y vive fuera de acá.

**Por qué la supersesión es lo primero, y por qué se prueba sola** (`ontologia-grafo-negocio-v1.md`
§7.1.bis): el servidor **jamás** invalida por su cuenta en el camino determinista — `invalid_at` sólo
se escribe con un `PATCH` explícito. Si se ingestan los 6 meses y no se invalida nada, un concepto que
cambió tres veces de precio queda con **tres precios vigentes a la vez**, sin error. Invalida el
derivador, que puede porque lee el log: el evento N+1 sobre la misma `(entidad, campo)` supera al N.

🔴 **Dos modos del mismo derivador, y el dataset sólo ejercita uno:**

- **histórico** — conoce el futuro de cada hecho (tiene los 6 meses) y calcula TODAS las invalidaciones
  de una vez. Es la carga inicial.
- **incremental** — sólo puede invalidar cuando LLEGA el evento siguiente, sin saber si va a llegar.
  Es producción.

Si sólo se prueba la carga de golpe, el modo incremental **nunca se ejercitó**. El invariante que este
módulo garantiza —y que el test hace explícito— es que **los dos modos producen exactamente las mismas
invalidaciones** (DoD: "las invalidaciones salen igual"). Si difieren, uno de los dos está mal.

**Qué es una arista de estado, sin ontología:** un evento del log con `campo` seteado
(`precio`/`estado`/`imputacion`) es una transición de estado; su clave es
`(entidad_tipo, entidad_id, campo)`. Un evento con `campo=None` (un cobro, un gasto creado, una factura
emitida como HECHO) es un EVENTO puro: nunca supera ni es superado (§2.1). Cada transición es, por
§2.3, un evento distinto identificado por su `orden` (el `id` bigserial del log) — así volver a un
precio anterior es un evento NUEVO que supera al vigente, no el mismo par que resucita al invalidado.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass


@dataclass(frozen=True)
class EventoLog:
    """Un renglón del log reducido a lo que el motor de invalidación necesita. `orden` es la identidad
    del evento —el `id` bigserial de `copiloto_eventos`, o el índice estable del dataset sintético— y
    es también el desempate cuando dos eventos comparten `ocurrido_en`."""
    orden: int
    entidad_tipo: str
    entidad_id: str
    campo: str | None
    ocurrido_en: datetime.datetime

    @property
    def clave(self) -> tuple[str, str, str] | None:
        """La identidad de la arista de ESTADO que este evento toca, o `None` si es un evento puro."""
        if self.campo is None:
            return None
        return (self.entidad_tipo, self.entidad_id, self.campo)


@dataclass(frozen=True)
class Supersesion:
    """Un evento de estado (`superado`) quedó obsoleto porque llegó otro (`superador`) sobre la misma
    `clave`. La arista del `superado` se invalida con `invalid_at` = el instante del `superador`."""
    clave: tuple[str, str, str]
    superado: int          # orden del evento invalidado
    superador: int         # orden del evento que lo supera
    invalid_at: datetime.datetime

    def _key(self):
        return (self.clave, self.superado, self.superador, self.invalid_at)


def _orden_estable(eventos: list[EventoLog]) -> list[EventoLog]:
    """Orden canónico de proceso: por `ocurrido_en`, desempatando por `orden`. Dos corridas del mismo
    log dan la misma secuencia — precondición para que histórico e incremental sean comparables."""
    return sorted(eventos, key=lambda e: (e.ocurrido_en, e.orden))


def invalidaciones_historico(eventos: list[EventoLog]) -> list[Supersesion]:
    """Modo carga inicial: con TODOS los eventos a la vista, para cada arista de estado, todos los
    eventos menos el último quedan superados por el que le sigue en el tiempo.

    Devuelto ordenado por `superado` para comparación estable con el modo incremental.
    """
    por_clave: dict[tuple, list[EventoLog]] = {}
    for e in _orden_estable(eventos):
        if e.clave is not None:
            por_clave.setdefault(e.clave, []).append(e)

    sup: list[Supersesion] = []
    for clave, secuencia in por_clave.items():
        # secuencia ya viene en orden temporal (venía de _orden_estable); cada uno supera al anterior.
        for anterior, siguiente in zip(secuencia, secuencia[1:]):
            sup.append(Supersesion(clave=clave, superado=anterior.orden,
                                   superador=siguiente.orden, invalid_at=siguiente.ocurrido_en))
    return sorted(sup, key=Supersesion._key)


def invalidaciones_incremental(eventos: list[EventoLog]) -> list[Supersesion]:
    """Modo producción: los eventos llegan uno por uno en orden temporal. Se mantiene el evento
    VIGENTE por clave; cuando llega uno nuevo sobre una clave ya vista, se emite la invalidación del
    vigente (con `invalid_at` = el instante del recién llegado) y el nuevo pasa a ser el vigente.

    Sin conocer el futuro: en el momento de procesar el evento N no se sabe si vendrá N+1. La
    invalidación de N se emite recién cuando N+1 aparece — que es lo único que un sistema en vivo puede
    hacer. El resultado, sin embargo, tiene que ser IDÉNTICO al histórico (ver el test de equivalencia).
    """
    vigente: dict[tuple, EventoLog] = {}
    sup: list[Supersesion] = []
    for e in _orden_estable(eventos):
        if e.clave is None:
            continue
        previo = vigente.get(e.clave)
        if previo is not None:
            sup.append(Supersesion(clave=e.clave, superado=previo.orden,
                                   superador=e.orden, invalid_at=e.ocurrido_en))
        vigente[e.clave] = e
    return sorted(sup, key=Supersesion._key)


def vigentes(eventos: list[EventoLog]) -> dict[tuple[str, str, str], int]:
    """El `orden` del evento VIGENTE por cada arista de estado — el que NO fue superado por ninguno.
    Es lo que sigue vivo en el grafo después de aplicar todas las invalidaciones."""
    ult: dict[tuple, EventoLog] = {}
    for e in _orden_estable(eventos):
        if e.clave is not None:
            ult[e.clave] = e
    return {clave: e.orden for clave, e in ult.items()}


def eventos_desde_sinteticos(sinteticos) -> list[EventoLog]:
    """Adapta el dataset sintético (`grafo_dataset.EventoSintetico`) al `EventoLog` del motor. El
    `orden` sale del índice tras ordenar cronológicamente —el dataset ya viene ordenado—, que emula el
    `id` bigserial monotónico del log real (más viejo = id menor)."""
    ordenados = sorted(sinteticos, key=lambda s: s.ocurrido_en)
    return [EventoLog(orden=i, entidad_tipo=s.entidad_tipo, entidad_id=s.entidad_id,
                      campo=s.campo, ocurrido_en=s.ocurrido_en)
            for i, s in enumerate(ordenados)]
