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
#: Privado a propósito: se importa sólo para el control de `TestHerenciaPorMro`, que necesita
#: afirmar que `URLError` NO está registrado — si alguien lo agrega, ese test dejaría de probar el
#: MRO y pasaría igual, y esto lo convierte en un fallo ruidoso en vez de un verde vacío.
from taxonomia_errores import _REGISTRO


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


class TestHerenciaPorMro:
    """Una subclase hereda la categoría de su padre — y sin esto la suite quedaba CIEGA.

    Lo destapó el banco de casos reales del ciclo de auto-reparación (2026-07-31): reemplazar
    `for tipo in type(exc).__mro__` por `for tipo in [type(exc)]` —el "esto se puede simplificar"
    clásico— dejaba los 9 tests de este archivo en VERDE, porque todos usaban tipos registrados
    **directamente**. La propiedad estaba prometida en el docstring del módulo y no la vigilaba
    nadie.

    Importa porque el gate de no-regresión de la autosanación es exactamente tan bueno como esta
    suite: lo que ningún test mira, un parche lo puede borrar y el gate lo aprueba.
    """

    def test_una_subclase_hereda_la_categoria_del_padre(self) -> None:
        """El caso del docstring: `HTTPError(OSError)` es infra sin registrarlo una por una."""
        class ErrorHttpDeAlgunaLibreria(OSError):
            pass

        assert categoria_de(ErrorHttpDeAlgunaLibreria("502 del proveedor")) == INFRA_ERROR

    def test_un_error_de_la_stdlib_que_NADIE_registro_igual_se_clasifica(self) -> None:
        """`urllib.error.URLError` hereda de `OSError` y no está en el registro. Que se clasifique
        bien es la prueba de que el MRO se recorre de verdad, no de que alguien lo anotó."""
        from urllib.error import URLError

        assert URLError not in _REGISTRO, "si alguien lo registró, este test dejó de probar el MRO"
        assert categoria_de(URLError("no resuelve el DNS")) == INFRA_ERROR

    def test_y_por_eso_se_reintenta_solo(self) -> None:
        """La consecuencia, no la etiqueta: sin herencia, un 502 transitorio se vuelve un error
        sin categoría y nunca más se reintenta automáticamente."""
        from urllib.error import URLError

        assert es_reintentable(categoria_de(URLError("timeout del proveedor"))) is True

    def test_CONTROL_lo_especifico_le_gana_al_padre(self) -> None:
        """EL CONTROL. Sin esto, `return INFRA_ERROR` a secas pasaría los tres tests de arriba.
        Registrar la subclase tiene que poder contradecir al padre, o el MRO no está eligiendo:
        está devolviendo lo primero que encuentra por casualidad."""
        class ErrorQueParecePeroNoEs(OSError):
            pass

        registrar_categoria(ErrorQueParecePeroNoEs, BUSINESS_ERROR)
        assert categoria_de(ErrorQueParecePeroNoEs("el CUIT del receptor no existe")) == BUSINESS_ERROR
        assert categoria_de(OSError("la red se cayó")) == INFRA_ERROR


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
