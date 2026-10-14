# Veredicto de la fila `caida` — divergencias 3, 4 y 5 (frontend2, brazo cáscara)

**Contrato:** `2026-10-13_contrato_planificacion-a-frontend2_caida-sus-3-sin-veredicto-cierran-sin-codigo-…`
**Medido sobre:** `origin/main` `79a6141a` (código; #2 re-medida sobre `11ce79ae`) y `prototipo/index.html` (lectura de código; **no** se midió en device).
**No mueve el padrón** (DEC-18): aporta veredictos con cita; la fila cambia de clase cuando el medidor la relee.

Convención del brazo cáscara: `R` = resuelta en código · `E` = enmienda con autoridad · `D` = ⛓ depende de otra
capa · `P` = ⚠ no medible.

> ⚠️ **Formato leído por máquina.** `scripts/evidencia/medir-mapeo-implementacion.py` lee **toda** tabla de este
> archivo como `| fila | divergencia | veredicto |`. La única tabla es la de abajo; el resto va en listas.

## 1. Veredicto por divergencia

| fila | divergencia | veredicto |
|---|---|---|
| `caida` | #5 el chip pierde la variación y conserva la fecha de corte | **R** `packages/core/src/midia/caja.ts:55` (`incompleta === true ? null : …`) · test `caja.test.ts:59` devuelve `'Al 19 de agosto'` sin variación · mismo criterio del prototipo `index.html:3647-3648` |
| | #4 copy del aviso de la portada distinto | 🔁 **duplicada**, sin residuo propio: las tres piezas del prototipo (`index.html:3657-3659`) ya tienen dueño — «Te aviso» = #1 (enmendada, promete un push medido en 0) · «Se cayó · hora» = #2 · «Reconectá Mercado Pago» = `AVISO_CAJA_INCOMPLETA` (`caja.ts:62-71`) |
| | #3 rótulo «En caja» vs «Entró esta semana» | **E** E10, §2 — la cifra es `caja.saldo` (un saldo al corte), no un flujo: retitularla «Entró esta semana» rotularía mal la cantidad y repetiría la celda «Entró» del trío; el faltante se DICE con palabras nombrando Mercado Pago |
| | #2 kv «Se cayó · hora» | **R** `apps/copiloto/mi_dia_presentacion.py:283-290` (`_conexion_caida` emite `("Se cayó", …)` sólo con el instante real de `datos["desde"]`, nunca con `creada`) · test `apps/copiloto/tests/test_mi_dia_presentacion.py:183,186,188` (hoy / ayer / otra fecha) y `:199` (sin instante ⇒ sin fila) · la app lo pinta genérico por `presentacion.kv` (`PantallaMiDia.tsx:707`) sin tocarse · en main `11ce79ae` (#1124); sin desplegar y sin medir en device, §3 |

## 2. #3 — la enmienda E10, con su motivo y su punto discutible

- **Qué hace el prototipo** (`index.html:3642-3650`, rama `ver === 'caida'`): retitula el rótulo a «Entró esta semana»,
  oculta el delta (`.p-delta`) y muestra `#p-parcial`. Tres cosas juntas con un solo motivo escrito: *«mejor no
  decirlo que decirlo mal»*.
- **Qué hace la app:** conserva «En caja» (`PortadaNegocio.tsx:37` mobile · `:41` web), **no** dibuja la variación
  (`caja.ts:55`, ya #5) y **agrega** el aviso `AVISO_CAJA_INCOMPLETA`: *«Se cayó la conexión con Mercado Pago:
  faltan los cobros de hoy, así que estos números pueden estar incompletos.»* (`midia-portada-incompleta`, con test
  en mobile `PortadaNegocio.test.tsx:49` y web `PortadaNegocio.test.tsx:41`).
- **Motivo de la enmienda (el que el contrato no tenía):** la cifra del bloque es `portada.caja.saldo`
  (`PortadaNegocio.tsx:37` mobile · `:43` web), un **saldo con fecha de corte** — el chip conserva «Al 19 de agosto». «Entró esta
  semana» nombra **otra cantidad** (un flujo) y ya existe en la portada como la celda «Entró»
  (`portada.mes.ingresos`, `PortadaNegocio.tsx:49` mobile · `:32` web). Retitular el saldo con el rótulo de un flujo cambia el **qué**
  se dice del número, no sólo el **cuánto de seguro**: dejaría un rótulo falso en vez de un número dudoso. En
  nativo el trío deja explícito que son tres cantidades distintas.
- **Regla dura que lo ampara:** *«el dato que falta se DICE, no se disfraza»* — el aviso dice qué falta y dónde
  reconectar, que es más que retitular.
- ⚠️ **Dónde es discutible:** «En caja» sobre un saldo incompleto sigue afirmando un saldo. Lo atenúan el chip de
  fecha de corte y el aviso inmediatamente debajo; si la lectura del operador es que eso igual miente, la
  alternativa es **una línea** (`rotulo={incompleta ? 'Saldo al corte' : 'En caja'}`) — **no** «Entró esta semana»,
  por lo dicho arriba. Decisión de rótulo = TÁCTICA de dueño; no la escalo.
- **Paridad web:** el mismo `chipDeCaja` y `AVISO_CAJA_INCOMPLETA` del core (`apps/copiloto-web/…/PortadaNegocio.tsx:1,37,52`)
  y «En caja» en `:41`; `Entró esta semana` → **0** en `apps/mobile/src` y **0** en `apps/copiloto-web/src`
  (control positivo: `En caja` → 1 y 1). Una sola enmienda, no dos.

**E10 · fila `caida`, #3:** «En caja» se mantiene con el aviso de faltante; no se retitula a «Entró esta semana»
porque la cifra es un saldo. Cita: `caja.ts:55,62-71` · `PortadaNegocio.tsx:37-45` mobile / `:37-52` web ·
prototipo `index.html:3642-3659`.

## 3. #2 — qué cerró y qué falta medir

- **Estaba en `D`** (la fila la llevaba el presentador del backend, no la app). **Ya no:** #1124 (`11ce79ae`)
  hizo que `_conexion_caida` (`apps/copiloto/mi_dia_presentacion.py:283-290`) lea `datos["desde"]` y emita el kv
  «Se cayó» con el momento en palabras (`Hoy, 09:12` / `Ayer, 19:20` / `12 de septiembre, 12:00`). Con instante
  ausente o ilegible la fila se **omite**; nunca se rellena con `creada`, que es cuándo corrió el detector.
- **La app no se tocó**, como decía este documento: pinta cualquier `presentacion.kv`
  (`PantallaMiDia.tsx:707` mobile · `MidiaScreen.tsx:386-390` web). Leer `datos.desde` en la app habría reintroducido
  la tabla regla→campo que H12/DETALLEKV §2 retiró.
- **Qué falta y de quién:** el sha vivo (`/healthz` = `47c09040`) es anterior a `11ce79ae`; hasta el deploy el kv
  no se ve en el teléfono. La medición en device es de frontend2 y se hace en un solo pase con `destino` de H5B y el
  DoD 6 de H12, cuando backend despliegue.
- El dato en prod (`git merge-base --is-ancestor 45a57eb5 47c09040` → sí) sigue valiendo: sólo MercadoPago trae
  instante real (`reauth_desde`); Composio o sin instante → ausente, no `None`.

## 4. Qué NO acredita este documento

- No es una medición en device: #3 y #5 son lectura de código y de tests; el brazo `device` de `caida` no existe.
- No compara `#p-parcial` con `midia-portada-incompleta` elemento por elemento: cuento que los dos existen y dicen
  la misma cosa en esencia, no que sean idénticos pixel a pixel.
- No es una medición en device de #2: está **resuelta en código y probada por test del backend**, sin desplegar.
  Si el instrumento la cuenta como cumplida, es por el DoD de la fila (el elemento existe en el código que ya
  existe), no porque se haya visto en pantalla.
- La clase de la fila la mueve el medidor al releer este archivo, no este texto (DEC-18).
