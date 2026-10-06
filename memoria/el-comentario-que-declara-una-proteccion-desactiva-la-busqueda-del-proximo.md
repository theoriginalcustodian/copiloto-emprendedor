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
