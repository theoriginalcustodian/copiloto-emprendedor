"""Separa las fichas que AFIRMAN UNA AUSENCIA -- la unica clase refutable con un grep.

POR QUE EXISTE (2026-11-02, el dia que cayeron CINCO premisas del mismo relevamiento):

  `SM-J4` decia "la app no recibe monto/comprobantes" (llegaban desde el 06-10) · `SM-K6` "el aviso
  no existe en ningun archivo" (existia con otra redaccion) · `SM-J2` "faltan los chips" (existen,
  y los dos reclamados estan APAGADOS POR DECISION documentada) · `SM-J5` "la agenda no distingue
  hoy" (agrupa Hoy/Manana/Esta semana/Sin hora, ADR-004) · `SM-K3` "falta Necesito cambiarlo"
  (omitido por decision DEL OPERADOR, BL-V27).

  Dos habrian REVERTIDO una decision deliberada; la de `SM-K3` era del operador, o sea un MAYOR
  disfrazado de tarea tactica. La refutacion estaba EN EL CODIGO en las cinco --en cuatro, dentro de
  un comentario que explicaba la decision--.

  Y el dato que obliga a que esto sea un SCRIPT y no una recomendacion: **ninguna la encontro quien
  planifico, leyendo su propio relevamiento.** Las encontro quien fue a implementar. El que escribe
  el codigo corre el `git grep` por necesidad; el que planifica CITA -- y una cita `path:linea`
  parece medida, porque la precision del formato se lee como frescura. El rol que baja los contratos
  es estructuralmente el que menos puede detectar su propia premisa rancia, asi que el control no
  puede vivir en su buena voluntad.

COMO SE USA -- antes de bajar las fichas de un sprint, no despues del tercer incidente:

    python -I -X utf8 scripts/premisas-de-ausencia.py <doc-de-backlog.md>

  Para cada ficha de la lista ">>> AFIRMAN UNA AUSENCIA", correr ANTES de bajarla:
    git grep -n '<simbolo>' -- <ruta>          # existe hoy?
    git log -S '<simbolo>' --oneline -- <ruta>  # cuando entro? (vs. la fecha del relevamiento)
  y LEER EL DOCSTRING del archivo que la ficha manda tocar: ahi vivian 4 de las 5 refutaciones.

QUE NO HACE: no juzga las fichas de CONDUCTA ("sigue pidiendo CUIT", "difiere del mapa"). Un grep no
las refuta -- se miden corriendo la app. Clasificar no es verificar: este script dice DONDE mirar.

Determinista a proposito (regla global 8): la clasificacion es por patron, no por juicio de un LLM.

CONTROL propio: la suma de las tres clases tiene que dar el total de PENDIENTES del doc. Si no da,
el barrido perdio bloques y lo dice -- un barrido que mira menos de lo que cree nunca falla.
"""
import re, sys, pathlib

DOC = pathlib.Path(sys.argv[1])
t = DOC.read_text(encoding="utf-8")

# Patrones de AUSENCIA: afirman que algo no esta. Son los refutables con un grep.
AUSENCIA = re.compile(
    r"no (existe|llega|lleg[oó]|trae|viene|est[aá]|aparece|hay |se recibe|los recibe|se guarda|"
    r"persiste|se dibuja|se muestra)|falta[n]? (el|la|los|las|un|una)|ausente|inexistente|"
    r"sin (campo|endpoint|aviso|dato)", re.I)
# Patrones de CONDUCTA: describen que algo hace algo mal. Un grep no los refuta.
CONDUCTA = re.compile(r"sigue (pidiendo|diciendo|mostrando)|dice|desmiente|no coincide|difiere|"
                      r"se corta|se solapa|queda (chico|grande|tapado)", re.I)

bloques = re.split(r"^### ", t, flags=re.M)[1:]
ausencia, conducta, otras = [], [], []
for b in bloques:
    m = re.match(r"\*{0,2}(SM-[A-Z][0-9]+)\*{0,2}", b)
    if not m:
        continue
    fid = m.group(1)
    if not re.search(r"^- \*\*Estado:\*\*\s*PENDIENTE", b, re.M):
        continue
    titulo = b.split("\n", 1)[0]
    titulo = re.sub(r"^\S+\s*·\s*`[^`]*`\s*[—-]\s*", "", titulo).strip()
    cuerpo = b
    if AUSENCIA.search(cuerpo):
        ausencia.append((fid, titulo))
    elif CONDUCTA.search(cuerpo):
        conducta.append((fid, titulo))
    else:
        otras.append((fid, titulo))

tot = len(ausencia) + len(conducta) + len(otras)
print("PENDIENTES examinadas: %d" % tot)
print("\n>>> AFIRMAN UNA AUSENCIA -- RE-MEDIR con `git grep` + `git log -S` ANTES de implementar (%d)" % len(ausencia))
for fid, ti in ausencia:
    print("  %-8s %s" % (fid, ti[:95]))
print("\n--- describen CONDUCTA: un grep no las refuta, se miden corriendo la app (%d)" % len(conducta))
for fid, ti in conducta:
    print("  %-8s %s" % (fid, ti[:95]))
print("\n--- resto (%d)" % len(otras))
for fid, ti in otras:
    print("  %-8s %s" % (fid, ti[:95]))
# CONTROL: la suma tiene que dar el total de PENDIENTES del doc, o el barrido perdio bloques.
esperado = len(re.findall(r"^- \*\*Estado:\*\*\s*PENDIENTE", t, re.M))
print("\nCONTROL: clasificadas %d de %d PENDIENTES del doc%s" % (tot, esperado, "" if tot == esperado else "  <-- SE PERDIERON BLOQUES"))
