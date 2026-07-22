"""Archivado del PDF de la factura en el Drive del emprendedor.

Lo que se prueba acá NO es "llama a Composio" —eso lo verificó el spike contra el Drive real— sino las
decisiones: idempotencia de la carpeta, qué link se guarda, y sobre todo que **nada de esto pueda
convertir una factura emitida en un fallo**. Una factura con CAE es un hecho fiscal; el archivado es
una comodidad.
"""
from __future__ import annotations

import pytest

from afip_drive import (
    SLUG_BUSCAR_CARPETA,
    SLUG_COMPARTIR,
    SLUG_CREAR_CARPETA,
    SLUG_SUBIR,
    archivar_pdf,
    asegurar_carpeta,
    nombre_de_archivo,
)

PDF = "https://afipsdk.s3.amazonaws.com/factura-8.pdf"


class GatewayFake:
    """Registra las llamadas y devuelve lo que el Drive real devolvió en el spike del 2026-07-21."""

    def __init__(self, *, carpeta_existe: bool = False, sin_id: bool = False,
                 falla_compartir: bool = False, falla_carpeta: bool = False) -> None:
        self.llamadas: list[tuple[str, dict]] = []
        self._carpeta_existe = carpeta_existe
        self._sin_id = sin_id
        self._falla_compartir = falla_compartir
        self._falla_carpeta = falla_carpeta

    def execute(self, slug, *, user_id, arguments, confirmed=False):
        self.llamadas.append((slug, arguments))
        if slug == SLUG_BUSCAR_CARPETA:
            if self._falla_carpeta:
                raise RuntimeError("drive caído")
            return {"data": {"files": [{"id": "carpeta-vieja"}]}} if self._carpeta_existe else {"data": {"files": []}}
        if slug == SLUG_CREAR_CARPETA:
            return {"data": {"id": "carpeta-nueva"}}
        if slug == SLUG_SUBIR:
            if self._sin_id:
                return {"data": {}}
            return {"data": {"id": "file-123",
                             "webContentLink": "https://drive.google.com/uc?id=file-123&export=download",
                             "webViewLink": "https://drive.google.com/file/d/file-123/view"}}
        if slug == SLUG_COMPARTIR:
            if self._falla_compartir:
                raise RuntimeError("permiso denegado")
            return {"data": {"id": "perm-1"}}
        raise AssertionError(f"slug inesperado: {slug}")

    def slugs(self) -> list[str]:
        return [s for s, _ in self.llamadas]

    def args_de(self, slug: str) -> dict:
        return next(a for s, a in self.llamadas if s == slug)


def test_nombre_ordena_igual_que_el_numero():
    """El orden alfabético del Drive tiene que coincidir con el numérico: sin los ceros a la
    izquierda, la factura 10 aparecería antes que la 9 en la carpeta del usuario."""
    n9 = nombre_de_archivo(cuit="20269996065", tipo_cbte=11, punto_venta=1, nro=9)
    n10 = nombre_de_archivo(cuit="20269996065", tipo_cbte=11, punto_venta=1, nro=10)
    assert n9 < n10
    assert n10.endswith(".pdf")


def test_la_carpeta_no_se_duplica_si_ya_existe():
    """Drive PERMITE dos carpetas con el mismo nombre. Sin el FIND previo, cada factura crearía una
    carpeta "Facturas" nueva y el usuario terminaría con una por comprobante."""
    gw = GatewayFake(carpeta_existe=True)
    assert asegurar_carpeta(gw, user_id="t1") == "carpeta-vieja"
    assert SLUG_CREAR_CARPETA not in gw.slugs()


def test_la_carpeta_se_crea_la_primera_vez():
    gw = GatewayFake(carpeta_existe=False)
    assert asegurar_carpeta(gw, user_id="t1") == "carpeta-nueva"
    assert gw.slugs() == [SLUG_BUSCAR_CARPETA, SLUG_CREAR_CARPETA]


def test_archivado_feliz_guarda_el_link_de_DESCARGA():
    """`webContentLink` baja el PDF; `webViewLink` abre el visor de Drive. El botón "Descargar" de la
    card necesita el primero — con el otro el usuario termina en una página, no con su factura."""
    gw = GatewayFake()
    res = archivar_pdf(gw, user_id="t1", nombre="f.pdf", pdf_url=PDF)

    assert res.guardado and res.compartido
    assert res.file_id == "file-123"
    assert "export=download" in res.link
    assert gw.slugs() == [SLUG_BUSCAR_CARPETA, SLUG_CREAR_CARPETA, SLUG_SUBIR, SLUG_COMPARTIR]


def test_el_pdf_va_dentro_de_la_carpeta():
    gw = GatewayFake(carpeta_existe=True)
    archivar_pdf(gw, user_id="t1", nombre="f.pdf", pdf_url=PDF)
    assert gw.args_de(SLUG_SUBIR)["parent_folder_id"] == "carpeta-vieja"


def test_sin_carpeta_igual_sube_a_la_raiz():
    """Prolijidad perdida, factura salvada: no archivar por no haber podido crear una carpeta sería
    perder el PDF a las 24 h por un problema cosmético."""
    gw = GatewayFake(falla_carpeta=True)
    with pytest.raises(RuntimeError):
        asegurar_carpeta(gw, user_id="t1")

    # `archivar_pdf` no se cae por eso: la carpeta es opcional.
    class GwSinCarpeta(GatewayFake):
        def execute(self, slug, *, user_id, arguments, confirmed=False):
            if slug in (SLUG_BUSCAR_CARPETA, SLUG_CREAR_CARPETA):
                self.llamadas.append((slug, arguments))
                return {"data": {}}
            return super().execute(slug, user_id=user_id, arguments=arguments, confirmed=confirmed)

    gw2 = GwSinCarpeta()
    res = archivar_pdf(gw2, user_id="t1", nombre="f.pdf", pdf_url=PDF)
    assert res.guardado
    assert "parent_folder_id" not in gw2.args_de(SLUG_SUBIR)


def test_si_falla_compartir_el_archivo_YA_esta_guardado():
    """El caso que más importa: el archivo existe en el Drive del usuario. Devolverlo como fallo
    borraría el `file_id` de un archivo real y lo dejaría huérfano — y el próximo intento subiría
    una segunda copia."""
    gw = GatewayFake(falla_compartir=True)
    res = archivar_pdf(gw, user_id="t1", nombre="f.pdf", pdf_url=PDF)

    assert res.guardado is True          # el PDF está a salvo
    assert res.compartido is False       # pero todavía no se puede pasar el link
    assert res.file_id == "file-123"
    assert "guardado_sin_compartir" in res.motivo


def test_sin_id_de_drive_no_se_inventa_un_guardado():
    """Si Drive no devuelve id, no hubo archivo. Reportar `guardado: True` acá haría que la UI
    escondiera el aviso de las 24 h sobre una factura que efectivamente se pierde."""
    gw = GatewayFake(sin_id=True)
    res = archivar_pdf(gw, user_id="t1", nombre="f.pdf", pdf_url=PDF)

    assert res.guardado is False
    assert res.motivo == "drive_no_devolvio_id"
    assert SLUG_COMPARTIR not in gw.slugs()


def test_compartir_false_guarda_pero_no_reparte_permisos():
    gw = GatewayFake()
    res = archivar_pdf(gw, user_id="t1", nombre="f.pdf", pdf_url=PDF, compartir=False)
    assert res.guardado and not res.compartido
    assert SLUG_COMPARTIR not in gw.slugs()


def test_todas_las_llamadas_van_confirmadas():
    """El gate HITL del gateway rechaza los write sin `confirmed`. Acá el consentimiento es el ajuste
    del usuario, no un "sí" en el chat: sin esto el archivado se colgaría esperando una respuesta que
    nadie va a dar, porque el workflow corre solo."""
    vistos = []

    class GwEspia(GatewayFake):
        def execute(self, slug, *, user_id, arguments, confirmed=False):
            vistos.append(confirmed)
            return super().execute(slug, user_id=user_id, arguments=arguments, confirmed=confirmed)

    archivar_pdf(GwEspia(), user_id="t1", nombre="f.pdf", pdf_url=PDF)
    assert vistos and all(vistos)
