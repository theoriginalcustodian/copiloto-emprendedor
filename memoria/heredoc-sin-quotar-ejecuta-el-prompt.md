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

---

## Refuerzo 2026-09-30 — el heredoc QUOTADO tampoco es seguro: colapsa `\\` a `\`

La regla de arriba (quotar el delimitador) evita que el shell **expanda** el contenido. No evita el
otro daño, que medí hoy: con `<<'PY'` —quotado, o sea el caso "seguro"— el contenido llegó a Python
con los `\\` **colapsados a `\`**. Un patch cuyo texto incluía `printf '%s\n'` terminó escribiendo en
el archivo un **salto de línea real** en medio de un string entre comillas simples.

Cómo se detectó, y es lo que importa:

1. Un `str.replace()` mío no encontró su ancla y tiré el assert. Bien: fallé temprano.
2. Al diagnosticar por fragmentos, los que **no** tenían backslash daban `count == 1` y los que
   **sí** tenían daban `0`. Eso localiza la causa en el transporte, no en el ancla.
3. `cat -A` sobre el archivo ya parcheado mostró la línea partida en dos. Ground truth.

**El filo que casi me lo tapa:** después del patch corrí `bash -n scripts/gate.sh` y dio **verde** —
un newline dentro de un string quotado es sintaxis válida. Y peor: en el mismo turno corrí
`bash -n` sobre el archivo de tests **cuyo patch había fallado**, y ese verde era sobre el archivo
**sin modificar**. Un chequeo de sintaxis sobre el sujeto equivocado, exactamente
[[el-instrumento-respondio-sobre-otro-sujeto]]. `bash -n` no puede ver este daño: hay que mirar bytes.

**La regla operativa:** si el contenido a escribir tiene **backslashes** (o backticks, o comillas
latinas), no va por heredoc — va por la herramienta de escritura de archivos, que no pasa por el
shell. Para contenido largo en markdown ya lo sabía por las dos veces que el heredoc murió con
`unexpected EOF`; lo nuevo es que el modo de falla **silencioso** (escribe algo distinto y sale 0) es
peor que el ruidoso, y que sólo lo agarrás si comparás bytes.

**Y el reemplazo barato de cada backslash, cuando igual querés bash:** `grep -qE 'patrón' <<< "$var"`
en vez de `printf '%s\n' "$var" | grep -qE`, que además evita el pipe. Es el cambio que quedó en
`gate.sh`, y no fue estético: fue quitar el único lugar donde el transporte podía deformar el código.

---

## Refuerzo 2026-10-09 — reincidí, y el detector barato no fue comparar bytes: fue un `assert` por ancla

Volví a mandar un patch por heredoc **quotado** (`<<'PY'`), creyendo que quotarlo alcanzaba. No
alcanza para los **backslashes dobles**: el ancla llegó al Python con **newlines reales** donde el
archivo tenía el texto literal de dos caracteres, y `find()` devolvió `-1`. Medido con `repr()`: el
archivo decía `'\\n\\n'` (backslash + n) y mi ancla `'\n\n'` (newline real). El heredoc me colapsó un
nivel de escape.

**Lo que cambia respecto del caso de arriba:** esta vez **no hubo que comparar bytes**. El patcher
traía un `assert` por ancla y falló fuerte **antes de escribir nada** — el archivo quedó intacto
porque el write iba al final, con `os.replace`. Un `replace` sin match es un no-op silencioso; un
`assert` lo convierte en un rojo inmediato. Es el control positivo del "NO" aplicado a un patch, y
cuesta una línea.

**La regla, afinada:** quotar el heredoc protege del *shell que ejecuta* el contenido, no del
*transporte que lo deforma*. Backslashes ⇒ herramienta de archivos (no pasa por el shell), y los
escapes de la capa de destino se **construyen** (`chr(92)`) en vez de viajar. Y todo patch scripteado
abre con `assert` de su ancla, incluso —sobre todo— cuando "es obvio que está ahí".
