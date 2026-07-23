"""Dataset sintético del grafo de negocio — Hito 5 §1.4.

Fabrica un stream de eventos del log `copiloto_eventos` (§1.1) para UN emprendedor (tenant) con ~30
clientes y 6 meses de historia. El derivador (§1.2) lo consume igual que consumiría el log real: por
eso este generador emite **exactamente el vocabulario que producen los 11 ganchos reales** (medido en
`afip_comprobante_store` · `cobro_store` · `concepto_store` · `gasto_store` · `presupuesto_store` ·
`trabajo_store`), no un vocabulario propio. Un dataset que hablara distinto obligaría al derivador a
entender dos idiomas.

🔴 **Por qué NO puede ser plano** (`ontologia-grafo-negocio-v1.md` §7.2): si cada concepto tuviera un
precio y cada presupuesto un estado fijo, las aristas de estado no se invalidarían nunca, el guard
anti-resurrección no se dispararía y el filtro de vigencia daría lo mismo con o sin filtro — *todo
verde, nada probado*. Este generador **garantiza** los casos que ejercitan cada regla de §2:

- un `Concepto` que cambia de precio **tres veces y vuelve a un valor anterior** → el caso que
  resucita aristas (§2.3, trampa 4);
- presupuestos en los cuatro desenlaces: `aprobado`, `desestimado`, sin respuesta (`pendiente`), y
  **reemplazado** (via `reemplaza_a`, no un estado — ver `hallazgo_..._presupuesto-tiene-3-estados`);
- una **factura anulada** por nota de crédito — cuyo `estado_cambiado` NO debe invalidar `EMITIO`
  (§2.2), sólo `ESTADO_COMPROBANTE`;
- facturas **cobradas** y facturas **impagas**;
- un cliente que **dejó de comprar** hace meses (sólo eventos al principio de la ventana).

**Determinismo (no negociable):** dos corridas del mismo diseño tienen que dar el MISMO dataset, o
"re-derivar para comparar" (§3) deja de valer. No hay `random` ni `now()`: todo sale del índice y de
la fecha ancla `hoy` que se inyecta. El generador produce eventos **ordenados cronológicamente** por
`ocurrido_en` — así el modo incremental del derivador (§7.1.bis) los procesa como llegarían en prod.

Este módulo NO escribe en la base: produce una lista de `EventoSintetico`. El cargado al log vivo (un
tenant sintético, backdateado, saltándose los ganchos — `evento_store` §3a) es un paso aparte y va
detrás del provisioning del grafo (secreto + env), fuera de acá.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from decimal import Decimal

# Estados reales (verificados en presupuesto_store.py / afip_comprobante_store.py) — no inventar otros.
PRESU_PENDIENTE, PRESU_APROBADO, PRESU_DESESTIMADO = "pendiente", "aprobado", "desestimado"
CBTE_EMITIDA, CBTE_ANULADA = "emitida", "anulada"

# Orígenes reales de cobro (cobro_store): 'factura' cuando nace de una factura, 'manual' cuando lo
# dicta el emprendedor, 'mercadopago' cuando el sistema lo vio. No valen lo mismo y el fact lo lee.
COBRO_FACTURA, COBRO_MANUAL, COBRO_MP = "factura", "manual", "mercadopago"

ZONA = datetime.timezone(datetime.timedelta(hours=-3))   # negocio en UTC-3 (fijo, como el resto del repo)


@dataclass(frozen=True)
class EventoSintetico:
    """Un renglón del log, con la MISMA forma que los argumentos de `evento_store.registrar_evento`.

    El cargador (aparte) lo desestructura contra `registrar_evento(cur, cliente_id, entidad_tipo=…,
    entidad_id=…, evento=…, campo=…, valor_de=…, valor_a=…, datos=…, ocurrido_en=…)`. Acá `ocurrido_en`
    SIEMPRE viene puesto (backdateo): el dataset fabrica la historia, no usa `now()`.
    """
    entidad_tipo: str
    entidad_id: str
    evento: str
    ocurrido_en: datetime.datetime
    campo: str | None = None
    valor_de: str | None = None
    valor_a: object = None                       # str para estados/precios; dict para imputación
    datos: dict = field(default_factory=dict)


def _dinero(x) -> str:
    """Monto/precio como string de dos decimales — la convención del repo (nunca float en dinero)."""
    return str(Decimal(str(x)).quantize(Decimal("0.01")))


class _Reloj:
    """Fechas deterministas dentro de la ventana de 6 meses que termina en `hoy`. `dia(meses_atras,
    dia_del_mes)` da un instante estable en UTC-3 — sin `now()`, sin `random`, reproducible."""

    def __init__(self, hoy: datetime.date) -> None:
        self._hoy = hoy

    def dia(self, meses_atras: int, dia_del_mes: int = 15, hora: int = 12) -> datetime.datetime:
        # Retrocede `meses_atras` meses de forma estable (sin dateutil): baja el mes, ajusta el año.
        m = self._hoy.month - 1 - meses_atras
        anio = self._hoy.year + (m // 12)
        mes = (m % 12) + 1
        dia = min(dia_del_mes, _dias_del_mes(anio, mes))
        return datetime.datetime(anio, mes, dia, hora, 0, tzinfo=ZONA)


def _dias_del_mes(anio: int, mes: int) -> int:
    if mes == 12:
        return 31
    return (datetime.date(anio, mes + 1, 1) - datetime.timedelta(days=1)).day


class GeneradorDataset:
    """Fabrica el stream de eventos de UN tenant. Construir con `cliente_id` (el tenant) y `hoy`
    (la fecha ancla); `eventos()` devuelve la lista ordenada por `ocurrido_en`.

    `n_clientes` fija la masa (default 30, el volumen decidido). Los casos §2 obligatorios se emiten
    SIEMPRE, con nombres de cliente/concepto fijos, aunque `n_clientes` sea chico: son la garantía del
    DoD, no relleno. El relleno agrega clientes y facturas para dar masa a las preguntas de negocio.
    """

    def __init__(self, *, cliente_id: str, hoy: datetime.date, n_clientes: int = 30) -> None:
        self._cid = cliente_id
        self._reloj = _Reloj(hoy)
        self._n = n_clientes
        self._eventos: list[EventoSintetico] = []
        self._nro = 0            # secuencia de numeros de presupuesto/comprobante, determinista

    # ── API ──────────────────────────────────────────────────────────────────────────────────────
    def eventos(self) -> list[EventoSintetico]:
        if not self._eventos:
            self._conceptos_con_serie_de_precios()
            self._presupuestos_cuatro_desenlaces()
            self._facturas_cobrada_impaga_y_anulada()
            self._gastos_con_imputacion()
            self._cliente_que_dejo_de_comprar()
            self._relleno_para_masa()
            self._eventos.sort(key=lambda e: e.ocurrido_en)
        return list(self._eventos)

    # ── casos §2 obligatorios ─────────────────────────────────────────────────────────────────────
    def _conceptos_con_serie_de_precios(self) -> None:
        """`Concepto` "tablero eléctrico": creado a 85.000, sube a 95.000, a 110.000, y VUELVE a 85.000
        (§2.3, el caso que resucita aristas). Más un concepto de precio estable para contraste."""
        self._precio("Tablero eléctrico", [(6, None, 85000), (4, 85000, 95000),
                                           (3, 95000, 110000), (1, 110000, 85000)])
        self._precio("Instalación de luces", [(6, None, 12000)])   # estable: no invalida nunca

    def _precio(self, nombre: str, cambios: list[tuple[int, object, object]]) -> None:
        norm = _norm(nombre)
        for i, (meses, de, a) in enumerate(cambios):
            self._add("concepto", norm,
                      evento="creado" if i == 0 else "precio_cambiado", campo="precio",
                      valor_de=(None if de is None else _dinero(de)),
                      valor_a=(None if a is None else _dinero(a)),
                      datos={"nombre": nombre}, cuando=self._reloj.dia(meses, 5))

    def _presupuestos_cuatro_desenlaces(self) -> None:
        cli = "Panadería La Espiga"
        # aprobado
        self._presupuesto(cli, "Tablero eléctrico", 85000, mes_alta=5, desenlace=PRESU_APROBADO)
        # desestimado
        self._presupuesto(cli, "Instalación de luces", 12000, mes_alta=4, desenlace=PRESU_DESESTIMADO)
        # sin respuesta (queda pendiente, y viejo → el caso de "presupuesto colgado")
        self._presupuesto("Kiosco El Sol", "Tablero eléctrico", 95000, mes_alta=5, desenlace=None)
        # reemplazado: un predecesor y un sucesor con reemplaza_a apuntándolo (no es un estado — §hallazgo)
        num_viejo = self._presupuesto("Taller Rossi", "Tablero eléctrico", 95000, mes_alta=4,
                                      desenlace=PRESU_DESESTIMADO)
        self._presupuesto("Taller Rossi", "Tablero eléctrico", 110000, mes_alta=3, desenlace=None,
                          reemplaza_a=num_viejo)

    def _presupuesto(self, cliente: str, concepto: str, total, *, mes_alta: int,
                     desenlace: str | None, reemplaza_a: str | None = None) -> str:
        self._nro += 1
        numero = f"P-{self._nro:04d}"
        alta = self._reloj.dia(mes_alta, 3)
        self._add("presupuesto", numero, evento="creado", campo="estado",
                  valor_de=None, valor_a=PRESU_PENDIENTE, cuando=alta,
                  datos={"numero": numero, "total": _dinero(total), "concepto": concepto,
                         "receptor_nombre": cliente, "reemplaza_a": reemplaza_a,
                         "items": [{"descripcion": concepto, "cantidad": "1",
                                    "precio_unitario": _dinero(total)}]})
        if desenlace is not None:
            # el cambio de estado ocurre después del alta (unos días); dentro de la misma ventana
            self._add("presupuesto", numero, evento="estado_cambiado", campo="estado",
                      valor_de=PRESU_PENDIENTE, valor_a=desenlace,
                      cuando=alta + datetime.timedelta(days=6))
        return numero

    def _facturas_cobrada_impaga_y_anulada(self) -> None:
        # F1 cobrada (origen factura: el sistema la enlazó)
        f1 = self._comprobante("Panadería La Espiga", 85000, mes=5)
        self._cobro(85000, mes=5, origen=COBRO_FACTURA, comprobante_id=f1["comprobante_id"])
        # F2 impaga: emitida, sin cobro asociado
        self._comprobante("Kiosco El Sol", 40000, mes=4)
        # F3 anulada por nota de crédito: estado_cambiado emitida→anulada (NO invalida EMITIO)
        f3 = self._comprobante("Taller Rossi", 60000, mes=3)
        self._add("comprobante", f3["entidad_id"], evento="estado_cambiado", campo="estado",
                  valor_de=CBTE_EMITIDA, valor_a=CBTE_ANULADA,
                  cuando=self._reloj.dia(2, 10),
                  datos={"nota_credito_nro": 9001})
        # un cobro manual (dictado): entra a la caja aunque no pase por factura
        self._cobro(15000, mes=2, origen=COBRO_MANUAL, cliente_nombre="Cliente de mostrador")

    def _comprobante(self, cliente: str, total, *, mes: int) -> dict:
        self._nro += 1
        cuit, tipo_cbte, pv, nro = "20304050607", 6, 1, self._nro
        entidad_id = f"{cuit}|{tipo_cbte}|{pv}|{nro}"
        fecha = self._reloj.dia(mes, 8)
        self._add("comprobante", entidad_id, evento="emitido", campo="estado",
                  valor_de=None, valor_a=CBTE_EMITIDA, cuando=fecha,
                  datos={"tipo_cbte": tipo_cbte, "punto_venta": pv, "nro": nro,
                         "total": _dinero(total), "fecha_emision": fecha.date().isoformat(),
                         "receptor_nombre": cliente})
        return {"entidad_id": entidad_id, "comprobante_id": self._nro}

    def _cobro(self, monto, *, mes: int, origen: str, comprobante_id=None,
               cliente_nombre: str = "") -> None:
        self._nro += 1
        fecha = self._reloj.dia(mes, 9)
        datos = {"monto": _dinero(monto), "medio": "efectivo",
                 "fecha": fecha.date().isoformat(), "origen": origen}
        if comprobante_id is not None:
            datos["comprobante_id"] = comprobante_id
        if cliente_nombre:
            datos["cliente_nombre"] = cliente_nombre
        self._add("cobro", f"C-{self._nro}", evento="creado", cuando=fecha, datos=datos)

    def _gastos_con_imputacion(self) -> None:
        # un gasto suelto, y otro imputado a un trabajo (arista IMPUTADO_A — §2.1 / §hallazgo IMPUTADO_A)
        self._add("gasto", "G-1", evento="creado", cuando=self._reloj.dia(5, 12),
                  datos={"monto": _dinero(3000), "categoria": "mercaderia",
                         "proveedor": "Distribuidora Sur", "medio_pago": "transferencia",
                         "origen": "manual"})
        self._add("gasto", "G-2", evento="creado", cuando=self._reloj.dia(4, 14),
                  datos={"monto": _dinero(5000), "categoria": "insumos",
                         "proveedor": "Ferretería Oeste", "medio_pago": "efectivo",
                         "origen": "manual"})
        self._add("gasto", "G-2", evento="imputado", campo="imputacion",
                  valor_a={"eslabon": "comprobante", "ref": "20304050607|6|1|"},
                  cuando=self._reloj.dia(4, 15))

    def _cliente_que_dejo_de_comprar(self) -> None:
        """Un cliente con actividad SOLO al principio de la ventana (mes -6/-5) y nada después — la
        pregunta #4 (*¿quién me dejó de comprar?*) es una consulta de AUSENCIA, y sin este caso el
        dataset no la puede ejercitar."""
        self._comprobante("Almacén Antiguo", 22000, mes=6)
        self._presupuesto("Almacén Antiguo", "Instalación de luces", 12000, mes_alta=6,
                          desenlace=PRESU_APROBADO)

    def _relleno_para_masa(self) -> None:
        """Clientes y facturas adicionales hasta ~`n_clientes`, deterministas (índice, no random), para
        que las preguntas de ranking/agregación tengan masa. No aportan casos nuevos: son volumen."""
        ya = 4   # los clientes con nombre propio ya emitidos arriba
        for i in range(ya, self._n):
            cliente = f"Cliente {i:02d}"
            mes = 1 + (i % 6)                       # repartidos en la ventana
            total = 10000 + (i * 1000)
            f = self._comprobante(cliente, total, mes=mes)
            if i % 3 != 0:                          # 2 de cada 3 facturas se cobran; el resto queda impago
                self._cobro(total, mes=mes, origen=COBRO_FACTURA, comprobante_id=f["comprobante_id"])

    # ── util ─────────────────────────────────────────────────────────────────────────────────────
    def _add(self, entidad_tipo: str, entidad_id: str, *, evento: str,
             cuando: datetime.datetime, campo: str | None = None,
             valor_de: str | None = None, valor_a: object = None, datos: dict | None = None) -> None:
        self._eventos.append(EventoSintetico(
            entidad_tipo=entidad_tipo, entidad_id=str(entidad_id), evento=evento,
            ocurrido_en=cuando, campo=campo, valor_de=valor_de, valor_a=valor_a,
            datos=datos or {}))


def _norm(texto: str) -> str:
    """Clave normalizada de concepto — minúsculas y espacios colapsados. El derivador usa la MISMA
    normalización que el server para deduplicar `Concepto` (§1 del doc de ontología); acá alcanza con
    que dos menciones del mismo concepto den la misma clave dentro del dataset."""
    return " ".join(texto.lower().split())


def generar_dataset(*, cliente_id: str, hoy: datetime.date, n_clientes: int = 30) -> list[EventoSintetico]:
    """Punto de entrada: el stream de eventos del log para un tenant, ordenado cronológicamente."""
    return GeneradorDataset(cliente_id=cliente_id, hoy=hoy, n_clientes=n_clientes).eventos()
