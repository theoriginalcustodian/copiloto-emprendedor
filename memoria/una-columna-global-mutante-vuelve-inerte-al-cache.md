---
name: una-columna-global-mutante-vuelve-inerte-al-cache
description: El checkpoint por contenido del bridge no salteaba nada porque commit_date (fecha del HEAD) viajaba en todas las filas y entraba al hash — un campo que cambia con el reloj adentro de la identidad anula el cache entero sin romper ningún test
metadata:
  type: project
---

**Medido el 2026-08-02.** Cada push que movía `origin/main` tardaba ~20 minutos sincronizando el
grafo, con **3 archivos de diferencia**. El bridge tiene un checkpoint por contenido bien diseñado
(`sha256(mapping + filas)` por chunk: si el código no cambió, se saltea). Estaba inerte: **0 de 45
particiones salteadas, siempre**.

Causa: `commit_date` —la fecha del commit **HEAD**, no la del archivo— viaja en **todas** las filas
de **todas** las particiones, y entraba al hash. Cualquier commit cambiaba ese valor en las ~8.300
filas del grafo ⇒ los 45 `content_hash` cambiaban ⇒ el checkpoint no podía saltear nada.

## Por qué no dio síntoma nunca

Un cache que se invalida de más **no rompe nada**: los datos son correctos, los tests pasan, el log
dice "45 particiones ingeridas" — que es exactamente lo que diría si el trabajo fuera necesario. El
único síntoma es *tarda*, y "tarda" se atribuye a la red, al server, al repo que creció. Yo mismo
diagnostiqué mal dos veces antes de medir: dije "reingesta todo el repo" (falso: el `--since` ya
estaba) y "~10 s por request" (falso: el POST tarda 0,7 s).

Los tests existentes cubrían la idempotencia — pero pasándole **el mismo `commit_date`**. El caso
real (mismo código, fecha nueva) no lo ejercitaba ninguno: el fixture congelaba justo la variable
que causaba el bug.

## La forma general

**Un campo que cambia con el reloj, adentro de la identidad de contenido de un cache, lo anula
entero.** Y es difícil de ver porque el campo suele ser legítimo *en el dato* (el `valid_at` del
grafo lo necesita) — el error no es que exista, es que participe de la **identidad**. La pregunta
que lo caza: *¿qué campos de esto cambian sin que cambie lo que el cache describe?*

Bonus: sacarlo **corrigió una semántica falsa**. Antes toda arista decía "válida desde el último
commit del repo" aunque el código no se tocara hace meses — el campo describía cuándo corrió el
sync, no cuándo el hecho pasó a ser verdad. Hermana directa de
[[el-grafo-ingesta-el-disco-pero-fecha-con-head]].

## Dónde estaba el costo (medido, no supuesto)

Con el cliente instrumentado: `wait_for` (polling de la migración) = **112 s de 170 s** — el server
tarda **~28 s en procesar cada partición**; el POST en sí, 0,7 s. Por eso 45 particiones × 28 s ≈
**21 min**. La palanca no era la red ni el tamaño de los chunks: era **no mandar lo que no cambió**.

Segundo hallazgo del mismo camino: el `validate_only` corría una vez por partición **fuera** del
checkpoint — 45 requests que no escribían nada y que el skip no podía evitar. Ahora es perezoso.

Fix en `graphify-graphity-bridge`, commit `fix(sync): el checkpoint no salteaba NADA…`, con dos
tests que cuentan **requests, no filas** — miden el ahorro, no la no-regresión
([[no-romper-no-es-arreglar]]).

## Dos hallazgos del mismo camino, registrados y NO resueltos

**1. Un umbral medido y documentado que hoy es falso.** El docstring de `co_change.py` afirma —con
medición de julio— que `min_support=3` "deja 16 aristas: borra la SEÑAL, no el ruido". Medido de
nuevo el 2026-08-02, con la historia ya en 505 commits (eran ~250): `min_support=3` deja **316**
pares, y `top_k` pasa de podar 42 a podar 1 — o sea recupera casi entera la monotonía que el propio
módulo declara innegociable. **Un umbral calibrado contra un dataset que crece envejece en
silencio**, y queda escrito como verdad permanente en un docstring que nadie vuelve a medir. Subirlo
es MAYOR (cambia el contenido del grafo): queda medido, no ejecutado.

**2. La config del arco vive sólo en el working tree.** `graphify-graphity-bridge/config/repos.toml`
está versionado, pero los 7 repos de la flota son 43 líneas **sin commitear**, apoyadas en 3 commits
locales sin pushear. Un `git checkout` ahí borra la configuración del arco autopoiético entero, sin
recuperación ([[checkout-ref-doble-guion-punto-pisa-cambios-solo-en-working-tree]]).

**3. Deuda técnica:** el sync corta con `httpx.RemoteProtocolError: Server disconnected` en algún
request al server de Graphity. Con el fix la exposición baja de ~225 requests a un puñado, pero la
causa del corte sigue sin diagnosticar (sin acceso SSH a ese VPS desde esta sesión).
