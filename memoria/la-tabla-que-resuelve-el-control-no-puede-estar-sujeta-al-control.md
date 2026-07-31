---
name: la-tabla-que-resuelve-el-control-no-puede-estar-sujeta-al-control
description: tenants traduce JWT→cliente_id y se lee ANTES de declarar el tenant — ponerle FORCE RLS deja a TODOS afuera con 403
metadata:
  type: project
---

**Todo control de acceso tiene un dato que se consulta para saber a quién se le aplica. Ese dato no
puede estar protegido por el control mismo — se lee antes de que el control pueda decidir nada.**

Acá ese dato es `uc_factory.tenants`: `resolve_cliente_id()` ([auth.py:56](../apps/copiloto/auth.py#L56))
la consulta con el `sub` del JWT para averiguar el `cliente_id`, y **recién después** el borde declara
el tenant. Con `FORCE ROW LEVEL SECURITY`, esa lectura ocurre **sin claims** → 0 filas → `None` →
`require_tenant` responde **403 "tenant not provisioned"**. A todos. Incluidos los que sí existen.

**Medido con control diferencial (2026-07-31, base de tests, mismo provisionado que prod):**

| | filas visibles |
|---|---|
| admin — **control positivo** | 1 ← la fila existe |
| `tenants` **sin** FORCE (como está hoy) | **1** ← el login funciona |
| `tenants` **con** FORCE | **0** ← nadie puede autenticarse |
| restaurado | 1 |

⚠️ El primer intento de este control dio `0/0/0` y **no medía nada**: el `INSERT` había fallado por un
`NOT NULL` y los tres ceros eran de la fila inexistente, no del RLS. Sin la fila del control positivo,
la conclusión habría sido la contraria y perfectamente convincente. [[vacio-no-es-hallazgo-correr-el-control]]

## Lo que lo hace peligroso: hoy funciona por accidente

`tenants` quedó **fuera de `uc_tables.json`**, que es lo que el provisionado recorre para aplicar
`FORCE`. Nadie lo decidió: quedó afuera. Agregarla al manifiesto —un cambio que **se lee como una
mejora de seguridad**, y que un revisor aprobaría sin dudar— tumba la autenticación entera. Y ningún
test de store lo notaría: todos usan conexiones que ya tienen el tenant declarado.

Su aislamiento no depende del RLS: se consulta por `auth_user_id`, que viene **firmado en el JWT**.
Pedir la fila de otro exige falsificar el token.

**Guard permanente:** `tests/test_rls_invariantes.py` — uno mide el **efecto** (`relforcerowsecurity`
en la tabla) y otro la **causa** (que no entre al manifiesto), porque el de la causa se pone rojo
cuando todavía se puede leer el diff.

## La forma general

Antes de aplicar un control a todo un conjunto, preguntar **cuál de esos elementos el control necesita
leer para funcionar**. Ese es su bootstrap y va exento, con el motivo escrito al lado. Vale igual para
la tabla de permisos de un sistema de permisos, la de sesiones de un gate de sesión, o la de rutas de
un router protegido. Hermana de [[rls-activado-que-no-filtraba-el-dueno-esta-exento]]: aquella es el
control que no aplicaba: ésta, el control que aplicaría **de más**.
