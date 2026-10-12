---
name: la-capa-de-lectura-normalizo-el-sujeto-antes-de-medirlo
description: El medidor del índice de memoria pasó de chars a bytes y siguió midiendo 183 de menos, porque read_text traduce CRLF a LF antes de que el control pueda ver los bytes — absolvía un índice 108 bytes pasado del techo
metadata:
  type: feedback
---

# 📐🫥 La capa de LECTURA normalizó el sujeto ANTES de medirlo

`medir-indice-memoria.py` existe por una falla concreta: medía el índice en **caracteres** y absolvió
uno que en disco pesaba **1.210 bytes más que el techo**. Se corrigió a bytes, con un comentario largo
explicando por qué los bytes son la unidad. Y siguió ciego.

```python
texto = indice.read_text(encoding="utf-8")   # modo texto: CRLF -> LF, universal newlines
peso   = len(texto.encode("utf-8"))          # re-encodea con \n: los \r nunca existieron
```

**Medido 2026-10-12 sobre `main`:** archivo en disco **24.108 bytes**, techo **24.000**. El control
imprimía `23925 / 24000 [⚠️ ]` y salía **exit 0**. Estaba absolviendo un índice que se truncaba — la
falla exacta para la que se construyó. En Windows es **1 byte invisible por línea**: 183 líneas, 183
bytes.

**Why:** el arreglo anterior cambió la **unidad** (chars → bytes) y dio por cerrado el problema, pero
el defecto no era la unidad: era **sobre qué sujeto** se aplicaba. `read_text` devuelve una
representación que una capa intermedia ya transformó, y medir bytes de una representación normalizada
no es medir el archivo. La unidad correcta sobre el sujeto equivocado da el mismo falso verde que la
unidad equivocada. Espejo de [[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]]: ahí
la capa transforma al **salir** hacia el disco, acá al **entrar**.

**How to apply:** un control que mide una propiedad **física** del archivo lo abre en binario
(`read_bytes`), no en modo texto. Y el control de ceguera no se escribe comparando dos constantes
—eso no toca el camino de medición, es [[instrumento-que-no-mira-nunca-falla]]—: se escribe midiendo
**el sujeto real por los dos caminos** y exigiendo que difieran cuando deben diferir. El que quedó:

```python
if b"\r\n" in crudo and len(crudo) == len(indice.read_text(encoding="utf-8").encode("utf-8")):
    # tiene CRLF y las dos cifras coinciden -> alguna capa normaliza -> ciego
```

Ahora imprime la brecha en cada corrida (`bytes de DISCO (23024) — modo texto habría dicho 22849, 175
menos`), así que la ceguera no puede volver callada.
