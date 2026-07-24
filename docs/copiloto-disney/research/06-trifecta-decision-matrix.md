# DECISION_MATRIX — Copiloto vertical para agentes de viajes Disney

> **Trifecta cognitiva 4/4 — síntesis.** Árbol IF/THEN que ata el estado del arte × el mapa de fallos a decisiones arquitectónicas concretas. Fecha: 2026-07-20.
>
> **Inputs (los 5 leídos completos), abreviados así en la columna "Por qué":**
> - `DOM` = `sota-agente-disney.md` (dominio: cómo opera el agente, fechas-regla, comisiones)
> - `VEN` = `venselo-modelo-dominio.md` (modelo de dominio del competidor)
> - `CAN` = `trifecta-1-sota-canonico.md` (estado del arte canónico)
> - `LAT` = `trifecta-2-sota-lateral.md` (hacks que colapsan el problema)
> - `FM` = `trifecta-3-failure-map.md` (30 modos de fallo F1.1–F9.4 + S.1–S.4)
>
> **Restricciones fijadas por el operador (no se re-litigan acá):** producto comercial US$50/usuario/mes posicionado como categoría nueva ("copiloto/secretario") · núcleo agnóstico + primer mercado LatAm/USD · **línea roja: prohibido usar credenciales My Disney Experience del cliente final** · la proactividad es el eje y el filtro de precisión ES el producto.
>
> Toda decisión sin respaldo en los 5 documentos va marcada `[JUICIO PROPIO]`.

---

## 0. Contradicciones entre documentos — resueltas ANTES de la matriz

La matriz depende de estas resoluciones; se resuelven explícito, no se promedian.

### C-0.1 — "No mantengas motor de reglas, el deadline viene en el mail" (LAT H2.1) vs. "las reglas son datos versionados curados por un experto" (CAN §2.1, FM F2.1/F2.3)

**Ambas son ciertas en dominios distintos. Hay DOS clases de deadline y cada doctrina gobierna una:**

1. **Deadlines contractuales por booking** (fecha de pago final, vencimiento de depósito, expiración de oferta): son específicos de ESA reserva y el proveedor los imprime en la confirmación. Fuente primaria = **el documento extraído**. LAT H2.1 gana acá — y FM F2.1 lo confirma desde el otro lado: su mitigación dice literalmente "doble fuente (fecha extraída del mail ≻ fecha derivada)".
2. **Ventanas de acción** (ADR día-60 / regla 60+10, Lightning Lane día-7/3 a las 7:00 AM ET, check-in online día-60, excursiones DCL por nivel Castaway Club — DOM §3): **NO vienen impresas en ningún mail** — son conocimiento de dominio que solo puede salir de un **ruleset versionado con vigencia** (patrón legal docketing, CAN §2.1). El lente lateral no las cubre y lo admite ("la tabla de reglas queda solo para deadlines derivados/blandos").

**Síntesis operativa (fila R1):** motor dual-source. El ruleset es más chico de lo que el canónico sugiere (no deriva lo que el documento ya trae) y más necesario de lo que el lateral admite (sin él no existen las ventanas ADR/LL, que son la mitad del dolor documentado en DOM §2.3/§4). Bonus emergente: **cuando ambas fuentes existen, la divergencia es un canary gratis** — si N bookings entrantes traen fechas que difieren de lo que el ruleset deriva, la regla quedó obsoleta (detección automática de F2.3, el cambio ADR 180→60).

### C-0.2 — Captura "cero-touch" (LAT H1.3/H4.1) vs. confirm-gate humano en la ingesta (FM F3.2/F3.3/F5.1)

**Falsa contradicción si se separa tipeo de confirmación.** Cero-touch significa **cero-TIPEO** (el dato entra solo del mail), no cero-supervisión. El pipeline crea registros en estado `draft`; el usuario confirma cards de un tap (en batch para el backfill). Eso preserva el momento-mágico del onboarding (LAT: "conectá tu Gmail, mirá cómo aparece tu negocio") Y la defensa contra el 3.5–28.7% de error de extracción (FM F3.2) Y el efecto Dietvorst-2018 (dar control reduce la algorithm aversion, FM F5.1). La autonomía se gradúa después por track record, no se regala el día 0.

### C-0.3 — "Email parsing para agentes Disney es terreno inexplorado, la reserva no llega como mail estructurado consistente" (DOM §6) vs. "TripIt ya parsea todos los formatos de Walt Disney Travel Company" (LAT H1.3)

**Ambas ciertas sobre objetos distintos.** La evidencia TripIt prueba que los mails de confirmación **consumer-facing** (al viajero) son plantillas estables y parseables — pre-LLM. Lo NO verificado es el **mail trade al agente**: si llega, qué trae (¿monto? ¿deadline de pago? ¿comisión?), y qué % del flujo real deja rastro de mail (reservas hechas en portal DTA/VAX podrían no generar mail al agente — DOM §2.1 no lo confirma). **Esta es exactamente la incógnita del Supuesto Crítico S1** — el más grande del proyecto. La matriz asume que S1 se valida; si S1 falla, ver el plan B declarado en la sección de supuestos.

---

## 1. LA MATRIZ IF/THEN

Formato: `#` | SI (condición) | ENTONCES (decisión concreta) | Por qué (fuente) | ¿Reversible? | Costo si nos equivocamos.

### Eje CAPTURA (pipeline de extracción)

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| C1 | Los mails B2C son instancias de plantillas y algunos emisores embeben JSON-LD schema.org en el MIME | Pipeline de extracción **en capas con orden fijo**: (0) grep `application/ld+json` en el MIME → `json.loads`, sin LLM; (1) template conocida (fingerprint remitente+estructura) → extractor determinista cuando se acumule volumen por remitente; (2) LLM con structured output nativo (constrained decoding), `temperature=0`, schema Pydantic `BookingExtraction`; campo ausente = `null` explícito, **nunca inferido** | CAN §3.1–3.3 (Juicer/TripIt `[PROD]`; constrained = 100% schema-valid); LAT H1.2; FM F3.2 | Sí — capas independientes tras un boundary `ItineraryParser` | Medio: solo-LLM sube COGS y tasa de error; solo-templates se rompe con cada cambio de formato (FM F3.1) |
| C2 | El LLM baseline alucina campos plausibles en 28.7% de docs (68% de errores financieros = números inventados) | **Groundedness check obligatorio** post-extracción: cada valor debe localizarse literalmente (match normalizado) en el mail fuente; no localizable → `null` + `confidence=0`. Validadores deterministas: fechas dentro del rango del viaje, montos > 0, formato de confirmation number por proveedor (DOM muestra 2 formatos reales: `42774707`, `W8K614U2` — VEN §1.1) | FM F3.2 (validación multi-etapa baja 28.7% → 3.5%); CAN §3.4.4 | Sí | Alto: sin esto, F3.3 (Zillow) — el registro plausible-falso alimenta alertas y links de cobro río abajo |
| C3 | Schema-valid ≠ correcto; la correctitud solo existe contra golden set field-level | **Golden set desde el día 0**: los 20–30 mails del piloto anotados a mano son la semilla; métrica = precision/recall **por campo** (no por documento); corre en CI ante todo cambio de prompt/modelo; **toda corrección humana en una card alimenta el golden set**. Campos críticos (monto, deadline, confirmation number) con confidence < umbral → card de confirmación de un tap con el fragmento del mail fuente al lado del valor | CAN §3.4.1–3.4.3 `[PROD]` (doctrina IDP completa) | Sí | Alto: sin golden set no hay migración de modelo segura (FM F9.2) ni tuning sin regresión invisible |
| C4 | Un error de ingesta que entra "confirmado" envenena deadlines y plata (F3.3) y la aversión post-error es irreversible (F5.1) | **Nada entra al ledger como confirmado sin aprobación humana en v1**: la ingesta crea `draft` con provenance (link al mail fuente); confirmación individual o en batch. La autonomía (auto-confirm de campos con historial de 100% aciertos por template) se gana por track record medido, por tenant — nunca es default | FM F3.3, F5.1 (Dietvorst 2018: control reduce aversión); CAN §6.3 (autonomía graduada); C-0.2 | Sí (es relajable con datos) | Bajo el costo de mantenerlo; altísimo el de no tenerlo (una fecha falsa confirmada sola = cuenta perdida + viralización en nicho denso, FM F5.2) |
| C5 | Hay ventas sin rastro de mail (reserva de portal, teléfono) — % desconocido hasta el spike S1 | Fallbacks en orden: (1) **entrada conversacional** ("cargá paquete Disney para Juan, check-in 3/8" → el motor ReAct completa por diálogo — VEN §5 fila 1); (2) import de planilla (O4); (3) formulario como último recurso. **Métrica de salud: % de ventas por canal de entrada** (parser vs conversación vs manual) por tenant | FM F7.1 (la carga manual es la curva de muerte del CRM); VEN §5 | Sí | Medio: sin fallback, cobertura parcial del inbox = ledger incompleto = deadlines que faltan (F1.3 por omisión de datos) |
| C6 | La lectura de Gmail vía scopes restringidos exige CASA anual (USD 500–4.500+/año) y hoy entramos vía Composio | v1 usa **Composio Gmail** (ya integrado, policy fail-closed existente) para el piloto/beta; se diseña desde el día 0 el boundary `MailSource` con dos implementaciones: `composio_gmail` y `forward_address` (inbound parse de ESP — SendGrid/Postmark, patrón TripIt `plans@`), de modo que la dirección mágica cubra Outlook/Yahoo Y sirva de escape si el costo de scopes explota. Quién absorbe CASA con Composio = **supuesto S6, verificar antes de GA** | FM F3.5 (mitigación textual: "forward de mails a dirección propia no requiere scopes"); LAT H1.3; FM F9.3 | Sí (por el boundary) | Alto si se ignora: corte de acceso Google = producto muerto tal como está diseñado (F3.5 severidad ALTA) |
| C7 | El pipeline de ingesta muere en silencio (token OAuth vencido, webhook caído): HTTP 200, 0 mails, sin síntoma | **Dead man's switch por tenant**: cada poll/push exitoso registra heartbeat (incluso "0 mails matcheados" es éxito); sin heartbeat en la ventana esperada → alerta al operador **y al usuario** ("hace N días no veo mails tuyos"). El silencio ES la alarma; jamás inferir "no hubo ventas" de "no llegaron mails" | FM F3.4 (probabilidad ALTA, certeza operativa) | Sí | Alto: el usuario cree estar cubierto mientras los deadlines nuevos no existen |
| C8 | Tras validación multi-etapa queda ~3.5% de error residual — y a volumen es certeza estadística | El residuo se gestiona con **defensa en profundidad, no con más precisión de extractor**: (a) draft-first (C4); (b) cross-check dual-source en fechas (R1: documento vs ruleset, divergencia ≥1 día → card de discrepancia); (c) detección de outliers en montos/fechas fuera de distribución; (d) show-your-source en el punto de consecuencia (X2): al aprobar un cobro/alerta importante el usuario ve el fragmento del mail | FM F3.2/F3.3 (mitigación por capas); CAN §3.4.4 | Sí | Alto: perseguir 0% de error de extractor es gold-plating; no gestionar el residuo es Zillow |

### Eje AISLAMIENTO DEL LLM (lethal trifecta)

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| A1 | Este sistema arma la lethal trifecta **por spec**: datos privados + contenido de terceros arbitrarios (cualquiera puede mandarle un mail a un usuario) + canales de salida con consecuencia | **Dos componentes LLM separados sin contexto compartido, por construcción:** (a) **Extractor** — lee MIME crudo; SIN tools, SIN acceso al ledger, SIN memoria; output = exclusivamente JSON tipado validado contra Pydantic; corre como activity aislada con su propio prompt y modelo; (b) **Agente conversacional** (motor ReAct existente) — tiene tools y confirm-gate; ve SOLO registros estructurados del ledger; **jamás recibe cuerpo crudo de mail de tercero en su contexto**. El único canal entre ambos es el registro tipado en Postgres | FM F4.3 + riesgo-killer #1 (EchoLeak CVE-2025-32711 zero-click; doctrina OWASP LLM01/Willison: "no existe mitigación confiable a nivel prompt — la única defensa es arquitectónica") | **NO — es EL boundary del sistema; retrofitearlo después es rewrite** | El peor ratio costo-de-arreglar-tarde de todo el mapa; un incidente de exfiltración publicado mata la categoría |
| A2 | Los campos de texto libre extraídos (nombres, notas del mail) igualmente terminan en prompts del agente al redactar | Texto extraído se trata como **dato, nunca instrucción**: entra a prompts solo como slot delimitado/spotlighted, con longitud acotada; render inert en UI. **Red-team corpus de mails maliciosos en CI** (inyecciones en subject/body/nombres) como test de regresión permanente | FM F4.3 (detección); CAN §6 | Sí | Medio: es la segunda capa; la primera es A1 |
| A3 | Un mail entrante puede ser el origen causal de una acción con plata | **Regla dura v1**: contenido de mail entrante solo puede producir (1) registros `draft` y (2) sugerencias visibles en UI; **jamás dispara por sí solo una acción outbound, ni siquiera "pre-aprobada"**. Toda cadena mail→acción pasa por un humano que ve la fuente. Relajar esto = decisión MAYOR (ver §2, decisión M2) | FM riesgo-killer #1: "qué acciones pueden ser originadas causalmente por un mail define el boundary central y no es reversible barata" | Sí en dirección restrictiva→permisiva (con datos); cara al revés | Un atacante dirigiendo un link de cobro vía mail = incidente terminal (F4.3 + F5.2) |

### Eje MODELO DE DATOS

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| D1 | Venselo funde Venta+Cliente+Reserva en un registro y ese es su hueco más caro (sin historial por cliente, sin acompañantes, sin dedupe) | Entidades normalizadas día 0: **`Client`** (dedupe por email/tel, vista 360°), **`Booking`** (keyed por confirmation number del proveedor; upsert = operación central de re-ingesta), **`Sale`** (dimensión financiera: montos, %, split, plus), **`TravelerParty`** (acompañantes + edades — pricing niños Disney), **`Deadline`** (derivada, ver D4). Booking ≠ Sale: una booking acumula modificaciones/reprecios (nuevos mails, mismo confirmation number) como historia | VEN §1.3/§4 (evidencia negativa observada) y §5 (filas "descartar patrón"); FM F2.4 (upsert por confirmation number) | Media (migrar de embebido a normalizado después = doloroso) | Alto: sin `Client` normalizado no existe "¿qué le vendí a María?" ni re-marketing de temporada baja (E3) |
| D2 | El % de split cambia en el tiempo y el historial financiero no debe recalcularse solo | **Snapshot obligatorio**: montos de comisión computados y persistidos al confirmar la venta, junto con el % y la regla aplicada; cambios de config solo afectan ventas futuras. Split default global + override por venta (patrón Venselo correcto, se adopta tal cual) | VEN §2.3 (ambigüedad resuelta a snapshot: "la única opción financieramente correcta") | Sí | Medio: recálculo retroactivo silencioso = ledger no auditable |
| D3 | "El cliente pagó", "el viaje ocurrió" y "el proveedor liquidó la comisión" son tres flujos independientes (WDW paga 7–10 días post-checkout; Universal 30 días post-travel; DCL contradictorio) | **Tres máquinas de estado separadas**: `PaymentStatus` (cliente→proveedor: reserved→payment_plan→paid_full), `TripStatus` (upcoming→traveling→completed→cancelled), `CommissionStatus` (pending→expected→received→reconciled) con **`expected_payout_date` derivada por regla de proveedor** — habilita el tablero "cuánta plata te deben y cuándo llega", que ningún CRM de la categoría da (la reconciliación es manual contra PDFs de 30–100 líneas) | VEN §2.2 (flag `comision_cobrada` independiente — adoptar) y §5 (separar FSM); DOM §1.4 (timings oficiales) y §2.1 (Toggle existe porque el gap existe) | Sí | Medio: el enum monolítico de Venselo es deuda de diseño conocida |
| D4 | Los deadlines tienen dos orígenes con autoridad distinta (C-0.1) | `Deadline` lleva **`source ∈ {document, ruleset}`** + `source_ref` (mail_id o rule_id+versión) + `seen_at` (staleness) + `pinned_by_user` (D5/P4). Todo deadline puede responder "¿de dónde salió esta fecha?" en un tap | C-0.1; FM F2.1/F5.1 (show-your-source; control del usuario) | Sí | Alto: sin provenance no hay cross-check ni confianza recuperable post-error |
| D5 | Las ventanas Disney abren a hora fija US Eastern con DST, los usuarios están en otras TZ (Argentina no tiene DST), y la hora exacta de corte del pago final NO está publicada | Fechas futuras se persisten como **fecha/hora local + IANA timezone del evento** (`America/New_York` para ventanas Disney); el instante UTC se computa en ejecución (Temporal Schedules con timezone explícita); **nunca offset UTC fijo persistido**. Donde la hora de corte es desconocida (pago final WDW — DOM §3.4.6), la alerta ancla al **día anterior** — prohibido asumir 11:59pm. Tests de propiedad cruzando transiciones DST | CAN §2.4 (doctrina que invierte el instinto); FM F2.2 (Salesforce 2019; 2 transiciones DST/año garantizadas); DOM §3.1 (6:00/7:00 AM ET; corte no encontrado) | Sí | Alto: ±1h en una ventana ADR/LL = daño real y visible al cliente final |
| D6 | Núcleo agnóstico con primer mercado concreto es restricción del operador; Venselo es mono-moneda US$ | Parametrización estructural día 0: montos = `(amount, currency)`; reglas, plantillas de extracción y copy keyed por `(provider, product_type, market)`; contenido user-facing con i18n es/en desde el schema. **Sin integración nueva hasta que el primer mercado la pida** — parametrizar ≠ construir para todos | Restricción del operador; VEN §4 (hueco multi-moneda); FM F6.3 (multi-supplier by design) | Sí | Retrofit de moneda/proveedor sobre ledger vivo = migración con datos en prod (MAYOR evitable hoy gratis) |
| D7 | La bitemporalidad completa (XTDB/temporal tables) tiene costo y el único caso que la paga acá es "¿qué sabía el sistema cuando alertó?" | **Bitemporalidad selectiva, no plataforma**: `seen_at`/`recorded_at` en Booking/Deadline + **log inmutable de alertas emitidas con snapshot del dato usado al momento de emitir**. Nada más. `[JUICIO PROPIO en el recorte exacto]` | CAN §2.3 ("bitemporalidad solo donde la auditoría lo justifique") | Sí | Bajo: si un día hace falta más, se agrega; al revés es sobreingeniería día 0 |

### Eje MOTOR DE REGLAS

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| R1 | (C-0.1 resuelta) Deadlines contractuales vienen en el documento; ventanas de acción solo pueden salir de conocimiento de dominio | **Motor dual-source**: (a) deadline contractual → fuente primaria = valor extraído del mail; el ruleset **recomputa en paralelo como cross-check**: divergencia ≥1 día → card de discrepancia al usuario + telemetría (nunca resolución silenciosa); (b) ventana de acción (ADR 60/60+10, LL 7/3, check-in online 60, Castaway tiers, promos) → solo del ruleset. **Divergencia estadística (≥N bookings) entre extraído y derivado = alarma de regla obsoleta** — el canary automático de F2.3 | C-0.1; LAT H2.1; CAN §2.1; FM F2.1/F2.3 | Sí | El core value prop: una regla vieja aplicada en masa = F5.1 en todos los tenants a la vez |
| R2 | Disney cambia políticas varias veces al año sin aviso (ADR 180→60; DCL depósito 20%→10% jun-2025; cancelación dining 24h→2h feb-2026) | **Reglas = filas en Postgres, append-only, con `effective_from/effective_to`** (patrón Effectivity de Fowler), keyed por `(provider, product_type, market)`, cada una con `source_url`, `captured_at` y `confidence ∈ {verified, advisory}`. Cambio de regla = fila nueva + recomputación en cascada de deadlines `source=ruleset` afectados + diff notificado. Reglas NUNCA en código | CAN §2.1/§2.3 `[PROD]` (docketing: 2,500+ jurisdicciones como datos); FM F2.3; DOM §3 (3 cambios recientes documentados) | Sí | Reglas en código = deploy por cada cambio de Disney + sin historia de qué regla aplicó a qué alerta |
| R3 | La fecha base cambia después de cargada (modificaciones son rutina: reprecios, cambios de resort/fecha) | **Recomputación en cascada como operación de primera clase**: upsert de Booking → recompute de TODOS los deadlines derivados → diff → cancelar/reprogramar timers Temporal (T1) → notificar solo cambios materiales. Modelo de 3 niveles case→trigger→event del docketing: Booking = case, fecha base = trigger, Deadline = event | CAN §2.1 (CourtAlert: "EL feature central, no un extra"); FM F2.4 (staleness = alerta "correcta" pero falsa) | Sí | Alto: sin cascada, cada modificación deja deadlines huérfanos alertando sobre la reserva vieja |
| R4 | El ruleset necesita un owner humano con SLA (CompuLaw mantiene equipo full-time de abogados; sin owner, el producto promete precisión que nadie sostiene) | v1: **owner = operador, con sensor semi-automático**: RSS AllEars/WDWNT/MouseSavers + los mails de disneytravelagents.com (llegan al mismo inbox ya parseado — LAT H2.4) → clasificador LLM barato ("¿esto cambia una regla operativa?") → **cola de propuestas de cambio con diff, aplicadas por humano**. Curador, no investigador. El modelo de largo plazo (¿quién cura al escalar? ¿usuaria-cero como reviewer pagada?) = decisión MAYOR M3 | FM riesgo-killer #2; CAN §2.1; LAT H2.2/H2.4 | Sí | El "60 días de ADR" desactualizado un mes = F2.3 masivo; y venderlo sin owner = codificar la esperanza |
| R5 | Hay reglas del dominio SIN verificar (tabla de cancelación Universal: 2 vs 3 tramos entre dos espejos del T&C oficial; tramos DCL; horas ET de corte) | Ninguna regla entra sin `source_url + captured_at`; las `[NO VERIFICADO]` se cargan como `confidence=advisory` y **el copy de la alerta refleja la confianza**: "según T&C 2026 (verificado)" vs "verificá contra tu confirmación". Advisory nunca dispara clase `critical` (P1) por sí sola | DOM §3.3/§3.4 (discrepancias listadas); doctrina no-codificar-la-esperanza del repo | Sí | Afirmar categóricamente una regla falsa = F5.1 con la agravante de que la fuente éramos nosotros |

### Eje PROACTIVIDAD

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| P1 | El override clínico llega a 90%, la aceptación cae ~30% por reminder adicional, y >6 push/semana triplica el uninstall | **Tiering duro de 3 clases** con presupuesto: **(a) `critical`** — pago final ≤7 días, depósito por vencer, discrepancia de fechas: interrumpe, multicanal, **requiere ACK, never-suppress** (auditoría: todo deadline <X días DEBE tener alerta emitida y acusada); **(b) `actionable`** — ventana ADR/LL abre en N días, check-in online disponible: **digest diario** a hora elegida por el usuario; **(c) `info`** — comisión esperada, cambios menores: solo tablero/log. Cap de push no-críticas ≤3/24h + quiet hours; las críticas no se capean pero se deduplican por cliente-viaje | CAN §1 (Horvitz: interrumpir sii valor esperado > costo; tiering; precision-first); FM F1.1/F1.2/F1.3 | Sí (los umbrales son config) | La clase (a) mal asignada mata en ambas direcciones: de más → fatiga (F1.1); de menos → el pago final en el digest no leído (F1.3, el cliente final pierde el viaje) |
| P2 | La métrica de calidad de una alerta no es cuántas mando sino cuántas provocan acción — y la decisión de "despertar" no necesita LLM | **La decisión de disparo es 100% determinista** (reglas + tiers; el LLM solo redacta el cuerpo — y si el LLM está caído, degrada a plantilla pura, F9.1). Instrumentación día 0: por alerta → `opened/actioned/dismissed/ignored`; por tenant → acceptance rate por clase. **Tuning loop**: acceptance de clase (b) < 40% en un tenant → auto-degradar a digest semanal para ese tenant y decírselo. `[JUICIO PROPIO el umbral 40%; el mecanismo es CAN §1.2]` | CAN §1.2/§1.4 (precision como métrica gobernante; feedback loop de aceptación); FM F1.1 (detección) | Sí | Sin la señal de aceptación no hay tuning — el canal se degrada a spam sin que lo veamos |
| P3 | El usuario ignora N alertas seguidas | **Nunca escalar volumen** (anti-patrón). (1) Clase `critical` con deadline real: escalamiento de **canal** con ACK obligatorio (push → email → futuro WhatsApp), patrón docketing/carriers; (2) clases (b)/(c): auto-degradar frecuencia + UNA pregunta explícita ("¿estas alertas te sirven? ajustemos"). Ignorar-N es señal de tuning por tenant, no de insistencia | FM F1.1/F1.3; CAN §1 | Sí | Insistir entrena el mute permanente (F1.2: el usuario que silenció no vuelve) |
| P4 | Una alerta "correcta" sobre datos stale es falsa para el usuario; y el control del usuario reduce la algorithm aversion | Toda alerta muestra: dato base + fuente (mail o regla+versión) + "visto por última vez" + acciones de un tap (hecho / posponer / corregir). **Deadline editable SIEMPRE; la edición manual lo pinnea** (`pinned_by_user`) y el recompute no lo pisa sin card de aviso | FM F2.4 (patrón TripIt), F5.1 (Dietvorst 2018) | Sí | Recompute pisando ediciones del usuario = pérdida de confianza doble (ni el dato ni el control son suyos) |
| P5 | La tarea #1 del nicho ya tiene nombre: "Send Final Payment Reminder" (riesgo declarado: cancelación del booking), y toda la categoría solo NOTIFICA | **La alerta crítica llega con el trabajo hecho**: borrador del mail al cliente desde plantilla + slots del ledger (X5) + botones aprobar/editar/posponer. Interrumpir con artefacto ejecutable, no con aviso. Esto ES la diferencia de categoría vs Venselo/Pixie Dust (alerta pasiva al agente) y justifica el delta de precio $10-40 → $50 | LAT §6 (spec escrita por el mercado); VEN §5 ("proponer la acción, no solo notificar"); DOM §5 (toda la categoría es recordatorio post-carga-manual) | Sí | Sin el artefacto, somos Venselo con mejor parser — categoría vieja, precio viejo |

### Eje DURABILIDAD (Temporal)

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| T1 | Una reserva vive hasta 18 meses; los workflows longevos acumulan historia (límite 51,200 events/50MB) y sufren el problema de versionado; la recomputación en cascada (R3) exige reprogramar timers rutinariamente | **Qué es workflow y qué NO**: los deadlines viven en **Postgres como source of truth** (filas `Deadline`), y Temporal ejecuta: (a) **timers/Schedules por deadline próximo** que despiertan workflows CORTOS (`DeadlineFireWorkflow`: leer estado vivo → decidir → emitir → morir); (b) workflows cortos de ingesta (un mail = un workflow); (c) workflow de backfill (batch); (d) workflows HITL esperando signal de aprobación (horas–días). **NO hay entity workflow permanente por booking**: recompute = reconciliar filas + cancelar/reprogramar timers, idempotente. El único workflow long-lived sigue siendo la sesión conversacional (CAN existente, PR #122) | CAN §4.1 (ambos patrones son canónicos; elegimos el de menor superficie de versionado), §4.3 (acumulación de patches como problema); R3; FM F9.1 (motor determinista fuera del LLM) | Media | Entity-workflow-por-booking de 18 meses × cambios de código semanales = infierno de versionado documentado (CAN §4.3) |
| T2 | El código va a cambiar decenas de veces bajo los workflows que SÍ son largos (sesión conversacional, HITL multi-día) | **Pinned + Upgrade-on-Continue-as-New** como estrategia de versionado; Patching API solo como herramienta puntual, no dieta; **replay testing (`WorkflowReplayer`) como gate de CI** antes de todo deploy (práctica ya existente del repo, PR #122) | CAN §4.3 (guía oficial 2025-26) | Sí | Non-determinism error en workflows vivos de usuarios reales |
| T3 | Temporal reintenta activities por diseño → doble mail al cliente, doble link de cobro (lo ve un TERCERO: el cliente del usuario) | **Idempotency key derivada de `workflow_id + activity_id` en TODA activity con side effect externo** (mail saliente, MP preference, evento de calendario); ledger de acciones registra key + resultado; duplicado → respuesta canónica sin re-ejecutar | FM F4.2 (probabilidad ALTA sin esto); CAN §4.4 (doctrina Stripe) | Sí | El duplicado daña la imagen del usuario ante SU cliente — error visible de terceros |
| T4 | Los webhooks de MercadoPago se pierden (incidentes recurrentes documentados; at-least-once en el mejor caso) | No confiar solo en webhook: **reconciliación periódica por polling** (Temporal Schedule) contra la API de MP + HMAC + DLQ/trauma-empaquetado (patrones ya adoptados en el spike MP del repo) | FM F9.4; memoria `mercadopago-integracion-research` | Sí | "El cliente pagó y no figura" — plata en tránsito invisible |

### Eje MEMORIA

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| M1 | Ningún sistema serio usa el grafo como source of truth del negocio; ya es doctrina del repo (grafo=PROYECCIÓN, DB=SoT) | **Postgres = SoT de TODO lo transaccional** (clients, bookings, sales, deadlines, comisiones, reglas, acciones). **Graphiti = memoria conversacional/recall** (preferencias del cliente, "qué hablamos con María", contexto temporal cross-sesión). El grafo es reconstruible desde Postgres + episodios; nunca al revés | CAN §5.3 `[PROD]`; doctrina del repo (ADR-040) | Sí | Montos/deadlines en el grafo = fuente de verdad duplicada y divergente |
| M2 | Destilar hechos descartando el original pierde detalle recuperable (chunks verbatim > artefactos extraídos) | **El mail fuente se retiene como blob** (cuerpo+headers mínimo) referenciado por el registro extraído: habilita provenance (D4), re-extracción cuando el parser mejore, y show-your-source (X2). Con TTL/política de retención por PII (M3) | CAN §5.3 (arXiv 2601.00821); FM F3.3 | Sí | Sin el original: sin auditoría del error de extracción ni mejora retroactiva |
| M3 | PII de clientes finales (incluidos menores, con fechas y lugares de viaje) fluye por diseño, y el borrado debe propagar a grafo+vectores+logs | **Qué NO entra al grafo**: montos/comisiones (negocio→Postgres), datos de tarjeta (NUNCA, en ningún lado), PII de menores más allá de nombre/edad-banda si el recall no la requiere, cuerpos crudos de mails. **Índice de residencia por persona** (Postgres ↔ episodios grafo ↔ blobs) para borrado dirigido E2E + drill de borrado como test | FM F8.2/F8.3 | Media (limpiar un grafo contaminado después es caro) | Un breach con itinerarios de menores = daño irreparable de marca + regulatorio |

### Eje ACCIONES CON CONSECUENCIA

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| X1 | La matriz canónica es severidad × reversibilidad, y el juicio de clasificación no puede ser del LLM | **Clasificación fija en código, por tool** (allowlist, reusa el confirm-gate existente PR #104): read-only → autónomo; write interno reversible (draft, nota, tag) → actuar + post-review visible; **outbound/plata/terceros** (mail a cliente final, link MP, evento en calendario compartido) → **pre-approval HITL no bypasseable, siempre** | CAN §6.1 (OWASP Excessive Agency); FM F4.1 (Replit: el agente ignoró el freeze — la política no puede vivir en el prompt) | Sí | Un solo camino de acción sin gate = F4.1 con plata de terceros |
| X2 | El humano aprueba el artefacto, no la intención | La card de aprobación muestra **el contenido final exacto** (destinatario, monto, texto completo, link) + el dato base con su fuente (mail/regla). Estilo Terraform plan/apply: **se ejecuta ESE plan**, no una recomputación posterior | CAN §6.2/§6.3; FM F3.3 (show-your-source en el punto de consecuencia) | Sí | Aprobar una descripción ≠ aprobar el efecto; la brecha es donde vive el error caro |
| X3 | El confirm-gate degrada a ritual en 3–6 meses (automation complacency es comportamiento documentado, no hipótesis) | **Fricción proporcional al riesgo**: cobros y envíos masivos exigen confirmación reforzada (re-tipear monto o nombre — patrón GitHub/AWS); métrica `time-to-confirm` (<2s = no leyó) como señal por usuario; lo rutinario se agrupa en batch para no quemar atención en lo que no la necesita | FM F4.5 (Parasuraman & Manzey) | Sí | El HITL deja de ser defensa justo cuando más se lo necesita — anula la mitigación de F3.3/F4.1/F4.3 |
| X4 | El undo real no existe para outbound (un mail no se des-envía) | **Envío diferido con ventana de cancelación** (60–120s, patrón Gmail Undo Send) para todo mail saliente. **Límites cuantitativos independientes del LLM**: cap de outbound/día/tenant, cap de monto por link MP sin confirmación reforzada, destinatarios permitidos = clientes existentes del ledger | CAN §6.3 | Sí | Sin caps, el peor caso de F4.1/F4.3 no tiene techo |
| X5 | El agente que afirma algo falso en nombre del usuario crea responsabilidad legal (Air Canada: "el chatbot no es una entidad separada"; los disclaimers no salvaron) | **Comunicaciones salientes v1 = plantillas parametrizadas + slots de datos del ledger.** El LLM puede proponer redacción, pero el diff contra plantilla se muestra y el humano aprueba el texto final exacto. Nunca autoenvío de generación libre | FM F4.4 (Moffatt v. Air Canada; Cursor) | Sí (relajable con track record) | El expuesto ante el cliente final es NUESTRO usuario — y por elevación, nosotros |

### Eje MULTI-PROVEEDOR

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| V1 | En 2002, 8 de las 10 aerolíneas más grandes cortaron comisiones a CERO casi simultáneamente y 15% de las agencias murió en 2 años; nuestro usuario deriva ~100% de su ingreso de UN proveedor que fija su 10% unilateralmente | **`provider` como dimensión de datos en TODO** (reglas R2, plantillas de extracción C1, deadlines, comisiones, copy): Disney es el primer **ruleset**, no el **esquema**. El costo HOY es ~cero (es la disciplina anti-hardcoding ya doctrinal del repo); el costo del retrofit es un rewrite del ledger vivo | FM F6.3 + riesgo-killer #3 (Wharton/GAO 2002); restricción del operador (núcleo agnóstico) | Sí hoy; NO después | Si Disney recorta canal/comisiones, el pivot a cruceros/Universal/otros verticales es un ruleset nuevo — o un funeral |
| V2 | El negocio real del agente YA es multi-proveedor (WDW + DCL + Universal/VAX + seguro de viaje con la mayor comisión relativa del mix: 12–40%) | v1 ingiere y deriva deadlines para **los proveedores que aparezcan en el inbox del piloto** (WDW, DCL, Universal esperables), cada uno con su ruleset; remitente no reconocido → **booking genérico con deadlines solo-documento** (sin ruleset, sin ventanas). Multi-proveedor como comportamiento por defecto del pipeline, no como aspiración | DOM §1.2 (mix real de comisiones), §3 (rulesets WDW/DCL/Universal ya relevados); V1 | Sí | Ingerir "solo Disney" filtraría mails del mismo negocio del mismo inbox — complejidad extra para PEOR producto |

### Eje ECONOMÍA (COGS)

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| E1 | El LLM es ~95% del COGS medido ($1–12/usuario/mes) y el margen es sobre $50 | **Modelo por rol**: extracción con modelo barato (y capas 0-1 deterministas ANTES del LLM — C1 — que son gratis); conversación con modelo capaz; clasificador RSS con el mínimo. Prompt caching + tool gating (palancas ya medidas en el repo). **COGS por tenant instrumentado día 0** con alerta de outlier | FM F6.4; memoria `copiloto-economia-cogs`; CAN §3 (capas) | Sí | La cola pesada de heavy users come el margen sin que se vea |
| E2 | El backfill del onboarding es el pico de COGS por usuario | Backfill **filtrado por remitentes de proveedores ANTES del LLM** (search query de Gmail, no scan del inbox), batch, cap default 24 meses (extensible). El mail que no matchea remitentes conocidos no toca el LLM en backfill | LAT H4.1 ("acotable: filtrar por remitentes primero, batch económico") | Sí | Un onboarding de $20 de LLM por usuario invierte la economía del trial |
| E3 | Churn SMB estructural 3–7% mensual + wave season concentra ⅓ de reservas en ene–mar + la comisión llega meses después de la venta | Lo técnico que esto exige HOY: (a) billing con soporte anual/mensual desde el esquema; (b) los features de "valor de temporada baja" ya salen de D3 (comisiones adeudadas y cuándo llegan) y D1 (re-marketing de clientes pasados); (c) métrica visible "plata que el producto te movió/protegió" por tenant. El pricing/packaging en sí = decisión MAYOR M5 | FM F6.1/F6.2 | Sí | LTV ≈ $1.000–1.500 fija techo duro de CAC; sin valor visible en temporada baja, el churn estacional es predecible |

### Eje COLD START / ONBOARDING

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| O1 | El CRM vacío que pide data entry corre 26% de adopción; el inbox ES el backup del negocio; captura en vivo y cold start son la MISMA feature | **Onboarding = conectar Gmail → backfill inmediato (12–24 meses, filtrado E2) → la primera sesión termina con el tablero de deadlines VIVOS** y bookings históricos en `draft` para confirmar en batch. Sin wizard de carga. Métrica de activación: **time-to-first-alert** y % de usuarios con ≥N bookings a los 7 días | FM F7.1/F7.2; LAT H4.1 ⭐ (el momento-mágico también es el demo de venta en grupos FB, H3.2) | Sí | Sin backfill, el valor aparece recién en la próxima venta del usuario — semanas en temporada baja = churn pre-activación |
| O2 | El backfill trae modificaciones y cancelaciones del mismo booking | **Estado final = replay cronológico de los mails del mismo confirmation number** (upsert D1); los intermedios quedan como historia del booking. Re-ingesta idempotente: correr el backfill 2 veces = mismo resultado | FM F2.4; LAT H4.1 (dedup como costo declarado); doctrina idempotencia del repo | Sí | Duplicados en el primer vistazo del trial = primera impresión de producto roto |
| O3 | Los primeros 5 minutos definen el trial | Primera pantalla post-backfill, en orden: (1) **deadlines vivos ≤30 días**, (2) **comisiones adeudadas estimadas + cuándo llegan** (D3 — el dato que nadie les da), (3) cola de confirmación en batch. `[JUICIO PROPIO el orden exacto; los ingredientes salen de F7.2 y D3]` | FM F7.2; DOM §2.1 (gap de commission-tracking confirmado por la existencia de Toggle) | Sí | Bajo |
| O4 | Hay agentes sin Gmail o con historia solo en planillas (mercado secundario de templates Etsy = layouts semi-estandarizados de facto) | **Import de planilla vía Sheets (ya en Composio) + LLM column-mapping**: lee headers + 5 filas → propone mapping → card de confirmación → ingesta. WhatsApp export como tercer camino, post-v1 | LAT H4.2/H4.3/H3.5 | Sí | Bajo (es fallback) |

### Eje COMPLIANCE Y AISLAMIENTO DE DATOS

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| G1 | El agente de viajes es controller, nosotros processor, el LLM sub-processor; los data subjects (clientes finales, menores) jamás consintieron | Endpoints LLM **API-tier sin retención/entrenamiento + DPA**; minimización: al prompt del turno va lo necesario, no el ledger; datos de menores nunca en prompts salvo que la acción los requiera; DPIA + inventario vivo de campos PII→prompt | FM F8.2 | Sí | Regulatorio + breach de itinerarios de menores = irreparable |
| G2 | RLS solo no cubre cache/grafo/logs (ChatGPT mar-2023: el leak fue en la capa de cache que nadie testeaba adversarialmente) | La doctrina existente del repo (RLS + test adversarial como gate de merge) se **extiende a toda superficie nueva de este producto**: blobs de mails, golden set, colas de extracción, telemetría de alertas. Verificación redundante de tenant en la capa de respuesta, no solo en el query | FM F8.1; regla dura del CLAUDE.md global (control sin test adversarial = control no verificado) | Sí | Un cross-tenant leak entre agentes que COMPITEN entre sí = fin comercial y legal |

### Eje DEPENDENCIAS EXTERNAS

| # | SI | ENTONCES | Por qué | Reversible? | Costo si nos equivocamos |
|---|---|---|---|---|---|
| Z1 | El proveedor LLM se cae horas, varias veces por año | **El camino crítico de deadlines/alertas es 100% determinista y no toca el LLM** (P2); la redacción degrada a plantilla pura; fallback multi-provider para conversación tras un boundary (LiteLLM u equivalente) | FM F9.1 | Sí | "Los deadlines no pueden depender de esto" — textual del failure map |
| Z2 | Los modelos se deprecan con ~3 meses de aviso | Pin de versión de modelo en config + **el golden set (C3) como suite de regresión obligatoria pre-migración** | FM F9.2; CAN §3.4 | Sí | Migración forzada sin golden set = regresión de extracción invisible |
| Z3 | Composio es una Serie A que puede pivotear/repreciar/morir — y hoy TODO el acceso a Gmail/Calendar pasa por ellos | Mantener el **adapter fail-closed existente como único punto de consumo** (swap a Google APIs directas = cambio de adapter, no rewrite); el canal `forward_address` (C6) reduce además la dependencia del scope de lectura | FM F9.3; memoria `composio-gateway-ladrillo` | Sí | Pérdida simultánea de todas las integraciones sin plan B |

---

## 2. DECISIONES MAYORES QUE REQUIEREN AL OPERADOR

No las tomo yo: son irreversibles, cuestan plata recurrente, o son intención comercial.

### M1 — Canal de acceso al inbox a largo plazo (Composio Gmail vs. dirección de forwarding propia vs. ambos)

- **Tradeoff exacto:** Gmail vía OAuth = cero-touch total (ni forward hace falta) pero cuelga de restricted scopes + CASA anual (FM F3.5: USD 500–4.500+/año, ¿la absorbe Composio? — supuesto S6) y de Composio mismo (F9.3). Forwarding propio (patrón TripIt `plans@`) = sin scopes, sin CASA, cubre Outlook/Yahoo, pero pide UN hábito al usuario (auto-forward rule, se configura una vez) y pierde el backfill retroactivo (el histórico no se puede forwardear masivamente sin dolor).
- **Opciones:** (a) solo Composio Gmail; (b) solo forwarding; (c) ambos tras el boundary `MailSource` (C6).
- **Recomendación:** (c) — Gmail para piloto/beta (el backfill O1 lo necesita y es el momento-mágico), forwarding construido antes de GA como canal de resiliencia y cobertura no-Gmail.
- **Evidencia que falta:** S6 (quién carga CASA con Composio, respuesta escrita); % del target que no usa Gmail (preguntar en el spike de canal, M4).

### M2 — Política de causalidad mail→acción (relajación de A3)

- **Tradeoff exacto:** la regla dura v1 (un mail solo produce drafts y sugerencias; nunca origina outbound por sí solo) es la defensa arquitectónica contra F4.3 — pero limita la ambición "secretario que ejecuta": p.ej. "llegó la confirmación → mandale al cliente el resumen automáticamente" queda prohibido sin tap humano.
- **Opciones:** (a) mantener A3 estricta indefinidamente; (b) relajar por tipo de acción de bajo riesgo (p.ej. auto-enviar SOLO plantilla fija de "recibimos tu confirmación" a destinatario ya existente en el ledger) tras 6 meses de red-team limpio; (c) relajar por track record por tenant.
- **Recomendación:** (a) durante todo el beta; revisar con el corpus de red-team (A2) corriendo en CI y datos reales de intentos. El costo de (a) es fricción menor (un tap); el costo de equivocarse relajando es el incidente que mata la categoría (FM F5.2). Esta asimetría no se negocia con conveniencia.
- **Evidencia que falta:** tasa real de aprobación instantánea de las sugerencias (si el usuario aprueba el 99% en <5s, la relajación (b) tiene caso; también dispara la contramedida X3).

### M3 — Owner y SLA del ruleset Disney (el costo operativo permanente que el software no elimina)

- **Tradeoff exacto:** el producto promete precisión temporal; el ruleset la sostiene; alguien humano tiene que curarlo con SLA (así funciona el negocio de docketing legal: venden el mantenimiento, no el software — CAN §2.1). Es COGS permanente no-LLM que nadie más de la categoría paga (por eso ninguno lo promete).
- **Opciones:** (a) operador como curador con el sensor semi-automático R4 (~horas/mes estimadas — sin baseline aún); (b) usuaria-cero (o un agente senior del nicho) como reviewer pagada por regla verificada; (c) diferir la promesa: todas las reglas `advisory` hasta tener owner formal.
- **Recomendación:** (a)+(b): operador opera el sensor, usuaria-cero valida contra su realidad operativa (ella VIVE las reglas). Formalizar en cuanto haya >20 tenants.
- **Evidencia que falta:** frecuencia real de cambios de regla/año (el sensor R4 la mide solo con correr — DOM documenta 3 cambios en 18 meses, pero es cota inferior).

### M4 — Canal de distribución: host agency B2B2C vs. asiento individual

- **Tradeoff exacto:** una host Disney-heavy = cientos de asientos de golpe con onboarding hecho por el champion (LAT H3.1, playbook Tern probado) — pero pide ciclo de venta B2B, pricing mayorista, posible presión de customización/white-label, y abre el riesgo S.1 del failure map (la host como gatekeeper que además puede verticalizar ella misma). Asiento individual vía grupos FB (H3.2) = lento pero sin ataduras y valida el precio real.
- **Opciones:** (a) individual-first, host después con tracción; (b) host-first; (c) dual desde el día 0.
- **Recomendación:** (a) — con el spike no-código de LAT (§3 spike 3: mapear la host de la usuaria-cero, quién paga las tools, quién decide) ejecutado YA porque su resultado informa pricing y el modelo multi-tenant jerárquico (agencia→agentes) ANTES de codear billing. La arquitectura multitenant existente soporta ambos; lo que cambia es jerarquía de tenants y quién factura.
- **Evidencia que falta:** las 3 respuestas del spike (¿qué tooling da la host hoy? ¿paga la host o el agente? ¿quién decide?).

### M5 — Pricing/packaging: $50 flat vs. anual-con-descuento vs. tiers por volumen

- **Tradeoff exacto:** $50/mes flat contra churn SMB de 3–7% mensual y estacionalidad brutal (F6.1/F6.2) → LTV ~$1.000–1.500 y dolor en temporada baja. Plan anual vendido en wave season (ene–mar, cuando el usuario cobra) mueve el churn a una ventana única. Tiers por volumen protegen del power user (F6.4) pero complican el mensaje de categoría nueva.
- **Recomendación:** mensual $50 + anual con descuento empujado en wave season; fair-use cap interno (no publicitado) con conversación humana al superarlo. El posicionamiento (Dunford, CAN §7): anclar contra "lo que hacés sin esto" (planillas + memoria + pánico + 10 horas por reserva — DOM §4), no contra CRMs de $10–40.
- **Evidencia que falta:** S4 (willingness-to-pay LatAm) — el benchmark $10–40 es del mercado US; la usuaria-cero es LatAm con comisiones posiblemente menores (DOM §1.2 nota LatAm `[NO VERIFICADO]`).

### M6 — Marco de privacidad del primer mercado (LatAm) y compromiso de compliance

- **Tradeoff exacto:** F8.2/F8.3 están escritos en clave GDPR; el primer mercado es LatAm (Argentina: Ley 25.326 y sucesoras; otros países varían). Cumplir GDPR-grade desde el día 0 es más caro; cumplir solo lo local y retrofitear si se entra a US/EU es deuda deliberada.
- **Recomendación:** las decisiones baratas-hoy-carísimas-después se toman YA independiente del marco (minimización G1, índice de borrado M3, no-retención del LLM); la certificación/DPIA formal se calibra al mercado real. Deuda deliberada + visible si se difiere, con entrada en memoria y trigger de pago ("primer cliente US/EU").
- **Evidencia que falta:** jurisdicción efectiva de la usuaria-cero y sus clientes finales (¿residentes US comprando desde LatAm? — común en el nicho Disney y cambia el análisis).

---

## 3. SUPUESTOS CRÍTICOS AÚN NO VALIDADOS

Ordenados por cuánto se cae encima si son falsos. Los tres primeros vienen señalados por los tres documentos de la trifecta de forma independiente — eso es convergencia, no coincidencia.

### S1 — Los mails trade que recibe la agente contienen los datos del booking (fechas, montos, deadline de pago final, confirmation number) ⚠️ EL PRODUCTO ENTERO CUELGA DE ESTO

La hipótesis principal declarada del producto ("captura sin fricción parseando el inbox") es **una hipótesis, no un hecho**. DOM §6 dice explícitamente que el email-parsing para agentes es terreno inexplorado y que la reserva "vive" en el sistema propietario; LAT H1.3 aporta evidencia indirecta (TripIt parsea los formatos consumer de Disney) pero admite la incógnita trade; C-0.3 la delimita. Si los mails no llegan, o llegan sin monto/deadline, la captura cero-touch muere.

- **Spike (1 sesión, ya especificado en LAT §"3 atajos"):** pedir a la usuaria-cero 20–30 mails reales (paquete WDW, DCL, Universal/VAX, una modificación, una cancelación). Correr el extractor LLM del stack. De paso: grep `application/ld+json` en los MIME (valida H1.2) y verificar si la fecha de pago final viene impresa (valida H2.1/R1).
- **Mide:** % de extracción correcta field-level sobre {cliente, destino, check-in/out, monto, deadline de pago final, confirmation number}; presencia de JSON-LD; presencia del deadline impreso.
- **Criterio de éxito:** ≥90% field-level (con confirm-gate humano detrás); deadline de pago final presente en ≥80% de los mails de paquete.
- **Si es falso (plan B, para no descubrirlo sin plan):** el producto pivotea a captura conversacional-first + import de planilla (C5/O4), y la propuesta de valor se re-centra en deadlines-por-regla + comisiones adeudadas sobre carga asistida de 30 segundos — sigue siendo superior a una categoría que es 100% manual (DOM §5), pero es OTRO producto y el operador debe re-aprobar el posicionamiento.

### S2 — Cobertura: % de las ventas reales del negocio que dejan rastro de mail en el inbox

Distinto de S1 (parseabilidad ≠ cobertura). Si el 40% de las ventas se hace por portal/teléfono sin mail al agente, el ledger nace incompleto y los deadlines que faltan son F1.3 por omisión.

- **Spike:** con la usuaria-cero, contrastar su registro real de ventas del último año (planilla) contra búsqueda del inbox por remitentes de proveedores.
- **Mide:** % de bookings con ≥1 mail correspondiente.
- **Criterio:** ≥80% cobertura → cero-touch como canal primario; 50–80% → cero-touch + fallback conversacional prominente; <50% → replantear (ver plan B de S1).

### S3 — Willingness-to-pay a US$50/mes en el nicho LatAm

El operador fijó el precio como restricción; la evidencia de la categoría es US$10–40 (mercado US, DOM §5/LAT H3.4), y las comisiones LatAm serían menores (DOM §1.2, `[NO VERIFICADO]`). Si el WTP real del primer mercado es $20, la economía (F6.1: techo de CAC) cambia entera.

- **Spike (no-código):** demo del momento-mágico (backfill sobre inbox real, O1) a 5 agentes del círculo de la usuaria-cero + pregunta de cierre con precio ancla $50.
- **Mide:** intención declarada de pago post-demo (sesgada al alza — descontarla) + reacción al ancla.
- **Criterio:** ≥3/5 aceptan $50 sin negociar tras ver el backfill propio. Honestidad: es intención declarada, no conversión — el criterio duro real es el primer cobro efectivo del beta pago.

### S4 — Calendar API `eventTypes=fromGmail` genera eventos para los mails trade del agente

Si es cierto, hay detector de reservas + fechas estructuradas gratis mantenido por Google sobre una API ya integrada (cubre además la cola larga de vuelos/hoteles del cliente sin parser propio).

- **Spike (30 min, LAT §"3 atajos" spike 2):** `Events.list(eventTypes="fromGmail")` vía Composio sobre la cuenta del piloto.
- **Mide:** ¿las confirmaciones trade generan evento? ¿qué campos traen?
- **Criterio:** ≥50% de las confirmaciones del corpus S1 generan evento → se integra como capa-0.5 de detección; si no, se descarta sin costo (era gratis probar).

### S5 — Las reglas que vamos a cargar son las vigentes (Universal 2-vs-3 tramos; hora ET de corte; tramos DCL; timing de comisión DCL)

DOM §3.4 lista 6 discrepancias sin resolver EN LAS FUENTES. Cargarlas sin resolver = codificar la esperanza en el corazón del value prop.

- **Spike:** validar cada regla contra el T&C vivo del proveedor + contra los mails reales del corpus S1 (¿qué tabla de cancelación cita el mail de Universal?); lo irresoluble queda `advisory` (R5).
- **Mide:** # de reglas con fuente primaria verificada y fecha de captura.
- **Criterio:** 100% de las reglas `verified` tienen fuente primaria + captura ≤90 días; ninguna regla `[NO VERIFICADO]` de DOM entra como `verified`.

### S6 — Composio absorbe la carga CASA/restricted-scopes de Gmail (y su pricing la cubre)

Afecta M1 y el COGS. `[ASSUMED_PENDING_VERIFY]` — hoy no sabemos quién es el dueño del LOA.

- **Spike:** docs/términos de Composio + confirmación escrita de su soporte.
- **Criterio:** respuesta escrita inequívoca. Si la carga es nuestra → presupuestar CASA anual o acelerar `forward_address` (C6).

### S7 — El COGS de extracción a volumen real cabe en el margen de $50

- **Spike:** medir tokens/mail del extractor sobre el corpus S1 × volumen mensual realista (ventas/mes de la usuaria-cero + mails de modificación + backfill amortizado).
- **Mide:** USD/usuario/mes de extracción, p50 y p95.
- **Criterio:** extracción < $5/usuario/mes en p95 (deja el COGS total dentro del rango ya medido $1–12 con margen sobre $50 — memoria `copiloto-economia-cogs`).

---

## 4. LO QUE NO HAY QUE CONSTRUIR

Donde el research dice que reusar/comprar/ignorar gana, y el gold-plating disfrazado.

| Qué NO construir | Por qué | Qué hacer en cambio | Fuente |
|---|---|---|---|
| **Scheduler/cron/cola de deadlines propia** | El moat declarado del stack YA es esto | Temporal timers/Schedules (T1); costo marginal ~0 | LAT §5; CLAUDE.md del repo |
| **Sniping/monitoreo de cupos ADR y Lightning Lane** (tipo MouseDining/MouseWatcher) | Disney bloquea activamente estos scrapers (mató el Reservation Finder de TouringPlans en 2023); colinda con la línea roja MDE; es una guerra perpetua contra el proveedor | Nada. Alertar la VENTANA (nuestro negocio) y dejar el sniping a las herramientas del nicho que ya existen — incluso linkearlas | DOM §2.3/§6 |
| **Cualquier automatización que toque My Disney Experience del cliente final** | Línea roja del operador; práctica extendida del nicho pero viola TOS y expone tarjetas de terceros | El copiloto prepara el trabajo (recordatorio + checklist + borrador al cliente para que lo haga ÉL); nunca lo ejecuta en sistemas de Disney | Restricción del operador; DOM §2.3 |
| **Integración con VAX/Disney "API"** | No existe canal consumible por terceros: VAX Quick Connect es supplier→VAX; el camino GDS murió en 2018; RSS de Disney es marketing | El inbox ES la integración (S1). Única acción barata: preguntar al piloto qué mails manda VAX | DOM §6; LAT §5 |
| **Parser propio de la cola larga de proveedores** (vuelos, hoteles genéricos, autos) | 1.000+ formatos con mantenimiento eterno; existe como servicio | v1: no ingerir la cola larga. Si el mercado la pide: Traxo/AwardWallet tras el boundary `ItineraryParser` (cobertura Disney NO confirmada — por eso el core Disney es LLM propio) | LAT H1.4/§5 |
| **Fan-out de notificaciones multicanal (Novu/Knock/Courier)** | v1 tiene 2 canales (PWA push + email) con el stack existente | Adoptar Novu SOLO si se agregan ≥3 canales (WhatsApp, SMS) — el propio doc lateral advierte la sobreingeniería | LAT §5 |
| **Scraper de horarios/estado de parques** | Existe API comunitaria gratis sin auth | themeparks.wiki con degradación con gracia (sin SLA) | LAT H2.3 |
| **OCR propio para PDFs adjuntos** | Resuelto por la industria | LLM multimodal del stack; Document AI (skill ya instalada) si no alcanza | LAT §5 |
| **Bitemporalidad como plataforma (XTDB, temporal tables genéricas)** | El único caso de uso que la paga se cubre con menos | `seen_at` + log inmutable de alertas con snapshot (D7) | CAN §2.3 |
| **Equipo de research humano para vigilar políticas Disney** | La comunidad ya hace la vigilancia, con feeds | RSS + clasificador LLM + cola de curación humana (R4) | LAT H2.2 |
| **Pipeline TripIt (feed iCal) como componente** | Viola TOS casi seguro; frágil; pierde precio/comisión | Solo como benchmark del eval set del spike S1, jamás en producción | LAT H1.6 `[GRIS/TOS]` |
| **Portal del cliente final / itinerary builder visual** | Gold-plating v1: el mercado lo tiene resuelto a $25/mes (Travefy) y NO es el moat — la identidad del proyecto es automatización durable + frontend fino, no frontend pesado | Diferir; si un día entra, es capa presentación sobre el ledger existente | DOM §5; memoria `factory-identidad-automatizacion-ia` |
| **CRM clásico completo** (pipeline kanban de leads, marketing automation, website builder, mensajería interna de equipo) | Es la categoría VIEJA — competir ahí es pelear a $10–40 contra incumbentes; el posicionamiento es secretario proactivo | Un estado `quote/prospect` liviano antes de `Sale` (VEN §5 lo pide) SÍ; el resto NO en v1. UI multi-agente de agencia se difiere hasta el resultado de M4 | CAN §7 (Dunford: frame de referencia); VEN §5; LAT H3.4 (el espacio "secretario activo" está VACÍO — ahí no hay nadie, en CRM están todos) |
| **Apps móviles nativas** | PWA existente cubre; identidad frontend-fino | PWA + push | Memoria del repo |
| **Motor de interrupciones "inteligente" con LLM decidiendo cuándo alertar** | La decisión de despertar es reglas baratas; el LLM solo redacta — y el canal crítico no puede depender de un proveedor que se cae | P2/Z1: disparo determinista, redacción LLM con fallback a plantilla | CAN §1.4 (arXiv 2605.30152); FM F9.1 |

---

## 5. Cómo usar esta matriz (nota al orquestador)

1. **Nada de la matriz se construye antes de S1/S2** — son 1 sesión + datos de la usuaria-cero y definen si el producto es el declarado o el plan B. S4 (30 min) y S7 caen gratis del mismo corpus.
2. Las únicas decisiones **no reversibles baratas** de toda la matriz son **A1** (aislamiento extractor/agente) y **V1/D6** (provider/currency como dimensión): son las tres que tienen que nacer bien aunque todo lo demás se itere.
3. Las 6 decisiones de §2 (M1–M6) van al operador **en batch**, con los spikes S1–S7 como evidencia previa donde aplique (M4 y M5 dependen de S3; M1 de S6).
