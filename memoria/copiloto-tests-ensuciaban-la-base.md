---
name: copiloto-tests-ensuciaban-la-base
description: Los tests corren contra la base de PRODUCCIÓN y dejaban filas huérfanas (552 acumuladas). Fixture de barrido en conftest.py. LEER antes de escribir un test de integración o de diagnosticar datos raros en uc_factory.
metadata: 
  node_type: memory
  type: project
  originSessionId: cbc14bc5-aae4-430e-9c3d-4df2449cbd57
  modified: 2026-07-21T17:04:02.681Z
---

**No hay base de test separada: `DATABASE_URL` apunta a la MISMA base que sirve a los usuarios.** Varios tests de integración insertan filas con `cliente_id` inventados. Los de AFIP limpiaban lo suyo con una fixture; los de MercadoPago nunca lo hicieron.

**Al 2026-07-21 había 552 filas huérfanas** (300 `mp_credentials`, 215 `mp_payments`, 11 `afip_credentials` —incluidos certificados de PRODUCCIÓN de los spikes—, más perfiles y comprobantes).

**El costo no fue el espacio.** Al verificar el rename de la llave Fernet muestreé 3 credenciales al azar, me tocaron todas de test (cifradas con llaves efímeras de `monkeypatch`), dio "0/3 descifradas" y estuve por diagnosticar un bug de cifrado inexistente. Ver [[instrumentos-que-confirman-en-vez-de-verificar]].

**El riesgo real es otro:** los tests escriben en la tabla que el worker LEE en producción. Hoy los UUID aleatorios no colisionan; nada lo garantiza.

**Fix (fixture de sesión en `apps/copiloto/conftest.py`):** barre al terminar lo que quedó huérfano, con **DOS** condiciones — (1) `cliente_id` sin tenant real Y (2) creada DESPUÉS de que arrancó esta corrida (`SELECT now()` de la BASE, no el reloj local). **La segunda es la que importa**: sin ella sería un DELETE masivo automático contra la base productiva disparado por correr tests, y bastaría con borrar un tenant para que la siguiente corrida se llevara puestos sus datos históricos.

Verificado: 471 tests → **0 huérfanas nuevas** (antes cada corrida dejaba decenas).

**Limpieza de lo acumulado:** `deploy/copiloto/limpiar_residuos_test.py`, **dry-run por defecto**, `--ejecutar` para borrar. Criterio: "no existe en `uc_factory.tenants`". Lista al final lo que queda por tenant real, para poder mirarlo antes y después.

**Solución de raíz PENDIENTE (es infra, escalada al operador):** schema o base separada para tests. La fixture es la red de seguridad, no el reemplazo de que cada test limpie lo suyo.

[[tests-se-corren-en-vps]] [[copiloto-facturacion-afip]] [[cero-deuda-no-gestionada]]
