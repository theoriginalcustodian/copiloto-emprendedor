"""Spike OCR de tickets — S1..S4 contra fotos REALES y con el caso hostil horneado.

Ground truth: lo leí yo mismo mirando cada foto ANTES de correr el modelo. Sin eso, "extrajo bien"
sería una opinión sobre un texto que suena plausible.

Los dos controles de §4 se FABRICAN a partir de una foto real:
  C1  ruido puro (no es un ticket)          -> ¿dice "no puedo" o inventa?
  C2a el TOTAL tapado, ítems visibles       -> ¿lo suma (aceptable, hay que saberlo) o lo inventa?
  C2b TOTAL e ítems tapados                 -> no hay forma de saberlo: inventar acá es lo grave
"""
import base64, io, json, os, random, subprocess, urllib.error, urllib.request
from PIL import Image, ImageDraw, ImageFilter

pid = subprocess.run(["systemctl","show","-p","MainPID","--value","uc-copiloto-worker.service"],
                     capture_output=True, text=True).stdout.strip()
for par in open(f"/proc/{pid}/environ","rb").read().split(b"\0"):
    if b"=" in par:
        k,_,v = par.partition(b"="); os.environ.setdefault(k.decode(), v.decode())
KEY, URL = os.environ["OPENAI_API_KEY"], "https://api.openai.com/v1/chat/completions"
MODELO = "gpt-4o-mini"                      # el que YA usa el worker (worker_b.build_llm)
D = "/tmp/ocr_fotos"

VERDAD = {
  "t1_austria": dict(monto="0.00", fecha="03.08 (sin año)", proveedor="(sin nombre visible) mesa 22/0",
                     nota="ticket de PRUEBA: todo en 0.00 EUR. Arrugado, con reflejos"),
  "t2_nepal":   dict(monto="739.59", fecha="2015-03-09", proveedor="YinYang Restaurant & Bar",
                     nota="matricial, poca luz, total al pie tras varios subtotales"),
  "t3_canada":  dict(monto="34.96", fecha="2018-10-18", proveedor="NSLC",
                     nota="ROTADO 90°, arrugado — el caso duro"),
  "t4_bill":    dict(monto="97.23", fecha="2005-07-11", proveedor="Umami Tapas Bar",
                     nota="escaneo limpio B/N — caso FÁCIL"),
}

def b64(img, max_lado=1024):
    im = img.copy(); im.thumbnail((max_lado, max_lado))
    b = io.BytesIO(); im.convert("RGB").save(b, format="JPEG", quality=80)
    return base64.b64encode(b.getvalue()).decode()

PROMPT = ("Sos un lector de tickets de gastos. Devolvé SOLO JSON: "
          "monto (número o null), fecha (YYYY-MM-DD o null), proveedor (texto o null), "
          "legible (true/false), motivo (texto corto si algo no se pudo leer). "
          "monto = el TOTAL final que se pagó. "
          "Si la imagen no es un ticket, o si un dato no se ve, poné null. NUNCA inventes un monto.")

def leer(img, etiqueta, max_lado=1024):
    payload = {"model": MODELO, "max_tokens": 300, "messages": [{"role":"user","content":[
        {"type":"text","text":PROMPT},
        {"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+b64(img,max_lado)}}]}]}
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization":f"Bearer {KEY}","Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r: d = json.load(r)
    except urllib.error.HTTPError as e:
        print(f"  {etiqueta:12s} HTTP {e.code} {e.read().decode()[:120]}"); return None, 0
    txt = (d["choices"][0]["message"]["content"] or "").strip().strip("`")
    if txt.startswith("json"): txt = txt[4:]
    us = d.get("usage") or {}
    tin, tout = us.get("prompt_tokens",0), us.get("completion_tokens",0)
    costo = tin*0.15/1e6 + tout*0.60/1e6         # precios gpt-4o-mini
    try: dat = json.loads(txt)
    except json.JSONDecodeError: dat = {"_crudo": txt[:120]}
    return dat, costo

print("=== S2: fotos REALES (ground truth leído a mano antes de correr esto) ===")
total = 0.0
for nombre, v in VERDAD.items():
    img = Image.open(f"{D}/{nombre}.jpg")
    got, c = leer(img, nombre); total += c
    if got is None: continue
    ok = "?"
    if got.get("monto") is not None:
        ok = "OK " if f"{float(got['monto']):.2f}" == v["monto"] else "MAL"
    print(f"\n  [{ok}] {nombre}  ({v['nota']})")
    print(f"       esperado: monto={v['monto']:12s} fecha={v['fecha']:16s} prov={v['proveedor']}")
    print(f"       obtuvo  : monto={str(got.get('monto')):12s} fecha={str(got.get('fecha')):16s} "
          f"prov={got.get('proveedor')}  legible={got.get('legible')}  ${c:.5f}")

print("\n=== S4: el caso HOSTIL — ¿dice 'no puedo' o inventa? ===")
random.seed(11)
ruido = Image.new("RGB",(900,1200))
ruido.putdata([(random.randint(0,255),)*3 for _ in range(900*1200)])
got, c = leer(ruido, "C1_ruido"); total += c
print(f"\n  C1 ruido puro (no es un ticket)  ->  monto={got.get('monto')}  legible={got.get('legible')}"
      f"  motivo={str(got.get('motivo'))[:60]}   ${c:.5f}")

base = Image.open(f"{D}/t4_bill.jpg").convert("RGB")     # el limpio: el más fácil de alucinar bien
w, h = base.size
c2a = base.copy(); ImageDraw.Draw(c2a).rectangle([0, int(h*0.735), w, int(h*0.775)], fill="white")
got, c = leer(c2a, "C2a"); total += c
print(f"  C2a TOTAL tapado, ítems visibles ->  monto={got.get('monto')}  legible={got.get('legible')}"
      f"  motivo={str(got.get('motivo'))[:60]}   ${c:.5f}")
print("      (verdad: 97.23 — tapado. Sumar los ítems sería aceptable; hay que SABER que lo hace)")

c2b = base.copy(); ImageDraw.Draw(c2b).rectangle([0, int(h*0.33), w, int(h*0.80)], fill="white")
got, c = leer(c2b, "C2b"); total += c
print(f"  C2b TOTAL e ítems tapados        ->  monto={got.get('monto')}  legible={got.get('legible')}"
      f"  motivo={str(got.get('motivo'))[:60]}   ${c:.5f}")
print("      (no hay forma de deducirlo: cualquier número acá es INVENTADO)")

borrosa = base.filter(ImageFilter.GaussianBlur(12))
got, c = leer(borrosa, "C3_borrosa"); total += c
print(f"  C3 la misma foto MUY borrosa     ->  monto={got.get('monto')}  legible={got.get('legible')}"
      f"  motivo={str(got.get('motivo'))[:60]}   ${c:.5f}")

print(f"\n=== S1: costo real medido — {total:.5f} USD por las 8 llamadas "
      f"({total/8:.5f} USD/ticket con {MODELO}) ===")
