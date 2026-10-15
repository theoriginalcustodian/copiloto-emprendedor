---
name: anclar-texto-multilinea-sin-medir-el-separador-de-linea
description: Cuatro reemplazos multilínea fallaron con "0 coincidencias" sobre bytes que se veían idénticos — los .md del repo son CRLF y los .sh LF, y mi ancla llevaba \n
metadata:
  type: feedback
---

**LEER antes de reemplazar un bloque de VARIAS líneas en un repo que se trabaja en Windows** — o
después del primer «0 coincidencias» sobre un texto que acabás de leer y que coincide a la vista.

2026-10-12. Cuatro intentos de `replace` multilínea fallaron seguidos: dos en un `.sh`, dos en los
`.claude/commands/*.md`. En los cuatro leí el archivo primero, copié el fragmento del propio `sed -n`,
y el reemplazo devolvió **0 coincidencias**. Lo atribuí a que el archivo había cambiado, re-leí, y
volví a fallar. Recién al medirlo apareció la causa:

```
.claude/commands/monitoreo-backend.md   CRLF=126  LF-solo=0
scripts/vigilancia-check.sh             CRLF=0    LF-solo=523
```

**El mismo repo tiene las dos convenciones**, por tipo de archivo. Un ancla con `\n` no existe en el
`.md`: ahí cada salto es `\r\n`. Y el síntoma —0 coincidencias— es idéntico al de «el texto cambió»,
que es la hipótesis barata, así que se gastan dos o tres vueltas en re-leer.

## Por qué no se ve

El `\r` no se imprime. `cat`, `sed -n`, el visor del editor y el propio resultado de la lectura lo
muestran todo igual. Es la misma familia que
[[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]]: el byte que decide el resultado
es justo el que ninguna capa de salida muestra. Y el ancla de **una sola línea** funciona perfecto —
el `\r` vive al final—, así que la herramienta parece sana hasta que el bloque tiene dos renglones.

## Cómo aplicarlo

1. **Antes de anclar multilínea, medí el separador**, una línea:
   `python3 -c "import io;b=io.open(F,'rb').read();print(b.count(b'\r\n'), b.count(b'\n')-b.count(b'\r\n'))"`
2. Si es CRLF: **partí y uní con `\r\n`**, no con `\n`, y abrí/escribí con `newline=""` para que la
   escritura no normalice. Un archivo reescrito con `\n` aparece **entero** en el diff y pisa el
   trabajo de otra sesión en un checkout compartido — el daño no es el reemplazo fallido, es el que
   sale bien y toca 126 líneas que nadie pidió. Control: `git diff --numstat` tiene que dar un
   puñado de líneas, no el archivo.
3. **Mezcla por tipo de archivo:** no alcanza con medirlo una vez por repo. Acá los `.md` y los `.sh`
   difieren, y el `.gitattributes` no los unifica.
4. Lo que **sí** sobrevive a las dos convenciones: anclar **por número de línea** (localizar el
   encabezado del bloque y su extensión, y reemplazar el rango). Fue lo que funcionó las cuatro
   veces, incluso antes de entender la causa — y por eso casi la dejé sin entender: el workaround
   resolvía el síntoma. → [[el-workaround-que-usas-de-rutina-deja-de-parecerte-informacion]]

⚠️ Y el escape que lo empeoró: para "arreglar" un acento usé
`nuevo.encode().decode("unicode_escape")` sobre un texto que ya era UTF-8 — manglló la `Ñ` en cinco
líneas (`SIN DUEÃO`). El `assert` de salida lo cazó antes de escribir, pero la lección es la misma:
**una capa de escape extra sobre bytes ya correctos los destruye.** El control que lo caza es barato
y va en el script: `assert "Ã" not in salida`.

---

## ⚠️ REFUERZO 2026-10-14 — el atajo para **DETECTAR** el CRLF miente en Git Bash

Esta entrada manda medir el separador antes de anclar. **Hoy lo medí con el atajo obvio y me dio el
valor equivocado:** `grep -c $'\r' archivo` → **0** sobre un archivo que es **100 % CRLF**.

Lo que sí lo midió, por **efecto** y no por relato:

| control | resultado |
|---|---|
| bytes en disco | **205 049** |
| bytes del mismo blob por `git show` (LF) | **202 100** |
| delta | **2 949 = exactamente la cantidad de líneas** ⇒ 1 byte extra por línea ⇒ CRLF |
| `diff <(tr -d '\r' disco) <(git show …)` | **idéntico** ⇒ la única diferencia es el `\r` |

🔑 **Por qué el falso 0 es caro acá y no en otro lado:** si le creés, concluís «es LF» y escribís con
`
` — que es exactamente el daño que esta entrada describe en el punto 2: el archivo aparece
**entero** en el diff y pisa trabajo ajeno. El atajo falla hacia el lado que produce el reemplazo
**exitoso** y destructivo, no hacia el fallo visible.

**Cómo aplicarlo:** el separador se mide **contando bytes** (`python -c` de esta entrada), o por el
delta contra `git show <ref>:<path>` que siempre entrega LF. `grep`/`wc` en Git Bash pueden tratar la
entrada como texto y normalizar el `\r` antes de que tu patrón lo vea: son el instrumento equivocado
para preguntar por el byte que el modo texto borra.
→ [[instrumento-que-no-mira-nunca-falla]] · [[la-capa-de-lectura-normalizo-el-sujeto-antes-de-medirlo]]


🔑 **Y el cierre del dia, medido sobre este mismo archivo:** los bytes que rompen esto no vienen
solo de otros; **la CAPA del heredoc me los inyecto a mi**. Escribiendo este refuerzo, mis \\r y
\\b llegaron al disco como **CR real** (4) y **backspace 0x08** (2): la capa colapsa \\x en \\x
antes de que Python los vea, y el visor no muestra ninguno de los dos. El control que los caza es el
mismo y cuesta una linea: contar bytes de control sobre lo ESCRITO, no revisar lo que quisiste
escribir · `sum(1 for c in b if c < 9 or 13 < c < 32)` debe dar **0**, y el backslash literal se
construye por codigo (`bytes([0x5c])`), no por escape.
→ [[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]]
## Refuerzo 2026-10-15 - el medidor del separador que esta entrada recomienda **no separa**, y el heredoc colapso mi escape

Esta entrada manda **medir el separador antes de anclar**. Hoy lo hice con `grep -c $'\r' <archivo>`,
me dio **342 sobre 342 lineas** y concluí **CRLF**. Anclé con `\r\n`... y el archivo era **LF**:
quedó mixto, 341 LF sueltos mas mi bloque CRLF. Lo cazó Python, no el grep.

**Control positivo y negativo, dos archivos fabricados a proposito** (`printf 'a\r\nb\r\nc\r\n'`
y `printf 'a\nb\nc\n'`, verificados con Python: CR=3 y CR=0):

| medidor | archivo CRLF | archivo LF | separa? |
|---|---|---|---|
| Python `read().count(b'\r')` | **3** | **0** | **SI** |
| `grep -c $'\r$'` | 3 | 3 | no |
| `grep -c $'\r'` | 3 | 3 | no |
| `grep -cP '\r'` | 0 | 0 | no, y **al reves** |

**Causa de los dos primeros:** en este Git Bash el `$'\r'` **no llega a grep** — se consume antes, el
patron queda **vacio**, y un patron vacio matchea **todas** las lineas. El resultado es siempre
`= wc -l`, que es **exactamente** lo que un CRLF puro produciria: el falso positivo **imita** al
verdadero positivo, no da nunca un numero raro que te haga dudar.

**La otra cara:** `grep -cP '\r'` da **0 en los dos** — falso **negativo**, absuelve a un CRLF.
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]]

**Y la capa que casi me come de nuevo, en el mismo turno:** al escribir este refuerzo puse `\\r`
(doble) dentro de un heredoc **quoted** `<<'PY'` para que Python viera un backslash literal. Un
heredoc quoted no deberia tocar nada; medido, **colapsa el doble a uno**, y Python interpretó el
resultado como **CR real** — el `assert "\r" not in nuevo` saltó:

    s = """tiene \\r escapado"""     -> Python recibe:  'tiene \r escapado'   (CR real)

O sea: el contenido que describe el defecto **contenia** el defecto. La salida es no escribir escapes
en el cuerpo: un marcador (`\` armado con `chr(92)`) y reemplazo al final.
[[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]]

**La regla:** el separador se mide **en bytes, con Python**, nunca con grep en este shell:

    python -I -X utf8 -c "b=open(r'<path>','rb').read(); print('CR=',b.count(b'\r'),'LF=',b.count(b'\n'))"

`CR == LF` es CRLF puro · `CR == 0` es LF · cualquier otra cosa es **mixto**, y hay que normalizar
antes de anclar. El control que delata al medidor en un comando: corrélo contra un archivo que
**sabes** LF; si no da cero, no es un medidor.
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]

---

## Refuerzo 2026-10-15 — medí bien el SEPARADOR y mal el ALCANCE: el ancla incluía al vecino y el replace lo borró

Para insertar una entrada al final de un `set` de Python usé como ancla la **última entrada más la
llave de cierre**:

```python
ancla = b'    "...reveal-SE-VE-en-device...md",\r\n}'
raw = raw.replace(ancla, nuevo + b'}', 1)     # ← el vecino no se vuelve a escribir
```

El separador estaba medido (CRLF, correcto), el ancla aparecía exactamente una vez, el `os.replace` fue
atómico y la sintaxis quedó válida. **Y aun así borré la entrada de `reveal`**, porque la incluí en lo
que reemplacé y sólo re-escribí la llave. El comentario de `reveal` quedó huérfano arriba del mío.

**Cómo apareció:** no por leer el diff — por el gate. El medidor pasó de acusar a mi documento a acusar
**al de `reveal`** como «SIN CLASIFICAR». Un documento que *estaba* declarado apareciendo como no
declarado es la firma de una entrada borrada, no de un bug del parser.

**La regla:** un ancla que contiene texto que querés CONSERVAR tiene que re-emitirlo en el reemplazo.
Lo seguro es anclar en lo que **no** se toca y concatenar: `raw.replace(ancla, ancla + nuevo, 1)`,
anclando en el renglón completo del vecino (con su separador) y dejando la llave de cierre afuera.

**El control que lo caza en el acto, y es de una línea:** contar los elementos antes y después.
`N_despues == N_antes + 1` o abortar. Yo verifiqué que mi clave estuviera y que el archivo parseara —
dos preguntas sobre lo que agregué, ninguna sobre lo que había. Es el mismo sesgo que
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

Relacionadas: [[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]] ·
[[open-w-trunca-al-abrir-y-una-excepcion-en-el-write-destruye-el-archivo]]
