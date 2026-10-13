---
name: el-else-de-un-clasificador-otorga-la-clase-benigna-por-default
description: Un clasificador de dos ramas no tiene dónde poner el caso pendiente, así que el else se lo lleva — y el else era la clase que acredita
metadata:
  type: feedback
---

Un clasificador con **dos ramas** reparte **todos** los casos entre esas dos. Si una de ellas
acredita cumplimiento, el `else` **regala el crédito** a todo lo que no sea la otra. No hay bug
visible: hay una taxonomía incompleta, y el hueco cae del lado que absuelve.

El caso, 2026-10-13, `scripts/evidencia/medir-mapeo-implementacion.py`:

```python
clase = "CERRADA-EN-CODIGO" if "✅" in s else "ENMIENDA-FUNDADA"
```

El DoD del sprint admite dos caminos —«resuelta en el código **O** declarada enmienda fundada con su
motivo escrito»— así que **ENMIENDA-FUNDADA cuenta como cumplida**. Pero en el código no era un
veredicto: era **el `else`**. Toda fila sin ✅ salía acreditada, incluidas las 7 que llevaban ⛓
(«atada a una dependencia»). Y peor: con un ✅ de una divergencia y un ⛓ de otra, **el ✅ ganaba** y
la fila salía incluso *cerrada en código* — 4 de las 7.

La fila que lo delata gritaba en su propio doc: `card-factura` dice **textual** «El DoD de esta fila
dice "el elemento ausente existe y se ve". **NO se cumple**» — y el medidor la publicaba como
cumplida. **El dato correcto estaba escrito; el instrumento no tenía dónde ponerlo.**

**Por qué:** el vocabulario de símbolos tenía cuatro valores (`✅ 📝 ⛓ ⚠`) y el clasificador
preguntaba por **uno**. Dos de los cuatro significan «todavía no», y los dos caían en la rama que
acredita. Un clasificador no se audita leyendo sus ramas: se audita **contando los valores posibles
de su entrada** y viendo cuántos no tienen rama propia.

**Cómo aplicarlo:**
1. Ante un `if X else Y`, preguntá **cuántos valores distintos puede tomar la entrada**. Si son más
   de dos, el `else` es un balde, no un veredicto. Nombrá qué cae ahí, con los ids.
2. Fijate **de qué lado cae el balde**: si la rama del `else` es la que absuelve, el defecto es
   fail-open y no da síntoma ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).
3. Cuando el criterio es **por conjunto** (una fila con varias divergencias), la precedencia importa:
   un «pendiente» tiene que mandar sobre un «resuelto» de al lado, porque el DoD exige que *ninguna*
   quede sin veredicto. Preguntá siempre si el criterio es por elemento o por conjunto.
4. El síntoma del lado del dueño honesto es **el silencio**: backend dejaba sus 5 filas **sin
   símbolo** para no cobrar el crédito falso, lo que producía **huecos (exit 3)** en vez de una clase.
   Un instrumento que obliga a elegir entre mentir o romper **no tiene la clase que hace falta**.
   Si alguien evita escribir el dato real, buscá la clase que falta antes de culpar la disciplina.
5. Arreglar la clase **no retira la cifra** que su ausencia produjo: el `34/54` ya estaba publicado
   en dos docs y en tres mensajes de otras sesiones. Hubo que retirarlo con el número viejo a la
   vista ([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).

Primo del degradado prudente ([[un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion]]),
pero distinto: ahí alguien **elige** el caso benigno ante la duda; acá **nadie eligió nada** — la
taxonomía no tenía la casilla y la estructura del `if` decidió sola.
