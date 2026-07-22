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

## Workaround y arreglo

- **Workaround (hoy):** correr `provision.py` **dos veces**. Converge y es idempotente de ahí en más.
- **Arreglo (pendiente, en frío):** reordenar (ensures **después** del pase estándar) o declarar las
  columnas en el manifiesto. ⚠️ **No hacerlo apurado:** toca el orden del que dependen los guards
  anti-colisión, sobre el provisionado que corre en producción.
- **Propietario:** BACKEND. **Condición de pago:** antes de escribir `deploy/copiloto/test-db.sh`, o
  antes del primer entorno nuevo (staging / DR / región) — lo que llegue primero.

## La regla que deja

**Un provisionado idempotente no es un provisionado reproducible.** "Corre N veces sin romper" y
"levanta el sistema desde cero" son dos propiedades distintas, y sólo la primera se prueba sola:
la segunda **exige una base vacía de verdad**, no una que ya venía andando.
