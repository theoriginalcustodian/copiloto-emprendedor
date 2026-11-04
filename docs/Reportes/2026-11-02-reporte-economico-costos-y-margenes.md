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
soporte técnico los manejan los socios, sin contratar personal.

### 13.2 Por qué funciona (si se cumplen los supuestos)

| Variable | Valor | Origen |
|---|---|---|
| Costo por usuario activo | ~US$7 (rango 4 a 10) | Instalación ~US$2 (dato) ÷ 30 a 50% de activación (supuesto) |
| Conversión a pago | 15% | Supuesto |
| Costo por usuario de pago | ~US$47 | US$7 ÷ 15% |
| Ingreso por usuario de pago | ~US$30/mes | Promedio de planes US$20 / 35 / 50 (§4) |
| Margen bruto | ~99% | §4 |
| **Recuperación del costo de adquisición** | **~1,5 meses** | US$47 ÷ US$30 |

### 13.3 Simulación: usuarios de pago, aporte propio y llegada a 5.000

**Corrección (2026-11-03):** la primera versión de esta sección contaba usuarios "activos" con un plan
gratis que no existe. El producto tiene sólo **prueba de 15 días** (versión completa, limitada en
cantidad de acciones) y planes pagos. La simulación cuenta **sólo usuarios de pago**; el costo de las
pruebas que no convierten (~US$0,2 a 0,3 de LLM cada una) va dentro del costo de adquisición.
*La prueba de 15 días no se encontró en el código* (`apps/`, `motor/`, `deploy/`; 2026-11-03): es una
decisión de producto, a implementar o con otro nombre.

**Supuestos (no medidos):** arranque con 0 de pago · costo por usuario de pago US$49 (US$7 por
instalación activada ÷ 15% de conversión + costo de pruebas), que **sube hasta el doble** al acercarse a
5.000 · ingreso promedio US$30 por usuario de pago (mezcla de planes; no es el máximo de US$50) · bajas
6%/mes · 30% orgánico · costo variable US$0,6 por usuario · fijos según §12 · **semilla de publicidad de
US$500/mes en los meses 1 a 3** (incluye el piloto) · el aporte propio cubre lo que el ingreso no alcanza
(fijos + variables + publicidad).

#### Reinversión del 70% del neto

| Mes | De pago | Ingreso/mes | Publicidad/mes | Aporte propio/mes | Aporte acumulado |
|---|---|---|---|---|---|
| 1 | 13 | 0 | 500 | 635 | 635 |
| 2 | 26 | 398 | 500 | 245 | 880 |
| 3 | 37 | 771 | 500 | 0 | 880 |
| 6 | 110 | 2.273 | 1.465 | 0 | 880 |
| 9 | 336 | 6.936 | 4.663 | 0 | 880 |
| 12 | 983 | 20.842 | 14.157 | 0 | 880 |
| 15 | 2.498 | 56.131 | 38.275 | 0 | 880 |
| **18** | **5.110** | 123.848 | 84.596 | 0 | 880 |

#### Reinversión del 100% del neto

| Mes | De pago | Ingreso/mes | Publicidad/mes | Aporte propio/mes | Aporte acumulado |
|---|---|---|---|---|---|
| 1 | 13 | 0 | 500 | 635 | 635 |
| 2 | 26 | 398 | 500 | 245 | 880 |
| 3 | 41 | 771 | 621 | 0 | 880 |
| 6 | 182 | 3.275 | 3.075 | 0 | 880 |
| 9 | 833 | 15.244 | 14.739 | 0 | 880 |
| 12 | 3.085 | 62.169 | 60.596 | 0 | 880 |
| **14** | **~5.000** | | | 0 | 880 |

#### Resumen

| Escenario | Llega a 5.000 de pago | Último mes con aporte propio | Aporte propio total |
|---|---|---|---|
| Base, 70% | **mes 18** | mes 2 | **~US$880** |
| Base, 100% | **mes 14** | mes 2 | **~US$880** |
| Pesimista (US$100 por usuario de pago), 70% | mes 42 | mes 3 | ~US$1.340 |
| Pesimista, 100% | mes 29 | mes 3 | ~US$1.340 |

Con costo por usuario constante (sin saturación) la llegada se adelanta: base 70% → mes 14, base 100% →
mes 10.

**Lectura:**
- **El aporte de bolsillo es chico y sólo al principio:** ~US$880 en el escenario base (la semilla de
  publicidad + los fijos de los primeros 2 meses). **Desde el mes 3 todo sale de lo que ingresa** en los
  cuatro escenarios. A eso sumar la reserva de §13.4 (~US$400), que no se gasta.
- **Lo que cambia entre escenarios no es el bolsillo sino el plazo:** 14 a 18 meses en el base, 29 a 42
  en el pesimista.
- **El 100% llega 4 meses antes**, pero implica no retirar nada hasta el mes 14.
- **La publicidad a escala (~US$85.000/mes en el mes 18 al 70%) es irreal** si el mercado se satura
  antes: el modelo sólo duplica el costo por usuario hacia 5.000. Más allá de ~5.000 las cifras no son
  creíbles y se omiten.

```python
def sim(reinv, meses=24, cac0=49, arpu=30, churn=0.06, org=0.30, semilla=500, meses_semilla=3):
    p = 0.0; acum = 0.0; filas = []
    for m in range(1, meses + 1):
        fijo = 135 if p < 500 else 200 if p < 1500 else 330 if p < 3000 else 520
        ingreso = p * arpu; variable = p * 0.6
        neto = ingreso - variable - fijo
        ads = max(max(0, neto * reinv), semilla if m <= meses_semilla else 0)
        aporte = max(0, fijo + variable + ads - ingreso); acum += aporte
        p = p * (1 - churn) + ads / (cac0 * (1 + p / 5000)) * (1 + org)
        filas.append((m, round(p), round(ingreso), round(ads), round(aporte), round(acum)))
    return filas
# sim(0.7) / sim(1.0) -> base; sim(0.7, meses=48, cac0=100) -> pesimista
```

#### Beneficio limpio mensual con reinversión del 70%

El beneficio limpio es el 30% del neto que no va a publicidad (antes de impuestos, comisiones de
MercadoPago, contador y reserva). Escenario base, US$ por mes. El acumulado descuenta los meses con
aporte propio.

| Mes | De pago (inicio → fin) | Ingreso | Publicidad | Beneficio limpio | Acumulado |
|---|---|---|---|---|---|
| 1 | 0 → 13 | 0 | 500 | −635 (aporte propio) | −635 |
| 2 | 13 → 26 | 398 | 500 | −245 (aporte propio) | −880 |
| 3 | 26 → 37 | 771 | 500 | 121 | −759 |
| 6 | 76 → 110 | 2.273 | 1.465 | 628 | 583 |
| 9 | 231 → 336 | 6.936 | 4.663 | 1.999 | 4.869 |
| 12 | 695 → 983 | 20.842 | 14.157 | 6.067 | 18.092 |
| 15 | 1.871 → 2.498 | 56.131 | 38.275 | 16.404 | 55.120 |
| 18 | 4.128 → 5.110 | 123.848 | 84.596 | 36.255 | 141.844 |

**Año 1: ~US$18.000 de beneficio**, casi todo en los meses 10 a 12. El salto entre los meses 15 y 18
no es un evento: es el interés compuesto (~30 a 40% de crecimiento mensual sobre una base mayor). Es
también el tramo menos confiable del modelo: no está verificado que Meta y Google en Argentina absorban
US$38.000 a 85.000 por mes al costo supuesto.

#### Después de la meta: presupuesto de mantenimiento (decisión 2026-11-03)

Reinvertir el 70% sin freno es una regla que ignora la meta: al llegar a 5.000 seguiría gastando
US$85.000 o más por mes. **Al llegar, la publicidad pasa a reponer las bajas y sumar un crecimiento
lento de 2% por mes.**

| Mes | De pago | Publicidad | Beneficio limpio | Acumulado |
|---|---|---|---|---|
| 18 (llegada) | 5.110 | 84.596 | 36.255 | 141.844 |
| 19 | 5.212 | 31.156 | 118.556 | 260.400 |
| 21 | 5.423 | 33.076 | 122.705 | 503.721 |
| 24 | 5.755 | 36.208 | 129.140 | 884.650 |

**Un tope fijo de publicidad durante la subida no sirve si es bajo:**

| Estrategia de publicidad | Llega a 5.000 | Beneficio mes 18 | Beneficio mes 24 | Acumulado al mes 24 |
|---|---|---|---|---|
| 70% sin tope, mantenimiento al llegar | mes 18 | 36.255 | **129.140** | **~885.000** |
| 70% con tope de US$30.000/mes | mes 28 | ~60.000 | ~101.000 | ~730.000 |
| 70% con tope de US$15.000/mes | nunca (se estanca en ~3.300) | ~46.000 | ~68.000 | ~560.000 |

**Por qué el tope bajo se estanca:** con 6% de bajas, 5.000 usuarios pierden ~300 por mes, y reponerlos
cuesta **~US$23.000 por mes** con el costo por usuario duplicado a esa escala. Un tope menor compra
menos de lo que se pierde: los usuarios se estabilizan donde lo que entra iguala a lo que se va.

**La palanca mayor son las bajas, no la publicidad:** con 3% de bajas en vez de 6%, el mantenimiento
de 5.000 cae a ~US$11.000 por mes. Bajarlas se hace con producto (soporte, valor diario percibido,
plan anual) y no cuesta publicidad. **Medir las bajas desde la beta.**

**Recomendación:** 70% sin tope durante la subida (el pico de US$85.000 dura 2 o 3 meses), presupuesto
de mantenimiento al llegar, y revisar el costo por usuario de pago entre los meses 9 y 12: si ya sube,
el salto se achica o se corre.

### 13.4 Regla de reinversión

1. Reservar ~3 meses de costos fijos (~US$400 al inicio, ~US$1.500 al final).
2. Reinvertir **70 a 100% del neto restante** mientras cada usuario de pago recupere su costo en
   **3 meses o menos**.
3. Si la recuperación pasa de 3 a 4 meses: bajar la inversión y corregir onboarding o precio antes
   de seguir gastando.

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
