---
name: el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda
description: Tres anclas verdes sobre la función del SHA daban sensación de instrumento verificado, y el cero falso vino del descubrimiento de archivos, que no tenía control.
metadata:
  type: feedback
---

Un instrumento tiene **más de una afirmación**, y el control positivo se pone sobre la que se
sospecha. El resto queda mudo — y con el verde de las anclas encima, **parece cubierto**.

**Caso raíz (2026-09-28, mapeo hora-de-captura → SHA de `origin/main`).** El script imprimió
`VACIO` con **82 PNG en disco**. Tenía control positivo horneado: tres anclas sobre la función
`sha_a(ts)` (una después del último commit, una entre dos commits, una antes de todos ⇒ `None`), y
**las tres pasaron**. El defecto estaba en la otra mitad: le pasé a Python de Windows una ruta de
Git Bash (`/c/Proyectos/...`) y **`os.walk` sobre una ruta inexistente no lanza — itera cero
veces**. Dos afirmaciones distintas, control sobre una sola:

1. «sé qué SHA estaba vigente a la hora T» ✅ con tres anclas
2. «miré los 82 archivos» ❌ sin ningún control

**Por qué muerde más que un cero pelado:** el verde de (1) no es neutro, **acredita**. Un `VACIO`
sin controles se lee como «revisá el instrumento»; un `VACIO` después de «control positivo 3/3» se
lee como hallazgo. El control mal apuntado no sólo no detecta: **le presta credibilidad al defecto
que no mira.**

**Cómo se aplica:** la regla no es «poner control positivo», es **enumerar las afirmaciones del
instrumento y preguntarse a cuál NO se lo puso**. Acá alcanzaba una línea:
`if not os.path.isdir(base): abortar nombrando la ruta`. Un descubrimiento (glob, walk, find, query)
es **siempre** una afirmación separada de lo que se hace con lo descubierto, porque casi todos fallan
devolviendo vacío en vez de tirando.

Hermanas: [[instrumento-que-no-mira-nunca-falla]] · [[vacio-no-es-hallazgo-correr-el-control]] ·
[[un-control-positivo-con-esperado-falso-acusa-al-script]] ·
[[el-instrumento-respondio-sobre-otro-sujeto]]

## Refuerzo (2026-09-30): el cebo metido en la lista blanca, y el control que falla por otra razón

Dos formas de control positivo inválido, medidas el mismo día sobre el canario del padrón:

**1. El cebo entró por la puerta que el guard abre a propósito.** Para probar que el lector del
padrón no sabe leer ids raros, el primer control inyectó un cebo `((cebo-del-canario))` **dentro**
de la lista de ids del padrón. El parser lo dio por legible — **con razón**: el lector reconoce lo
que el padrón *declara*, y meter el cebo en el padrón lo declaró.

> **Un guard condicionado a una lista blanca no se puede probar metiendo el cebo en la lista
> blanca**: entra por la misma puerta que el guard abre a propósito.

El control correcto no prueba que un token sea raro: prueba que el canario detecta un **lector
ciego**.

**2. El control falló primero por la razón equivocada, y el veredicto seguía siendo «correcto».**
Copiado a `/tmp`, el parser viejo devolvía `exit 2` porque resuelve la spec relativa a su propia
ubicación y ahí no la encontraba. Por contrato el veredicto era bueno («no pude medir» ≠ «todo
legible»), pero **no ejercitaba el caso**: un rojo por una causa ajena acredita igual que el rojo que
se busca. Recién al ubicarlo en `scripts/evidencia/` midió lo que decía medir.

La pregunta que separa las dos: *¿el rojo que obtuve vino del defecto que quiero cazar, o de otro?*
Un control positivo que pasa por el motivo equivocado es [[dos-causas-suficientes-el-test-no-atribuye]].
