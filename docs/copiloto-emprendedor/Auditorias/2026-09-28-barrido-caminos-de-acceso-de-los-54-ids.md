# Barrido de caminos de acceso de los ids de BL-Q3 — 2026-09-28

> **Por qué existe.** El contrato de medición de BL-Q3 nombraba la **pantalla** (el id) y no el
> **camino de acceso** ni el **estado inicial**. Con un id alcanzable por dos caminos que muestran UI
> distinta, dos lecturas contradictorias son ambas «válidas» y ningún gate puede distinguirlas. El
> defecto es del contrato, que redactó planificación, no de la ejecución de quien midió.
>
> **Método.** Sub-agente read-only (`claude -p`), sobre `apps/copiloto-web/src/` y `apps/mobile/`,
> con tres controles positivos obligatorios horneados en el prompt: (a) re-encontrar `factura` con sus
> dos entradas de UI distinta, (b) re-encontrar las ~4 filas donde «+Nuevo» abre el formulario vacío
> mientras la card del chat monta el mismo formulario ya armado, (c) nombrar ≥2 ids de camino único.
> **Los tres se reprodujeron** → el barrido se declara confiable con los límites que él mismo escribe
> al final. Un barrido que marcara todo como multi-path no discriminaría y no serviría.
>
> **Resultado grueso:** 19 CAMINO-UNICO · 16 MULTI-PATH-UI-DISTINTA · resto MISMA-UI.
> No eran «4 filas más `factura`».

---

=== inicio 08:20:43 ===
Permission allow rule (C:\Users\Admin\.claude\settings.json): Write(C:\\Users\\Admin\\.claude\\*) is not matched by file permission checks — only Edit(path) rules are. Use Edit(C:\\Users\\Admin\\.claude\\*) instead (Edit rules cover all file-editing tools).
Permission allow rule (C:\Users\Admin\.claude\settings.json): Write(C:\\Users\\Admin\\AppData\\Local\\Temp\\arca-spikes\\*) is not matched by file permission checks — only Edit(path) rules are. Use Edit(C:\\Users\\Admin\\AppData\\Local\\Temp\\arca-spikes\\*) instead (Edit rules cover all file-editing tools).
Permission deny rule (C:\Users\Admin\.claude\settings.json): Write(//c/Proyectos/Claude/Claude code/copiloto-emprendedor/**/.env*) is not matched by file permission checks — only Edit(path) rules are. Use Edit(//c/Proyectos/Claude/Claude code/copiloto-emprendedor/**/.env*) instead (Edit rules cover all file-editing tools).
Warning: no stdin data received in 3s, proceeding without it. If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.
## Barrido BL-Q3: caminos de acceso a cada pantalla (54 ids)

**Encontré 54 ids, como se esperaba.** Salen de la lista de reparto del barrido (`coordinacion/cerrado/2026-09-22/…_BL-Q3-web-barrido-PWA-reparto.md` §1: 35 de FE1 y 19 de FE2), que coincide con la lista spec de BL-P5 §2. Si se usan sólo los campos `**Pantalla:**` de las filas del backlog con Origen «barrido BL-Q3», quedan 9 ids (`hitl`, `pres-hitl`, `(vacío)`, `tablero`, `apps`, `agenda`, `caida`, `ajustes`, `hablar`); por eso usé la lista de reparto.

**Qué leí:** código estático del checkout compartido (rama `fe2/bl-o6…` @ `096d8d08`, con cambios locales sin commitear). No es `main` ni prod.

### 1. Tabla

| id | clasificación | caminos (path:línea) | ¿UI distinta? | evidencia |
|---|---|---|---|---|
| **factura** | **UI-DISTINTA** | web: pestaña/tile → `AppShell.tsx:239-243` · «Facturar» de un presupuesto → `AppShell.tsx:218,140-143` · «Completar a mano» de la card del chat → `TarjetaFacturaPropuesta.tsx:223`. mobile: tile `PantallaPrincipal.tsx:44` · `facturaId` desde `app/presupuestos.tsx:39`, `TarjetaFacturaPropuesta.tsx:172`, `ChipArmarFactura.tsx:32` · `comprobanteId` desde `destinoActividad.ts:74` | SÍ | web: sin id aterriza en el listado; con id va directo al wizard con el borrador (`PantallaFacturacion.tsx:127`). mobile: el tile **crea un borrador al montar** (`mobile/…/PantallaFacturacion.tsx:283-300`); con `comprobanteId` abre el detalle (`:250-257`). Web y mobile además aterrizan distinto entre sí |
| **card** (gasto) | **UI-DISTINTA** | «+Nuevo gasto» → `GastosScreen.tsx:215,94-95` · mic de la función → `:211,103` · foto → `:210,112` · card del chat → `TarjetaGastoPropuesto.tsx:82-84` | SÍ | Es el mismo `FormularioGasto` las tres veces: vacío, con sólo `descripcion`, o con la card armada. Mobile igual: `PantallaGastos.tsx:250,243`, `chat/TarjetaGastoPropuesto.tsx:79` |
| **card-cobro** | **UI-DISTINTA** | «Anotar que me pagaron» → `IngresosScreen.tsx:181,86-87` · mic → `:177,93` · card del chat → `TarjetaIngresoPropuesto.tsx:105-107` | SÍ | Mismo `FormularioIngreso`: vacío, con `concepto`, o armado. Mobile: `PantallaIngresos.tsx:185,178`, `chat/…:72` |
| **card-presu** | **UI-DISTINTA** | «Nuevo presupuesto» → `PresupuestosScreen.tsx:285,166-168` · mic → `:281,175` · card del chat → `TarjetaPresupuestoPropuesto.tsx:98-99` | SÍ | Mismo `FormularioPresupuesto`. Mobile: `PantallaPresupuestos.tsx:234,227`, `chat/…:78` |
| **card-cliente** | **UI-DISTINTA** | «Nuevo cliente» → `ClientesScreen.tsx:296,125-127` · mic → `:292,134` · card del chat → `TarjetaClientePropuesto.tsx:155-156` | SÍ | Mismo `FormularioCliente`. Mobile: `PantallaClientes.tsx:320,313`, `chat/…:165` |
| card-factura | UI-DISTINTA | card del chat `MessageList.tsx:280` · «Nueva factura» `PantallaFacturacion.tsx:483,381` | SÍ | La card de factura **no** es el formulario (no importa ningún `Formulario*`, `TarjetaFacturaPropuesta.tsx:1-12`) y Facturación no tiene mic de función. Por eso es la 5.ª y no entra en el grupo de (b) |
| (vacío) Mi día | UI-DISTINTA (latente) | web: pestaña por defecto `AppShell.tsx:31,220` · mobile: portada `PantallaPrincipal.tsx:183` + ruta `/midia` (`app/midia.tsx:8`, declarada en `_layout.tsx:150`) | SÍ | La portada tiene fecha y avatar (`PantallaMiDia.tsx:517,521`); `/midia` es un glass titulado «Mi día» sin fecha (`:496-501`). **No encontré ningún caller de `/midia`** en el código: sólo se llega por deep link (`copiloto://`, `app.json:5`) |
| chat | UI-DISTINTA | pestaña `TabBar.tsx:63` · Mi día / Inteligencia `AppShell.tsx:219-220` · buzón de mensajes pendientes: Cómo usar `PantallaComoUsarLaApp.tsx:67`, Preguntar `PreguntarInteligencia.tsx:20`, «Nuevo evento» `AgendaScreen.tsx:98` | SÍ | Si entra por el buzón, el chat **manda un mensaje solo al montar** (`ChatScreen.tsx:69-72`). Mobile igual: `ChatView.tsx:142` |
| ingresar | UI-DISTINTA | directo `EntradaSesion.tsx:32` · «Entrar» del reveal `:44` · «Entrar con otra cuenta» `:45` | SÍ | El camino de `:44` precarga el email de la última sesión; los otros lo dejan vacío. Sólo web |
| caida | UI-DISTINTA | Mi día `MidiaScreen.tsx:325-327` · badge en Conexiones · mobile: el aviso del avatar sólo existe en la portada (`PantallaMiDia.tsx:521`) | SÍ | FE2 midió `caida` sobre `apps-app.png` (Conexiones), pero el prototipo lo ubica en Mi día |
| fact-cae | UI-DISTINTA | card del chat `MessageList.tsx:280` · fin del wizard `PantallaFacturacion.tsx:632` (`TarjetaComprobante`) · historial `:494-495` (`DetalleComprobante`) | SÍ | Tres componentes distintos |
| pres-voz | UI-DISTINTA | dictado en el chat → `MessageList.tsx:274` · mic de Presupuestos → `PresupuestosScreen.tsx:281,175` | SÍ | Card armada vs. formulario con un solo campo |
| comousar | UI-DISTINTA | Ajustes `AjustesScreen.tsx:72` · Mi cuenta `AccountScreen.tsx:166` → `AppShell.tsx:252-254` | SÍ (menor) | Por Ajustes lleva el botón «‹ Ajustes» (`AjustesScreen.tsx:61-67`); por Mi cuenta no. Mobile: un solo camino, `app/ajustes.tsx:36` |
| gastos | UI-DISTINTA | pestaña/tile · Actividad web `AppShell.tsx:213` · mobile `gastoId` `destinoActividad.ts:64` | SÍ (mobile) | Con id abre el gasto (`PantallaGastos.tsx:117-124`); web siempre abre la lista |
| presu | UI-DISTINTA | pestaña/tile · mobile `presupuestoId` `destinoActividad.ts:66` | SÍ (mobile) | `PantallaPresupuestos.tsx:115-117` |
| clientes | UI-DISTINTA | pestaña/tile · `abrirCliente(id)` `AppShell.tsx:130-133` (desde Actividad, Escritorio y «Ver cliente» del chat) · mobile `clienteId` `destinoActividad.ts:68` | SÍ | Con id abre la ficha (`ClientesScreen.tsx:171`, mobile `PantallaClientes.tsx:151-153`) |
| splash | MISMA-UI | login por formulario y callback de OAuth → `App.tsx:63-67` | NO | El comentario de `App.tsx:50-54` dice que los dos caminos comparten pantalla. Mobile no inspeccionado |
| ingresar-error | MISMA-UI | hereda los caminos de `ingresar` | NO (el alert) | Sólo web |
| tablero · detalle · vacio · vacio-visto | MISMA-UI | estados de Mi día | NO | En mobile el cuerpo es el mismo en los dos montajes (`PantallaMiDia.tsx:267`); sólo cambia el encabezado |
| grabando | MISMA-UI | mic del chat `Composer.tsx:145` · mic de función `MicFuncion.tsx:84` | NO (mismo `MicButton`) | Cambia a dónde va lo dictado (chat o formulario), no la UI de grabación |
| bloqueado | MISMA-UI | todos los caminos de `factura` pasan por la misma pantalla de bloqueo | NO | `PantallaFacturacion.tsx:404` |
| bi · bi-vacio · bi-refresh · preg | MISMA-UI | pestaña `TabBar.tsx:71` + tile `funcionTabMap.ts` → `AppShell.tsx:219` | NO | Siempre arranca en `'resumen'` (`InteligenciaScreen.tsx:65`). Mobile: sólo el tile, `PantallaPrincipal.tsx:49` |
| pres-ciclo | MISMA-UI | web: lista `PresupuestosScreen.tsx:330` · mobile: además por Actividad `:115` | NO | Mismo `DetallePresupuesto` |
| soporte | MISMA-UI | Ajustes `AjustesScreen.tsx:47-48` · Mi cuenta `AccountScreen.tsx:157` · Feedback `AjustesScreen.tsx:74` · mobile `app/ajustes.tsx:39` + `PantallaFeedback.tsx:165` | NO | Todos llegan a la conversación de soporte técnico (`soporte_tecnico`) |
| ingresos | MISMA-UI | pestaña/tile; en `destinoActividad.ts:56-74` no hay destino de ingresos | NO | — |
| ajustes | MISMA-UI | avatar `AppShell.tsx:220,222` · «Configurar facturación» `:242` · mobile: sólo el avatar `PantallaPrincipal.tsx:185` | NO | — |
| afip | MISMA-UI | web `AjustesScreen.tsx:71` · mobile Ajustes `app/ajustes.tsx:30` + botón de Facturación `PantallaFacturacion.tsx:610` | NO | — |
| apps | MISMA-UI | tile de Ajustes `AjustesScreen.tsx:41-42` · recién registrado (`App.tsx:78` → pestaña inicial) · mobile `app/ajustes.tsx:32` | NO | `AppsScreen` («Tus apps», otra UI) está montado pero **no tiene caller** (`AppShell.tsx:105-112`, `DesktopShell.tsx:80-88`) |
| recibo | MISMA-UI (web) | 5 cards del chat → `Recibo` (`TarjetaGasto…:61`, `Ingreso…:87`, `Presupuesto…:78`, `Cliente…:115`, `Factura…:115`) | NO en web | Mobile **no verificado**: sólo la card de factura usa `Recibo` (`mobile/…/TarjetaFacturaPropuesta.tsx:130`). Además el `Recibo` de `Onboarding.tsx:101` es otro componente con el mismo nombre |
| esc | CAMINO-UNICO | web `TabBar.tsx:72` · mobile `PantallaPrincipal.tsx:170` | — | — |
| entrada | CAMINO-UNICO | `App.tsx:69` | — | Sólo web |
| reveal | CAMINO-UNICO | `EntradaSesion.tsx:35-37` (primera vez) | — | Sólo web |
| volver | CAMINO-UNICO | `EntradaSesion.tsx:35` (cierre voluntario) | — | Sólo web |
| agenda | CAMINO-UNICO | web `MidiaScreen.tsx:209-210` (sólo si el calendario está `ok`) · mobile `PantallaPrincipal.tsx:186` | — | — |
| vozchat | CAMINO-UNICO | mic del chat `Composer.tsx:145` | — | — |
| hitl | CAMINO-UNICO | `MessageList.tsx:304` (`HitlCard`) | — | — |
| pres-hitl | CAMINO-UNICO | `MessageList.tsx:274` | — | Usa el mismo formulario que `card-presu`: dos ids para un solo componente |
| fact-hitl · fact-voz | CAMINO-UNICO | `MessageList.tsx:280` | — | — |
| cobro-voz | CAMINO-UNICO | `Bubble.tsx:73` (`ArtifactView`) | — | Mobile no lo dibuja (BL-F2) |
| consent | CAMINO-UNICO | web `ChatScreen.tsx:121` · mobile `ChatView.tsx:230` | — | — |
| onb-promesa · onb-cumplida | CAMINO-UNICO | web `App.tsx:77` · mobile `_layout.tsx:98` | — | — |
| negocio | CAMINO-UNICO | `AjustesScreen.tsx:69` · mobile `app/ajustes.tsx:29` | — | — |
| hablar | CAMINO-UNICO | web: desde Mi negocio `AjustesScreen.tsx:69-70` · mobile `PantallaPerfilNegocio.tsx:310` | — | — |
| feedback | CAMINO-UNICO | `AjustesScreen.tsx:74` · mobile `app/ajustes.tsx:40` | — | — |
| apar | CAMINO-UNICO | `AjustesScreen.tsx:73` · mobile `app/ajustes.tsx:35` | — | — |
| cuenta | CAMINO-UNICO | `AjustesScreen.tsx:44` → `AppShell.tsx:248-249` · mobile `app/ajustes.tsx:34` | — | — |

### 2. Conteo

| Clasificación | ids |
|---|---|
| CAMINO-UNICO | 19 |
| MULTI-PATH-MISMA-UI | 19 |
| MULTI-PATH-UI-DISTINTA | 16 (uno latente: `(vacío)`) |
| NO-PUDE-DETERMINAR | 0 (pero ver las limitaciones del punto 4) |
| **Total** | **54** |

### 3. Controles positivos

- **(a) SÍ.** `factura` sale como UI-DISTINTA: sin id aterriza en el listado (`PantallaFacturacion.tsx:127`); desde un presupuesto o desde la card del chat va directo al wizard con el borrador (`AppShell.tsx:140-143,218`, `TarjetaFacturaPropuesta.tsx:223`). En mobile hay un tercer estado.
- **(b) SÍ.** Son `card`, `card-cobro`, `card-presu` y `card-cliente` (caminos citados en la tabla). El «+Nuevo» abre el formulario vacío y la card del chat monta **el mismo** formulario ya armado. Además hay un tercer camino que no pedías: el mic de la función, que precarga un solo campo. `card-factura` **no** entra en el grupo: su card no es el formulario.
- **(c) SÍ.** Por ejemplo `feedback`, `negocio`, `hablar`, `consent`, `onb-promesa`.

### 4. Veredicto: confiable, con límites

Los tres controles se reprodujeron. Lo que **no** cubre:
- Es lectura estática del checkout compartido, no de `main` ni de prod. Ejemplo: este código ya trae el fix de `reveal` que FE1 reportó como faltante.
- Mobile no inspeccionado en las 6 pantallas de entrada (`splash`, `entrada`, `reveal`, `volver`, `ingresar`, `ingresar-error`) ni en `recibo`.
- La variante escritorio vs. teléfono (por ejemplo `DesktopShell.tsx:148` sin avatar) no la conté como camino.

**Casos donde la ambigüedad ya produjo mediciones cuestionables:**
- En el prototipo, `card-*` es la card que aparece **dentro de la función** después de dictar (`index.html:2862-2868,3661-3666`), y `card-cobro` es «Nuevo ingreso» (`:2877-2878`). FE1 midió `card-cobro` contra el HITL de Mercado Pago, y `card`/`card-presu` contra las cards del chat. Esos veredictos «COHERENTE» comparan otra pantalla.
- FE2 midió `caida` en Conexiones; el prototipo lo pone en Mi día.
- FE1 midió `factura` como «form vacío», que es el comportamiento anterior a #644.
=== exit=0 fin 08:34:34 ===
