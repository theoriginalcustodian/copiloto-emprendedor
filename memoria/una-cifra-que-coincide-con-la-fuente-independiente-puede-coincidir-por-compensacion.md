---
name: una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion
description: El parser dio 21 mediciones y FE1 declaraba 21 — se citó como la única confirmación que vale, y eran tres discrepancias de signo opuesto que se cancelan: dos mediciones fundidas, una partición no contada y dos filas contadas de más.
metadata:
  node_type: memory
  type: feedback
---

**Regla.** Cuando tu número coincide con el de una **fuente independiente**, todavía no confirmaste
nada: el agregado puede coincidir porque varios errores de **signo opuesto se cancelan**. Lo que
confirma es la **descomposición** — mismo total *y* misma composición, fila por fila. Y la coincidencia
engaña más que la discrepancia, porque cierra la investigación.

**El caso (2026-09-29, `scripts/evidencia/contar-veredictos.py` @ `480d2cc0`).** El rediseño dio vuelta
la unidad primaria de *veredicto* a *sujeto* y se apoyó en esto, escrito con todas las letras: «las
**21 mediciones** coinciden con las 21 que FE1 declara en su propio doc — fuente independiente de mi
parser, que es **la única clase de confirmación que vale** acá». La intención es correcta. La cuenta no:

| sujeto | el parser | FE1 | Δ |
|---|---|---|---|
| `clientes` — listado + ficha | **1** clave (fundidas: `camino_de()` exige la palabra literal «camino», y `— listado` no la tiene) | 2 | **−1** |
| `chat` (un encabezado con `PARTIDO:` en 2 caminos) | **1** clave, 3 veredictos | 2 mediciones / 2 veredictos | **−1** |
| `cobro-voz` + `fact-voz` (`PENDIENTE_DEVICE`) | **2** mediciones | 0 — el doc dice «sin gastar medición» | **+2** |
| **total** | **21** | **21** | **0** |

**−1 −1 +2 = 0.** Tres defectos distintos, ninguno visible en el total. Y uno de ellos funde dos
veredictos **contradictorios** (`COHERENTE` y `FUERA-DE-REFERENCIA`) en una sola medición sin que ningún
control lo señale.

**El mismo método, aplicado al residuo que quedaba abierto, lo cerró:** 26 veredictos contra 23
declarados era «3 sin explicar, y no lo cuento como cerrado». Descompuesto: **26 − 2** (las filas
`PENDIENTE_DEVICE`, que el doc declara sin gastar veredicto) **− 1** (un token extra en `chat`) **= 23**.
La descomposición explica; el total sólo tranquiliza.

**Why.** Una fuente independiente es la evidencia más fuerte que hay, y por eso apaga la duda de golpe.
Pero «independiente» garantiza que el error no sea **el mismo**, no que no haya errores: dos sistemas que
cuentan la misma cosa con criterios distintos tienen muchas formas de llegar al mismo número. El caso que
más engaña es el que **suma cero**, porque cada mitad es un defecto real que ya nadie va a buscar.

**How to apply.**
1. Cuando coincidas con una fuente externa, **enumerá los ítems de las dos listas y diffeálas**, no los
   totales. Si no podés enumerar, la coincidencia es una anécdota.
2. Escribí la coincidencia como **hipótesis**: «coinciden en 21 — ¿cuentan lo mismo?». El diff de
   composición cuesta minutos; saltearlo paga dos defectos al precio de cero.
3. **Sospechá de la coincidencia exacta en listas chicas.** 21 = 21 con tres discrepancias es más
   probable de lo que parece cuando una es `+2` y las otras dos `−1`.
4. Si la fuente externa **declara alcance** («estas 2 no gastan medición»), eso también es dato a
   parsear: la mitad de este caso fue no leer una frase del propio documento.
5. El corolario para el otro lado: **dos errores opuestos pueden tener una sola raíz.** El mismo día,
   midiendo el estado post-corte, una sesión reportó «0 commits sin pushear» (ref remoto inexistente ⇒
   salida vacía ⇒ parseada como `0`) y otra inventó «13 commits en riesgo» (ya mergeados por squash).
   Signos opuestos, misma causa: **medir contra la referencia equivocada**. Lo que cerró los dos fue
   preguntar por el **efecto** (`git ls-remote`; ¿el artefacto está en `origin/main`?).

Hermana de [[el-fallback-que-sustituye-al-valor-perdido-hace-ciego-al-control]] — ahí la compensación es
del propio parser (el hueco reemplaza 1-a-1 al veredicto y el total no se mueve); acá es **entre defectos
distintos** y contra una fuente **externa**, que es la forma más convincente. Prima de
[[dos-causas-suficientes-el-test-no-atribuye]]: el agregado no atribuye. Ver también
[[el-instrumento-respondio-sobre-otro-sujeto]], [[contar-un-simbolo-no-dice-en-que-rol-aparece]] y
[[instrumento-que-no-mira-nunca-falla]].

**Evidencia:** `docs/copiloto-emprendedor/Auditorias/2026-09-29-el-21-que-coincide-por-compensacion-de-tres-discrepancias.md`.
