"""Tests de caddy_converge (SMTPVERIFYRUTA / DEPLOYNOCONVERGE).

Stdlib puro: `python3 -m unittest deploy/copiloto/test_caddy_converge.py` (corre igual en PC y VPS).

Control positivo: el Caddyfile vivo SIN `verify*` (estado medido en prod 2026-10-07) → el converger
DEBE agregar el handle. Negativo / anti-no-op: correrlo otra vez NO duplica y NO cambia nada. Y el
caso que mata al `if host in content: no-op` original: cambiar un valor (puerto de GoTrue) DEBE
reemplazar el bloque vivo, no dejarlo.
"""
import re
import unittest

from caddy_converge import aplicar_bloque, converger, cuerpo_copiloto, cuerpo_publico

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


if __name__ == "__main__":
    unittest.main()
