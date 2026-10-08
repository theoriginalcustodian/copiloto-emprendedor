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

## Consolidado el 2026-10-08 — esta clase vivia en TRES entradas

El indice cargaba **una** (esta) y habia otras dos con la misma leccion raiz, escritas sin
verla: `el-open-w-trunca-antes-de-que-el-write-falle` (05/10) y
`open-en-modo-w-trunca-antes-de-escribir-y-un-error-de-encode-destruye-el-original` (30/09).
El mecanismo es [[el-indice-truncado-fabrica-duplicados]] en vivo: **lo que no se carga no
existe al escribir**, asi que la tercera mordida de la misma clase se escribe como si fuera
nueva. Las dos quedan, pero apuntando aca; lo que no estaba en esta entrada es lo de abajo.

**1. La ASIMETRIA que hace que esta clase no se vea venir** (del caso del 05/10). El mismo
dia, los finales de linea produjeron **cuatro** fallos de parcheo y los cuatro fueron
BENIGNOS: un patron con `\n` contra un archivo CRLF da 0 matches, el script aborta sin
escribir, y el sintoma es «NO ENCONTRE EL ANCLA». Un error al **leer** o al **buscar** aborta
antes de tocar el disco: barato, ruidoso, autocorregible. Un error al **serializar** ocurre
con el destino ya truncado: silencioso y destructivo. **La diferencia no es la causa, es
DONDE falla** — y la pregunta correcta no es «puede fallar?» sino **«falla antes o despues de
abrir el destino?»**, que `tmp` + `os.replace` vuelve irrelevante.

**2. Un artefacto no versionado necesita un respaldo DELIBERADO.** El caso del 05/10 destruyo
`coordinacion/PLAN.md` (363 KB, el tablero de las cuatro sesiones), que esta gitignored **a
proposito**: no hay `git show` que lo traiga. El unico respaldo que existia era **el corpus
congelado que otra sesion hacia para otra cosa**. Perdida medida: ~3707 bytes, una fila entera
reconstruida y marcada como reconstruida. Antes de editar algo de una carpeta no versionada,
preguntate de donde saldria la copia si el script falla: si la respuesta es «de mi contexto»,
ya estas apostando.

**3. El patron seguro deja un RESIDUO que engana al proximo control** (del caso del 30/09). El
`with` crea el temporal **antes** de que el write falle, asi que el fallo deja un huerfano de
0 bytes **cuyo nombre empieza igual que el archivo bueno**. Una verificacion con
`glob(patron)[0]` tomo el `.tmp`, midio 0 lineas, y estuvo a un paso de concluir que el mensaje
propio habia salido vacio: el mensaje estaba perfecto, **el instrumento midio otro objeto**
([[el-instrumento-respondio-sobre-otro-sujeto]]). De ahi dos reglas: el temporal va **fuera**
del directorio que otros escanean o con un prefijo que ningun glob del dominio matchee (este
script usa `.wip`, no `.tmp`); y **todo glob de verificacion imprime CUANTOS objetos matcheo**,
nunca solo el `[0]`.

**Lo que NO se consolido, porque es otra leccion:** los seis refuerzos del 30/09 sobre el
**canal** (heredoc que ejecuta backticks, escapes que no sobreviven heredoc->Python->archivo,
el delimitador que cierra su propio continente, y la regla «dos fallos identicos del canal no
son un bug a depurar: son la senal de cambiar de canal»). Viven en su entrada y se buscan por
ahi.
