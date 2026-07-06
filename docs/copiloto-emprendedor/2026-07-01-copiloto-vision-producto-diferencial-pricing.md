# Copiloto del Emprendedor — Visión de producto, diferencial y estrategia de pricing

> **Fecha:** 2026-07-01 · **Autor:** operador (visión) + Claude (contrapunto/estructura) · **Estado:** visión de producto asentada; decisiones de pricing en hipótesis, a calibrar con datos de uso.
> **Propósito:** fijar QUÉ es el producto (diferencial y posicionamiento) y CÓMO se cobra, para que el build y el go-to-market apunten al mismo lugar. Complementa el COGS (`./2026-07-01-copiloto-economia-cogs-composio-llm.md`) y el roadmap (`./2026-06-29-copiloto-emprendedor-roadmap.md`).

---

## 1. El diferencial (qué vendemos)

**El Copiloto del Emprendedor es un copiloto de IA que vive en la intersección de todos los servicios del negocio del cliente, con acceso a su información REAL, para hacer análisis de negocio, marketing y comunicación — y actuar sobre ellos.**

El valor NO es "conectar servicios" (eso es commodity). El valor es la **correlación cross-servicio**: el copiloto está en la intersección de datos que el cliente tiene dispersos en apps separadas, y ve lo que **ningún servicio individual puede ver**.

- Acceder a Gmail, o Calendar, o las ventas **por separado** no es diferencial — el cliente ya los ve en cada app.
- Cruzar **ventas × campañas de marketing × comunicaciones con clientes** para producir un insight accionable ("tus mejores clientes son los que contactás dentro de las 2h y vienen de la campaña X") — eso requiere estar en los tres a la vez. **Ahí está el "aha".**

**Consecuencia de diseño:** los cruces de datos que generan insight accionable se diseñan **explícitamente** (qué correlaciones importan por vertical/uso). No salen gratis de "conectar todo".

**Arquitectura macro (soberana y liviana):** **backend mínimo — nada se persiste fuera de Graphity** (grafo temporal Zep/Graphiti, propio/soberano). Los **servicios externos son source-of-truth** de su dominio (vía Composio); el **grafo es la capa de conocimiento unificada** del agente. La **memoria conversacional** y la **información de negocio** conviven en el **mismo grafo** como tipos de episodio distintos (los mensajes del agente se tratan como mensajes; el resto de la info entra por **ingesta batch**). **No hay SQL ni store analítico separado** → menos superficie que mantener, y la **correlación cross-servicio es nativa del grafo** (une entidades de todos los servicios por diseño). El razonamiento temporal (bitemporalidad) aplica por igual a memoria y a negocio. *(El detalle de infra/ontología es del operador; acá solo el macro de capacidades.)*

**Capa RAG (conocimiento documental — complementa Graphity, no compite).** RAG production-ready ya construido y probado en el VPS fusion (Supabase self-host): pgvector HNSW halfvec512 + hybrid search (vector + full-text español, RRF), **multi-tenant con namespaces por cliente + RLS**, costos ínfimos ($0.02–1.32/mes por perfil). Cubre lo que Graphity no: **texto no estructurado** (contratos, propuestas, manuales, políticas). **Dos usos, separados por superficie de confianza** (invariante de seguridad del proyecto):

| Uso | Quién consulta | Confianza | Contenido |
|---|---|---|---|
| **RAG del copiloto** (feature de **tier alto**) | El dueño | Confiable | Documentos propios del emprendedor |
| **RAG del bot de atención al público** (ya hecho) | Clientes finales | **NO confiable** | Info del emprendimiento (FAQ, productos, políticas) |

- El multi-tenant + RLS + namespaces da la **separación nativa** (por `cliente_id` + namespace); no hay que construirla.
- ⚠️ **El RAG del bot público hereda input NO confiable** (prompt injection / intento de leak desde clientes finales) → aplican las **6 defensas del agente conversacional** + el RLS del RAG (impide cruzar tenant/namespace). Ya hay research de **over-refusal** hecho sobre este RAG → sostener ese estándar en la superficie pública, que es la más expuesta del stack.
- **NO fusionar RAG + Graphity** en un retrieval unificado todavía — el proyecto ya lo analizó (`supabase-self-host-blueprint/docs/rag/fusion_done_right_trifecta_2026-07-01.md`) y el veredicto es DIFERIR (sobre-ingeniería sin demanda relacional real medida). Usar cada uno para lo suyo = sí; unirlos = solo con el trigger que ese doc define.

**Stack de capacidades completo (soberano):** **Composio** (acción) + **Graphity** (memoria + negocio estructurado + correlación cross-servicio) + **RAG** (documental, dos superficies) + **Temporal** (durabilidad) + los **agentes**. Más completo que el de casi cualquier competidor del panorama (§5), y todo soberano.

---

## 2. Posicionamiento (cómo lo contamos)

| ❌ NO es | ✅ SÍ es |
|---|---|
| "Conectamos 1000+ apps" (conector universal) | "Copiloto que gestiona tu negocio proactivamente" |
| Compite con Zapier / Make (gigantes, commodity) | Compite en inteligencia + orquestación durable |
| Amplitud de integraciones = propuesta | Amplitud = **enabler**; la propuesta es el copiloto que orquesta con inteligencia + BI proactivo |

**Regla de pitch:** vendé el copiloto inteligente, no el conector. La amplitud de Composio (ecosistema impresionante, 1000+ toolkits) hace **posible** el producto, pero no ES el producto. El moat es la **orquestación durable (Temporal) + el agente + el BI proactivo** — coherente con la identidad de la fábrica (automatización/agentes-IA durables, no frontend-pesado ni plomería de integraciones).

---

## 3. Los dos ejes que vuelven REAL el diferencial

El moat es un activo solo si estos dos ejes están a la altura. Son "el producto"; el resto es plomería.

### 3.1 Correlación cross-servicio (el insight)
- El valor está en la intersección, no en el acceso. Diseñar los cruces accionables, no exponer datos crudos y ya.
- **Nativa del grafo unificado:** al vivir memoria + negocio en un solo grafo temporal soberano, cruzar entidades de servicios distintos (cliente ↔ pedidos ↔ campaña ↔ comunicaciones) es una propiedad de la arquitectura, no un ETL a reconciliar entre stores.
- **Listón de calidad del BI:** con datos reales, un análisis genérico ("tus ventas subieron 3%") es **peor que no tenerlo** — quema confianza. Un análisis *equivocado* sobre finanzas reales puede inducir una mala decisión del cliente → responsabilidad. El BI proactivo debe ser **específico, accionable y con el dato crudo a la vista** para que el cliente verifique (no "confiá en mí").

### 3.2 Seguridad a la altura del acceso (la contracara)
- **El diferencial ES el mayor riesgo:** acceso completo a la info del negocio + LLM + capacidad de comunicar/actuar hacia afuera = **lethal trifecta**. Cuanto más completo el acceso (= más diferencial), más grande la superficie de ataque.
- Caso concreto: un mail entrante con prompt injection podría, si el diseño falla, hacer que el copiloto exfiltre datos financieros o mande comunicaciones no autorizadas.
- **No es argumento para achicar el acceso** — es para que la seguridad escale con él. Mitigaciones ya definidas, a sostener **religiosamente** (crecen en importancia con cada servicio que se suma):
  - `ComposioGateway` **fail-closed** (allowlist por policy; denylist de meta-tools gana).
  - **HITL obligatorio en writes** (`confirmed=True` — doble candado contra alucinación/injection).
  - **Separación de superficies de confianza** (copiloto del dueño = input confiable ≠ agente de atención al público = input no confiable).
  - Input externo (mails, mensajes) tratado como **no confiable** (delimitar, nunca como instrucción).

---

## 4. Estrategia de pricing (cómo se cobra)

**Modelo: PLG (product-led growth) con todas las funcionalidades desde el plan básico, limitado por USO.**

- **Todas las features disponibles desde el básico** — el usuario prueba el potencial completo. Sube de plan cuando **valida que le sirve**, no porque una feature está bloqueada.
- **Se limita por uso, no por features.** Habilitado por la estructura de costos: el COGS es marginal y **por-uso** (Composio+LLM) → limitar por consumo **alinea precio con costo** sin gatear features (que sería caro de construir/mantener: feature flags, ramas por plan). Solo se necesita un contador.

### 4.1 Dos contadores (NO mezclar en la cara del cliente)
- **Visible al cliente = ACCIONES** (unidad de negocio que entiende: "hasta X acciones/mes"). Nunca "tool calls" ni "tokens".
- **Interno (guardrail de costo) = tokens + executes Composio.** Frena runaway; el cliente no lo ve.
- El BI proactivo (ingesta schedulada) corre a **frecuencia por plan**, controlado por la plataforma, **fuera del cupo de acciones del cliente** (no debe "gastar" su cupo estando quieto).

### 4.2 El límite del básico es un parámetro delicado (calibrar, no adivinar)
- Debe pegarle justo: **suficiente para llegar al "aha moment"** (ver el potencial), **insuficiente para operar el negocio en serio** (razón para subir).
- Muy apretado → churn antes de convertir. Muy generoso → resuelve todo gratis, nunca sube.
- **Se calibra con datos de uso reales** (dónde convierten vs dónde abandonan los que probaron). Arrancar con una hipótesis y tratarlo como **experimento continuo**, no como decisión de una vez.

### 4.3 Márgenes (del análisis de COGS)
- COGS Composio+LLM ≈ **$1-12/usuario/mes** → margen bruto **90%+** contra cualquier pricing razonable.
- Sin soporte humano por-cliente (modelo agéntico). El costo no es driver; el pricing se ancla a **valor**, no a costo.

---

## 5. Panorama competitivo (búsqueda 2026-07-01)

El espacio está **caliente, bien financiado y fragmentado en tres categorías** — ninguna hace el combo completo, pero hay overlap parcial fuerte. **"Nadie lo hace" es falso**; el foso no es tecnológico.

| Categoría | Quiénes | Qué hacen | Qué les falta vs el Copiloto |
|---|---|---|---|
| **AI CRMs** | Attio, Copper, Zoho (Zia), Freshworks (Freddy), HubSpot | Conectan mail/calendar, sugieren next steps, sentiment | Centrados en **ventas/CRM**; no gestión integral ni BI cross-servicio amplio |
| **AI agent builders / automation** | Lindy, Relay, Cassidy, Gumloop, Zapier Central | Agentes/workflows cross-app, HITL, no-code | **Plataformas para que el usuario CONSTRUYA** el agente (o enterprise, Cassidy); ángulo = automatizar workflows, no BI proactivo con datos reales |
| **AI BI assistants** | Improvado, Querio, Agentforce (Salesforce) | Unifican marketing/sales/revenue → NL queries, anomaly detection, insights | **Plataformas de datos** (mid-market/enterprise, caras, requieren setup); **analizan pero no ACTÚAN** |

**El gap donde encaja el Copiloto = la intersección de las tres**, para el emprendedor/SMB chico, llave en mano: **actúa** (agent builders) + **correlaciona datos reales cross-servicio** (BI) + **conversacional/accesible** (copilots) + **orquestación durable** (Temporal, moat técnico) + HITL. Ninguna categoría sola cubre "actúa **y** analiza datos reales cross-servicio **y** es accesible/llave-en-mano para el negocio chico".

**Lectura honesta del foso (no codificar la esperanza):**
- **El diferencial NO es tecnológico puro** — los cruces cross-servicio los puede hacer cualquiera con Composio + un LLM. El foso es **ángulo + segmento + ejecución**.
- **Segmento desatendido = la ventaja real:** el emprendedor/SMB chico (probablemente hispanoparlante) está ignorado por los grandes, que apuntan a mid-market/enterprise o venden plataformas complejas que el negocio chico no sabe/quiere configurar. La ventaja es **llave-en-mano, asequible y en su idioma**, con time-to-value inmediato (enchufar y funcionar, sin consultor).
- **El riesgo real es distribución, no producto.** Salesforce (Agentforce), HubSpot, Microsoft Copilot pueden aplastar por alcance. No se gana por features — se gana por foco en el segmento que ellos ignoran.
- **Foso a defender (una frase):** *"los únicos que lo hacemos llave-en-mano para el negocio chico que los gigantes ignoran"* — no "los únicos que lo hacemos".

Fuentes: [Best AI agents for small business 2026 — Lindy](https://www.lindy.ai/blog/best-ai-agents-small-business) · [Lindy/Cassidy/Relay — Gumloop](https://www.gumloop.com/blog/lindy-ai-alternatives) · [AI BI tools 2026 — Querio](https://querio.ai/blogs/ai-business-intelligence-tools) · [AI assistant for SMBs — Salesforce](https://www.salesforce.com/blog/small-business/ai-assistant-for-smbs/)

---

## 6. Decisiones asentadas vs hipótesis a validar

**Asentado (no re-litigar):**
- Diferencial = copiloto en la intersección de datos reales → correlación cross-servicio para BI/marketing/comunicación.
- Posicionamiento = copiloto inteligente, NO conector universal.
- Pricing = todas las features desde el básico, limitado por uso (acciones visibles / tokens interno); BI fuera del cupo.
- Seguridad = lethal trifecta gestionada con gateway fail-closed + HITL writes + separación de superficies.

**Hipótesis a validar con datos/spike:**
- El **valor exacto del límite del básico** (calibración por cohorts de uso).
- Qué **cruces cross-servicio** generan el insight más accionable (por vertical / tipo de negocio).
- Que el BI con datos reales alcance el **listón de calidad** (específico/accionable) — probar con datos reales de un usuario piloto antes de generalizar.

---

## Referencias
- COGS / economía → `./2026-07-01-copiloto-economia-cogs-composio-llm.md`
- Roadmap del Copiloto → `./2026-06-29-copiloto-emprendedor-roadmap.md`
- Boundary Composio fail-closed → memoria `composio-gateway-ladrillo`
- Hardening agente conversacional (lethal trifecta, 6 defensas) → memoria `agente-conversacional-hardening-3-lentes`
- Identidad de la fábrica (moat = automatización/agentes durables) → memoria `factory-identidad-automatizacion-ia`
- Tool overload / ruteo → memoria `tool-overload-routing-agente`
