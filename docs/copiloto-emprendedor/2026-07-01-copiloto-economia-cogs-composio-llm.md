# Copiloto del Emprendedor — Economía / COGS (Composio + LLM + soporte agéntico)

> **Fecha:** 2026-07-01 · **Autor:** operador + Claude (sesión de evaluación) · **Estado:** análisis de dimensionamiento, números por supuesto (calibrar contra spike #97).
> **Propósito:** dejar registrado el costo variable por usuario/mes del Copiloto para estructurar tiers y pricing. Complementa `./2026-06-29-copiloto-emprendedor-roadmap.md`.
> **Regla:** los números salen de supuestos razonados, NO de medición E2E. Antes de comprometerlos a pricing público → medir un turno real contra el walking skeleton #97 (tokens in/out + executes por interacción). Marcado `[SUPUESTO]` donde aplica.

---

## 1. Conclusión ejecutiva

- **Composio y LLM son costo MARGINAL.** COGS combinado ≈ **$1-12/usuario/mes** según tier (con DeepSeek V4 Flash). Contra cualquier pricing SaaS razonable → margen bruto 90%+ en esta capa.
- **Entre Composio y LLM, el LLM es ~95% del costo variable.** Composio cuesta ~$0.0002/interacción vs ~$0.0045 del LLM (~20× menos). Optimizar Composio es irrelevante; la palanca es el LLM.
- **El driver del costo LLM NO es el precio del modelo ni el mensaje del usuario** — es reenviar las definiciones de tools (~30k tokens) en cada llamada del loop ReAct. Las dos optimizaciones que lo controlan (**prompt caching** + **tool gating**) importan más que qué modelo elijas.
- **No hay soporte humano por-cliente** (modelo agéntico: soporte técnico + autohealing por agentes). Esto NO es $0 — es costo trasladado a LLM (marginal), PERO depende de un supuesto de capacidad aún no probado adversarialmente.
- **El eje a vigilar deja de ser el COGS (marginal) y pasa a ser la confiabilidad del soporte/healing agéntico** — un fallo ahí es churn/reputación, no una línea de dólares.

---

## 2. Pricing verificado (jul-2026)

### 2.1 Composio (unidad facturable = **ejecución**; discovery/auth/schema-fetch NO cuentan)

| Plan | Precio/mes | Tool calls incluidas | Overage /1K | Bundled efectivo /1K |
|---|---|---|---|---|
| Free | $0 | 20.000 | — | — |
| Ridiculously Cheap | $29 | 200.000 | $0.299 | ~$0.145 |
| Serious Business | $229 | 2.000.000 | $0.249 | ~$0.115 |
| Enterprise | custom | custom | — | — |

- **Premium tools = 3×** (search APIs, sandboxes, ML inference). Los 8 toolkits del Copiloto (Gmail, Calendar, Sheets, Drive, Docs, HubSpot, Telegram, Instagram) son **estándar (1×)**.
- A escala usamos el bundled del plan $229 ($0.115/1K) para costear el marginal por cliente.
- Fuentes: [Composio Pricing](https://composio.dev/pricing) · [UsagePricing](https://www.usagepricing.com/blueprint/composio).

### 2.2 LLM

| Modelo | Input /1M | Output /1M | **Input cacheado /1M** | Contexto |
|---|---|---|---|---|
| **DeepSeek V4 Flash** | $0.14 | $0.28 | **$0.003** (98% off, cache automático) | 1M |
| **gpt-4o-mini** | $0.15 | $0.60 | $0.075 (50% off) | 128k |

- El **input cacheado** es el número decisivo: DeepSeek $0.003 vs gpt-4o-mini $0.075 = **25× más barato** en la parte que domina.
- Fuentes: [DeepSeek V4 Flash — pricepertoken](https://pricepertoken.com/pricing-page/model/deepseek-deepseek-v4-flash) · [DeepSeek API docs](https://api-docs.deepseek.com/quick_start/pricing) · [gpt-4o-mini — devtk](https://devtk.ai/en/models/gpt-4o-mini/).

---

## 3. El modelo de tokens (por qué el LLM domina)

Una interacción con tools ("mandá un mail a Juan confirmando la reunión") **no es una llamada LLM** — es un loop ReAct de **~2-3 llamadas** (razonar → ejecutar tool → razonar → responder). En **cada** llamada se reenvía el prefijo completo:

```
system prompt (~2k) + tool definitions (~30k con 32 tools) + historial + tool results
```

→ ~30k de los ~32k de input son **definiciones de tools reenviadas**. El mensaje del usuario y la respuesta son ruido en comparación. **El costo lo maneja el tamaño del prefijo de tools × cuántas veces se reenvía**, no el precio nominal del token.

**Dos palancas que lo controlan (más importantes que "qué modelo"):**
1. **Prompt caching** — el prefijo (system + tools) es idéntico entre llamadas y turnos → se cachea. DeepSeek lo hace **automático** a $0.003/1M. Sin caching, el costo LLM se 2-3×. **Obligatorio, no opcional.**
2. **Tool gating por intención** — cargar solo el toolkit del turno baja el prefijo de ~30k a ~8k (~4×). Ver `docs/` memoria `tool-overload-routing-agente`. **El gating paga doble: precisión + costo.**

### Costo por interacción (con tool call) `[SUPUESTO: ~30k tool defs, 2-3 llamadas, ~150 tok out/llamada]`

| | DeepSeek V4 Flash | gpt-4o-mini |
|---|---|---|
| Sin cache | ~$0.013 | ~$0.015 |
| **Con prompt caching** | **~$0.004-0.005** | ~$0.008-0.010 |

---

## 4. COGS (Composio + LLM) por tier

Tiers ilustrativos por nivel de uso. El cupo Composio = tope de operaciones del tier (metering por tenant, fail-closed en el `ComposioGateway`). El Motor B (BI proactivo schedulado) corre a frecuencia acorde al plan (lever de costo). `[SUPUESTO: ~2 executes + ~2.5 llamadas LLM por interacción; cache activo]`

| Tier | Uso | Composio (ops/mes → $) | LLM DeepSeek ($) | **COGS Comp+LLM /usuario/mes** |
|---|---|---|---|---|
| **Básico** | ligero + BI diario | ~530 → $0.06 | ~$1.1 | **~$1.2** |
| **Pro** | medio + BI horario | ~2.000 → $0.23 | ~$3.8 | **~$4** |
| **Business** | pesado + BI frecuente | ~6.300 → $0.72 | ~$11 | **~$12** |

- Con **gpt-4o-mini** (cliente que exija US/EU) el LLM sube ~2.5× → totales **~$3 / ~$10 / ~$28**. Composio no se mueve.
- **Margen bruto 90%+** en esta capa contra cualquier pricing razonable (aun un Básico a $29 con COGS $1.2 → 96%).
- **Sin caching el COGS Business salta de $12 a ~$30** → la diferencia entre 90% y 70% de margen. Las optimizaciones no son cosméticas.

### Capacidad por plan Composio (cuántos usuarios entran en el bundle)
| Plan Composio | Ligeros | Medios | Pesados |
|---|---|---|---|
| $29 (200K) | ~640 | ~145 | ~43 |
| $229 (2M) | ~6.400 | ~1.470 | ~430 |

---

## 5. Modelo de soporte y healing (sin humano por-cliente)

**Decisión del operador (2026-07-01):** no hay soporte humano por-cliente. Soporte técnico = agentes (chat); las apps tienen autohealing; una vez la app probada, los márgenes de error se acotan y son abordables por agentes autónomos. Humanos del lado app = mínimos (solo casos extremos), como **infra de la agencia** (fija/semi-fija, no escala por-cliente).

**El costo no desaparece, se traslada a LLM (marginal):**
- Agente de soporte técnico = mini-conversación LLM por ticket = centavos.
- Autohealing = loop del músculo (flash/pro, a veces escala a Claude ~$0.27-0.44/call). Raro si los errores están acotados → bajo pero no nulo.
- Delta sobre el COGS: **~centavos a ~$1/usuario/mes**. El cuadro mejora vs un modelo con humano.

**Distinción de estado de validación (crítica — no todo "autohealing" está en el mismo nivel):**

| Capacidad | Qué es | Estado |
|---|---|---|
| Autoheal de BUILD | Fábrica arma la app, heal loops hasta gate verde | ✅ Validado (sólido hasta 20 units, `validate_real ALL PASS`) |
| Recuperación runtime transitoria | App en prod sobrevive cortes/reintentos | ✅ Real (Temporal nativo) |
| **Soporte agéntico + autoheal de bugs de lógica en runtime** | Agente atiende al cliente y/o repara la app desplegada sin humano | ⚠️ **Diseño, NO construido/probado** |

El tercero sostiene el "$0 de soporte". La frase *"una vez la app probada acotamos los errores y son abordables por agentes autónomos"* es una **hipótesis de capacidad, no un hecho verificado** → exige test adversarial (¿qué pasa cuando el agente de soporte no puede resolver / cuando el autoheal empeora las cosas?) antes de tratarla como cierta. No es un costo pendiente: es un **supuesto de capacidad pendiente de probar**.

---

## 6. Lo que NO cubre este análisis (COGS total del negocio)

- **Infra fija** (VPS Hetzner, Temporal, Postgres/Supabase, Graphity) — costo fijo compartido, no por-usuario; a escala se diluye a centavos/usuario.
- **Supervisión de casos extremos** — humano de la agencia, fijo/semi-fijo.
- Ninguno de los dos escala linealmente con usuarios → no cambian el hecho de que el COGS **variable** (Composio+LLM+soporte agéntico) es marginal.

---

## 7. Pendientes de validación (spike-first)

1. **Medir un turno E2E contra el walking skeleton #97**: tokens in/out reales por interacción + executes Composio por interacción → reemplaza los `[SUPUESTO]` de las secciones 3-4. Mismo spike valida el umbral de tool overload.
2. **Probar adversarialmente el soporte/autoheal de runtime** antes de asumir "$0 de soporte" en la proyección.
3. **Verificar hard-cap de Composio** (o imponer tope duro propio vía contador de executes por tenant que el `ComposioGateway` chequea fail-closed) para que el cupo por tier sea previsible. Nota de infra: **backend mínimo — nada se persiste fuera de Graphity** (grafo soberano); el metering vive en el store soberano / estado durable de Temporal, no en un SQL separado (detalle de infra a cargo del operador).

---

## Fuentes

- [Composio Pricing](https://composio.dev/pricing) · [UsagePricing — Composio](https://www.usagepricing.com/blueprint/composio) · [Composio docs — users & sessions](https://docs.composio.dev/docs/users-and-sessions)
- [DeepSeek V4 Flash — pricepertoken](https://pricepertoken.com/pricing-page/model/deepseek-deepseek-v4-flash) · [DeepSeek API pricing docs](https://api-docs.deepseek.com/quick_start/pricing)
- [gpt-4o-mini — OpenAI pricing](https://developers.openai.com/api/docs/pricing) · [gpt-4o-mini 2026 — devtk](https://devtk.ai/en/models/gpt-4o-mini/)
- SOTA tool overload: [MCP context overload — EclipseSource](https://eclipsesource.com/blogs/2026/01/22/mcp-context-overload/) · [Progressive tool loading — Wire](https://usewire.io/blog/progressive-tool-loading-mcp-context-pattern/)
