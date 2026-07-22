"""S3: ¿el content-parts de OpenRouter anda con el transporte actual (urllib + json a mano, sin SDK)?

Y de paso un PRIMER control de S4 con material sintético — no reemplaza las fotos del operador, pero
si un modelo ya inventa acá, inventa peor con un térmico arrugado.

Las dos imágenes se generan acá para no depender de nadie:
  A = "ticket" sintético legible  -> ¿lee los campos?
  B = ruido puro, NO es un ticket -> ¿dice "no puedo" o INVENTA un monto?

El caso B es el que decide más: un monto alucinado entra a la base y envenena la rentabilidad, que es
la razón por la que el operador quiere cargar gastos. Un fallo se ve; una alucinación no.
"""
import base64, io, json, os, random, subprocess, urllib.error, urllib.request
from PIL import Image, ImageDraw

pid = subprocess.run(["systemctl","show","-p","MainPID","--value","uc-copiloto-worker.service"],
                     capture_output=True, text=True).stdout.strip()
for par in open(f"/proc/{pid}/environ","rb").read().split(b"\0"):
    if b"=" in par:
        k,_,v = par.partition(b"="); os.environ.setdefault(k.decode(), v.decode())
KEY = os.environ["OPENAI_API_KEY"]
URL = "https://api.openai.com/v1/chat/completions"

def png_b64(img):
    b = io.BytesIO(); img.save(b, format="PNG")
    return base64.b64encode(b.getvalue()).decode()

# A: ticket sintético
a = Image.new("RGB", (420, 560), "white"); d = ImageDraw.Draw(a)
for i, linea in enumerate([
        "FERRETERIA EL TORNILLO", "Av. Mitre 1234 - Moron", "", "15/07/2026  14:32",
        "------------------------------", "2 x Tornillos M6      1.200,00",
        "1 x Cinta aisladora     850,00", "1 x Silicona          3.400,00",
        "------------------------------", "SUBTOTAL             5.450,00",
        "TOTAL                5.450,00", "", "EFECTIVO", "Gracias por su compra"]):
    d.text((20, 24 + i*34), linea, fill="black")

# B: ruido puro — no hay ticket que leer
random.seed(7)
b = Image.new("RGB", (420, 560))
b.putdata([(random.randint(0,255), random.randint(0,255), random.randint(0,255))
           for _ in range(420*560)])

PROMPT = ("Sos un lector de tickets de gastos. Devolvé SOLO JSON con las claves: "
          "monto (número o null), fecha (YYYY-MM-DD o null), proveedor (texto o null), "
          "legible (true/false), motivo (texto corto si no es legible). "
          "Si la imagen no es un ticket o no podés leer un dato, poné null y legible=false. "
          "NUNCA inventes un monto.")

def pedir(modelo, img, etiqueta):
    payload = {"model": modelo, "messages": [
        {"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64," + png_b64(img)}}]}],
        "max_tokens": 300}
    req = urllib.request.Request(URL, data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        print(f"  {etiqueta:9s} HTTP {e.code}: {e.read().decode()[:160]}"); return None
    txt = (d["choices"][0]["message"]["content"] or "").strip()
    us = d.get("usage") or {}
    print(f"  {etiqueta:9s} tokens in={us.get('prompt_tokens')} out={us.get('completion_tokens')}  "
          f"{txt[:150].replace(chr(10),' ')}")
    return txt

for modelo in ("gpt-4o-mini",):
    print(f"\n=== {modelo} ===")
    pedir(modelo, a, "TICKET")
    pedir(modelo, b, "RUIDO")     # <- el control: ¿dice que no puede, o inventa?
