# Estado del arte: cómo trabaja realmente un agente de viajes especializado en Disney/Universal

**Fecha de la investigación:** 2026-07-20. **Mercado principal:** US (donde está la doctrina y la mayoría de fuentes verificables). **Nota LatAm/Argentina:** incluida donde se encontró evidencia — es escasa.

## Nota metodológica y limitaciones (leer antes que el resto)

- **Reddit fue inaccesible en este entorno de investigación**: WebFetch rechaza explícitamente `reddit.com`/`old.reddit.com`, y WebSearch no indexa de forma útil ese dominio para estas queries (~10 intentos dirigidos a r/TravelAgent, r/DisneyWorld, r/WaltDisneyWorld devolvieron cero resultados utilizables). Esto es una **limitación de herramienta de esta sesión, no evidencia de ausencia** del fenómeno en Reddit. Se compensó con DISboards (foro real de Disney, con comunidad de agentes activa), blogs de host agencies, Travel Market Report/Travel Weekly/TravelAge West (prensa trade), y páginas de producto de CRMs especializados (que documentan el dolor como justificación comercial — se etiquetan igual como `[FORO/BLOG]`, con la salvedad de que el interés comercial del vendor puede sesgar el framing). Grupos de Facebook cerrados (ej. "Ask a Disney Travel Agent") tampoco fueron accesibles.
- Varios dominios oficiales de Disney (`disneyworld.disney.go.com`, `disneycruise.disney.go.com`) **bloquearon el fetch directo** (timeout/ECONNRESET) por su naturaleza de SPA con WAF — pero su contenido **sí apareció indexado en snippets de búsqueda**, por lo que se cita igual como `[OFICIAL]` aclarando en cada caso "indexado, fetch directo falló". Una excepción importante: la página de T&C de Disney Cruise Line (`disneycruise.disney.go.com/contracts-terms-safety/terms-conditions/united-states/`) **sí cargó completa** y se usó como fuente primaria verificada.
- `universalorlandovacations.com/general-information/terms-and-conditions` devolvió **HTTP 403** al fetch automatizado; se usaron espejos textuales de agencias autorizadas por Universal (Dreams Unlimited Travel, MousekePlanner) que citan el documento палabra por palabra, etiquetados `[OFICIAL]` porque el contenido es inequívocamente de Universal, no interpretación de terceros — pero con la salvedad de que **dos espejos del mismo documento difieren en el detalle de la tabla de cancelación** (ver §3.3).
- Toda afirmación lleva URL. Las etiquetas `[OFICIAL]` (fuente Disney/Universal/host agency oficial), `[FORO/BLOG]` (Reddit sustituto, foros, blogs no oficiales, prensa trade) y `[NO VERIFICADO]` (no se pudo confirmar) se usan literalmente como pidió la consigna.

---

## 1. Estructura del negocio

### 1.1 Host agency vs. agencia propia vs. independent contractor (IC)

El modelo dominante de la industria es el **IC colgado de una host agency**, no la agencia propia con credenciales propias.

- **`[OFICIAL]`** El propio disclaimer legal de Universal define la relación: *"Travel agencies are acting as independent contractors and these terms and conditions shall not be construed as creating the relationship of principal and agent or employer and employee between Universal and Client."* — [UOR Commission Guide 1.7.2025](https://boardwalktravelagency.com/wp-content/uploads/2025/01/TIS-Universal-Orlando-Commission-Guide.pdf) (documento oficial de Universal Parks & Resorts Vacations, espejado con membrete y disclaimer intactos).
- **`[FORO/BLOG]`** El host agency posee las credenciales de industria — número **IATA/IATAN**, **ARC**, **CLIA**, licencias de seller-of-travel — y el IC opera bajo esas credenciales sin tramitar las propias. Cuando el IC vende con el nombre/número IATA del host, el host recibe su parte contractual de la comisión. — [contrato real de host agency (PDF)](https://ictravel.com/wp-content/uploads/2022/09/Independent-Contractor-Agreement5-30SEP22.pdf)
- **`[FORO/BLOG]`** Tramitar el número IATA/IATAN propio (en vez de heredar el del host) exige experiencia profesional acreditada, estabilidad financiera, negocio registrado, cumplimiento del código IATAN, y seguro E&O (Errors & Omissions) — salvo exención por 2 años de experiencia full-time en los últimos 10. Por esto la mayoría opta por el host agency. — [hostagencyreviews.com/blog/iata-number](https://hostagencyreviews.com/blog/iata-number)
- **`[FORO/BLOG]`** Clasificación laboral: el IC es *"self-employed business person"*, completa W-9 antes del primer pago de comisión, y el host emite 1099-NEC a fin de año si ganó ≥$600. — agregado de [contrato mstagents.com](https://mstagents.com/wp-content/uploads/2024/03/Agent-Agreement.pdf) y [mjtravelservices.com](https://mjtravelservices.com/agents-only/contract/)
- **`[FORO/BLOG]`** Ejemplos reales de host agencies especializadas en Disney: **Dreams Unlimited Travel** (actualmente sin cupo para nuevos agentes — [dreamsunlimitedtravel.com](https://www.dreamsunlimitedtravel.com/vacationplanning/)); **MEI-Travel / Mouse Fan Travel** (130+ "Independent Vacation Planners", sin fee mensual, solo fee anual — [mei-travel.com](https://mei-travel.com/free-travel-agent)); **KHM Travel Group** ($64.95/mes + $149 registro único, o $649/año + $50 — [khmtravel.com/programs](https://khmtravel.com/programs/)).

### 1.2 Comisiones por proveedor/producto

#### Walt Disney World / Disneyland — `[FORO/BLOG]`, sin rate card oficial numérico públicamente accesible

- Paquetes WDW/Disneyland (room + tickets multi-día, bundleados): **10% flat**, sin variación por volumen. — [mainstreetagencytravel.com](https://mainstreetagencytravel.com/news/whats-the-current-disney-commission-rates-for-travel-agents) / [magicguides.com](https://magicguides.com/disney-travel-agent-commission-calculator/)
- Tickets standalone (1-2 días) y servicios sueltos: **NO comisionables**. — [magicguides.com](https://magicguides.com/disney-travel-agent-commission-calculator/)
- Dining Plan (dentro de paquete): **5%** según una fuente; ADR individuales (reservas de restaurante sueltas, sin paquete) **NO pagan comisión** según la misma. — [magicguides.com](https://magicguides.com/how-much-do-disney-travel-agents-make-per-booking/)
- **Annual Passes: NO comisionables — Disney prohíbe directamente a los agentes venderlos.** Contraste relevante: en Universal SÍ son comisionables (ver abajo). — [magicguides.com](https://magicguides.com/do-disney-travel-agents-get-commission-on-annual-passes/)

#### Disney Cruise Line (DCL) — estructura escalonada por volumen anual de la agencia, `[FORO/BLOG]` con discrepancia entre fuentes

| Volumen anual agencia | Comisión (fuente A) | Comisión (fuente B, contradice tramos) |
|---|---|---|
| <$67,000 | 10% | 10% |
| $67,000–$132,999 | 11% | — |
| $133,000–$291,999 | 12% | — |
| $292,000–$424,999 | 13% | — |
| $425,000–$569,999 | 14% | 15% en tramo $627,000–$1,606,000 (discrepante) |
| $570,000–$1,459,999 | 15% | — |
| ≥$1,460,000 | 16% | — |

Fuente A: [mainstreetagencytravel.com](https://mainstreetagencytravel.com/news/whats-the-current-disney-commission-rates-for-travel-agents). Fuente B (segunda mano, sin URL única citable): resultado agregado de búsqueda. **Ningún documento oficial con la tabla numérica de DCL fue accesible públicamente** — el PDF oficial `DCL_TAAP_Rates.pdf` que sí se pudo leer resultó ser tarifas de crucero con descuento para agentes (uso personal), no la tabla de comisión. **`[NO VERIFICADO]`** el tramo exacto — usar con cautela.

- Adventures by Disney: mismo esquema 10-16%, con excepción **8% flat** para reservas de jet privado. National Geographic Expeditions: **15%** en salidas seleccionadas. — [mainstreetagencytravel.com](https://mainstreetagencytravel.com/news/whats-the-current-disney-commission-rates-for-travel-agents)

#### Universal Orlando Resort — `[OFICIAL]`, tabla completa extraída del PDF oficial "UOR Commission Guide 1.7.2025"

Fuente primaria: [UOR Commission Guide 1.7.2025](https://boardwalktravelagency.com/wp-content/uploads/2025/01/TIS-Universal-Orlando-Commission-Guide.pdf) (contenido de Universal Parks & Resorts Vacations, © 2025).

| Producto | Comisión |
|---|---|
| Vacation Packages (hotel UOR + ticket UOR, auto-pulled) | **10% flat**, sin importar volumen |
| Tickets 2-Park 1-Day P2P, 2-Park 2-Day Base | 5% |
| Resto de tickets multi-día (3-5 días) | 10% |
| Tickets combo con Epic Universe | 8-10% según variante |
| Annual Pass no-residente de Florida | 10% |
| Annual Pass residente de Florida (todas las variantes) | 7% |
| Vacation Enhancements (Dining Card, transfers, rental car, VIP Tours, My Universal Photos, Cancel for Any Reason, etc.) | 5% o 10% según ítem |
| Monetary Gift Card, Express Pass (cualquier tipo), Explorer Ticket, Hollywood Drive-In Golf, 1-Day Volcano Bay Ticket, 1-Park 1-Day Base | **NO comisionable** |

Todas las comisiones se calculan **sobre precio pre-tax**; **no hay comisión sobre fees de cambio/cancelación**.

#### Seguro de viaje — `[FORO/BLOG]`, rangos dispares según canal

- "30% en Allianz travel insurance, 16% en el waiver, vía AgentMax" — [travelpulse.com](https://www.travelpulse.com/news/agents/travel-suppliers-with-the-best-commissions-for-travel-advisors)
- "hasta 12% por venta calificada" en programas de afiliados de Allianz — misma fuente.
- "típicamente 20-40% de la prima" — [magicguides.com](https://magicguides.com/how-much-do-disney-travel-agents-make-per-booking/)
- **Conclusión:** rango real probablemente 12-40% según aseguradora/canal; sin número único confiable. Es de los productos con **mayor comisión relativa** del mix Disney/Universal.

#### Nota LatAm/Argentina — `[FORO/BLOG]` + `[OFICIAL]` parcial

- Una fuente reporta rangos algo distintos para el segmento hispanohablante: 3-7% en tickets multi-día, 8-16% en estadías de resort, con el agente reteniendo "70% (o más)" y pago mensual vía ACH a agentes en México, US, Argentina, Costa Rica, Chile, Canadá, Colombia, Guatemala, Ecuador, Uruguay, UE. — agregado de [mhtravelagencyweb.com](https://mhtravelagencyweb.com/en/work-with-us/) y [agentes.happyadventurers.com](https://agentes.happyadventurers.com/p/agentes-certificados). **`[NO VERIFICADO]`** con fuente primaria — tratar como referencia blanda.
- Disney sí mantiene una página oficial de tour operators autorizados para Latinoamérica: **`[OFICIAL]`** [disneyworld.disney.go.com/es-ar/travel-agents-latin-america/](https://disneyworld.disney.go.com/es-ar/travel-agents-latin-america/) — sin cifras de comisión visibles públicamente.

### 1.3 Split host agency / agente independiente

El patrón dominante en la industria es **split porcentual creciente por volumen**, no "100% menos fee fijo":

- **`[OFICIAL]`** **Fora Travel**: arranca **70/30** (agente/Fora), sube a **80/20** al alcanzar $300,000 en bookings/12 meses, y **90/10** al llegar a $2M anuales. Membresía $299/año o $99/trimestre. — [foratravel.com](https://www.foratravel.com/join/resources/how-do-travel-agents-get-paid)
- **`[OFICIAL]`** **Nexion Travel Group**: plan "Nexion 100" permite retener **100%** en proveedores no-ARC; planes generales van de **70% a 90%**; nuevos agentes arrancan en **60%** hasta completar "Travel Leaders of Tomorrow", luego suben a 70%. — [internova.com](https://internova.com/nexion-travel-group-re-introduces-nexion-100-plan/)
- **`[OFICIAL]`** **InteleTravel**: arranca en **70%** sin cuota de ventas, sube a **80%** al cumplir metas. Costo de entrada $179.99 + $39.99/mes. — [blog.inteletravel.com](https://blog.inteletravel.com/what-is-my-commission-as-an-inteletravel-agent-and-when-am-i-paid)
- **`[FORO/BLOG]`** Regla general citada por la industria: *"splits ranging from 70/30 to 90/10 in your favor... look for at least 70/30"*, con fees típicos de $25-$100/mes. — [hostagencyreviews.com](https://hostagencyreviews.com/blog/host-agency-commission-plan-comparison-calculator)
- **`[FORO/BLOG]`, foro real (DISboards), específico Disney**: agentes reportan splits de **50/50** para principiantes y **80/20** para experimentados; un caso con 10% de comisión total repartido 7% agente / 3% agencia. — [disboards.com](https://www.disboards.com/threads/commission-on-trips.3952475/)
- **`[FORO/BLOG]`** El split desfavorable a veces compensa porque el host negocia tasas base más altas: *"an independent agent might earn 10%... a well-connected host agency might negotiate 15% – even after an 80/20 split, you'd still pocket 12%."* — [mainstreetagencytravel.com](https://mainstreetagencytravel.com/news/host-agency-vs-independent-commission-rates)

### 1.4 Cuándo se paga la comisión — el dato más sólido de esta sección

**Disney** — `[OFICIAL]`, PDF "Disney Destinations Commission Research Information" (dominio oficial `media.disneywebcontent.com`):

| Producto | Timing de pago |
|---|---|
| WDW Packages (Walt Disney Travel Company) | **7-10 días después del check-out** |
| Aulani Packages | 7-10 días después del check-out |
| Disneyland Resort Packages | 7-10 días después del check-out |
| WDW Room Only | Después del check-out, sin rango de días fijo publicado |
| WDW Ticket Order/VIP Tours | Tras pago completo del ticket, o tras ocurrido el VIP Tour |
| Disney Cruise Line | Sin rango de días fijo en el documento oficial (mecanismo de research bajo demanda) |

Fuente: [Disney_Destinations_Commission_Research_Information.pdf](https://media.disneywebcontent.com/Media/media1/AgentCentral/Disney_Destinations_Commission_Research_Information.pdf). Pago ACH: 3 días hábiles; cheque: 7-10 días vía USPS.

- **`[FORO/BLOG]`, contradice parcialmente lo anterior**: otro blog especializado (pixiedustcrm.dev) afirma "comisión Disney paga ~60 días después de completado el viaje" — cifra **inconsistente** con el "7-10 días post-checkout" del documento oficial de Disney para paquetes WDW. Dado que la fuente oficial es primaria y específica por producto, se prioriza el 7-10 días para WDW packages; el "~60 días" queda marcado **`[NO VERIFICADO]`** y posiblemente aplica a un producto distinto o está desactualizado.

**Disney Cruise Line — contradicción sin resolver entre "antes" y "después" del crucero**:
- **`[FORO/BLOG]`, prensa trade reconocida**: Travel Market Report (25-sep-2024) afirma *"Disney Cruise Line pays commissions to travel advisors upon receipt of the client's final payment"* — es decir, **antes de zarpar** (el final payment de DCL vence 90-120 días antes del embarque, ver §3.2). — [travelmarketreport.com](https://www.travelmarketreport.com/cruises/articles/heres-when-each-cruise-line-pays-travel-advisors-their-commission)
- **`[FORO/BLOG]`, foro real (DISboards)**: un ex-agente Disney afirma *"Disney pays the commission after travel is completed"*, con demora hasta el mes siguiente de payroll. — [disboards.com](https://www.disboards.com/threads/commission-on-trips.3952475/)
- **Evaluación**: la fuente trade + otro blog coinciden en "antes del viaje, tras el pago final" para DCL; la fuente de foro pudo confundir la regla de WDW (post-checkout) con la de DCL. **`[NO VERIFICADO]`** de forma concluyente — señalado como punto de fricción entre fuentes.

**Universal Orlando** — `[OFICIAL]`, mismo PDF de tablas de comisión, el dato más limpio de toda la investigación:

> *"Payment of commission to travel agency will be issued **thirty (30) days after completion of client's travel**. No commission is paid on change or cancellation fees."*

— [UOR Commission Guide 1.7.2025](https://boardwalktravelagency.com/wp-content/uploads/2025/01/TIS-Universal-Orlando-Commission-Guide.pdf)

### 1.5 Certificaciones Disney: College of Disney Knowledge, EarMarked, ADVP

**College of Disney Knowledge (CDK)** — `[FORO/BLOG]` con 6+ fuentes independientes convergentes:
- Plataforma de entrenamiento oficial, **gratuita**, online, self-paced (completable en pocos días). Cubre WDW, Disneyland, DCL, Adventures by Disney, Aulani, National Geographic Expeditions. Al completarla: estatus **"CDK Graduate"**. — [magicguides.com](https://magicguides.com/how-to-become-a-disney-travel-agent/) / [vincentvacations.com](https://www.vincentvacations.com/how-to-disney-travel-agent/what-is-the-disney-college-of-knowledge)
- Habilita: acceso al portal de reservas de agente, tarifas "Travel Agent Appreciation Program" (uso personal, requiere IATA/CLIA válido — confirmado también por el PDF oficial de DCL TAAP rates), acceso a FAM trips. Es **requisito obligatorio** (no opcional) para operar bajo agencia EarMarked.

**EarMarked** — hallazgo clave que corrige un supuesto común: **NO es una certificación individual del agente, es una designación a nivel AGENCIA.**
- **`[FORO/BLOG]`, fuente de alta confiabilidad (agencia certificada hablando de sí misma)**: *"EarMarked status applies to the agency, not the individual advisor... being earmarked is a recognition of sales volume, not a requirement to sell Disney travel."* — [momapprovedtravel.com](https://www.momapprovedtravel.com/book-with-an-authorized-disney-vacation-planner/)
- **`[FORO/BLOG]`** Niveles: **Silver, Gold, Platinum, Diamond**, basados en volumen de ventas, auditoría anual, y requisito de que TODOS los agentes de la agencia sean CDK Graduates vigentes. — [magicguides.com](https://magicguides.com/what-is-an-earmarked-by-disney-authorized-travel-agency/)
- **`[FORO/BLOG]`** El programa **ya existía en 2022-2023** con niveles Diamond activos (*"only five travel agencies in the world earned Diamond level status in 2022"*) — no es una novedad reciente. — [mickeytravels.com, 1-ene-2023](https://mickeytravels.com/blog/mickeytravels-llc-earns-elite-diamond-earmarked-status/)
- **`[NO VERIFICADO]`**: una sola fuente secundaria (magicguides.com) afirma que en **febrero de 2026 Disney "actualizó oficialmente el branding"** reemplazando "Authorized Disney Vacation Planner" por "EarMarked by Disney — Authorized Travel Agency" como término preferido. **No se encontró comunicado de prensa oficial de Disney que confirme este supuesto rebrand** — dado que "EarMarked" ya circulaba desde 2022, es más probable que ambos términos hayan coexistido por años y que el "rebrand 2026" sea una exageración editorial de una sola fuente. Marcado explícitamente como no confiable.

**Authorized Disney Vacation Planner (ADVP)** — `[FORO/BLOG]`: nombre histórico/alternativo del mismo programa de reconocimiento de **agencia** (no de la persona). *"'Authorized Disney Vacation Planner' is a title for the agency (the company), not the individual person. However, Disney requires that every agent booking travel at these agencies must be a graduate of the College of Disney Knowledge."* — [magicguides.com](https://magicguides.com/what-is-an-authorized-disney-vacation-planner)

**Análogo en Universal** — `[OFICIAL]`/`[FORO/BLOG]`:
- **"Universal and U"**: curso self-paced de ~90 minutos en `training.universalpartnercommunity.com`, otorga "Universal Orlando Resort Specialist". — [travelweekly.com](https://www.travelweekly.com/Travel-News/Travel-Agent-Issues/Universal-Orlando-launches-agent-certification-program)
- **"U-Preferred Agency Program"**: análogo de EarMarked, designación de agencia (no individuo), 5 tiers — **Diamond, Platinum, Gold, Silver, Bronze** — por volumen de ventas y expertise. — [travelagewest.com](https://www.travelagewest.com/Travel/Family-Travel/Introducing-Universal-s-U-Preferred-Agency-Program)

---

## 2. Flujo operativo real (lead → comisión cobrada)

### 2.1 Sistemas que toca un agente

- **Portal principal Disney (US) = `disneytravelagents.com`** ("DTA" — Domestic Travel Agent site). Ahí se hace el CDK, se reserva, se accede al hub de marketing. — `[FORO/BLOG]` [pixievacations.com](https://pixievacations.com/disney-travel-agent-guide/), confirmado por estructura de URLs oficiales `[OFICIAL]` [QuickReferenceGuide.pdf](https://media.disneywebcontent.com/StaticFiles/DTA-Domestic/pdf/Blog/QuickReferenceGuide.pdf)
- El motor de reservas se llama literalmente "**DISNEYTRAVELAGENTS.COM Online Booking Engine**" — job-aid oficial existe pero el contenido interno (screenshots) no pudo extraerse vía fetch. — `[OFICIAL]` [DTA_BookingJobAid_US.pdf](https://media.disneywebcontent.com/StaticFiles/DTA-Domestic/pdf/WDW/DTA_BookingJobAid_US.pdf)
- **`[ASSUMED_PENDING_VERIFY]`**: "Pixie Dust HQ" (`pixiedusthq.com`) suena al "Digital Agent Portal" pero es el portal de trade **EMEA/UK** (Disneyland Paris, DCL, mercado europeo) — no el portal doméstico US. No se confirmó la existencia de un producto llamado literalmente "Digital Agent Portal" en US.
- **VAX VacationAccess** (`vaxvacationaccess.com`, de Trisept/Travel Leaders Group): marketplace de 55+ proveedores leisure, cubre **tanto Disney como Universal** (Air, Car, Packages, Hotel, Transfer, Excursions). Solo lo reservado vía VAX es elegible para comisión en esos productos. — `[OFICIAL]` [hostagencyreviews.com](https://hostagencyreviews.com/travel-agency-software/vax-vacationaccess)
- **Universal**: registro/entrenamiento vía Universal Partner Community; la **reserva real** de paquetes se hace mayormente a través de **VAX**, no se confirmó un login de agente separado en `res.universalorlandovacations.com`.
- **GDS (Sabre/Amadeus/Apollo): NO se usan para reservar paquetes Disney o Universal.** Dominan vuelos/hoteles/autos genéricos, pero Disney/Universal empaquetan aire+hotel+tickets fuera del GDS. — `[FORO/BLOG]` [hostagencyreviews.com/blog/what-is-a-gds](https://hostagencyreviews.com/blog/what-is-gds)
- **Trams Back Office (TBO) + ClientBase** (hoy TRES Technologies/Sabre): back-office contable de la industria, integración con GDS, CRM, pago/tracking de comisión al IC dentro de una host agency. **No hay evidencia de integración automática entre VAX/Disney y Trams/ClientBase** — el único import confirmado es de archivos .txt delimitados por tabs/comas, cargados a mano. — `[OFICIAL]` [trams.com](https://www.trams.com/home/products_services/products/trams_back_office/), manual: [TBOManual.pdf](https://static.trams.com/TramsLibrary/documentation/tbo/TBOManual.pdf)
- Producto de terceros **Toggle** (`toggle.travel`) existe específicamente para "convertir datos de ClientBase/Trams/TRES en analytics + tracking de comisión con IA" — su sola existencia **confirma el gap** de comisión-tracking no resuelto nativamente.
- Consultas de estado de pago de comisión Disney: por email a `WDW.Disney.Central.IATA@disneyworld.com`, SLA de **10 días hábiles** — proceso manual, sin self-service en tiempo real.

### 2.2 El flujo paso a paso

1. **Lead**: contacto por formulario/llamada/mensaje, típicamente 6-12 meses antes del viaje para temporada alta.
2. **Cotización**: el agente arma opciones de paquete según presupuesto/preferencias.
3. **Hold**: en Disney, reservar 30+ días antes permite un "courtesy hold" sin pago inmediato (no garantiza disponibilidad sin el depósito estándar). — `[FORO/BLOG]` [dreamsunlimitedtravel.com](https://www.dreamsunlimitedtravel.com/room_package_terms.htm)
4. **Depósito**: Disney $200/reserva si se reserva 31+ días antes (pago completo si es a 30 días o menos, ver §3.1). Universal: $50/persona, con cargo automático del saldo a 45 días si no se avisa lo contrario.
5. **Pago final**: **va directo al proveedor (Disney/Universal), nunca a través de la agencia** — cheques del cliente deben salir a nombre de Disney, no de la agencia. — `[FORO/BLOG]` [mousesavers.com](https://mousesavers.com/working-with-a-travel-agent/)
6. **ADR (día 60)**, **Lightning Lane (día 7/3)**: ver tablas completas en §3.
7. **Check-in / día de llegada**: notificación de cuarto listo vía app, desbloqueo de puerta digital; la tarjeta física "Key to the World" solo se obtiene en el front desk al llegar (no antes). — `[FORO/BLOG]` [disboards.com](https://www.disboards.com/threads/can-i-get-a-key-to-the-world-card-in-advance.3958917/)
8. **Post-viaje → comisión**: ver §1.4. El statement de comisión llega como **PDF/Excel de 30-100 líneas por cheque** que el agente/agencia concilia a mano contra sus reservas — `[FORO/BLOG]` [pixiedustcrm.dev](https://pixiedustcrm.dev/blog/commission-reconciliation-for-travel-agents)

### 2.3 Qué se hace a mano — el hallazgo operativo más importante de todo el research

- **No existe un mecanismo oficial de "book on behalf of" para dining/Lightning Lane.** Un ex-agente Disney lo confirma en foro: *"you needed access to the client MDE account/password to book FP and to book dining online... we were not actually supposed to do the other things... but many agents proceeded anyway"*; también reconoce que **guardar el número de tarjeta del cliente era necesario aunque no estuviera permitido**, porque "there was no way to book dining without it". — `[FORO/BLOG]`, testimonio directo de alta credibilidad — [disboards.com](https://www.disboards.com/threads/travel-agent-question.3906899/)
- **Genie+/Lightning Lane se reserva día a día durante la visita**, no se puede pre-reservar como parte del paquete — operacionalmente inviable de manejar para múltiples clientes simultáneos en el parque cada mañana.
- **No hay automatización oficial para "cazar" cupos cancelados de ADR/Lightning Lane** — surgió un ecosistema de herramientas de terceros no oficiales: **MouseDining, MouseWatcher, Standby Skipper, Thrill Data, Mickey Alerts**, todas explícitamente "no afiliadas a WDW". TouringPlans tuvo su propio "Dining Reservation Finder" pero **Disney cambió el backend a fines de 2023 y la herramienta dejó de funcionar** — evidencia de que Disney bloquea activamente estos scrapers. — `[FORO/BLOG]` [mousewatcher.com](https://mousewatcher.com/) / [standbyskipper.com/faq](https://www.standbyskipper.com/faq)
- **Reconciliación de comisiones es manual por default**: sin reporte automático confirmado de Disney/Universal hacia el back-office del agente; solo import manual de archivos de texto.
- **Recordatorios de ventanas de booking (ADR día-60, Lightning Lane día-7) son manuales por defecto** — no hay ningún sistema oficial de Disney que alerte al agente "hoy es el día 60 de este cliente". Esto explica la existencia de CRMs de nicho (Pixie Dust CRM, Travel Mouse CRM) cuyo propio marketing lista exactamente estos gaps como features — confirmando por omisión que Disney/Universal no lo proveen nativamente.

---

## 3. Las fechas-regla (sección crítica)

### 3.1 Walt Disney World

| Hito | Regla exacta | Fuente | Vigencia / cambio reciente |
|---|---|---|---|
| **Pago final del paquete** | **30 días antes del check-in.** Depósito $200/reserva al reservar si es 31+ días antes; pago completo al reservar si es ≤30 días antes. Pagos parciales mínimo $20 permitidos hasta el día 30. | `[OFICIAL]` [2026 Website Package T&C](https://disneyworld.disney.go.com/terms-conditions-package-2026/) (indexado, fetch directo falló), corroborado por [planDisney](https://plandisney.disney.go.com/question/final-payment-due-date-562808/) | 2026, vigente. Hora ET exacta de corte **no encontrada** — no asumir 11:59pm sin confirmar. |
| **Check-in online** | Se habilita hasta **60 días antes** de la llegada, vía My Disney Experience, para 18+. | `[FORO/BLOG]` con alta convergencia (3+ fuentes) — [wdwinfo.com](https://www.wdwinfo.com/wdwinfo/resorts/online-checkin.htm) | 2025-2026, sin señales de cambio. Hora exacta de apertura no confirmada. |
| **ADR (dining)** | Ventana de **60 días** antes de cada comida para no-huéspedes (día por día). Huéspedes de hotel Disney pueden reservar **toda la estadía (hasta 10 días) de una sola vez** el día que se abre la ventana de 60 días desde el check-in — la "regla 60+10". Apertura **6:00 AM ET** en la app; línea telefónica abre 1h más tarde (7:00 AM ET). | `[OFICIAL]` mecanismo — [disneyworld.disney.go.com/faq/dining-reservations/](https://disneyworld.disney.go.com/faq/dining-reservations/advance-reservations/) (indexado); detalle vía `[FORO/BLOG]` [TouringPlans — regla 60+10](https://touringplans.com/blog/disney-in-a-minute-what-is-the-6010-rule/) | 2026, vigente. **Cambio reciente (feb-2026):** cancelación sin penalidad pasó de 24h a **2h antes**; no-show/tarde cuesta **$10/persona**. — [disneyfoodblog.com](https://www.disneyfoodblog.com/2026/02/19/we-hope-this-disney-world-dining-reservation-change-isnt-permanent/) |
| **Lightning Lane Multi Pass / Single Pass** | Renombrado desde Genie+/Individual Lightning Lane el **24 de julio de 2024** (vigente sin más cambios de nombre a jul-2026). Ventana: huéspedes de hotel Disney **7 días antes** (cubre hasta 14 días de estadía); no-huéspedes **3 días antes**. Apertura **7:00 AM ET**. Multi Pass = add-on de pago por persona/día (no incluido en ticket), rango aprox. **$25-45**; permite 3 atracciones antes de entrar, luego de a una. Single Pass = por atracción y persona, set reducido (Tron, Rise of the Resistance, Cosmic Rewind, Seven Dwarfs Mine Train, Avatar Flight of Passage — lista variable), rango aprox. **$19-25**. | `[OFICIAL]` ventana de días y mecánica — [disneyworld.disney.go.com/lightning-lane-passes/](https://disneyworld.disney.go.com/lightning-lane-passes/) (indexado); `[FORO/BLOG]` rangos de precio — [AttractionsMagazine 2026](https://attractionsmagazine.com/lightning-lane-2026-guide-for-walt-disney-world/), rename confirmado por [NerdWallet](https://www.nerdwallet.com/travel/news/disney-world-genie-plus-changes) | 2026, vigente. Precio es dinámico, no fijo — no hardcodear un número único. |
| **Individual Lightning Lane (= Single Pass)** | Mismo esquema de ventana (7/3 días, 7am ET). Límite: **hasta 2 Single Passes por día por persona**, pueden ser en parques distintos. Cada persona necesita pase propio. | `[FORO/BLOG]` — [disneytouristblog.com](https://www.disneytouristblog.com/individual-lightning-lanes-guide-prices-info/) | 2025-2026, vigente. |
| **Virtual Queue** | A jul-2026, **no hay ninguna VQ permanente activa** — todas las atracciones estándar usan standby + Lightning Lane. Disney la reactiva de forma situacional/temporal (ej. atracciones nuevas). Caso reciente: Bluey's Wild World (Animal Kingdom), con horarios 7am/10am, pasó a standby el 2-jun-2026. | `[OFICIAL]` estado general — [disneyworld.disney.go.com/guest-services/virtual-queue/](https://disneyworld.disney.go.com/guest-services/virtual-queue/) (indexado); `[FORO/BLOG]` detalle Bluey's — [disneyfoodblog.com may-2026](https://www.disneyfoodblog.com/2026/05/26/what-you-need-to-know-about-disney-worlds-newest-virtual-queue/) | Volátil por naturaleza — **re-verificar en cada viaje, no asumir estático.** |
| **Depósito inicial (paquete)** | **$200/reserva**, debido dentro de **3 días** de reservar (si no, se cancela automático); aplica si se reserva 31+ días antes. Reembolsable si se cancela con 30+ días de anticipación. | `[OFICIAL]` [2026 T&C](https://disneyworld.disney.go.com/terms-conditions-package-2026/) (indexado), corroborado por [planDisney](https://plandisney.disney.go.com/question/deposit-disney-vacation-606197/) | 2026, vigente. |
| **Cancelación / penalidades (paquete)** | **30+ días antes:** reembolso completo (menos cargos de terceros no reembolsables). **2-29 días antes:** penalidad fija **$200/paquete**, resto reembolsado. **1 día o menos / no-show:** 0% reembolso. | `[OFICIAL]` [2026 T&C](https://disneyworld.disney.go.com/terms-conditions-package-2026/), corroborado por [planDisney](https://plandisney.disney.go.com/question/current-cancellation-policy-walt-disney-world-vacation-604945/) | 2026, vigente. Ya existe versión "2027 T&C" publicada — para viajes 2027 verificar por separado (fuera de alcance de este research). |
| **Disney Dining Plan** | **Sigue existiendo, activo en 2026.** Discontinuado en 2020 (COVID), **reintroducido el 9-ene-2024**. Promo 2026: dining plan gratis para niños 3-9 con paquete de habitación Disney Resorts Collection + dining plan para 10+. Cambio futuro anunciado: **2027 se expande a 3 niveles** (Quick-Service, Table-Service, Deluxe Table-Service). | `[OFICIAL]` existencia y fecha — [disneyworld.disney.go.com/dining/plans/](https://disneyworld.disney.go.com/dining/plans/) (indexado); `[FORO/BLOG]` detalle — [DVC Rental Store](https://dvcrentalstore.com/blog/disney-dining-plan-guide/) | 2026, vigente. |
| **Memory Maker** | Sigue existiendo. **$185** si se compra 3+ días antes del viaje, **$210** si se compra durante el viaje (ahorro $25 por comprar antes). "One Day" **$75**. Passholders anuales: PhotoPass +$99/año. | `[OFICIAL]` — [disneyworld.disney.go.com/memory-maker/](https://disneyworld.disney.go.com/memory-maker/) (indexado, precios consistentes en 3 fuentes) | 2026, vigente. |
| **Disney's Magical Express** | **Confirmado discontinuado desde el 1-ene-2022.** Sin planes anunciados de reactivación. Reemplazado por **Mears Connect** (mismo operador de paradas): a may-2026, adulto $17.60 solo ida / $33.60 ida-vuelta; niño (3-9) $14.30/$27.30; +3% recargo combustible. | `[FORO/BLOG]` corroborado por planDisney (semi-oficial) — [undercovertourist.com](https://www.undercovertourist.com/blog/disneys-magical-express/) / [mickeyvisit.com abr-2026](https://mickeyvisit.com/disney-world-news-transportation-airport-shuttle-april-1-2026/) | Confirmado vigente a may-2026. |
| **Release de descuentos/promos** | Patrón histórico: **4 oleadas anuales** (enero, primavera, verano, otoño). Ejemplo concreto 2026: promo "Free Dining" (jun 28-oct 3, oct 19-31, dic 6-21 de 2026) liberada al público general el **12-mar-2026**, deadline de booking **30-abr-2026**. Room-only discount equivalente salió el mismo día. Próxima oleada (oct-dic 2026) estimada entre **9-jun y 7-jul-2026** — proyección, no confirmación oficial. | `[FORO/BLOG]` reconstrucción de patrón, sin fuente oficial que publique el calendario por adelantado — [disneytouristblog.com](https://www.disneytouristblog.com/disney-world-free-dining-dates/) | 2026, vigente. **Comunicar al cliente como "ventana probable", no como fecha garantizada.** |

### 3.2 Disney Cruise Line

| Hito | Regla exacta | Fuente | Vigencia / cambio reciente |
|---|---|---|---|
| **Pago final** | **Cruceros 1-5 noches: 90 días antes** del embarque. **Cruceros 6+ noches: 120 días antes.** Concierge: mismo esquema tras unificación reciente (antes tenía plazos más agresivos). | `[FORO/BLOG]` alta convergencia + corroboración semi-oficial (planDisney); fetch directo de la página oficial de FAQ cargó pero sin contenido útil (requiere JS) — [dvcshop.com](https://dvcshop.com/disney-cruise-lines-updated-final-payment-due-dates-cancellation-policies/) | **Cambio confirmado sep-2024** en política de concierge — [disneycruiselineblog.com sep-2024](https://disneycruiselineblog.com/2024/09/disney-cruise-line-updates-cancellation-policy-and-final-payment-due-date-for-concierge-bookings/) |
| **Depósito inicial** | **CAMBIO RECIENTE CONFIRMADO:** bajó de **20% a 10%** del valor del viaje para reservas hechas **desde el 18-jun-2025**. Reservas del 17-jun-2025 o antes mantienen 20%. Debido dentro de **3 días** de reservar. | `[OFICIAL]` — verificado por fetch directo exitoso de [T&C oficiales DCL US](https://disneycruise.disney.go.com/contracts-terms-safety/terms-conditions/united-states/) | Vigente desde 18-jun-2025. |
| **Cancelación / penalidades — 1-5 noches** | 90+ días: sin cargo · 89-45 días: monto del depósito/huésped · 44-30 días: 50% del precio total · 29-15 días: 75% · 14 días o menos: 100% (sin reembolso). | `[OFICIAL]` — fetch directo verificado, misma fuente que arriba | 2025-2026, vigente. |
| **Cancelación / penalidades — 6+ noches** | 120+ días: sin cargo · 119-56 días: monto del depósito/huésped · 55-30 días: 50% · 29-15 días: 75% · 14 días o menos: 100%. Suites/Concierge: ventanas más estrictas, depósito no-reembolsable desde el momento de reservar. | `[OFICIAL]` — misma fuente | 2025-2026, vigente. |
| **Online Check-in / Port Arrival Form** | Abre según nivel Castaway Club: **Pearl/Concierge 40 días antes · Platinum 38 · Gold 35 · Silver 33 · base/sin nivel 30 días** (mínimo general). Debe completarse a más tardar **1 día antes** del zarpe. | `[FORO/BLOG]` corroborado por planDisney (semi-oficial) — [sometimessailing.com](https://sometimessailing.com/disney-cruise-line-check-in-process-online/) | 2025-2026, vigente. |
| **Excursiones en puerto / spa / Palo-Remy / actividades para niños** | Ventana por nivel Castaway Club: **Concierge 130 días (agregado a los 123) · Pearl 123 · Platinum 120 · Gold 105 · Silver 90 · primera vez/sin nivel 75 días.** Requiere crucero **pagado en su totalidad** para desbloquear, aunque la ventana "abra" antes técnicamente. Corte de reservas: hasta **2 días antes** del embarque. Nursery de bebés requiere reserva paga bajo la misma ventana; kids clubs (3+) no requieren reserva previa. | `[FORO/BLOG]` alta convergencia entre 3 fuentes + páginas oficiales indexadas — [TouringPlans — Castaway Club impact](https://touringplans.com/blog/disney-cruise-line-castaway-club-impact-on-reservations/) | 2025-2026, vigente. |

### 3.3 Universal Orlando Resort

| Hito | Regla exacta | Fuente | Vigencia / discrepancia |
|---|---|---|---|
| **Pago final del paquete** | **45 días antes** del check-in/arribo. Reservas 46+ días antes: depósito + cargo automático del saldo a la tarjeta en archivo el día 45. Reservas dentro de 45 días: pago completo al reservar. | `[OFICIAL]` T&C oficiales espejados por agencia autorizada — [dreamsunlimitedtravel.com](https://www.dreamsunlimitedtravel.com/universal-terms.htm) / [mousekeplanner.com](https://mousekeplanner.com/universal-orlando-resort-terms-conditions/) (`universalorlandovacations.com` devolvió 403 al fetch directo) | 2025-2026, vigente. |
| **Depósito inicial** | **$50/persona** + costo de aerolíneo/protección de viaje/add-ons, al reservar (si es 46+ días antes). | `[OFICIAL]` misma fuente | Vigente. |
| **Cancelación / penalidades** | **DISCREPANCIA entre dos espejos del mismo documento oficial:** Espejo A (2 tramos): 46+ días = reembolso completo; 45-0 días = **$200/reservación**. Espejo B (3 tramos): 45+ días = reembolso completo; 44-6 días = **$100**; 5-0 días = **$200**. | `[OFICIAL]` (ambos espejos, contenido divergente) — [mousekeplanner.com](https://mousekeplanner.com/universal-orlando-resort-terms-conditions/) vs. [dreamsunlimitedtravel.com](https://www.dreamsunlimitedtravel.com/universal-terms.htm) | **`[NO VERIFICADO]`** cuál tabla es la vigente — recomendado validar contra el T&C vivo antes de codificar la regla (posible diferencia de fecha de captura entre los dos espejos). |
| **Fee de cambio** | $50/transacción + cargos de servicio aplicables o incrementos de precio, por cualquier cambio de fecha/aerolínea/hotel/transporte. | `[OFICIAL]` — ambos espejos coinciden | Vigente. |
| **Universal Express Pass** | Incluido gratis solo en 3 hoteles "Premier" originales (Portofino Bay, Hard Rock, Royal Pacific) → Express Unlimited para USF+IOA únicamente, **NO cubre Epic Universe ni Volcano Bay**. Excepción confirmada: el nuevo **Helios Grand Hotel (Epic Universe) NO incluye Express Pass** pese a ser premium — confirmado por comunicación oficial de Universal en redes. Epic Universe solo tiene Express de un solo uso (sin versión Unlimited), ningún hotel lo incluye gratis, precio ~$130-330+ según demanda. | `[FORO/BLOG]` con cita de comunicación oficial — [deeparrival.com](https://deeparrival.com/news/epic-universe-helios-grand-hotel-express-pass-value-2026/) | 2025-2026, vigente. |
| **Early Park Admission (EPA)** | **Todos** los hoteles del resort (no solo "Premier") dan EPA — hasta **1 hora (60 min)** antes de apertura oficial en USF/IOA/Epic Universe; en Volcano Bay 30-60 min según fecha/clima. Hoteles "partner" fuera del resort solo si compraron paquete de Universal con hotel+admisión incluidos. **Epic Universe se agregó a EPA el 23-may-2025.** | `[OFICIAL]` — [universalorlando.com/web/en/us/early-park-admission](https://www.universalorlando.com/web/en/us/early-park-admission) (texto literal "up to one hour prior") | 2025-2026, vigente. Sujeto a cambio sin aviso según Universal ("subject to change without notice"). |
| **Reservas de restaurantes** | **No existe sistema unificado tipo ADR de Disney.** Ventana de **6 meses** antes. No requiere tarjeta de crédito, sin penalidad por no presentarse. Canales: web, app, o teléfono. Epic Universe tiene restaurantes en el mismo sistema (Atlantic, The Blue Dragon). | `[OFICIAL]` — [universalorlando.com/.../dining-experiences/reservations](https://www.universalorlando.com/web/en/us/plan-your-visit/dining-experiences/reservations) | Vigente. |
| **Check-in online (hotel)** | Mobile Check-in disponible en todos los hoteles Universal, email ~24h antes, permite confirmar reserva/agregar huéspedes/autorizar tarjeta antes de salir de viaje. Solo acepta tarjeta (no efectivo/gift card). Igual hay que pasar por mostrador para llaves físicas. Check-in estándar: 4pm. | `[FORO/BLOG]`, sin confirmación en página oficial con este detalle — [touringplans.com](https://touringplans.com/blog/how-to-use-hotel-mobile-check-in-at-a-universal-orlando-resort/) | 2025-2026. |

### 3.4 Resumen de discrepancias sin resolver (para no codificar la esperanza)

1. **WDW packages — timing de pago de comisión**: documento oficial dice "7-10 días post-checkout"; un blog dice "~60 días post-viaje". Se prioriza el oficial; el otro queda `[NO VERIFICADO]`.
2. **DCL — timing de pago de comisión**: "antes del viaje" (post-final-payment, prensa trade) vs. "después del viaje" (foro). Sin resolver, `[NO VERIFICADO]`.
3. **DCL — tramos exactos de comisión por volumen**: dos tablas de tramos distintas circulando, sin documento oficial numérico accesible. `[NO VERIFICADO]`.
4. **Universal — tabla de cancelación**: 2 tramos vs. 3 tramos entre dos espejos del mismo T&C oficial. `[NO VERIFICADO]`, recomendado validar en vivo.
5. **EarMarked "rebrand" de febrero 2026**: una sola fuente secundaria lo afirma, sin comunicado oficial. `[NO VERIFICADO]`.
6. **Hora ET exacta de corte** para pago final de paquete WDW y apertura de check-in online (60 días): no encontrada en ninguna fuente — no asumir un horario específico sin confirmar.

---

## 4. Dolores documentados

*(Nota: sin acceso a Reddit en este entorno — ver limitación metodológica al inicio. Evidencia de DISboards, blogs de host agencies, y páginas de producto de CRMs, todo `[FORO/BLOG]`.)*

- **Carga cognitiva de múltiples fechas simultáneas**: *"tracking dining reservations across multiple parks, managing Lightning Lane selections, monitoring room-only vs. package pricing windows, juggling final payment deadlines, and coordinating itineraries that can span a week or more."* — [pixiedustcrm.dev](https://pixiedustcrm.dev/blog/best-crm-disney-travel-agents)
- Una agente (Nikki Miller, citada por nombre) reconoce limitar deliberadamente lo que comunica al cliente para no saturarlo: *"I try to only talk about the most upcoming cut-off dates for dining, park passes, etc."* — [hostagencyreviews.com](https://hostagencyreviews.com/blog/best-disney-travel-agents-booking-secrets)
- Otra agente (Crystal Smith) describe el proceso de cotización como obligatoriamente multi-capa: comparar 3 tiers de resort + ticket package + park hopper + dining plan + memory maker + seguro + transporte, con regla personal *"I never give a bare-bones quote."* — misma fuente.
- Disponibilidad exigida fuera de horario: *"agents need to be available to go online or on the phone when promotions drop, cruises get cancelled, or party tickets open up."* — [disboards.com](https://www.disboards.com/threads/talk-to-me-about-becoming-a-disney-travel-agent.3948966/)
- **No se encontró ninguna anécdota cuantificada de "perdí $X en comisión por olvidarme de Y"** pese a >10 queries dirigidas específicamente a esto (incluyendo variantes "clawback", "forgot Genie+", "forgot final payment"). **`[REQUIRES_LIVE_VALIDATION]`**: hueco de evidencia atribuible al bloqueo de acceso a Reddit/Facebook en este entorno, no necesariamente a ausencia del fenómeno.
- Evidencia adyacente de pérdida de dinero (estructural, no por "olvido" puntual): una agente trabajó **20 meses** en un grupo familiar (75+ camarotes de crucero) con contacto casi diario, y tras romper con su host agency ganó **~$2,000 total (~$3/hora)**. — [magicguides.com](https://magicguides.com/is-being-a-disney-travel-agent-worth-it/)
- Iliquidez estructural del modelo: *"it will take you about 6 months before you start earning your commission"*, y tras el viaje del cliente *"it takes about a month for Disney or Universal to pay out the commission to your Host Agency."* Si el cliente cancela, el agente no cobra nada del trabajo de cotización. — [themeparksforgrownups.com](https://themeparksforgrownups.com/whats-it-like-being-a-disney-and-universal-travel-planner/)
- **Volatilidad de producto que rompe itinerarios ya armados**: Disney dio de baja el Main Street Electrical Parade "two weeks before" el viaje de un cliente, obligando al agente a comunicar el cambio de urgencia. — [hostagencyreviews.com](https://hostagencyreviews.com/blog/best-disney-travel-agents-booking-secrets)
- **Tiempo real invertido por reserva** (el dato más rico encontrado, desglose de una agente vía [disneyinyourday.com](https://www.disneyinyourday.com/much-time-can-save-using-travel-agent-disney-vacation/)):

| Tarea | Tiempo reportado |
|---|---|
| Cotización de precio (cliente flexible) | 2-3 horas |
| Investigación de resort | ≥1 hora |
| Cambio de reserva existente (llamada a Disney) | ~30 min/llamada |
| Aplicar descuentos (hold telefónico) | ~2 horas en espera |
| Investigación de dining | 2-3 horas |
| Planificación Lightning Lane | ~1 hora |
| **Total ahorrado al cliente** | **mínimo 10 horas** |

- Papeleo posterior a la reserva: *"it can take 3-4 weeks for them to get the paperwork from Disney once they've made your reservations."* — `[FORO/BLOG]`, sin URL única verificada.
- Herramientas de terceros no oficiales (MouseDining, MouseWatcher, Standby Skipper, Mickey Alerts) existen porque agentes/clientes necesitan monitorear cancelaciones de ADR/Lightning Lane que Disney no expone oficialmente — y Disney **rompió activamente** una de ellas (TouringPlans Reservation Finder) al cambiar su backend a fines de 2023.
- Existe una plantilla pública ("Disney World Planning and Booking Cheatsheet" de Host Agency Reviews, en JotForm) descrita como *"a mini-CRM"* — evidencia directa de que, a falta de herramienta dedicada, agentes recurren a formularios/spreadsheets caseros. — [hostagencyreviews.com](https://hostagencyreviews.com/blog/travel-agents-guide-hars-disney-world-planning-booking-cheatsheet)

---

## 5. Herramientas que ya usan

| Herramienta | Qué es / resuelve | Precio | Críticas / limitaciones | Integración Disney/Universal |
|---|---|---|---|---|
| **Venselo** | `[NO VERIFICADO]` — no se encontró como producto existente en ninguna búsqueda ni en el listado de 35+ CRMs de [hostagencyreviews.com](https://hostagencyreviews.com/travel-agency-software/category/crm). Posible nombre mal escrito. | — | — | — |
| **TravelJoy** | CRM + itinerary builder + payments genérico. | Desde $19/mes (Starter), $32/mes (Pro). Fee de pago 5%+$0.30 (Starter) / 3.5%+$0.30 (Pro). | [g2.com](https://www.g2.com/products/traveljoy/reviews): elogia recordatorios automáticos y facturación; falta subcarpetas en documentos, soporte solo L-V 10-6 ET. Confirmado: *"Not Disney-specific... no destination-specific booking fields for Walt Disney World, no dining reservation tracking."* [pixiedustcrm.dev](https://pixiedustcrm.dev/blog/best-crm-disney-travel-agents) | **No.** Carga 100% manual. |
| **Tess** (Travel eSolutions) | CRM tradicional (no IA pese al nombre), desde 2014. Gestión cliente/viaje/reserva/documento/factura, tracking automatizado de comisiones multi-agente. | `[NO VERIFICADO]` | Única reseña pública: fácil de usar, itinerary builder "necesita mejora", automatizaciones "clunky but get the job done". [hostagencyreviews.com](https://hostagencyreviews.com/travel-agency-software/tess/reviews) | No hay evidencia de integración directa. |
| **Trams / ClientBase** | El más antiguo/establecido (1987). Trams Back Office = contabilidad; ClientBase = CRM front-office. Hoy bajo Tres Technologies. | `[NO VERIFICADO]` | Tiene función de "PNR Import" desde GDS (Apollo/Galileo/Sabre/Worldspan) — pero **ese camino murió para Disney/Universal el 28-mar-2018** cuando Sabre Vacations se retiró en favor de VAX (plataforma web, no PNR de GDS). [vaxvacationaccess.com](https://www.vaxvacationaccess.com/pages/transitioning-from-sabre-vacations-to-vax-vacationaccess/) | **No, desde 2018.** Sin API pública documentada para terceros. |
| **Travefy** | Constructor de itinerarios/propuestas. #1 en Host Agency Reviews Training Camp 2026 (itinerary builder, CRM, client portal, website builder). | Core $25/mes, Premium $59/mes, Agency $20/mes. | Un usuario migró porque *"couldn't work out quotes"* — sin funciones de costeo, obligando a cálculos manuales en Excel. [vettedthis.com](https://vettedthis.com/software/crm/travefy-reviews-pricing-features/) App móvil "view-only". | **No.** Carga manual de contenido. |
| **Dubbi** | `[NO VERIFICADO]` — no se encontró como producto existente; no aparece en el listado de hostagencyreviews.com. Posible confusión fonética con "Dubai" o nombre incorrecto. | — | — | — |
| **VacationCRM** | CRM leisure travel, "1,000+ agentes". Automatiza recordatorios de pago final, viajes próximos, cumpleaños/pasaporte; status del cliente se actualiza automático según fecha de pago/depósito/viaje. | `[NO VERIFICADO]` | Elogiado por facilidad de uso y soporte; criticado por integraciones limitadas con proveedores, tracking de pagos requiere entrada manual del monto. [hostagencyreviews.com](https://hostagencyreviews.com/travel-agency-software/vacationcrm/reviews) Confirmado: maneja reservas Disney pero *"isn't purpose-built for them — the booking fields are more generic."* | No nativa; documentado un stack **VacationCRM + Zapier** con 5 workflows (leads, newsletter, tarjetas Trello/Asana, reviews, recibos QuickBooks). [travelagentpro.com](https://www.travelagentpro.com/how-to-travel-agent/the-ultimate-guide-to-automating-your-travel-business-vacationcrm-zapier) |
| **Pixie Dust CRM** | El más nuevo (2025), específico para Disney/Universal/cruceros/grupos. Único con app móvil de agente full-featured + app de cliente. | $9.99-$29.99/mes; equipos desde $20/asiento/mes. | Base de datos de proveedores "aún en desarrollo" (reconocido por el propio vendor). | Reglas configurables de notificación sobre datos cargados a mano — **no sync con Disney**, solo capa de recordatorio posterior a la carga manual. |
| **Google Sheets / Excel** | Default de facto para agentes nuevos/pequeños o para lo que el software dedicado no cubre. | Gratis (o costo de plantillas Etsy). | *"New advisors managing just a couple of trips may initially use simple spreadsheets."* [foratravel.com](https://www.foratravel.com/join/resources/travel-agent-crm) — **87% de asesores afiliados a host agencies SÍ usa CRM** (implica ~13% en spreadsheet/manual, sesgado hacia nuevos/independientes). Mercado secundario de plantillas en Etsy ("Client Tracker for Travel Agents"). | N/A — es el fallback manual. |
| **WhatsApp** | Canal de comunicación con cliente, cada vez más dominante. | Gratis / WhatsApp Business API de pago. | Cifra "75% de viajeros prefieren mensajería" es de marketing de proveedores de WhatsApp Business API (Gallabox), tomar con cautela — no es estudio independiente. | N/A |

**Otros CRMs detectados** (sin verificación individual profunda): Tern ($35-39/mes, explícitamente sin campos Disney), Travel Mouse CRM ($10-20/mes), Travel+ CRM (~$10/mes), Magic Plus CRM, Moonstride (feature de referencia de "deadline reminders" para tour operators/DMCs, no específico de Disney), y un listado largo sin verificar (JourneyFuse, AgentMate, Sion, Trazel, TripDeskPro, etc.) — ver [hostagencyreviews.com/travel-agency-software/category/crm](https://hostagencyreviews.com/travel-agency-software/category/crm).

**Conclusión de esta sección**: **ningún CRM del espacio —ni el más viejo (ClientBase) ni el más nuevo (Pixie Dust CRM)— tiene integración automática con Disney/Universal.** Es 100% carga manual en toda la categoría. El "default real" para agentes nuevos/chicos sí es la planilla, tal como planteaba la consigna, pero incluso los que pagan software dedicado terminan cayendo en Excel para lo que el software no cubre (ver caso Travefy).

---

## 6. Lente lateral / hack

**Hallazgo central: no existe ningún canal oficial de sincronización automática (webhook, RSS de datos, export API, o GDS) entre el sistema de reservas de Disney/Universal/VAX y el software del agente.** La carga manual es estructural — causa raíz del lado del proveedor, no un descuido de las herramientas de terceros.

- **`[OFICIAL]`** El único API documentado del lado de VAX es **VAX Quick Connect** (XML), y es **unidireccional del lado del supplier/proveedor hacia VAX** (permite que Universal, Sandals, etc. integren SU inventario/pricing hacia la plataforma) — no una API que un agente o tercero pueda consumir para leer/sincronizar reservas ya hechas. — [triseptsolutions.com](https://www.triseptsolutions.com/solutions.html)
- **`[OFICIAL]`** El camino histórico de sincronización semi-automática (import de PNR de Sabre GDS hacia ClientBase) **murió el 28-mar-2018** cuando Sabre Vacations se retiró en favor de VAX VacationAccess (plataforma web standalone, no GDS). — [vaxvacationaccess.com](https://www.vaxvacationaccess.com/pages/transitioning-from-sabre-vacations-to-vax-vacationaccess/)
- **`[OFICIAL]`** RSS de Disney existe pero es para **news feeds de marketing** (vía Alexa skill), no datos de reservas de clientes. — [Manage_Disney_Travel_News_Feeds.pdf](https://media.disneywebcontent.com/StaticFiles/DTA-Domestic/pdf/Alexa/Manage_Disney_Travel_News_Feeds.pdf)
- **Parseo de emails de confirmación**: la técnica genérica existe y está documentada (Zapier Agents escanea Gmail por keywords y crea eventos de calendario; Zapier Email Parser extrae datos de emails con formato consistente) — pero **está documentada para consumidores planeando su propio viaje, no para agentes gestionando clientes**, y **no se encontró ningún caso documentado aplicado específicamente a confirmaciones de Disney o Universal.** — `[FORO/BLOG]` [zapier.com/blog](https://zapier.com/blog/organize-travel-bookings-zapier-agents/). Es terreno inexplorado, no un patrón ya resuelto por otros — probablemente porque la reserva "vive" en el sistema propietario de Disney/VAX y no llega al agente como email estructurado consistente.
- **Automatización casera documentada más cercana al patrón pedido**: template público de **n8n** — *"Travel itinerary reminders with Google Calendar, Excel, and SMS/Email alerts"* (publicado por "Oneclick AI Squad"): cron diario → lee 3 Excels (itinerario, contactos, log anti-duplicado) → identifica salidas próximas → sincroniza a Google Calendar → notifica por email/SMS según preferencia. El propio publisher lo describe como *"Perfect for travel agencies, tour operators, and organizations managing group trips."* — `[FORO/BLOG]` [n8n.io/workflows/9846](https://n8n.io/workflows/9846-travel-itinerary-reminders-with-google-calendar-excel-and-smsemail-alerts/). Es genérico, no probado contra el formato real de confirmaciones Disney/Universal, pero es el blueprint reusable más cercano encontrado.
- **Caso de referencia de "deadline tracking" ya resuelto (aunque no específico de Disney)**: **Moonstride**, con feature explícita *"Schedule reminders for critical deadlines, including payments and travel dates"* — apuntado a agencias/tour operators/DMCs genéricos. — [moonstride.com](https://www.moonstride.com/reminders-notification/). Igual que VacationCRM y Pixie Dust CRM, resuelve la **capa de notificación posterior a la carga manual**, no elimina la carga manual en sí — ninguna herramienta encontrada resuelve el problema de raíz (sincronizar automáticamente CUÁNDO vence cada hito según el sistema real de Disney/Universal).

**Síntesis del hack lateral**: el atajo que colapsaría el problema (parsear confirmaciones estructuradas o consumir un feed/API de reservas) **no está bloqueado por falta de ingenio de la industria — está bloqueado porque Disney/Universal/VAX no exponen ese dato de forma consumible por terceros**, ni siquiera a los propios agentes (de ahí que compartir credenciales del cliente sea la norma no-oficial para dining/Lightning Lane, ver §2.3). Cualquier producto que quiera resolver esto de raíz enfrenta la misma pared que enfrentó TouringPlans (scraping bloqueado activamente) — la vía viable de mediano plazo es (a) email-parsing de confirmaciones si Disney/Universal las manda de forma suficientemente estructurada al agente/cliente (no verificado que lo sean), o (b) aceptar la carga manual inicial y automatizar solo la capa de recordatorio/reconciliación posterior, que es exactamente lo que ya hacen Pixie Dust CRM, VacationCRM y Moonstride — sin ninguno de ellos haber roto la pared de origen.

---

## Apéndice: gaps explícitos no verificados (resumen consolidado)

- Tabla numérica oficial y exacta de tramos de comisión DCL por volumen.
- Split % específico de KHM Travel Group, Travel Planners International, World Travel Holdings.
- Confirmación oficial de un "rebrand EarMarked" en febrero 2026.
- Días exactos de pago de comisión para WDW Room Only y DCL (documento oficial no da rango numérico).
- Hora ET exacta de corte para pago final de paquete WDW y apertura de check-in online.
- Timing de pago de comisión DCL: antes vs. después del crucero — contradicción entre fuentes sin resolver.
- Tabla de cancelación Universal: 2 tramos vs. 3 tramos entre dos espejos del T&C oficial.
- Existencia de Venselo y Dubbi como productos de software — no confirmados, tratar como no verificados en cualquier plan que los mencione como competidores.
- Anécdotas cuantificadas de "plata perdida por olvido de un deadline puntual" — no encontradas por bloqueo de acceso a Reddit/Facebook en este entorno, no por ausencia confirmada del fenómeno.
- Cifras de comisión oficiales para el mercado LatAm/Argentina específicamente.
