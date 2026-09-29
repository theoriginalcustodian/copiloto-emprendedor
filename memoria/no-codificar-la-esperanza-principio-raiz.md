---
name: ""
metadata: 
  node_type: memory
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

**"No codificar la esperanza"** —actuar siempre con información verificada empíricamente, nunca con un supuesto razonado tratado como hecho— es la **regla raíz** del CLAUDE.md global (regla de oro #1 + toda la sección *"Validación empírica (regla principal)"*). El operador la elevó explícitamente (2026-06-21) a **tronco** de la constitución: *la prueba vale, la aserción no*. No es un cuarto principio paralelo a [[spike-first-central-proyecto]] y [[cero-deuda-no-gestionada]] — es el **padre** del que ambos son instancias.

**Why:** todas las demás reglas son aplicaciones del mismo principio en distintos momentos del ciclo. Si el **tronco** es débil, las **ramas** también lo son — una afirmación no verificada en la base se amplifica en todo lo que se apoya encima (composición), y en una fábrica **autónoma y recursiva** eso ocurre sin un humano por paso. Codificar la esperanza no es un descuido de prolijidad: es un **error de categoría** — tratar una hipótesis (el mapa) como si fuera prueba (el territorio). El árbol:

| Rama | Aplica el tronco… | Momento |
|---|---|---|
| **6 verificaciones** + V-EXT/V-INT/V-RES | al **afirmar alcance** ("todos los X" → grep + contar) | antes de proponer |
| **spike-first** | al validar el **supuesto del cimiento** | antes de construir |
| **primer ladrillo sólido** | al **apoyar trabajo** encima | durante |
| **cero deuda no-gestionada** | a no dejar **impago el atajo** | después de construir |
| **done verificable por test** + **no declarar listo sin evidencia** | al **cerrar** | al terminar |

**How to apply:** nunca afirmar alcance / estado / "funciona" / "está listo" sin **evidencia observable adjunta** — la autoevaluación del agente NO cuenta como verificación (regla de oro #5). Validar contra el repo/sistema real (V-INT/V-RES), contra la spec oficial de APIs externas (V-EXT), y medir antes de afirmar ("todos los X" → grep + contar N exacto). Si no se puede validar en sesión → marcar explícitamente `[ASSUMED_PENDING_VERIFY]` / `[REQUIRES_LIVE_VALIDATION]` y dejarlo como TODO, **no afirmar**. Frase canónica del global: *Medir antes de implementar. Reutilizar antes de crear. Activar por métricas, no por proyecciones. Documentar antes de proponer. Resolver de raíz, no parchear. Investigar antes de inventar.*

**Reflejado (2026-06-21):** receta DISTINTA a spike-first/cero-deuda (el operador lo decidió) — el tronco ya estaba exhaustivo en doctrina, así que NO se duplicó ni se creó hook (pospuesto). Alcance final: (1) **doctrina global** = retoque que articula que es el tronco y nombra sus ramas (cabecera de "Validación empírica"); (2) esta **memoria**; (3) **`CLAUDE.md` del repo** `unreal-copilot` = nota al cierre de la sección "Reglas no negociables" que ata las reglas 6/7/8/9 como ramas del tronco (aplicación al proyecto: nunca declarar "funciona/listo/verde" sin evidencia ejecutable del gate/VPS); (4) **`HARNESS.md` §8** = registro de la decisión NO-hook (audit trail). **ACTUALIZADO (2026-06-21, posterior): la decisión NO-hook se REVIRTIÓ ante evidencia empírica.** El operador reportó que, probando los desarrollos, seguía teniendo que recordar "actuá con información empírica / revisá la realidad antes de hacer nada" → la doctrina sola NO bastaba. Se construyó el hook **`empirical_check_suggester.mjs`** (5º hook de la familia; 7 triggers hot-reload, smoke 5/5) que PREVIENE el fallo: disparado por órdenes de acción/corrección sobre estado existente + afirmaciones/preguntas de estado/alcance, recuerda verificar la realidad ACTUAL (V-INT/V-RES) antes de actuar/afirmar. Trigger derivado de la **tabla "Triggers de verificación de alcance" del global** (el operador no tenía ejemplos → caracterización ya destilada, no inventada; v1 calibrable). **Lección:** evidencia del operador > teoría del agente — el propio tronco aplicado a su propia implementación (mi argumento "no-hook" era teórico; los datos lo refutaron). Relacionado: [[spike-first-central-proyecto]], [[cero-deuda-no-gestionada]].


## La variante más difícil de ver: **la esperanza DECLARADA** (2026-09-28)

Lo habitual es codificar la esperanza sin darse cuenta. Acá hice algo peor: **la nombré por escrito y
la bajé como asignación de todas formas.**

Le bajé a FE1 una categoría nueva para clasificar desvíos — «(d) la app sigue OTRA referencia» —
apoyada en tres mensajes de commit que dicen que los módulos web se portaron desde mobile. Y en el
mismo pedido escribí, con esas palabras, que la consecuencia que sacaba era **«más fuerte que la
evidencia»**. La vi. La escribí. La asigné igual, y FE1 empezó a reclasificar filas con ella.

Auditoría la tumbó en veinte minutos, y no por la evidencia — por el paso lógico: la procedencia del
código explica **por qué** hay desvío, no cambia **contra qué** se mide el producto. Si mobile divergió
del proto y web se portó de mobile, el desvío no desaparece: **se heredó**.

> **Declarar que una afirmación es débil no la vuelve aceptable: la vuelve una deuda que ya sabías que
> tenías.** El aviso escrito se siente como honestidad y funciona como permiso. Si veo el hueco, la
> afirmación **no baja** hasta que alguien la ataque — y el que la escribió no puede ser el que la
> ataca.

Dos cosas más que dejó, y las dos son de forma:

1. **Inventé vocabulario donde ya había** (canon 3). `FUERA-DE-REFERENCIA` estaba en uso en **6
   documentos** y cubría exactamente uno de mis tres casos. Violarlo en el **vocabulario de
   veredictos** es lo más caro: es justo lo que después hay que reconciliar entre lotes y entre
   sesiones ([[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]]).
2. **El costo de una clasificación mal elegida no es estético.** Un desvío clasificado (d) queda **sin
   accionable y sin dueño** — nadie lo arregla porque «el par estaba mal». Convierte hallazgos medidos
   en no-hallazgos, que es la forma más cara de equivocarse en una auditoría. Un veredicto que
   **desactiva** trabajo necesita más evidencia que uno que lo crea, no menos.

Lo único que funcionó: haber pedido el ataque. La categoría duró veinte minutos porque junto con la
asignación mandé un `pedido_` a auditoría diciendo «refutala, acá está la pregunta que la decide».
[[al-juez-tambien-hay-que-darle-el-plano]] — y el juez necesita que le den el **paso débil** marcado,
no sólo la conclusión.

## Un mensaje de commit NO es una medición del código

2026-09-28. Clasifiqué un desvío como «queda fuera a propósito» citando el mensaje del commit #256, y
bajé esa clasificación a otra sesión **dos veces**. Las dos estaban mal:

- el mensaje decía «menú de 6 tiles» y el array tiene **9** — el comentario del código ya estaba viejo
  y el commit **congeló la cifra vieja** al citarla;
- su lista de «queda fuera a propósito» nombraba otras dos pantallas, **no** la que yo le atribuí.

**Un mensaje de commit sirve para redactar la causa y asignar dueño. Nunca para decidir *si hay*
desvío.** Eso se mide en el ejecutable: el array, el `WHERE`, el selector.

Y el agravante de método: un veredicto que **desactiva** trabajo («esto no es un hallazgo») necesita
más evidencia que uno que lo crea, porque nadie vuelve a mirar lo desactivado. Yo usé menos.

Corolario medido el mismo día, del lado del prototipo: un archivo puede **documentar su cambio en un
comentario nuevo y dejar el viejo intacto**, y los dos conviven — el lector encuentra el que busca
primero. Ver `[[documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo]]`.

