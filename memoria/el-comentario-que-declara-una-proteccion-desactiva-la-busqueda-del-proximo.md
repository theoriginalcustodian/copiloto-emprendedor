---
name: el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo
description: Un comentario que afirma una defensa que nadie da no falla solo: hace que el próximo lector dé la protección por hecha y no mida. 4 casos en un día.
metadata:
  type: feedback
---

**El daño de un comentario que declara una protección inexistente NO es el hallazgo que no caza:
es que desactiva la búsqueda del próximo lector.** Un `[UNVERIFIED]` o un hueco sin documentar
invitan a medir; una línea que dice *«esto ya está cubierto»* **cierra la pregunta**.

**Cuatro apariciones independientes el 2026-10-06, en cuatro instrumentos distintos:**

| dónde | la línea afirmaba | la verdad medida |
|---|---|---|
| `gate.sh:40-41` | *«una corrida con overrides es un TEST: su recibo jamás va a la copia real»* | cierto **sólo de la copia durable**. Con `GATE_CI_DIR` a secas el recibo por SHA caía en el `.ci-recibos/` REAL, y `recibo-cubre.sh` busca ahí en **todos** los worktrees ⇒ un stub `exit 0` **cubría** un SHA que nadie probó (medido: `✅ CUBRE`) |
| `ci-verde.sh:102-104` | el rollup *«acumula los check-runs de TODOS los runs»* | la observación es real; la **causa** no — el duplicado es transitorio. El filtro sigue haciendo falta, pero quien leyera eso para decidir si sobra **concluiría que sobra** |
| `lint.sh:11-12` | *«cero secretos en TODA la historia»* | la línea 13 corre `--arbol`. `--historia` **no tiene ningún llamador** |
| `recibo-cubre.sh` | — (no lo decía, y era el único sin consumidor que lo cubriera) | la defensa **no vivía en ningún lado** |

🔑 **Y el patrón del diagnóstico:** en los cuatro, la afirmación era **parcialmente cierta**. Eso es
lo que la hace sobrevivir a la revisión: no es falsa de frente, cubre *una* de las dos mitades. La
pregunta que la desarma no es *«¿esto es verdad?»* sino **«¿de qué mitad exactamente es verdad, y
quién cubre la otra?»**

**Cómo aplicarlo**
- Un comentario que afirma una defensa es una **aserción sin test**: o lo prueba un control positivo,
  o se reescribe nombrando su alcance exacto y el hueco que deja (con dueño y fecha).
- Al leer uno, **nunca lo tomes como medición**. Si decide tu diseño, medilo — el autor fue el que
  no lo midió.
- Al escribir uno: decí dónde vive la defensa (`path:línea`) y qué **no** cubre.
- Corolario para los gates: **toda protección necesita control positivo**, también las que viven en
  prosa. → [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] · [[el-contrato-afirma-el-mecanismo-que-no-opero]] · [[instrumento-que-no-mira-nunca-falla]]

---

## REFUERZO (2026-10-11) — y también cuando el comentario declara un ESTADO DEL SISTEMA

El título dice «protección», y la forma es más ancha: **un comentario que afirma un hecho sobre el
sistema se lee como medición y no lo es.** Acá no declaraba una defensa, declaraba quién escribe una
columna:

```python
# `mercadopago` todavía no lo escribe nadie (esos pagos viven en `mp_payments`): está declarado acá
# para que el día que se unifiquen no haya que inventar el valor
ORIGEN_FACTURA, ORIGEN_MANUAL, ORIGEN_MP = "factura", "manual", "mercadopago"
```

Publiqué en el backlog del sprint, como hallazgo estrella, que *«el mismo cobro de MercadoPago está
contado CERO veces en Ingresos y DOS veces en Entró — una sola raíz con dos síntomas opuestos»*. La
mitad del «cero» **era falsa**: `9e4a70dc` (06/10) había cableado el webhook para registrar el pago en
`copiloto_cobros` con ese origen, y **cambió el código sin cambiar el comentario**. Un `grep` de quién
**escribe** `ORIGEN_MP` lo resolvía en un comando; en vez de eso grepeé quién **lee** y le creí al
comentario sobre quién escribe — teniendo [[la-costura-leia-un-campo-que-nadie-escribe]] en la memoria
de este mismo repo, citada por mí en otro párrafo del mismo documento.

**Por qué este comentario engaña más que uno sobre una defensa:** un comentario de protección invita a
confirmar («¿existe el guard?»); uno que afirma una ausencia (*«todavía no lo escribe nadie»*) no deja
nada que buscar. Confirmar una ausencia se siente como no tener trabajo, y una afirmación negativa
viene con su propia explicación de por qué no hay nada que ver. El verde del caso normal la sostiene:
en Ingresos el pago **sí** aparecía, pero yo ya había concluido que no, y no abrí la pantalla.

**Cómo aplicarlo:** si un comentario afirma un hecho del sistema —quién escribe, quién llama, qué
está vacío, qué no pasa todavía— **tratalo como una hipótesis con fecha de vencimiento, no como
evidencia.** El comando es `git log -S'<el símbolo>' --oneline` o un grep del símbolo restringido a
los sitios de escritura; cuesta menos que la línea que estás por escribir afirmando lo que el
comentario dice. Y al lado del comentario mirá su `git blame`: **si el commit más nuevo del archivo es
posterior al comentario y toca el mismo tema, el comentario ya es sospechoso.** Al corregirlo, dejá
escrito *qué commit lo volvió falso y cuándo*, no sólo el hecho nuevo: eso es lo que convierte al
comentario en algo fechable la próxima vez.

## Refuerzo 2026-10-12 — la variante peor: el doc declara una MARCA que ninguna fila lleva

Hasta acá la entrada trataba del comentario que afirma un **hecho** del sistema. Hay una variante que
engaña más, porque no afirma un hecho: **declara un mecanismo propio del documento.**

El mapeo prototipo→nativo (PR #1029) decía en su cabecera: *«las filas que dependen de esas tres van
marcadas `[ASSUMED_PENDING_VERIFY]` y no se implementan hasta que estén respondidas»*. Medido:

```
=== filas con ASSUMED_PENDING_VERIFY ===
114:Las filas que dependen de esas tres van marcadas `[ASSUMED_PENDING_VERIFY]` y **no se
```

**Un solo hit, y es la propia línea que lo declara.** Cero filas marcadas. La frase describe una
protección que el documento no implementa, y es **peor que un comentario viejo**: un comentario viejo
alguna vez fue cierto, esta frase nunca lo fue. Y el que lee la cabecera queda convencido de que las
filas sensibles están señaladas, así que **toma cualquier fila de la tabla sin mirar si tiene marca.**

Por qué sobrevivió en ese doc, que es el mecanismo de esta entrada aplicado a sí mismo: la afirmación
falsa de la misma cabecera (*«el mockup 11 puso `MicFuncion` en la columna descartada»*) **ya había
sido refutada con evidencia y corregida** — en el control positivo y en el renglón del lote B. Quedó
viva en la cabecera porque la corrección se escribió **en otro lado** en vez de retirar el texto
viejo. Documentar el cambio en un lugar nuevo deja el viejo circulando.

**Y dos cosas medidas al arreglarlo, que son las que hacen el arreglo barato:**

1. **La marca va en un campo que NO es clave.** Primer intento: marcar el id → `| \`esc\`
   **[ASSUMED_PENDING_VERIFY]** |`. El control del padrón cayó a **53 de 54** y acusó a `esc` de
   ausente. El primer campo es la clave y el parser la lee literal: una marca ahí **borra la fila**.
   Va en la columna que se lee, no en la que indexa. Lo cazó un control existente, no yo.
2. **Un control de marca tiene DOS ramas y necesita DOS canarios.** Bloqueada **sin** marca → se
   implementa a ciegas. Marca **huérfana**, sin entrada en la tabla de quién la desbloquea → nadie
   sabe qué respuesta la libera, así que **no se levanta nunca**. Con un solo sabotaje se acredita la
   mitad del control, que es el patrón de
   [[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

**Cómo aplicarlo:** cuando un documento declare que sus propias filas/secciones llevan una marca, un
estado o una clasificación, **grepeá el token y contá los hits contra las filas que debería haber.**
Si el único hit es la línea que lo declara, el mecanismo no existe. Y el fix de raíz no es marcar las
filas a mano: es que el **instrumento mida la marca** (el verificador del mapeo ganó su `CONTROL 5`),
con la tabla de bloqueos en **un solo lugar** que lean el verificador y el generador — si cada uno
tiene la suya, el doc dice una cosa y el gate mide otra. Ver también
[[documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo]] — que es el mecanismo
exacto por el que esta afirmación sobrevivió — y
[[el-guard-se-satisface-con-su-propio-comentario]].

---

## 📅 2026-10-12 — la variante más tranquilizadora: el aviso es CORRECTO y el remedio que propone no lo cumple

Las variantes de arriba son comentarios que **exageran o inventan** la defensa. Ésta es peor de leer,
porque el comentario **acierta en el diagnóstico**: `.claude/commands/monitoreo.md` decía, textual,
*«el destinatario puede ser compuesto: `-a-backend-y-planificacion_`; `-a-planificacion_` no lo ve»*.
Es verdad, es preciso, y nombra el caso exacto.

Y la línea de arriba proponía el filtro `find abierto -name '*planificacion_*' ! -name '*_planificacion-a-*'`,
que **tampoco los ve**. Medido sobre el buzón real: **7 de 12** mensajes invisibles, uno un `urgente_`
de cinco días. El motivo es de un carácter: `*planificacion_*` exige `planificacion` **pegada al `_`**,
y en `-a-planificacion-y-backend_` la sigue un `-`.

🔑 **Por qué desactiva la búsqueda con más fuerza que una mentira:** quien llega ahí preguntándose
*«¿este filtro ve los compuestos?»* encuentra el aviso que dice que sí los tuvo en cuenta, y **la
pregunta queda contestada antes de mirar el comando**. Un comentario ausente deja la duda viva; un
comentario equivocado se puede refutar leyendo; **un comentario correcto al lado de un remedio
insuficiente se autoacredita**. Es la forma de [[instrumentos-que-confirman-en-vez-de-verificar]]
aplicada a la prosa: la advertencia *performa* el cuidado.

**Cómo aplicarlo:** cuando un comentario advierte sobre un caso borde, **corré el caso borde contra el
remedio de al lado** — no alcanza con que el aviso lo nombre. Un renglón:
`comm -23 <(instrumento_bueno) <(filtro_documentado)`, y lo que salga es lo que el aviso no cubría.
Y el fix de raíz no es mejorar el glob en cinco prompts: es que **ninguno escriba el filtro** y todos
invoquen la misma definición (`scripts/mi-buzon.sh` → `me_interpela()`), porque una regla copiada en
cinco lugares divergió en cinco lugares. → [[la-costura-leia-un-campo-que-nadie-escribe]]

---

## Refuerzo 2026-10-12 — el aviso escrito a mano envejece en DOS direcciones opuestas, y una de ellas no da síntoma

El generador de los contratos del mapeo (`scripts/evidencia/armar-contratos.py`) tenía el aviso de
filas bloqueadas **escrito a mano** en su cabecera, nombrando `esc`:

> ⚠️ **Lo que NO se implementa todavia:** la fila `esc` depende del estado de reposo de las 3 capas,
> que es decision del operador (`pedido_` del 2026-10-12, **sin responder**).

El mismo día el operador respondió. Si no lo hubiera cambiado, el doc que circula habría seguido
afirmando un bloqueo **inexistente** — y los contratos son justo lo que cada sesión lee para tomar
trabajo.

**Lo que esto agrega a la entrada:** un aviso de estado puede envejecer hacia los **dos** lados, y
no son simétricos en visibilidad:

| dirección | qué pasa | ¿da síntoma? |
|---|---|---|
| **sobrevive al desbloqueo** | afirma un bloqueo que ya no existe → frena trabajo que está libre | **sí**, alguien lo lee y pregunta |
| **no aparece con el próximo** | una fila nueva se bloquea y el aviso no la nombra → se implementa a ciegas | **no**: el silencio es idéntico a «no hay bloqueos» |

El segundo es el peligroso, y es el que la intuición no cubre: el reflejo al resolverse una decisión
es **borrar** el párrafo. Borrarlo deja el mecanismo sin voz para la próxima vez.

**El fix de raíz tiene dos mitades, y la segunda es la que casi me salto:**

1. **Derivar el aviso de la fuente única.** `aviso_bloqueo()` lo arma desde `V.BLOQUEADAS` — la
   misma tabla que usa el control 5 del verificador. Una definición, no dos.
2. **IMPRIMIR el caso cero.** Con la tabla vacía el aviso no se calla: dice *«✅ Cero filas
   bloqueadas por decisiones ajenas. Derivado de `V.BLOQUEADAS`, que está vacía: no es una
   afirmación escrita a mano»*. Porque **un silencio no se distingue de "no lo miré"** — y eso ya lo
   pagué con el umbral que dejaba muda a la clase de 1 marcador
   (→ [[instrumento-que-no-mira-nunca-falla]]).

**Y vaciar la tabla NO es retirar el mecanismo.** `BLOQUEADAS = {}` quedó con el comentario de por
qué sigue existiendo: su control 5 es **simétrico** —una fila marcada sin entrada, o una entrada sin
fila marcada, hacen fallar el gate—, así que la tabla es lo que obliga a que la marca y la
declaración no divergan. Un mecanismo retirado no frena a la próxima fila bloqueada.

**Cómo aplicarlo:**
- Antes de escribir un aviso de estado en una cabecera generada, preguntá: *¿de qué variable sale?*
  Si la respuesta es «de mi memoria al escribirlo», es un comentario que declara estado.
- Al resolverse la condición, **no borres el bloque**: hacé que el bloque sepa decir «cero».
- Un control positivo del derivado: inyectá una entrada falsa en la tabla y verificá que el aviso
  **reaparece y la nombra**. Sin eso, «lo derivé» es autoevaluación.
  → [[medir-si-un-gate-dispara-antes-de-embarcarlo]] · [[documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo]]
