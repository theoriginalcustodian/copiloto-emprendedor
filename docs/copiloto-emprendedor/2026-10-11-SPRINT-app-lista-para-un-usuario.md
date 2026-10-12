# Sprint «app lista para un usuario» — backlog medido

> **Fecha:** 2026-10-11 · **Pedido del operador:** *«quiero que el sprint sea app lista para un
> usuario»* · **Estado:** propuesta de alcance. **No declara el sprint abierto** — lo abre el operador.
> **Plataforma:** Android. iOS **no existe** como target (`app.json` sin clave `ios`, `eas.json` sólo
> `android.buildType`; relevamiento mobile §Z).

---

## §0 · Inventario de lo que YA existe (canon 3 — leer antes de escribir una línea)

| Artefacto | Qué aporta a este sprint | Qué NO aporta |
|---|---|---|
| [`Auditorias/2026-10-09-relevamiento-codigo-cierre.md`](Auditorias/2026-10-09-relevamiento-codigo-cierre.md) | 60 hallazgos de código con `path:línea` y clase de trabajo | No mira el teléfono. 1 fila cita `apps/mobile` |
| [`Auditorias/2026-10-11-relevamiento-mobile-cierre.md`](Auditorias/2026-10-11-relevamiento-mobile-cierre.md) | 62 hallazgos mobile · eje B **21/21 montan** · binario medido | Mide **pantallas y gestos**, no cadenas de negocio |
| [`2026-10-08-ARRANQUE-sprint-mobile.md`](2026-10-08-ARRANQUE-sprint-mobile.md) | Cola `M-00..M-04` ya bajada, con recetas de device | Su objetivo es **paridad con la spec** (54 ids), no «lista para un usuario» |
| [`Auditorias/2026-10-08-BL-Q5-matriz-pantallas-re-medida-92fd8a06.md`](Auditorias/2026-10-08-BL-Q5-matriz-pantallas-re-medida-92fd8a06.md) | El padrón: **web 54/54 · mobile 13/54** | Es cobertura de veredicto, **no** «54 pantallas pasan» |
| [`2026-10-06-lo-que-espera-tu-decision.md`](2026-10-06-lo-que-espera-tu-decision.md) | Las decisiones abiertas del operador | — |
| `scripts/evidencia/criterio3-{padron,cruce}.sh`, `contar-veredictos.py` | Instrumentos del padrón | **Ninguno lista los ids que faltan en mobile** (`M-00`) |

**Lo que este documento agrega y no estaba en ninguno de los dos relevamientos:** las **6 cadenas de
negocio** medidas de UI a backend, la **primera ejecución** de la suite mobile, y el estado del
ingreso del usuario a la app.

---

## §1 · Por qué este sprint no es el que estaba bajado

El `ARRANQUE` del 08/10 define el sprint mobile como **cerrar 41 ids de paridad con el prototipo**.
Eso responde *«la app se ve como la spec»*. El pedido del operador es otra pregunta: **que un
emprendedor haga su trabajo desde el teléfono y los números que ve sean ciertos**.

Las dos colas se solapan poco, y **la segunda contiene todo lo de dinero**. Un sprint que cierre
54/54 de paridad puede entregar una app donde cada pantalla coincide con el prototipo **y** el mismo
cobro se cuenta dos veces. No es hipotético: está medido abajo.

➡️ **Decisión del operador:** este documento asume la segunda definición. Si quiere las dos, son dos
sprints, y el orden correcto es éste primero (la paridad visual de una pantalla que miente no sirve).

---

## §2 · DoD binario del sprint — propuesta

**Un emprendedor real, en su teléfono, con su propia cuenta, sin que ningún agente le toque la base:**

| # | Criterio | Verde cuando |
|---|---|---|
| 1 | **Entra** | se da de alta y entra sin intervención manual en la DB ni en una env var |
| 2 | **Factura** | emite una factura real y ve su CAE en «Mis comprobantes» |
| 3 | **Anula** | emite la nota de crédito, y esa NC **no** vuelve a ofrecer «Anular» |
| 4 | **Cobra** | registra un cobro —manual y por MercadoPago— y lo ve **una** vez, en Ingresos **y** en los números |
| 5 | **Gasta** | registra un gasto y lo ve en la lista |
| 6 | **Ve sus números** | portada y detalle dan **la misma** cifra para el mismo mes |
| 7 | **Conversa** | dicta, el copiloto le propone una card, la confirma, y la card queda resuelta |
| 8 | **Evidencia** | los 7 anteriores **en device**, con el usuario canónico, y el hallazgo entra como fila |

**Criterio de cierre:** 8/8 binario. Un criterio sin evidencia de device es rojo, no amarillo
(regla dura del repo: lo táctil se mide en el teléfono).

---

## §3 · Lo medido hoy, 2026-10-11

### 3.1 · La buena noticia: el código mobile no está roto

**Primera ejecución de la suite mobile** (hasta hoy sólo se había *leído* el código de los tests —
`node_modules` no existía en el worktree del relevamiento, §Z):

```
Test Suites: 1 failed, 1 skipped, 106 passed, 107 de 108
Tests:       4 failed, 1 skipped, 986 passed, 991 total
tsc --noEmit: 8 errores
```

**986 de 991 pasan.** Los 4 rojos y los 8 errores de tipos caen **todos** en
`PantallaFacturacion.{tsx,test.tsx}` — el trabajo en vuelo de otra sesión en el checkout compartido.
Medido el signo antes de atribuirlo: el `.tsx` del working tree es **idéntico a `origin/main`** y
`HEAD` tiene +102 líneas, o sea el archivo está **atrasado** respecto de la rama y el test nuevo
espera una firma que el código viejo no tiene. **No es un defecto de `main`.**

⚠️ **Pero verde no es «funciona»:** 52 de los 112 tests reemplazan la capa de contrato (§7 del
relevamiento mobile), y ninguno corre en el teléfono. El problema de mobile **no es código roto: es
código no ejercitado donde el usuario lo usa.**

### 3.2 · Las 6 cadenas de negocio, de UI a backend

Medido por lectura del código siguiendo el import real, no por nombre de archivo.

| Flujo | Veredicto | Eslabón más débil | Entrada |
|---|---|---|---|
| 1 · Emitir factura y ver CAE | `CADENA_COMPLETA` | `PantallaFacturacion.tsx:352` llama `crearFactura(cuit, clave)` y `packages/core/src/api/afip.ts:795` declara 1 arg: el 2º **se descarta** y mobile nunca manda `idem_key` (`afip_web.py:122-127`) ⇒ sin idempotencia en el reintento | Funciones → tile Facturación |
| 2 · Anular / nota de crédito | `CADENA_COMPLETA` con defectos | `SeccionMisComprobantes.tsx:157-182` `try/finally` **sin `catch`** ⇒ si falla, **no muestra nada**; y `:26-28` ofrece «Anular» sobre una NC | Facturación → Mis comprobantes |
| 3 · Cobrar (incl. MercadoPago) | 🔴 `CADENA_CORTADA` | `cobro_store.py:325-380` leen sólo `copiloto_cobros`; los pagos MP viven en `mp_payments` ⇒ **un cobro MP no aparece en Ingresos** | Funciones → tile Ingresos |
| 4 · Registrar gasto | `CADENA_COMPLETA` | sin ruptura hallada (`gastos_web.py:126`) | Funciones → tile Gastos |
| 5 · Ver mis números | `CADENA_COMPLETA` | `PortadaNegocio.tsx:49-51` muestra Entró/Salió/Por cobrar/En caja y **no Facturado** (vive un nivel adentro) | Mi día (capa base) |
| 6 · Chat, voz y card HITL | `CADENA_COMPLETA` | `web.py:122,718`: el motor elige por `COPILOTO_ENGINE_MODE`, **default `dispatch`**, y el valor de prod no está en el repo. **Medido en el proceso vivo hoy: `react` en web y en worker** ⇒ las cards propuestas son alcanzables y el criterio 7 **no** está bloqueado por esto | gesto a `PanelDeslizable` |

### 3.3 · El estado del device

- **Eje B: 21/21 montan** con su testID, ninguna `NO_ATRIBUIBLE`. Acredita render, nada más.
- **Eje A (¿se llega tocando?): 1 de 6 verificado** — `/facturacion` llega; 5 casillas quedan
  `NO_ATRIBUIBLE`. **Y 15 de las 21 pantallas no tienen eje A medido en absoluto.**
- **El escritorio cuesta al menos dos gestos** y su docstring promete uno: `H-60` el toque abre
  **4 de 6** ciclos, `H-62` el primer arrastre se pierde **3 de 3**.
- **`/midia` («Mi día») no se alcanza navegando** — 0 call-sites de producción con 3 instrumentos que
  coinciden; sólo por deep link (`H-10`). Es la pantalla de los números.
- **9 pantallas cuelgan de un solo archivo** (`H-11`): `ajustes.tsx` es el único camino a 5 rutas, y
  `/ajustes` sólo se alcanza desde el avatar (`PantallaMiDia.tsx:521`). Si ese botón cae, **caen 6
  pantallas en bloque** y el medidor del primer salto seguiría diciendo que todo está bien.

---

## §4 · Los frentes — con dueño y DoD binario

Orden por dependencia, no por severidad. **Los ids `F*` son nuevos; los `M*` ya existían en el
ARRANQUE del 08/10 y se reusan sin renumerar.**

### 🔴 F0 · Hoy un usuario no puede entrar — bloqueante absoluto

Sin esto, los otros siete criterios son inverificables con un usuario real.

| id | trabajo | dueño | DoD binario |
|---|---|---|---|
| **F0.1** | El alta: `COPILOTO_SIGNUP_ALLOWLIST` es **fail-closed** (`apps/copiloto/web.py:581-583`) — sin esa env no entra **ningún** email, ni por Google. **Medido en el proceso vivo hoy: la allowlist tiene 4 emails y los 4 son del operador.** Un usuario externo **no entra**, y sumarlo es editar una env var en el VPS + `systemctl restart` (el propio `deploy.sh:239` lo documenta como receta manual) | backend + **decisión del operador** | un email nuevo completa el alta sin que nadie edite una env var ni la DB |
| **F0.2** | El alta por email de **web** no se puede completar: el backend exige `invite_token` y el cliente nunca lo manda; el form sólo abre con `?signup=1` (fila 19) | backend + frontend | alta por email de punta a punta, con test del camino real |
| **F0.3** | **Mobile no tiene aceptación legal**: `NO_EXISTE` (fila 18). Y la aceptación **no condiciona nada** en ninguna plataforma | frontend2 (hay rama en vuelo `fe2/bl-o6-legal-*`) + **texto del operador** | un alta nueva no puede operar sin aceptar, y mobile tiene la pantalla |
| **F0.4** | **Sin SMTP** no hay recuperación de contraseña ni cambio de mail (`cuenta` = `DESVÍO` confirmado 2×) | backend + **proveedor que elija el operador** | el usuario recupera su clave sin intervención |

### 🔥 F1 · El dinero miente — una raíz por síntoma, no un parche por pantalla

| id | trabajo | dueño | DoD binario |
|---|---|---|---|
| **F1.1** | **MercadoPago vive en la tabla equivocada.** Un mismo cobro MP se cuenta **cero veces en Ingresos** (`cobro_store.py:325-380` leen sólo `copiloto_cobros`) y **dos veces en «Entró»** (`mp_web.py:53-71` escribe en las dos tablas que el `UNION ALL` de `inteligencia_queries.py:43-49` une). **Dos síntomas opuestos, una sola raíz de modelo de datos** | backend | el mismo cobro MP aparece **una** vez en Ingresos y **una** en «Entró», con test que inserta un pago MP y cuenta |
| **F1.2** | **Ninguna fila vale `nota_credito`**: el alta toma `estado` default `emitida` (`afip_comprobante_store.py:24,34`) y las dos llamadas que registran una NC no lo pasan. **Es la raíz de tres síntomas** y va **primero** | backend | una NC registrada tiene `estado='nota_credito'`, con test que inserta una y lo lee |
| **F1.3** | Consecuencia de F1.2: las dos UIs ofrecen **«Anular» sobre una nota de crédito** (fila 13) | backend + ambos fronts | la fila de una NC no ofrece Anular; test con **dos** comprobantes, uno `emitida` y uno `nota_credito` |
| **F1.4** | Consecuencia de F1.2: **«lo facturado» da −X y +X para el mismo mes** (`afip_comprobante_store.py:186-190` resta, `inteligencia_queries.py:118-126` suma) y hay **cuatro predicados** para la misma cifra, más un quinto que trae NC como deuda sin el tipo (filas 14 y 59) | backend | **un** predicado, citado por los 4 consumidores; el mismo mes da la misma cifra en portada, detalle, BI y facturación |
| **F1.5** | **La NC se emite sin número reservado** → el camino que el propio comentario llama «dos CAE por un solo pedido» (`afip_anulacion_workflow.py:116-120` vs `afip_factura_workflow.py:287-297`). **El fix ya existe en el otro call-site: portar, no diseñar** (filas 15/58) | backend | `AnulacionWorkflow` reserva; el test de doble emisión de la NC deja de estar verde a propósito |

### ⚠️ F2 · La app promete lo que no hace

| id | trabajo | dueño | DoD binario |
|---|---|---|---|
| **F2.1** | Un **Responsable Inscripto** lee «ya podés facturar» y el motor le levanta `NotImplementedError` al emitir: `puede_facturar = bool(creds) and bool(perfil)` **no mira la condición IVA** (`afip_web.py:635`, `afip_rules.py:302-306`) (filas 16/52) | backend + ambos fronts | o se emite A/B, o la UI **no ofrece** RI y `/afip/estado` devuelve la condición |
| **F2.2** | Las cards de **apps** anuncian capacidades podadas: Gmail ofrece «Leer mails» y «Buscar» con **una sola** tool viva; Calendar «Buscar turnos» sin tool (fila 11, `catalog.py:38-39`, `gmail.py:68`) | backend | el catálogo anuncia exactamente las tools vivas, con test que ata catálogo ↔ toolset |
| **F2.3** | Promesas sin rama: la **cartera se arma sola** (sólo un script a mano, fila 26) · la **ficha de cliente** muestra historial vacío fijo (`presupuestos: []`, fila 27) · el **modo ceremonia** se guarda y nada ramifica por él (fila 25) | backend | cada una: o se cablea, o la UI deja de prometerla. Decisión por ítem, no global |

### 📱 F3 · Lo que el usuario choca en el teléfono

| id | trabajo | dueño | DoD binario |
|---|---|---|---|
| **F3.1** | La **card HITL queda activa después de responderla**: `ChatView.tsx:149-153` descarta el `hitlMessageId` que la lista le pasa (fila 3, sólo mobile — web está bien) | frontend | la card resuelta no vuelve a aceptar toque; verificado en device |
| **F3.2** | La **card de ingreso** no llega a «resuelto» y, ante el 409 del duplicado, pinta **«No lo anotamos.»** sobre un ingreso que **sí quedó guardado** (fila 4, `TarjetaIngresoPropuesto.tsx:85-94`) | frontend | el ingreso completo se resuelve; el 409 dice que ya estaba anotado |
| **F3.3** | **Anular falla en silencio**: `try/finally` sin `catch` (`SeccionMisComprobantes.tsx:157-182`) | frontend | un fallo de anulación muestra el error |
| **F3.4** | **`/midia` no se alcanza navegando** (`H-10`) y la **portada no muestra Facturado** (`PortadaNegocio.tsx:49-51`) | frontend | decisión: o `/midia` tiene camino, o se retira del Stack y se borra el docstring que afirma lo contrario |
| **F3.5** | **El escritorio cuesta dos gestos y promete uno** (`H-60` 4/6, `H-62` 3/3, `PanelFunciones.tsx:85-105,126,132-140`): no hay `Gesture.Tap()` ni `Pressable`. ⚠️ **Invocar `swmansion-rn-gestures` antes de tocarlo** | frontend | el primer toque abre, medido con `adb input motionevent` en ≥5 de 5 ciclos con reset |
| **F3.6** | **Dos tokens bajo AA** medidos contra los fondos de mobile: éxito 4,23 · peligro 4,29 (fila 5) | frontend | ambos ≥ 4,5 contra su propio fondo |

### 🔬 F4 · Medir en device, que es lo único que cierra el sprint

| id | trabajo | dueño | DoD binario |
|---|---|---|---|
| **M-01** | Teléfono listo | **ya cumplido hoy** | binario `app.copiloto.emprendedor` `0.1.0` instalado 2026-10-11 17:53 (build `5e19949f`), device `RF8T318RN9T`, Metro vivo. **Nadie lo había declarado** |
| **F4.1** | Las **6 cadenas** del §3.2 ejercitadas en device con `e2e-device@copiloto.test`, una por una | frontend (dueño único del device) | 6 veredictos del vocabulario cerrado + su `medido_contra:` |
| **F4.2** | **Eje A de las 15 pantallas sin medir** + las 5 `NO_ATRIBUIBLE`. Requiere resolver primero `F3.5`: hoy el instrumento no separa «la ruta no responde» de «mi gesto se perdió» | frontend | 21/21 con veredicto de eje A, o la casilla declarada con su causa |
| **F4.3** | **Reconstruir el APK es hoy imposible de repetir**: EAS borra artefactos a los **14 días** y ya evaporó 12 builds; el `versionCode` es `1` en los 14 y la única identidad es el `gitCommitHash`, que vive en la plataforma que los borra (`H-02`, `H-03`) | backend | receta idempotente que reconstruye el dev-client desde un SHA, probada una vez |
| **F4.4** | **El checkout compartido impide medir mobile limpio** (§3.1) | planificación | la suite mobile corre en un worktree sobre `main` y su recibo cita el SHA |
| **M-00** | El filtro `--plataforma` del cruce (sigue **sin hacer**: 0 coincidencias en `criterio3-cruce.sh`) | quien tome el padrón | **sólo si el operador mantiene el padrón de 54 ids como criterio de cierre.** Si el cierre es el DoD de §2, `M-00` no tiene disparador |

---

## §5 · Lo que NO entra, para no re-litigarlo

| bloque | por qué |
|---|---|
| **35 de los 60 hallazgos de código** | Son instrumento ciego (17), evidencia que no toca producción (7) y duplicación interna (3). Reales como deuda, **invisibles para el usuario**. Arreglarlos no mueve ningún criterio del §2 |
| **Re-medir `web`** | Está 54/54 y mergeado. Re-medir «por las dudas» es trabajo sin disparador |
| **iOS** | No hay target que medir |
| **Paridad visual de las 41 ids** | Es el otro sprint (§1). Un hallazgo de paridad **se anota, no se arregla** |
| **Rotar secretos** | Diferido a pre-prod por decisión del operador |
| **Renombrar `applicationId` a Odobi** | Crea un paquete nuevo y pierde la instalación: decisión MAYOR, no requisito |

---

## §6 · Lo que espera tu decisión antes de arrancar

| # | Qué | Bloquea | Qué necesito |
|---|---|---|---|
| 1 | **Cómo entra un usuario**: beta por invitación (allowlist con UI para cargarla) **o** alta abierta | `F0.1` y con él los 8 criterios | una de las dos |
| 2 | **Texto legal definitivo** | `F0.3` | el texto, **o** «sale con el aviso puesto» |
| 3 | **Proveedor SMTP + DNS** | `F0.4` | el nombre del proveedor |
| 4 | **¿El padrón de 54 ids sigue siendo criterio de cierre?** | `M-00`, `F4.2` | sí / no. Si no, `M-00` se retira |
| 5 | **Alcance de `F2.3`**: cablear la capacidad o retirar la promesa, ítem por ítem | `F2.3` | por ítem, o «retirar todo lo que no esté cableado» |

**Los cuatro primeros son los mismos que ya estaban abiertos desde el 2026-10-06**; este documento
sólo mide qué bloquean.

---

## §7 · Hallazgos nuevos de esta medición (no estaban en ninguno de los dos relevamientos)

1. **El cobro MP contado 0 veces y 2 veces a la vez** (`F1.1`). El relevamiento de código tenía el
   doble conteo en «Entró»; nadie había medido que el mismo pago **no aparece** en Ingresos. Son dos
   caras de la misma raíz, y verlas juntas cambia el fix: no son dos filas, es una.
2. **La suite mobile nunca se había ejecutado** y está en 986/991 (§3.1).
3. **`M-01` estaba cumplido sin declararse** — el sprint arranca con el teléfono listo.
4. **`crearFactura` se llama con un argumento que el core descarta** (`PantallaFacturacion.tsx:352`):
   funciona en runtime, y con él se descarta la clave de idempotencia.
5. **El modo del motor en producción no es verificable desde el repo** (`COPILOTO_ENGINE_MODE`,
   default `dispatch`): las cards propuestas dependen de `react`. Si prod corriera `dispatch`, el
   criterio 7 del DoD **no puede pasar** — y nadie lo sabría leyendo el código.
   **✅ Cerrado el mismo día, con un comando:** `tr '\0' '\n' < /proc/<PID>/environ` sobre el proceso
   vivo da `COPILOTO_ENGINE_MODE=react` en **web y worker**. El criterio 7 no está bloqueado. La
   lección queda: una propiedad que decide un criterio y vive **sólo en el ambiente** no se deduce
   del código — se mide en el proceso, y cuesta un comando.
6. **La allowlist de producción tiene 4 emails, y los 4 son del operador.** El `ARRANQUE` del 08/10
   decía «un solo email habilitado»: medido, son cuatro. Ninguno pertenece a un usuario real, así
   que **el criterio 1 del DoD hoy es rojo por configuración, no por código**.
