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

## Reincidencia 2026-09-22 — **seis** renglones a la vez, y uno tenía un pedido del operador

Un año de `How to apply` escrito, y el mismo `PLAN.md` tenía **6 filas** con el enum sepultado:
`BETA5` `CONS8` `SOP4` `SOP6` `SOP7` `CAL1`. Cinco eran cierres que se escribieron con `🟢` o con
texto libre (`DONE 2026-08-07`) en vez del enum de la lista cerrada. La sexta, `CAL1`, es la que
duele: su estado real vivía en el campo 4 y un appendeo posterior lo empujó al 5 — y ese appendeo
**empieza con la palabra «pendiente»**, así que a ojo el renglón parece bien formado.

Lo que esto agrega al caso original: **no alcanza con leer el último campo; hay que VALIDAR contra la
lista cerrada**, que es el punto (2) de arriba y es justamente el que no se había implementado.
Cinco de las seis se habrían cazado solas con esa validación el día que se escribieron.

Y el `How to apply` (4) —«correr el instrumento inmediatamente después de editar»— falla acá por una
razón que no estaba prevista: **quien appendea no es quien escribió el enum**. La sesión que agrega
«+ 2026-09-xx: …» al final de un renglón ajeno no siente que esté tocando un campo parseado; está
agregando una nota. Por eso el formato sigue invitando al error aunque todos conozcan la regla.

**Normalización que sí sirve:** appendear el enum como **campo nuevo al final**, sin editar una sola
palabra del texto histórico. El registro queda intacto y el parser vuelve a ver el estado — y como el
appendeo natural es al final, el próximo que agregue una nota vuelve a romperlo. La única defensa
real es la validación ruidosa, no la disciplina.

---

## 2026-09-23 — el que rompió el enum no fue un append: fui yo, "mejorando" la redacción

La entrada nació con el appendeo ciego. El tercer caso llegó por otra puerta y es peor, porque fue
**deliberado**: al cerrar seis frentes escribí el último campo como `CERRADA -- #676 en main` en vez
de `✅ cerrada`. Más informativo para un humano; **vacío** para el parser, que normaliza el campo y
exige `pendiente` | `arrancando` | prefijo ✅/❌.

Nueve hitos quedaron invisibles, entre ellos el único frente **vivo**. El veredicto pasó a ser
«NADA arrancando → arrancá CIERREB», que son los interruptores del **operador**: el instrumento
mandaba a las tres sesiones a un frente sin nada arrancable, con LEGAL activo al lado.

**La regla: un campo que un instrumento parsea no admite mejoras de redacción.** El contexto va al
campo de texto libre —acá el disparador—, nunca al del enum. Un enum es una interfaz, y ampliarla
unilateralmente desde el lado del escritor rompe al lector sin error.

Y el remate: el modo de falla estaba escrito **en el comentario del propio `cola-check.sh`**, que yo
había leído ese mismo día al arreglar los dos casos anteriores. **Conocer el modo de falla no lo
evita.** Lo único que lo evita es correr el instrumento **después** de editar el archivo que el
instrumento lee — acá, un `bash scripts/cola-check.sh` de dos segundos.
