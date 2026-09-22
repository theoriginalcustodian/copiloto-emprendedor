---
name: afip-vacia-en-prod-era-una-consulta-ciega-por-force-rls
description: "El \"afip_credentials vacía para los 21 tenants\" (14/08) era falso — consulta sin claims bajo FORCE RLS da 0. Real 2026-09-15: 2 credenciales, 3 perfiles; 341lin sin credencial"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-15T12:01:06.847Z
---

**Corregido 2026-09-15 contra prod (solo lectura).** El escalado urgente del 14/08 ("`uc_factory.afip_credentials`
vacía en prod para los 21 tenants, rol owner que bypassa RLS") **era una medición ciega**, no un dato:

- La app se conecta como `uc_factory`, **dueño** de las tablas, `rolsuper=false`, `rolbypassrls=false`.
- `afip_credentials` y `afip_perfil` tienen `FORCE ROW LEVEL SECURITY` (`deploy/worker/provision_tables.py:154`,
  activado por `UC_RLS_FORCE=1` en `deploy/copiloto/deploy.sh:237`). `tenants` NO tiene FORCE (a propósito).
- La policy lee `request.jwt.claims` (`provision_tables.py:49`); sin claims → NULL → **0 filas**, sin error.
- Por eso el patrón del 14/08 ("tenant existe OK, afip_credentials 0, afip_perfil 0") es exactamente la firma de la ceguera.

Medido sin claims: 0 / 0 (reproduce el 14/08). Con claims por tenant: **`afip_credentials` = 2 filas (2 tenants),
`afip_perfil` = 3**. `e2e-device@copiloto.test`: credencial 1, perfil 1. **`341lin@gmail.com`: credencial 0, perfil 1**
— la cuenta del operador sí está sin ARCA vinculado, pero no está "roto para todos".

Las tres hipótesis del 14/08 (otro ambiente / purga por rotación Fernet / save nunca llamado) respondían a un
síntoma que no existía a escala global. El código de escritura y lectura usa la misma tabla/filtro y no hay ruta
que la borre salvo `deploy/copiloto/limpiar_residuos_test.py` (manual, dry-run por defecto, sólo huérfanas).

**Por qué:** el dueño de la tabla NO bypassa RLS cuando hay FORCE; sólo superuser o BYPASSRLS. La creencia
"owner bypassa RLS" ya estaba documentada como falsa en `docs/copiloto-emprendedor/Manejo de errores/05-ESTADO-VIVO-rls-y-fases.md:113-118`,
y aun así un escalado urgente vivió 32 días en `coordinacion/en-curso/` sobre ella.

**Cómo aplicar:** todo `count(*)` diagnóstico sobre `uc_factory` se acompaña de
`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`, o se hace con
`set_config('request.jwt.claims', '{"cliente_id":"…"}', true)` por tenant. Un 0 sin ese control no es un dato.
Script reutilizable del chequeo: el de esta sesión seteaba claims por tenant en transacción `readonly`.

Relacionado: [[rls-activado-que-no-filtraba-el-dueno-esta-exento]] · [[copiloto-facturacion-afip]] ·
[[instrumentos-que-confirman-en-vez-de-verificar]]
