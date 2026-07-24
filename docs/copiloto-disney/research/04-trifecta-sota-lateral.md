# STATE_OF_THE_ART — Lente (b) LATERAL / HACK
## Copiloto para agentes de viajes Disney — atajos que colapsan el problema

> Agente 2/4 de la trifecta cognitiva. Fecha: 2026-07-20.
> Regla aplicada: cada hack tiene fuente o va marcado `[ESPECULATIVO]`. Evaluación explícita por hack:
> **qué colapsa · qué cuesta · cómo se rompe · reversibilidad**.
> Frontera respetada: no cubro dominio Disney (agente 1) ni solución canónica (agente 3).

---

## 1. CAPTURA DE DATOS — que el agente NO tipee

### H1.1 — Gmail YA parsea las confirmaciones por nosotros: leer Calendar API con `eventTypes=fromGmail` ⭐

Gmail detecta mails de confirmación (vuelos, hoteles, restaurantes, tickets) y **crea automáticamente eventos en Google Calendar** con los datos estructurados (fechas, número de confirmación, link al mail original), y los mantiene actualizados si la reserva cambia ([Google Calendar Help](https://support.google.com/calendar/answer/6084018)). Desde mayo 2024, la **Calendar API v3 distingue esos eventos con `eventType: "fromGmail"`** y permite filtrar `Events.list` y `Events.watch` solo por ese tipo ([Workspace Updates blog](https://workspaceupdates.googleblog.com/2024/05/google-calendar-api-event-type-fromgmail.html), [Event types — Calendar API](https://developers.google.com/workspace/calendar/api/guides/event-types)).

El copiloto **ya tiene Google Calendar integrado vía Composio**. Es decir: el pipeline de extracción ML de Google —entrenado sobre miles de millones de mails— ya corre gratis sobre el inbox del agente, y su output es una API que ya consumimos.

- **Qué colapsa:** construir/pagar parsing para la cola larga de proveedores (vuelos, hoteles no-Disney, restaurantes). El "detector de que llegó una reserva" sale gratis.
- **Qué cuesta:** requiere que el agente tenga activado "Smart Features" en Gmail y "Show events from Gmail" en Calendar (default ON en cuentas consumer); los datos del evento son un resumen, no el detalle completo del booking (precio/comisión NO vienen) — sirve como *trigger + fechas*, el detalle se completa leyendo el mail original (linkeado desde el evento).
- **Cómo se rompe:** mails que llegan por CC/forward/lista no generan evento ([Calendar Help](https://support.google.com/calendar/answer/6084018)); cobertura de confirmaciones *trade* de Disney (mail al agente, no al viajero) es INCÓGNITA — puede que Gmail no las clasifique como "tu reserva"; Google puede cambiar el comportamiento.
- **Reversibilidad:** total — es un canal de señal read-only; si no rinde, se apaga.

### H1.2 — JSON-LD schema.org embebido en el mail: parsear el markup, no la prosa

Google define un estándar público para que emisores embeban **JSON-LD `FlightReservation` / `LodgingReservation` / `FoodEstablishmentReservation`** dentro del HTML del mail de confirmación ([Gmail Markup — Hotel Reservation](https://developers.google.com/workspace/gmail/markup/reference/hotel-reservation), [Getting Started](https://developers.google.com/workspace/gmail/markup/getting-started)). Emitirlo requiere whitelist de Google; **consumirlo no requiere nada** — es leer un bloque `<script type="application/ld+json">` del MIME del mail que ya tenemos vía Composio Gmail. Si el emisor lo incluye, el parsing es `json.loads`, no LLM.

- **Qué colapsa:** para los emisores que lo usan (aerolíneas, cadenas hoteleras, OTAs), el parsing pasa de "problema de NLP" a "problema resuelto por el emisor".
- **Qué cuesta:** un chequeo barato del MIME antes de caer al LLM (fallback chain: JSON-LD → LLM).
- **Cómo se rompe:** **no está verificado que Disney/VAX lo emitan** — y es plausible que no (los mails trade suelen ser templates viejos). Si Disney no lo emite, el hack solo cubre la periferia (vuelos del cliente, hoteles no-Disney).
- **Reversibilidad:** total — es una rama del parser.

### H1.3 — La dirección mágica de forwarding (patrón TripIt) — pero para nosotros es aún más barato: NO hay forward, ya estamos EN el inbox

El patrón consagrado de la industria: forwardeás la confirmación a `plans@tripit.com` y el sistema arma el viaje ([TripIt help — Adding travel plans](https://help.tripit.com/en/support/solutions/articles/103000063275-adding-travel-plans-to-tripit)). Dato clave del nicho: un blogger Disney documentó que TripIt parsea **todos los formatos de Walt Disney Travel Company** — paquetes WDW, mails de dining, Disneyland, Aulani y **Disney Cruise Line** ([Back to the Mouse — TripIt](https://backtothemouse.com/tripit-updated/); TripIt mantiene además un canal formal para que vendors validen su formato: [Vendor confirmation email support](https://help.tripit.com/en/support/solutions/articles/103000127241-vendor-confirmation-email-support)). **Conclusión lateral: los mails de Disney son un formato estable y parseable — otro ya lo hizo con tecnología pre-LLM.** Con un LLM tool-calling (ya en el stack) el parsing de esos mismos templates es un prompt + eval set, no un producto.

Y el colapso mayor: el copiloto **ya tiene Gmail del agente vía Composio** → no necesitamos ni el forward. Watch/poll del inbox con filtro `from:(disneydestinations.com OR disneycruise...)` y la captura es **cero-touch**: el agente no hace NADA, ni siquiera forwardear. La dirección mágica queda como fallback para agentes que no conecten Gmail (Outlook/Yahoo) — se implementa con inbound parse de un ESP (SendGrid/Postmark), commodity.

- **Qué colapsa:** la carga de datos entera del flujo feliz. El evento "vendí un viaje" entra solo.
- **Qué cuesta:** un eval set de mails reales de Disney/VAX (pedírselos al usuario piloto: 20-30 mails históricos) + card de confirmación HITL (ya hay confirm-gate en el motor).
- **Cómo se rompe:** cambios de template de Disney (mitigado: el LLM es robusto a variación, y el confirm-gate ataja errores); mails que NO llegan al inbox del agente (reservas hechas en portal sin mail — verificar con el piloto qué % del flujo tiene mail).
- **Reversibilidad:** alta.

### H1.4 — Parsing-as-a-service comercial: Traxo y AwardWallet (existe, con asterisco Disney)

Existe exactamente lo que la pregunta pedía: **APIs comerciales de parsing de itinerarios**.
- **Traxo CAPTURE / Email Parsing API**: 8.000+ formatos de confirmación, 1.000+ fuentes de booking, ~40 idiomas, escaneo de inbox conectado (Gmail/Outlook) o submission por API; procesa HTML y PDFs adjuntos ([Traxo CAPTURE](https://info.traxo.com/capture), [developer.traxo.com — Email Parsing API](https://developer.traxo.com/docs/public-api/YXBpOjI0MjEzMjY2-email-parsing-api)).
- **AwardWallet Email Parsing API**: promete parsear "cualquier confirmación de cualquier proveedor", incluso itinerario en PDF adjunto, JSON estructurado en segundos, disponible hasta en RapidAPI ([awardwallet.com/email-parsing-api](https://awardwallet.com/email-parsing-api)). **PERO**: su lista pública de proveedores soportados lista tarjetas/aerolíneas/hoteles y **NO muestra Disney, DCL, VAX ni cruceros** ([supportedEmail](https://awardwallet.com/supportedEmail) — verificado 2026-07-20).

- **Qué colapsa:** construir el parser de la cola larga (aéreos, hoteles, autos) y su mantenimiento eterno.
- **Qué cuesta:** contrato B2B (pricing no público), dependencia de tercero en el corazón del producto, latencia de soporte cuando Disney cambie un template.
- **Cómo se rompe:** si justo los formatos que más nos importan (Disney trade, VAX) no están cubiertos — que es lo que sugiere la lista de AwardWallet. Para el core Disney, el LLM propio (H1.3) probablemente gana; el servicio comercial queda como opción para la periferia si el volumen lo justifica.
- **Reversibilidad:** alta si se encapsula tras un boundary `ItineraryParser` (LLM | Traxo | JSON-LD intercambiables).

### H1.5 — `.ics` de Disney: resultado NEGATIVO verificado

My Disney Experience **no tiene export .ics nativo ni feed iCal** de reservas — usuarios lo piden desde 2015 sin respuesta ([planDisney Q&A](https://plandisney.disney.go.com/question/export-itinerary-ical-app-record-things-calendar-thank-383456/), [WDWMAGIC forum](https://forums.wdwmagic.com/threads/anyone-export-their-fp-to-google-calendar-or-ios.906298/)). No apostar por ahí. (El .ics útil que SÍ existe es el de TripIt, ver H1.6.)

### H1.6 — `[GRIS/TOS]` TripIt como parser gratis vía su feed iCal

TripIt expone un **feed iCal privado por usuario** (`tripit.com/feed/ical/private/KEY/tripit.ics`) que refleja todo lo parseado ([TripIt help — Calendar feed](https://help.tripit.com/en/support/solutions/articles/103000063280-calendar-feed-setup-and-sync)) y una **API de desarrollador** ([tripit.github.io/api](https://tripit.github.io/api/doc/v1/)). Pipeline hacky: auto-forward de confirmaciones a `plans@tripit.com` → TripIt parsea (incluye formatos Disney, H1.3) → consumir el feed/API. Parsing de nivel industrial a costo $0.

- **Qué colapsa:** todo el parsing, sin contrato comercial.
- **Qué cuesta / cómo se rompe:** montar un producto B2B sobre cuentas consumer de TripIt casi seguro viola TOS; el feed pierde detalle (precio/comisión); fragilidad total ante un cambio de TripIt. **Útil como benchmark del eval set y como demo, NO como arquitectura.**
- **Reversibilidad:** total (por eso solo sirve de spike/benchmark).

---

## 2. REGLAS QUE CAMBIAN — consumir el trabajo de otros

### H2.1 — El colapso real: NO mantener un motor de reglas — parsear el deadline del documento

Razonamiento de diseño (sin fuente externa; marcado como tal): los deadlines duros por booking (fecha de pago final, vencimiento de depósito, expiración de oferta) **vienen impresos en la propia confirmación** que ya estamos parseando (H1.3). Si el deadline se extrae del documento en vez de derivarse de una tabla de políticas, el problema "las reglas de Disney cambian sin aviso" **deja de existir para el 80% de los casos**: cada booking trae su verdad. La tabla de reglas queda solo para deadlines *derivados/blandos* (ventanas de dining, Lightning Lane, "conviene reservar X a los N días") — y esos toleran estar desactualizados unos días porque son consejos, no obligaciones. `[RAZONAMIENTO — validar contra mails reales: ¿la fecha de pago final figura en la confirmación de WDW/DCL? Alta probabilidad, evidencia pendiente]`

### H2.2 — RSS de la prensa Disney como sensor de cambios de política

La comunidad Disney YA hace el trabajo de vigilancia, con feeds consumibles: **AllEars.net publica sus RSS** ([allears.net RSS feeds](https://allears.net/walt-disney-world/wdw-planning/rss-feeds/)), WDWNT es una redacción de noticias Disney a tiempo real, y **MouseSavers mantiene 300+ páginas de descuentos/políticas actualizadas + newsletter mensual** ([mousesavers.com FAQ](https://www.mousesavers.com/frequently-asked-questions/)). Hay decenas de feeds catalogados ([Feedspot — Top Disney RSS](https://rss.feedspot.com/disney_rss_feeds/)).
Hack: pipe RSS → clasificador LLM barato ("¿esto cambia una regla operativa para agentes? ¿cuál?") → cola de propuestas de cambio con confirmación humana (el operador o incluso el agente-usuario). Mantenemos un *curador*, no un *investigador*.

- **Qué colapsa:** el costo de vigilancia manual de políticas.
- **Qué cuesta:** ruido (la mayoría de las noticias son de atracciones, no de reglas); tuning del clasificador.
- **Cómo se rompe:** sin SLA — un blog puede tardar o errar; por eso alimenta la tabla de reglas *blandas* (H2.1), nunca deadlines duros.
- **Reversibilidad:** total.

### H2.3 — themeparks.wiki: API libre de datos operativos de parques

API REST gratuita y sin auth con horarios, calendarios y estado en vivo de Disney/Universal y 75+ destinos ([themeparks.wiki/api](https://themeparks.wiki/api), [github.com/ThemeParks/parksapi](https://github.com/ThemeParks/parksapi)). No es política de bookings, pero cubre gratis "¿a qué hora abre Magic Kingdom el día del cliente?" — dato que el copiloto va a querer citar en mails/itinerarios.

- **Qué colapsa:** scraping propio de horarios. **Qué cuesta:** nada (rate limits razonables). **Cómo se rompe:** proyecto comunitario sin SLA; degradar con gracia. **Reversibilidad:** total.

### H2.4 — El portal oficial disneytravelagents.com como fuente (el usuario ya está registrado)

Todo agente Disney está registrado en [disneytravelagents.com](https://www.disneytravelagents.com/) (training, updates, booking engine). Los comunicados de cambio de política salen ahí primero. `[ESPECULATIVO en lo técnico: no verifiqué si hay feed/newsletter parseable; lo seguro es que el agente los recibe por mail → esos mails caen en el mismo inbox que ya leemos → el sensor de cambios puede ser el propio parser de inbox]`. Ese cierre — *los avisos de cambio de regla también son mails* — reusa H1.3 sin infraestructura nueva.

---

## 3. DISTRIBUCIÓN — el hack del nicho sin presencia web

### H3.1 — Host agencies como canal mayorista B2B2C ⭐

El nicho está estructurado en **host agencies**: cientos/miles de agentes independientes (ICs) cuelgan de una host que les provee marca, comisiones y — clave — **el stack de herramientas** ("acceso a CRM robusto, marketing, tools" es parte de la propuesta de valor de una host — [Vincent Vacations — Niche Domination](https://www.vincentvacations.com/how-to-travel-agent/niche-domination-choosing-a-host-agency-that-fuels-your-specialty-and-supplier-relationships)). El playbook ya observado: **Tern se distribuye vía partnerships con hosts** (Travel Planners International, Gifted Travel Network — citado en [Pixie Dust CRM — comparison](https://pixiedustcrm.dev/blog/best-crm-disney-travel-agents)). Cerrar UNA host Disney-heavy = cientos de asientos de golpe, con el champion (la host) haciendo el onboarding.

- **Qué colapsa:** adquisición uno-a-uno en un nicho sin canales pagos eficientes.
- **Qué cuesta:** ciclo de venta B2B, pricing por asiento con descuento mayorista, y el riesgo de customizar para una host (capa cliente vs plantilla — disciplina ya doctrinal en este repo).
- **Cómo se rompe:** si la host ya está casada con Tern/TESS; o si exige exclusividad/white-label prematuro.
- **Reversibilidad:** media (un deal mal negociado ata roadmap).

### H3.2 — Los grupos de Facebook SON el canal (y las hosts los administran)

Las hosts Disney operan grupos de Facebook privados y muy activos para sus agentes — Magical Moments Vacations tiene varios (Agent Support, Marketing, Networking) ([findahosttravelagency.com](https://findahosttravelagency.com/host-agencies/magical-moments-vacations)); Boardwalk Travel Agency tiene su grupo privado de agentes ([boardwalktravelagency.com](https://boardwalktravelagency.com/direct-with-disney-or-join-a-disney-travel-host-agency/)). El boca-a-boca de Venselo YA vive ahí. Hack de entrada: no ads — **un agente-usuario feliz mostrando la card de "venta capturada sola" en su grupo**. El demo-de-30-segundos (forwardeá/mostrá un mail → aparece el booking armado) está hecho para ese formato.

- **Qué colapsa:** necesidad de presencia web/marketing clásico. **Qué cuesta:** depende de champions reales — no se compra. **Cómo se rompe:** grupos cerrados expulsan vendors explícitos; tiene que entrar como recomendación de par. **Reversibilidad:** total.

### H3.3 — Listing gratis en Host Agency Reviews

HAR es el directorio B2B más grande del sector y abrió **perfiles de software de agencia gratuitos con reviews** (40 vendors ya listados) ([TravelPulse — HAR launches software profiles](https://www.travelpulse.com/news/agents/host-agency-reviews-launches-new-travel-agency-software-profiles), [hostagencyreviews.com](https://hostagencyreviews.com/)). Costo cero, descubrimiento pasivo, y las reviews de los primeros usuarios son el activo.

### H3.4 — Señal de mercado: el nicho YA paga software Disney-specific (y nadie lo cerró)

Existen al menos tres CRMs **específicos para agentes Disney**: Pixie Dust CRM ($9.99–29.99/mes), Travel Mouse (viejo, base leal), Travel+ (~$10/mes) — contra genéricos TravelJoy ($19–32), Tern ($35–39) ([Pixie Dust CRM comparison](https://pixiedustcrm.dev/blog/best-crm-disney-travel-agents)). Lectura lateral: (a) el willingness-to-pay está probado a $10–40/asiento/mes; (b) los features que venden son *tracking* (ADRs, deadlines, dining) — **ninguno vende captura cero-touch ni proactividad**: el espacio del "secretario activo" está vacío; (c) sus blogs comparativos revelan el playbook de distribución del nicho (SEO de comparación + hosts + FB).

### H3.5 — Etsy como termómetro y top-of-funnel

Hay un mercado activo de **planillas de tracking para agentes Disney en Etsy** — client trackers "para no perderte nunca un deadline", bundles de 170+ templates con licencia comercial ([Etsy — Client Tracker for Travel Agents](https://www.etsy.com/listing/1353308285/client-tracker-for-travel-agents-client), [Etsy — Disney TA Planner Bundle](https://www.etsy.com/listing/1522461657/disneyworld-travel-agent-planner-bundle)). Doble uso: (a) prueba del dolor en las palabras del mercado ("never miss a deadline"); (b) `[ESPECULATIVO como táctica]` publicar una planilla-lead-magnet que al final diga "esto que hacés a mano, Venselo lo hace solo" — canal de $0 hacia el buyer exacto.

---

## 4. ARRANQUE EN FRÍO — importar la historia sin migración

### H4.1 — El inbox ES el backup del negocio: backfill de Gmail ⭐

El mismo parser de H1.3 corrido **hacia atrás**: búsqueda Gmail vía Composio (`from:disneydestinations.com OR from:dcl... newer_than:2y`) sobre 1–2 años de historia → cada confirmación histórica se re-ingesta → el libro de ventas, los clientes y los viajes pasados se reconstruyen **sin pantalla de importación, sin CSV, sin tipeo**. El onboarding se vuelve: "conectá tu Gmail, mirá cómo aparece tu negocio". Es el mismo movimiento con el que Traxo CAPTURE hace inbox-scanning retroactivo ([Traxo CAPTURE — BusinessWire](https://www.businesswire.com/news/home/20161114005821/en/New-Traxo-CAPTURE-Suite-Leverages-Email-Inbox-Scanning-for-Comprehensive-Travel-Data-Aggregation)), pero con nuestro parser y nuestro grafo.

- **Qué colapsa:** el cold start ENTERO — se funde con la feature de ingesta (una sola cosa que construir); además es el momento-mágico de venta (H3.2).
- **Qué cuesta:** costo LLM del backfill (acotable: filtrar por remitentes conocidos primero, batch económico); deduplicación (modificaciones/cancelaciones del mismo booking → el fingerprint/idempotencia ya es doctrina del stack).
- **Cómo se rompe:** agentes con inbox no-Gmail (fallback: dirección mágica H1.3); historia que vivió en portal sin mails.
- **Reversibilidad:** total (re-ingesta idempotente).

### H4.2 — La planilla existente: mapping por LLM, no wizard de columnas

El estado del arte canónico es el import-spreadsheet con corrección de errores (así migra Tern: [help.tern.travel — Import agency bookings](https://help.tern.travel/en/articles/9921402-import-agency-bookings-into-tern)). El atajo: **Sheets ya está integrado vía Composio** y el LLM hace el column-mapping de UNA pasada (lee headers + 5 filas → propone mapping → card de confirmación → ingesta). Bonus: las planillas del nicho están semi-estandarizadas de facto por los templates de Etsy (H3.5) — un puñado de layouts cubre a muchos agentes.

### H4.3 — WhatsApp: export nativo `.txt` + minería LLM

WhatsApp exporta cualquier chat a `.txt` con timestamps y remitentes desde la app móvil, feature nativa ([WhatsApp export guides](https://www.mosaicchats.com/blog/how-to-export-whatsapp-chat)); hay parsers open source del formato ([github.com/mazen160/whatsapp-chat-parser](https://github.com/mazen160/whatsapp-chat-parser)). Para el agente que "lleva el negocio por WhatsApp": exportar los chats de clientes → minería LLM (nombres, viajes, montos, promesas) → candidatos a booking con confirmación. No es cero-touch pero es un-solo-paso.

- **Cómo se rompe:** export manual chat-por-chat (tedioso si son 50 clientes); privacidad — SOLO con consentimiento explícito y procesamiento en nuestro stack. **Reversibilidad:** total.

---

## 5. ATAJOS DE CONSTRUCCIÓN — dónde NO construir

| Problema | NO construir | Usar | Fuente | Nota |
|---|---|---|---|---|
| Parsing de itinerarios (cola larga) | Parser propio de 1.000 proveedores | **Traxo Email Parsing API** / **AwardWallet Email Parsing API** | [developer.traxo.com](https://developer.traxo.com/docs/public-api/YXBpOjI0MjEzMjY2-email-parsing-api), [awardwallet.com/email-parsing-api](https://awardwallet.com/email-parsing-api) | Cobertura Disney/VAX sin confirmar (lista visible de AwardWallet no los incluye) — para el core Disney, LLM propio + eval set |
| Motor de deadlines | Scheduler/cron/cola propia | **Temporal timers** (ya en el stack — el moat declarado) | CLAUDE.md del repo | El "motor de deadlines" es un workflow con `sleep_until(deadline - aviso)`; costo marginal ~0 |
| Notificación multicanal | Fan-out propio email/SMS/push/WhatsApp | **Novu** (open source, self-hostable, 60+ providers, digests) | [github.com/novuhq/novu](https://github.com/novuhq/novu) | Alternativas comerciales: Knock, Courier. Ojo sobreingeniería: si v1 es solo PWA push + Gmail, Novu puede esperar |
| Datos operativos de parques | Scraper propio | **themeparks.wiki API** (gratis, sin auth) | [themeparks.wiki/api](https://themeparks.wiki/api) | Sin SLA — degradar con gracia |
| PDFs adjuntos (facturas, itinerarios escaneados) | OCR propio | Document AI (skill `documentai-expert` ya instalada en el harness del operador) | interno | Solo si el LLM multimodal no alcanza |
| Vigilancia de cambios de política | Equipo de research | RSS AllEars/WDWNT/MouseSavers + clasificador LLM (H2.2) | [allears.net RSS](https://allears.net/walt-disney-world/wdw-planning/rss-feeds/) | Solo reglas blandas |

Verificado también en negativo: **VAX VacationAccess** tiene web-API orientada a que *suppliers* distribuyan producto ([webapi.vaxvacationaccess.com](https://webapi.vaxvacationaccess.com/), [Breaking Travel News 2005](https://www.breakingtravelnews.com/news/article/btn20050216105940730/)) — no encontré export CSV/API self-service para el *agente*; hay integraciones a sistemas de back-office tipo Tres/ClientBase ("Import Reservation" — [Tres Technologies](https://trestechnologieshelp.zendesk.com/hc/en-us/articles/4405239129363-VAX-VacationAccess-Vacations)), lo que sugiere que el dato estructurado de VAX existe pero por canales partner. `[PENDIENTE VERIFICAR con el usuario piloto: qué mails manda VAX al agente — probablemente la vía real sea otra vez el inbox]`

---

## 6. AUTOMATIZACIONES CASERAS DE AGENTES REALES — el dolor ya validado gratis

- **"Send Final Payment Reminder" es LA tarea nombrada.** Las guías de automatización del propio nicho ponen el recordatorio de pago final como el riesgo #1 ("olvidarlo arriesga la cancelación del booking") y lo resuelven con VacationCRM + Zapier + checklists en Trello/ClickUp ([Travel Agent Pro — Ultimate Guide VacationCRM + Zapier](https://www.travelagentpro.com/how-to-travel-agent/the-ultimate-guide-to-automating-your-travel-business-vacationcrm-zapier), espejo en [Vincent Vacations](https://www.vincentvacations.com/how-to-travel-agent/the-ultimate-guide-to-automating-your-travel-business-vacationcrm-zapier)). → El MVP de proactividad tiene su spec escrita por el mercado: *deadline de pago final, avisado a tiempo, con el mail redactado*.
- **Recordatorios de pago desde Google Sheets + mail merge** es un patrón pedido en foros de Zapier ([Zapier Community](https://community.zapier.com/how-do-i-3/how-do-i-automate-monthly-payment-reminders-and-receipts-from-google-sheets-using-zapier-41688)) — la versión artesanal exacta de lo que el copiloto hace nativo.
- **Los trackers de Etsy** (H3.5) son la otra mitad: el schema de campos que los agentes ya usan a mano (cliente, parque, resort, dining, deadlines, comisión) — spec de producto gratis.
- **TripIt como herramienta DIY del nicho Disney** ([Back to the Mouse](https://backtothemouse.com/tripit-updated/)) — un usuario real resolviendo captura por forwarding; valida el hábito de forwardear mails.
- Búsqueda en Reddit (r/travelagents + variantes) dio resultados pobres desde el buscador — **no encontré** el hilo "mirá mi automatización con ChatGPT" del nicho. Honestamente: la evidencia de DIY viene de blogs de hosts y Zapier community, no de Reddit. `[GAP — un barrido manual de r/travelagents y grupos FB con cuenta real puede rendir más]`

---

## LOS 3 ATAJOS QUE MÁS CAMBIAN EL PROYECTO SI SON CIERTOS

### 1. El inbox como fuente única: captura cero-touch + cold start son LA MISMA feature (H1.3 + H4.1)
Si los mails de confirmación de Disney/VAX que recibe el agente contienen los datos del booking (fechas, montos, deadline de pago), entonces captura en vivo, arranque en frío e incluso el sensor de cambios de política (H2.4) colapsan en un solo componente: *parser de inbox con confirm-gate*. El agente no tipea nunca y el onboarding es un momento mágico.
**Spike (barato, 1 sesión):** pedirle al usuario piloto 20–30 mails reales (WDW package, DCL, modificación, cancelación, VAX si usa). Correr el LLM del stack con un prompt de extracción sobre esos mails. Medir: % de extracción correcta de {cliente, destino, fechas, monto, deadline de pago final, nº de confirmación}. Gate: ≥90% con confirm-gate humano. De paso responde H2.1 (¿viene el deadline impreso?) y H1.2 (grep `application/ld+json` en el MIME).

### 2. Gmail ya parseó todo: Calendar API `eventTypes=fromGmail` (H1.1)
Si las confirmaciones que recibe el agente generan eventos `fromGmail`, tenemos detector de reservas + fechas estructuradas gratis, mantenido por Google, sobre una API ya integrada — cubre la cola larga (vuelos/hoteles no-Disney) sin parser propio.
**Spike (casi gratis, 30 min):** con la cuenta Google del piloto (o una de prueba a la que se reenvían confirmaciones reales), llamar `Events.list(eventTypes="fromGmail")` vía Composio y ver qué aparece — específicamente si un mail de confirmación **trade** de Disney (dirigido al agente, no al viajero) genera evento o no.

### 3. Una host agency = cientos de asientos (H3.1)
Si una host Disney-heavy adopta el copiloto como "el stack que le damos a nuestros agentes", la distribución sin presencia web deja de ser problema: el canal ya existe, tiene grupos de FB activos y el playbook está probado por Tern con TPI/Gifted Travel Network.
**Spike (no-código, 1 conversación):** mapear con el usuario piloto de qué host cuelga (o cuáles conoce), y validar 3 preguntas: ¿qué tooling les da hoy la host? ¿la host paga herramientas para sus ICs o cada agente paga la suya? ¿quién decide? Con eso se sabe si el canal es host-B2B2C o asiento-a-asiento — decisión que define pricing y GTM antes de escribir una línea de frontend comercial.
