# Reporte económico — costos reales aproximados y márgenes (5.000 usuarios)

> **Fecha:** 2026-11-02 · **Estado:** estimación de modelo, **no medición de producción**.
> **Alcance:** costo mensual de operar el Copiloto del Emprendedor para 5.000 usuarios y margen
> bruto por plan (Intensivo US$50, Intermedio US$35, Base US$20).
> **Fuera de alcance (decisión del operador, 2026-11-02):** comisión de MercadoPago (la app sólo
> genera enlaces de pago, no cobra comisión) y tipo de cambio USD/ARS.
> Todas las cifras están en USD por mes salvo que se diga otra cosa.

---

## 1. Resumen ejecutivo

| Concepto | Valor |
|---|---|
| Costo total mensual, 5.000 usuarios intensivos (caso típico) | **US$2.080 a 3.820** |
| Costo total, caso pesimista del LLM | ~US$6.300 |
| Costo por usuario intensivo | **US$0,42 a 0,76** |
| Margen bruto, plan Intensivo (US$50) | **98,5% a 99,2%** |
| Margen bruto, plan Intermedio (US$35) | **99,0% a 99,5%** |
| Margen bruto, plan Base (US$20) | **99,1% a 99,6%** |

Conclusiones:

1. **El LLM es el costo que importa:** ~85% a 90% del total. Infra con espejo pesa 5% a 12%; Graphity, menos del 5%.
2. **El costo por usuario es el 1% a 2% del precio del plan más bajo.** El precio se decide por lo que el mercado paga, no por el costo.
3. **La incertidumbre grande es de uso, no de precios:** los turnos por día por plan son supuestos. Se miden en la beta con el metering de tokens.

---

## 2. Supuestos de uso (míos, **no medidos**)

| Plan | Turnos/día | Audios/día | Uso relativo al Intensivo |
|---|---|---|---|
| Intensivo | 30 (900/mes) | 10 (~15 s c/u, ~1,25 h/mes; hasta 4 h) | 100% |
| Intermedio | ~12 | ~4 | ~40% |
| Base | ~5 | ~1 | ~15% |

Otros supuestos del usuario intensivo: 1,8 llamadas LLM por turno, ~3,77 mil tokens por llamada,
100 tickets/mes (OCR de imagen), ~300 llamadas a Composio/mes.

---

## 3. Costos por componente (5.000 usuarios intensivos)

### 3.1 LLM, voz y Composio — US$1.800 a 3.200

- **Modelo de chat:** migración de gpt-4o/gpt-4o-mini (OpenAI los retira el 2027-01-14) a **`gpt-6-luna`**.
  Tarifas por millón de tokens: entrada 0,10 · entrada cacheada 0,01 · salida 0,50
  (gpt-4o-mini: 0,15 / 0,075 / 0,60; gpt-4o: 2,50 / 1,25 / 10,00).
- **Voz (STT Whisper):** OpenRouter `whisper-large-v3-turbo` medido ~US$0,015/h (p50 0,88 s);
  Groq turbo US$0,04/h (p50 0,32 s). A 1,25 h/mes (hasta 4 h) son centavos por usuario.
- **Composio:** ~300 llamadas/mes por usuario intensivo; **el plan real de Composio no está verificado.**
- **Caso pesimista del LLM:** ~US$5.700.

### 3.2 Graphity (memoria de grafo) — ~US$150 (rango US$50 a 500)

Sólo embeddings `text-embedding-3-small` (US$0,02 por millón de tokens), ingesta estructurada sin LLM.
Estimación: ~1,5 millones de tokens por usuario y mes (ingesta ~0,36 M · entidades y relaciones ×3
· recall ~0,09 M) = US$0,03 por usuario. El factor ×3 puede ir de ×1 a ×10 y **no está medido**
(la ingesta corre vacía hoy por falta de tráfico). Si algún camino usara extracción con LLM
(modo por defecto de Graphiti), el costo subiría bastante; con "0-LLM" confirmado no se incluyó.

### 3.3 Infraestructura (Hetzner) — con espejo: US$130 a 470

Cada componente en su VPS, y cada VPS con uno en espejo.

| VPS | Tamaño estimado | Sin espejo (US$/mes) | Con espejo (US$/mes) |
|---|---|---|---|
| Frontend | CX23 | ~5 | ~10 |
| App (web FastAPI + workers) ×2 | 4 vCPU / 8 GB | 18 a 84 | 36 a 168 |
| Temporal (servidor + Postgres) | 4 vCPU / 8 GB | 9 a 42 | 18 a 84 |
| Base de datos (Postgres) | 4 vCPU / 8 GB | 9 a 42 | 18 a 84 |
| Graphity (Neo4j + Graphiti) | 8 vCPU / 16 GB | 18 a 42+ | 36 a 84+ |
| Backups (~20%, sólo sobre los principales) | | 12 a 43 | 12 a 43 |
| **Total** | | **~71 a 258** | **~130 a 473** |

Los precios salen de documentos del workspace de fechas distintas y **se contradicen** (CPX22 figura
a €9,49 y a €19,49; CPX32 entre US$16,49 y 41,99): el rango cubre los dos extremos. Los tamaños son
estimación mía; lo único medido es la memoria de los procesos de hoy (worker ~150 MB, Temporal ~600 MB,
VPS de 4 vCPU / 7,7 GB con carga ~1,3).

No se duplicaron los backups: el espejo replica también un borrado o una corrupción.

### 3.4 Total (5.000 usuarios intensivos)

| Concepto | Mínimo | Máximo |
|---|---|---|
| LLM, voz y Composio (rango típico) | 1.800 | 3.200 |
| Graphity | 150 | 150 |
| VPS con espejo + backups | 130 | 473 |
| **Total** | **~2.080** | **~3.820** |

Con el LLM pesimista (~5.700) el total llega a ~US$6.300.

---

## 4. Costo por usuario y margen por plan

El costo de cada plan suma la parte variable (LLM, voz, Composio y Graphity, escalada por el uso) más
la infra repartida entre los 5.000 usuarios (US$0,03 a 0,09, que no baja con el uso).

| Plan | Precio | Costo/usuario/mes | Costo como % del precio | Margen bruto |
|---|---|---|---|---|
| Intensivo | US$50 | US$0,42 a 0,76 | 0,8% a 1,5% | 98,5% a 99,2% |
| Intermedio | US$35 | US$0,19 a 0,36 | 0,5% a 1,0% | 99,0% a 99,5% |
| Base | US$20 | US$0,09 a 0,19 | 0,5% a 1,0% | 99,1% a 99,6% |

### 4.1 Escenarios a 5.000 usuarios

| Escenario | Ingreso/mes | Costo/mes | Margen |
|---|---|---|---|
| Todos Intensivos, caso típico | 250.000 | 2.080 a 3.820 | 98,5% a 99,2% |
| Todos Intensivos, LLM pesimista | 250.000 | ~6.300 | ~97,5% |
| Todos en Base (US$20) con uso Intensivo (peor uso, precio más bajo) | 100.000 | 2.080 a 3.820 | 96% a 98% |
| Mezcla ilustrativa: 20% Intensivo, 40% Intermedio, 40% Base | 160.000 | 960 a 1.880 | 98,8% a 99,4% |

La mezcla es un ejemplo inventado para ilustrar, no una proyección de demanda.

### 4.2 Punto de equilibrio de infraestructura

La infra es casi fija (US$130 a 470/mes con espejo). Con pocos usuarios pesa más por cabeza
(100 usuarios: US$1,3 a 4,7 cada uno) y se cubre con unos 3 a 10 usuarios Intensivos.

---

## 5. Contexto de mercado (precios de referencia)

No se encontró un competidor directo con el alcance completo (asistente + agentes sobre las apps del
emprendedor + voz + memoria de grafo + cobros). **No se hizo un mapa de competencia**; la ausencia de
resultados no prueba que no exista. Referencias por pieza, de blogs comparadores que no coinciden
entre sí (confirmar en las páginas oficiales):

| Pieza | Referencia (US$/mes) |
|---|---|
| Asistente con voz (ChatGPT Plus, Claude Pro, Google AI Pro) | ~20; planes de uso alto 100 a 200 |
| Agentes que ejecutan acciones (Zapier Agents, Lindy) | ~33; Lindy 50 a 300 |
| Agenda/productividad (Motion, Notion AI) | 10 a 29 |
| Memoria de largo plazo (Mem0, Zep) | 19 a 312 por proyecto, no por usuario |

Sumando piezas sueltas, un emprendedor pagaría unos US$60 a 100 sin cobros ni lectura de tickets.
El riesgo principal es la **capacidad de pago local** del precio de US$50, que no se deduce del
costo: se mide con cobro real en la beta.

Fuentes: [Lindy pricing (Zapier)](https://www.zapier.com/blog/lindy-pricing/) ·
[AI Agents for Small Business](https://vibecoding.app/blog/ai-agents-for-small-business) ·
[Lindy vs Zapier (CostBench)](https://costbench.com/compare/lindy-vs-zapier/) ·
[AI Subscription Prices 2026](https://www.sentisight.ai/ai-price-comparison-gemini-chatgpt-claude-grok/) ·
[AI Pricing Cheat Sheet (eWeek)](https://www.eweek.com/news/ai-pricing-cheat-sheet-2026/) ·
[Mem0 vs Zep vs Letta](https://ecorpit.com/ai-agent-memory-mem0-zep-letta-cloudflare-comparison-2026/) ·
[Zep plans (CostBench)](https://costbench.com/software/ai-memory-context/zep/).

---

## 6. Concurrencia y límites de proveedores

- **Concurrencia estimada (5.000 intensivos):** pico ~8 turnos/s, ~40 turnos en vuelo (hasta ~150 en ráfaga),
  ~40 activities de Temporal/s, ~25 inserts de metering/s, 5.000 workflows de larga vida, ~400 a 600
  usuarios conectados.
- **OpenAI (tier Launch), gpt-6-luna:** 10 M TPM · 10 k RPM · 50 k IPM.
- **Groq:** los límites son por organización. Medido en plan gratuito: 2.000 req/día y 429 en ráfaga
  (retry-after 3 s). Los límites del plan Developer **no están confirmados**.
- **Voz:** corre en el endpoint `/chat/audio` de FastAPI (no en una activity de Temporal), así que no
  hereda los reintentos de Temporal; por eso el cliente reintenta 429 y cae al proveedor de respaldo.

---

## 7. Qué NO está verificado

1. **Turnos reales por plan** (la cifra que más mueve el costo): se miden en la beta con el metering.
2. **Plan real de Composio** y su costo a 300 llamadas/mes por usuario.
3. **Límites del plan Developer de Groq**, y los de OpenRouter a escala.
4. **Factor de embeddings de Graphity** (×1 a ×10) y si algún camino usa LLM al ingerir.
5. **Dimensionamiento de las VPS** (estimado, sin prueba de carga) y los precios de Hetzner (hay cifras contradictorias).
6. **Cuánto cuentan los tokens cacheados** contra el TPM de OpenAI y el `max_concurrent_activities` del worker.
7. **Precisión de Whisper turbo con audio real en español** (el spike usó un tono sintético).
8. **Costos no incluidos:** soporte, captación de clientes, impuestos, alta disponibilidad con balanceador
   (unos €5/mes cada uno), tráfico saliente de Hetzner.

---

## 8. Estado de implementación (afecta los costos reales)

- **Metering con tokens** (entrada/salida/cacheados/razonamiento): commit local `bbdaa001` en la rama
  `backend/metering-entrada-salida`, **sin push ni deploy**. Sin eso no hay costo real por tenant.
- **Luna:** probado en spike (compatibilidad y calidad); la parametrización en el código **no está mergeada**.
- **Voz con OpenRouter primario y Groq de respaldo:** en la rama `backend/stt-modelo-por-env`, con gate
  final en curso al momento de redactar; **no mergeada ni desplegada**. La key de OpenRouter ya está
  en el env de producción.
- **Tope por plan:** el metering permite medir y poner topes por plan; los límites de cada plan deben
  decidirse con datos antes de cobrar.

---

## 9. Recomendaciones

1. Lanzar con los precios propuestos (US$50 / 35 / 20) y ajustar con datos de la beta.
2. Mergear y desplegar el metering con tokens **antes** de cobrar, para tener el costo real por tenant.
3. Definir topes de uso por plan con el metering; un Intensivo sin límite puede salirse del margen
   (el margen se mantiene arriba del 95% hasta consumos de 10 a 20 veces lo supuesto).
4. Priorizar la vigilancia del proveedor LLM sobre la infraestructura: es el 85% a 90% del costo.
5. Pasar la cuenta de Groq al plan de pago y confirmar sus límites reales antes de depender de ella.

---

## 10. Resultado neto con equipo y marketing (agregado 2026-11-03)

Se suman tres costos fijos mensuales a la ganancia bruta de la sección 4 (punto medio del costo):

| Costo fijo (US$/mes) | Bajo | Base | Conservador | Supuesto |
|---|---|---|---|---|
| Equipo técnico | 1.500 | 3.000 | 6.000 | US$3.000 por persona de 8 h (dato del operador): media jornada, una completa, dos completas |
| Community manager | 500 | 850 | 1.200 | Freelance junior a semi senior en Argentina; **inferencia**, no promedio verificado |
| Publicidad en Instagram | 1.000 | 2.000 | 5.000 | Presupuesto de ejemplo, no derivado del costo; CPC de LATAM US$0,20 a 1,50 (orientativo) |
| **Total fijo** | **3.000** | **5.850** | **12.200** | |

| Ganancia neta/mes (US$) y margen | Fijos bajos | Fijos base | Fijos conservadores |
|---|---|---|---|
| Todos Intensivos (ingreso 250.000; bruta 247.050) | 244.050 · 97,6% | 241.200 · 96,5% | 234.850 · 93,9% |
| Mezcla de ejemplo (ingreso 160.000; bruta 158.580) | 155.580 · 97,2% | 152.730 · 95,5% | 146.380 · 91,5% |
| Todos en Base (ingreso 100.000; bruta 99.300) | 96.300 · 96,3% | 93.450 · 93,5% | 87.100 · 87,1% |

- Con la mezcla de ejemplo y fijos base, ~US$152.730 al mes (~US$1,83 millones al año).
- Unos 200 usuarios de pago de la mezcla cubren los fijos base y los servidores.
- **Supuesto más débil:** la publicidad. El presupuesto para llegar a 5.000 clientes depende de la conversión de clics a pago, que no está medida.
- **Sin estimar todavía:** impuestos, soporte humano ante incidentes fuera de lo que cubre el autohealing y herramientas de automatización de marketing.
- Fuentes orientativas (blogs, no coinciden entre sí): [NovoAds](https://novoads.ai/es/blog/cuanto-cuesta-publicidad-en-meta) · [TopGrowth](https://topgrowthmarketing.com/instagram-ads-cost/) · [Coderhouse](https://www.coderhouse.com/ar/sueldos/sueldo-community-manager-argentina-2025) · [Aprender21](https://www.aprender21.com/blog/salario-community-manager).

### 10.1 Ganancia neta anual (costos fijos base, operativo al punto medio)

Las secciones 3 y 4 muestran el margen **bruto** (solo costo operativo); **el resultado con todos los costos es el de esta sección**.

| Escenario | Neta/mes | Margen neto | Neta/año | Rango anual (conservador a bajo) |
|---|---|---|---|---|
| Todos Intensivos, típico | 241.200 | 96,5% | 2.894.400 | 2.818.200 a 2.928.600 |
| Todos Intensivos, LLM pesimista | 237.850 | 95,1% | 2.854.200 | 2.778.000 a 2.888.400 |
| Mezcla de ejemplo | 152.730 | 95,5% | 1.832.760 | 1.756.560 a 1.866.960 |
| Todos en Base, uso de Base | 93.450 | 93,5% | 1.121.400 | 1.045.200 a 1.155.600 |
| Todos en Base, uso Intensivo | 91.200 | 91,2% | 1.094.400 | 1.018.200 a 1.128.600 |

Margen neto por plan (fijos repartidos a US$1,17 por usuario): Intensivo 96,1% a 96,8%, Intermedio 95,6% a 96,1%, Base 93,2% a 93,7%.

## 11. Costos fijos de servicios digitales, año 1 (agregado 2026-11-03)

Sólo servicios digitales fijos, sin personal técnico ni community manager. Los costos variables (LLM,
voz) salen del pago del usuario y no se incluyen. Precios verificados en las páginas oficiales el
2026-11-03, sin IVA. **Tipo de cambio supuesto: ~1,1 US$ por euro.**

### 11.1 Precios verificados

| Servicio | Plan y precio |
|---|---|
| Hetzner (CPX) | CPX32 (4 vCPU / 8 GB) €35,99 · CPX42 (8 vCPU / 16 GB) €69,99 · CPX02 €6,49 /mes. La página mostraba "no disponible" al crear; sin confirmar si es stock real |
| Contabo | VPS 4 (4 vCPU / 8 GB) €4,40 · VPS 8 (8 vCPU / 24 GB) €11,20 /mes, tarifa efectiva a 24 meses; precio mes a mes y add-on de backup sin verificar |
| Composio | Hobby US$0 hasta 100.000 llamadas · Pro US$29 con US$29 de crédito, luego US$0,0003 por llamada |
| Expo (ex EAS) | Free (1.000 MAU) · Starter US$19 (3.000 MAU, luego US$0,005 por MAU) · Production US$199 |
| Backblaze B2 | desde US$6,95 por TB/mes · descarga gratis hasta 3× lo almacenado · sin mínimo de retención |

### 11.2 Progresión por etapa (US$/mes, escenario Hetzner)

Supuesto: 300 llamadas a Composio por usuario al mes (cifra del reporte, no medida).

| Etapa | Usuarios | Total/mes Hetzner | Total/mes Contabo |
|---|---|---|---|
| T1 (meses 1 a 3) | ~100 | ~100 | ~29 |
| T2 (meses 4 a 6) | ~500 | ~228 | ~86 |
| T3 (meses 7 a 9) | ~1.500 | ~389 | ~182 |
| T4 (meses 10 a 12) | ~3.000 a 5.000 | ~814 | ~439 |
| **Total año 1** | | **~4.600** | **~2.200** |

Cada total incluye infraestructura, Composio, Expo, Apple Developer (~US$99 al año) y otros menores.
**Composio pasa a ser el costo mayor desde T3** y es de consumo, no fijo. Falta sumar B2 (~US$1 a 3
al mes a escala; centavos antes de T3), que no está en la tabla.

### 11.3 Dimensionamiento para 5.000 usuarios con margen (Hetzner)

Estimación, **sin prueba de carga**. Medido hoy: VPS de 4 vCPU / 7,7 GB con carga ~1,3.

| Rol | Tipo | €/mes |
|---|---|---|
| App + frontend + workers (×2) | CPX32 | 72 |
| Postgres de la app | CPX32 | 36 |
| Réplica de Postgres | CPX32 | 36 |
| Temporal (servidor + su Postgres) | CPX32 | 36 |
| Graphity (Neo4j + Graphiti) | CPX42 | 70 |
| Snapshots Hetzner (~20%) | | ~25 |
| **Total** | | **~€275 (~US$300)** |

Con espejo completo: ~US$480/mes. La app y el frontend comparten el mismo VPS.

### 11.4 Backups fuera del proveedor (Backblaze B2)

Los snapshots de Hetzner no protegen de un borrado ni de una cuenta suspendida. `fleet-platform/backup/setup-wal-g.sh`
ya soporta destino S3-compatible (`WALG_S3_PREFIX`, retención de 7 base backups); B2 habla S3. Volumen
estimado 100 a 300 GB (sin medir) → **~US$1 a 3 al mes**. Un backup sin restauración probada no cuenta
como verificado: probar una restauración antes de depender de él.

### 11.5 Contabo: fiabilidad (investigación, sin spike)

Reseñas mayormente de afiliados, metodología inconsistente: steal de CPU por sobreventa (0 a 2% fuera
de pico, 8 a 15% en pico), uptime entre 99,87% y 100%, disco más variable para bases de datos, soporte
lento. Varias fuentes recomiendan Hetzner para producción con base de datos. Mover sólo la app a Contabo
ahorraría ~US$600 a 800 en el año 1 y agrega latencia hacia la base. No recomendado en el año 1.

## 12. Trayectoria de servidores y costos fijos por crecimiento (agregado 2026-11-03)

Reemplaza la progresión de §11.2 como plan vigente. **Composio sale de los fijos**: se cobra por
consumo y entra con los variables que paga el usuario. Precios Hetzner verificados el 2026-11-03,
sin IVA; tipo de cambio supuesto ~1,1 US$ por euro.

**Decisiones del operador (2026-11-03):**
- Se arranca con **los 4 VPS separados desde el día 0** (app + frontend · Postgres · Temporal ·
  Graphity) para no tener que separar servicios con datos reales adentro: después sólo se agranda.
- **Graphity arranca en CPX32** (4 vCPU / 8 GB): Neo4j con 4 GB queda justo.
- **Espejo completo en E4** (~US$180/mes extra): se acepta el costo para dar un servicio de calidad.

| Etapa | Usuarios | Configuración (Hetzner) | US$/mes |
|---|---|---|---|
| E0 + E1 | 0 a 500 | App, Postgres y Temporal en CPX22 (2 vCPU / 4 GB) · Graphity en CPX32 | ~135 |
| E2 | 500 a 1.500 | App y Postgres suben a CPX32 · Temporal sigue en CPX22 · Expo pasa a Starter (>1.000 MAU) | ~200 |
| E3 | 1.500 a 3.000 | + 2.ª app (relevo) · + réplica de Postgres · Graphity a CPX42 · Temporal a CPX32 | ~330 |
| E4 | 3.000 a 5.000 | Espejo completo | ~520 |

Cada fila incluye snapshots (~20% de los servidores), Expo, Apple Developer (~US$8/mes) y Backblaze B2.
**Año 1 con el crecimiento base (una etapa por trimestre): ~US$2.930**, más US$25 únicos de Google Play.

**Cuándo subir de etapa** (deciden las métricas, no el conteo de usuarios): CPU >60% sostenido o
RAM >75% · crece el tiempo de respuesta del chat o el schedule-to-start de Temporal · Postgres cerca
del límite de conexiones o de disco.

**Matices:**
- E3 y E4 **agregan** servidores (2.ª app, réplica, espejo): hay que configurar réplica y balanceo;
  no es sólo agrandar.
- Agrandar en Hetzner requiere apagar el servidor unos minutos: hacerlo en horario de bajo uso hasta
  tener relevo (E3).
- Al agrandar, subir sólo CPU y RAM (sin disco) permitiría volver a bajar. **Sin confirmar.**
- Hoy la app corre en VPS compartidos con otros proyectos; pasar a los 4 VPS dedicados es una
  migración con trabajo propio.
- **Sin prueba de carga:** los tamaños son estimados; hacerla antes de E3.

### 12.1 Presupuesto total del año 1 sin contratar personal

| Escenario | Publicidad/año | Total año 1 (servicios ~2.930 + LLM de usuarios gratis ~500 + reserva 20%) |
|---|---|---|
| Sólo orgánico | 0 | ~US$4.100 |
| Ads moderados (~500/mes) | ~6.000 | ~US$10.100 |
| Meta de 5.000 **activos** en 12 meses | ~34.000 (rango 20.000 a 49.000) | ~US$38.000 |

Supuestos de la meta (no medidos): instalación en Argentina ~US$2 (mediana de Facebook; Google App
Campaigns US$0,50 a 2 en LATAM), 30 a 50% de activación, ~6% de bajas por mes, 30% orgánico.
Google Búsqueda sale 3 a 6 veces más caro por usuario. Para **5.000 de pago** (15% de conversión) la
publicidad sube a US$130.000 a 330.000. No incluye sociedad, contador, impuestos ni comisiones de
MercadoPago. **Validar con un piloto de ~US$500** comparando Meta, Google Apps y Google Búsqueda.

## 13. Estrategia de financiamiento y crecimiento (agregado 2026-11-03)

### 13.1 Decisión del operador: crecimiento autofinanciado

**El negocio se autofinancia:** lo que pagan los usuarios se reinvierte en publicidad hasta alcanzar
el equilibrio. Los socios aceptan no retirar beneficios durante ese período. Marketing, publicidad y
soporte técnico los manejan los socios **hasta los umbrales de contratación de §13.3** (community manager desde ~300 usuarios de pago, soporte desde ~1.000).

### 13.2 Por qué funciona (si se cumplen los supuestos)

| Variable | Valor | Origen |
|---|---|---|
| Costo por usuario activo | ~US$7 (rango 4 a 10) | Instalación ~US$2 (dato) ÷ 30 a 50% de activación (supuesto) |
| Conversión a pago | 15% | Supuesto |
| Costo por usuario de pago | ~US$47 | US$7 ÷ 15% |
| Ingreso por usuario de pago | ~US$30/mes cobrado; **~US$23,55 neto** | Promedio de planes US$20 / 35 / 50 (§4), sin IVA 21% ni MercadoPago ~5% |
| Margen bruto | ~99% | §4 |
| **Recuperación del costo de adquisición** | **~2 meses** | US$47 ÷ US$23 (neto menos variable) |

### 13.3 Simulación: usuarios de pago, aporte propio y llegada a 5.000

**Recalculado el 2026-11-03 con ingreso NETO.** La versión anterior tomaba los US$30 que paga el cliente como ingreso propio. Pero el precio incluye **IVA 21%** y MercadoPago cobra **~5%** (supuesto): cada usuario de pago deja **US$23,55**, ~22% menos. Con eso la meta se corre del mes 17 al **mes 22** y el acumulado al mes 24 baja de ~US$1.037.000 a **~US$370.000**. El beneficio se muestra antes y después de Ganancias (35%, supuesto).

El producto tiene sólo **prueba de 15 días** (versión completa, limitada en acciones) y planes pagos: se cuentan **sólo usuarios de pago**, y el costo de las pruebas que no convierten va dentro del costo de adquisición. *La prueba de 15 días no está en el código* (`apps/`, `motor/`, `deploy/`; 2026-11-03).

**Supuestos (no medidos):** arranque con 0 de pago · costo por usuario de pago US$49, que sube hasta el doble al acercarse a 5.000 · precio promedio US$30 con IVA · bajas 6%/mes · 30% orgánico · variable US$0,6 por usuario · servidores según §12 · personal por umbral (tabla abajo) · semilla de publicidad US$500/mes en los meses 1 a 3 · al llegar a 5.000 la publicidad pasa a **mantenimiento** (reponer bajas + 2% por mes) · el mes de llegada compra sólo lo que falta.

#### Comparación de esquemas de reinversión (con personal, escenario base, US$)

| Esquema | Llega a 5.000 | Aporte propio | Beneficio año 1 | Beneficio año 2 | Acumulado mes 24 | Acumulado mes 36 | Publicidad máxima/mes |
|---|---|---|---|---|---|---|---|
| 70% siempre | mes 24 | ~1.011 | ~7.500 | ~205.000 | ~213.000 | ~1.230.000 | ~63.000 |
| 100% × 6 meses, luego 70% | mes 23 | ~1.011 | ~9.900 | ~302.000 | ~312.000 | ~1.347.000 | ~66.000 |
| **100% × 8 meses, luego 70% (plan vigente)** | **mes 22** | ~1.011 | ~10.000 | ~360.000 | ~370.000 | ~1.423.000 | ~64.000 |
| 100% × 12 meses, luego 70% | mes 20 | ~1.011 | −~1.000 | ~494.000 | ~493.000 | ~1.581.000 | ~62.000 |
| 100% siempre | mes 17 | ~1.011 | −~1.000 | ~576.000 | ~575.000 | ~1.719.000 | ~81.000 |

Pesimista (US$100 por usuario de pago): 70% siempre llega en el mes 63, el plan en el 60 y 100% siempre en el 39; aporte propio ~US$1.467. Beneficio = neto − personal − servidores − publicidad, antes de Ganancias, contador y reserva.

#### Desarrollo del plan vigente: 100% × 8 meses, luego 70%, con personal (US$ por mes)

| Mes | De pago (inicio → fin) | Cobrado (con IVA) | Ingreso neto | Personal | Publicidad | Beneficio antes de Ganancias | Después de Ganancias | Acumulado | Hito |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 → 13 | 0 | 0 | 0 | 500 | -635 | -635 | -635 |  |
| 2 | 13 → 26 | 398 | 312 | 0 | 500 | -331 | -331 | -966 |  |
| 3 | 26 → 37 | 771 | 605 | 0 | 500 | -45 | -45 | -1.011 |  |
| 6 | 80 → 120 | 2.399 | 1.883 | 0 | 1.700 | 0 | 0 | -1.011 |  |
| 8 | 180 → 272 | 5.400 | 4.240 | 0 | 3.997 | 0 | 0 | -1.011 |  |
| 9 | 272 → 363 | 8.147 | 6.396 | 0 | 4.269 | 1.830 | 1.189 | 819 | pasa a 70% |
| 10 | 363 → 474 | 10.881 | 8.543 | 500 | 5.383 | 2.307 | 1.500 | 3.126 | entra CM medio tiempo |
| 12 | 619 → 806 | 18.584 | 14.591 | 500 | 9.463 | 4.056 | 2.636 | 10.256 |  |
| 14 | 1.042 → 1.308 | 31.258 | 24.542 | 2.350 | 14.957 | 6.410 | 4.166 | 22.004 | soporte media jornada · CM base |
| 16 | 1.634 → 2.023 | 49.011 | 38.480 | 2.350 | 24.374 | 10.446 | 6.790 | 40.690 |  |
| 18 | 2.480 → 3.005 | 74.407 | 58.419 | 2.350 | 37.975 | 16.275 | 10.579 | 70.093 |  |
| 19 | 3.005 → 3.570 | 90.146 | 70.776 | 4.200 | 44.977 | 19.276 | 12.529 | 89.369 | soporte jornada completa · CM completo |
| 20 | 3.570 → 4.192 | 107.098 | 84.085 | 4.200 | 54.056 | 23.167 | 15.058 | 112.535 |  |
| **22** | 4.865 → 5.000 | 145.959 | 114.596 | 4.200 | 31.726 | 75.231 | 48.900 | 215.220 | llega a 5.000 |
| 23 | 5.000 → 5.100 | 150.000 | 117.769 | 7.200 | 30.154 | 76.895 | 49.982 | 292.115 | 2.ª persona de soporte |
| 24 | 5.100 → 5.202 | 153.000 | 120.124 | 7.200 | 31.064 | 78.279 | 50.882 | 370.394 |  |
| 30 | 5.743 → 5.858 | 172.303 | 135.279 | 7.200 | 37.212 | 86.901 | 56.485 | 869.990 |  |
| 36 | 6.468 → 6.597 | 194.041 | 152.346 | 7.200 | 44.734 | 96.012 | 62.408 | 1.423.065 |  |

#### Contratación de personal

Se contrata por **usuarios de pago**, no por mes; el costo se descuenta antes del neto (achica la publicidad, no el aporte propio).

| Desde (usuarios de pago) | Soporte técnico | Community manager | Personal US$/mes |
|---|---|---|---|
| 0 | socios | socios | 0 |
| 300 | socios | medio tiempo (500) | 500 |
| 1.000 | media jornada (1.500) | base (850) | 2.350 |
| 2.500 | jornada completa (3.000) | completo (1.200) | 4.200 |
| 5.000 | 2 personas (6.000) | completo (1.200) | 7.200 |

Soporte a US$3.000 por persona de 8 h (dato del operador); community manager según §10 (inferencia). El disparador real es el tiempo de los socios y los tickets que escalan a humano, que se miden desde la beta.

#### Tope fijo de publicidad: no sirve si es bajo

| Estrategia (plan vigente) | Llega a 5.000 | De pago al mes 36 | Beneficio mes 24 | Beneficio mes 36 | Acumulado mes 36 |
|---|---|---|---|---|---|
| tope de US$15.000/mes | nunca (se estanca) | 3.465 | 43.459 | 59.134 | ~968.000 |
| tope de US$30.000/mes | mes 29 | 5.743 | 61.204 | 85.428 | ~1.293.000 |
| sin tope, mantenimiento al llegar | mes 22 | 6.597 | 78.279 | 96.012 | ~1.423.000 |

Con 6% de bajas, 5.000 usuarios pierden ~300 por mes y reponerlos cuesta **~US$23.000 por mes**; un tope menor compra menos de lo que se pierde. Con 3% de bajas cuesta la mitad: **la palanca mayor son las bajas**, y se bajan con producto, no con publicidad.

**Lectura:**

- **Aporte propio ~US$1.011, sólo en los meses 1 a 3** (semilla de publicidad + fijos). Desde el mes 4 todo sale de lo que ingresa. A eso sumar la reserva de §13.4, que no se gasta.
- **La meta pasa al mes 22** (antes, con ingreso bruto, era el 17). El año 1 casi no deja beneficio (~US$10.000); el negocio empieza a dejar plata en serio en el año 2 (~US$360.000).
- **Contrapunto al plan vigente:** con ingreso neto conviene estirar el 100%. **100% × 12 meses** llega en el mes 20 (2 antes) y acumula ~US$158.000 más al mes 36; lo que se resigna es el beneficio del año 1 (~US$10.000). 100% siempre llega en el mes 17 pero exige ~US$81.000 de publicidad en un mes. **Decisión del operador.**
- Costo por usuario de pago al inicio: recuperación en ~2.1 meses (antes se decía 1,5 con ingreso bruto).
- Lo que decide el plazo es el costo de conseguir cada usuario de pago, y eso sólo lo mide el piloto (§13.5).

```python
# Núcleo del modelo (cifras de arriba). ARPU_NETO = 30 / 1,21 * 0,95; personal(p) según la tabla de personal.
def sim(n100=8, despues=0.7, meses=24, tope_ads=None, post_crec=0.02):
    p = acc = 0.0; ll = None
    for m in range(1, meses + 1):
        fijo = servidores(p) + sum(personal(p))
        neto = p * ARPU_NETO - p * 0.6 - fijo; cac = 49 * (1 + p / 5000)
        if ll is None:
            ads = max(max(0, neto * (1.0 if m <= n100 else despues)), 500 if m <= 3 else 0)
            if tope_ads: ads = min(ads, tope_ads)
            ads = min(ads, max(0, (5000 - p * 0.94) * cac / 1.3))   # el mes de llegada compra sólo lo que falta
        else:
            ads = min(max(0, neto) * 0.7, p * (0.06 + post_crec) / 1.3 * cac)   # mantenimiento
        acc += neto - ads; p = p * 0.94 + ads / cac * 1.3
        if ll is None and p >= 4999.5: ll = m
```

### 13.4 Regla de reinversión

1. Reservar ~3 meses de costos fijos (~US$400 al inicio, ~US$1.500 al final).
2. Reinvertir **el 100% del neto los primeros 8 meses y el 70% después** (plan vigente de §13.3; el
   contrapunto de 12 meses está ahí), y pasar a presupuesto de mantenimiento al llegar a 5.000, mientras
   **cada usuario de pago deje al menos 3 veces lo que costó conseguirlo** (con 6% de bajas: recuperar su
   costo en **5,5 meses o menos**; hoy se estima ~2).
3. Si la recuperación pasa de 5,5 meses: bajar la inversión y corregir incorporación, bajas o precio antes
   de seguir gastando. Es el mismo umbral que fija el tope de §14.1.

**Capital inicial necesario:** el piloto más US$500 a 1.000.

### 13.5 Canales de publicidad

| Canal | Dato encontrado | Costo por usuario activo (estimado) |
|---|---|---|
| Meta (Instagram y Facebook) | Instalación en Argentina ~US$2 (mediana Facebook, Superads; no es Instagram por separado). Instagram global: US$1,99 por instalación, US$9,23 por lead (Webtonic) | ~US$4 a 10 |
| Google App Campaigns | Instalación en LATAM US$0,50 a 2; una fuente dice que Meta sale 20 a 40% más caro | ~US$3 a 8 |
| Google Búsqueda | Clic en Argentina ARS 1.000 a 4.500; LATAM ~US$2; B2B/SaaS ~US$5,7 (fuente no verificable) | ~US$15 a 60 (con 5 a 15% de registro, supuesto) |

Fuentes: blogs de agencias y proveedores, con cifras que se contradicen; ninguna oficial. **Activación,
bajas, porcentaje orgánico y conversión a pago son supuestos propios, sin fuente.** Búsqueda cuesta 3 a
6 veces más por usuario pero trae intención: usarla con palabras muy específicas.

**Siguiente paso:** piloto de ~US$500 en un mes repartido entre Meta, Google Apps y Google Búsqueda,
midiendo costo por instalación, activación y conversión a pago. Con eso se recalculan §12.1 y §13.3 (sobre todo el costo por usuario de pago, que decide el plazo).

### 13.6 Crowdfunding (investigado, descartado)

- **Por recompensas (Kickstarter):** apps/web tienen menos del 10% de éxito y el modelo está pensado
  para producto físico, no para suscripción. **No viable.**
- **Por participación:** en Argentina hay marco legal (Ley 27.349, plataformas inscritas en la CNV;
  RG 1125/2026 habilita emisiones chicas con autorización automática desde abril de 2026; reforma
  enviada al Congreso el 2026-11-03, no vigente). Requiere sociedad, asesoría legal y diluye. Sin
  tracción no es viable; reconsiderar sólo con métricas de la beta.
- **Preventa a los primeros usuarios** (plan anual de socio fundador por MercadoPago): encaja con la
  estrategia de autofinanciamiento y valida la disposición a pagar.

## 14. Mercado alcanzable: el segmento objetivo (agregado 2026-11-03)

Segmento: emprendedores y pymes que usan Gmail o Drive, aceptan trabajar chateando con una app y
pueden pagar US$20 a 50 por mes. **Sólo el primer escalón está medido**; los siguientes son supuestos
razonados, porque no hay fuente pública que los cubra.

| Escalón (Argentina) | Cantidad | Origen |
|---|---|---|
| Monotributistas + autónomos registrados | ~2,5 M | **Medido.** Secretaría de Trabajo (SIPA): 2,2 M monotributistas a jun-2026; 2,5 M con autónomos |
| + pymes empleadoras | ~0,5 M | **Medido.** UCEMA (SIPA): 515 a 523 mil en 2025 |
| **Universo formal** | **~3,0 M** | suma |
| Pueden pagar US$20 a 50/mes | ~1,0 a 1,5 M | **Supuesto.** La categoría A era ~60% del padrón en 2023 y factura poco; cuento la mayoría de las pymes y 25 a 40% de los independientes |
| Trabajan con Gmail/Drive | ~0,5 a 1,0 M | **Supuesto.** Gmail tenía ~46% de las direcciones en 2020 (dato viejo); uso 50 a 70% |
| Adoptarían un asistente de IA por chat | **~150 a 350 mil** | **Supuesto.** 41,6% de las pymes ya usa alguna IA (nadIA/Observatorio PyME 2025); para independientes, 20 a 40% |

**Qué implica:**

- **5.000 usuarios de pago son ~2% del segmento** (rango 1,4 a 3,3%). Alcanzable, pero no es un rincón
  chico del mercado.
- **Crecer 10% por mes desde 5.000** da ~15.700 a los 12 meses (~6% del segmento) y ~49.000 a los 24
  (~20%). Lo segundo no es creíble sólo en Argentina: la penetración típica de un SaaS sobre su mercado
  alcanzable en los primeros años es de 1 a 5%.
- **El público no se "satura" en 5.000** (corrección a lo dicho antes): lo que sube es el costo por
  usuario de pago a medida que se agotan los más fáciles. El modelo de §13.3 ya lo supone duplicado
  hacia 5.000; pasar del 3 a 5% del segmento probablemente lo triplica.
- **Más allá hace falta otro país.** Latinoamérica tiene ~48 M de trabajadores por cuenta propia y ~7 M
  de empresas de hasta 5 personas (OIT); el segmento hispanohablante sería del orden de 8 a 10 veces
  el argentino. Pero la facturación fiscal es distinta en cada país (en Argentina, ARCA): cada país es
  trabajo de producto, no sólo de publicidad.

**Cómo medirlo de verdad:**

1. **Meta Ads Manager:** tamaño estimado de audiencia en Argentina, 25 a 55 años, intereses
   emprendimiento, pymes y Google Workspace. Gratis; da el techo del canal pago.
2. **Piloto de ~US$500** (§13.5): costo real por usuario de pago, y cómo sube al duplicar la inversión.
   Esa curva es el techo real.
3. **Una pregunta en el alta de la prueba de 15 días** («¿qué correo usás para tu negocio?», «¿cuánto
   facturás por mes?»): convierte los supuestos en datos propios.

Fuentes: [iProfesional](https://www.iprofesional.com/management/464370-solo-crecen-monotributo-y-empleo-informal-en-argentina) ·
[Contexto Tucumán](https://www.contextotucuman.com/nota/417931/en-casi-15-anos-aumento-70_por_ciento-el-numero-de-monotributistas.html) ·
[Secretaría de Trabajo](https://www.argentina.gob.ar/sites/default/files/trabajoregistrado_2505_informe.pdf) ·
[Cronista](https://www.cronista.com/economia-politica/el-gobierno-dio-de-baja-a-400000-monotributistas-por-no-cumplir-con-un-requisito) ·
[UCEMA 05/2026](https://ucema.edu.ar/sites/default/files/2026-05/IndicadoresUCEMA_PyMEs052026.pdf) ·
[UCEMA 09/2025](https://ucema.edu.ar/sites/default/files/2025-09/IndicadoresUCEMA_PyMEs092025.pdf) ·
[Perfil](https://www.perfil.com/noticias/economia/cuatro-de-cada-diez-pymes-argentinas-ya-usan-ia-pero-pocas-miden-su-impacto-a40.phtml) ·
[RealSender](https://realsender.com/email-trends/2020-email-providers) ·
[OIT vía Accounter](https://accounter.co/noticias/actualidad/el-empleo-a-medias-se-apodera-de-la-region) ·
[SEGIB](https://www.segib.org/wp-content/uploads/Encuesta-Iberoamericana-de-la-Mipyme-2022.pdf)

### 14.1 Después de 5.000: crecimiento de 2% mensual, tope y punto antieconómico (agregado 2026-11-03)

**Cifras realistas:** a diferencia de §13.3, acá el precio de US$30 **incluye IVA 21%**, MercadoPago
cobra ~5% y el beneficio paga **Ganancias 35%** (comisión y alícuota son supuestos: confirmarlos con el
contador). Así cada usuario de pago deja **~US$23 por mes**, no 29,4, y con 6% de bajas su valor de vida
es **~US$383**. Arriba de 5.000: soporte 1 persona (US$3.000) cada 2.500 de pago, community manager
US$1.200 (US$2.400 desde 10.000) y servidores US$520 cada 5.000. El costo por usuario de pago sube con la
escala (doble a 5.000) y además al agotar el segmento de §14. Curva pesimista: se duplica cada 5.000 más.

**Los tres umbrales** (usuarios de pago):

| Umbral | Curva base | Curva pesimista | Qué significa |
|---|---|---|---|
| **Tope recomendado:** valor de vida = 3 × costo de conseguirlo | **~7.700** | **~6.800** | Estándar de SaaS sano. Debajo, cada usuario nuevo deja margen para errores de estimación |
| Máximo beneficio total | ~19.800 (fuera del mercado realista) | ~9.900 | Más allá, cada usuario extra **baja** el beneficio total |
| **Antieconómico:** valor de vida = costo de conseguirlo | ~29.500 | **~14.400** | Cada usuario nuevo cuesta más de lo que va a dejar |
| Techo de mercado (5% del segmento) | ~12.500 | ~12.500 | Más allá, otro país |

Entre el tope recomendado y el máximo hay una **zona gris**: cada usuario nuevo todavía suma, pero poco,
y cualquier error en el costo por usuario la vuelve pérdida. Sólo se entra con el costo medido.

**Beneficio mensual sosteniendo cada tamaño** (curva base; la publicidad sólo repone bajas, US$):

| De pago | Costo por usuario | Valor de vida / costo | Publicidad | Beneficio antes de Ganancias | Después de Ganancias |
|---|---|---|---|---|---|
| 5.000 | 100 | 3,8 | 23.077 | 83.972 | 54.582 |
| 7.500 | 126 | 3,0 | 43.715 | 117.198 | 76.178 |
| 10.000 | 153 | 2,5 | 70.673 | 143.424 | 93.226 |
| 12.500 | 181 | 2,1 | 104.150 | 163.812 | 106.478 |

En la curva pesimista, 10.000 deja 119.866 y 12.500 **baja** a 99.630: crecer resta.

**Trayectoria con 2% mensual desde 5.000 (mes 22, §13.3) hasta el tope recomendado** (curva base, US$ por mes):

| Mes | De pago | Ingreso (con IVA) | Publicidad | Beneficio antes de Ganancias | Después de Ganancias |
|---|---|---|---|---|---|
| 23 | 5.000 | 150.000 | 30.769 | 76.279 | 49.582 |
| 30 | 5.743 | 172.303 | 38.087 | 82.506 | 53.629 |
| 36 | 6.468 | 194.041 | 45.922 | 91.304 | 59.347 |
| 42 | 7.284 | 218.522 | 55.581 | 100.375 | 65.244 |
| **45 (tope)** | **7.700** | 231.000 | 45.637 | 116.867 | **75.963** |

| Año | Ingreso (con IVA) | Publicidad | Después de Ganancias | Margen sobre lo que paga el cliente |
|---|---|---|---|---|
| 3 | ~2,09 M | ~467.000 | ~650.000 | 31% |
| 4 | ~2,62 M | ~605.000 | ~814.000 | 31% |
| 5 en adelante | ~2,77 M | ~548.000 | ~912.000 | 33% |

Con la curva pesimista el tope llega antes (6.800, mes 39) y desde el año 4 deja ~US$800.000 por año.

**Lectura:**

- **El techo real no lo pone el mercado (~12.500) sino el costo de conseguir usuarios: ~7.000 a 8.000
  de pago.** La meta de 5.000 llega en el mes 22 (§13.3) y con 2% mensual el tope en los meses 39 a 45:
  unos 3,5 años desde el arranque.
- **La palanca son las bajas.** Con 3% en vez de 6%, el tope recomendado sube a ~11.600 a 19.100 (el
  mercado lo corta en ~12.500): valor de vida doble con la misma publicidad.
- **§13.3 ya está recalculado con ingreso neto** (antes usaba US$30 como ingreso propio): la meta
  pasó del mes 17 al 22, y esta trayectoria arranca ahí.
- Supuestos no medidos: costo por usuario de pago, su curva con la escala, bajas, comisión de
  MercadoPago y alícuota efectiva. El piloto de §13.5 mide el primero; las bajas, la beta.
