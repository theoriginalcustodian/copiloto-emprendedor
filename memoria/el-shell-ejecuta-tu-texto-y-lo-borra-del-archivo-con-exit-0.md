---
name: el-shell-ejecuta-tu-texto-y-lo-borra-del-archivo-con-exit-0
description: Un backtick dentro de comillas dobles en bash no rompe el comando: ejecuta tu contenido, lo borra del texto que se escribe al archivo, y sale 0
metadata:
  type: feedback
---

Cuando el **payload es texto que se va a escribir**, un defecto de quoting **no falla: edita el
payload**. El script imprime su propio «OK», el exit code es 0, y el daño queda en el **artefacto**,
no en el log.

El caso, 2026-10-13, tres veces en una hora. Comando de la forma:

```bash
python -I -c "
... '> Lo vigente: `coordinacion/PLAN.md` y el padrón medido' ...
"
```

Bash hace **command substitution** sobre lo que está entre backticks **aunque esté dentro de comillas
simples de Python**: las comillas simples son de Python, no del shell, y el shell parsea primero.

Las tres pasadas, con síntomas distintos y cada vez más silenciosos:

1. `` `coordinacion/PLAN.md` `` → `No such file or directory`. **El mensaje apunta a un path**, así que
   se lee como un problema de archivo, no de quoting. El python corrió igual y escribió el doc **con la
   frase mutilada**.
2. Cuatro backticks (`` `4b8d5f8a` ``, `` `159f883b` ``, `` `backend + nativa` ``, `` `preg` ``) →
   cuatro `command not found` y **cuatro palabras borradas** del texto escrito al doc. El script
   imprimió `limpio` y salió 0.
3. La tercera ya la cacé antes de correr, porque el renglón reparado volvió a tener backticks.

**La firma en el log:** un `command not found` cuyo nombre es **tu contenido** — un sha, un path, dos
palabras con espacio en medio. Nadie quiso ejecutar eso: el shell se comió tu texto. Si el contenido
casualmente **existe** como comando, no hay ni esa línea.

**Cómo aplicarlo:**
1. **Texto destinado a un archivo no pasa por las comillas dobles del shell.** Va en un heredoc con
   delimitador **entre comillas** (`<<'PY'`, que desactiva toda expansión) o en un `.py` escrito con la
   herramienta de escritura. Un heredoc **sin** comillas en el delimitador tiene el mismo defecto.
2. **El control es leer el artefacto buscando el token distintivo** (`grep -c '\`<sha>\`'`), no el exit
   code ni el «OK» del script. Acá el exit fue 0 las dos veces que hubo daño.
3. Primo de [[el-pipe-se-come-el-exit-code]], pero **peor**: ahí el código miente y el artefacto está
   bien; acá el artefacto cambia y **todos** los códigos dicen que salió bien.
4. Misma familia que [[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]] y
   [[open-w-trunca-al-abrir-y-una-excepcion-en-el-write-destruye-el-archivo]]: el canal de escritura
   transforma el contenido en silencio. El canal es parte del instrumento, no plomería.

**Por qué cuesta caro en este repo:** casi todo lo que escribo son docs con `` `sha` ``, `` `path` `` y
`` `id` `` en backticks. O sea que **el contenido más frecuente es exactamente el que el shell borra**,
y lo que desaparece son las **procedencias** — justo lo que hace citable a una cifra
([[un-escape-que-pasa-por-una-capa-extra-llega-como-byte-invisible]]).
