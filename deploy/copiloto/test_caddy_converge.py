"""Tests de caddy_converge (SMTPVERIFYRUTA / DEPLOYNOCONVERGE).

Stdlib puro: `python3 -m unittest deploy/copiloto/test_caddy_converge.py` (corre igual en PC y VPS).

Control positivo: el Caddyfile vivo SIN `verify*` (estado medido en prod 2026-10-07) → el converger
DEBE agregar el handle. Negativo / anti-no-op: correrlo otra vez NO duplica y NO cambia nada. Y el
caso que mata al `if host in content: no-op` original: cambiar un valor (puerto de GoTrue) DEBE
reemplazar el bloque vivo, no dejarlo.
"""
import os
import re
import tempfile
import unittest

from caddy_converge import aplicar_bloque, converger, cuerpo_copiloto, cuerpo_publico
from caddy_snippet_check import bloques_sin_escribe, comparar, hosts_declarados, main as check_main

BASE = "178-105-191-1.sslip.io"
PUBLIC = "copilotoemprendedor.duckdns.org"

# Forma del Caddyfile vivo de prod (copia redactada, 2026-10-07): bloques de sitio top-level, el vhost
# público SIN verify, y un host (voz-web.) que CONTIENE el público como substring.
VIVO_SIN_VERIFY = """\
178-105-191-1.sslip.io {
    reverse_proxy 127.0.0.1:8088
}

mp.178-105-191-1.sslip.io {
    rewrite /callback /mp/callback
    reverse_proxy 127.0.0.1:8099
}

copiloto.178-105-191-1.sslip.io {
    reverse_proxy 127.0.0.1:8099
}

copilotoemprendedor.duckdns.org {
    handle /auth/v1/authorize* {
        reverse_proxy 127.0.0.1:9997
    }
    handle /auth/v1/callback* {
        reverse_proxy 127.0.0.1:9997
    }
    handle {
        reverse_proxy 127.0.0.1:8099
    }
}

voz-web.copilotoemprendedor.duckdns.org {
\treverse_proxy 127.0.0.1:8200
}
"""

ARGS = dict(base_domain=BASE, copiloto_sub="copiloto", mp_sub="mp", web_port=8099,
            public_host=PUBLIC, auth_port=9997)


def bloque(content, host):
    """Texto del bloque top-level `host {` ... `}` (la `}` de cierre en columna 0)."""
    m = re.search(r"^" + re.escape(host) + r" \{\n.*?^\}", content, re.MULTILINE | re.DOTALL)
    assert m, f"no hay bloque {host}"
    return m.group(0)


class ControlPositivo(unittest.TestCase):
    def test_agrega_verify_al_vhost_publico_que_no_lo_tenia(self):
        nuevo, acciones = converger(VIVO_SIN_VERIFY, **ARGS)
        self.assertIn("handle /auth/v1/verify* {", bloque(nuevo, PUBLIC))
        self.assertIn(("copilotoemprendedor.duckdns.org", "~"), acciones)

    def test_verify_va_a_gotrue_y_el_resto_al_api(self):
        nuevo, _ = converger(VIVO_SIN_VERIFY, **ARGS)
        b = bloque(nuevo, PUBLIC)
        self.assertIn("handle /auth/v1/verify* {\n        reverse_proxy 127.0.0.1:9997", b)
        self.assertIn("handle {\n        reverse_proxy 127.0.0.1:8099", b)

    def test_no_toca_los_bloques_ajenos(self):
        nuevo, _ = converger(VIVO_SIN_VERIFY, **ARGS)
        self.assertEqual(bloque(nuevo, "178-105-191-1.sslip.io"), bloque(VIVO_SIN_VERIFY, "178-105-191-1.sslip.io"))
        self.assertEqual(bloque(nuevo, "voz-web." + PUBLIC), bloque(VIVO_SIN_VERIFY, "voz-web." + PUBLIC))

    def test_agrega_rewrite_mp_ausente(self):
        sin = VIVO_SIN_VERIFY.replace("    rewrite /callback /mp/callback\n", "")
        nuevo, acciones = converger(sin, **ARGS)
        self.assertIn("rewrite /callback /mp/callback", bloque(nuevo, "mp." + BASE))
        self.assertIn((f"mp.{BASE} rewrite", "+"), acciones)


class Idempotencia(unittest.TestCase):
    def test_segunda_corrida_no_cambia_nada(self):
        primera, _ = converger(VIVO_SIN_VERIFY, **ARGS)
        segunda, acciones = converger(primera, **ARGS)
        self.assertEqual(primera, segunda)
        self.assertTrue(all(a == "=" for _, a in acciones), acciones)

    def test_no_duplica_el_handle_verify(self):
        primera, _ = converger(VIVO_SIN_VERIFY, **ARGS)
        segunda, _ = converger(primera, **ARGS)
        self.assertEqual(segunda.count("handle /auth/v1/verify*"), 1)


class Convergencia(unittest.TestCase):
    """El caso que el `if host in content` original NO veía: cambiar el valor debe llegar al recurso."""

    def test_cambiar_el_puerto_de_gotrue_reemplaza_el_bloque_vivo(self):
        primera, _ = converger(VIVO_SIN_VERIFY, **ARGS)
        cambiado, acciones = converger(primera, **{**ARGS, "auth_port": 9998})
        self.assertIn("reverse_proxy 127.0.0.1:9998", bloque(cambiado, PUBLIC))
        self.assertNotIn("127.0.0.1:9997", bloque(cambiado, PUBLIC))
        self.assertIn((PUBLIC, "~"), acciones)

    def test_quitar_una_directiva_del_deseado_la_retira_del_vivo(self):
        con_verify, _ = converger(VIVO_SIN_VERIFY, **ARGS)
        b_deseado = cuerpo_publico(9997, 8099)
        sin_verify_deseado = [l for l in b_deseado]
        i = sin_verify_deseado.index("    handle /auth/v1/verify* {")
        del sin_verify_deseado[i:i + 3]
        nuevo_texto, a = aplicar_bloque(con_verify, PUBLIC, sin_verify_deseado)
        self.assertEqual(a, "~")
        self.assertNotIn("verify*", bloque(nuevo_texto, PUBLIC))

    def test_directiva_log_nueva_llega_al_bloque_vivo(self):
        """DEPLOYNOCONVERGE: una directiva nueva del deseado (`log`) tiene que aparecer en el vivo que no la tenía."""
        nuevo, acciones = converger(VIVO_SIN_VERIFY, **ARGS)
        self.assertIn("\n    log\n", bloque(nuevo, PUBLIC))
        self.assertIn((PUBLIC, "~"), acciones)

    def test_copiloto_block_ya_igual_no_se_reescribe(self):
        _, a = aplicar_bloque(VIVO_SIN_VERIFY, f"copiloto.{BASE}", cuerpo_copiloto(8099))
        self.assertEqual(a, "=")


class Robustez(unittest.TestCase):
    def test_host_substring_no_se_confunde(self):
        """`copilotoemprendedor.duckdns.org` vive dentro de `voz-web.copilotoemprendedor.duckdns.org`.
        Sin el ancla `^`, el converger reescribiría el bloque de voz-web."""
        solo_voz = "voz-web.copilotoemprendedor.duckdns.org {\n\treverse_proxy 127.0.0.1:8200\n}\n"
        nuevo, a = aplicar_bloque(solo_voz, PUBLIC, cuerpo_publico(9997, 8099))
        self.assertEqual(a, "+")
        self.assertIn("voz-web.copilotoemprendedor.duckdns.org {\n\treverse_proxy 127.0.0.1:8200\n}", nuevo)

    def test_mp_ausente_es_error_no_silencio(self):
        sin_mp = VIVO_SIN_VERIFY.replace("mp.178-105-191-1.sslip.io", "otro.host")
        with self.assertRaises(ValueError):
            converger(sin_mp, **ARGS)


class MpSoloRecibeElRewrite(unittest.TestCase):
    """SNIPPETMIENTE: el snippet declara que de `mp.*` el deploy escribe SÓLO la línea `rewrite`. Eso es una
    afirmación sobre el mecanismo; acá se mide, no se cree: el resto del bloque vivo NO se converge."""

    def test_el_reverse_proxy_del_bloque_mp_no_se_reemplaza(self):
        distinto = VIVO_SIN_VERIFY.replace(
            "    rewrite /callback /mp/callback\n    reverse_proxy 127.0.0.1:8099\n",
            "    reverse_proxy 127.0.0.1:1111\n")
        nuevo, acciones = converger(distinto, **ARGS)
        b = bloque(nuevo, "mp." + BASE)
        self.assertIn("reverse_proxy 127.0.0.1:1111", b)     # NO lo llevó al deseado (8099)
        self.assertNotIn("127.0.0.1:8099", b)
        self.assertIn("rewrite /callback /mp/callback", b)    # lo único que sí escribió
        self.assertIn((f"mp.{BASE} rewrite", "+"), acciones)


SNIPPET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Caddyfile.snippet")

# Cabeceras de bloque del Caddyfile VIVO (sólo `host {`, sin directivas ni credenciales), leídas por ssh
# con `caddy-vivo-vs-snippet.sh` el 2026-10-13. Es el denominador de las dos direcciones del check.
VIVO_CABECERAS = """178-105-191-1.sslip.io {
hermes.178-105-191-1.sslip.io {
temporal.178-105-191-1.sslip.io {
mp.178-105-191-1.sslip.io {
copiloto.178-105-191-1.sslip.io {
auth.178-105-191-1.sslip.io {
copilotoemprendedor.duckdns.org {
voz.178-105-191-1.sslip.io {
voz-web.copilotoemprendedor.duckdns.org {
documed.copilotoemprendedor.duckdns.org {
rothoblaas.178-105-191-1.sslip.io {
www.svivertical.com.ar {
svivertical.com.ar, svivertical.duckdns.org {
"""


def _snippet():
    with open(SNIPPET, encoding="utf-8") as f:
        return f.read()


class SnippetDeclaraQuienEscribe(unittest.TestCase):
    def setUp(self):
        self.texto = _snippet()

    def test_todo_bloque_del_snippet_dice_quien_lo_escribe(self):
        self.assertEqual(bloques_sin_escribe(self.texto), [])

    def test_el_comprobador_ve_el_bloque_al_que_le_falta_la_linea(self):
        """Control negativo: sin éste, un comprobador que no mira nada daría el verde de arriba."""
        self.assertGreaterEqual(len(hosts_declarados(self.texto)), 3, "el snippet no tiene bloques que medir")
        sin = self.texto.replace("escribe: deploy.sh [6/7] y caddy-sync.sh (vía caddy_converge.py) → CONVERGENTE",
                                 "SIN LA LINEA (vía caddy_converge.py) → CONVERGENTE")
        self.assertNotEqual(sin, self.texto, "el reemplazo no cambió nada: el control no mira")
        self.assertEqual(bloques_sin_escribe(sin), ["copiloto.178-105-191-1.sslip.io"])

    def test_los_hosts_que_el_snippet_dice_converger_son_los_que_el_converger_toca(self):
        """El snippet afirma que `caddy_converge.py` escribe estos hosts: tienen que ser los que `converger`
        devuelve en sus acciones (si alguien saca uno del converger, el snippet deja de decir verdad)."""
        _, acciones = converger(VIVO_SIN_VERIFY, **ARGS)
        tocados = {h.split(" ")[0] for h, _ in acciones}
        self.assertEqual(set(hosts_declarados(self.texto)), tocados)


class SnippetVsVivo(unittest.TestCase):
    """SNIPPETMIENTE, las dos direcciones: A = el snippet afirma y el vivo no tiene · B = el vivo tiene y el
    snippet no nombra. Cada dirección trae su control: sin él un diff que no mira daría vacío igual."""

    def setUp(self):
        self.texto = _snippet()

    def test_contra_el_vivo_medido_las_dos_direcciones_dan_vacio(self):
        a, b, vivos = comparar(self.texto, VIVO_CABECERAS)
        self.assertEqual(len(vivos), 14, "denominador: 13 bloques, uno con 2 hosts")
        self.assertEqual((a, b), ([], []))

    def test_B_caza_un_host_vivo_que_el_snippet_no_nombra(self):
        """Es exactamente lo que pasó: `svivertical` vivía en prod y ningún archivo del repo lo decía."""
        sin = self.texto.replace("svivertical", "xxxxxxxxxxx")
        self.assertNotEqual(sin, self.texto)
        _, b, _ = comparar(sin, VIVO_CABECERAS)
        self.assertEqual(sorted(b), ["svivertical.com.ar", "svivertical.duckdns.org", "www.svivertical.com.ar"])

    def test_A_caza_un_bloque_afirmado_que_el_vivo_no_tiene(self):
        sin = VIVO_CABECERAS.replace("copiloto.178-105-191-1.sslip.io {\n", "")
        a, _, _ = comparar(self.texto, sin)
        self.assertEqual(a, ["copiloto.178-105-191-1.sslip.io"])

    def test_la_raiz_no_se_da_por_mencionada_por_ser_sufijo_de_otro_host(self):
        """`mp.178-...sslip.io` CONTIENE la raíz como substring: sin el borde de token, quitar la mención de la
        raíz no se notaría jamás."""
        sin = self.texto.replace("178-105-191-1.sslip.io→8088", "(raíz sin mencionar)")
        self.assertNotEqual(sin, self.texto)
        _, b, _ = comparar(sin, VIVO_CABECERAS)
        self.assertEqual(b, ["178-105-191-1.sslip.io"])

    def test_un_listado_vivo_vacio_no_es_un_verde(self):
        """Si el ssh falla y no llega nada, comparar contra la nada daría A=B=[]: tiene que ser rc=2."""
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as f:
            vacio = f.name
        try:
            self.assertEqual(check_main(["x", SNIPPET, vacio]), 2)
        finally:
            os.unlink(vacio)


if __name__ == "__main__":
    unittest.main()
