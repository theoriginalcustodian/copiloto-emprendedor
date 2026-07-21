"""Reglas fiscales AFIP/ARCA — capa PURA.

Este módulo es el **único lugar** donde se decide si una factura es emisible y con qué forma.
No importa `temporalio`, no toca la red, no toca la DB, no llama a ningún LLM. Todo lo de acá se
puede testear con `pytest` sin levantar nada.

**Por qué está separado del workflow:** los dos caminos del producto —el determinista (formularios) y
el conversacional (el agente propone valores)— tienen que pasar por EXACTAMENTE las mismas reglas. Si
las reglas viven adentro del workflow, el camino conversacional termina duplicándolas, y una regla
fiscal duplicada es una regla fiscal que se desincroniza. Acá hay una sola copia.

**El LLM nunca decide.** Puede proponer un `dict` de slots; este módulo lo acepta o lo rechaza. No
negocia, no interpreta, no completa lo que falta.

Referencias: `docs/copiloto-emprendedor/2026-07-21-diseno-facturacion-afip-determinista.md` §5 (tabla de
reglas) y `spikes/afip-emit-pdf/RESULT.md` (contrato del WS verificado empíricamente el 2026-07-21).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from enum import Enum
from typing import Iterable

# ---------------------------------------------------------------------------
# Códigos de AFIP. No son "constantes mágicas": son la tabla oficial del organismo.
# ---------------------------------------------------------------------------


class TipoComprobante(int, Enum):
    FACTURA_A = 1
    FACTURA_B = 6
    FACTURA_C = 11
    NOTA_CREDITO_A = 3
    NOTA_CREDITO_B = 8
    NOTA_CREDITO_C = 13


class TipoDoc(int, Enum):
    """Tipo de documento del RECEPTOR."""

    CUIT = 80
    CUIL = 86
    DNI = 96
    CONSUMIDOR_FINAL = 99


class CondicionIVA(int, Enum):
    """Condición del receptor frente al IVA (RG 5616/2024 la volvió obligatoria en el payload)."""

    RESPONSABLE_INSCRIPTO = 1
    SUJETO_EXENTO = 4
    CONSUMIDOR_FINAL = 5
    MONOTRIBUTO = 6
    NO_CATEGORIZADO = 7
    PROVEEDOR_EXTERIOR = 8
    CLIENTE_EXTERIOR = 9
    IVA_LIBERADO = 10
    MONOTRIBUTISTA_SOCIAL = 13
    IVA_NO_ALCANZADO = 15
    MONOTRIBUTO_TRABAJADOR_INDEPENDIENTE = 16


class CondicionEmisor(str, Enum):
    """Condición del EMISOR. Determina qué letra de comprobante puede emitir."""

    MONOTRIBUTO = "monotributo"
    RESPONSABLE_INSCRIPTO = "responsable_inscripto"
    EXENTO = "exento"


class Concepto(int, Enum):
    PRODUCTOS = 1
    SERVICIOS = 2
    PRODUCTOS_Y_SERVICIOS = 3


class EstadoFactura(str, Enum):
    """Estados de la máquina. Las transiciones las decide `siguiente_estado`, nunca un modelo."""

    BORRADOR = "borrador"
    DATOS_VENTA_OK = "datos_venta_ok"
    ITEMS_OK = "items_ok"
    CLIENTE_OK = "cliente_ok"
    ESPERANDO_CONFIRMACION = "esperando_confirmacion"
    EMITIENDO = "emitiendo"
    EMITIDA = "emitida"
    ENTREGADA = "entregada"
    RECHAZADA = "rechazada"
    CANCELADA = "cancelada"


ESTADOS_TERMINALES = frozenset(
    {EstadoFactura.ENTREGADA, EstadoFactura.RECHAZADA, EstadoFactura.CANCELADA}
)

# R5 — tope de importe para vender a consumidor final SIN identificar.
# ⚠️ [PENDIENTE VERIFICAR contra normativa vigente] El competidor (Facturitas) usa 10.000.000, pero que
# ellos usen ese número no prueba que sea el vigente hoy. Queda parametrizado a propósito: cuando se
# confirme el valor real, se cambia acá y en ningún otro lado. NO hardcodear este número en la UI.
# Propietario: equipo copiloto · Condición de pago: antes de habilitar producción.
TOPE_CONSUMIDOR_FINAL_SIN_IDENTIFICAR = Decimal("10000000")

# R4 — AFIP acepta `CbteFch` dentro de ±10 días corridos de la fecha real.
MARGEN_DIAS_FECHA_COMPROBANTE = 10

DOS_DECIMALES = Decimal("0.01")


# ---------------------------------------------------------------------------
# Errores de validación — estructurados, no strings sueltos.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ErrorValidacion:
    """Un error con código estable.

    El `codigo` es lo que consume la UI para resaltar el campo, y lo que va a consumir el agente
    conversacional en la fase 2 para saber qué volver a preguntar. El `mensaje` es para el humano.
    """

    codigo: str
    campo: str
    mensaje: str

    def __str__(self) -> str:  # pragma: no cover - conveniencia de debug
        return f"[{self.codigo}] {self.campo}: {self.mensaje}"


# ---------------------------------------------------------------------------
# Estructuras de datos del dominio.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PerfilFiscal:
    """Datos del EMISOR. Se cargan una vez en Ajustes, no por factura.

    Los campos `ingresos_brutos` e `inicio_actividades` NO estaban en el handoff original: aparecieron
    cuando el spike intentó generar el PDF y AfipSDK devolvió 400 exigiéndolos. Sin ellos no hay
    comprobante, así que son obligatorios acá.
    """

    cuit: str
    razon_social: str
    domicilio_comercial: str
    condicion_iva: CondicionEmisor
    ingresos_brutos: str
    inicio_actividades: date
    punto_venta: int


@dataclass(frozen=True)
class Item:
    descripcion: str
    cantidad: Decimal
    precio_unitario: Decimal
    codigo: str = ""

    @property
    def subtotal(self) -> Decimal:
        return _redondear(self.cantidad * self.precio_unitario)


@dataclass(frozen=True)
class DatosVenta:
    fecha: date
    concepto: Concepto
    condicion_venta: str
    fecha_servicio_desde: date | None = None
    fecha_servicio_hasta: date | None = None
    fecha_vto_pago: date | None = None


@dataclass(frozen=True)
class Receptor:
    condicion_iva: CondicionIVA
    tipo_doc: TipoDoc = TipoDoc.CONSUMIDOR_FINAL
    nro_doc: str = "0"
    nombre: str = "Consumidor Final"
    domicilio: str = "-"


@dataclass(frozen=True)
class Totales:
    neto: Decimal
    iva: Decimal
    total: Decimal


@dataclass
class BorradorFactura:
    """Los slots. Se llenan de a poco — por formulario (v1) o por el agente (fase 2)."""

    datos_venta: DatosVenta | None = None
    items: list[Item] = field(default_factory=list)
    receptor: Receptor | None = None


# ---------------------------------------------------------------------------
# Helpers de aritmética fiscal. Decimal siempre: `float` no se usa con dinero.
# ---------------------------------------------------------------------------


def _redondear(valor: Decimal) -> Decimal:
    """Redondeo half-up a 2 decimales — el que usa AFIP, no el bankers' rounding de Python."""
    return Decimal(valor).quantize(DOS_DECIMALES, rounding=ROUND_HALF_UP)


def a_decimal(valor: object, *, campo: str) -> Decimal:
    """Convierte a Decimal fallando fuerte. Nunca acepta `float` crudo (arrastra error binario)."""
    if isinstance(valor, Decimal):
        return valor
    if isinstance(valor, float):
        raise ValueError(
            f"{campo}: no se aceptan float para importes (usar str o Decimal, "
            f"el binario pierde precisión en dinero)"
        )
    try:
        return Decimal(str(valor))
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f"{campo}: valor no numérico ({valor!r})") from exc


def calcular_totales(items: Iterable[Item], *, tipo: TipoComprobante) -> Totales:
    """R8 — la suma de subtotales ES el total. R3 — en Factura C no se discrimina IVA.

    Para A y B el desglose de IVA todavía no está implementado (la v1 apunta a monotributo → C).
    Se levanta `NotImplementedError` a propósito: es preferible fallar ruidoso a devolver un total
    silenciosamente mal calculado en un comprobante fiscal.
    """
    neto = _redondear(sum((i.subtotal for i in items), Decimal("0")))
    if tipo is TipoComprobante.FACTURA_C:
        return Totales(neto=neto, iva=Decimal("0.00"), total=neto)
    raise NotImplementedError(
        "El desglose de IVA para Factura A/B no está implementado todavía. "
        "La v1 cubre monotributo (Factura C). No emitir A/B por este camino."
    )


# ---------------------------------------------------------------------------
# R1 y R2 — las dos reglas que ARCA ya pagó caro en producción.
# ---------------------------------------------------------------------------


def normalizar_condicion_iva_receptor(receptor: Receptor) -> CondicionIVA:
    """R1 — `DocTipo=99` (consumidor final) ⇒ `CondicionIVAReceptorId=5`, SIEMPRE.

    Mandar `Cond=1` con `DocTipo=99` es el error 10243 (`RECHAZADO_ARCA`) que ARCA sufrió en prod: la
    validación existía sólo en una función SQL que el workflow nunca invocaba. Acá se fuerza en el
    camino de datos, no en un chequeo opcional que alguien pueda saltear.
    """
    if receptor.tipo_doc is TipoDoc.CONSUMIDOR_FINAL:
        return CondicionIVA.CONSUMIDOR_FINAL
    return receptor.condicion_iva


def determinar_tipo_comprobante(
    perfil: PerfilFiscal, receptor: Receptor
) -> TipoComprobante:
    """R2 — la letra del comprobante la decide la condición del EMISOR, y después la del receptor.

    - Monotributo o exento ⇒ siempre C (no discrimina IVA, no puede emitir A/B).
    - RI → receptor RI con CUIT ⇒ A.
    - RI → cualquier otro (incluido consumidor final) ⇒ B.
    """
    if perfil.condicion_iva in (CondicionEmisor.MONOTRIBUTO, CondicionEmisor.EXENTO):
        return TipoComprobante.FACTURA_C

    cond = normalizar_condicion_iva_receptor(receptor)
    if (
        cond is CondicionIVA.RESPONSABLE_INSCRIPTO
        and receptor.tipo_doc is TipoDoc.CUIT
    ):
        return TipoComprobante.FACTURA_A
    return TipoComprobante.FACTURA_B


# ---------------------------------------------------------------------------
# Validadores. Cada uno devuelve una LISTA de errores (vacía = válido).
# No lanzan excepción: queremos mostrarle al usuario TODO lo que falta de una vez, no de a uno.
# ---------------------------------------------------------------------------

_RE_CUIT = re.compile(r"^\d{11}$")


def validar_cuit(cuit: str) -> bool:
    """Valida el dígito verificador del CUIT (módulo 11). No verifica que exista en AFIP."""
    if not _RE_CUIT.match(cuit or ""):
        return False
    pesos = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    suma = sum(int(d) * p for d, p in zip(cuit[:10], pesos))
    resto = suma % 11
    verificador = 11 - resto
    if verificador == 11:
        verificador = 0
    elif verificador == 10:
        verificador = 9
    return verificador == int(cuit[10])


def validar_perfil(perfil: PerfilFiscal | None) -> list[ErrorValidacion]:
    """R7 — sin perfil fiscal completo no se emite. Fail-closed.

    Es preferible bloquear la emisión a mandar un comprobante con datos fiscales mal formados: lo
    primero es una fricción, lo segundo es un problema con AFIP.
    """
    if perfil is None:
        return [
            ErrorValidacion(
                "perfil_ausente",
                "perfil",
                "Falta cargar tus datos fiscales en Ajustes antes de poder facturar.",
            )
        ]

    errores: list[ErrorValidacion] = []
    if not validar_cuit(perfil.cuit):
        errores.append(
            ErrorValidacion("cuit_invalido", "cuit", "El CUIT no es válido (11 dígitos, sin guiones).")
        )
    for campo, valor, etiqueta in (
        ("razon_social", perfil.razon_social, "razón social"),
        ("domicilio_comercial", perfil.domicilio_comercial, "domicilio comercial"),
        ("ingresos_brutos", perfil.ingresos_brutos, "ingresos brutos"),
    ):
        if not (valor or "").strip():
            errores.append(
                ErrorValidacion(f"{campo}_vacio", campo, f"Falta completar {etiqueta} en Ajustes.")
            )
    if perfil.punto_venta < 1:
        errores.append(
            ErrorValidacion("punto_venta_invalido", "punto_venta", "El punto de venta debe ser ≥ 1.")
        )
    return errores


def validar_datos_venta(
    datos: DatosVenta | None, *, hoy: date
) -> list[ErrorValidacion]:
    """R4 (fecha dentro de ±10 días) y R6 (servicios exigen las 3 fechas)."""
    if datos is None:
        return [ErrorValidacion("datos_venta_ausentes", "datos_venta", "Faltan los datos de la venta.")]

    errores: list[ErrorValidacion] = []
    delta = abs((datos.fecha - hoy).days)
    if delta > MARGEN_DIAS_FECHA_COMPROBANTE:
        errores.append(
            ErrorValidacion(
                "fecha_fuera_de_rango",
                "fecha",
                f"AFIP sólo acepta comprobantes con fecha dentro de "
                f"±{MARGEN_DIAS_FECHA_COMPROBANTE} días (la indicada difiere en {delta}).",
            )
        )
    if not (datos.condicion_venta or "").strip():
        errores.append(
            ErrorValidacion("condicion_venta_vacia", "condicion_venta", "Falta la condición de venta.")
        )

    if datos.concepto in (Concepto.SERVICIOS, Concepto.PRODUCTOS_Y_SERVICIOS):
        faltantes = [
            nombre
            for nombre, valor in (
                ("fecha_servicio_desde", datos.fecha_servicio_desde),
                ("fecha_servicio_hasta", datos.fecha_servicio_hasta),
                ("fecha_vto_pago", datos.fecha_vto_pago),
            )
            if valor is None
        ]
        for nombre in faltantes:
            errores.append(
                ErrorValidacion(
                    "fecha_servicio_faltante",
                    nombre,
                    "Al facturar servicios, AFIP exige el período del servicio y el vencimiento del pago.",
                )
            )
        if (
            datos.fecha_servicio_desde
            and datos.fecha_servicio_hasta
            and datos.fecha_servicio_hasta < datos.fecha_servicio_desde
        ):
            errores.append(
                ErrorValidacion(
                    "periodo_servicio_invertido",
                    "fecha_servicio_hasta",
                    "La fecha de fin del servicio es anterior a la de inicio.",
                )
            )
    return errores


def validar_items(items: list[Item]) -> list[ErrorValidacion]:
    if not items:
        errores = [ErrorValidacion("sin_items", "items", "La factura necesita al menos un ítem.")]
        return errores

    errores = []
    for ix, item in enumerate(items):
        if not (item.descripcion or "").strip():
            errores.append(
                ErrorValidacion("item_sin_descripcion", f"items[{ix}].descripcion", "El ítem necesita una descripción.")
            )
        if item.cantidad <= 0:
            errores.append(
                ErrorValidacion("item_cantidad_invalida", f"items[{ix}].cantidad", "La cantidad debe ser mayor a cero.")
            )
        if item.precio_unitario <= 0:
            errores.append(
                ErrorValidacion("item_precio_invalido", f"items[{ix}].precio_unitario", "El precio debe ser mayor a cero.")
            )
    return errores


def validar_receptor(
    receptor: Receptor | None,
    *,
    total: Decimal,
    tope_sin_identificar: Decimal = TOPE_CONSUMIDOR_FINAL_SIN_IDENTIFICAR,
) -> list[ErrorValidacion]:
    """R1 (coherencia doc/condición) y R5 (tope de consumidor final sin identificar)."""
    if receptor is None:
        return [ErrorValidacion("receptor_ausente", "receptor", "Faltan los datos del cliente.")]

    errores: list[ErrorValidacion] = []

    if receptor.tipo_doc is TipoDoc.CONSUMIDOR_FINAL:
        if total > tope_sin_identificar:
            errores.append(
                ErrorValidacion(
                    "supera_tope_sin_identificar",
                    "receptor.nro_doc",
                    f"Por el monto (${total}) hay que identificar al cliente con CUIT, CUIL o DNI.",
                )
            )
        # R1: no es un error del usuario — se corrige solo en `normalizar_condicion_iva_receptor`.
        # Acá sólo se avisa si el dato entrante era incoherente, para que la UI lo refleje.
    else:
        if not (receptor.nro_doc or "").strip() or receptor.nro_doc == "0":
            errores.append(
                ErrorValidacion(
                    "documento_faltante",
                    "receptor.nro_doc",
                    "Falta el número de documento del cliente.",
                )
            )
        elif receptor.tipo_doc is TipoDoc.CUIT and not validar_cuit(receptor.nro_doc):
            errores.append(
                ErrorValidacion("cuit_receptor_invalido", "receptor.nro_doc", "El CUIT del cliente no es válido.")
            )
        if receptor.condicion_iva is CondicionIVA.CONSUMIDOR_FINAL and receptor.tipo_doc is TipoDoc.CUIT:
            # No es ilegal, pero casi siempre es un error de carga: si tiene CUIT, rara vez es CF.
            errores.append(
                ErrorValidacion(
                    "condicion_iva_sospechosa",
                    "receptor.condicion_iva",
                    "Cargaste un CUIT pero la condición es Consumidor Final. Revisá la condición frente al IVA.",
                )
            )
    return errores


def validar_factura_completa(
    perfil: PerfilFiscal | None, borrador: BorradorFactura, *, hoy: date
) -> list[ErrorValidacion]:
    """Todas las reglas juntas. Devuelve TODO lo que falta, no el primer error."""
    errores: list[ErrorValidacion] = []
    errores.extend(validar_perfil(perfil))
    errores.extend(validar_datos_venta(borrador.datos_venta, hoy=hoy))
    errores.extend(validar_items(borrador.items))

    total = _redondear(sum((i.subtotal for i in borrador.items), Decimal("0")))
    errores.extend(validar_receptor(borrador.receptor, total=total))
    return errores


# ---------------------------------------------------------------------------
# Transiciones. El corazón determinista: ninguna depende de texto interpretado.
# ---------------------------------------------------------------------------


def siguiente_estado(
    actual: EstadoFactura,
    *,
    perfil: PerfilFiscal | None,
    borrador: BorradorFactura,
    hoy: date,
) -> EstadoFactura:
    """Calcula el estado que corresponde a los slots cargados. Función pura y total.

    Se recalcula desde los datos en vez de mantener un puntero mutable: así, si el usuario vuelve
    atrás y borra un ítem, el estado retrocede solo. No hay forma de quedar en `ESPERANDO_CONFIRMACION`
    con la factura incompleta.
    """
    if actual in ESTADOS_TERMINALES or actual in (
        EstadoFactura.EMITIENDO,
        EstadoFactura.EMITIDA,
    ):
        return actual  # una vez que salió hacia AFIP, los slots ya no mandan

    if validar_datos_venta(borrador.datos_venta, hoy=hoy):
        return EstadoFactura.BORRADOR
    if validar_items(borrador.items):
        return EstadoFactura.DATOS_VENTA_OK

    total = _redondear(sum((i.subtotal for i in borrador.items), Decimal("0")))
    if validar_receptor(borrador.receptor, total=total):
        return EstadoFactura.ITEMS_OK
    if validar_perfil(perfil):
        # El perfil incompleto frena antes de la confirmación: no tiene sentido mostrarle un resumen
        # listo para emitir a alguien que no puede emitir.
        return EstadoFactura.CLIENTE_OK

    return EstadoFactura.ESPERANDO_CONFIRMACION


def puede_emitir(estado: EstadoFactura) -> bool:
    """Sólo se emite desde el estado de confirmación. Ningún atajo."""
    return estado is EstadoFactura.ESPERANDO_CONFIRMACION


# ---------------------------------------------------------------------------
# Armado del payload del web service (FECAESolicitar).
# ---------------------------------------------------------------------------


def armar_payload_wsfe(
    perfil: PerfilFiscal, borrador: BorradorFactura, *, hoy: date
) -> dict:
    """Construye el payload de `createNextVoucher`. Falla si la factura no es válida.

    ⚠️ En Factura C la clave `Iva` se **omite** (no se manda lista vacía) — verificado en el spike del
    2026-07-21: la emisión pasó así. `ImpNeto` es el total y `ImpIVA` es 0.
    """
    errores = validar_factura_completa(perfil, borrador, hoy=hoy)
    if errores:
        raise ValueError(f"factura inválida, no se arma payload: {[str(e) for e in errores]}")

    assert borrador.datos_venta is not None and borrador.receptor is not None  # ya validado

    tipo = determinar_tipo_comprobante(perfil, borrador.receptor)
    totales = calcular_totales(borrador.items, tipo=tipo)
    cond_receptor = normalizar_condicion_iva_receptor(borrador.receptor)

    payload = {
        "CantReg": 1,
        "PtoVta": perfil.punto_venta,
        "CbteTipo": int(tipo),
        "Concepto": int(borrador.datos_venta.concepto),
        "DocTipo": int(borrador.receptor.tipo_doc),
        "DocNro": int(borrador.receptor.nro_doc or 0),
        "CbteFch": int(borrador.datos_venta.fecha.strftime("%Y%m%d")),
        "ImpTotal": float(totales.total),
        "ImpTotConc": 0,
        "ImpNeto": float(totales.neto),
        "ImpOpEx": 0,
        "ImpIVA": float(totales.iva),
        "ImpTrib": 0,
        "MonId": "PES",  # código de AFIP para pesos. NO es "ARS" (ese es el ISO 4217).
        "MonCotiz": 1,
        "CondicionIVAReceptorId": int(cond_receptor),
    }

    if borrador.datos_venta.concepto in (Concepto.SERVICIOS, Concepto.PRODUCTOS_Y_SERVICIOS):
        payload["FchServDesde"] = int(borrador.datos_venta.fecha_servicio_desde.strftime("%Y%m%d"))  # type: ignore[union-attr]
        payload["FchServHasta"] = int(borrador.datos_venta.fecha_servicio_hasta.strftime("%Y%m%d"))  # type: ignore[union-attr]
        payload["FchVtoPago"] = int(borrador.datos_venta.fecha_vto_pago.strftime("%Y%m%d"))  # type: ignore[union-attr]

    return payload


def armar_params_pdf(
    perfil: PerfilFiscal,
    borrador: BorradorFactura,
    *,
    numero: int,
    cae: str,
    cae_vto: date,
    fecha_emision: date,
) -> dict:
    """Params del template `invoice-c` de AfipSDK.

    ⚠️ Los formatos de acá NO salen de la documentación: salen del error 400 que devolvió el servicio
    en el spike, que enumeró los campos obligatorios reales. Las fechas van en **DD/MM/YYYY** (el WS
    las devuelve en ISO — hay que convertir), y `receiver_document_type`/`concept` son **enteros**.
    """
    assert borrador.datos_venta is not None and borrador.receptor is not None
    tipo = determinar_tipo_comprobante(perfil, borrador.receptor)
    totales = calcular_totales(borrador.items, tipo=tipo)

    return {
        "voucher_number": numero,
        "sales_point": perfil.punto_venta,
        "issue_date": fecha_emision.strftime("%d/%m/%Y"),
        "cae_due_date": cae_vto.strftime("%d/%m/%Y"),
        "issuer_cuit": int(perfil.cuit),
        "cae": cae,
        "issuer_business_name": perfil.razon_social,
        "issuer_address": perfil.domicilio_comercial,
        "issuer_iva_condition": _etiqueta_condicion_emisor(perfil.condicion_iva),
        "issuer_gross_income": perfil.ingresos_brutos,
        "issuer_activity_start_date": perfil.inicio_actividades.strftime("%d/%m/%Y"),
        "receiver_name": borrador.receptor.nombre,
        "receiver_address": borrador.receptor.domicilio,
        "receiver_document_type": int(borrador.receptor.tipo_doc),
        "receiver_document_number": str(borrador.receptor.nro_doc),
        "receiver_iva_condition": _etiqueta_condicion_receptor(
            normalizar_condicion_iva_receptor(borrador.receptor)
        ),
        "sale_condition": borrador.datos_venta.condicion_venta,
        "currency_id": "ARS",
        "currency_rate": 1,
        "concept": int(borrador.datos_venta.concepto),
        "items": [
            {
                "code": item.codigo or str(ix + 1).zfill(3),
                "description": item.descripcion,
                "quantity": float(item.cantidad),
                "unit_price": float(item.precio_unitario),
                "subtotal": float(item.subtotal),
            }
            for ix, item in enumerate(borrador.items)
        ],
        "net_amount_taxed": 0 if tipo is TipoComprobante.FACTURA_C else float(totales.neto),
        "net_amount_untaxed": float(totales.neto) if tipo is TipoComprobante.FACTURA_C else 0,
        "exempt_amount": 0,
        "vat_amount": float(totales.iva),
        "tributes_amount": 0,
        "total_amount": float(totales.total),
    }


_ETIQUETAS_EMISOR = {
    CondicionEmisor.MONOTRIBUTO: "Responsable Monotributo",
    CondicionEmisor.RESPONSABLE_INSCRIPTO: "IVA Responsable Inscripto",
    CondicionEmisor.EXENTO: "IVA Sujeto Exento",
}

_ETIQUETAS_RECEPTOR = {
    CondicionIVA.RESPONSABLE_INSCRIPTO: "IVA Responsable Inscripto",
    CondicionIVA.SUJETO_EXENTO: "IVA Sujeto Exento",
    CondicionIVA.CONSUMIDOR_FINAL: "Consumidor Final",
    CondicionIVA.MONOTRIBUTO: "Responsable Monotributo",
    CondicionIVA.NO_CATEGORIZADO: "Sujeto No Categorizado",
    CondicionIVA.IVA_NO_ALCANZADO: "IVA No Alcanzado",
}


def _etiqueta_condicion_emisor(cond: CondicionEmisor) -> str:
    return _ETIQUETAS_EMISOR[cond]


def _etiqueta_condicion_receptor(cond: CondicionIVA) -> str:
    """El template pide la condición como STRING legible, no como el id numérico."""
    return _ETIQUETAS_RECEPTOR.get(cond, "Consumidor Final")


def fecha_valida_para_afip(fecha: date, *, hoy: date) -> bool:
    """R4 expuesta como predicado, para que la UI pueda deshabilitar fechas antes de que el usuario tipee."""
    return abs((fecha - hoy).days) <= MARGEN_DIAS_FECHA_COMPROBANTE


def rango_fechas_permitido(hoy: date) -> tuple[date, date]:
    delta = timedelta(days=MARGEN_DIAS_FECHA_COMPROBANTE)
    return hoy - delta, hoy + delta
