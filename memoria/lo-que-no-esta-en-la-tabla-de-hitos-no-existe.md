---
name: lo-que-no-esta-en-la-tabla-de-hitos-no-existe
description: Una responsabilidad escrita en la prosa de un contrato y ausente de su tabla de hitos no se ejecuta — y no se ve como falta, se ve como alcance
metadata:
  type: feedback
---

**Si el trabajo no tiene un renglón en la tabla de hitos, no se hace — por completo que esté el resto
del documento.** La prosa se lee **una vez**, al empezar; la tabla se **ejecuta**.

**Caso raíz (2026-07-22, frente Clientes).** El alta manual de clientes estaba escrita en **tres**
lugares del contrato: §2 (`POST /clientes` — *«alta manual o por voz»*), §3.1 (`origen: "manual"`) y
§8 (*«FRONTEND — el listado, la ficha, **el alta y la edición**»*). **No estaba en la tabla de hitos
de §10.** Frontend cerró su hito —*«Listado + ficha cableados»*— sin el alta, lo declaró en su
`avance_`, e hizo exactamente lo que la tabla pedía. Backend tenía el alta en su hito 3, detrás de
las tools de voz en la prioridad. Resultado: **los clientes sólo se creaban solos**, derivados de
facturas, y en un tenant nuevo la cartera arrancaba vacía sin forma de cargar el primero. Lo detectó
el operador **usando la app**, no ningún gate.

**Por qué no lo caza nada.** El documento se ve completo desde cualquier ángulo: el que lee la prosa
encuentra la responsabilidad asignada; el que ejecuta la tabla encuentra sus renglones cerrados; los
dos terminan verdes. **Nadie compara la prosa con la tabla**, porque no hay ningún momento del
proceso en el que eso sea el trabajo de alguien. Y el síntoma no se parece a una falta: una función
sin su renglón **se ve como el alcance que se decidió**, no como algo que falta.

Es pariente de [[mensaje-entregado-donde-nadie-mira]] — escribir en el lugar correcto no alcanza si
el lugar que se usa es otro— y de [[verificar-que-el-camino-recomendado-existe]]: cada lado verificó
su mitad y la costura no era de nadie.

**How to apply:** al cerrar un `contrato_`, antes de emitirlo, recorrer la tabla de hitos y verificar
que **cada verbo de la sección "quién es dueño de qué" tenga su renglón**. Un contrato con más
responsabilidades en la prosa que en la tabla está mal cerrado. Y a la inversa: si algo importa lo
suficiente para escribirlo en el cuerpo, **importa lo suficiente para ser un hito**; si no merece
hito, no merecía estar escrito.

**Corolario de prioridad, que salió del mismo caso:** cuando una capacidad tiene **dos caminos** —a
mano y por voz/IA—, el manual va primero. Es el que funciona sin micrófono, sin señal y sin que el
modelo entienda un apellido. Poner el camino asistido delante deja al usuario **sin ninguno** mientras
el asistido no esté.

## Refuerzo (2026-10-06): tenía renglón, y aun así era invisible

La fila `DRIVECERO` (Drive se conecta por OAuth y no puede hacer nada: `TOOLS = {}`) **existía en el
tablero y estaba `pendiente`** desde días antes. Igual quedó como la última fila de producto sin
contrato bajado, y no por falta de interés: vivía en la **línea 199**, en la tabla de criterios
de producto, y `cola-check.sh` recorre **sólo** el bloque `COLA-VIVA` (líneas 233-404). El único
instrumento que ofrece trabajo **nunca la pudo ofrecer**.

**La corrección de la clase:** no alcanza con que el trabajo tenga renglón. Tiene que estar en la
tabla que el **lector** recorre. Un documento puede tener dos tablas y un solo lector, y entonces la
segunda tabla es prosa con forma de tabla — se lee igual de bien y **no se ejecuta**.

**Cómo se ve el síntoma, que es lo que lo hace durar:** idéntico al del caso raíz. Nadie reporta
la falta, porque el que mira el tablero ve su fila ahí, `pendiente`, esperando turno; y el que corre
el instrumento ve una cola coherente sin ella. Los dos ven algo correcto.

**How to apply, agregado:** al escribir una fila, verificar que cae **dentro de los delimitadores que
el lector parsea** (acá: `COLA-VIVA:INICIO` / `:FIN`), y si hay dos tablas, dejar la de afuera como
**puntero explícito** a la viva — nunca con estado propio, o habrá dos renglónes afirmando cosas
distintas sobre lo mismo.
