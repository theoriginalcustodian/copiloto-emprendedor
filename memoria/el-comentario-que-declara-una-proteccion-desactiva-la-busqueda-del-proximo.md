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
