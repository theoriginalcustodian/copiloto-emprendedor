---
name: una-columna-global-mutante-vuelve-inerte-al-cache
description: El checkpoint del bridge no salteaba nada porque dos campos que mutan sin que cambie el código (commit_date y el id de comunidad del clustering) entraban al hash — y arreglar el primero, probado por diferencial, no movió el reloj: un diferencial prueba que una causa CONTRIBUYE, nunca que sea la única
metadata:
  type: project
---

**Medido el 2026-08-02.** Cada push que movía `origin/main` tardaba **~25 minutos** sincronizando el
grafo, con **3 archivos de diferencia**. El bridge tiene un checkpoint por contenido bien diseñado
(`sha256(mapping + filas)` por chunk: si el código no cambió, se saltea). Estaba inerte: **0 de 45
particiones salteadas, siempre**.

Dos campos lo anulaban, y ese "dos" es el corazón de la entrada:

1. **`commit_date`** — la fecha del commit **HEAD**, no la del archivo. Viaja en todas las filas de
   todas las particiones: cualquier commit la cambia en las ~18.000 filas del grafo.
2. **`src_community` / `dst_community`** — el id de comunidad del clustering de graphify **no es
   reproducible entre procesos**. Dos corridas consecutivas sobre el *mismo commit* dieron **43 y
   45** para la misma arista.

## El error que más enseña: probé la causa, y no era la causa

Encontré (1), escribí un test que **fallaba sin el fix y pasaba con él**, y di el problema por
resuelto. En el territorio, `graph-sync.sh` siguió tardando **1.405 s**: prácticamente igual.

**Un diferencial prueba que una causa CONTRIBUYE al efecto, no que sea la única.** `commit_date`
bastaba para anular el cache; el `community` *también* bastaba. Con dos causas suficientes e
independientes, arreglar una sola no mueve el resultado ni un segundo — y el test verde dice la
verdad mientras el sistema no cambia. Es la trampa exacta de un test bien hecho: mide **su**
hipótesis, aislada, en un fixture que congela todo lo demás.

Lo que lo destapó fue medir el **efecto en el sistema real**, no el mecanismo en el test. Y la señal
que lo confirmó fue un número que se movía solo: al comparar el hash calculado contra el guardado,
corridas seguidas daban 3/40, 2/41, 3/40 — **si el mutante estuviera muerto, ese número sería fijo**.

Regla que queda: cuando el fix de una causa probada **no mueve la métrica que motivó el trabajo**,
la conclusión no es "el fix no sirvió" ni "faltó desplegarlo" — es *hay otra causa suficiente del
mismo tipo, seguí buscando en la misma familia*.

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

**Un campo que cambia sin que cambie lo que el cache describe —el reloj, un id de proceso, un
contador de clustering— anula el cache entero desde adentro de la identidad.** Es difícil de ver
porque el campo suele ser legítimo *en el dato* (el `valid_at` lo necesita; el `community` es
información útil): el error no es que exista, es que participe de la **identidad**. La pregunta que
lo caza: *¿qué campos de esto cambian sin que cambie lo que el cache describe?* — y hay que
responderla para **todos** los campos, no parar en el primero que aparece.

Bonus: sacar `commit_date` **corrigió una semántica falsa**. Antes toda arista decía "válida desde
el último commit del repo" aunque el código no se tocara hace meses — el campo describía cuándo
corrió el sync, no cuándo el hecho pasó a ser verdad. Hermana directa de
[[el-grafo-ingesta-el-disco-pero-fecha-con-head]].

## Dónde estaba el costo (medido, no supuesto)

Sync completo instrumentado: **1.488 s**, 168 requests. De esos, `wait_for` (el server procesando)
= **1.333 s en 45 llamadas, ~30 s cada una: el 90%**. El POST en sí son 0,52 s. **Mandar** las
particiones costaba 23 s; que el server las **procesara**, 22 minutos. La palanca nunca fue la red,
ni el tamaño de los chunks, ni paralelizar: era **no mandar lo que no cambió**.

Tercer hallazgo del mismo camino: el `validate_only` corría una vez por partición **fuera** del
checkpoint — 45 requests que no escribían nada y que el skip no podía evitar. Ahora es perezoso.

Y una hipótesis mía que el contrato mató antes de costar nada: subir el `page_size` del reconcile
(200) para hacer menos requests. El server declara `le=200` — **200 ya es el máximo**. Leer el
contrato costó un `grep`; tantearlo hubiera costado una corrida de 25 minutos.

Fix en `graphify-graphity-bridge` (PR #3), con tests que cuentan **requests, no filas** — miden el
ahorro, no la no-regresión ([[no-romper-no-es-arreglar]]) — y un guard que fija el set de columnas,
para que una columna nueva obligue a decidir si entra a la identidad, verificado por mutación.

## El resultado, medido en el camino de producción

`graph-sync.sh` (no el script instrumentado), mismo commit, sin cambios de código:

| corrida | qué mide | tiempo |
|---|---|---|
| antes del fix | re-ingiere las 45 particiones | **1.492 s** |
| con el fix, 1ª | paga una vez la migración de hash | 1.492 s |
| con el fix, 2ª | **el estado normal** | **132 s** |

**11,3× más rápido.** Y el detalle que importa para la próxima vuelta: de esos 132 s, casi todo es
**graphify parseando el repo (~50 s) y el reconcile enumerando el grafo entero (~64 s)** — ninguno
de los dos depende del diff. Ahí está el siguiente techo, si alguna vez molesta.

⚠️ **Toda corrida posterior a un cambio del esquema de hash paga la migración completa** (los
hashes viejos no matchean por construcción). No es una regresión: es el costo, una sola vez, de
cambiar qué cuenta como identidad. Medir el ahorro en esa corrida da 0 y lleva a la conclusión
contraria — hay que medir la SEGUNDA.

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
