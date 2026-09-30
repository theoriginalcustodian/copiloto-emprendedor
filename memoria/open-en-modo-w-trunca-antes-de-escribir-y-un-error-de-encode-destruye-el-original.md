---
name: open-en-modo-w-trunca-antes-de-escribir-y-un-error-de-encode-destruye-el-original
description: Un script de "editar en el lugar" (leer, reemplazar, escribir) borra el archivo cuando falla al escribir — `open(path,"w")` trunca al abrir, antes de que el encode pueda fallar; el patrón seguro es escribir a temporal y renombrar, y el disparador más fácil en Python es un emoji pasado como par surrogate, que UTF-8 rechaza.
metadata:
  type: feedback
---

**2026-09-30, agregando un párrafo a un `pedido_` del buzón.** El script era el mismo que ya había usado
seis veces ese día: leer, `str.replace`, escribir.

```python
t = io.open(p, encoding="utf-8").read()
t = t.replace(ancla, nuevo + ancla, 1)
io.open(p, "w", encoding="utf-8", newline="\n").write(t)
```

El texto nuevo traía un emoji que escribí como escape de **par surrogate** (`"🗄️"`, la
forma UTF-16 de 🗄️). UTF-8 no acepta surrogates sueltos, así que el `.write()` levantó
`UnicodeEncodeError`. **El archivo quedó en 0 bytes.**

## Por qué destruye en vez de fallar

`open(path, "w")` **trunca el archivo al abrirlo**. El encode ocurre después. Entre esos dos momentos el
contenido original ya no existe en ninguna parte:

```
open(p,"w")   -> el archivo pasa a 0 bytes      <-- el dano ya esta hecho
.write(t)     -> UnicodeEncodeError             <-- el error avisa DESPUES
```

**El traceback habla del encode, no del borrado.** Se lee como «no pude escribir», que suena a que nada
cambió, cuando lo que pasó es exactamente lo contrario: no se escribió **y** se borró.

Y el archivo era del buzón, que **no se versiona** (`coordinacion/` está en `.gitignore`), así que no
había `git checkout` que lo trajera de vuelta. Lo reconstruí de la lectura que tenía en contexto — y eso
sólo funcionó por suerte: lo había leído completo minutos antes.

## El patrón seguro

```python
tmp = p + ".tmp"
with io.open(tmp, "w", encoding="utf-8", newline="\n") as f:
    f.write(t)          # si el encode falla, revienta ACA y el original esta intacto
os.replace(tmp, p)      # atomico en el mismo filesystem
```

Y el detalle que evita el disparador: **no escribas emojis como escapes de surrogate**. En Python un
emoji va literal en el fuente (`"🗄️"`) o por su codepoint real (`"\U0001F5C4"`), nunca como el par
UTF-16. Si el texto viene de otra parte, `t.encode("utf-8", "surrogatepass")` o un
`t.encode("utf-16","surrogatepass").decode("utf-16")` lo normaliza antes.

## El control, que es una pregunta

**«Si esta operación falla a mitad, ¿qué queda en disco?»** Para `open(...,"w")` la respuesta es *nada*, y
eso no es visible en el código: el `w` se lee como «voy a escribir», no como «primero borro». La misma
pregunta caza `> archivo` en shell (trunca antes de que el comando de la izquierda corra) y cualquier
`Write` que pise un archivo que no se puede regenerar.

**Why:** porque este script es la herramienta que uno usa **para corregir** documentos — así que el fallo
llega justo cuando el archivo importa, y el error que imprime no menciona el daño. Acá destruyó un
`pedido_` de 177 líneas con tres correcciones propias adentro, en una carpeta sin versionar, mientras yo
le agregaba un párrafo que pedía **no dejar entradas invisibles**. El instrumento borró lo que venía a
mejorar.

**How to apply:** (1) toda edición en el lugar de un archivo que no se puede regenerar va a **temporal +
`os.replace`**, nunca `open(...,"w")` directo; (2) antes de editar algo de una carpeta no versionada,
preguntá de dónde saldría la copia si el script falla — si la respuesta es «de mi contexto», ya estás
apostando; (3) emojis literales o `\U0001F...`, jamás pares surrogate; (4) si igual pasó: **reconstruí y
declaralo en el propio archivo** (yo dejé un bloque diciendo que el cuerpo es una transcripción), porque
quien lo lea después no tiene forma de saber que no es el original.
