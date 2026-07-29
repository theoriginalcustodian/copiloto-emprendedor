"""Item 1.3 — cada error cae en UNA categoría, y la categoría dice QUÉ HACER con él.

Portado de ARCA: la taxonomía tipada de `mot07-consulta-fe.ts:336-379` más las categorías con
semántica de acción de `error-drawer.tsx:21-55`. La idea que importa no es "clasificar por
clasificar": es que la categoría **determine el camino de recuperación** sin que nadie tenga que
leer el mensaje.

    infra_error          → reintentar automáticamente (transitorio: red, timeout, 5xx, rate limit)
    business_error       → NO reintentar; necesita un humano o un dato distinto
    manual_intervention  → bloqueado; hay un efecto externo que sólo una persona puede resolver
    cascading            → falló porque su dependencia falló; revisar el padre, no éste

Hoy el repo tiene **16 `RetryPolicy` sin categorizar**: cada sitio decide por su cuenta si reintenta,
y esa decisión está dispersa e implícita. Sin taxonomía, la DLQ de Fase 2 no puede decidir qué
reinyectar — y reinyectar un `business_error` es un loop infinito garantizado, que es justo el que
ARCA ya vivió en su BOT-08 v1.0.

**El test que hace que esto no se degrade:** un error desconocido **NO** cae en una categoría por
descarte. Un `else: return infra_error` se traga cualquier error nuevo y lo manda a reintentar para
siempre — el "por descarte" es el modo de fallo clásico de toda taxonomía
([[discriminar-por-ausencia-de-estructura]]).
"""
from __future__ import annotations

import pytest

from taxonomia_errores import (BUSINESS_ERROR, CASCADING, CATEGORIAS, INFRA_ERROR,
                               MANUAL_INTERVENTION, ErrorSinCategoria, categoria_de,
                               es_reintentable, registrar_categoria)


class TestCategorias:
    def test_las_cuatro_categorias_y_nada_mas(self) -> None:
        assert CATEGORIAS == {INFRA_ERROR, BUSINESS_ERROR, MANUAL_INTERVENTION, CASCADING}

    @pytest.mark.parametrize(
        "exc,esperada",
        [
            (TimeoutError("se colgó"), INFRA_ERROR),
            (ConnectionError("no responde"), INFRA_ERROR),
            (ValueError("monto inválido"), BUSINESS_ERROR),
            (PermissionError("sin permiso"), MANUAL_INTERVENTION),
        ],
    )
    def test_clasifica_los_casos_conocidos(self, exc: BaseException, esperada: str) -> None:
        assert categoria_de(exc) == esperada

    def test_UN_ERROR_DESCONOCIDO_NO_CAE_POR_DESCARTE(self) -> None:
        """EL TEST QUE IMPORTA. Sin esto, un `else: infra_error` se traga cualquier error nuevo y lo
        manda a reintentar para siempre — el loop infinito que ARCA ya vivió."""
        class ErrorNuevoQueNadieClasifico(Exception):
            pass

        with pytest.raises(ErrorSinCategoria):
            categoria_de(ErrorNuevoQueNadieClasifico("sorpresa"))

    def test_se_puede_registrar_una_categoria_nueva_sin_tocar_el_modulo(self) -> None:
        """Extensible por registro, no por editar un `if` gigante — un dominio nuevo trae sus errores."""
        class ErrorDeDominio(Exception):
            pass

        registrar_categoria(ErrorDeDominio, BUSINESS_ERROR)
        assert categoria_de(ErrorDeDominio("x")) == BUSINESS_ERROR

    def test_registrar_una_categoria_invalida_falla_al_registrarla_no_despues(self) -> None:
        class Otro(Exception):
            pass

        with pytest.raises(ValueError):
            registrar_categoria(Otro, "categoria_inventada")


class TestSemanticaDeAccion:
    """La categoría no es una etiqueta: decide el camino."""

    def test_solo_infra_se_reintenta_automaticamente(self) -> None:
        assert es_reintentable(INFRA_ERROR) is True
        assert es_reintentable(BUSINESS_ERROR) is False
        assert es_reintentable(MANUAL_INTERVENTION) is False
        assert es_reintentable(CASCADING) is False

    def test_reintentar_un_business_error_seria_un_loop(self) -> None:
        """Explícito porque es el fallo caro: un dato inválido no mejora por reintentarlo. Es el loop
        infinito documentado del BOT-08 v1.0 de ARCA."""
        assert not es_reintentable(categoria_de(ValueError("CUIT mal formado")))
