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
