---
name: usuario-de-prueba-canonico-uno-solo-a-fuego
description: REGLA DURA — hay UN solo usuario de prueba canónico para todo trabajo de device/E2E, documentado a fuego, para que ningún agente invente ni elija mal. Canónico = e2e-device@copiloto.test (cliente_id 4f3ecb78-...), el target §1 del harness de backend, limpio/vacío. NUNCA crear usuarios de prueba ad-hoc
metadata:
  type: project
---

**Usuario de prueba canónico (el ÚNICO para device/E2E):**
- **Email:** `e2e-device@copiloto.test`
- **cliente_id:** `4f3ecb78-2e36-4044-a56e-0e7ef6c4a655` (= `composio_user_id`).
- **auth_user_id:** `e0cbce79-a20d-4b28-8ea0-74a6e1bc7707`.
- **Credencial (password):** en **`.env.e2e`** (raíz del repo, gitignored por el patrón `.env.*` — no
  trackeado, verificado con `git check-ignore -v`). NUNCA en el repo trackeado ni en la memoria.
- **graph_id / tenant de grafo:** NO hay columna `graph_id` persistida en `uc_factory.tenants` — se
  **deriva**, no se guarda (`apps/copiloto/memory_provider.py`). User graph (chat/memoria general) =
  `copiloto-4f3ecb78-2e36-4044-a56e-0e7ef6c4a655` (`f"{namespace}-{cliente_id}"`, namespace="copiloto").
  Group graph de función (BI/negocio, hermano del chat) = `f"{namespace}-{function}-{cliente_id}"`. El
  scoped `copiloto` de [[graphity-tenant-dedicado-y-ontologia-scoped]] es el tenant Graphity (la key), no
  el `graph_id` — son ejes distintos.

**Por qué ESTE y no otro:** es el target del **§1 del harness de backend** (confirmado por backend
2026-07-23 12:17), está **limpio/vacío** (ideal para contar estado esperado en el E2E sin ruido), y fue
creado a propósito para esto. Los otros tenants de prueba que aparecieron el 2026-07-23 —
`pruebas-facturacion@copiloto.test` (`19af5a42`, con 24 comprobantes AFIP + 1 cliente),
`e2e-frontend@copiloto.test` (`e2e7e57e`), y uno viejo `add-69e7b8f2@beta.local`— **NO son el canónico**;
existen por historia, no se usan para el E2E de device.

**Why:** el 2026-07-23 hubo 4 tenants de prueba distintos y el device entró con uno (`pruebas-facturacion`)
mientras backend logueaba otro (`e2e-device`) y el login no reemplazaba el token — enredo de ~media hora,
más un susto de "datos desaparecidos" que en realidad era cache cross-tenant sin scope
([[el-mensaje-niega-el-efecto-que-ya-ocurrio]] / fix en PR#79). La ambigüedad de "cuál usuario" es
exactamente el margen donde los agentes alucinan y se pierde tiempo. Cero margen de error: UN usuario, fijo,
documentado. [[device-fisico-exige-dueno-unico]] [[build-local-por-usb-es-la-metodologia-nunca-la-nube-para-iterar]]

**How to apply:** todo trabajo de device / E2E usa **exclusivamente** `e2e-device@copiloto.test`. El teléfono
**siempre debe estar logueado en este usuario** — si muestra otro, se hace logout+login limpio a este (el
motivo por el que el login no "tomaba" era el leak cross-tenant de `AsyncStorage`, arreglado en PR#79).
**PROHIBIDO crear usuarios de prueba ad-hoc** o elegir "el que esté a mano": si no es el canónico, es un
error. La credencial se toma del lugar reproducible del harness, no se inventa ni se pide de nuevo. Cambiar
el usuario canónico es MAYOR: se decide y se re-documenta acá, no se asume.
