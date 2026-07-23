"""Mapeo de dominio: el log de negocio → `Dataset`/`Invalidacion` del grafo — Hito 5 §1.3.

Es la capa que traduce el vocabulario del log (`copiloto_eventos`) a la ontología del grafo de negocio
(`docs/ontologia-grafo-negocio-v1.md` + `addendum_..._ontologia-tipos-congelados`). El motor de
invalidación (`derivador`, agnóstico de ontología) decide QUÉ evento supera a cuál; este módulo decide
QUÉ arista es cada evento, con qué `fact_template` y con qué identidad `uuid5`. Portado del patrón de
`documed/apps/documed/graph_mapping.py` (la fuente canónica, regla 3.ter) — sin nada clínico.

**El eje es el ciclo del dinero** (§0.bis): `Concepto → Presupuesto → Factura → Cobro` (lo que entra),
`Gasto → Proveedor` (lo que sale). Cada `fact_template` es una frase autocontenida con sus números y su
fecha adentro: `/search` y `/traverse` NO proyectan `attributes` (trampa 6), así que lo que
Inteligencia de Negocio vaya a leer TIENE que estar interpolado en el texto del hecho, no sólo en el
`property_map`.

🔴 **La identidad NO se toca en la fórmula de la arista.** El server calcula el uuid de arista con
`edge_uuid(group, src_uuid, edge_type, tgt_uuid)` — función de los uuid de los NODOS, verificado
idéntico en los dos lados (`ingesta-determinista-grafo.md` §2). El discriminador de evento (la clave
natural del EVENTO, o el `LOG_EVENT_ID` de una transición de estado) entra por la **clave del nodo
destino**, nunca por la fórmula de la arista. Meterlo en la fórmula haría que el `PATCH` de invalidación
apunte a un uuid que el server nunca persistió — y no falla: devuelve vacío (trampa 4).

**Aristas de EVENTO (esta entrega) — nunca se invalidan.** Su identidad ya es única por la clave natural
del EVENTO (un `Comprobante` es `cuit|tipo|pv|nro`, un `Cobro` su `idem_key`, un `Presupuesto` su
`numero`, un `Gasto` su id de fila): dos menciones del mismo hecho convergen, dos hechos distintos nunca
colisionan. Por eso `aristas_estables = ()` para todas: ningún re-POST puede resucitar nada.

**Aristas de ESTADO** — resueltas por la decisión de planificación (00:07) sobre el
`hallazgo_..._identidad-arista-estado-no-es-la-formula-del-server`: el `LOG_EVENT_ID` (el `orden`/id del
log que originó la transición) va en la **clave del NODO destino**, nunca en la fórmula de la arista.
Dos nodos-evento nuevos (no deduplicados, per-transición): `Estado` (`{estado}|{LOG_EVENT_ID}`, target de
`ESTADO_PRESUPUESTO`/`ESTADO_COMPROBANTE`), `Precio` (`{concepto_key}|{fecha}|{LOG_EVENT_ID}`, target de
`PRECIO_DE`, con segundo salto `DE_CONCEPTO`→`Concepto`) e `Imputacion` (`{gasto_key}|{ref_key}|
{LOG_EVENT_ID}`, target de `IMPUTADO_A`, con segundo salto `AL_TRABAJO`→el ref estable). Cada transición
cae en un `node_uuid` distinto → `edge_uuid` distinto → invalidar la anterior nunca resucita nada
(§2.3). El motor de invalidación (`derivador`) decide QUÉ transición supera a cuál; acá sólo se traduce
esa decisión a `Invalidacion(edge_uuid, invalid_at)` sobre el edge_uuid REAL que el server calculó.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass

from derivador import EventoLog, Supersesion, eventos_desde_sinteticos, invalidaciones_historico
from graph_identity import edge_uuid, node_uuid, normalize_key
from grafo_writer import Dataset, Invalidacion

# ── tipos de entidad y arista de la ontología (v1 §1-2 + addendum) ─────────────────────────────────
NEGOCIO, CLIENTE, PROVEEDOR, CONCEPTO = "Negocio", "Cliente", "Proveedor", "Concepto"
COMPROBANTE, GASTO, PRESUPUESTO, COBRO = "Comprobante", "Gasto", "Presupuesto", "Cobro"

EMITIO, FACTURADO_A = "EMITIO", "FACTURADO_A"
REGISTRO_GASTO, PAGADO_A = "REGISTRO_GASTO", "PAGADO_A"
E_PRESUPUESTO, DIRIGIDO_A, INCLUYE, REEMPLAZA_A = "PRESUPUESTO", "DIRIGIDO_A", "INCLUYE", "REEMPLAZA_A"
E_COBRO = "COBRO"

# ── nodos-evento de estado (decisión planificación 00:07) y sus aristas ────────────────────────────
ESTADO, PRECIO, IMPUTACION = "Estado", "Precio", "Imputacion"
ESTADO_PRESUPUESTO, ESTADO_COMPROBANTE = "ESTADO_PRESUPUESTO", "ESTADO_COMPROBANTE"
PRECIO_DE, DE_CONCEPTO = "PRECIO_DE", "DE_CONCEPTO"
IMPUTADO_A, AL_TRABAJO = "IMPUTADO_A", "AL_TRABAJO"

# valor_a de "gasto/imputado" trae {"eslabon": "...", "ref": "..."} — el eslabon nombra el tipo del ref.
_ESLABON_A_TIPO = {"comprobante": COMPROBANTE, "presupuesto": PRESUPUESTO, "cobro": COBRO}


def _fecha(dt: datetime.datetime) -> str:
    """La fecha legible que va en el `fact_template` (`el {fecha}`) — sólo el día, en ISO."""
    return dt.date().isoformat()


def _clave_cliente(nombre: str | None, doc_nro: str | None = None) -> str | None:
    """Clave natural del `Cliente` (v1 §1.1): `doc_nro` si existe; si no, el nombre normalizado. Reusa
    la lógica del índice único de `copiloto_clientes` — no inventar otra, o el grafo y la base discrepan
    sobre qué es el mismo cliente. [ASSUMED_PENDING_VERIFY]: el homónimo de la clave real
    (`nombre_normalizado|homonimo`) no está en el dataset sintético, que sólo trae nombre; para el alta
    real, la clave sale de `copiloto_clientes`, no de acá."""
    if doc_nro:
        return str(doc_nro)
    return normalize_key(nombre) if nombre else None


def _clave_estado(estado: str, log_event_id: int) -> str:
    """Clave del nodo-evento `Estado`: per-transición vía `log_event_id` — dos presupuestos que llegan
    al mismo estado ("aprobado") en momentos distintos son nodos DISTINTOS, así que invalidar el viejo
    nunca resucita al nuevo (§2.3, decisión planificación 00:07)."""
    return f"{estado}|{log_event_id}"


def _clave_precio(concepto_key: str, fecha: str, log_event_id: int) -> str:
    """Clave del nodo-evento `Precio`. `concepto_key`+`fecha` son legibilidad; el `log_event_id` es el
    disambiguador OBLIGATORIO — sin él, volver al precio anterior generaría la misma clave que la
    primera vez que ese precio existió, y el uuid5 resucitaría la arista ya invalidada."""
    return f"{concepto_key}|{fecha}|{log_event_id}"


def _clave_imputacion(gasto_key: str, ref_key: str, log_event_id: int) -> str:
    """Clave del nodo-evento `Imputacion`. Re-imputar el MISMO gasto al MISMO ref (posible: deshacer y
    rehacer) tiene que dar un nodo nuevo — de ahí el `log_event_id`."""
    return f"{gasto_key}|{ref_key}|{log_event_id}"


# ── acumulador de aristas homogéneas (un POST por edge_type) ───────────────────────────────────────
class _AcumuladorArista:
    """Junta las filas de UN tipo de arista (mismo source_entity + mismo edge_type) para armar UN
    dataset. Espeja `_dataset_pac_edge` de documed: cada dataset declara una entidad raíz y UNA arista
    saliente; todo lo que sale de otra raíz es otro dataset."""

    def __init__(self, *, source_type: str, source_name_col: str, source_id_col: str,
                 edge_type: str, target_type: str, target_col: str, target_id_col: str,
                 fact_template: str, property_cols: tuple[str, ...],
                 target_property_cols: tuple[str, ...] = ()) -> None:
        self._src_type = source_type
        self._src_name = source_name_col
        self._src_id = source_id_col
        self._edge_type = edge_type
        self._tgt_type = target_type
        self._tgt_col = target_col
        self._tgt_id = target_id_col
        self._fact = fact_template
        self._prop_cols = property_cols
        self._tgt_prop_cols = target_property_cols
        self._rows: list[dict] = []

    def agregar(self, row: dict) -> None:
        self._rows.append(row)

    @property
    def vacio(self) -> bool:
        return not self._rows

    def _mapping(self) -> dict:
        edge = {
            "column": self._tgt_col,
            "target_entity_type": self._tgt_type,
            "target_external_id_column": self._tgt_id,
            "edge_type": self._edge_type,
            "valid_at_column": "valid_at",
            # Sólo lo que el fact_template lee TIENE que estar acá (trampa 9): una columna ausente del
            # property_map no es legible por el fact, y un atributo llamado source/edge/target da 422.
            "property_map": {c: c for c in self._prop_cols},
            "fact_template": self._fact,
            "target_property_map": {c: c for c in self._tgt_prop_cols},
        }
        return {"source_entity": {
            "entity_type": self._src_type,
            "name_column": self._src_name,
            "external_id_column": self._src_id,
            "edges": [edge],
        }}

    def dataset(self, group_logico: str) -> Dataset:
        """El `Dataset` para el writer. `aristas_estables=()`: una arista de EVENTO es única por la clave
        natural del evento y ningún re-POST la puede hacer colisionar con una invalidada — no necesita el
        guard anti-resurrección (que es sólo para identidad estable entre corridas)."""
        return Dataset(mapping=self._mapping(), rows=tuple(self._rows), aristas_estables=())

    def edge_uuids(self, group_logico: str) -> list[str]:
        """Los `edge_uuid` que este dataset va a materializar — la proyección que el caller usa para
        excluirlos de las invalidaciones (CRITICAL-1) y para los tests de identidad. Misma cuenta que el
        server: `node_uuid` de src y tgt, luego `edge_uuid`."""
        out: list[str] = []
        for row in self._rows:
            src_key, tgt_key = row.get(self._src_id), row.get(self._tgt_id)
            if not src_key or not tgt_key:
                continue
            src_uuid = node_uuid(group_logico, self._src_type, src_key)
            tgt_uuid = node_uuid(group_logico, self._tgt_type, tgt_key)
            out.append(edge_uuid(group_logico, src_uuid, self._edge_type, tgt_uuid))
        return out


# ── el mapeo de EVENTO ─────────────────────────────────────────────────────────────────────────────
class MapeadorEvento:
    """Recorre el stream del log y acumula las 9 aristas de EVENTO. Construir con la identidad del
    negocio (raíz de casi todas las aristas) y `hoy`; `datasets()` devuelve la lista para el writer."""

    def __init__(self, *, negocio_key: str, negocio_nombre: str) -> None:
        self._neg_key = negocio_key
        self._neg_nombre = negocio_nombre
        self._acc = self._acumuladores()

    def _acumuladores(self) -> dict[str, _AcumuladorArista]:
        ng = dict(source_type=NEGOCIO, source_name_col="negocio_nombre", source_id_col="negocio_key")
        return {
            EMITIO: _AcumuladorArista(
                **ng, edge_type=EMITIO, target_type=COMPROBANTE, target_col="comprobante_label",
                target_id_col="comprobante_key",
                fact_template="{source} emitió la factura {tipo} {pto}-{nro} por ${total} el {fecha}",
                property_cols=("tipo", "pto", "nro", "total", "fecha")),
            FACTURADO_A: _AcumuladorArista(
                source_type=COMPROBANTE, source_name_col="comprobante_label",
                source_id_col="comprobante_key", edge_type=FACTURADO_A, target_type=CLIENTE,
                target_col="cliente_nombre", target_id_col="cliente_key",
                fact_template="La factura {pto}-{nro} de ${total} fue emitida a {target} el {fecha}",
                property_cols=("pto", "nro", "total", "fecha")),
            REGISTRO_GASTO: _AcumuladorArista(
                **ng, edge_type=REGISTRO_GASTO, target_type=GASTO, target_col="gasto_label",
                target_id_col="gasto_key",
                fact_template="{source} gastó ${monto} en {categoria} el {fecha}",
                property_cols=("monto", "categoria", "fecha")),
            PAGADO_A: _AcumuladorArista(
                source_type=GASTO, source_name_col="gasto_label", source_id_col="gasto_key",
                edge_type=PAGADO_A, target_type=PROVEEDOR, target_col="proveedor_nombre",
                target_id_col="proveedor_key",
                fact_template="Un gasto de ${monto} en {categoria} se pagó a {target} el {fecha}",
                property_cols=("monto", "categoria", "fecha")),
            E_PRESUPUESTO: _AcumuladorArista(
                **ng, edge_type=E_PRESUPUESTO, target_type=PRESUPUESTO, target_col="presupuesto_label",
                target_id_col="presupuesto_key",
                fact_template="{source} presupuestó ${total} por {concepto} el {fecha}",
                property_cols=("total", "concepto", "fecha")),
            DIRIGIDO_A: _AcumuladorArista(
                source_type=PRESUPUESTO, source_name_col="presupuesto_label",
                source_id_col="presupuesto_key", edge_type=DIRIGIDO_A, target_type=CLIENTE,
                target_col="cliente_nombre", target_id_col="cliente_key",
                fact_template="El presupuesto {numero} de ${total} fue para {target} el {fecha}",
                property_cols=("numero", "total", "fecha")),
            INCLUYE: _AcumuladorArista(
                source_type=PRESUPUESTO, source_name_col="presupuesto_label",
                source_id_col="presupuesto_key", edge_type=INCLUYE, target_type=CONCEPTO,
                target_col="concepto_nombre", target_id_col="concepto_key",
                fact_template="El presupuesto {numero} incluye {cantidad} × {target} a ${precio_unitario} c/u",
                property_cols=("numero", "cantidad", "precio_unitario")),
            E_COBRO: _AcumuladorArista(
                **ng, edge_type=E_COBRO, target_type=COBRO, target_col="cobro_label",
                target_id_col="cobro_key",
                fact_template="{source} cobró ${monto} el {fecha} por {medio} ({origen})",
                property_cols=("monto", "fecha", "medio", "origen")),
            REEMPLAZA_A: _AcumuladorArista(
                source_type=PRESUPUESTO, source_name_col="presupuesto_label",
                source_id_col="presupuesto_key", edge_type=REEMPLAZA_A, target_type=PRESUPUESTO,
                target_col="reemplazado_label", target_id_col="reemplazado_key",
                fact_template="El presupuesto {numero} reemplaza al presupuesto {reemplazado_numero} el {fecha}",
                property_cols=("numero", "reemplazado_numero", "fecha")),
        }

    # ── despacho por (entidad_tipo, evento) ───────────────────────────────────────────────────────
    def procesar(self, ev) -> None:
        """Traduce UN evento del log a sus aristas de EVENTO. Los eventos de ESTADO (campo seteado:
        precio/estado/imputacion) NO se tocan acá — son la otra mitad, pendiente del hallazgo."""
        clave = (ev.entidad_tipo, ev.evento)
        if clave == ("comprobante", "emitido"):
            self._comprobante_emitido(ev)
        elif clave == ("cobro", "creado"):
            self._cobro_creado(ev)
        elif clave == ("gasto", "creado"):
            self._gasto_creado(ev)
        elif clave == ("presupuesto", "creado"):
            self._presupuesto_creado(ev)
        # otros (concepto/precio, estado_cambiado, imputado) = ESTADO → otra mitad.

    def _base_negocio(self) -> dict:
        return {"negocio_key": self._neg_key, "negocio_nombre": self._neg_nombre}

    def _comprobante_emitido(self, ev) -> None:
        d = ev.datos
        pto, nro = d.get("punto_venta"), d.get("nro")
        label = f"factura {d.get('tipo_cbte')} {pto}-{nro}"
        fecha = _fecha(ev.ocurrido_en)
        valid_at = ev.ocurrido_en.isoformat()
        comp = {"comprobante_key": ev.entidad_id, "comprobante_label": label}
        self._acc[EMITIO].agregar({**self._base_negocio(), **comp, "valid_at": valid_at,
                                   "tipo": str(d.get("tipo_cbte")), "pto": str(pto), "nro": str(nro),
                                   "total": d.get("total"), "fecha": fecha})
        cliente = d.get("receptor_nombre")
        cli_key = _clave_cliente(cliente)
        if cli_key:
            self._acc[FACTURADO_A].agregar({**comp, "cliente_nombre": cliente, "cliente_key": cli_key,
                                            "valid_at": valid_at, "pto": str(pto), "nro": str(nro),
                                            "total": d.get("total"), "fecha": fecha})

    def _cobro_creado(self, ev) -> None:
        d = ev.datos
        fecha = _fecha(ev.ocurrido_en)
        label = f"cobro de ${d.get('monto')} el {fecha}"
        self._acc[E_COBRO].agregar({**self._base_negocio(),
                                    "cobro_key": ev.entidad_id, "cobro_label": label,
                                    "valid_at": ev.ocurrido_en.isoformat(),
                                    "monto": d.get("monto"), "fecha": fecha,
                                    "medio": d.get("medio"), "origen": d.get("origen")})

    def _gasto_creado(self, ev) -> None:
        d = ev.datos
        fecha = _fecha(ev.ocurrido_en)
        valid_at = ev.ocurrido_en.isoformat()
        label = f"gasto de ${d.get('monto')} en {d.get('categoria')}"
        gasto = {"gasto_key": ev.entidad_id, "gasto_label": label}
        self._acc[REGISTRO_GASTO].agregar({**self._base_negocio(), **gasto, "valid_at": valid_at,
                                           "monto": d.get("monto"), "categoria": d.get("categoria"),
                                           "fecha": fecha})
        proveedor = d.get("proveedor")
        prov_key = normalize_key(proveedor) if proveedor else None
        if prov_key:
            self._acc[PAGADO_A].agregar({**gasto, "proveedor_nombre": proveedor,
                                         "proveedor_key": prov_key, "valid_at": valid_at,
                                         "monto": d.get("monto"), "categoria": d.get("categoria"),
                                         "fecha": fecha})

    def _presupuesto_creado(self, ev) -> None:
        d = ev.datos
        numero = d.get("numero") or ev.entidad_id
        total, concepto = d.get("total"), d.get("concepto")
        fecha = _fecha(ev.ocurrido_en)
        valid_at = ev.ocurrido_en.isoformat()
        label = f"presupuesto {numero}"
        presu = {"presupuesto_key": ev.entidad_id, "presupuesto_label": label}
        self._acc[E_PRESUPUESTO].agregar({**self._base_negocio(), **presu, "valid_at": valid_at,
                                          "total": total, "concepto": concepto, "fecha": fecha})
        cliente = d.get("receptor_nombre")
        cli_key = _clave_cliente(cliente)
        if cli_key:
            self._acc[DIRIGIDO_A].agregar({**presu, "cliente_nombre": cliente, "cliente_key": cli_key,
                                           "valid_at": valid_at, "numero": numero, "total": total,
                                           "fecha": fecha})
        for item in d.get("items") or []:
            desc = item.get("descripcion")
            c_key = normalize_key(desc) if desc else None
            if not c_key:
                continue
            self._acc[INCLUYE].agregar({**presu, "concepto_nombre": desc, "concepto_key": c_key,
                                        "valid_at": valid_at, "numero": numero,
                                        "cantidad": item.get("cantidad"),
                                        "precio_unitario": item.get("precio_unitario")})
        reemplaza = d.get("reemplaza_a")
        if reemplaza:
            self._acc[REEMPLAZA_A].agregar({**presu, "reemplazado_label": f"presupuesto {reemplaza}",
                                            "reemplazado_key": reemplaza, "reemplazado_numero": reemplaza,
                                            "valid_at": valid_at, "numero": numero, "fecha": fecha})

    def datasets(self, group_logico: str) -> list[Dataset]:
        """Los datasets de EVENTO no vacíos, en orden estable de tipo de arista."""
        return [acc.dataset(group_logico) for acc in self._acc.values() if not acc.vacio]

    def edge_uuids(self, group_logico: str) -> list[str]:
        out: list[str] = []
        for acc in self._acc.values():
            out.extend(acc.edge_uuids(group_logico))
        return out


def construir_datasets_evento(eventos, *, group_logico: str, negocio_key: str,
                              negocio_nombre: str) -> list[Dataset]:
    """Punto de entrada de la mitad de EVENTO: el stream del log → los `Dataset` de las 9 aristas de
    evento. Las de ESTADO viven en `construir_datasets_estado`. `group_logico` es SIN el prefijo
    `{tenant}__` (v1 §5.8) — el server lo agrega."""
    mapeador = MapeadorEvento(negocio_key=negocio_key, negocio_nombre=negocio_nombre)
    for ev in eventos:
        mapeador.procesar(ev)
    return mapeador.datasets(group_logico)


# ── el mapeo de ESTADO ──────────────────────────────────────────────────────────────────────────────
class MapeadorEstado:
    """Recorre las transiciones de estado del log (evento con `campo` seteado) y acumula las 4 aristas
    de estado + sus 2 segundos saltos. Cada transición necesita su `LOG_EVENT_ID` (el `orden` que le
    asigna el derivador, §2.3) — por eso `procesar` recibe `(orden, ev)`, no sólo `ev`."""

    def __init__(self, *, negocio_key: str, negocio_nombre: str) -> None:
        self._neg_key = negocio_key
        self._neg_nombre = negocio_nombre
        self._acc: dict[str, _AcumuladorArista] = {}
        self._edge_uuid_por_orden: dict[int, str] = {}   # LOG_EVENT_ID → edge_uuid de SU transición

    def _acumulador(self, clave: str, **kw) -> _AcumuladorArista:
        if clave not in self._acc:
            self._acc[clave] = _AcumuladorArista(**kw)
        return self._acc[clave]

    def _base_negocio(self) -> dict:
        return {"negocio_key": self._neg_key, "negocio_nombre": self._neg_nombre}

    def _registrar(self, group_logico: str, orden: int, *, source_type: str, source_key: str,
                   edge_type: str, target_type: str, target_key: str) -> None:
        """Recuerda el `edge_uuid` que ESTA transición (orden) va a materializar — es lo que
        `edge_uuid_de` le devuelve al caller para armar la `Invalidacion` cuando el derivador diga que
        esta transición fue superada por otra."""
        src = node_uuid(group_logico, source_type, source_key)
        tgt = node_uuid(group_logico, target_type, target_key)
        self._edge_uuid_por_orden[orden] = edge_uuid(group_logico, src, edge_type, tgt)

    # ── despacho por (entidad_tipo, campo) — los 4 ejes de estado, y sólo esos (derivador._clave) ────
    def procesar(self, orden: int, ev, *, group_logico: str) -> None:
        if ev.campo is None:
            return   # evento puro: no es una transición de estado, no toca esta capa.
        if ev.entidad_tipo == "presupuesto" and ev.campo == "estado":
            self._estado_generico(orden, ev, group_logico=group_logico,
                                  edge_key=ESTADO_PRESUPUESTO, source_type=PRESUPUESTO,
                                  source_name=f"presupuesto {ev.entidad_id}", fact_sujeto="El presupuesto")
        elif ev.entidad_tipo == "comprobante" and ev.campo == "estado":
            self._estado_generico(orden, ev, group_logico=group_logico,
                                  edge_key=ESTADO_COMPROBANTE, source_type=COMPROBANTE,
                                  source_name=f"comprobante {ev.entidad_id}", fact_sujeto="El comprobante")
        elif ev.entidad_tipo == "concepto" and ev.campo == "precio":
            self._precio(orden, ev, group_logico=group_logico)
        elif ev.entidad_tipo == "gasto" and ev.campo == "imputacion":
            self._imputacion(orden, ev, group_logico=group_logico)
        # cualquier otro (entidad_tipo, campo) no está en la ontología congelada — se ignora, no inventa.

    def _estado_generico(self, orden: int, ev, *, group_logico: str, edge_key: str, source_type: str,
                         source_name: str, fact_sujeto: str) -> None:
        estado = ev.valor_a
        if not estado:
            return
        fecha = _fecha(ev.ocurrido_en)
        valid_at = ev.ocurrido_en.isoformat()
        estado_key = _clave_estado(estado, orden)
        self._acumulador(
            edge_key, edge_type=edge_key, source_type=source_type,
            source_name_col="fuente_label", source_id_col="fuente_key",
            target_type=ESTADO, target_col="estado_label", target_id_col="estado_key",
            fact_template=fact_sujeto + " {source} pasó a estado {estado} el {fecha}",
            property_cols=("estado", "fecha"),
        ).agregar({"fuente_key": ev.entidad_id, "fuente_label": source_name,
                  "estado_key": estado_key, "estado_label": estado,
                  "valid_at": valid_at, "estado": estado, "fecha": fecha})
        self._registrar(group_logico, orden, source_type=source_type, source_key=ev.entidad_id,
                        edge_type=edge_key, target_type=ESTADO, target_key=estado_key)

    def _precio(self, orden: int, ev, *, group_logico: str) -> None:
        valor = ev.valor_a
        if valor is None:
            return   # el precio se "borró" (no aplica en el dataset hoy) — nada que fijar.
        concepto_key = ev.entidad_id   # grafo_dataset ya lo normaliza (_norm) antes de loggear
        concepto_nombre = (ev.datos or {}).get("nombre", concepto_key)
        fecha = _fecha(ev.ocurrido_en)
        valid_at = ev.ocurrido_en.isoformat()
        precio_key = _clave_precio(concepto_key, fecha, orden)
        precio_label = f"precio de {concepto_nombre} el {fecha}"
        self._acumulador(
            PRECIO_DE, edge_type=PRECIO_DE, source_type=NEGOCIO,
            source_name_col="negocio_nombre", source_id_col="negocio_key",
            target_type=PRECIO, target_col="precio_label", target_id_col="precio_key",
            fact_template="{source} fijó el precio de " + concepto_nombre + " en ${valor} el {fecha}",
            property_cols=("valor", "fecha"),
        ).agregar({**self._base_negocio(), "precio_key": precio_key, "precio_label": precio_label,
                  "valid_at": valid_at, "valor": valor, "fecha": fecha})
        self._registrar(group_logico, orden, source_type=NEGOCIO, source_key=self._neg_key,
                        edge_type=PRECIO_DE, target_type=PRECIO, target_key=precio_key)
        # segundo salto: Precio → Concepto (evento, nunca se invalida — el Concepto sigue estable/dedup)
        self._acumulador(
            DE_CONCEPTO, edge_type=DE_CONCEPTO, source_type=PRECIO,
            source_name_col="precio_label", source_id_col="precio_key",
            target_type=CONCEPTO, target_col="concepto_nombre", target_id_col="concepto_key",
            fact_template="{target} costaba ${valor} desde el {fecha}",
            property_cols=("valor", "fecha"),
        ).agregar({"precio_key": precio_key, "precio_label": precio_label,
                  "concepto_nombre": concepto_nombre, "concepto_key": concepto_key,
                  "valid_at": valid_at, "valor": valor, "fecha": fecha})

    def _imputacion(self, orden: int, ev, *, group_logico: str) -> None:
        d = ev.valor_a or {}
        eslabon, ref = d.get("eslabon"), d.get("ref")
        tipo_ref = _ESLABON_A_TIPO.get(eslabon)
        if not (tipo_ref and ref):
            return   # eslabon fuera de la ontología congelada, o sin ref: no se inventa un target.
        gasto_key = ev.entidad_id
        fecha = _fecha(ev.ocurrido_en)
        valid_at = ev.ocurrido_en.isoformat()
        imp_key = _clave_imputacion(gasto_key, ref, orden)
        imp_label = f"imputación de gasto {gasto_key} a {eslabon}"
        self._acumulador(
            IMPUTADO_A, edge_type=IMPUTADO_A, source_type=GASTO,
            source_name_col="gasto_label", source_id_col="gasto_key",
            target_type=IMPUTACION, target_col="imputacion_label", target_id_col="imputacion_key",
            fact_template="El gasto {source} se imputó a " + eslabon + " el {fecha}",
            property_cols=("fecha",),
        ).agregar({"gasto_key": gasto_key, "gasto_label": f"gasto {gasto_key}",
                  "imputacion_key": imp_key, "imputacion_label": imp_label,
                  "valid_at": valid_at, "fecha": fecha})
        self._registrar(group_logico, orden, source_type=GASTO, source_key=gasto_key,
                        edge_type=IMPUTADO_A, target_type=IMPUTACION, target_key=imp_key)
        # segundo salto: Imputacion → ref (evento, nunca se invalida — el ref sigue estable)
        clave_bucket = f"{AL_TRABAJO}:{tipo_ref}"
        self._acumulador(
            clave_bucket, edge_type=AL_TRABAJO, source_type=IMPUTACION,
            source_name_col="imputacion_label", source_id_col="imputacion_key",
            target_type=tipo_ref, target_col="ref_label", target_id_col="ref_key",
            fact_template="La imputación de {source} apunta al trabajo {target}",
            property_cols=(),
        ).agregar({"imputacion_key": imp_key, "imputacion_label": imp_label,
                  "ref_key": ref, "ref_label": f"{eslabon} {ref}", "valid_at": valid_at})

    def edge_uuid_de(self, orden: int) -> str | None:
        """El `edge_uuid` que la transición `orden` materializó, o `None` si `orden` no era una
        transición de estado (evento puro, o eje fuera de la ontología congelada)."""
        return self._edge_uuid_por_orden.get(orden)

    def datasets(self, group_logico: str) -> list[Dataset]:
        return [acc.dataset(group_logico) for acc in self._acc.values() if not acc.vacio]


def construir_datasets_estado(eventos, *, group_logico: str, negocio_key: str,
                              negocio_nombre: str) -> tuple[list[Dataset], list[Invalidacion]]:
    """Punto de entrada de la mitad de ESTADO: el stream del log → los `Dataset` de las 4 aristas de
    estado (+ sus 2 segundos saltos) y la lista de `Invalidacion` para el writer.

    Reusa el `orden` (LOG_EVENT_ID) que `derivador.eventos_desde_sinteticos` le asigna a cada evento
    (mismo criterio: índice tras ordenar por `ocurrido_en`, que emula el `id` bigserial del log real) —
    así la clave de cada nodo-evento de estado coincide exactamente con la que usa
    `invalidaciones_historico` para decidir qué superó a qué. **Carga histórica** (conoce los 6 meses de
    una): para el modo incremental de producción, la sesión de ingesta arma su propio loop evento-a-
    evento reusando `MapeadorEstado.procesar`/`edge_uuid_de` — este punto de entrada es sólo el atajo
    para la carga inicial y el dataset sintético.
    """
    ordenados = sorted(eventos, key=lambda e: e.ocurrido_en)
    logs = eventos_desde_sinteticos(eventos)   # mismo sort → mismo `orden` por índice, verificado por test
    mapeador = MapeadorEstado(negocio_key=negocio_key, negocio_nombre=negocio_nombre)
    for i, ev in enumerate(ordenados):
        mapeador.procesar(i, ev, group_logico=group_logico)
    invalidaciones = [
        Invalidacion(edge_uuid=mapeador.edge_uuid_de(s.superado), invalid_at=s.invalid_at.isoformat())
        for s in invalidaciones_historico(logs)
        if mapeador.edge_uuid_de(s.superado) is not None
    ]
    return mapeador.datasets(group_logico), invalidaciones
