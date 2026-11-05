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
documentado. [[device-fisico-exige-dueno-unico]]

**How to apply:** todo trabajo de device / E2E usa **exclusivamente** `e2e-device@copiloto.test`. El teléfono
**siempre debe estar logueado en este usuario** — si muestra otro, se hace logout+login limpio a este (el
motivo por el que el login no "tomaba" era el leak cross-tenant de `AsyncStorage`, arreglado en PR#79).
**PROHIBIDO crear usuarios de prueba ad-hoc** o elegir "el que esté a mano": si no es el canónico, es un
error. La credencial se toma del lugar reproducible del harness, no se inventa ni se pide de nuevo. Cambiar
el usuario canónico es MAYOR: se decide y se re-documenta acá, no se asume.

**Filas BASURA conocidas en el tenant canónico (no son un gasto/cobro real; no las cites al medir):**

- **2026-10-15 — gasto `$1.234,00` «gaste 1234 en librería»** + voz «Música» + «cuánto vendí esta semana». Los escribió un gesto de
  voz de la pasada de device15 (soltar sin fijar **envía**, H7; el STT transcribió audio ambiente). Hoy no hay `DELETE` de gastos
  (`packages/core/src/api/index.ts:156`, «Sin PATCH/DELETE en Fase 1»), así que **no se borró**: se anota acá y en
  `Auditorias/…/2026-10-13-veredictos-device15-15-filas.md` (enmienda 2). Ese mes el «Salió» sube de $50.000 a $51.234; el «Salió» de
  $111 `BLQ3-recibo` y el de $50.000 «Distribuidora Sur» también son de pruebas anteriores.
- **Prevención:** en un gesto de voz **sin intención de enviar**, soltar a >80 dp (fija) y descartar con el tacho; soltar corto
  envía lo que el micrófono haya oído.


## Ampliación por ficha (SM-N15, 2026-11-02): un SEGUNDO usuario, sólo para SM-K1 y SM-J3

El operador aprobó (*«creamos segundo usuario de prueba»*) un usuario **no-admin con tenant VACÍO**, porque
`SM-K1` (menos privilegios) y `SM-J3` (menos datos) necesitan lo **contrario** de lo que el canónico puede
ser. **El canónico sigue siendo `e2e-device@copiloto.test`** — esto es ampliación por ficha, no reemplazo.

- **Email:** `e2e-vacio@copiloto.test` · **cliente_id:** `d292192d-1d88-43e0-92d4-093e5aca9214`.
- **Credencial:** en `.env.e2e` (claves `E2E_VACIO_*`), igual que el canónico. NUNCA en el repo ni en la memoria.
- **Alta y verificación (idempotente):** `scripts/provision_usuario_vacio_sm_n15.py` — no-admin con test adversarial
  (`/admin/*`: 401 sin token, 403 con el token del usuario), tenant vacío con control positivo (0 vs canónico
  3/4/14/40 en clientes/comprobantes/gastos/presupuestos) y cross-tenant (comprobante ajeno → 404).
- **Todo uso fuera de `SM-K1`/`SM-J3` es MAYOR y vuelve al operador.** Para `SM-H3`, `SM-J4` y `SM-K6` el operador
  ofreció SU propio usuario; no se crean más cuentas.

## Ampliación 2026-11-03 — el SEGUNDO tenant quedó autorizado, el canónico NO se movió

El operador autorizó la **tenencia de prueba**: `scripts/provision_usuario_vacio_sm_n15.py` (idempotente,
con verificación adversarial propia) deja de estar limitado a `SM-K1`/`SM-J3` y vale para **toda ficha
que necesite un segundo emprendedor** (hoy `SM-J3 J4 K3 K5 K6 N16 N29 N30`).

**La distinción que hay que no colapsar:** autorizar un **segundo** tenant no es **mudar** el canónico.
`e2e-device@copiloto.test` sigue siendo el único canónico y cambiarlo sigue siendo MAYOR. Leer esta
ampliación como «ya se puede elegir usuario» sería exactamente el error que la entrada de arriba
previene — y es fácil, porque las dos cosas se dicen con la misma palabra («usuario de prueba»)
([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]).

**El provisioning ya existía** y lo encontró el inventario, no se diseñó de nuevo: alta por
`/auth/signup`, credencial a `.env.e2e` (gitignored — el repo es PÚBLICO), y tres controles
adversariales propios (no-admin con 403 vs 401, tenant vacío **con control positivo** contra el
canónico, y cross-tenant denegado). Corre **en el VPS**, nunca en la PC.

## Refuerzo 2026-11-05 — la regla estaba escrita acá y la pasada igual corrió con OTRO usuario

**Lo que pasó.** La pasada de device de `SM-P12` (2026-11-05 08:06, APK `ef143e95`) se corrió entera
con el teléfono logueado como **`e2e-onb@copiloto.test`**, no con el canónico. Nadie lo supo hasta el
final: el síntoma fue que Facturación mostraba «ARCA no configurada», y de ahí salió una cadena de
diagnóstico completa y equivocada — backend midió el gate con el usuario canónico y lo encontró
**verde**, yo leí el código y derivé una hipótesis de caché de CUIT
(`PantallaFacturacion.tsx:249-267`) con un test discriminante falsable, y frontend1 lo corrió. La
predicción falló. No porque el mecanismo esté mal: **porque la premisa «el sujeto es e2e-device» era
falsa**, y nadie la había medido. La caché no tiene defecto.

**Lo que esto NO es.** No es que faltara la regla: está escrita arriba, textual, desde el 2026-07-23
— *«el teléfono siempre debe estar logueado en este usuario — si muestra otro, se hace logout+login
limpio»*. Tampoco faltó el instrumento: la captura `cuenta.png` que lo probó la sacó frontend1 con lo
que ya tenía. **Lo que faltó es el ORDEN: la captura llegó al final, cuando ya había un síntoma que
explicar.** Una regla sin un paso que la verifique *antes* de medir no protege nada; sólo sirve para
reconstruir, después, por qué la medición no valía.

**Por qué el margen se ensanchó justo ahora.** Hoy hay **tres** usuarios de prueba
(`e2e-device`, `e2e-vacio`, `e2e-onb`) donde en julio había uno canónico y un enredo de cuatro. Cada
ampliación fue correcta por separado y ninguna cambió el canónico — pero «cuál está logueado en el
teléfono» dejó de ser deducible y pasó a ser un **hecho que hay que mirar**. El aviso de la
ampliación del 2026-11-03 («autorizar un segundo tenant no es mudar el canónico») cubría la
*elección*; esto es otra cosa: el **estado heredado** del dispositivo, que nadie eligió.

**El cambio concreto, no la intención:** el primer paso de cualquier receta de device es **capturar
la cuenta logueada**, y su resultado es precondición del resto — no un dato que se adjunta al
cierre. Si la captura no dice `e2e-device@copiloto.test`, no se mide nada hasta el logout+login.

**Lo que se conserva de esa pasada.** Los veredictos que no dependen del tenant (que el campo de Mi
día acepte texto, que un tema de «Cómo usar» llegue al chat, que el teclado tapara el campo) siguen
valiendo como observación. Lo que **no** son es evidencia sobre el usuario canónico, así que vuelven
a la próxima pasada. Lo mismo la medición de supervivencia de una card sin resolver: el control de
arranque en frío fue correcto y el hecho es real, pero el sujeto era otro
([[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]).