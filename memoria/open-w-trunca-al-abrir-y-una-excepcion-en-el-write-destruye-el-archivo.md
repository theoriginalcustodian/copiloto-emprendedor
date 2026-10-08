---
name: open-w-trunca-al-abrir-y-una-excepcion-en-el-write-destruye-el-archivo
description: open(path,"w") vacía el archivo AL ABRIR; si el write falla después, no queda ni lo viejo ni lo nuevo. Escribí a tmp + os.replace.
metadata:
  type: feedback
---

**`io.open(P, "w")` trunca el archivo en el momento de ABRIRLO, no cuando escribís.** Si la
construcción del contenido falla *después* de abrir —un `UnicodeEncodeError`, un `KeyError` de
`.format()`, un `IndexError`— el archivo queda en **0 bytes**: no quedó lo viejo ni lo nuevo.

**Medido el 2026-10-06.** Un script de enmienda del `ADR-006` falló en `f.write(s)` por surrogates
sueltos (`\ud83d\udd34` escrito como dos escapes `\u` en Python 3 **no es un carácter**). El
traceback decía `UnicodeEncodeError` y parecía inofensivo: "no escribió nada". Medí igual, y el ADR
estaba en **0 bytes / 0 líneas**. Se recuperó sólo porque ya estaba en `main`
(`git show origin/main:<path> > <path>`, sin `checkout`, que en checkout compartido pisa trabajo
ajeno → [[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]]).

**Por qué muerde:** el traceback apunta al `write`, así que se lee como "la operación no ocurrió".
La operación destructiva **ya ocurrió**, una línea antes, en el `open`. Y un `with` no salva nada:
cierra el descriptor de un archivo que ya está vacío.

**Cómo aplicarlo**
- Todo script que reescribe un archivo existente: `tmp = P + ".tmp"` → escribir → `os.replace(tmp, P)`.
  `os.replace` es atómico: o está lo viejo o está lo nuevo, nunca el vacío.
- **Construí el contenido COMPLETO antes de abrir nada.** Si el string se arma dentro del `with`,
  el formato ya es destructivo.
- Después de cualquier edición por script, **control de que no quedó vacío**: `wc -c`. Cuesta una
  línea y es el único check que distingue "falló y no tocó nada" de "falló y borró todo".
- Y si falló: el archivo se restaura desde el remoto por **redirección**, no con `git checkout`.

→ [[raiz-no-parche]] · [[el-instrumento-tambien-CONDENA-no-solo-absuelve]]

## Caso 2026-10-08 — `python -I` **implica `-E`**, así que ignora `PYTHONIOENCODING`

Dos cosas de la misma corrida, y la primera es la que salvó el archivo.

**(1) El `UnicodeEncodeError` cayó en el `print`, no en el `write`.** Un script de corrección de
docs explotó con `\u2713` sobre la consola `cp1252` de Windows. No perdí nada **por suerte de
orden**: los `print` de control estaban **antes** del `io.open(..., 'w')`, así que murió sin haber
abierto el destino. Si los hubiera puesto después — que es lo natural, «escribo y reporto» — el
`open('w')` ya habría truncado y el `print` del final habría matado al proceso **con el archivo en
cero**. La lección de esta entrada, con un disparador nuevo: **el que trunca no tiene que ser el
que falla**; basta que el que falla corra después. Poné los `print` con glifos **antes** del
`open('w')`, o escribí a temp + `os.replace`.

**(2) El fix obvio no funciona, y el motivo no es obvio.** `PYTHONIOENCODING=utf-8 python -I ...`
**no tiene efecto**: `-I` (modo aislado, el que este entorno pide para correr scripts sobre datos
no confiables) **implica `-E`**, y `-E` ignora **todas** las variables `PYTHON*`. La variable está
puesta, el proceso la ve en el `env`, y el intérprete la descarta — así que el síntoma es
«configuré el encoding y sigue fallando igual», sin ningún mensaje que lo explique.

**La salida es un flag de línea de comandos, no una env var:**

```bash
python -I -X utf8=1 script.py      # ✅ UTF-8 mode, convive con -I
PYTHONIOENCODING=utf-8 python -I   # ❌ -I implica -E: la ignora en silencio
```

**Generalización:** un flag que **apaga un canal de configuración entero** (`-E`, `--no-rc`,
`--isolated`, `env -i`) convierte cualquier arreglo por env var en un no-op **mudo**. Cuando una
variable «no hace nada», antes de dudar del valor revisá si algo apagó el canal.
