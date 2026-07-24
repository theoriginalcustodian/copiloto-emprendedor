# STATE_OF_THE_ART — Lente (a) CANÓNICO
## Copiloto vertical para agentes de viajes Disney — cómo la industria construye este tipo de sistema

> **Agente 1/4 de la trifecta cognitiva.** Este documento es el **mapa de lo que ya existe** (soluciones probadas y establecidas), NO una propuesta de arquitectura. Otro agente decide.
> **Frontera respetada:** no cubre el dominio de negocio del agente Disney (comisiones, host agencies, fechas-regla de Disney) — eso lo cubre otro agente.
>
> **Convención de etiquetas:**
> - `[PROD]` — probado en producción, con evidencia pública.
> - `[PAPER]` — propuesto/validado en paper, sin evidencia de producción a escala.
> - `[VENDOR-BENCH]` — benchmark corrido por el propio vendor (conflicto de interés declarado).
> - `[NO VERIFICADO]` — afirmación encontrada que no pude confirmar contra fuente primaria.
>
> Fecha de investigación: 2026-07-20.

---

## 1. Agentes/asistentes proactivos — cuándo interrumpir a un humano

### 1.1 El marco teórico canónico: interrupción como decisión bajo incertidumbre (Horvitz, Microsoft Research)

La literatura fundacional es de Eric Horvitz y colaboradores (1999-2003), y sigue siendo **el** marco de referencia:

- **"Attention-Sensitive Alerting"** (UAI 1999, [arXiv:1301.6707](https://arxiv.org/abs/1301.6707), [Microsoft Research](https://www.microsoft.com/en-us/research/publication/attention-sensitive-alerting/)) — formula la notificación como **decisión de utilidad esperada**: alertar ahora sii `beneficio esperado de relayar la info > costo esperado de la interrupción + costo de diferir`. Los tres términos son inciertos y se modelan con redes bayesianas sobre (a) la actividad del usuario y (b) el contenido/criticidad de la notificación. Implementado en el sistema **Priorities** (prioriza email por criticidad inferida y modula cuándo/cómo notificar). `[PROD]` (deployado internamente en MSR; el framework es doctrina establecida).
- **"Principles of Mixed-Initiative User Interfaces"** (Horvitz, CHI 1999) — los 12 principios de sistemas que toman iniciativa: considerar la incertidumbre sobre la intención del usuario, considerar el costo/beneficio de actuar, permitir invocación y terminación eficientes, degradar con gracia hacia preguntar en vez de actuar. Es el documento canónico de "agente que toma iniciativa sin ser insufrible". `[PROD]` (destilado de los sistemas LookOut/Priorities).
- **Estudios de interruptibility con sensores** ([erichorvitz.com/learninterrupt.htm](https://erichorvitz.com/learninterrupt.htm), y "Models of Attention in Computing and Communication", CACM 2003) — modelos entrenados que predicen el **costo de interrumpir AHORA** desde señales de contexto (actividad, calendario, conversación). Resultado clave: el estado atencional del usuario es predecible con precisión útil y cambia el cálculo de cuándo alertar. `[PROD]` (prototipos MSR con evaluación empírica).

**Doctrina destilada del marco:** la pregunta nunca es "¿esto es relevante?" sino "¿el valor esperado de interrumpir AHORA supera su costo AHORA, contra la alternativa de diferir a un digest o no decir nada?". Tres decisiones separadas: *si* notificar, *cuándo*, y *por qué canal/intensidad*.

### 1.2 La evidencia dura de qué pasa cuando esto se hace mal: alert fatigue clínica

La medicina tiene la literatura cuantitativa más dura que existe sobre notificaciones ignoradas — es el failure map empírico del dominio:

- **Override rates de alertas CDS (clinical decision support):** revisión sistemática reporta rango de override promedio **46.2%–96.2%** ([JAMIA 2026, systematic review de medición de alert fatigue](https://academic.oup.com/jamia/advance-article/doi/10.1093/jamia/ocag064/8684938)); meta-análisis de alertas drug-drug interaction: **90% de override (CI95% 85–95%)** ([Felisberto et al., Health Informatics J. 2024](https://journals.sagepub.com/doi/10.1177/14604582241263242)). Incluso alertas "very severe" se overridean al 88.2% ([PMC9579928](https://pmc.ncbi.nlm.nih.gov/articles/PMC9579928/)). `[PROD]` (datos de sistemas EHR reales).
- **La fatiga es acumulativa y medible:** la probabilidad de aceptar un reminder **cae ~30% por cada reminder adicional recibido en el mismo encuentro** ([PMC5803531 / literatura CPOE](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5803531/)). `[PROD]`
- **Alarm fatigue mata:** Joint Commission Sentinel Event Alert (abril 2013): **566 muertes relacionadas con alarmas** en la base FDA (ene 2005–jun 2010); se estima que **85–95% de las alarmas de monitores no requieren intervención** — ese ratio señal/ruido es lo que desensibiliza ([Joint Commission SEA #50](https://digitalassets.jointcommission.org/api/public/content/f65e5c9df2b94000a99445e0a7877007), [NCBI Making Healthcare Safer III](https://www.ncbi.nlm.nih.gov/books/NBK555522/)). La respuesta de la industria: inventario de alertas, tiering por severidad, umbrales personalizados, tuning continuo con métricas de aceptación. `[PROD]`
- **Matiz importante:** no todo override es error — 29.4%–100% de los overrides se clasifican como *apropiados* según el tipo de alerta ([PMC7400042](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7400042/)). La métrica de calidad no es "cuántas alertas mando" sino **precision de la alerta** (¿cuántas de las que mando provocan acción?).

**Lección canónica transversal (clínica → cualquier asistente):** un sistema que alerta con precisión baja entrena al usuario a ignorarlo, y eso es peor que no alertar — porque cuando llega la alerta que importa, ya perdió la credibilidad. El diseño probado es **precision-first**: pocas alertas, tiered (interrumpir / digest / log silencioso), con feedback loop de aceptación como métrica de tuning.

### 1.3 Volumen de notificaciones móviles (contexto del canal)

- Pielot et al., **"An In-Situ Study of Mobile Phone Notifications"** (MobileHCI 2014, [PDF](https://pielot.org/pubs/Pielot2014-MobileHCI-Notifications.pdf)): usuarios reciben **~63.5 notificaciones/día** en promedio, mayormente messengers y email. Todo lo que el copiloto empuje compite contra ese ruido de fondo. `[PROD]` (estudio in-situ).
- Modelos predictivos de engagement con notificaciones mejoran >66% sobre baseline ([Pielot et al., continual prediction](https://arxiv.org/pdf/1712.07120)). `[PAPER]`

### 1.4 Proactividad con LLMs (2024-2026) — el estado emergente

- **ProactiveAgent** (THUNLP, ICLR 2025, [openreview](https://openreview.net/pdf?id=sRIU6k2TcU)): agente que monitorea el entorno y decide cuándo ofrecer ayuda; introduce **ProactiveBench** (6,790 eventos etiquetados por humanos) para medir la decisión "intervenir vs callar". `[PAPER]` — benchmark útil, sin despliegue comercial probado.
- **Codellaborator** (CHI 2025, ["Assistance or Disruption?"](https://dl.acm.org/doi/10.1145/3706598.3713357)): evidencia HCI de que la asistencia proactiva mal timeada **aumenta** carga cognitiva; deriva principios de diseño para el timing (interrumpir en boundaries de tarea / baja carga). `[PAPER]` (estudio controlado).
- Trabajo 2026 cuestiona si hace falta un LLM para decidir el "cuándo" ([arXiv:2605.30152](https://arxiv.org/pdf/2605.30152)) — la decisión de despertar puede ser reglas/clasificador barato, y el LLM entra recién para redactar la intervención. `[PAPER]`

**Síntesis sección 1:** el estado del arte para NO ser ruidoso NO es un modelo mágico: es (1) framework de valor esperado de Horvitz, (2) tiering de severidad con canal proporcional, (3) precision como métrica gobernante con feedback loop de aceptación/override, (4) batching/digest como default y la interrupción inmediata como excepción ganada. Todo esto es doctrina de 20+ años con evidencia clínica cuantitativa.

---

## 2. Motores de reglas temporales / hitos derivados de fechas base

### 2.1 El análogo casi exacto: legal docketing (court deadline calculation)

Industria madura (30+ años, mercado consolidado) que resuelve exactamente "evento base + reglas → cascada de deadlines accionables":

- **Modelo de datos canónico:** trigger event (ej. "service of process" con fecha) → el motor aplica el **rule set** de la jurisdicción → genera TODOS los deadlines derivados (respuestas, discovery cutoffs, mociones). CourtAlert documenta el almacenamiento en **tres niveles: case → trigger → event** ([CourtAlert](https://www.courtalert.com/content/CaseManagement)). `[PROD]`
- **Recomputación en cascada:** cuando la fecha del trigger cambia (el juicio se pospone), todos los deadlines derivados se recalculan automáticamente — es EL feature central del producto, no un extra ([Clio, rules-based calendaring](https://www.clio.com/blog/rules-based-calendaring-software-law-firms/)). `[PROD]`
- **Las reglas son datos mantenidos, no código:** CalendarRules ofrece rule sets de **2,500+ jurisdicciones** vía API real-time, consumidos por productos como DocketCalendar y CourtAlert ([DocketCalendar](https://docketcalendar.com/)); CompuLaw (Aderant) mantiene sus reglas con **un equipo full-time de abogados licenciados que monitorean cambios en las court rules**. `[PROD]` — la industria entera converge en: el rule set es un asset versionado y curado por humanos expertos, separado del motor que lo ejecuta.
- **Complejidad que el motor DEBE modelar** (documentada en toda la categoría): calendar days vs court/business days, holiday calendars por jurisdicción, extensiones por método de servicio, reglas que cambian (el vendor re-publica el rule set y el sistema recalcula). `[PROD]`

### 2.2 Segundo análogo probado: aviación (maintenance due lists)

- El tracking de mantenimiento aeronáutico (CAMP, Flightdocs, Traxxall) modela cada item contra **múltiples contadores independientes simultáneos** — flight hours, cycles, calendario — y dispara por **whichever comes first** ([OxMaint, guía CMMS aviación](https://oxmaint.com/industries/aviation-management/aircraft-maintenance-tracking-software-cmms-guide), [FL3XX+CAMP](https://www.fl3xx.com/kb/camp)). `[PROD]` — patrón relevante cuando un hito depende de más de una condición base ("60 días antes del check-in O al confirmarse el pago final, lo que ocurra primero").

### 2.3 Modelado temporal de datos: la doctrina académica consolidada

- **Valid time vs transaction time** (Snodgrass; el término "transaction time" es de Snodgrass & Ahn, 1986; consolidado en TSQL2 y luego SQL:2011): *valid time* = cuándo el hecho es verdad en el mundo real; *transaction time* = cuándo el sistema lo supo/registró ([Wikipedia: Transaction time](https://en.wikipedia.org/wiki/Transaction_time), [TSQL2 data model, Jensen & Snodgrass](https://people.cs.aau.dk/~csj/Thesis/pdf/chapter12.pdf)). **Bitemporalidad** = ambos ejes a la vez; implementada nativamente en XTDB ([docs de bitemporality](https://v1-docs.xtdb.com/concepts/bitemporality/)), SQL Server temporal tables, etc. `[PROD]` — el caso de uso que paga el costo: auditoría/corrección retroactiva ("el cliente me avisó HOY que el viaje se movió hace una semana — ¿qué sabía el sistema cuando mandó aquel recordatorio?").
- **Temporal patterns de Fowler** ([martinfowler.com/eaaDev/timeNarrative.html](https://martinfowler.com/eaaDev/timeNarrative.html)): *Effectivity* (todo objeto/regla con rango de vigencia), *Temporal Property*, *Audit Log*. Es el catálogo canónico para **versionar las reglas mismas** — una regla con `effective_from/effective_to` en vez de sobrescribir. `[PROD]` (doctrina establecida, usada en payroll/seguros/billing desde hace décadas).

### 2.4 Zonas horarias para eventos FUTUROS — la doctrina que invierte el instinto

- **"Just store UTC" es correcto para el pasado y INCORRECTO para eventos futuros con intención humana** (deadlines, check-ins): si las reglas de DST cambian entre hoy y la fecha (pasa varias veces por año en el mundo), el instante UTC guardado deja de corresponder a la hora local que el humano quiso. Doctrina canónica: **guardar hora local + IANA timezone (ej. `America/New_York`) como verdad, y el instante UTC como derivado recomputable** cuando se actualiza la tzdb ([CodeOpinion: "Just store UTC? Not so fast"](https://codeopinion.com/just-store-utc-not-so-fast-handling-time-zones-is-complicated/), [dev.to: Instant vs Local](https://dev.to/bwi/instant-vs-local-when-utc-helps-and-when-it-hurts-5d7p)). `[PROD]` (doctrina establecida; la tzdb IANA se actualiza varias veces al año).

**Síntesis sección 2:** esto NO es un problema greenfield. Legal docketing es un análogo casi 1:1 con 30 años de doctrina: (a) trigger → cascada → recompute como operación de primera clase, (b) reglas = datos versionados con vigencia (Effectivity), separados del motor, curados por expertos del dominio, (c) fechas futuras en hora local + IANA tz, (d) bitemporalidad solo donde la auditoría lo justifique.

---

## 3. Extracción estructurada desde email

### 3.1 El estándar existente: schema.org Email Markup / Gmail Annotations

- Google define markup JSON-LD embebido en el HTML del mail para reservas: **`FlightReservation`, `LodgingReservation`, `EventReservation`, `Order`**, etc. ([Gmail Markup reference](https://developers.google.com/workspace/gmail/markup/reference), [LodgingReservation](https://developers.google.com/workspace/gmail/markup/reference/types/LodgingReservation)). Gmail lo usa para sus Highlights y para las **summary cards renovadas (oct 2024)** de compras/eventos/viajes ([blog de Google](https://blog.google/products-and-platforms/products/gmail/new-gmail-summary-cards/)). `[PROD]` (a escala Gmail).
- Para que Gmail *renderice* el markup el remitente necesita pasar por **registro/whitelisting** con Google. **Implicación clave para un tercero que parsea mails:** el markup, cuando el proveedor lo emite, **viaja embebido en el HTML del mail** — cualquier sistema con acceso al MIME crudo puede extraer ese JSON-LD directamente, con parser determinista, sin LLM. Si los proveedores relevantes (aerolíneas, hoteles, Disney) emiten markup, es extracción gratis y exacta. Si lo emiten o no, hay que verificarlo empíricamente contra mails reales — `[REQUIRES_LIVE_VALIDATION]` para los proveedores específicos del dominio.

### 3.2 Cómo lo hace Google a escala: template-based extraction (Juicer)

- **"Anatomy of a Privacy-Safe Large-Scale Information Extraction System Over Email"** (Google, KDD 2018, [ACM](https://dl.acm.org/doi/10.1145/3219819.3219901), [Google Research](https://research.google/pubs/anatomy-of-a-privacy-safe-large-scale-information-extraction-system-over-email/)): el insight estructural es que **los mails B2C son generados por máquina desde plantillas** — Juicer clusteriza mails por template de origen, corre clasificadores/extractores por cluster, y agrega los resultados en **reglas estáticas de alta precisión** que se aplican online. Sirve a mil millones de usuarios (bill reminders, ofertas, reservas de hotel). `[PROD]` — el paper canónico de extracción de email en producción.
- **TripIt** (SAP Concur) es el análogo de producto exacto en travel: forward del mail de confirmación a `plans@tripit.com` → itinerario estructurado; mantiene soporte por proveedor/plantilla ([cómo funciona](https://www.tripit.com/web/free/how-it-works), [vendor confirmation support](https://help.tripit.com/en/support/solutions/articles/103000127241-vendor-confirmation-email-support)). `[PROD]`. Cifras que circulan sobre su precisión ("1,247 templates", "99.3% field accuracy", "DFA no LLM") provienen de blogs SEO sin fuente primaria → `[NO VERIFICADO]`. Lo verificable: el patrón de producto (dirección de forwarding + parsing por plantilla de proveedor) funciona comercialmente hace 15+ años.

### 3.3 LLM structured extraction (2025-2026): qué garantiza qué

Consenso actual bien documentado ([guía Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms), [análisis técnico](https://mbrenndoerfer.com/writing/structured-outputs-schema-validated-data-extraction-language-models)):

| Técnica | Garantía | Números reportados |
|---|---|---|
| Prompt engineering solo | ninguna | ~80–95% output parseable |
| Function calling / tool use | schema casi siempre | ~95–99% |
| **Constrained decoding** (structured outputs nativos, Outlines) | **100% schema-valid** (se restringe a nivel de token) | GPT-4 sin constrained: 11.97% inválido en extracción compleja |

- **La trampa canónica: schema-valid ≠ correcto.** Constrained decoding garantiza la *forma*, no que el número de confirmación sea el del mail. La correctitud solo se mide contra golden set. `[PROD]` (consenso de toda la literatura de la categoría).
- **Patrón de validación establecido:** Pydantic schema + validadores semánticos + retry-with-feedback (librería **Instructor** como implementación de referencia, [guía](https://zenvanriel.com/ai-engineer-blog/instructor-structured-output/)); las validation errors se realimentan al modelo. `[PROD]` (Instructor ampliamente adoptada).

### 3.4 Cómo se mide y garantiza la precisión (doctrina de document extraction)

Doctrina compartida por la industria de document AI (Google Document AI, Azure Document Intelligence, vendors IDP):

1. **Golden set** de documentos anotados a mano; métrica = **precision/recall a nivel de CAMPO** (no "el documento salió bien"), porque un solo campo crítico errado (fecha de pago final) invalida el registro. `[PROD]`
2. **Confidence-threshold routing:** cada campo extraído lleva score de confianza; bajo el umbral → **cola de revisión humana** en vez de auto-commit. Es el patrón HITL estándar de todos los productos IDP. `[PROD]`
3. **La corrección humana realimenta el golden set** (y eventualmente las reglas/few-shots) — el loop de mejora es parte del producto, no un afterthought. `[PROD]`
4. Para campos de altísimo costo de error, doble validación cruzada: extracción + **regla determinista de consistencia** (checksum de localizador, fecha dentro del rango del viaje, monto = suma de items). Patrón documentado en pipelines de invoice processing. `[PROD]`

**Síntesis sección 3:** el estado del arte probado es **híbrido en capas**: (0) si el mail trae JSON-LD schema.org → parser determinista; (1) template conocida → reglas deterministas (doctrina Juicer/TripIt); (2) template desconocida → LLM con constrained decoding + Pydantic + retry; (3) todo campo bajo umbral de confianza → revisión humana de un tap; (4) golden set field-level como métrica de verdad.

---

## 4. Durable execution para procesos de meses (Temporal)

### 4.1 Límites duros y el patrón de vida larga

- **Límites de Event History:** 51,200 events o 50 MB por Workflow Execution (warning en 10,240 / 10 MB); alcanzar el límite **termina** el workflow ([docs: limits](https://docs.temporal.io/workflow-execution/limits), [docs: event history](https://docs.temporal.io/workflow-execution/event)). **No hay límite de duración temporal** — un timer durable de 18 meses es válido; lo que mata al workflow es acumulación de eventos, no el calendario. `[PROD]`
- **Continue-as-New** es la válvula canónica: cerrar la ejecución y arrancar una nueva con el estado serializado como input, historia en cero ([blog oficial "Managing very long-running Workflows"](https://temporal.io/blog/very-long-running-workflows)). El patrón consagrado para "una entidad de negocio viva durante meses/años" es el **Entity Workflow pattern** (workflow long-running por entidad, procesa signals, hace CAN periódico). `[PROD]` — este repo ya lo opera (sesión permanente del copiloto vía CAN, PR #122).
- **Alternativa igualmente canónica:** estado en Postgres + **Schedules/timers que despiertan workflows cortos** al llegar cada hito. Temporal documenta ambos; la comunidad usa ambos según si la entidad necesita estado vivo continuo o solo despertares puntuales. `[PROD]`

### 4.2 Schedules vs cron vs timers

- **Temporal Schedules** reemplazan formalmente a los cron jobs: pausables, actualizables, con backfill, observables, con políticas de overlap ([docs Schedule](https://docs.temporal.io/schedule), [blog oficial](https://temporal.io/blog/temporal-schedules-reliable-scalable-and-more-flexible-than-cron-jobs)); Temporal Cron Jobs quedaron desaconsejados ([docs cron-job](https://docs.temporal.io/cron-job)). `[PROD]`
- Distinción operativa asentada en la doctrina Temporal: **timer** = "despertar en un momento relativo a este workflow"; **Schedule** = "proceso recurrente/calendarizado gestionable desde afuera" (pausar, actualizar, backfill sin tocar código).

### 4.3 Versionado de workflows en vuelo — el problema crítico de los 18 meses

Estado 2025-2026, directamente de docs y blog oficial:

- **Patching API** (`workflow.patched()` / `deprecate_patch`): branch en el código para que replays viejos sigan la rama vieja ([docs Python versioning](https://docs.temporal.io/develop/python/workflows/versioning)). Costo real documentado: **hay que mantener ambas ramas hasta que muera el último workflow viejo** — con deploys frecuentes sobre workflows de 18 meses, la acumulación de patches es el problema, no la excepción. `[PROD]`
- **Worker Versioning** (GA 2025): pinnear workflows a Worker Deployment Versions — `PINNED` (toda la vida en la versión donde nació) o `AUTO_UPGRADE` ([docs Worker Versioning](https://docs.temporal.io/production-deployment/worker-deployments/worker-versioning), [blog GA](https://temporal.io/blog/ga-worker-versioning-public-preview-upgrade-on-continue-as-new)). Guía oficial explícita: **si el workflow va a vivir más que tus deployments, PINNED puro no sirve** (tendrías que mantener fleets de workers viejos por 18 meses) — para entity workflows de meses el patrón recomendado emergente es **Pinned + "Upgrade on Continue-as-New"** (public preview 2026): el run corre pinneado sin patches, detecta que hay versión nueva vía `target_worker_deployment_version_changed`, y salta de versión en el próximo CAN. `[PROD]` (GA) / `[PROD-PREVIEW]` (upgrade-on-CAN).
- **Replay testing** (`WorkflowReplayer`): correr las historias de ejecuciones vivas contra el código nuevo ANTES de deployar, como gate de CI — la única verificación empírica de compatibilidad de replay. `[PROD]` — este repo ya lo practica ("replay-verify antes de deployar", PR #122).

### 4.4 Idempotencia de efectos externos

- **Idempotency keys** al estilo Stripe: el cliente genera una key única por operación lógica; el servidor la correlaciona con el estado (in-flight / done+respuesta canónica / nueva) y cortocircuita duplicados ([Stripe blog, canónico](https://stripe.com/blog/idempotency), [implementación de referencia en Postgres, brandur.org](https://brandur.org/idempotency-keys)). `[PROD]`
- En Temporal las activities se reintentan por diseño → **todo side effect externo debe ser idempotente**; la doctrina oficial es derivar la idempotency key de IDs que Temporal ya garantiza únicos y estables (`workflow_id + activity_id/run_id`). `[PROD]` — este repo ya paga este costo en MercadoPago (webhook HMAC + dedup).

**Síntesis sección 4:** para "la reserva vive 18 meses y el código cambia 50 veces en el medio", el estado del arte es: entity workflow con CAN periódico como válvula, Schedules para despertares calendarizados, **Pinned + Upgrade-on-CAN** como estrategia de versionado (con Patching como herramienta puntual, no como dieta), replay testing en CI como gate, e idempotency keys derivadas de IDs de Temporal en todo efecto externo.

---

## 5. Memoria de largo plazo en agentes

### 5.1 Los cuatro sistemas/papers de referencia

- **Zep / Graphiti** — "Zep: A Temporal Knowledge Graph Architecture for Agent Memory" ([arXiv:2501.13956](https://arxiv.org/abs/2501.13956)): knowledge graph **bitemporal** (cada edge lleva cuándo el hecho fue verdad + cuándo el sistema lo supo; los hechos se invalidan, no se borran). Claims del paper: DMR **94.8% vs 93.4%** de MemGPT; en LongMemEval **hasta +18.5% accuracy y −90% latencia** vs baseline de contexto completo, con ventaja marcada en temporal reasoning y síntesis cross-session. `[PROD]` como producto (Zep comercial; Graphiti OSS ~20k stars) pero los números son `[VENDOR-BENCH]`. **Es el stack que este repo ya opera** (Graphity = Graphiti self-hosted).
- **MemGPT → Letta** — "MemGPT: Towards LLMs as Operating Systems" ([arXiv:2310.08560](https://arxiv.org/abs/2310.08560)): jerarquía de memoria estilo OS — main context (in-context, editable por el propio agente vía tools) + external context (fuera de ventana, paginado bajo demanda). Evolucionó al framework **Letta** con persistencia Postgres. `[PROD]` (framework adoptado) / benchmarks originales `[PAPER]`.
- **Generative Agents** (Park et al., [arXiv:2304.03442](https://ar5iv.labs.arxiv.org/html/2304.03442)): *memory stream* (registro append-only en lenguaje natural con timestamp), retrieval por **recency (decae exponencial) × importance (score LLM al crear) × relevance (embedding)**, y **reflection** (síntesis periódica de observaciones en inferencias de alto nivel, disparada por umbral de importancia acumulada). `[PAPER]` — simulación (Smallville), NO producción; pero su fórmula de retrieval y el concepto de reflection fueron absorbidos por casi todos los sistemas posteriores.
- **Mem0** ([arXiv:2504.19413](https://arxiv.org/abs/2504.19413)): extracción incremental de "memories" + variante con grafo; claims: +26% vs memoria de OpenAI en LOCOMO, −91% p95 latency, −90% tokens vs full-context. `[VENDOR-BENCH]` — nota: los vendors de memoria (Zep, Mem0) se han re-corrido los benchmarks mutuamente con resultados contradictorios; ningún número de esta categoría debe tomarse sin replicación propia.

### 5.2 El benchmark serio y lo que revela

- **LongMemEval** (ICLR 2025, [paper](https://arxiv.org/pdf/2410.10813), [repo](https://github.com/xiaowu0162/longmemeval)): 500 preguntas sobre historiales largos midiendo **5 habilidades: information extraction, multi-session reasoning, temporal reasoning, knowledge updates, abstention**. Hallazgo central: **asistentes comerciales y long-context LLMs pierden ~30% de accuracy** al memorizar a través de sesiones sostenidas. Propone descomponer el diseño de memoria en **indexing / retrieval / reading**, con optimizaciones medibles (session decomposition, fact-augmented key expansion, time-aware query expansion). `[PAPER]` — es el benchmark independiente más citado; usa esto, no DMR (saturado, el propio paper de Zep lo critica).

### 5.3 Qué se sabe que funciona y qué NO

**Funciona (convergencia de evidencia):**
- Memoria **estructurada con eje temporal** (KG temporal / bitemporal) supera a vector RAG naive precisamente en lo que este producto necesita: *temporal reasoning* y *knowledge updates* ("el viaje se movió") — convergen el paper de Zep y las debilidades que LongMemEval expone en RAG plano. `[PAPER]`+`[VENDOR-BENCH]` coincidentes.
- Separación **working memory (in-context) / archival (external)** con paginación explícita (MemGPT). `[PROD]`
- Retrieval multi-señal (recencia × importancia × relevancia), no solo similitud coseno (Park et al.). `[PAPER]` ampliamente adoptado.

**NO funciona (documentado):**
- **Vector RAG naive como memoria de agente**: falla en razonamiento temporal, en updates (la versión vieja del hecho sigue matcheando por similitud) y en abstención (LongMemEval). `[PAPER]`
- **Full-context como estrategia**: −30% en interacciones sostenidas incluso con ventanas enormes, y latencia/costo prohibitivos (LongMemEval, Zep, Mem0 coinciden). `[PAPER]`
- **Extraer "facts" destilados y descartar el original**: ablación controlada encontró que **chunks verbatim superan a artefactos extraídos** en conversaciones largas ([arXiv:2601.00821](https://arxiv.org/pdf/2601.00821)) — la extracción pierde detalle que después se necesita. Implicación: la memoria destilada debe ser índice/proyección, no reemplazo del registro original. `[PAPER]`
- **El grafo como source of truth del negocio**: ningún sistema serio lo hace; el estado transaccional (ventas, montos, comisiones) vive en DB relacional y la memoria conversacional/grafo es capa de recall — coincide con la doctrina ya asentada en este repo (grafo=PROYECCIÓN, DB=SoT). `[PROD]` (práctica general).

---

## 6. HITL en acciones con consecuencia (plata, mensajes a terceros)

### 6.1 Clasificación de acciones — la matriz canónica

Convergencia clara de las guías de producción 2025-2026 ([Galileo](https://galileo.ai/blog/human-in-the-loop-agent-oversight), [patrones HITL](https://cordum.io/blog/human-in-the-loop-ai-patterns), [StackAI](https://www.stackai.com/insights/human-in-the-loop-ai-agents-how-to-design-approval-workflows-for-safe-and-scalable-automation)):

- Clasificar cada acción por **dos ejes: severidad de consecuencia × reversibilidad**, mapeando a modos de operación:
  - read-only → autónomo, sin fricción;
  - reversible / bajo impacto → actuar + **post-execution review** (visible, deshacible);
  - **externo o irreversible o con plata** (mandar mail a un cliente, cobrar, agendar con terceros) → **pre-execution approval obligatoria**;
  - señal de riesgo anómala → escalar aunque la categoría fuera autónoma (escalation triggers).
- **Principio duro compartido:** la aprobación ocurre ANTES del side effect — aprobar después es solo auditoría retrospectiva. `[PROD]` (doctrina uniforme en toda la categoría).
- **OWASP Top 10 for LLM Applications — "Excessive Agency"** ([genai.owasp.org](https://genai.owasp.org/)): least privilege en tools, límites explícitos de alcance, y aprobación humana para acciones de alto impacto como mitigación nombrada del riesgo estándar de agentes. `[PROD]` (estándar de industria).

### 6.2 Mecánica de la aprobación durable

- El patrón de implementación correcto documentado: **interrupción asíncrona con estado durable** — el agente serializa su estado, la aprobación llega cuando llega (minutos o días), y la ejecución resume desde el checkpoint ([patrones HITL de alto riesgo](https://dev.to/omnithium/human-in-the-loop-patterns-for-high-stakes-ai-agent-decisions-1fg6)). En Temporal esto es literalmente **workflow bloqueado en `wait_condition` esperando un signal de aprobación** — patrón canónico documentado por Temporal para HITL, y ya operativo en este repo (confirm-gate de Composio, PR #104). `[PROD]`
- La aprobación debe mostrar **exactamente lo que se va a ejecutar** (destinatario, monto, texto final), no una descripción — el humano aprueba el artefacto, no la intención. `[PROD]` (doctrina uniforme).

### 6.3 Undo, dry-run, límites

- **Undo por retención/delay**: Gmail "Undo Send" — no es rollback, es **ejecución diferida N segundos con ventana de cancelación**. Patrón canónico para acciones outbound donde el "undo" real no existe (un mail enviado no se des-envía). `[PROD]`
- **Dry-run como contrato**: Terraform `plan`/`apply` es el patrón de referencia — el sistema computa y muestra el plan exacto de efectos, el humano aprueba ese plan, y se ejecuta *ese* plan (no una recomputación). `[PROD]`
- **Límites cuantitativos** (spending caps por operación/período, allowlists de destinatarios, rate limits de outbound) como defensa independiente del juicio del LLM — defensa en profundidad estándar en pagos, adoptada por las guías de agentes. `[PROD]`
- **Autonomía graduada**: arrancar con approval-para-todo y relajar por tipo de acción según track record de aceptación — propuesto de forma consistente en las guías 2025-2026; sin estudio cuantitativo canónico que lo valide → doctrina razonable pero `[NO VERIFICADO]` como "probado".
- **Idempotencia y exactly-once del lado del efecto**: ver §4.4 (Stripe idempotency keys) — la aprobación humana no reemplaza la idempotencia; un retry post-aprobación no debe duplicar el cobro. `[PROD]`

---

## 7. Category creation / posicionamiento premium (breve — no es el foco)

- **Play Bigger** (Ramadan, Peterson, Lochhead, Maney, 2016 — [libro](https://www.amazon.com/Play-Bigger-Dreamers-Innovators-Dominate/dp/0062407619)): la doctrina del *category design* — no competir dentro de una categoría existente sino nombrar y definir una nueva, con POV propio que redefine el problema. Su dato insignia: el **"category king" captura ~76% del market cap de la categoría**. Caveat: es análisis propio de los autores sobre tech companies (2000-2015), no peer-reviewed — direccionalmente influyente, numéricamente `[NO VERIFICADO]` como hallazgo científico. La aplicación al caso: vender "copiloto/secretario proactivo" como categoría propia en vez de "CRM para agentes de viaje" es exactamente el playbook — el precio se ancla contra el problema que la categoría nueva resuelve (horas del agente, ventas caídas por deadlines perdidos), no contra el precio del CRM adyacente.
- **April Dunford, *Obviously Awesome*** (2019): el mecanismo táctico — el posicionamiento elige deliberadamente el *frame de referencia competitivo*; el mismo producto es "caro" contra CRMs y "barato" contra contratar un asistente humano. Elegir la alternativa competitiva correcta ("lo que el cliente haría sin vos": planillas + memoria + pánico) es la palanca de pricing premium. `[PROD]` (doctrina de posicionamiento B2B ampliamente adoptada).

---

## LOS 7 HALLAZGOS QUE MÁS DEBERÍAN CAMBIAR NUESTRO DISEÑO

1. **El motor de hitos ya tiene doctrina madura de 30 años: legal docketing** — trigger event → cascada de deadlines derivados con **recomputación automática cuando la fecha base cambia** como operación de primera clase, y las reglas como **datos versionados con vigencia (Effectivity), separados del motor** y curados por un experto del dominio.
2. **La proactividad se diseña precision-first o muere**: la clínica documenta ~90% de override y −30% de aceptación por alerta adicional; el marco de Horvitz (interrumpir sii valor esperado > costo de interrupción, con tiering interrupt/digest/log y feedback loop de aceptación) es la única doctrina probada para no entrenar al usuario a ignorarte.
3. **Los mails de confirmación son instancias de plantillas, y algunos ya traen JSON-LD schema.org embebido**: el estado del arte probado a escala (Google Juicer, TripIt) es extracción en capas — markup embebido → reglas por template → LLM constrained como fallback — no "LLM para todo"; verificar empíricamente qué emiten los proveedores del dominio es el spike obvio.
4. **Constrained decoding garantiza 100% schema-validity pero cero correctness**: la precisión real solo existe con golden set field-level + confidence-threshold routing a revisión humana de un tap, cuya corrección realimenta el sistema.
5. **Para procesos de 18 meses en Temporal, el patrón 2025-26 es Pinned + Upgrade-on-Continue-as-New + replay testing en CI** — el Patching API puro no escala con deploys frecuentes sobre workflows longevos, y CAN periódico es válvula obligatoria (límite duro de 51,200 events / 50 MB).
6. **Deadlines futuros NO se guardan en UTC**: hora local + IANA timezone como verdad y el instante UTC como derivado recomputable (las reglas de DST cambian); bitemporalidad (valid time vs transaction time) solo donde auditar "qué sabía el sistema cuándo" pague su costo.
7. **La memoria se parte en dos por evidencia, no por gusto**: el estado de negocio (ventas, montos, fechas) en Postgres como source of truth, y el KG temporal (Graphiti — que ya operamos) como memoria conversacional/proyección — vector RAG naive falla justo en temporal reasoning y knowledge updates (−30% en LongMemEval), y destilar hechos descartando el original pierde detalle recuperable.
