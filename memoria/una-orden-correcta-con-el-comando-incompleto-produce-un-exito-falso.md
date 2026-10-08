# 🪄💥 Una orden correcta con el comando INCOMPLETO produce un ÉXITO FALSO

**Fecha:** 2026-10-08 · **Costo:** la orden del operador habría borrado **1** worktree de **21**, y
quien la ejecutara habría concluido que el repo ya estaba limpio.

## Qué pasó

El operador ordenó *«al finalizar el sprint hay que hacer una poda de worktrees»*. La asenté en
`backlog §13.bis` y `HANDOFF §5.6` con su caveat de Windows, su tabla de números medidos y su
procedimiento de verificación. **Y con el comando mal, en dos formas de gravedad muy distinta:**

| defecto | qué hace | gravedad |
|---|---|---|
| decía **`--aplicar`** | el flag no existe (**0 ocurrencias** en el script; el real es `--podar`). Cae en el `*)` del parser → `exit 2` + *«opción desconocida»* | **baja: falla RUIDOSO, no engaña** |
| faltaba **`--base /c/gfw-src`** | el default del podador es `.claude/worktrees/`, no donde viven los worktrees | **alta: produce un ÉXITO FALSO** |

Medido el mismo día, el mismo comando con y sin el flag:

| corrida | analizados | podables |
|---|---|---|
| `podar-worktrees.sh` (como decía mi orden) | **1 de 54** | **1** |
| `podar-worktrees.sh --base /c/gfw-src` | **48 de 54** | **21** (+4 sucios, 2 no mergeados, 21 en gracia) |

## La lección

**Un comando incompleto es más peligroso que uno inválido.** El inválido falla y te manda a leer; el
incompleto **corre, termina en 0, e informa un resultado que se lee como la ausencia del problema.**
«1 podable» y «todo limpio» son la misma frase para quien no sabe que el instrumento miró 1 de 54.

Es el mismo tronco que [[no-codificar-la-esperanza-principio-raiz]]: la orden estaba bien razonada,
con su caveat y su tabla — **lo que nunca se ejercitó fue el comando que la orden manda tipear.**
Escribir el procedimiento no es haberlo corrido.

## Cómo se cazó, y por qué eso importa más que el defecto

**Lo cazó la propia línea de control del podador**, que alguien puso ahí para esto:

```
🔎 CONTROL: 1 de 54 worktrees entraron al analisis (53 fuera por base/actual).
            Un conteo de podables NO se lee sin esta linea.
```

Sin esa línea, el output es `1 podable(s)` y **no hay forma de distinguir un repo limpio de un
instrumento ciego**. Es [[instrumento-que-no-mira-nunca-falla]] funcionando al revés: el instrumento
que **sí** declara su denominador se delata solo.

## Cómo se aplica

- **Al escribir un procedimiento, corré el comando que escribiste, con el copy-paste exacto.** No
  el equivalente que vos sabés tipear: el literal que va al doc.
- **Todo conteo que un instrumento reporte necesita su denominador al lado.** Si tu script dice
  «N encontrados» sin decir «de M examinados», su salida no es legible — ni para otro ni para vos
  dentro de una hora.
- **Pregunta de control:** *¿cómo se vería este output si el instrumento no estuviera mirando nada?*
  Si la respuesta se parece al output de «todo bien», falta el denominador.

## Y la ceguera que quedó DECLARADA, no resuelta

Con `--base /c/gfw-src` el guard de `_vigia-pins/` **no se ejercita**: los pines viven en otra ruta,
quedan fuera de base y nunca llegan al `case` del guard. Un control que cuente «pines ignorados = 0»
da **0 tanto si el guard funciona como si nunca se alcanzó** — control ciego, del mismo tipo que
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]. Se escribió en el doc como ceguera conocida en vez
de dejar el 0 pasando por verde. Ver también
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].
