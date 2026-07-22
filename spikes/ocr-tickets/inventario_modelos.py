"""S1 (parcial): ¿qué modelos de visión hay en OpenRouter y cuánto cuestan por ticket?

No depende de las fotos del operador, así que se adelanta. Lo que NO se puede contestar sin ellas es
si LEEN BIEN un ticket térmico real (S2) y qué hacen cuando no pueden (S4).

El costo por ticket se estima con el precio publicado y un tamaño de imagen típico de foto de
teléfono; el número REAL sale del `usage` que devuelve la llamada, y eso se mide en S3.
"""
import json, os, subprocess, urllib.request

pid = subprocess.run(["systemctl","show","-p","MainPID","--value","uc-copiloto-worker.service"],
                     capture_output=True, text=True).stdout.strip()
for par in open(f"/proc/{pid}/environ","rb").read().split(b"\0"):
    if b"=" in par:
        k,_,v = par.partition(b"="); os.environ.setdefault(k.decode(), v.decode())

req = urllib.request.Request("https://openrouter.ai/api/v1/models")
with urllib.request.urlopen(req, timeout=60) as r:
    modelos = json.load(r)["data"]

print(f"modelos en OpenRouter: {len(modelos)}")
vision = [m for m in modelos
          if "image" in (m.get("architecture") or {}).get("input_modalities", [])]
print(f"con entrada de IMAGEN: {len(vision)}\n")

def precio(m, k):
    try: return float((m.get("pricing") or {}).get(k) or 0)
    except (TypeError, ValueError): return 0.0

# Un ticket: ~1200 tokens de imagen + ~200 de prompt -> ~1400 in, ~150 out (estimación declarada).
IN_TOK, OUT_TOK = 1400, 150
filas = []
for m in vision:
    pin, pout = precio(m, "prompt"), precio(m, "completion")
    pimg = precio(m, "image")
    if pin == 0 and pout == 0 and pimg == 0:
        costo = 0.0            # gratuito (o sin precio publicado)
    else:
        costo = pin*IN_TOK + pout*OUT_TOK + pimg
    filas.append((costo, m["id"], pin*1e6, pout*1e6, pimg))

filas.sort()
print(f"{'USD/ticket':>12}  {'modelo':52s} {'in $/M':>9} {'out $/M':>9} {'$/imagen':>9}")
print("-"*98)
gratis = [f for f in filas if f[0] == 0]
print(f"  ({len(gratis)} con precio 0 — gratuitos o sin precio publicado; se omiten del ranking)")
for costo, mid, pin, pout, pimg in [f for f in filas if f[0] > 0][:18]:
    print(f"{costo:12.6f}  {mid:52s} {pin:9.3f} {pout:9.3f} {pimg:9.5f}")

print("\n--- los que más interesan por reputación en OCR ---")
for clave in ("gemini-2", "gemini-3", "gpt-4o", "gpt-5", "claude", "qwen", "pixtral", "llama-3.2"):
    hits = [f for f in filas if clave in f[1]]
    for costo, mid, *_ in hits[:3]:
        print(f"  {costo:10.6f} USD/ticket  {mid}")
