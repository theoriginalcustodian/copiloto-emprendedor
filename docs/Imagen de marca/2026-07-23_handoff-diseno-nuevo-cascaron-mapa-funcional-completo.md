# Copiloto del Emprendedor — Handoff de diseño: mapa funcional completo

> **Para qué es este documento:** diseñar un **nuevo cascarón** (shell / cáscara) para la app. Acá está,
> completo, **qué hace el copiloto, cómo está estructurado, cómo se navega y cómo se usa** — mapeado
> contra el código real (no contra la aspiración), con el **estado de madurez** de cada pieza marcado
> explícitamente para que el diseño no prometa lo que todavía no existe.
>
> **Fecha:** 2026-07-23 · **Fuente:** exploración read-only de `apps/mobile/**`, `apps/copiloto/**`,
> `motor/**` + `docs/presentacion-copiloto-emprendedor.md`.
>
> **Convención de madurez** usada en todo el doc:
> - ✅ **VIVO** — implementado y funcionando.
> - 🚧 **EN CONSTRUCCIÓN** — en curso ahora mismo (hito activo), contrato puede moverse.
> - 🕳️ **CASCARÓN** — pantalla existe, dice "próximamente", sin backend.
> - 🔮 **VISIÓN** — narrado en la presentación de producto, todavía no construido.

---

## 1. Qué es y a quién le habla

**Un empleado administrativo que se maneja hablándole.** El emprendedor le dicta en voz alta lo que
necesita —*"facturale 85 mil a la panadería"*, *"pagué 12 mil de herramientas"*— y queda hecho: la
factura con validez fiscal, el gasto anotado, el cliente cargado, el presupuesto escrito. **Sin
formularios, sin aprender a usar nada, sin abrir la computadora.**

**El usuario:** el que trabaja y además tiene que administrar (electricista, vendedora de Instagram,
gasista). No tiene administrativo, no va a aprender un ERP, su sistema real hoy son notas en el celular
y una carpeta de WhatsApp con fotos de tickets. **No** le habla al que ya tiene contador full-time y
gestión andando.

**La promesa central que el cascarón debe transmitir:** *le hablás, las cosas pasan.* La voz es la
entrada principal; todo lo demás (los formularios, las pantallas de feature) es la **red de seguridad**
para corregir y para ver, no el camino primario.

**El moat (por qué esto no es una app CRUD más):** todo corre sobre **ejecución durable** (Temporal).
Si se corta internet a mitad de una factura, si se reinicia el servidor, si ARCA tarda 20 segundos —
la operación **retoma donde estaba y termina**. La conversación es un proceso de servidor que vive
indefinidamente: el usuario puede cerrar la app, volver una semana después, y **seguir la misma
charla**. Esto tiene consecuencias directas de diseño (ver §6).

---

## 2. Mapa de navegación (todas las pantallas)

Motor de rutas: **expo-router** (`apps/mobile/app/**`). Regla de arquitectura del repo: cada archivo de
`app/` es **solo una ruta** que re-exporta una pantalla real de `src/modules/**` — nunca contiene lógica.

Cada pantalla de función se abre como **modal transparente deslizándose desde abajo** (`transparentModal`
+ `slide_from_bottom`), **encima** de la pantalla anterior que queda visible detrás (transparencia real
— es el mecanismo del "vidrio", §3).

| Ruta | Pantalla | Qué ve el usuario | Madurez |
|---|---|---|---|
| `/` | Principal (shell) | **Home**: escritorio de funciones + chat del copiloto en un panel deslizable | ✅ |
| `/facturacion` | Facturación | Emitir facturas ARCA, "Mis comprobantes", "Te deben", cobro. Flujo de 4 pasos en un solo glass | ✅ |
| `/ingresos` | Ingresos | Todo lo que entró (facturas cobradas, MercadoPago, manual) + alta manual | ✅ |
| `/gastos` | Gastos | Resumen del mes + listado + alta manual, 8 categorías | ✅ |
| `/presupuestos` | Presupuestos | Listado / alta / detalle; botón "Facturar" que arma el borrador | ✅ |
| `/clientes` | Clientes | Cartera con búsqueda server-side, ficha, alta manual, detección de duplicados | ✅ |
| `/midia` | Mi día | Tablero de tarjetas de trabajo (detector proactivo) | 🚧 |
| `/inteligencia` | Inteligencia de Negocio | KPIs + 4 gráficos + solapa "Preguntar" (chat dedicado) | ✅ |
| `/contabilidad` | Contabilidad | Caja vs. facturación — hoy "PRÓXIMAMENTE" | 🕳️ |
| `/ajustes` | Ajustes | Grid lanzador de 7 entradas de configuración | ✅ |
| `/ajustes-negocio` | Mi negocio | Qué vende, a quién, y **cómo debe hablarle** el copiloto | ✅ |
| `/ajustes-afip` | Perfil fiscal AFIP | Alta ante ARCA, datos fiscales, ambiente (homologación/producción) | ✅ |
| `/apps` | Apps conectadas | Integraciones Composio (Gmail, Drive, Sheets, Docs, Calendar, MercadoPago) | ✅ |
| `/ajustes-mi-plan` | Mi plan | Plan/suscripción | 🕳️ |
| `/ajustes-cuenta` | Cuenta | Email + cerrar sesión (+ "No molestar" inerte) | ✅ |
| `/ajustes-skins` | Apariencia | Selector de los 5 temas visuales | ✅ |
| `/ajustes-como-hablarle` | Cómo hablarle | Ejemplos de frases que entiende, **generados dinámicamente** desde el backend | ✅ |
| `/recientes` | Actividad reciente | Historial completo con scroll infinito | ✅ |

**Jerarquía de entrada:** el usuario entra al home `/`. Desde el **escritorio** (grid de tiles) accede a
las 9 funciones principales. **Ajustes** es un lanzador secundario hacia las pantallas de configuración.
"Apps conectadas" ya **no tiene tile** en el escritorio: se llega desde Ajustes.

---

## 3. La cáscara "glass" actual (lo que el nuevo cascarón reemplaza o reinterpreta)

Esta es la parte más relevante para el rediseño: **cómo funciona hoy la cáscara**, con sus mecánicas ya
probadas en device (varias nacieron de bugs reales — están anotadas para que el rediseño no los repita).

### 3.1 El panel deslizable del home — dos capas Z
- **Capa 0 (fondo, fija):** el **escritorio de funciones** (grid de íconos).
- **Capa 1 (frente, deslizable):** la **conversación** con el copiloto, sobre "vidrio".
- El panel se arrastra vertical: arriba tapa todo (conversación), abajo revela el escritorio detrás.

**Gesto** (corre en el hilo de UI, 60fps): pan 1:1 con el dedo; al soltar, *flick* (>500 px/s) manda la
dirección, si no gana el borde más cercano; **toque casi sin desplazamiento = toggle** (abre/cierra sin
arrastrar). Handle superior fijo siempre agarrable ("Deslizá para ver funciones" / "Subir conversación").

### 3.2 El escritorio de apps
- Grid horizontal-scrolleable de **máximo 2 filas** (nunca una 3ª fila fija — crece en columnas hacia la
  derecha). 9 tiles **ordenados por frecuencia de uso esperada** (invariante con test): Facturación,
  Ingresos, Gastos, Presupuestos (las 4 operativas, visibles sin scroll) → Clientes → Mi día →
  Inteligencia → Contabilidad → Ajustes.
- Cada tile: ícono "glass" propio (SVG vectorial) + etiqueta de 2 líneas.
- Afordancia de overflow (fade + flecha) **solo cuando hay más a la derecha** (medido, no asumido).
- Debajo: encabezado "Actividad reciente" + **últimas 20 operaciones reales** (nunca mock).

### 3.3 El "glass" de cada función
- Cada pantalla de feature trae su propio marco de vidrio (`MarcoGlass`): mismo canon visual que el panel
  (blur simulado + tinte + línea de luz superior + sombra — **sin blur real**: Android/RN no lo soporta
  bien, el efecto sale de **opacidad + tinte**).
- **5 niveles de opacidad del vidrio** según contexto: conversación/grabación 87%, *takeover* 100% (HUD
  de grabación viva), *informe* 48% (gate de confirmación flotante), *menú* 31%.
- **Cerrar con gesto:** pan hacia abajo; pasado el umbral (o con flick) cierra animando el vidrio fuera
  de pantalla y **recién entonces** navega hacia atrás (evita el "salto" al cruzar de hilo). "Volver"
  fijo arriba a la derecha, fuera del gesto.

### 3.4 Invariantes que el nuevo cascarón DEBE respetar (nacieron de bugs en device)
1. **Un solo glass a la vez** — al abrir una función, la "puerta" de navegación se cierra sincrónicamente;
   solo se reabre cuando la pantalla lanzadora recupera el foco. Sin esto, un doble-tap apila dos modales
   y la app queda **clavada** (bug real cazado en device 2026-07-20/21).
2. **Accesibilidad:** las funciones que quedan debajo de otra (siguen montadas por el modal transparente)
   se marcan **inertes** para el lector de pantalla — si no, los tiles "invisibles" de atrás siguen
   activables.
3. **Scroll con gesture-handler, no el de React Native** — dos sistemas de touch compitiendo hacían que
   un tap corto quedara "sin dueño".
4. **Alturas medidas con `onLayout`, nunca `Dimensions.get('window')`** — por el edge-to-edge.

> **Nota de diseño:** el efecto vidrio actual es **opacidad + tinte + luz**, no blur gaussiano. Si el
> rediseño quiere blur real, es una decisión de plataforma (costo/rendimiento en Android) que hay que
> validar en device antes de comprometerla — no asumir que "se puede".

---

## 4. Las funciones — catálogo completo (qué hace cada una)

Para cada capacidad: **qué hace · qué le pide al usuario · qué devuelve · cómo se confirma (HITL)**.
Marcado con la vía de entrada real: 🎙️ por voz (tool del agente) · 📝 por formulario (REST).

### 🧾 Facturación AFIP/ARCA — ✅ VIVO (por formulario) · 🔮 por voz (hito 9, futuro)
Emite **facturas electrónicas con validez fiscal** contra ARCA, desde el teléfono.
- **Hoy:** flujo de **4 pasos en un solo glass** (cliente → datos de venta → ítems → resumen), con un
  **gate de confirmación explícito** antes de emitir. Devuelve el **CAE real** + vencimiento + **PDF
  para compartir** por WhatsApp. Anular = **nota de crédito** (el original nunca se borra).
- **La facturación NO depende del criterio de un LLM.** Tipo de comprobante, número, punto de venta,
  fecha y cálculo los arma **código determinista** con las reglas de ARCA escritas y probadas
  (`afip_rules.py`). La voz sirve para *pedirlo*; lo que se manda a ARCA no lo improvisa nadie.
- **Idempotencia dura:** dos toques de "Confirmar" **no** emiten dos facturas (workflow_id
  determinístico + token atado al contenido exacto mostrado).
- **Cubre monotributo — Factura C.** Factura A y B (IVA discriminado) **no** implementadas (lanzan error
  a propósito).
- Extra: el PDF se **archiva en Google Drive** automáticamente si el usuario lo activó.
- **⚠️ Para el diseño:** hoy **facturar por voz todavía no existe como tool** — hay un test-guard que
  impide siquiera prometerla en la pantalla de ayuda. El copy del cascarón no debe sugerir "dictá una
  factura" hasta que el hito 9 cierre. El resto (dictar gasto, ingreso, cliente) **sí** es por voz.

### 📄 Presupuestos — ✅ VIVO
- Se crean por formulario; salen como **documento de Google** con el formato del negocio.
- Estados: **pendiente / aprobado / desestimado**. Un presupuesto corregido **reemplaza** al anterior sin
  borrarlo. "Sin respuesta" (>30 días) se **deriva**, no se marca a mano.
- Desde uno **aprobado se factura** (arma el borrador y navega al gate de Facturación) o se manda link de
  cobro — sin recargar datos.
- 🎙️ El agente puede **cambiar el estado dictando**: *"me aprobaron el de la panadería"* / *"ese no va"*.
  Si hay ambigüedad sobre a cuál se refiere, **nunca elige solo** — pregunta.

### 💰 Ingresos — ✅ VIVO
Todo lo que **entra** (no solo lo facturado).
- 🎙️ *"me pagaron 85 mil en efectivo de la panadería"*. **Lo único obligatorio es el monto**; el resto se
  pide pero no se exige — **ya quedó anotado**.
- Cada ingreso muestra su **origen distinguible**: factura cobrada / MercadoPago / manual (voz) / foto.
- Si un ingreso se parece mucho a uno ya registrado, **pregunta antes de guardar** (evita cobrar dos
  veces el mismo trabajo en los números).

### 💸 Gastos — ✅ VIVO
- 🎙️ *"pagué 12 mil de herramientas"*. **8 categorías**: mercadería, servicios, alquiler, sueldos,
  impuestos, transporte, herramientas, otros.
- Guarda proveedor, medio de pago y **la frase original tal como se dijo** (para contrastar después).
- Se cargan por **voz, a mano, o desde la foto del ticket**.
- **Se imputan a un trabajo**; si no se dice, el copiloto ofrece el más probable.

### 👥 Clientes — ✅ VIVO
- 🎙️ *"anotá un cliente, Panadería Los Tilos, CUIT 30-71234567-8"* — **solo el nombre es obligatorio**.
  **PROPONE, no persiste**: devuelve una **tarjeta editable** pre-cargada con lo que entendió; el alta
  real la dispara el usuario tocando Guardar (así se corrige un error de transcripción).
- Detecta **contradicciones** (dijo "CUIT" pero el número es un DNI → avisa, no re-deriva en silencio).
- **Avisa si ya existe** antes de duplicar y muestra la ficha del que ya tenías; dos clientes distintos
  con el mismo nombre están permitidos (no obliga a inventar nombres).
- Búsqueda server-side (ignora tildes/mayúsculas). La cartera se **deriva** de lo facturado.

### 🧮 Contabilidad — 🕳️ CASCARÓN ("PRÓXIMAMENTE")
La visión: **entró, salió, queda** — sin partida doble ni plan de cuentas. Distinción central:
**facturar no es cobrar** (una factura emitida no entró a la caja hasta que la pagaron). Pantalla existe,
backend pendiente.

### 📐 Rentabilidad por trabajo — parcial (backend de imputación ✅, vista dedicada pendiente)
**Lo que entró por un trabajo, menos lo que gastaste en él.** Un trabajo puede tener presupuesto, factura
y cobro enlazados. Siempre se muestra **cuántos gastos tiene imputados** (un margen con la mitad de los
gastos es falso y se ve excelente). Hoy los márgenes viven en Inteligencia de Negocio.

### 📊 Inteligencia de Negocio — ✅ VIVO
- **Portada:** KPIs (caja, mes en curso) — `null` se muestra como "—", **nunca como "$0"**.
- **4 gráficos** (barras/torta): facturación por mes, entró vs. salió, margen por trabajo, categorías de
  gasto. Se tocan y se abren: **cada barra muestra de qué está hecha** (un número que no se puede
  desarmar no se cree).
- **Solapa "Preguntar":** chat dedicado. *"¿qué le vendí a este cliente la última vez?"*, *"¿quién me
  dejó de comprar?"*. Los montos salen **siempre de una consulta a la base**, nunca de un LLM calculando
  de memoria.

### ☀️ Mi día — 🚧 EN CONSTRUCCIÓN (hito 7, activo ahora)
El copiloto **habla primero**: cada mañana arma una lista de **tarjetas de trabajo** (no notificaciones
sueltas). Presupuestos que se enfriaron, facturas impagas, un margen que se está comiendo.
- **Las reglas son fijas y verificables** (no un LLM decidiendo cada día): si un presupuesto lleva >30
  días sin respuesta, aparece — **siempre, con los mismos datos**. El LLM solo redacta *cómo* decirlo; si
  no está disponible, **el aviso sale igual** (plantillas por regla).
- **No satura:** un aviso por día, priorizado por la plata en juego, sin repetir.
- **La mayoría de las tarjetas se cierra sola:** *"cobrá la factura 0001-00042"* desaparece cuando esa
  factura se marca cobrada. El tablero se mantiene solo.
- **⚠️ Estado real de la costura (importante para el diseño):** hay una **discrepancia de forma** entre
  las dos mitades que se está resolviendo ahora:
  - El **backend** (detector) devuelve **3 solapas fijas**: *Para hoy · Haciendo · Hechas*.
  - La **app** actual todavía tiene una UI **Kanban por columnas** (presupuesto→facturado→por cobrar→
    cobrado) en estado `[CONNECT]` (degrada honestamente a "todavía no está disponible").
  - **Decisión vigente:** Mi Día = el **detector de 3 solapas**; la vista de pipeline de facturación por
    columnas se **desacopla** a su propia pantalla futura. El nuevo cascarón debe diseñar **3 solapas**,
    no columnas Kanban con drag (el drag entre columnas peleaba con el gesto del panel glass).

### 🔗 Apps conectadas (Composio) — ✅ VIVO (5 integraciones cableadas)
El copiloto trabaja con las herramientas que el emprendedor ya usa. **Conexión OAuth por tenant**, con
aviso de qué se pierde al desconectar. **Cableadas hoy:**

| App | Qué hace el copiloto | Confirma antes de ejecutar |
|---|---|---|
| **Gmail** | manda mails por él | Sí |
| **Google Calendar** | agenda turnos y visitas (resuelve fecha/hora) | Sí |
| **Google Docs** | escribe los presupuestos / crea docs | Sí (al crear) |
| **Google Sheets** | vuelca datos a sus planillas | Sí |
| **Google Drive** | archiva las facturas (el agente **no** lo toca por su cuenta) | — |
| **MercadoPago** | genera links de cobro para mandar | Sí |

> HubSpot e Instagram aparecen en la narrativa de producto pero **no están cableados** todavía (el código
> los contempla como preparación futura). El catálogo de apps de la pantalla viene **100% del backend**
> (`GET /catalog`), nunca hardcodeado — el diseño debe pintar una lista **dinámica**, no fija.

### 💳 MercadoPago (cobros) — ✅ VIVO
- 🎙️ *"cobrale 5000 a Juan por la reparación"* → genera un **link de pago** (con confirmación previa).
  **No cobra por vos**: genera el link, el cliente paga donde siempre.
- No hay pantalla dedicada de cobros: el cobro vive **dentro de la ficha del comprobante** ("¿ya me la
  pagaron?", historial de cobros parciales) y la conexión como app en `/apps`.
- Los pagos entran a Ingresos con origen "MercadoPago".

### ⚙️ Ajustes — ✅ VIVO
Datos del negocio, credenciales de ARCA, apps conectadas, plan, y **apariencia** (5 temas). Y lo
distintivo: **se le puede poner nombre al copiloto** y decidir si te habla **formal o de vos**, **corto o
detallado**. *Es tu empleado, no el de la app.*

### 🧠 Memoria — ✅ VIVO (transversal, sin pantalla propia)
El copiloto **recuerda su actividad**. Responde *"¿cuánto me compró la panadería este año?"* / *"¿cuánto
cobraba antes por instalar un tablero?"* con números de las **operaciones reales**. Cada operación queda
como **un hecho con su fecha** (no un renglón): permite responder *"¿cómo llegaron a estar así las
cosas?"*, no solo *"¿cómo están?"*. Recall temporal exhaustivo ("qué hice ayer/esta semana").

---

## 5. Cómo se usa — flujos del usuario

### 5.1 Onboarding (5 minutos, una vez)
1. **Entra con Google** (en mobile hoy: email/password; Google OAuth vive en web).
2. **Cuenta qué vende** en una frase — es lo que el copiloto usa para entenderlo.
3. **Conecta ARCA** con su clave fiscal (se usa en el momento y **se descarta**, no se guarda).

Lo demás (clientes, gastos, presupuestos) **se llena solo a medida que trabaja**. No hay carga inicial.

### 5.2 El día típico (el flujo primario — todo por voz, sin un solo formulario)
- **7:40, el café** → abre la app, ya hay tarjetas de "Mi día" esperando (presupuestos fríos, facturas
  impagas, gasto disparado). Las que resuelve desaparecen solas.
- **10:15, la ferretería** → aprieta el micrófono: *"pagué 12 mil de herramientas, con tarjeta"* → ve una
  **tarjeta editable** con lo que entendió (monto, categoría, proveedor, medio) → **corrige ahí mismo** si
  escuchó mal → confirma.
- **11:00, en el auto** → *"cargá 8 mil de nafta, fue el sábado"* → la tarjeta sale con **fecha del
  sábado** (se anota cuándo pasó, no cuándo se acordó).
- **13:30** → *"facturale 85 mil a Panadería Los Tilos"* → 40s después, PDF con **CAE real** para
  WhatsApp. *(Hoy este paso es por formulario; por voz es el hito 9.)*
- **15:00** → *"me pagaron 85 mil en efectivo, de la panadería"* → entra a la caja y queda pegado al
  trabajo.
- **17:00** → *"armá un presupuesto para Distribuidora Sur: instalación de tablero, 180 mil"* → documento
  con el logo del negocio.
- **21:00, el sillón** → *"¿en qué se me está yendo la plata?"* → números de sus operaciones reales.

**Ninguno de esos momentos tuvo un formulario. Ninguno tomó más de un minuto.** Ese es el estándar que el
cascarón tiene que preservar.

### 5.3 El mecanismo de la voz (para diseñar el botón/HUD)
Botón central pulsante:
- **Mantener apretado** → arranca a grabar **de inmediato** (permiso y buffer pre-calentados).
- **Soltar sin deslizar** → corta, sube y **envía** en un gesto.
- **Deslizar hacia arriba (>80px)** → **fija** la grabación: aparecen controles flotantes (Pausar,
  Enviar, Eliminar) — ya no hay que sostener el dedo.
- **Feedback:** una **onda** que reacciona al micrófono (~10Hz). Sin contador de tiempo, sin HUD pesado.
- **Cero retención:** el audio va directo a transcripción y **se borra apenas sube**. El mensaje del
  usuario aparece recién con el **transcript real** (no hay texto optimista — no se sabe qué dijo hasta
  que vuelve).

### 5.4 Cómo se leen las respuestas (tipos de "burbuja" a diseñar)
1. **Texto plano** en burbuja de vidrio.
2. **Gate de confirmación** (vidrio *informe*, flotante): markdown de solo lectura + **Confirmar /
   Cancelar** — para cualquier acción con dinero o efecto externo (cobrar, mandar mail, publicar).
3. **Tarjeta de propuesta editable** (gasto, cliente): reusa el **formulario real** pre-cargado con lo
   dictado — **nunca un sí/no ciego**, porque un error de transcripción solo se corrige editando.

---

## 6. La arquitectura por debajo que RESTRINGE el diseño

Esto no es contexto técnico opcional: son **restricciones duras** que el cascarón tiene que honrar.

### 6.1 Contrato de red: fire-and-forget + polling (NO hay streaming)
- El front manda el mensaje (`POST /chat`) y recibe **solo un acuse inmediato** — **no** la respuesta.
- La respuesta se genera en background y el front la **busca por polling** (`GET /reply`) cada ~1.5s
  (hasta 60s, luego baja a 10s — **"nunca se abandona"**, el backend es durable).
- **Implicación de diseño #1:** la respuesta **aparece entera**, nunca token-a-token. El estado
  "pensando…" es **indefinido** (puede tardar). Diseñar un indicador de espera que aguante segundos sin
  frustrar, no un spinner de 300ms.
- **Implicación de diseño #2:** al **reabrir la app**, el front hace un poll y puede traer respuestas que
  llegaron **con la app cerrada** → la conversación "sigue sola". El diseño debe tolerar que aparezcan
  mensajes "del pasado" al volver.

### 6.2 La sesión es permanente (no expira por uso)
La conversación de un emprendedor **no tiene concepto de "sesión que caduca"**. Se cierra solo por
inactividad de **7 días**. **Implicación:** no diseñar "empezar nueva conversación" como acción central;
el hilo es **uno y continuo**. Si estaba completando una tarjeta y se cerró la app, **al volver está ahí**
con lo que ya había puesto — no hay que dictar de nuevo.

### 6.3 Cada acción con plata o efecto externo pasa por una card de confirmación
El **gate de confirmación** (`service`, `label`, Confirmar/Cancelar) es **parte del contrato**, no un
detalle libre de UI. El diseño de esas cards debe mostrar el **ícono y nombre real del servicio** que se
va a tocar (viene del backend). Lo reversible (anotar un gasto) puede no tener gate; **lo irreversible
(factura, mail, cobro) siempre lo tiene** — y eso **no se puede apagar** ni en modo automático.

### 6.4 Multitenant por construcción
Cada pantalla, cada dato, está **scoped al emprendedor autenticado** por arquitectura. **No existe** vista
global ni cross-tenant en ningún punto. "Cada uno ve solo lo suyo" es un invariante, no una regla de UI a
recordar. El almacenamiento local (borradores, historial) está aislado por tenant.

### 6.5 Modo confirmación vs. automático — 🚧 hito 8
El emprendedor elige cuánto le pregunta el copiloto:

| | **Pedir confirmación** (default) | **Automático** |
|---|---|---|
| Anotar gasto / cobro / cliente | te muestra la tarjeta, confirmás | lo anota directo |
| Facturar / cobrar MP / mandar mail | te pregunta | **te pregunta igual** |

- **La segunda fila no se puede apagar, a propósito** (lo irreversible siempre se confirma).
- **Se empieza pidiendo confirmación** — no por desconfianza, sino porque **la tarjeta es donde uno
  aprende a dictar** (cada vez que aparece mostrando lo que faltó, el usuario ve qué decir la próxima vez).
- **El automático no se elige de una lista: te lo ofrece el copiloto** cuando ya vio que venís dictando
  completo. *"Tus registros vienen entrando completos, ¿querés que deje de pedirte confirmación?"*
- **⚠️ Estado real:** el modo automático está **bloqueado en el backend** hoy (devuelve 409 si se intenta
  activar), porque el motor de narración todavía puede "decir que hizo algo que no hizo" y sin la tarjeta
  eso no se ve. Es **deuda gestionada** con condición de pago, no una feature escondida. El cascarón puede
  diseñar el ofrecimiento, pero debe manejar que hoy **no se puede activar**.

### 6.6 "Una cosa por vez"
Si el copiloto no entendió algo, **pregunta una sola vez**; si sigue faltando, muestra la tarjeta para
completar a mano y **espera a que se resuelva o se descarte antes de aceptar otra cosa**. Evita que queden
cosas a medio anotar. *(Consultar Inteligencia de Negocio siempre está disponible — eso no toca nada.)*

### 6.7 Cómo habla (tono — afecta todo el copy)
Cuando algo no sale, **el copiloto se hace cargo, no corrige al usuario**:

| En vez de | Dice |
|---|---|
| *"Te faltó el medio de pago"* | *"¿Cómo te pagaron? Si querés lo agregamos."* |
| *"No dijiste la fecha"* | *"Lo anoté con fecha de hoy — si fue otro día, tocá acá."* |

Y **nunca traba por un dato que falta**: si dijiste el monto, ya quedó anotado.

---

## 7. Sistema visual actual (tokens, temas, tipografía, íconos)

Fuente única de verdad: `src/theme/tokens.ts` (un test prohíbe hex/rgba fuera de ahí).

- **5 temas ("skins") intercambiables en runtime:** `cian` (default), `violeta`, `ambar`, `medicalWhite`
  (único claro), `black`. Cada uno define una paleta cruda de la que se derivan colores de superficie,
  texto, acento, borde, peligro/éxito, y los tokens de **glass** (tinte, sombras, glows radiales del
  fondo). Un knob de **luminosidad** por skin mezcla el fondo hacia **su propio acento** (nunca hacia
  blanco, para no lavar la identidad de color).
- **Espaciado:** `4 / 8 / 16 / 24 / 32`. **Radios:** `6 / 12 / 20 / 999`. **Tamaños de texto:**
  `13 / 15 / 18 / 24`.
- **Tipografía:** **Space Grotesk** para UI general; **JetBrains Mono** para labels/meta en mayúsculas.
- **Íconos "glass":** catálogo propio de **11 glifos vectoriales** (SVG por datos, no imágenes) con
  silueta + blobs de color + glifo. Cada función tiene un ícono único (sin repetición en un mismo grid,
  regla con test).
- **Paleta categórica** de 8 colores (validada para daltonismo) para el gráfico de categorías de gasto.

> **Para el rediseño:** todo el sistema está **tokenizado y multi-tema**. Un cascarón nuevo debería
> **entrar por los tokens** (no pintar hex sueltos) para heredar automáticamente los 5 temas y el gate
> visual multi-tema que ya existe.

---

## 8. Lo que NO hace (límites — para no diseñar de más)

- **No es un ERP** (sin stock, órdenes de compra, producción).
- **No lleva libros contables** — lleva la caja del negocio. Balance y declaraciones siguen siendo del
  contador.
- **No reemplaza al contador** — le da datos ordenados.
- **Hoy factura monotributo (Factura C).** Responsable inscripto con IVA discriminado (A/B): no.
- **No hace declaración de IVA ni ganancias.**
- **No maneja empleados ni sueldos** (más allá de anotarlos como gasto).
- **No cobra por vos** — genera el link de MercadoPago, el cliente paga donde siempre.

---

## 9. Estado de madurez — resumen para priorizar el diseño

| Feature | Backend | UI mobile | Nota para diseño |
|---|---|---|---|
| Facturación (formulario) | ✅ | ✅ | Flujo de 4 pasos en un glass; gate de confirmación |
| Facturar por voz | 🔮 hito 9 | — | **No prometer todavía** en el copy |
| Presupuestos | ✅ | ✅ | Estados aprobado/desestimado; genera Google Doc |
| Ingresos | ✅ | ✅ | Origen distinguible; solo monto obligatorio |
| Gastos | ✅ | ✅ | 8 categorías; voz/mano/foto de ticket |
| Clientes | ✅ | ✅ | Tarjeta editable por voz; detección de duplicados |
| Inteligencia de Negocio | ✅ | ✅ | KPIs + 4 gráficos desarmables + chat "Preguntar" |
| Mi día | 🚧 hito 7 | 🚧 | **3 solapas** (no Kanban); discrepancia de forma en resolución |
| Contabilidad | 🕳️ | 🕳️ | Cascarón "próximamente" |
| Apps (Composio) | ✅ 5 apps | ✅ | Lista **dinámica** del backend; HubSpot/Instagram aún no |
| MercadoPago | ✅ | ✅ | Cobro por voz + dentro de la ficha de comprobante |
| Perfil / tono del copiloto | ✅ | ✅ | Nombre, formalidad, largo de respuesta |
| Modo automático | 🚧 hito 8 | — | **Bloqueado en backend hoy** (409); diseñar el ofrecimiento |
| Memoria / recall | ✅ | (transversal) | Sin pantalla propia; alimenta el chat |
| Voz (captura) | ✅ | ✅ | Mantener/soltar/deslizar; onda; cero retención |
| Durabilidad (Temporal) | ✅ | (contrato) | Sesión permanente; polling; sin streaming |

---

## 10. Los 6 principios que un nuevo cascarón NO puede romper

1. **La voz es el camino primario.** Las pantallas son la red para corregir y ver, no el flujo central.
2. **La respuesta aparece entera y puede tardar** (fire-and-forget + poll, sin streaming). Diseñar la
   espera indefinida, no un spinner corto.
3. **La sesión es una y permanente** — no hay "nueva conversación" como acción central; al volver, todo
   sigue donde estaba.
4. **Lo irreversible siempre se confirma** con una card que nombra el servicio real. Lo reversible puede
   ser directo.
5. **Un solo glass a la vez** y accesibilidad de las capas de atrás — invariantes ya pagados en device.
6. **Todo por tokens y multi-tema** (5 skins) — nada de hex sueltos; el gate visual multi-tema ya existe.

---

*Handoff de diseño · Copiloto del Emprendedor · 2026-07-23. Estados de madurez verificados contra el
código real; distinguen lo VIVO de la visión de producto para no diseñar sobre lo que todavía no existe.*
