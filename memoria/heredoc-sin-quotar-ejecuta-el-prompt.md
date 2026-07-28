---
name: heredoc-sin-quotar-ejecuta-el-prompt
description: Un prompt de sub-agente escrito con heredoc sin quotar se EJECUTA — los 5 barridos arrancaron mutilados y hubo que matarlos; verificar el artefacto generado antes de despachar N agentes
metadata:
  type: project
---

**Un heredoc `<<EOF` (sin comillas) expande `$var`, `$(cmd)` y **backticks** del contenido.** Si lo
que estás metiendo ahí es un **prompt** —que naturalmente lleva backticks para citar `archivo.py:12`
o `except: pass`— bash **ejecuta esos fragmentos como comandos** y los reemplaza por su salida
(vacía). El texto que llega al sub-agente queda con agujeros exactamente donde estaban las
referencias más importantes.

Pasó el 2026-07-28 al despachar 6 barridos de auditoría: los 5 primeros salieron con
`raise: command not found`, `except: command not found`, `print(: syntax error`, y arrancaron igual.
Tres seguían vivos trabajando sobre prompts roto cuando los encontré.

**Cómo se caza (y por qué casi no se caza):** el `claude -p` **no falla** con un prompt mutilado —
devuelve un reporte plausible sobre lo que le quedó. Los errores de bash no aparecen en el reporte:
aparecen en el **stdout del lanzador**, que es justo lo que uno no mira cuando despacha en
background y espera la notificación. Es un instrumento que no protesta: el silencio del agente se
lee como "está trabajando bien".

**La regla:**

1. Todo texto con sintaxis de otro lenguaje va en heredoc **quotado**: `<<'EOF'`. Si necesitás
   interpolar algo, escribí las partes por separado y unilas con `cat a b > full`.
2. **Verificá el artefacto generado, no la intención**: antes de despachar, contar bytes y grepear 2-3
   marcas que deben estar (`wc -c`, `grep -c '^EJE A'`, `grep -c '## Hallazgos'`). Cuesta un comando.
3. Leé el stdout del lanzador **en el mismo turno** en que despachás. Un `command not found` ahí
   invalida todo lo que venga después.

**Por qué rinde:** el costo de no verificar no es "un prompt raro" — es N reportes que parecen
buenos, entran a la síntesis, y contaminan un dossier entero. Es [[instrumentos-que-confirman-en-vez-de-verificar]]
aplicado al **insumo** en vez de al resultado: acá el instrumento roto no era el que mide, era el que
**pregunta**. Hermana de [[vacio-no-es-hallazgo-correr-el-control]].
