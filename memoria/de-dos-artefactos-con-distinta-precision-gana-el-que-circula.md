---
name: de-dos-artefactos-con-distinta-precision-gana-el-que-circula
description: El tablero decía "el push pasa a veces"; el mensaje al buzón decía "bloqueado para todas". Backend leyó el mensaje y se paró con el trabajo terminado.
metadata:
  type: feedback
---

El mismo hecho estaba escrito en dos lugares con distinta precisión, y la sesión que dependía de él
actuó sobre el menos preciso — porque es el que le llegó.

**El caso (2026-09-23).** El reconcile del grafo abortaba los push. En `coordinacion/PLAN.md`, la
fila `GRAFO` decía, exacto: *«los push que pasan hoy pasan por COLISIÓN con un sync ajeno (el hook
deja pasar la contención), no porque esté resuelto»*. En el `hallazgo_` que bajé al buzón, el mismo
hecho quedó como el título: **«el push está bloqueado para todas»**.

Backend leyó el mensaje. Razonó bien sobre lo que tenía: *«la resolución es MAYOR, la tiene el
operador, no soy dueña de ese estado compartido, no lo fuerzo»* — todo correcto. Y se declaró
bloqueada con BL-O6 Parte B **implementada y con gate 5/5 verde**, sin reintentar una sola vez. El
push le habría pasado: el hook deja pasar cuando otro sync tiene el lock, y con tres sesiones
corriendo crones hay syncs vivos buena parte del tiempo. Yo mismo pusheé cuatro commits en ese
estado, y FE2 también.

**Por qué pasa.** El tablero se escribe para pensar y admite matices; el mensaje se escribe para
avisar y **premia el título corto**. Un `hallazgo_` viaja, se cita, se relee al arrancar; una celda
de tabla de 900 caracteres, no. De los dos, el que fija la conducta ajena es el que circula — y es
justamente el que se escribe con menos cuidado, porque «el detalle ya está en el plan».

**Y el matiz se pierde en la dirección peligrosa.** «A veces» se comprime a «siempre», nunca al
revés: un bloqueo dicho como permanente no produce un error ruidoso, produce **quietud**, que es lo
que nadie re-mide. Backend no falló: acertó sobre una premisa que le di mal.
Ver [[una-espera-sin-disparador-nombrable-es-paralisis]] y [[supuesto-cuya-falla-parece-un-estado-legitimo]].

**Cómo se aplica.** Antes de bajar un `hallazgo_` o un `dato_` que vaya a **parar** a alguien:

1. *¿El título dice lo mismo que la evidencia, o la redondeó?* «Bloqueado» y «bloqueado a veces» son
   dos instrucciones distintas para quien lo lee.
2. *¿Qué NO tiene que dejar de intentar por leer esto?* Si la respuesta es «reintentar», **decilo en
   el mensaje**, no en el tablero.
3. *¿Le di un techo?* Un bloqueo comunicado sin techo es indefinido. El destrabe que mandé lleva uno
   explícito: «si te aborta **tres veces seguidas**, vuelve a ser bloqueo mío, no tuyo».

Corolario para el que recibe: un bloqueo ajeno **heredado** se re-mide una vez antes de adoptarlo,
sobre todo si adoptarlo significa parar con el trabajo terminado. Cuesta un comando.

---

## 2026-09-23 (mismo día) — y adentro de UN artefacto pasa igual: gana el ENCABEZADO

Corregí la afirmación equivocada **appendeando** el matiz al final del mismo campo, y quedó tan
invisible como si no la hubiera corregido. La fila `GRAFO` del tablero abría con «🔴 **El sync del
grafo aborta y con él TODO push de las 4 sesiones**» y cerraba, 900 caracteres después, con la
corrección medida. `cola-check.sh` imprime el **principio** del campo, así que el veredicto que
seguía circulando en cada corrida era el titular refutado.

**La corrección tiene que ir donde el lector mira, no donde el texto termina.** Y quién es «el
lector» hay que medirlo, no suponerlo: acá no es una persona leyendo la tabla, es un script que
trunca a los primeros N caracteres. Un `head -c` decide qué versión de la verdad circula.

La prueba de que está bien corregido no es haber escrito el matiz: es **volver a correr el
instrumento** y leer lo que ahora imprime. Cuesta dos segundos y es el mismo gesto que
[[un-enum-al-final-del-renglon-lo-borra-el-que-appendea]] pide para el enum — sólo que ahí lo que se
rompe es el parseo y acá, lo que se rompe es el titular.

Regla corta: **appendear sirve para agregar, nunca para desmentir.** Si lo nuevo contradice lo viejo,
se edita el encabezado; el detalle histórico puede quedar abajo.
## Refuerzo 2026-10-08 — tres instancias en un día, y en las tres el preciso era el más NUEVO

El mismo día de cierre, el mecanismo se repitió tres veces seguidas:

1. **9 de 12 hallazgos** entregados por auditoría no estaban en **ningún** archivo de `origin/main`
   (medido id por id con `git grep -F`, control positivo sobre las 3 que sí): vivían sólo en
   `coordinacion/`, que está gitignored a propósito. El artefacto preciso no sobrevivía ni a un clon.
2. La conclusión **«el punto 3 de §13 no se puede cerrar este sprint»** se escribió **57 segundos
   después** de mergear el doc de cierre (doc `0b641b2d` 10:30:19 · ENMENDADO del contrato `BL-Q5`
   10:31:16) — y quedó en el buzón. El doc que lee el operador quedó con la versión sin la conclusión.
3. Los veredictos de las 4 filas del «residuo» del punto 2 ya estaban en el plan vigente con
   `path:línea` desde el 06/10 (`:348`, `:350`, `:395`, `:397`). El doc de cierre publicó en su lugar
   la señal cruda del instrumento, que no distingue «falta el trabajo» de «el PR no citó el id».

**Lo que agrega esta ronda:** no es un problema de artefactos viejos. En las tres el preciso **existía
y era más nuevo** — 57 segundos más nuevo en el caso 2. Falla la **propagación**, no la medición.

**La pregunta que lo caza, antes de citar un número:** *¿este número lo produjo este instrumento, o
hay un artefacto más fino que ya lo respondió?* Y la variante estructural: *¿el artefacto preciso está
en un lugar que **circula** —versionado, en `main`— o en uno que no?* Ver
[[el-tipo-de-mensaje-decide-si-alguien-lo-persigue]] y [[mensaje-entregado-donde-nadie-mira]].


### (d) 2026-10-08, más tarde — la cuarta instancia es MÍA, y el artefacto impreciso ya estaba ARCHIVADO COMO CERRADO

El caso 3 de arriba vuelve, con el agravante dado la vuelta. Ese `cierre_` de las 4 filas del
«residuo» no sólo publicó la señal cruda: en su recómputo de `§13` escribió **«punto 2 · ✅ en
sustancia, 0 asignables»**. Horas después, el muestreo adversarial que `DEC-18` firmó midió **10 de
los 53 ítems** del punto 2 y encontró **4 falsos ✅** — tres de código/test y uno de texto legal
publicado.

**Las 4 filas estaban bien medidas. La frase que las reportaba, no.** Dos de ellas reaparecen en el
muestreo confirmando (`BL-Q1` es el **control positivo** y sale verde; `BL-Q3` vuelve a salir no
falso). El defecto no estuvo en medir: estuvo en que **la afirmación cubría un universo más grande
que el medido** — 4 filas marcadas con 🚨 en el doc de alcance, generalizadas a los 53 ítems del
punto.

**Lo nuevo respecto de las tres instancias de arriba:** ahí el artefacto preciso existía en otro
lugar y no circulaba. Acá **el impreciso era el mío y ya estaba en `cerrado/`**, es decir en el lugar
que se lee como «esto ya se resolvió». Un veredicto optimista archivado como cerrado no compite con
el nuevo: lo precede, y quien no lea los dos se queda con el primero. Por eso el retiro va **dentro
del doc que circula** (`§7` del muestreo) y no sólo en el `cierre_`: el buzón se archiva, `docs/` se
clona.

**La pregunta, que es distinta de la de arriba:** la de arriba pregunta *¿hay un artefacto más fino
que ya respondió este número?*. Esta pregunta es **sobre el sujeto, no sobre el número**: *¿el
universo que medí es el universo del que estoy hablando?* Cuatro filas y cincuenta y tres ítems no
son el mismo sujeto, y la frase no lo decía. Ver
[[el-instrumento-respondio-sobre-otro-sujeto]] — mismo error de sujeto, pero del lado del **alcance
de la afirmación** en vez del lado del objeto medido.
