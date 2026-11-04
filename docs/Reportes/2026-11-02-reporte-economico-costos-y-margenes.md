# Reporte económico — costos reales aproximados y márgenes (5.000 usuarios)

> **Fecha:** 2026-11-02 · **Estado:** estimación de modelo, **no medición de producción**.
> **Alcance:** costo mensual de operar el Copiloto del Emprendedor para 5.000 usuarios y margen
> bruto por plan (Intensivo US$50, Intermedio US$35, Base US$20).
> **Fuera de alcance (decisión del operador, 2026-11-02):** comisión de MercadoPago (la app sólo
> genera enlaces de pago, no cobra comisión) y tipo de cambio USD/ARS.
> Todas las cifras están en USD por mes salvo que se diga otra cosa.

---

## 1. Resumen ejecutivo

> **Corregido 2026-11-04.** Hasta acá este resumen daba márgenes de 91% a 99%: sólo restaba el costo técnico y US$5.850 de
> fijos, sin IVA, Ingresos Brutos, MercadoPago, Ganancias ni la publicidad que exige sostener 5.000 de pago. Las cifras de
> abajo son las realistas, sobre el mismo modelo que §13 a §15.

| Concepto | Valor |
|---|---|
| Costo técnico por usuario (LLM, voz, Composio, Graphity, servidores) | US$0,09 a 0,76 según el plan (~2,3% de lo cobrado) |
| **Costo total por usuario de pago, todo incluido** (5.000 de pago, US$30 promedio con IVA) | **~US$19,3 de cada US$30 (64,4%)** |
| de eso, al Estado (IVA a pagar, Ingresos Brutos, Ganancias) | US$9,78 |
| de eso, publicidad de mantenimiento (reponer bajas + crecer 2%) | US$6,15 |
| de eso, soporte, community manager y servidores | US$1,54 |
| de eso, MercadoPago y costo técnico | US$1,84 |
| **Queda a los socios por usuario** | **~US$10,7 (35,6%)** |
| Queda a los socios, plan Intensivo (US$50) | **US$20,9 por usuario · 41,9%** |
| Queda a los socios, plan Intermedio (US$35) | **US$13,5 por usuario · 38,5%** |
| Queda a los socios, plan Base (US$20) | **US$5,9 por usuario · 29,4%** |
| Con 5.000 de pago sostenidos, a los socios (después de Ganancias, antes del 7%) | ~US$53.424/mes · ~US$641 mil/año |
| Con el régimen de Economía del Conocimiento (Ganancias 14%) | ~US$848 mil/año |

Conclusiones:

1. **El costo técnico no es el costo:** ~US$0,70 por usuario. Lo caro es el Estado (US$9,78) y la publicidad (US$6,15).
2. **El plan Base deja 29,4% contra 41,9% del Intensivo:** conseguir un usuario de US$20 cuesta lo mismo que uno de US$50 (la publicidad es 30,8% de su precio). El precio promedio decide el negocio.
3. **La incertidumbre grande es el costo de conseguir cada usuario de pago**, no el de los modelos: lo mide el piloto de §13.5. El uso por plan lo mide la beta con el metering de tokens.
4. **Economía del Conocimiento es la palanca impositiva más grande** (§15): Ganancias baja de 35% a 14% mientras sea micro o pequeña.

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

> **Corregido 2026-11-04:** antes esta sección daba sólo el margen bruto técnico (98% a 99%). Ahora es todo incluido.

US$ por usuario y mes con 5.000 de pago (el mes de la meta). Técnico: LLM, voz, Composio, Graphity y su parte de servidores
(rango de §3; el cálculo usa el punto medio). Equipo y publicidad: soporte y community manager (US$1,44) y publicidad de
mantenimiento (US$6,15), repartidos parejo entre planes. IVA como saldo; Ingresos Brutos ~0,9% y MercadoPago ~5% de la
venta sin IVA; Ganancias 35% del beneficio.

| Plan | Precio (con IVA) | Técnico | IVA, IIBB y MP | Equipo y publicidad | Ganancias | Queda a los socios |
|---|---|---|---|---|---|---|
| Intensivo | US$50 | 0,42 a 0,76 | 9,59 | 7,59 | 11,28 | **20,95 · 41,9%** |
| Intermedio | US$35 | 0,19 a 0,36 | 6,41 | 7,59 | 7,25 | **13,47 · 38,5%** |
| Base | US$20 | 0,09 a 0,19 | 3,21 | 7,59 | 3,17 | **5,89 · 29,4%** |

### 4.1 Escenarios a 5.000 usuarios de pago (US$/mes)

| Escenario | Cobrado | Al Estado | Costos y publicidad | Queda a los socios | Margen para los socios |
|---|---|---|---|---|---|
| Todos Intensivos, caso típico | 250.000 | 94.005 | 51.250 | 104.746 | 41,9% |
| Todos Intensivos, LLM pesimista | 250.000 | 92.454 | 54.600 | 102.946 | 41,2% |
| Mezcla de ejemplo: 20% Intensivo, 40% Intermedio, 40% Base | 160.000 | 54.346 | 46.001 | 59.654 | 37,3% |
| Todos en Base, con uso de Base | 100.000 | 27.768 | 42.801 | 29.431 | 29,4% |
| Todos en Base, con uso Intensivo (peor caso) | 100.000 | 26.727 | 45.051 | 28.222 | 28,2% |

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

## 10. Resultado neto con equipo y marketing (agregado 2026-11-03, corregido 2026-11-04)

> **Corregido 2026-11-04.** La versión anterior sumaba tres fijos de ejemplo (equipo US$3.000, community manager US$850,
> publicidad US$2.000 = US$5.850) al margen bruto y daba 91% a 97% y US$1,1 a 2,9 millones por año. Le faltaban IVA,
> Ingresos Brutos, MercadoPago y Ganancias, y la publicidad real para sostener 5.000 de pago es ~15 veces la supuesta.

| Costo mensual con 5.000 de pago (US$) | Monto | Supuesto |
|---|---|---|
| Soporte técnico | 6.000 | 1 persona de 8 h (US$3.000, dato del operador) cada 2.500 de pago |
| Community manager | 1.200 | Freelance semi senior en Argentina; **inferencia**, no promedio verificado |
| Servidores y servicios | 520 | §12, con espejo |
| Publicidad de mantenimiento | 30.769 | Reponer el 6% de bajas y crecer 2%/mes, a ~US$98 por usuario de pago |
| **Total** | **38.489** | |

**Sensibilidad al costo por usuario de pago** (US$/año a los socios · margen sobre lo cobrado):

| Costo por usuario de pago | Publicidad/usuario/mes | Todos Intensivos | Mezcla de ejemplo | Todos en Base |
|---|---|---|---|---|
| Mitad del costo por usuario de pago | 3 | 1.356.123 · 45,2% | 815.016 · 42,4% | 452.344 · 37,7% |
| Base del modelo | 6 | 1.256.950 · 41,9% | 715.843 · 37,3% | 353.171 · 29,4% |
| Doble (curva pesimista) | 12 | 1.058.605 · 35,3% | 517.497 · 27,0% | 154.825 · 12,9% |

- **Supuesto más débil:** el costo de conseguir cada usuario de pago. Lo mide el piloto de §13.5.
- **Sin estimar todavía:** contador y sociedad, soporte humano ante incidentes fuera de lo que cubre el autohealing.
- Fuentes orientativas (blogs, no coinciden entre sí): [NovoAds](https://novoads.ai/es/blog/cuanto-cuesta-publicidad-en-meta) · [TopGrowth](https://topgrowthmarketing.com/instagram-ads-cost/) · [Coderhouse](https://www.coderhouse.com/ar/sueldos/sueldo-community-manager-argentina-2025) · [Aprender21](https://www.aprender21.com/blog/salario-community-manager).

### 10.1 Lo que queda a los socios por año (5.000 de pago sostenidos)

Después de Ganancias y antes del 7% del dividendo. Es el régimen sostenido en la meta, no el año 1 (el año a año está en §13.3 y §14.1).

| Escenario | A los socios/mes | Margen para los socios | A los socios/año |
|---|---|---|---|
| Todos Intensivos, caso típico | 104.746 | 41,9% | 1.256.950 |
| Todos Intensivos, LLM pesimista | 102.946 | 41,2% | 1.235.355 |
| Mezcla de ejemplo: 20% Intensivo, 40% Intermedio, 40% Base | 59.654 | 37,3% | 715.843 |
| Todos en Base, con uso de Base | 29.431 | 29,4% | 353.171 |
| Todos en Base, con uso Intensivo (peor caso) | 28.222 | 28,2% | 338.667 |

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
| Costo por usuario de pago | ~US$47 (~US$39 neto del IVA recuperado) | US$7 ÷ 15%; la publicidad trae IVA computable |
| Ingreso por usuario de pago | ~US$30/mes cobrado (IVA incluido); **~US$23,6 neto** | Promedio de planes US$20 / 35 / 50 (§4), menos IVA a pagar (cobrado − el de compras), MercadoPago ~5% e Ingresos Brutos ~0,9% |
| Margen bruto técnico | ~98% | §4: sólo el costo técnico; con todo incluido quedan ~36% a los socios (§1) |
| **Recuperación del costo de adquisición** | **~1,8 meses** | US$39 ÷ US$23,0 (neto menos variable) |

### 13.3 Simulación: usuarios de pago, aporte propio y llegada a 5.000

**Recalculado el 2026-11-03 con el IVA como saldo y Ganancias sobre el beneficio.** El precio al usuario es **US$30 con IVA 21% incluido** y MercadoPago cobra **~5%** (supuesto). Como Responsable Inscripto no se paga todo el IVA cobrado (débito): se le resta el IVA de lo que pagamos con factura (crédito) — publicidad, comisión de MercadoPago, IA/voz/Composio y servidores (supuesto: todo con IVA computable; el personal, monotributista, no da crédito). Si el crédito supera al débito, el saldo a favor pasa al mes siguiente. Ganancias es el 35% (supuesto) del **beneficio** —lo cobrado sin IVA menos todos los costos sin su IVA— y las pérdidas de los primeros meses se compensan contra los beneficios siguientes. Con eso la meta llega en el **mes 18** (contando el IVA entero como costo era el 22) y el acumulado al mes 24 es **~US$674.000** (antes ~US$345.000). En la meta, de US$26.033 de IVA cobrado se pagan US$19.113 por mes (12,7% de lo cobrado, no 17,4%).

El producto tiene sólo **prueba de 15 días** (versión completa, limitada en acciones) y planes pagos: se cuentan **sólo usuarios de pago**, y el costo de las pruebas que no convierten va dentro del costo de adquisición. *La prueba de 15 días no está en el código* (`apps/`, `motor/`, `deploy/`; 2026-11-03).

**Supuestos (no medidos):** arranque con 0 de pago · costo por usuario de pago US$49, que sube hasta el doble al acercarse a 5.000 · precio promedio US$30 con IVA · bajas 6%/mes · 30% orgánico · variable US$0,6 por usuario · servidores según §12 · personal por umbral (tabla abajo) · semilla de publicidad US$500/mes en los meses 1 a 3 · al llegar a 5.000 la publicidad pasa a **mantenimiento** (reponer bajas + 2% por mes) · el mes de llegada compra sólo lo que falta.

#### Comparación de esquemas de reinversión (con personal, escenario base, US$)

| Esquema | Llega a 5.000 | Aporte propio | Beneficio año 1 | Beneficio año 2 | Acumulado mes 24 | Acumulado mes 36 | Publicidad máxima/mes |
|---|---|---|---|---|---|---|---|
| 70% siempre | mes 21 | ~899 | ~13.000 | ~456.000 | ~468.000 | ~1.628.000 | ~70.000 |
| 100% × 6 meses, luego 70% | mes 19 | ~899 | ~19.000 | ~571.000 | ~590.000 | ~1.792.000 | ~63.000 |
| **100% × 8 meses, luego 70% (plan vigente)** | **mes 18** | ~899 | ~21.000 | ~653.000 | ~674.000 | ~1.897.000 | ~64.000 |
| 100% × 12 meses, luego 70% | mes 16 | ~899 | −~900 | ~819.000 | ~818.000 | ~2.084.000 | ~63.000 |
| 100% siempre | mes 15 | ~899 | −~900 | ~860.000 | ~859.000 | ~2.147.000 | ~88.000 |

Pesimista (US$100 por usuario de pago): 70% siempre llega en el mes 51, el plan en el 48 y 100% siempre en el 31; aporte propio ~US$1.371. Beneficio = neto − personal − servidores − publicidad, antes de Ganancias, contador y reserva.

#### Desarrollo del plan vigente: 100% × 8 meses, luego 70%, con personal (US$ por mes)

| Mes | De pago (inicio → fin) | Cobrado (con IVA) | IVA cobrado | IVA a pagar (débito − crédito) | Personal | Publicidad | Beneficio antes de Ganancias | Ganancias | Después de Ganancias | Acumulado | Hito |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 → 13 | 0 | 0 | 0 | 0 | 500 | -635 | 0 | -635 | -635 |  |
| 2 | 13 → 26 | 398 | 69 | 0 | 0 | 500 | -264 | 0 | -264 | -899 |  |
| 3 | 26 → 40 | 771 | 134 | 0 | 0 | 583 | 0 | 0 | 0 | -899 |  |
| 6 | 101 → 165 | 3.039 | 527 | 0 | 0 | 2.695 | 0 | 0 | 0 | -899 |  |
| 8 | 271 → 441 | 8.115 | 1.408 | 0 | 0 | 7.422 | 0 | 0 | 0 | -899 |  |
| 9 | 441 → 603 | 13.233 | 2.297 | 663 | 500 | 7.717 | 3.307 | 843 | 2.465 | 2.408 | entra CM medio tiempo · pasa a 70% |
| 10 | 603 → 816 | 18.083 | 3.138 | 1.082 | 500 | 10.540 | 4.517 | 1.581 | 2.936 | 6.925 |  |
| 12 | 1.097 → 1.426 | 32.910 | 5.712 | 2.178 | 2.350 | 18.143 | 7.776 | 2.721 | 5.054 | 20.898 | soporte media jornada · CM base |
| 14 | 1.840 → 2.344 | 55.188 | 9.578 | 3.432 | 2.350 | 31.697 | 13.584 | 4.755 | 8.830 | 44.847 |  |
| 16 | 2.943 → 3.610 | 88.296 | 15.324 | 5.564 | 4.200 | 50.491 | 21.639 | 7.574 | 14.065 | 84.041 | soporte jornada completa · CM completo |
| 17 | 3.610 → 4.358 | 108.295 | 18.795 | 6.686 | 4.200 | 62.610 | 26.833 | 9.391 | 17.441 | 110.873 |  |
| **18** | 4.358 → 5.000 | 130.736 | 22.690 | 10.145 | 4.200 | 63.743 | 43.138 | 15.098 | 28.040 | 154.012 | llega a 5.000 |
| 19 | 5.000 → 5.100 | 150.000 | 26.033 | 19.113 | 7.200 | 30.154 | 82.699 | 28.945 | 53.754 | 236.711 | 2.ª persona de soporte |
| 20 | 5.100 → 5.202 | 153.000 | 26.554 | 19.444 | 7.200 | 31.064 | 84.251 | 29.488 | 54.763 | 320.962 |  |
| 24 | 5.520 → 5.631 | 165.612 | 28.743 | 20.811 | 7.200 | 35.025 | 90.669 | 31.734 | 58.935 | 673.907 |  |
| 30 | 6.217 → 6.341 | 186.506 | 32.369 | 22.995 | 7.200 | 42.055 | 100.912 | 35.319 | 65.593 | 1.253.415 |  |
| 36 | 7.001 → 7.141 | 210.036 | 36.453 | 25.333 | 7.200 | 50.672 | 111.869 | 39.154 | 72.715 | 1.896.902 |  |

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
| tope de US$15.000/mes | nunca (se estanca) | 3.522 | 50.805 | 63.588 | ~1.171.000 |
| tope de US$30.000/mes | mes 27 | 5.975 | 77.047 | 95.699 | ~1.652.000 |
| sin tope, mantenimiento al llegar | mes 18 | 7.141 | 90.669 | 111.869 | ~1.897.000 |

Con 6% de bajas, 5.000 usuarios pierden ~300 por mes y reponerlos cuesta **~US$23.000 por mes**; un tope menor compra menos de lo que se pierde. Con 3% de bajas cuesta la mitad: **la palanca mayor son las bajas**, y se bajan con producto, no con publicidad.

**Lectura:**

- **Aporte propio ~US$899, sólo en los meses 1 a 3** (semilla de publicidad + fijos). Desde el mes 4 todo sale de lo que ingresa. A eso sumar la reserva de §13.4, que no se gasta.
- **La meta llega en el mes 18** (con el IVA entero como costo era el 22). El año 1 deja poco (~US$21.000 antes de Ganancias); el negocio deja plata en serio en el año 2 (~US$653.000).
- **Mientras se reinvierte el 100%, casi no se paga IVA:** el IVA de la publicidad cubre el IVA cobrado. El crédito fiscal financia más publicidad, y por eso la meta se adelanta.
- **Contrapunto al plan vigente:** con ingreso neto conviene estirar el 100%. **100% × 12 meses** llega en el mes 16 (2 antes) y acumula ~US$188.000 más al mes 36; lo que se resigna es el beneficio del año 1 (~US$21.000). 100% siempre llega en el mes 15 pero exige ~US$88.000 de publicidad en un mes. **Decisión del operador.**
- Costo por usuario de pago al inicio, neto del IVA recuperado: recuperación en ~1,8 meses.
- Lo que decide el plazo es el costo de conseguir cada usuario de pago, y eso sólo lo mide el piloto (§13.5).

```python
# Núcleo del modelo (cifras de arriba). ARPU_NETO = 30 / 1,21 * 0,95; K = 0,21 / 1,21; personal(p) según la tabla de personal.
# IVA a pagar = débito − crédito (el saldo a favor se arrastra); Ganancias 35% del beneficio con quebranto acumulado.
def sim(n100=8, despues=0.7, meses=24, tope_ads=None, post_crec=0.02):
    p = acc = 0.0; ll = None
    for m in range(1, meses + 1):
        fijo = servidores(p) + sum(personal(p))
        cac = 49 * (1 + p / 5000)
        # neto = p * ARPU_NETO - p * 0.6 - fijo + crédito usable; crédito = K * (MP + variable + servidores + publicidad)
        # el IVA de la propia publicidad también es crédito: punto fijo (más publicidad → más crédito → más publicidad)
        if ll is None:
            ads = max(max(0, neto * (1.0 if m <= n100 else despues)), 500 if m <= 3 else 0)
            if tope_ads: ads = min(ads, tope_ads)
            ads = min(ads, max(0, (5000 - p * 0.94) * cac / 1.3))   # el mes de llegada compra sólo lo que falta
        else:
            ads = min(max(0, neto) * 0.7, p * (0.06 + post_crec) / 1.3 * cac)   # mantenimiento
        lim = neto - ads; acc += lim; gan = 0.35 * max(0, lim - quebranto)
        p = p * 0.94 + ads / cac * 1.3
        if ll is None and p >= 4999.5: ll = m
```

### 13.4 Regla de reinversión

1. Reservar ~3 meses de costos fijos (~US$400 al inicio, ~US$1.500 al final).
2. Reinvertir **el 100% del neto los primeros 8 meses y el 70% después** (plan vigente de §13.3; el
   contrapunto de 12 meses está ahí), y pasar a presupuesto de mantenimiento al llegar a 5.000, mientras
   **cada usuario de pago deje al menos 3 veces lo que costó conseguirlo** (con 6% de bajas: recuperar su
   costo en **5,5 meses o menos**; hoy se estima ~1,7, neto del IVA de la publicidad).
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

**Cifras realistas, recalculadas el 2026-11-03 con el IVA como saldo:** el precio de US$30 **incluye IVA 21%**; como Responsable Inscripto se paga el IVA cobrado **menos** el de nuestras compras (MercadoPago ~5%, IA/voz/Composio, servidores y publicidad: supuesto, todo con IVA computable; el personal no da crédito). Arriba de 5.000 el IVA cobrado siempre supera al de las compras, así que ese crédito se recupera entero. Ganancias es el **35% del beneficio** (lo cobrado sin IVA menos todos los costos sin su IVA), no del ingreso. Comisión y alícuota son supuestos: confirmarlos con el contador. Así cada usuario de pago deja **~US$23,0 por mes** y con 6% de bajas su valor de vida es **~US$384**; el costo de conseguirlo se compara **neto del IVA de la publicidad** (21/121 menos). Arriba de 5.000: soporte 1 persona (US$3.000) cada 2.500 de pago, community manager US$1.200 (US$2.400 desde 10.000) y servidores US$520 cada 5.000. El costo por usuario de pago sube con la escala (doble a 5.000) y además al agotar el segmento de §14. Curva pesimista: se duplica cada 5.000 más.

Con cifras realistas, el techo lo pone el costo de conseguir usuarios: **~8.100 a 10.200 de pago**, que con 2% mensual se alcanzan entre los meses 44 y 56 (la meta de 5.000 llega en el mes 18). Ahí el negocio deja **~US$101.000 por mes después de Ganancias** en la curva base.

**Los tres umbrales** (usuarios de pago):

| Umbral | Curva base | Curva pesimista | Qué significa |
|---|---|---|---|
| **Tope recomendado: valor de vida = 3 × costo** | ~10.200 | ~8.100 | Estándar de SaaS sano; deja margen para errores de estimación |
| Máximo beneficio total | ~22.500 | ~9.900 | Más allá, cada usuario extra baja el beneficio total |
| **Antieconómico: valor de vida = costo** | ~35.700 | ~15.800 | Cada usuario nuevo cuesta más de lo que va a dejar |
| Techo de mercado (5% del segmento) | ~12.500 | ~12.500 | Más allá, otro país |

Entre el tope recomendado y el máximo hay una **zona gris**: cada usuario nuevo todavía suma, pero poco, y cualquier error en el costo por usuario la vuelve pérdida. Sólo se entra con el costo medido.

**Beneficio mensual sosteniendo cada tamaño** (curva base; la publicidad sólo repone bajas, US$):

| De pago | Costo por usuario (con IVA) | Valor de vida / costo neto | Publicidad | Beneficio antes de Ganancias | Después de Ganancias |
|---|---|---|---|---|---|
| 5.000 | 100 | 4,6 | 23.077 | 88.548 | 57.556 |
| 7.500 | 126 | 3,7 | 43.715 | 125.686 | 81.696 |
| 10.000 | 153 | 3,0 | 70.673 | 156.832 | 101.941 |
| 12.500 | 181 | 2,6 | 104.150 | 183.360 | 119.184 |

En la curva pesimista, 10.000 deja 137.362 y 12.500 **baja** a 130.317: crecer resta.

**Trayectoria con 2% mensual desde 5.000 (mes 18, §13.3) hasta el tope recomendado** (curva base, US$ por mes):

| Mes | De pago | Ingreso (con IVA) | Publicidad | Beneficio antes de Ganancias | Después de Ganancias |
|---|---|---|---|---|---|
| 19 | 5.000 | 150.000 | 30.769 | 82.190 | 53.424 |
| 30 | 6.217 | 186.506 | 43.127 | 96.596 | 62.787 |
| 36 | 7.001 | 210.036 | 52.132 | 107.233 | 69.701 |
| 42 | 7.884 | 236.535 | 63.260 | 115.396 | 75.007 |
| 50 | 9.238 | 277.138 | 82.366 | 130.803 | 85.022 |
| **56 (tope)** | **10.200** | 306.000 | 73.109 | 155.999 | **101.399** |

| Año | Después de Ganancias | Margen sobre lo que paga el cliente |
|---|---|---|
| 3 | ~761.000 | 34% |
| 4 | ~914.000 | 32% |
| 5 | ~1.130.000 | 32% |

Con la curva pesimista el tope llega antes (8.100, mes 44) y ahí deja ~US$81.000 por mes después de Ganancias.

**Lectura:**

- **El techo lo pone el costo de conseguir usuarios: ~8.100 a 10.200 de pago**, cerca del techo de mercado (~12.500). La meta de 5.000 llega en el mes 18 (§13.3) y con 2% mensual el tope en los meses 44 a 56.
- **El IVA recuperado sube el tope:** la publicidad cuesta 21/121 menos de lo que se paga, así que cada usuario rinde más veces su costo. Antes, contando el IVA entero como costo, el tope era ~6.800 a 7.700.
- **La palanca son las bajas.** Con 3% en vez de 6%, el tope recomendado sube a ~13.000 a 23.700 (el mercado lo corta en ~12.500): valor de vida doble con la misma publicidad.
- Supuestos no medidos: costo por usuario de pago, su curva con la escala, bajas, comisión de MercadoPago, IVA computable de los proveedores del exterior y alícuota efectiva. El piloto de §13.5 mide el primero; las bajas, la beta; lo impositivo, el contador.

<!-- SOCIOS:INI -->
### 14.2 Cuánto cobra cada socio (agregado 2026-11-03)

#### Arranque: cuánto ponemos y cuándo cobramos

Ponen ~US$899 entre los dos (US$450 cada uno), sólo en los meses 1 y 2. Del mes 3 al 8 el negocio se paga solo y todo lo que deja va a publicidad: no ponen ni sacan. En el mes 9 empiezan a cobrar (~US$1.381 cada uno) y ese mismo mes ya recuperaron lo puesto.

- **Ponen:** ~US$899 entre los dos (US$450 cada uno), en los meses 1 y 2: US$270 de servidores y US$1.000 de publicidad semilla, menos US$398 de los primeros cobros.
- **Dejan de poner:** desde el mes 3. Hasta el mes 8 todo lo que deja el negocio va a publicidad.
- **Empiezan a cobrar:** en el mes 9 (~US$1.381 por socio); mes 12 ~US$3.110; mes 17 más de US$10 mil. Lo puesto se recupera en el mes 9.

| Mes | Usuarios de pago (inicio → fin) | Cobrado (con IVA) | IVA a pagar | Servidores | Soporte y community manager | Publicidad | Resultado del mes | Pone cada socio | Cobra cada socio | Estado |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 → 13 | US$0 | US$0 | US$135 | US$0 | US$500 | −US$635 | US$318 | — | ponen |
| 2 | 13 → 26 | US$398 | US$0 | US$135 | US$0 | US$500 | −US$264 | US$132 | — | ponen |
| 3 | 26 → 40 | US$771 | US$0 | US$135 | US$0 | US$583 | US$0 | — | — | todo a publicidad |
| 4 | 40 → 63 | US$1.186 | US$0 | US$135 | US$0 | US$970 | US$0 | — | — | todo a publicidad |
| 5 | 63 → 101 | US$1.881 | US$0 | US$135 | US$0 | US$1.617 | US$0 | — | — | todo a publicidad |
| 6 | 101 → 165 | US$3.039 | US$0 | US$135 | US$0 | US$2.695 | US$0 | — | — | todo a publicidad |
| 7 | 165 → 271 | US$4.959 | US$0 | US$135 | US$0 | US$4.483 | US$0 | — | — | todo a publicidad |
| 8 | 271 → 441 | US$8.115 | US$0 | US$135 | US$0 | US$7.422 | US$0 | — | — | todo a publicidad |
| 9 | 441 → 603 | US$13.233 | US$663 | US$135 | US$500 | US$7.717 | US$3.307 | — | US$1.381 | cobran |
| 10 | 603 → 816 | US$18.083 | US$1.082 | US$200 | US$500 | US$10.540 | US$4.517 | — | US$1.806 | cobran |
| 11 | 816 → 1.097 | US$24.485 | US$1.445 | US$200 | US$500 | US$14.460 | US$6.197 | — | US$2.478 | cobran |
| 12 | 1.097 → 1.426 | US$32.910 | US$2.178 | US$200 | US$2.350 | US$18.143 | US$7.776 | — | US$3.110 | cobran |

| Costo de conseguir un usuario de pago | Ponen entre los dos | Último mes que ponen | Primer mes que cobran | Llegan a 5.000 |
|---|---|---|---|---|
| la mitad (US$25) | US$635 | mes 1 | mes 8 | mes 8 |
| el previsto (US$49) | US$899 | mes 2 | mes 9 | mes 18 |
| ×1,5 (US$74) | US$1.179 | mes 3 | mes 9 | mes 30 |
| el doble (US$98) | US$1.360 | mes 3 | mes 9 | mes 46 |

Resultado del mes antes de Ganancias; lo que cobra cada socio, después de Ganancias (14%, con quebranto) y del 7%. Hasta el mes 8 el 100% del neto va a publicidad, desde el 9 el 70%. Una publicidad más cara casi no cambia lo que se pone: atrasa la llegada a la meta.

#### Mes a mes

Hasta el mes 8 todo el neto va a publicidad. Cada socio pasa los **US$10 mil por mes en el mes 17**, cobra ~US$32.868 por mes al llegar a la meta (mes 19) y junta **US$1 M sin vender en el mes 44** (vendiendo, en el mes 22).

| Mes | Neto por socio en el mes | Acumulado por socio | Hito |
|---|---|---|---|
| 8 | US$0 | −US$450 | último mes con 100% del neto a publicidad; el acumulado negativo es el aporte propio del arranque |
| 9 | US$1.381 | US$931 |  |
| 12 | US$3.110 | US$8.326 |  |
| 15 | US$7.020 | US$24.923 |  |
| 17 | US$10.731 | US$44.307 | pasa US$10 mil por mes |
| 18 | US$17.251 | US$61.558 |  |
| 19 | US$32.868 | US$94.425 | primer mes completo en la meta: la publicidad baja a mantenimiento |
| 22 | US$33.351 | US$192.608 | vendiendo acá, ~US$1 M por socio |
| 24 | US$34.625 | US$261.218 |  |
| 30 | US$38.629 | US$482.854 |  |
| 36 | US$42.882 | US$729.400 |  |
| 44 | US$36.031 | US$1.004.372 | US$1 M acumulado sin vender |
| 48 | US$38.362 | US$1.154.313 |  |
| 60 | US$47.151 | US$1.679.686 |  |

Neto después de Ganancias (14% con el régimen mientras rige, 35% después, con quebranto) y del 7% del dividendo; dos socios en partes iguales. La baja del mes 37 es el vencimiento del régimen. Venta en el mes 22: ~US$2,14 M a 4,5× el beneficio de 12 meses, 15% cedular; un comprador con 4 meses de historia en la meta puede pagar menos. Sin expansión internacional.
<!-- SOCIOS:FIN -->

## 15. Impuestos: régimen de Economía del Conocimiento (agregado 2026-11-04)

**Inscribirse en el régimen de la Ley 27.506 (modificada por la 27.570) baja Ganancias de 35% a 14%** mientras la empresa sea micro o pequeña, y a 21% como mediana. Hasta el bolsillo de los socios la carga pasa de 39,6% (35% + 7% del dividendo) a 20,0%. En los 3 años que rige son **~US$356k más**, sin salir de Argentina; si se prorroga más allá de 2029, ~US$857k en 5 años. Rinde más que operar desde Estonia mientras los socios vivan acá (el art. 130 de Ganancias atribuye igual el beneficio a los socios argentinos).

**La categoría la dan las ventas, no los empleados:** promedio de los ejercicios cerrados (hasta tres) sin IVA contra los topes de servicios de la Res. 1/2026 (micro $374M, pequeña $2.255M, mediana tramo 1 $18.665M), con el dólar a $1.550 (supuesto). Año 1 = 2027 (supuesto).

| Año | Ventas sin IVA ($M) | Promedio de ejercicios cerrados ($M) | Categoría | Ganancias | Hoy (35% + 7%) | Con el régimen | Diferencia |
|---|---|---|---|---|---|---|---|
| 1 (2027) | 140 | 140 | Micro | 14% | 12.570 | 16.651 | +4.081 |
| 2 (2028) | 1.847 | 140 | Micro | 14% | 382.279 | 505.784 | +123.505 |
| 3 (2029) | 2.902 | 993 | Pequeña | 14% | 707.718 | 936.365 | +228.647 |
| 4 (2030) | 3.681 | 1.630 | Pequeña | 35% (vencido) | 849.826 | 849.826 | +0 |
| 5 (2031) | 4.547 | 2.810 | Mediana tramo 1 | 35% (vencido) | 1.050.746 | 1.050.746 | +0 |

US$ por año al bolsillo de los socios, sobre la misma serie mensual de §13.3 y §14.1 (control: sin el 7% reproduce los años 3 a 5 de §14.1). Se tomó la alícuota de 35%; con la escala 25/30/35 el resultado es algo mejor. Si el peso se devalúa más rápido de lo que se actualizan los topes, el salto a mediana llega antes.

**Requisitos:**

- **70% de la facturación** en actividades promovidas: un SaaS es software. Se puede inscribir antes de facturar acreditando la actividad.
- **Microempresa de menos de 3 años:** no acredita requisitos extra por 4 años o hasta dejar de ser micro (acá, el año 2).
- **Desde entonces, 2 de 3:** calidad (mejora continua o certificación tipo ISO 9001) · I+D de 2% de la facturación (la capacitación no sirve sin empleados) · exportaciones de 10% de la facturación.
- **Vender afuera ayuda dos veces:** cumple la condición de exportaciones y libera de retenciones y percepciones de IVA.
- **Inscribirse temprano:** rige hasta el 31/12/2029; cada año fuera es uno perdido.

**Ingresos Brutos:** ~0,9% de la venta sin IVA, ya restado en todo el reporte. Por el Convenio Multilateral la base se reparte mitad por dónde están los clientes y mitad por dónde están los gastos; la parte de Santa Fe queda exenta con el régimen (Ley 14.025, art. 54, con inscripción en el Registro Provincial ante API). Buenos Aires exime 100% a la micro y 80% a la pyme (Ley 15.339), Córdoba exime la producción de software y CABA rebaja la alícuota 50% a 75% (Ley 6.394): cada beneficio se tramita aparte en cada provincia. Sin DReI: es una tasa y sin local en Rosario no hay servicio que retribuir. Sin verificar: las alícuotas del resto del país y si la publicidad pagada al exterior cuenta como gasto en otra provincia. Fuentes: [Ley 14.025 Santa Fe](https://www.santafe.gob.ar/boletinoficial/ver.php?seccion=2021%2F2021-01-21ley14025-2021.html) · [ARBA](https://www.arba.gov.ar/GuiaTramites/TramiteSeleccionado.asp?tramite=771&categ=34) · [Rentas Córdoba](https://www.rentascordoba.gob.ar/cms/exencion-iibb-produccion-de-software/) · [Ley 6.394 CABA](https://boletinoficial.buenosaires.gob.ar/normativaba/norma/539036).

**Sin verificar:** los porcentajes salen de consultoras (otras fuentes dan 15% fijo o 50% para micro): confirmar en el texto de las leyes 27.506 y 27.570 · si el desarrollo subcontratado cuenta como I+D · la tasa de control del régimen (hasta 4%; 0% hasta 2025) · el costo de una certificación de calidad (fuera del modelo) · el bono fiscal (70% de contribuciones patronales) no aplica sin empleados.

Fuentes: [Contablix, Economía del Conocimiento 2026](https://contablix.ar/blog/economia-del-conocimiento-argentina-2026) · [Beccar Varela](https://beccarvarela.com/novedades/regimen-de-promocion-de-la-economia-del-conocimiento/) · [topes MiPyME 2026](https://siap.blogdelcontador.com.ar/novedades/nuevos-topes-mipyme-2026-ventas-empleados-y-activos/) · [argentina.gob.ar, parámetros MiPyME](https://www.argentina.gob.ar/noticias/nuevos-parametros-para-categorizacion-de-mipymes-0). Lo impositivo lo confirma el contador.
