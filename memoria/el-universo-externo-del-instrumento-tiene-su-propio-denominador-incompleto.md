---
name: el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto
description: Sacar el universo de sujetos a una fuente externa impide que una forma de registro nueva esconda un sujeto — pero sólo cubre a los sujetos que esa fuente conoce. Si la fuente externa tiene menos sujetos que la fuente de verdad, los que faltan no pueden aparecer ni como hueco
metadata:
  type: feedback
---

**El caso (2026-09-29, criterio 3).** `scripts/evidencia/contar-veredictos.py` está bien diseñado y su
docstring explica por qué (`:20-25`): contar **veredictos** sólo encuentra los que el parser ya sabe
leer, y cada forma de registro nueva se perdía **sin síntoma** (el fallback `hueco` iba a la misma lista
cuyo largo era la métrica, así que cada pérdida se sustituía 1-a-1 y el total no se movía). El arreglo
fue dar vuelta el numerador: la unidad primaria pasó a ser el **sujeto**, y

> «El universo de SUJETOS sale de una fuente EXTERNA a este parser (`criterio3-matriz.mjs`), por eso una
> forma de registro nueva no puede esconder un sujeto: el id sigue en la lista, y si no se le pudo leer
> veredicto aparece como HUECO CON NOMBRE».

**Correcto, y el arreglo funciona** — su canario por brazo lo prueba: rompiendo cada uno de los 5 brazos
la métrica de sujetos baja (`campo` 21→6, `tabla` 15→6). Ningún brazo está sin control.

**Lo que no cubre: la fuente externa tiene su propio denominador, y está incompleto.**

| fuente | ids | qué es |
|---|---|---|
| la spec BL-P5 (fuente de verdad) | **54** | lo que el criterio 3 declara medir |
| `criterio3-matriz.mjs` (universo del contador) | **27** (26 en la spec + `plan`) | lo que el instrumento conoce |
| **ciegos** | **28** | no pueden aparecer **ni como hueco con nombre** |

Control: `26 + 28 = 54`. Y los 28 ciegos no son los ids marginales — son `cobro-voz`, `fact-hitl`,
`fact-voz`, `pres-voz`, `pres-hitl`, las cuatro `card-*`, `vacio`, `vacio-visto`, la home.

## Por qué no da síntoma, y por qué es la misma clase de defecto un nivel arriba

Un id que no está en el universo **no genera hueco**: el reporte no lo nombra, no baja ningún
porcentaje, y el canario tampoco lo ve, porque el canario prueba los **brazos del parser** —
qué tan bien se leen los sujetos que el universo ya trae— no la **cobertura del universo**. Los dos
controles horneados miran hacia adentro; ninguno pregunta *«¿este universo cubre la fuente?»*.

Es literalmente [[instrumento-que-no-mira-nunca-falla]] aplicado al denominador: no se puede fallar
sobre lo que no se mira. Y el propio comentario del instrumento lo admitía sin que nadie lo leyera como
un límite del conteo: `criterio3-matriz.mjs:119` dice «Ampliables para el Bloque B (los 22 ids de FE1 y
**el resto de los 54 de la spec**)».

## La regla

**Cuando saques el universo a una fuente externa, el control que falta es el de esa fuente contra la
fuente de verdad** — un diff nominal, en el mismo script, que imprima los sujetos de la fuente de verdad
que el universo no contiene y **falle** si hay alguno sin justificación. «Externo al parser» resuelve que
el parser no esconda sujetos; no resuelve que el universo los tenga.

Y el número se cita con las dos cifras: **«21 de 21 declaradas» es cierto y suena completo, pero lo que
manda es «26 de 54 del universo»**. El mismo defecto que este script vino a matar
([[contar-un-simbolo-no-dice-en-que-rol-aparece]] · [[un-vacio-del-propio-instrumento-no-es-hallazgo]]).

## El corolario: un sujeto RETIRADO también es deriva del universo

`plan` está en el universo del instrumento y **no** en la spec: la spec lo saca explícitamente («−2:
`plan` y `limite` salen (visión, DEC-8)», `:95`). Y la ironía mide sola — la primera página de esa misma
spec (`:8`) dice que la lista existe porque **«48/48 coherentes» se medía contra pantallas que nadie va a
construir: `plan` figuraba como una**. La spec corrigió el defecto; el instrumento que mide contra ella
lo heredó y lo sigue contando. **Un diff de universo es bidireccional:** faltantes (ciegos) y sobrantes
(retirados que inflan el denominador).

## El mismo defecto tiene DOS ejes, y el segundo apareció una hora después

El universo de **sujetos** no es el único denominador que un contador tiene. `contar-veredictos.py:366`
fija también el universo de **documentos**:

```python
docs = {"lote_A": ubicar("lote-A"), "lote_B": ubicar("lote-B")}
```

Dos archivos, del 28/09. Al día siguiente un frente cerró un tercero con 13 ids más (251 lineas, 16
`COHERENTE`, 13 `DESVÍO`) y el contador **no lo miraba**: su cifra no bajó ni dio aviso, simplemente dejó
de describir el registro. Medido: 36 sujetos en los 2 archivos que lee, contra 48 de 54 ids citados en los
3 que existen.

**La generalización:** blindar el numerador no dice nada sobre los denominadores. Un instrumento que mide
«X de Y» tiene **un denominador por cada universo que enumera** — sujetos, documentos, viewports, tenants —
y cada uno necesita su propio control contra la fuente de verdad. El que no lo tiene no falla: **deja de
describir el mundo y sigue imprimiendo un número con la misma cara de siempre.**

Los dos ejes se arreglan igual: el universo se **descubre** (glob sobre el patrón real, diff contra la
fuente) en vez de **enumerarse a mano**, y el script **falla** cuando encuentra algo que su lista no tenía.

Emparentado: [[el-instrumento-fabrica-una-referencia-que-no-existe]] ·
[[un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real]] ·
[[el-nombre-es-una-hipotesis-sobre-el-contenido]] · [[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]].

---

## 🔻 Refuerzo 2026-10-07 — el denominador incompleto era el **MÍO**, y mi tabla de veredictos se leía como cobertura

El enunciado de arriba mira el universo **externo**. El caso de hoy es el espejo interno y pega más
fuerte: el instrumento era mío, el universo lo armé yo, y **salió al 11 % sin que nada fallara**.

Barrí la superficie declarada de la API comparando, para cada par `tipoTS|path`, las claves del
`return` del handler contra los campos del tipo. Entregué una tabla de veredictos prolija. Lo que la
tabla **no decía** es cuántos pares había llegado a comparar:

```
tipos TS   : leí 27  ->  el universo real es 195 (core, en 51 archivos) + 40 (capa propia del web)
rutas      : leí 32  ->  el universo real es 110, en 11 archivos (web.py era UNO)
comparados : 7 de 51 pares  (tras arreglar el extractor: 19 de 51)
```

**Mi control positivo pasó en los dos casos.** Validé el extractor de tipos con `MeResponse` = 9 campos
y `ChatResponse` = 2: ambos correctos. Un control de **presencia** sobre dos ítems conocidos no dice
**nada** de los 168 tipos y las 78 rutas que no estaban en mi universo. Y el defecto de fondo era una
suposición que nunca enuncié: que el archivo canónico era **el** archivo (`types.ts` era 1 de 51,
`web.py` 1 de 11).

**Por qué no dio síntoma:** una tabla con 10 filas y veredicto en cada una **se lee como la superficie
entera**. Nadie pregunta por el denominador de una tabla que parece completa; el formato no lo pide.

### Y la forma hermana, que me pasó cinco veces en la misma tanda

El número correcto sosteniendo una afirmación **sobre otra población**:

| medí | afirmé | por qué no se sigue |
|---|---|---|
| 0 `.otf` en `ls-tree` del árbol | «`filter-repo` no borraría ninguna» | `filter-repo` opera sobre la **historia**: `rev-list --objects` da **10** |
| el reset de una ref a `null` | «ventana sin defensa ⇒ duplica plata» | la derivación vive **en el punto de uso**: tras el reset vuelve a derivar la MISMA clave |
| hits de un símbolo en una app | «la app lo usa» | 9 hits de `legal_aceptado` en mobile, los 4 archivos son `.test.tsx` ⇒ **0** productivos |
| claves del `return` de UN handler | «el tipo del endpoint difiere» | el path tenía **dos** handlers (GET y POST) y mi clave era el path, sin el verbo |
| campos de un tipo del front | «el backend manda de más» | era un tipo **raw de parseo** (`unknown`), no el contrato de respuesta |

**How to apply:**
1. **Toda tabla de veredictos se entrega con su denominador POR CATEGORÍA** (comparados / sin tipo /
   sin handler / sin localizar). Sin eso, una tabla prolija afirma cobertura que nadie midió.
2. El control de **presencia** y el de **denominador** son dos preguntas distintas: *«¿aparece el ítem
   que conozco?»* no responde *«¿cuántos de los N miré?»*. Escribí los dos.
3. Un universo se **cuenta** (`git grep -l` de la declaración, y contá archivos), no se asume: la
   trampa es creer que el archivo canónico es el único. Preguntá *¿en cuántos archivos puede vivir esto?*
4. Antes de concluir: **¿qué población mide mi número y sobre qué población es mi afirmación?** Si no
   son la misma, el número es correcto y la conclusión es falsa — que es la forma más difícil de cazar,
   porque la evidencia resiste la revisión y la inferencia no.
