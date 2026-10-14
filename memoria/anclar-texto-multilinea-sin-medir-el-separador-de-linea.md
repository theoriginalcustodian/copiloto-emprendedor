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
