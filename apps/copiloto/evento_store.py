"""Log append-only de eventos de negocio (`copiloto_eventos`) — la FUENTE de la que se deriva el grafo.

Hito 5 §1.1. El grafo de Inteligencia de Negocio es una **proyección reconstruible** desde este log
(`docs/ontologia-grafo-negocio-v1.md` §3, decisión (A) del operador).

🔴 **Acoplamiento con la mutación — la verdad, no la que quisiéramos.** Las conexiones de este repo son
**siempre `autocommit=True`** (`worker_b.py`, `onboarding.py`: "cada sentencia es su propia
transacción"). El evento se escribe en el **mismo cursor**, inmediatamente **después** de la mutación,
pero como cada `execute` commitea solo, **NO es atómico**: es un *append best-effort inmediato*. La
ventana de riesgo —el proceso muere entre el commit de la mutación y el del evento— deja un hecho sin
su evento. Es angosta y **tolerable en esta etapa**, por dos razones concretas:

- El dataset sintético que itera la ontología **NO pasa por estos ganchos**: escribe el log directo
  (ver `registrar_evento`). O sea, el uso que *decide hoy* (§3) no depende de la atomicidad del gancho.
- No hay clientes reales todavía; la reconciliación log↔DB de producción es asunto del derivador (§1.2).

⚠️ **DEUDA DELIBERADA Y VISIBLE.** Acoplar evento+mutación de forma atómica exige envolver cada método
mutador en una transacción explícita (`autocommit=False` + `commit`), y eso toca métodos verificados
E2E (facturación, cobros) cuya recuperación de idempotencia asume autocommit. **Propietario: BACKEND.
Condición de pago: primer cliente real, o el día que se observe una divergencia log↔DB.** Coherente
mientras tanto con la filosofía del repo: idempotencia por índice único, no por transacción.

**Qué se registra (§1.1):** eventos económicos (comprobante, gasto, presupuesto, cobro) y cambios de
precio/estado. **Qué NO:** ediciones de la ficha del cliente — domicilio, mail y teléfono no son
información de negocio (§0.bis), y dejarlos afuera achica mucho la superficie del gancho.

**Por qué el `id bigserial` importa (§2.3):** la identidad de una arista de estado no puede ser
`(source, tipo, target)`. Un precio que baja y vuelve al valor anterior generaría el `uuid5` de la
arista ya invalidada, y el re-POST la **resucita** (trampa 4: `SET e = edge` pisa `invalid_at` con
`None`). La clave incluye **el evento del log que la originó** — este `id`. Ese uso vive en el
derivador (§1.2); acá sólo se garantiza que el id exista, sea estable y monotónico.

**Multi-tenant:** `cliente_id` explícito en cada fila. El rol de `DATABASE_URL` es dueño y **bypassea
RLS** (igual que el resto de los stores), así que el filtro por `cliente_id` en la lectura es la
barrera efectiva —con test adversarial—; el `tenant_isolation` de la tabla es la segunda red.
"""
from __future__ import annotations

import json

_SCHEMA = "uc_factory"
_TABLE = f"{_SCHEMA}.copiloto_eventos"


def _js(valor):
    """Serializa a texto JSON para el cast `::jsonb`, o `None` (→ NULL, no el string "null").

    `default=str` cubre lo que `json` no sabe serializar y acá abunda: `Decimal` (montos y precios) y
    `date`/`datetime` (fechas de negocio). Sin esto, un monto `Decimal` tiraría `TypeError` al loggear
    —justo en el gancho de la mutación— y tumbaría la operación que el log venía a acompañar.
    """
    return None if valor is None else json.dumps(valor, ensure_ascii=False, default=str)


def registrar_evento(cur, cliente_id: str, *, entidad_tipo: str, entidad_id, evento: str,
                     ocurrido_en=None, campo: str | None = None,
                     valor_de=None, valor_a=None, datos: dict | None = None) -> None:
    """Inserta un evento en el log, **usando el `cur` de la mutación** (misma conexión).

    No abre ni cierra conexión: recibe el cursor del método mutador para escribir el evento pegado a
    su hecho, con los mismos datos ya calculados. Bajo `autocommit=True` (ver el docstring del módulo)
    cada `execute` commitea solo, así que esto NO es un commit compartido — es el append inmediato del
    evento justo después de que la mutación se persistió. Llamarlo **sólo** en el camino donde la
    mutación efectivamente escribió (nunca en un replay idempotente que devuelve algo que ya existía).

    `entidad_id` se guarda como texto: las claves naturales del dominio son heterogéneas
    (`numero` de presupuesto, `payment_id`, `cuit|tipo|pv|nro` de comprobante, id de fila de gasto).
    El derivador (§1.2) decide cómo mapear cada una a la identidad del nodo; el log sólo la conserva.

    `ocurrido_en` es el `valid_at` del hecho. Los **eventos económicos** traen su propia fecha de
    negocio (la del cobro, el gasto, el comprobante) y la pasan. Los **cambios de precio/estado**
    ocurren en el momento en que el emprendedor los hace: pasan `None` y se estampa `now()` del
    servidor —no una fecha de negocio inventada—. (El dataset sintético backdatea escribiendo el log
    directo, no por estos ganchos, así que acá `now()` es siempre lo correcto.)

    `campo`/`valor_de`/`valor_a` describen un **cambio de estado** (de→a, §1.1): p.ej.
    `campo='precio', valor_de='85000.00', valor_a='95000.00'`. En un evento de creación quedan en
    `None`. `datos` es el snapshot que el derivador interpola en el `fact_template` —todo lo que
    Inteligencia de Negocio vaya a **leer** tiene que estar acá, porque `/search` no proyecta
    `attributes` (trampa 6)—: montos, categoría, medio, origen, cliente, fecha.
    """
    if ocurrido_en is None:
        ocurrido_frag, ocurrido_param = "now()", ()
    else:
        ocurrido_frag, ocurrido_param = "%s", (ocurrido_en,)
    cur.execute(
        f"INSERT INTO {_TABLE} "
        f"(cliente_id, entidad_tipo, entidad_id, evento, campo, valor_de, valor_a, datos, ocurrido_en) "
        f"VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, {ocurrido_frag})",
        (cliente_id, entidad_tipo, str(entidad_id), evento, campo,
         _js(valor_de), _js(valor_a), _js(datos if datos is not None else {}), *ocurrido_param))
