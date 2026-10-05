---
name: un-orden-de-magnitud-que-coincide-no-confirma-la-causa
description: El dictamen explicó 436 zombies con 13-14 archivos borrados y la cuenta cerraba en orden de magnitud, pero la mitad de la población tenía otra causa; lo que volvió seguro el borrado fue otro invariante, más barato.
metadata:
  type: feedback
---

Cuando una hipótesis causal **produce el número correcto**, la coincidencia se lee como
confirmación y nadie mira la población. Pero un orden de magnitud es una banda ancha: muchas
composiciones distintas caen adentro, y la que uno imaginó es sólo una de ellas.

**Caso raíz (2026-09-28, los 436 zombies del grafo).** El reconcile abortaba contra un tope de 200 y
hacía falta la firma del operador para forzarlo. Auditoría investigó bien —descartó dos causas
midiendo, encontró el commit que había dejado al bridge leyendo un árbol congelado— y cerró así:
*«13-14 archivos de código borrados × decenas de objetos cada uno ≈ 400. Los 436 caen en el orden de
magnitud exacto.»* Con eso alcanzaba para firmar.

**Y el propio script me obligó a mirar antes de disparar** («`--force` sin haber mirado es un borrado
a ciegas»). La lista del dry-run **no decía eso**: de 4 archivos-fuente de la muestra, **2 no
existían** —como decía la tesis— pero **2 sí existían**, y uno se había creado esa misma semana
(`LegalScreen.tsx`). La segunda mitad de la población era otra causa entera: **símbolos eliminados
dentro de archivos que sobrevivieron** a un mes de refactors. Por eso la aritmética de la tesis salía
forzada: le faltaba media población y la estiraba con «decenas».

**Lo que esto no es:** no es que el dictamen estuviera equivocado en su conclusión —los 436 eran
basura legítima y el borrado era correcto—. Es que **la razón por la que era correcto no era la que
el dictamen daba**, y firmar sobre una causa equivocada funciona hasta el día que no.

**El remedio, y es más barato que reconstruir la historia.** El argumento fuerte estaba en la misma
salida del dry-run, en una línea: **`FALTANTES: 0`**. Todo lo que el árbol vivo espera ya estaba
presente ⇒ el reconcile sólo podía **quitar sobrante**, no podía dejar un hueco. Eso no depende de
explicar de dónde salió el sobrante, y se verifica de un vistazo. Cuando hay que autorizar un borrado
masivo, el criterio es **«¿falta algo de lo esperado?»**, no «¿puedo explicar lo que sobra?».

**Cómo se aplica:** ante una explicación causal cuyo atractivo principal es que *da el número*,
preguntar **¿qué otra composición daría el mismo número?** y muestrear la población, no el total. Y
buscar el invariante que hace segura la acción sin necesitar la causa — casi siempre existe y es más
corto.

Hermanas: [[no-codificar-la-esperanza-principio-raiz]] ·
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] ·
[[dos-causas-suficientes-el-test-no-atribuye]] · [[contar-un-simbolo-no-dice-en-que-rol-aparece]] ·
[[el-nombre-es-una-hipotesis-sobre-el-contenido]]

---

## Refuerzo (2026-09-30): dos poblaciones del MISMO tamaño en la misma investigación

Tercer modo, y el más fácil de creer: no es un orden de magnitud parecido ni un total que compensa —
son **dos cifras exactamente iguales que nombran cosas distintas**, en el mismo hilo.

Backend reportó **4** DELETE con `204` sobre el grafo. Al desglosar los 1406 zombies por `created_at`
aparecieron **1402 + 4**: los 1402 de la re-poda (`created_at` 13:35, una sola tanda) y **4** objetos con
`created_at` 13:10-13:11. La lectura se ofrece sola: *«los 4 que borró siguen ahí → el `204` mintió»*.

**Los 4 del desglose tienen una explicación propia y completa:** son los huérfanos de un archivo
**renombrado** (`test-vigencia-canario.sh`, de `scripts/evidencia/` a `scripts/tests/`) — 2 nodos + su
`DEFINES` + 1 `CO_CHANGES_WITH`, un grupo coherente, con timestamp separado de la tanda grande. Nada que
ver con los DELETE. **Coinciden en número y en nada más.**

Y el mismo hilo tenía un segundo par de gemelos: yo había escrito que «si los 4 hubieran persistido, el
dry-run habría medido **1402**» — y 1402 resultó ser, por otra vía completamente distinta, el tamaño real
de la tanda de la re-poda. **Dos veces el mismo número por caminos que no se tocan, en una sola
investigación.**

**Why:** porque un número que coincide se siente como confirmación *y además* cierra la historia: explica
la anomalía sin dejar cabos. La pista de que no lo era fue estructural, no numérica — los 4 formaban un
conjunto con sentido propio (un archivo y sus relaciones) y tenían su propio `created_at`.

**How to apply:** (1) cuando dos cifras coinciden, preguntá **qué población** cuenta cada una antes de
asociarlas: ¿mismo universo, mismo instante, mismo criterio de inclusión?; (2) buscá si el conjunto
sospechoso tiene **estructura interna** —un archivo con sus nodos y aristas, un commit, un tenant—: si la
tiene, ya está explicado sin la coincidencia; (3) los timestamps separan poblaciones que los totales
fusionan: `created_at` partió 1406 en 1402+4 y ese corte fue todo el hallazgo; (4) en un hilo donde ya
apareció una coincidencia numérica, esperá la segunda.
