---
name: un-enum-al-final-del-renglon-lo-borra-el-que-appendea
description: "Si un instrumento lee un enum en el último campo de un renglón, el reflejo de appendear narrativa lo destruye en silencio — y un estado no reconocido que se trata como texto libre es indistinguible de uno legítimamente cerrado"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
---

Cuando un instrumento lee un **enum** (`pendiente` / `arrancando`) del **último campo** de un renglón
que también contiene **narrativa libre**, ese enum tiene dos formas de morir sin ruido: alguien
appendea texto al final del renglón y lo pisa, o la narrativa contiene el separador y el parseo se
corre de campo. En los dos casos el instrumento no falla: **responde con confianza lo contrario de la
verdad**.

**Why:** el 2026-09-22 `cola-check.sh` leía el estado de los hitos con
`while IFS='|' read -r id nombre disp estado`. Con 4 variables, `$estado` recibe *todo* lo que sigue
al tercer `|`. Dos hitos cayeron el mismo día, por los dos caminos:

- **OLA3** estaba declarada `arrancando` desde las 02:40 en un renglón de 5 campos → `$estado` valía
  `«…narrativa…|arrancando»`, que no matchea `arrancando`. Estuvo **~12 h invisible**.
- **A4ARR**: yo actualicé su estado escribiendo el resumen del avance **al final del renglón**, que es
  exactamente donde vivía el enum. Lo borré sin darme cuenta.

El veredicto resultante fue el mismo las dos veces —`⚠️ NADA arrancando`— y su consecuencia no era
cosmética: el monitor me mandaba a **arrancar el hito siguiente de la cola**, que eran los
interruptores del operador (OAuth, legal, reescritura de historia), teniendo dos frentes vivos. El
instrumento no mentía por un bug exótico: mentía porque el formato invita al error que lo rompe.

El agravante estaba en el `else` implícito: los estados no reconocidos se documentaban como *"done
(✅…), bloqueado, o cualquier otro texto libre — el resto ya tiene su propio seguimiento"*. Esa frase
convierte un renglón **roto** en un renglón **cerrado**: son indistinguibles, y el costo de
confundirlos es perder de vista un frente activo.

**How to apply:** (1) leer el enum del **último** campo (`${linea##*|}`), nunca del n-ésimo, cuando el
renglón admite separadores en la narrativa. (2) Validar el enum contra la lista cerrada y **gritar
`MALFORMADO` con el id** ante cualquier otro valor: un instrumento tiene que distinguir *"no aplica"*
de *"no entiendo"* — tratar lo segundo como lo primero es el fail-open clásico de un parser. (3) El
test del arreglo necesita el **control negativo del parseo viejo** (que el caso real no se viera
antes); sin él, el positivo no prueba que la regresión sería visible. (4) Al actualizar a mano un
renglón que un script parsea, escribir en el campo de narrativa y **releer la última columna** — o
mejor, correr el instrumento inmediatamente después de editar: acá el propio ciclo de cron lo delató
en 3 minutos, y por eso el daño fue de minutos y no del día.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[un-instrumento-tiene-dos-modos-de-no-saber-callarse-e-inundar]] (aquél es el instrumento que calla o
inunda; éste **contesta bien la pregunta equivocada**) ·
[[una-allowlist-manual-no-puede-saber-lo-que-le-falta]] ·
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]]
