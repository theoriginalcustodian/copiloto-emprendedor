"""`AfipGateway` — boundary hacia AFIP/ARCA vía AfipSDK (capa CLIENTE, per-tenant, fail-closed).

Tercer boundary del copiloto, hermano de `ComposioGateway` y `MercadoPagoGateway`. Toda la conversación
con AFIP pasa por acá: nada más en el código importa `afip.py` ni conoce el `access_token`.

**Fail-closed:** si falta el token, si el tenant no tiene certificado, o si el WS contesta algo que no
entendemos, se levanta excepción. Nunca se devuelve un resultado "por las dudas" en un camino fiscal.

Todo lo marcado `[VERIFICADO 2026-07-21]` salió del spike contra homologación real
(`spikes/afip-emit-pdf/RESULT.md`), no de la documentación — que en varios puntos dice otra cosa.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Protocol


class ErrorAfip(RuntimeError):
    """Falla técnica hablando con AFIP/AfipSDK. Es reintentable."""


class RechazoAfip(Exception):
    """AFIP procesó el pedido y lo RECHAZÓ. NO es reintentable — es un resultado, no una falla.

    Distinguirlo de `ErrorAfip` es lo que evita que la activity reintente contra un rechazo de negocio:
    la lección ya se pagó en este repo (PR #114, un fallo de tool con retry infinito colgó el chat).
    """

    def __init__(self, motivo: str, *, observaciones: list | None = None) -> None:
        super().__init__(motivo)
        self.motivo = motivo
        self.observaciones = observaciones or []


@dataclass(frozen=True)
class ResultadoEmision:
    cae: str
    cae_vto: date
    numero: int
    resultado: str  # "A" aprobado · "P" parcial · "R" rechazado


@dataclass(frozen=True)
class ResultadoPDF:
    url: str
    expira_at: datetime | None
    nombre: str


def _primer_result_get(info: Any) -> dict:
    """Normaliza la respuesta de `getVoucherInfo` a un dict plano.

    El WS devuelve el detalle en `ResultGet`, que puede venir como **objeto o como lista** (y a veces
    ya viene plano, sin envoltorio). Cada una de esas formas es una respuesta legítima; lo que NO es
    legítimo es devolver `{}` ante una de ellas, porque el llamador lee `{}` como "no existe" y el
    check-before-act de la emisión le da luz verde a reemitir.
    """
    if not info:
        return {}
    if isinstance(info, list):
        info = info[0] if info else {}
    if not isinstance(info, dict):
        return {}
    detalle = info.get("ResultGet", info)
    if isinstance(detalle, list):
        detalle = detalle[0] if detalle else {}
    return detalle if isinstance(detalle, dict) else {}


class ClienteAfip(Protocol):
    """Lo mínimo que el gateway necesita de `afip.py`. Existe para poder testear sin red."""

    ElectronicBilling: Any


def _sin_clave(exc: Exception, clave: str) -> str:
    """Devuelve el mensaje del error con la clave fiscal enmascarada.

    No es paranoia de más: AfipSDK levanta `Exception(data.decode())` con el cuerpo crudo de la
    respuesta HTTP, y el payload que envió incluye `password`. Si un 400 lo refleja, el traceback se
    lleva la clave fiscal del emprendedor a los logs. Se enmascara ANTES de que el string exista, y el
    `raise ... from None` corta el encadenamiento para que el original tampoco quede en el traceback.
    """
    mensaje = str(exc)
    if clave and clave in mensaje:
        mensaje = mensaje.replace(clave, "***")
    return mensaje


def _parse_fecha_iso(valor: str) -> date:
    """El WS mezcla formatos: `createNextVoucher` devuelve ISO y `getVoucherInfo` `yyyymmdd`."""
    valor = str(valor).strip()
    if "-" in valor:
        return date.fromisoformat(valor)
    return datetime.strptime(valor, "%Y%m%d").date()


class AfipGateway:
    """Un gateway por tenant y por CUIT. NO compartir instancias entre emprendedores."""

    def __init__(
        self,
        *,
        cuit: str,
        cert: str | None = None,
        key: str | None = None,
        access_token: str | None = None,
        token_env: str = "AFIP_ACCESS_TOKEN",
        production: bool = False,
        cliente_factory=None,
    ) -> None:
        token = access_token or os.environ.get(token_env)
        if not token:
            raise ErrorAfip(f"falta {token_env} en el env (cargalo desde /etc/unreal-copilot/*.env)")
        self._cuit = str(cuit)
        self._token = token
        self._cert = cert
        self._key = key
        # `production=False` (homologación) es el DEFAULT deliberado: si alguien olvida setearlo, se
        # emite contra homologación —donde no pasa nada— y no contra AFIP real por accidente.
        self._production = bool(production)
        self._cliente_factory = cliente_factory or self._construir_cliente
        self._cliente: ClienteAfip | None = None

    def _construir_cliente(self) -> ClienteAfip:
        from afip import Afip  # import diferido: la PC de desarrollo no tiene la lib instalada

        opciones: dict[str, Any] = {"CUIT": int(self._cuit), "access_token": self._token,
                                    "production": self._production}
        if self._cert and self._key:
            opciones["cert"] = self._cert
            opciones["key"] = self._key
        return Afip(opciones)

    @property
    def cliente(self) -> ClienteAfip:
        if self._cliente is None:
            self._cliente = self._cliente_factory()
        return self._cliente

    # -- lecturas -----------------------------------------------------------

    def estado_servicio(self) -> dict:
        """Control barato. Si esto falla, lo roto es el token o la red — no la emisión."""
        try:
            return self.cliente.ElectronicBilling.getServerStatus()
        except Exception as exc:  # noqa: BLE001
            raise ErrorAfip(f"no se pudo consultar el estado del WS: {exc}") from exc

    def ultimo_comprobante(self, *, punto_venta: int, tipo_cbte: int) -> int:
        try:
            return int(self.cliente.ElectronicBilling.getLastVoucher(punto_venta, tipo_cbte))
        except Exception as exc:  # noqa: BLE001
            raise ErrorAfip(f"no se pudo obtener el último comprobante: {exc}") from exc

    def info_comprobante(self, *, numero: int, punto_venta: int, tipo_cbte: int) -> dict:
        """Devuelve el `ResultGet` plano. Sirve para el check-before-act de la emisión y para consultas.

        `ResultGet` puede venir como **objeto o como lista** — el WS no es consistente. La versión
        anterior devolvía `{}` ante una lista, y ese `{}` lo lee el llamador como "el comprobante no
        existe" → reemite. Es decir: una respuesta VÁLIDA de AFIP se traducía en luz verde para
        emitir de nuevo. Mismo tratamiento que el "anti-pattern P5" de la suite ARCA
        (`mot07-consulta-fe.ts:142-149`), que ya pagó este caso contra el WS real.
        """
        try:
            info = self.cliente.ElectronicBilling.getVoucherInfo(numero, punto_venta, tipo_cbte)
        except Exception as exc:  # noqa: BLE001
            raise ErrorAfip(f"no se pudo consultar el comprobante {punto_venta}-{numero}: {exc}") from exc
        return _primer_result_get(info)

    def existe_comprobante(self, *, numero: int, punto_venta: int, tipo_cbte: int) -> bool:
        """Check-before-act: ¿AFIP ya autorizó este número?

        Cubre la ventana fea: AFIP respondió, nosotros nos caímos antes de registrarlo, y el reintento
        estaría por emitir una segunda factura. Consultar antes de reemitir es más barato que una nota
        de crédito.
        """
        try:
            return bool(self.info_comprobante(numero=numero, punto_venta=punto_venta, tipo_cbte=tipo_cbte))
        except ErrorAfip:
            return False

    # -- onboarding (alta del emprendedor ante ARCA) ------------------------

    def crear_certificado(self, *, usuario: str, clave: str, alias: str) -> dict:
        """Genera el certificado digital vía el RPA de AfipSDK. Devuelve `{cert, key}` en PEM.

        ⚠️ **Bloqueante y lento.** El SDK hace polling interno: hasta 24 intentos cada 5 s (~2 min) antes
        de rendirse con "Waiting for too long". Quien llame a esto tiene que darle timeout de sobra.

        ⚠️ `clave` es la clave fiscal. Entra por parámetro, se usa, y no se guarda en ningún lado —
        tampoco en el atributo de la instancia.
        """
        try:
            return self.cliente.createCert(usuario, clave, alias)
        except Exception as exc:  # noqa: BLE001
            raise ErrorAfip(f"falló la generación del certificado: {_sin_clave(exc, clave)}") from None

    def autorizar_web_service(self, *, usuario: str, clave: str, alias: str, wsid: str = "wsfe") -> dict:
        """Vincula el certificado con el web service (sin esto el certificado no puede facturar)."""
        try:
            return self.cliente.createWSAuth(usuario, clave, alias, wsid)
        except Exception as exc:  # noqa: BLE001
            raise ErrorAfip(f"falló la autorización de {wsid}: {_sin_clave(exc, clave)}") from None

    # -- escrituras ---------------------------------------------------------

    def emitir(self, payload: dict) -> ResultadoEmision:
        """Emite y devuelve el CAE. `payload` viene de `afip_rules.armar_payload_wsfe` — ya validado.

        El gateway NO valida reglas fiscales: esa es la responsabilidad de `afip_rules`. Acá sólo se
        traduce el resultado del WS al contrato del dominio.
        """
        try:
            res = self.cliente.ElectronicBilling.createNextVoucher(dict(payload))
        except Exception as exc:  # noqa: BLE001
            mensaje = str(exc)
            # AfipSDK levanta excepción con el código de AFIP embebido. Los rechazos de negocio NO se
            # reintentan; los errores de transporte sí.
            if any(codigo in mensaje for codigo in ("(10016)", "(10243)", "(11002)", "(600)", "(601)")):
                raise RechazoAfip(mensaje) from exc
            raise ErrorAfip(f"falló la emisión: {mensaje}") from exc

        if not res:
            raise ErrorAfip("el WS devolvió una respuesta vacía en la emisión")

        # [VERIFICADO 2026-07-21] la clave es `voucherNumber` en camelCase. La doc la llama
        # `voucher_number`; leerle el shape a la doc en vez de al servicio ya costó una corrida perdida.
        numero = res.get("voucherNumber") or res.get("voucher_number")
        cae = res.get("CAE") or res.get("cae")
        cae_vto = res.get("CAEFchVto") or res.get("cae_vto")
        if not (cae and numero and cae_vto):
            raise ErrorAfip(f"respuesta de emisión incompleta: {res!r}")

        return ResultadoEmision(
            cae=str(cae), cae_vto=_parse_fecha_iso(cae_vto), numero=int(numero),
            resultado=str(res.get("Resultado", "A")),
        )

    def generar_pdf(self, *, template: str, params: dict, nombre_archivo: str) -> ResultadoPDF:
        """Genera el PDF con un template oficial de AfipSDK.

        [VERIFICADO 2026-07-21] el template `invoice-c` **incrusta el QR** — no hace falta HTML propio.
        ⚠️ La URL que devuelve **expira a las 24 h**. Decisión del producto: no re-hosteamos; la card de
        descarga tiene que avisarle al usuario que después lo baje del portal de AFIP.
        """
        cuerpo = {"file_name": nombre_archivo, "template": {"name": template, "params": dict(params)}}
        try:
            res = self.cliente.ElectronicBilling.createPDF(cuerpo)
        except Exception as exc:  # noqa: BLE001
            raise ErrorAfip(f"falló la generación del PDF: {exc}") from exc

        url = (res or {}).get("file")
        if not url:
            raise ErrorAfip(f"el WS no devolvió URL de PDF: {res!r}")
        expira = (res or {}).get("file_expiration")
        return ResultadoPDF(
            url=str(url),
            expira_at=datetime.fromisoformat(str(expira)) if expira else None,
            nombre=str((res or {}).get("file_name") or nombre_archivo),
        )
