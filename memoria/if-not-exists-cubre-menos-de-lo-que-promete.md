---
name: if-not-exists-cubre-menos-de-lo-que-promete
description: `IF NOT EXISTS` habla SÓLO del objeto que nombra — no de la tabla que lo contiene ni de los permisos para crearlo. Tres fallos distintos en una jornada, todos por asumir que hacía la sentencia entera segura.
metadata:
  type: project
---

**LEER antes de escribir cualquier DDL "idempotente" en `provision.py` o en un `.sql` del repo.**

2026-07-28/29. `IF NOT EXISTS` se lee como *"esta sentencia es segura de correr siempre"*. No es eso:
**habla sólo del objeto que nombra**, y nada más. Tres fallos en una jornada, cada uno destapando un
límite distinto de esa promesa:

| # | Sentencia | Lo que se asumió | Lo que pasó |
|---|---|---|---|
| 1 | `ALTER TABLE IF EXISTS … ADD COLUMN` | que hacía algo | Sobre base fresca es **no-op que imprime OK** — el log mostraba éxito antes del error real |
| 2 | `CREATE UNIQUE INDEX IF NOT EXISTS … ON tabla` | que protegía si faltaba la tabla | El `IF NOT EXISTS` es del **índice**. Con la tabla ausente falla igual: `relation does not exist` |
| 3 | `CREATE SCHEMA IF NOT EXISTS` | que era inocuo si el schema ya está | Postgres chequea el privilegio `CREATE` **antes** de mirar si existe → `InsufficientPrivilege: permission denied for database` con el schema ya creado |

**La regla, que sirve fuera de SQL:** `IF NOT EXISTS` cubre **la existencia del objeto nombrado**. No
cubre sus **dependencias** (la tabla donde vive el índice) ni sus **precondiciones** (el permiso para
crearlo). Si tu DDL depende de algo más que la existencia de ese objeto, `IF NOT EXISTS` no te
protege — y falla igual de fuerte que sin él.

**El patrón que sí funciona, y que este repo ya usaba en un rincón:** *preguntar al catálogo primero*.

```sql
SELECT 1 FROM information_schema.schemata WHERE schema_name = %s   -- ¿ya está?
SELECT 1 FROM information_schema.tables   WHERE table_name  = %s   -- ¿existe la dependencia?
```

Sale una consulta barata y convierte la sentencia en una **decisión** en vez de una apuesta. Ya estaba
en `_ensure_clientes_email_telefono` con un comentario que explicaba exactamente por qué —*"preguntar
por el catálogo primero es la única forma de que el `DROP` sea una decisión y no una bomba de
tiempo"*—. La respuesta vivía en el repo antes de los tres fallos.

**Y la diferencia de entorno que ninguno de los gates cubre:** el #3 pasó el CI **en verde**, porque
allí el usuario es dueño de la base efímera. Un Postgres de test reproduce el schema, las tablas y los
datos — **pero no los privilegios**. Eso sólo aparece al desplegar contra la base real, con el usuario
real. Hermana de [[provisionado-no-reconstruye-la-base-desde-cero]].
