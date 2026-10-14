# Veredicto de la fila `caida` — divergencias 3, 4 y 5 (frontend2, brazo cáscara)

**Contrato:** `2026-10-13_contrato_planificacion-a-frontend2_caida-sus-3-sin-veredicto-cierran-sin-codigo-…`
**Medido sobre:** `origin/main` `79a6141a` (código) y `prototipo/index.html` (lectura de código; **no** se midió en device).
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
| | #2 kv «Se cayó · hora» | **D** §3 — el dato existe y está en prod (`datos.desde`, `mi_dia_detector.py:290`); falta que el **presentador** del backend lo emita como kv (`mi_dia_presentacion.py:268`); la app ya pinta cualquier `presentacion.kv` y no puede leer `datos.desde` sin armar la tabla regla→campo que H12 prohíbe |

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

## 3. #2 — lo que queda abierto, y por qué no es una línea de la app

- El contrato del dato **está cumplido y en prod**: `git merge-base --is-ancestor 45a57eb5 47c09040` → **sí**
  (el commit que introduce `datos["desde"]` está en el sha vivo `47c09040`). Backend lo emite sólo con instante
  real (MercadoPago vía `reauth_desde`); Composio / sin instante → ausente, no `None`.
- **Lo que no existe es el kv.** `_conexion_caida` (`apps/copiloto/mi_dia_presentacion.py:268-271`) arma
  `kv = [("Servicio", nombre)]` y la prosa «Se cortó la conexión con …»; **no** lee `datos.desde`.
- **Por qué la app no lo lee ella:** el contrato H12/DETALLEKV §2 dice que *la app no arma la tabla regla→campo*;
  el detalle es la lista que resuelve el backend. Leer `datos.desde` en `miDia.ts` y componer «Se cayó · hora» en la
  app reintroduciría exactamente la tabla fija que H12 retiró. La app **ya renderiza** cualquier `presentacion.kv`
  (`PantallaMiDia.tsx:707` mobile · `MidiaScreen.tsx:386-390` web), así que el cambio completo es **una fila en el
  presentador** más su test — y la app no necesita tocarse.
- **Prohibido rellenarlo con `creada_en`** (el contrato lo dice y es correcto: sería la hora en que se creó la
  tarjeta, no la de la caída).
- Dueño: backend (`apps/copiloto/**` es de su capa). Disparador: `pedido_` a backend con el formato
  (`Hoy, 9:12` / fecha si no es hoy — el presentador ya recibe `hoy`) y DoD binario. Medición en device: frontend2,
  tras el deploy de ese presentador.

## 4. Qué NO acredita este documento

- No es una medición en device: #3 y #5 son lectura de código y de tests; el brazo `device` de `caida` no existe.
- No compara `#p-parcial` con `midia-portada-incompleta` elemento por elemento: cuento que los dos existen y dicen
  la misma cosa en esencia, no que sean idénticos pixel a pixel.
- No mueve la clase de la fila `caida`: con #2 en `D` (⛓) la fila sigue **PENDIENTE-DECLARADA** — es lo correcto.
