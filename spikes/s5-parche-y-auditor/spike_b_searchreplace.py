"""S5b — el mismo forjador, cambiando SOLO el formato de salida: SEARCH/REPLACE en vez de diff unificado.

**Por qué existe.** S5 midió que `gpt-4o-mini` NO produce diffs unificados aplicables: `git apply` no
encuentra el contexto (el modelo tiene que acertar líneas y espacios exactos, y no lo hace). Eso NO
prueba que el modelo no sepa reparar — prueba que el formato de entrega es el cuello de botella.

Aider documentó y resolvió esto mismo con bloques SEARCH/REPLACE: el modelo cita el fragmento textual
a reemplazar, y el aplicador hace la búsqueda literal. Si el fragmento no existe, falla ruidosamente
en vez de aplicar mal.

**Mismo bug, mismo módulo real, mismo contexto. Cambia una sola variable: el formato.** Si esto pasa y
S5 falló, el hallazgo es del diseño (cómo se pide el parche), no de la capacidad del modelo.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from openai import OpenAI

FORJADOR = "gpt-4o-mini"
REPO = Path("/opt/uc-repos/copiloto")
PY = "/opt/uc-copiloto-venv/bin/python"

BLOQUE = re.compile(r"<<<<<<< SEARCH\n(.*?)\n=======\n(.*?)\n>>>>>>> REPLACE", re.DOTALL)


def sh(cmd: list[str], cwd: Path) -> tuple[int, str]:
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=180)
    return p.returncode, (p.stdout + p.stderr)


def aplicar(texto_modelo: str, archivo: Path) -> tuple[bool, str]:
    bloques = BLOQUE.findall(texto_modelo)
    if not bloques:
        return False, "el modelo no devolvio ningun bloque SEARCH/REPLACE"
    contenido = archivo.read_text(encoding="utf-8")
    for buscar, reemplazar in bloques:
        if buscar not in contenido:
            return False, f"fragmento no encontrado literalmente: {buscar[:70]!r}"
        contenido = contenido.replace(buscar, reemplazar, 1)
    archivo.write_text(contenido, encoding="utf-8")
    return True, f"{len(bloques)} bloque(s) aplicado(s)"


def main() -> int:
    if not os.environ.get("OPENAI_API_KEY"):
        print("falta OPENAI_API_KEY"); return 2
    client = OpenAI()

    with tempfile.TemporaryDirectory() as td:
        caja = Path(td) / "caja"; caja.mkdir()
        fuente = (REPO / "apps/copiloto/fingerprint.py").read_text(encoding="utf-8")
        roto = fuente.replace("& 0xFFFFFFFF", "")
        assert roto != fuente, "el bug no se pudo introducir"
        (caja / "fingerprint.py").write_text(roto, encoding="utf-8")
        (caja / "test_fingerprint.py").write_text(
            (REPO / "apps/copiloto/tests/test_fingerprint.py").read_text(encoding="utf-8"), encoding="utf-8")

        rc, salida = sh([PY, "-m", "pytest", "test_fingerprint.py", "-q"], caja)
        print(f"[control] suite con el bug → rc={rc} (debe ser != 0)")
        if rc == 0:
            print("VEREDICTO INVALIDO: el bug no rompe nada."); return 2

        prompt = f"""Sos un ingeniero reparando UN bug puntual. NO reescribas el módulo.

ARCHIVO fingerprint.py:
```python
{roto}
```

SALIDA REAL DE PYTEST:
```
{salida[-1200:]}
```

QUÉ NO ROMPER: la firma pública, la salida de 8 hex, y la paridad byte a byte con la implementación
TypeScript de ARCA (donde `>>> 0` fuerza 32 bits sin signo).

Respondé SOLO con uno o más bloques en este formato EXACTO, copiando el texto a buscar
LITERALMENTE del archivo (mismos espacios):

<<<<<<< SEARCH
(texto exacto actual)
=======
(texto nuevo)
>>>>>>> REPLACE
"""
        r = client.chat.completions.create(model=FORJADOR, temperature=0, max_tokens=700,
                                           messages=[{"role": "user", "content": prompt}])
        texto = (r.choices[0].message.content or "")
        ok, detalle = aplicar(texto, caja / "fingerprint.py")
        print(f"[P1b] aplicacion SEARCH/REPLACE: {ok} — {detalle}")
        if not ok:
            print("--- lo que devolvio el modelo (primeras lineas) ---")
            print("\n".join(texto.splitlines()[:12]))
            return 1

        rc2, salida2 = sh([PY, "-m", "pytest", "test_fingerprint.py", "-q"], caja)
        verde = rc2 == 0
        print(f"[P1b] suite tras el parche: {'VERDE' if verde else 'ROJA'} → {salida2.strip().splitlines()[-1][:110]}")
        print(f"\n=== VEREDICTO S5b: {'PASA' if verde else 'FALLA'} ===")
        return 0 if verde else 1


if __name__ == "__main__":
    sys.exit(main())
