# Contra una base rancia el diff INVIERTE la dirección: lo que `main` borró parece tu aporte

**2026-10-07.** Una sesión midió el checkout compartido con `git diff <su-HEAD-rancio> -- .` y reportó
un `urgente_`: «5 archivos con trabajo real sin commitear, que no existe en ningún lado más que en
este disco — paren todos antes de tocar esto». Medido contra `origin/main` **fresco**: los 5 eran
atraso, 3 con **cero diff**. Y lo que lo vuelve grave es el sentido inverso: **preservarlos metía tres
regresiones.**

## El mecanismo del falso positivo

Contra una base vieja el diff no se equivoca de *cantidad*, se equivoca de **dirección**:

| en el diff vs base rancia aparece como | lo que realmente es |
|---|---|
| `-` (línea que el disco «borró») | línea que **`main` agregó después** |
| `+` (línea que el disco «aporta») | línea que **`main` quitó después** |

Así, cada mejora posterior de `main` se lee como una pérdida del disco, y cada cosa que `main`
**eliminó a propósito** se lee como trabajo propio pendiente. El reporte sale alarmado y coherente, y
no hay nada falso adentro: el defecto está en el **punto de comparación**, no en los datos.

## El paso que faltaba: ¿y si un commit lo BORRÓ a propósito?

Ya tenía el criterio por FUNCIÓN —*¿existe el mecanismo en `main`, aunque con otro texto?*—
([[restar-el-merge-base-no-distingue-que-main-lo-reescribio-mejor]]). **No alcanza.** Cuando la
respuesta es «no existe en `main`», quedan dos mundos distintos que el grep no separa:

1. nadie lo escribió todavía ⇒ **puede** ser trabajo pendiente;
2. **alguien lo borró a propósito** ⇒ rescatarlo es una **regresión**.

El discriminante es una sola línea: **`git log origin/main -S'<token>' -- <archivo>`**. Si devuelve un
commit, leé su mensaje antes de rescatar nada. Los tres casos de este turno:

- el texto fijo de un endpoint: **lo borró el PR que arreglaba ese mismo frente** — el fix consistió en
  **mudar el mensaje al front**, así que su ausencia en el backend *era* el arreglo. Rescatarlo deshace
  el PR y duplica el mensaje en dos capas.
- una rama `if name.startswith("instagram_")`: la quitó un `refactor(...): quitar la rama instagram_
  muerta`, y hay un **test que lo prohíbe** (`test_instagram_no_tiene_tool_viva`).
- un guard: el disco tenía `if not creds:` y `main` tiene `if not creds or store.salud() == "caido":`
  más siete líneas que explican por qué. **«Preservar el disco» era borrar el fix de `main`.**

## Y la trampa de la prosa, otra vez, en su forma más fuerte

El candidato que más parecía trabajo vivo traía **un comentario que explicaba su propio por qué**
(`SOP4/C7: texto FIJO, literal del DoD…`). Esa prosa es justo lo que el PR eliminó junto al código, y
viajando con la versión vieja la hacía parecer **autoritativa**: razón escrita, referencia a un DoD,
nombre de hallazgo. **Un comentario que justifica una línea no acredita que la línea siga vigente** —
acredita que alguna vez lo estuvo.

## Cómo aplicarlo

Antes de rescatar cualquier cosa de un disco o de una rama vieja, en este orden:
`--numstat` contra **`origin/main` recién fetcheado** (sin fila ⇒ cero diff ⇒ listo) → ¿existe el
**mecanismo** en `main`? → **si no existe, `git log -S` para ver si lo borraron** → recién ahí, ¿cuál
es el **efecto** de su ausencia? Y nunca midas contra tu propio `HEAD` si no verificaste que esté al
día: `rev-list --count @{u}..HEAD` da `0` y suena tranquilizador, pero **el que importa es
`HEAD..origin/main`**.

Relacionado: [[restar-el-merge-base-no-distingue-que-main-lo-reescribio-mejor]] ·
[[el-medidor-corrido-en-el-arbol-mezclado-acusa-al-repo]] ·
[[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]] ·
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]]
