# RESULT — CONS0a: cómo lee la Consola con RLS `FORCE` activo

**Fecha:** 2026-08-06. **Autor:** Backend. **Contrato:** `coordinacion/.../CONS0a-spike-como-lee-la-consola-con-RLS-FORCE.md`.

## Decisión: opción (a) — rol dedicado con `BYPASSRLS`

Reutiliza el patrón **ya probado en producción** (`copiloto_autosanacion`, PR previo, en vivo desde
2026-08-01) para un consumidor nuevo: `copiloto_consola`, `BYPASSRLS`, `NOSUPERUSER`, **sólo
`SELECT`** en 3 tablas (`copiloto_metering`, `copiloto_feedback`, `copiloto_traumas`).

## Por qué NO las otras dos — medido, no argumentado

| Opción | Por qué no |
|---|---|
| (b) Policy específica para el rol admin | Las policies `tenant_isolation` de las 3 tablas ya están escritas y verificadas (`USING`+`WITH CHECK`, sección 2 de `verificar-rls.sh`). Agregar una segunda policy `FOR SELECT TO copiloto_admin USING (true)` es **más superficie declarativa por tabla que un GRANT único**, y el precedente en prod ya usa BYPASSRLS — dos mecanismos distintos para el mismo problema es la deuda que este spike existe para no crear. |
| (c) Vistas agregadas sin fila individual | **No alcanza para A5** (specs §5): el DLQ necesita `fingerprint`, `dedupe_count`, `intentos`, `estado` **por fila** para agrupar y decidir el reintento — una vista agregada pierde exactamente el dato que A5 necesita. Descartada por requisito funcional, no por preferencia. |

## Evidencia — control diferencial real, contra `fusion` (prod)

`deploy/copiloto/provision-rol-consola.sh`, corrido dos veces (idempotencia: 2ª corrida reusa la
contraseña, no falla):

```
rol nuevo   : conecta OK como 'copiloto_consola', bypassrls=True, superuser=False, ve 2/2 tenants de la sonda
rol del app : ve la sonda = 0 (tiene que ser 0)
rol nuevo   : intenta INSERT en copiloto_metering -> RECHAZADO (sólo SELECT, como se declaró)

✅ CONTROL DIFERENCIAL VERDE: el rol ve ≥2 tenants a la vez, sólo lee, la conexión normal no ve nada.

            tabla             | permisos
------------------------------+----------
 uc_factory.copiloto_feedback | SELECT
 uc_factory.copiloto_metering | SELECT
 uc_factory.copiloto_traumas  | SELECT
```

`deploy/copiloto/verificar-rls.sh` (extendido con §5), corrido después, contra el catálogo real:

```
5. ROL DE LA CONSOLA (copiloto_consola) — BYPASSRLS acotado, medido contra el catálogo
   bypassrls=True  superuser=False
   grants={'copiloto_feedback': {'SELECT'}, 'copiloto_metering': {'SELECT'}, 'copiloto_traumas': {'SELECT'}}  ✔
```

## Test adversarial obligatorio — dónde vive

`apps/copiloto/tests/test_rls_invariantes.py` (los 3 tests existentes quedan intactos, se agregan 4):

1. `test_rol_consola_tiene_EXACTAMENTE_SELECT_en_sus_3_tablas_ni_uno_mas` — lee `aclexplode(relacl)`
   del catálogo, corre con el rol normal de la app (no necesita el DSN del rol nuevo).
2. `test_rol_consola_es_BYPASSRLS_pero_NO_superuser` — espejo vivo del provisioning.
3. `test_rol_consola_CONTROL_POSITIVO_ve_dos_tenants_en_la_misma_query` — siembra 2 tenants con el
   rol de la app (declarando cada uno), confirma que la Consola los ve **juntos**, y que la
   conexión normal, sin tenant, no ve nada — el control negativo en la misma corrida.
4. `test_rol_consola_ADVERSARIAL_no_puede_escribir` — `DELETE ... WHERE false` en las 3 tablas →
   `InsufficientPrivilege` (el `BYPASSRLS` saltea policies, no GRANT).

Corren localmente contra la base de tests efímera (`deploy/copiloto/test-db.sh`, extendido para
provisionar `copiloto_consola` igual que `copiloto_autosanacion`) — no sólo contra prod.

## Nota sobre `tenants`

El camino elegido **no toca** `uc_factory.tenants` — sigue resolviéndose con el rol normal de la
app (sin `FORCE`, como debe ser). A2 (listado de cuentas) no necesita el rol nuevo.

## Qué falta (fuera de este spike, para la implementación real de A3/A4/A5)

Endpoints `/admin/*` que usen `COPILOTO_CONSOLA_DSN` — depende de **CONS0b** (de dónde sale el
claim de administrador) para el gate de autorización. No implementado en este PR: es spike, no
feature.
