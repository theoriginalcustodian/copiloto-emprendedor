---
name: provisionado-no-reconstruye-la-base-desde-cero
description: El provisionado idempotente falla en la primera pasada contra una base virgen — los ensures usan ALTER TABLE IF EXISTS y corren antes de que la tabla exista, así que son no-op silenciosos
metadata:
  type: project
---

# 🏗️ El provisionado "idempotente" **no reconstruye la base desde cero** — falla en la pasada 1

**2026-07-22.** `apps/copiloto/provision.py` corre en producción desde siempre y es idempotente
**sobre una base que ya existe**. Contra una base **virgen**, no:

```
base virgen  →  pasada 1:  FALLA   UndefinedColumn: column "estado" does not exist
                 pasada 2:  OK
                 pasada 3:  OK
```

## El mecanismo — dos decisiones correctas que juntas abren el hueco

1. `estado` **no está en `uc_tables.json`**: la agrega `_ensure_presupuesto_estado`.
2. Los `_ensure_*` usan `ALTER TABLE IF EXISTS` y corren **antes** del pase estándar. Eso es
   **deliberado y está documentado** — los guards anti-colisión necesitan mirar la tabla viva antes de
   que el pase estándar la toque.

Sobre una base que ya existe, las dos son correctas. Sobre una virgen: la tabla todavía no existe → el
`ALTER` es **no-op y no protesta** (`IF EXISTS` para eso está) → el pase estándar crea la tabla sin
`estado` → `inteligencia_migrations.sql` la referencia y muere.

**Nadie mintió y nadie se equivocó**: `IF EXISTS` evita el error que quiere evitar, y el orden es el
que los guards piden. El hueco existe sólo en el escenario que nunca se ejercitó.

## Por qué importa fuera de los tests

Hoy `estado` existe en producción **sólo porque el ensure corrió cuando la tabla ya estaba**. Un
entorno nuevo —DR, staging, otra región, un clon para probar algo— sigue el runbook, corre el
provisionado **una vez**, y se queda con una base a medias y un error. **El runbook de recuperación
no está probado**, que es la peor clase de runbook: el que sólo se descubre roto el día que se usa.

## Cómo se encontró, y por qué no antes

Levantando una base de tests desde cero — la primera vez que alguien provisionó una base vacía. Los
875 tests nunca lo detectaron porque **los que tocan Postgres se saltaban siempre**
([[instrumentos-que-confirman-en-vez-de-verificar]]): el instrumento nunca ejercitó el caso.

## 🔴 2026-07-28 — se cumplió la condición de pago, y había DOS eslabones más

El Postgres efímero que se agregó al CI **es** ese "primer entorno nuevo". Falló en el acto, y **antes**
de llegar al síntoma documentado arriba:

```
psycopg2.errors.InvalidSchemaName: schema "uc_factory" does not exist
```

**Nadie hacía `CREATE SCHEMA`.** El diagnóstico de julio arrancaba en el eslabón 2 (columnas que
faltan) porque en esa base de tests el schema ya existía; el CI arrancó del cero real.

Y el segundo eslabón nuevo: **`CREATE INDEX ... IF NOT EXISTS` sobre una tabla inexistente falla
igual.** El `IF NOT EXISTS` habla del **índice**, no de la tabla. `ALTER TABLE IF EXISTS` se protege
solo; `CREATE INDEX` no — matiz fácil de leer al revés cuando los dos están en la misma función.

**Arreglado (parcial, `ac05cf7`):** `_ensure_schema` corre primero, y `_ensure_reply_idem_key`
pregunta al catálogo con el helper `_tabla_existe`. Se revisaron **las 11** funciones `_ensure_*` de
una pasada, con script, en vez de descubrirlas de a una por corrida de CI: las otras 9 ya eran seguras.

**Sigue pendiente** el arreglo de fondo (reordenar los ensures **después** del pase estándar, o
declarar las columnas en el manifiesto): eso toca el orden del que dependen los guards anti-colisión,
sobre el provisionado que corre en producción. ⚠️ Ese sigue siendo trabajo en frío.

**Lo que sí cambió para siempre:** ahora hay un entorno que ejercita la base virgen **en cada PR**. El
escenario que "nunca se ejercitaba" pasó a ser el que más se ejercita.

## Workaround y arreglo (histórico)

- **Workaround:** correr `provision.py` **dos veces**. Converge y es idempotente de ahí en más.
- **Propietario:** BACKEND. **Condición de pago:** ✅ **vencida y pagada a medias el 2026-07-28.**

## La regla que deja

**Un provisionado idempotente no es un provisionado reproducible.** "Corre N veces sin romper" y
"levanta el sistema desde cero" son dos propiedades distintas, y sólo la primera se prueba sola:
la segunda **exige una base vacía de verdad**, no una que ya venía andando.

**Y el corolario que agregó el 28-jul: una advertencia escrita no es una defensa.** Esta memoria
existía —con el mecanismo bien explicado y su propietario— seis días antes, y no evitó nada: el
siguiente que provisionó una base virgen chocó igual, con dos eslabones que el análisis en frío no
había visto. Lo que lo arregló no fue saberlo, fue **un entorno que lo ejercita solo en cada PR**.
Cuando algo depende de que alguien se acuerde, no está defendido: está documentado, que es otra cosa.

**El detalle que más costó al diagnosticar:** `_ensure_reply_card_column` usa `ALTER TABLE IF EXISTS`,
así que sobre base fresca es un no-op que **imprime `OK`**. El log mostraba un éxito justo antes del
error, invitando a buscar la causa después del punto equivocado. Un paso que dice OK sin haber hecho
nada es peor que uno que falla ([[instrumentos-que-confirman-en-vez-de-verificar]]).
