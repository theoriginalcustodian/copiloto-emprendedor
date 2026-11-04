"""SM-N13 — sonda de LLM real: ¿el agente repite la consigna interna al anotar en Mi día?

🔴 ESCRIBE EN PRODUCCIÓN. Cada iteración manda un turno real al tenant de prueba canónico
(`e2e-device@copiloto.test`, vía `e2e_hito9_facturar_por_voz.login()`) y deja una tarjeta en Mi día. Correla
con N chico y sólo cuando el cambio ya está desplegado; no es parte del gate (no corre en CI).

Mide el MECANISMO, no su declaración: cuenta cuántas respuestas contienen la frase de la consigna
(«Confirmáselo en una línea corta» y sus variantes) en el `reply_text` que ve el usuario. El grep sobre el
código (`git grep "Confirmáselo en una línea corta"`) se satisface con el propio comentario que explica el
fix; esto no: mira lo que el LLM dice.

Uso:   python -I -X utf8 scripts/probe_n13_eco_consigna.py [N=12]
Salida: una línea JSON por turno + `RESUMEN: k/N con eco de la consigna`.
Referencia medida (2026-11-02, mismo N=12): ANTES del fix 6/12 · DESPUÉS 0/12 (7811aad1, desplegado).
Evidencia: docs/copiloto-emprendedor/2026-11-02-sprint-correcciones-evidencia/SM-N13.md
"""
import json
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import e2e_hito9_facturar_por_voz as e  # noqa: E402

ECO = re.compile(r"confirm[aá](?:me|se)(?:lo|la)?|confirm[aá]l[oa] en una l[ií]nea|l[ií]nea corta", re.I)


def main(n: int) -> int:
    token, _ = e.login()
    eco = 0
    for _ in range(n):
        sid = f"probe-n13-{uuid.uuid4()}"
        e.enviar(token, sid, f"Anotá en Mi día: llamar al proveedor {uuid.uuid4().hex[:4]}")
        fila = e.esperar_reply(token, sid, 0, segundos=90)["replies"][-1]
        texto = fila.get("reply_text") or ""
        hit = bool(ECO.search(texto))
        eco += hit
        print(json.dumps({"eco": hit, "texto": texto[:300]}, ensure_ascii=False))
    print(f"\nRESUMEN: {eco}/{n} con eco de la consigna")
    return 0


if __name__ == "__main__":
    sys.exit(main(int(sys.argv[1]) if len(sys.argv) > 1 else 12))
