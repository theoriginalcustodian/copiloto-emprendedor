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

---

## Refuerzo (2026-09-30, el mismo día): el patrón seguro **protege el original y deja un residuo que engaña al próximo control**

Apliqué esto mismo pocas horas después, escribiendo un `urgente_` al buzón, y **funcionó**: el emoji
volvió a entrar como par surrogate (`\ud83e\udd16` en vez de `\U0001F916`), el `.write()` reventó, y el
`os.replace` nunca corrió. **Ningún `.md` se perdió.** El patrón es correcto.

**Lo que no había previsto es lo que queda en disco.** El `with` ya había creado
`<nombre>.md.tmp`, así que el fallo deja **un huérfano de 0 bytes cuyo nombre empieza igual que el
archivo bueno**. Y ahí muerde:

```
abierto/…-lo-acredita-un-push-que-paso-SIN-sincronizar-….md.tmp   0 B   <- residuo del fallo
abierto/…-lo-puede-acreditar-un-push-que-paso-SIN-sincronizar-….md  5144 B <- el bueno
```

Mi verificación fue `glob('*un-push-que-paso-SIN-sincronizar*')[0]` → **tomó el `.tmp`**, midió 0 líneas
y 0 acentos, y estuve a un paso de concluir que mi propio mensaje había salido vacío. El mensaje estaba
perfecto; **el instrumento midió otro objeto**, porque el residuo del intento anterior matchea el mismo
patrón y ordena antes alfabéticamente.

**Dos consecuencias prácticas:**
1. El `.tmp` va **fuera** del directorio que otros escanean, o con un prefijo que ningún glob del
   dominio matchee (`.wip-<nombre>`), o se borra en un `except`/`finally`. En un buzón que se ordena por
   janitor, un huérfano de 0 bytes es peor que nada: se cuenta como mensaje y se abre vacío.
2. **Todo glob de verificación imprime CUÁNTOS objetos matcheó, no sólo el `[0]`.** Un `[0]` silencioso
   es la misma familia de defecto que el `head -N` que trunca antes de llegar a la sección que buscabas.

**How to apply (agregado):** al verificar lo que acabás de escribir, listá los matches con su tamaño
antes de leer uno; y si el patrón matchea más de uno, eso ya es el hallazgo.

---

## Refuerzo 2 (2026-09-30, tercera mordida del mismo día): el heredoc **sin** comillas ejecuta los backticks, y el texto queda **gramatical y vacío**

Tercera vez que la herramienta de editar documentos me muerde, y la peor, porque esta **no deja
rastro de error**.

Necesitaba interpolar una ruta larga, así que abrí el heredoc sin comillas — `python3 <<XX` en vez de
`python3 <<'XX'`. El shell trató cada `` `...` `` del markdown como **sustitución de comando**:
ejecutó `min_support 2→3`, falló con `command not found`, y **sustituyó por cadena vacía**. Lo que
se escribió fue:

    | re-poda  | **1403** |  con , todas |

**El párrafo quedó sintácticamente entero y sin un solo término técnico.** Se lee como prosa
descuidada, no como corrupción, así que nadie lo revisa dos veces. Y el script imprimió «corrección
appendeada» con éxito: el `os.replace` funcionó perfecto, sólo que sobre contenido ya destruido.
**El patrón seguro protege del fallo de escritura; no protege de que el texto llegue mutilado.**

## El control que no podía funcionar

Verifiqué con un `grep` de backticks dobles, buscando backticks «vacíos». Dio 4, que eran las cercas
de bloques de código legítimos. **Los backticks no quedaron vacíos: desaparecieron con su contenido
adentro.** Buscaba una forma que el defecto no puede producir — mismo error que
[[instrumento-que-no-mira-nunca-falla]] — y me habría dejado creer que el archivo estaba bien.

El control correcto es **positivo sobre el contenido esperado**: listar las palabras que tienen que
estar y contar cada una. `attributes.context` daba **0**; tras reescribir, **1**. Eso sí discrimina.

## Y la tercera capa, que pagué escribiendo este refuerzo

Reintenté con el heredoc **quoted**, que es el fix correcto… y falló igual: el contenido incluía el
ejemplo del defecto, y **la línea con el delimitador cerró el heredoc antes de tiempo**. Python
reventó con `unterminated triple-quoted string` y el resto del texto se lo comió bash como comandos.
Nada se escribió (el original quedó intacto), pero el patrón es claro: **un documento que explica un
heredoc no puede viajar dentro de un heredoc con el mismo delimitador.** Delimitador largo y único, y
el ejemplo interno con uno ficticio.

**How to apply (agregado):**
1. **Heredoc con markdown → SIEMPRE quoted.** Si hace falta una ruta variable, va por **entorno**
   (`export F=...` + `os.environ["F"]`), nunca abriendo el heredoc. El markdown técnico está *hecho*
   de backticks: interpolarlo es garantizar el daño.
2. **Delimitador largo y único** (`REFUERZO_FIN_2026_09_30`, no `EOF`/`PY`), y si el texto muestra un
   heredoc, que el ejemplo use un delimitador ficticio.
3. **Después de escribir markdown desde el shell, contá las palabras clave, no la puntuación.** Un
   grep de la sintaxis que sospechás no ve las ausencias.
4. Si ya salió mutilado: **reescribir el bloque entero**, nunca parchear palabra por palabra — no hay
   forma de saber cuántas se comió.
