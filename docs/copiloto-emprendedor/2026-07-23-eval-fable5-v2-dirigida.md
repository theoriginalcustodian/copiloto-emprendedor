# Informe — 2ª pasada dirigida (zero-context) sobre el mapa de clases C1..C9 + D-A..D-E

**Base de verificación:** `origin/main` avanzó de `086becde` a `a471d66` durante la auditoría; el único diff es `apps/copiloto/tool_catalog.py` (fix "narra", fuera de scope). Todo lo que sigue se verificó con `git show`/`git grep` contra **`086becde`**, el mismo commit del mapa. Ninguna afirmación de este informe proviene del documento de entrada sin releer el código.

---

## C1 — Postgres sin pool / N+1

**Veredicto general: CONFIRMADA, con el conteo levemente inflado.**

| Instancia del mapa | Veredicto | Evidencia |
|---|---|---|
| "86 call-sites / 20 archivos" | **Afinada** | Mi control reproducible: `git grep "conn_factory()"` (excluyendo tests/conftest y las `def`) da **84 sitios / 18 archivos**. Mismo orden de magnitud; el 86/20 no lo pude reproducir con ningún patrón razonable. Densidades del mapa exactas: `cobro_store` 11, `afip_credential_store` 11, `inteligencia_queries` 8 ✓ |
| `inteligencia_queries.py:178 portada()` abre 2 | **Confirmada** | El bloque `with self._conn_factory()` cubre `_suma/_facturado/_serie_mensual/_mejores_clientes`, pero `self.por_cobrar()` se llama **fuera** y construye `CobroStore(...).impagos()` → 2ª conexión. Matiz: "UNA conexión" es el comentario de sección (`# ── la portada: arma el §3.1 con UNA conexión`), no el docstring — la esencia (instrumento que confirma) se sostiene. |
| `context_factory.py` → `first_seller_user_id()` por cada `dispatch_intent` | **Confirmada** | `make_context_factory` arma un `TenantCtx` NUEVO por llamada y ejecuta `cred_store.first_seller_user_id()` (query con conexión propia) incondicionalmente — aun para tools que no tocan MercadoPago. |
| `cliente_store.derivar_clientes()` N+1 | **Confirmada** | 1 conexión para los dos SELECT + por cada presupuesto: `_asegurar_derivado→crear()` (1) + UPDATE de vínculo (1) = 2P; por cada comprobante: 1. El `≥1+2P+C` del mapa es exacto. Es un backfill, no path caliente — severidad "offline" correcta. |
| `trabajo_store.imputar()` = doble-open como `margen()` | **Confirmada** | `imputar` llama `self.resolver()` (conexión 1, `trabajo_store.py:74`) y luego abre la suya (`:183`). Igual que `margen` (`:135` + `:137`). Condicional a `eslabon is not None`. |

**Instancias NUEVAS:**
1. **`GET /reply` + `reply_store` — el amplificador que el mapa no rankeó.** El front mobile pollea `/reply` cada **1.5 s** mientras espera (`useChat.ts:63 POLL_INTERVAL_MS = 1500`, y 10 s en modo lento **que nunca se abandona** — el comentario lo dice: "nunca se abandona"). Cada poll = `read_replies` = conexión nueva (`reply_store.py:36`). Con U usuarios con la app abierta, esto solo genera ~U×0.66 conexiones/s **permanentes** — probablemente domina el churn total por encima de cualquier endpoint de negocio.
2. **Conexiones que nunca se cierran ni entran a un `with`:** `mp_dedup_store.py:20,31` y `reply_store.py:23,36` hacen `conn = self._conn_factory()` a secas — ni `close()` ni `with`. Hoy las salva el GC; con un pool ingenuo serían el leak que lo agota (ver juicio del fix).

**Juicio del fix raíz (pool en las 2 raíces):** las raíces están bien identificadas (`serve.py:94-105` y el closure de `worker_b.py:239-241`, ambas "una conexión por invocación, autocommit"). Pero **"sin tocar los 84 sitios" es optimista** por dos efectos de borde reales:
- psycopg2 no tiene hook de "devolver al pool" en el `__exit__` de `with conn` (solo commit/rollback). Un wrapper con `__exit__` que devuelva al pool funciona para los sitios `with ... as conn`, pero los **4-5 sitios bare** (`mp_dedup_store`, `reply_store`) nunca ejecutan `__exit__` → drenarían el pool hasta el deadlock. Hay que normalizarlos primero (enumerables, chico).
- `serve.py` corre los stores vía `asyncio.to_thread` → el pool debe ser `ThreadedConnectionPool`, no `SimpleConnectionPool`.

**Alternativa más simple que el mapa no consideró (lente lateral):** **PgBouncer en transaction/session pooling delante de fusion**. Con conexiones autocommit y sin estado de sesión, es compatible, resuelve el techo de `max_connections` **con cero cambio de código** y abarata también el costo del connect por request. No elimina el N+1 lógico (portada, context_factory) pero colapsa el riesgo de escala #1 a un cambio de infra idempotente. Merece estar en la DECISION_MATRIX antes de escribir un pool propio.

---

## C2 — Writes externos no idempotentes / C3 — writes fuera de Temporal

**Veredicto general: CONFIRMADAS, con un matiz grande sobre cuál es "el modo default".**

| Instancia | Veredicto | Evidencia |
|---|---|---|
| `dispatch_intent` no transporta `idem_key` | **Confirmada** | `conversation_workflow.py:271-275`: payload = `{domain, intent, state, conv}`. Nada por dónde conectar dedup. |
| `mp_charge` en modo dispatch sin dedup | **Confirmada y agravada** | `dispatcher_emprendedor.py` (~línea 100): `ext_ref = f"copiloto-{secrets.token_hex(4)}"` — **un token aleatorio nuevo por ejecución**. Un retry at-least-once no solo no deduplica: genera un link con `external_reference` distinto, imposible de reconciliar después vía webhook. |
| `execute_tool` recibe `idem_key` pero `_execute_proposal` no lo propaga | **Confirmada, con matiz** | `tool_catalog.py:406`: firma `(gateway, comp_uid, out)`, y `gateway.execute` ni siquiera **acepta** parámetro de idempotencia (`composio_gateway.py:111`). Propagar la key no serviría de nada sin la tabla app-side — el fix propuesto es la única forma. |
| Solo MP (react) tiene dedup, con TOCTOU | **Confirmada** | `mp_dedup_store.py`: SELECT-then-INSERT `ON CONFLICT DO NOTHING`. La ventana existe pero requiere ejecución **concurrente** del mismo activity (timeout+retry con el original vivo — exactamente el escenario que D-B habilita; las clases se refuerzan). |
| Inventario: gmail/docs/drive/sheets/calendar ❌, AFIP ✅ | **Confirmado por muestreo** | Drive verificado a fondo: `afip_drive.py` — la **carpeta** es idempotente por construcción, el **upload del PDF no** (sin pre-check por nombre ni clave): retry = PDF duplicado en el Drive del usuario. Calendar (`_run_calendar_book`) ejecuta el write directo. AFIP con `idem_key` + índice parcial ✓ (`afip_indexes.sql:37`). |
| `presupuesto_doc` descarta el `motivo`; `registrar_en_sheet` sin log | **Afinada** | El `motivo` **sí viaja** en `como_dict()` hasta `presupuestos_web.py:240` — donde muere sin leerse: si `doc_id` es falsy, no se loguea ni persiste nada. Hay un `_log.warning` para excepciones (`:247`) que casi nunca dispara porque `generar_doc` y `registrar_en_sheet` se las comen antes (`presupuesto_doc.py:117`, `:152`). Esencia confirmada: fallo invisible. |
| C3: `_generar_doc_y_fila` fuera de Temporal | **Confirmada** | `serve.py:172`: corre en threadpool **dentro del request** `POST /presupuestos`, best-effort, sin retry ni DLQ ni marca `doc_pendiente`. Doble problema: C3 (efecto perdido en silencio) y latencia (2 HTTP sync a Google en el path de crear presupuesto). |

**Sobre el `[REQUIRES_LIVE_VALIDATION]` (qué modo corre en prod) — lo delimité, no lo cerré:** `web.py:84` → `COPILOTO_ENGINE_MODE` default `"dispatch"` (el front-door decide por conversación); `worker_b.py:181` registra el dominio con `engine_mode="react"` **horneado**, y el comentario en `:169-171` declara como deuda gestionada que el rollback a dispatch está DEGRADADO. La memoria del proyecto dice "react VIVO". **Evidencia que falta para cerrarlo:** `systemctl show uc-copiloto-web --property=Environment | grep ENGINE_MODE` en el VPS (o el `.env` del servicio). Si prod corre react, la raíz "el default no transporta idem_key" describe el **camino de rollback**, no el vivo — y la prioridad de C2 baja un escalón (queda: executor react sin tabla de dedup genérica para Composio, que sigue siendo real).

**Juicio del fix raíz (tabla de dedup genérica claim-first):** la forma es correcta y es la única viable (Composio no expone idempotency key; el spike C ya probó que MP tampoco deduplica). Le falta **un caso que rompe**: claim-first deja huérfanos — si el proceso muere entre el claim y el `save` del resultado, el retry encuentra el claim sin resultado y tiene que decidir re-ejecutar (posible duplicado) o fallar (efecto perdido). La tabla necesita estado (`claimed/done`) + política por tipo de write (re-ejecutable: sheets append no; docs create sí con motor de búsqueda previa; MP: consultar por `external_reference` — que exige que el ext_ref sea **derivado del idem_key, no aleatorio**). Sin esa política explícita, el fix reintroduce el mismo problema una capa más abajo.

---

## C4 — Superficie sin barrera

**Veredicto: CONFIRMADA en su núcleo; el conteo fino no lo reproduje exacto.**

- Los **3 huecos confirmados**: `/auth/signup`, `/auth/login`, `/auth/refresh` viven bajo el comentario explícito `# --- SIN auth (spec §5.3) ---` (web.py:653+). Y lo agravo: el docstring de signup dice "Admin-mediado (disable_signup:true en fusion)" pero el endpoint es **público** y `signup_and_provision` (`onboarding.py:215`) usa la **admin API** de GoTrue — es decir, `disable_signup` de GoTrue no protege nada: cualquiera con `curl` crea user + tenant + claim facturable. El "admin-mediado" del docstring es un instrumento que confirma en vez de verificar.
- **Rate-limit = 0**: cero hits de `slowapi|limiter|rate` en app y en `deploy/copiloto` ✓. La config viva de Caddy en el VPS queda `[REQUIRES_LIVE_VALIDATION]` (el snippet del repo no tiene rate-limit; si alguien lo agregó a mano en el VPS, no está versionado — lo cual sería su propio hallazgo de drift).
- Conteo "71 endpoints / 68 con guard": conté **76 decoradores de ruta** (algunos son variantes alternativas del mismo path, ej. dos `@app.get("/me")` en ramas if/else, así que el neto puede dar ~71). No verifiqué los 68 uno por uno; en los spot-checks (afip_web, presupuestos_web, gastos_web, web) **no encontré ningún contraejemplo** — todos con `Depends(require_tenant)`. `/mp/webhook` valida `x-signature` con el SDK oficial ✓; `oauth/ensure-tenant` exige `require_claims` + provider OAuth externo ✓.

**Instancia NUEVA (matiz):** el proxy `/auth/login` hace el password-grant **server-side** — GoTrue ve todo el tráfico viniendo de localhost, así que cualquier rate-limit por IP que GoTrue tenga queda **ciego** (una sola IP). El proxy no reenvía `X-Forwarded-For`. O sea: no solo no hay rate-limit propio; el diseño neutraliza el del upstream.

**Juicio del fix raíz:** invite-token de env (fail-closed) o deshabilitar signup password dejando OAuth: correcto, barato, sin deuda. **Ojo con "rate-limit en Caddy"**: el módulo de rate-limit **no viene en el build estándar de Caddy** (es plugin `caddy-ratelimit`, exige recompilar con xcaddy) — eso es fricción real de deploy. Alternativa más simple: `slowapi` sobre los 3 endpoints `/auth/*` (una dependencia, ~10 líneas) o fail2ban sobre el access-log que ya emite Caddy.

---

## C5 — Acoplamiento por string derivado

**Veredicto: instancias CONFIRMADAS; el "agujero de test" REFUTADO en su magnitud.**

- Los **5 sitios exactos** confirmados: `web.py:206`, `presupuesto_store.py:79` y `:107` (SQL de `_DERIVADOS`), `trabajo_store.py:102` (SQL) y `:116` (f-string inversa). No encontré un 6º en `apps/copiloto` (los hits restantes son docstrings y fixtures de test).
- Raíz confirmada: `afip_comprobante_store.crear` solo persiste `workflow_id` (+ `idem_key` que es un uuid por gesto, no un enlace); no hay columna FK.
- **"Solo 1 de 5 atada por test" — REFUTADO.** `test_presupuesto_derivados.py:31` ata `workflow_id_de_factura` ↔ `web._wf_id_factura`; **`:39` ata el literal SQL de `presupuesto_store:107`** (`assert "'factura-' || p.cliente_id..." in sql`); `test_afip_web_facturas.py:109` ata el formato canónico. Además `test_imputacion_y_margen.py:67` y `test_inteligencia_queries.py:350` insertan fixtures con el mismo formato y ejercitan los cruces de `trabajo_store` — un drift de formato los rompería ruidosamente. Cobertura real: **3 amarres directos + 2 indirectos sobre 5 sitios**, no 1/5. El riesgo residual es mucho menor del que el mapa pinta.

**Juicio del fix raíz (FK real):** técnicamente correcto, pero **contradice una decisión declarada del propio repo**: el docstring de `cliente_store.resumen_operaciones` dice explícitamente que a `afip_comprobantes` "no se le agrega [cliente_ref]: es una tabla viva y probada, y §5 dice que no se refactoriza". Agregar `factura_id`/`comprobante_id` es migración sobre tabla productiva + revierte esa decisión → **es MAYOR, no táctica**: hay que escalarla, no bajarla como `contrato_` mecánico. Dado que la cobertura de test es mejor de lo estimado y el formato incluye el `cliente_id` autenticado **como feature de seguridad** (el prefijo sale del token, nunca del request — eso hay que preservarlo con o sin FK), la alternativa barata "constante única + amarres de test para los 2 sitios SQL restantes" es defendible como estado final, no solo como parche.

---

## C6 — Crecimiento sin cota (front) / C7 — externa sin cache

**Veredicto: CONFIRMADAS (9/9 + los 4 listados), con paths corregidos.**

- `chatMachine.ts` vive en **`packages/core/src/chat/`** (no en `apps/copiloto-web/src/chat/` como cita el mapa — para el prompt v2 dirigido esto importa). Reducer sin cota confirmado: `messages: [...estado.messages, evento.mensaje]` y `[...estado.messages, ...additions]`; **`seenIds` también crece sin cota** (instancia hermana que el mapa no nombró — el cap `slice(-N)` tiene que podarlo en sincronía o el dedup se rompe).
- `useChat.ts` (mobile): `persistirMensajes(...JSON.stringify(messages))` con el array completo en cada poll con novedades ✓ (O(N) por evento).
- `ListaMensajes.tsx:171`: `messages.map(...)` dentro de `ScrollView` de RNGH ✓ sin virtualizar.
- Las 4 pantallas de listado confirmadas línea por línea: `PantallaClientes.tsx:311`, `PantallaGastos.tsx:199`, `PantallaIngresos.tsx:175`, `PantallaPresupuestos.tsx:229` — todas `.map` en `ScrollFormulario` (que envuelve `ScrollView`, `ScrollFormulario.tsx:27`). Control negativo confirmado: `ListaActividad.tsx:167` usa `FlatList`. **Matiz a favor del backend:** los endpoints de listado tienen `LIMITE_LISTADO_DEFAULT`/`MAX` (`presupuestos_web.py:260`), así que la cota del server acota el daño del `.map` — la severidad real de esas 4 es menor que la del chat, que no tiene cota en ningún lado.
- `EscritorioFunciones.tsx:267`: `onScroll={(e) => setDesplazado(e.nativeEvent.contentOffset.x)}` con `scrollEventThrottle={16}` ✓ — y el comentario del código cree que 16 ms evita "re-renderizar el grid entero en cada frame", que es exactamente lo que no evita (guarda el píxel, no un booleano). Instrumento que confirma.
- C7: `web.py:520/528` (los dos variantes de `/me`), `:559` (`/catalog`), `afip_web.py:169` (`/afip/estado` vía `connection_status`) ✓, sin TTL ni cache en el gateway (0 hits de `ttl|cache|lru`). El 4º call-site `web.py:629` — **`[ASSUMED_PENDING_VERIFY]` RESUELTO: es `composio_disconnect`**, path frío accionado por el usuario; no necesita cache (al contrario: es uno de los puntos que deben **invalidarla**).
- **"pagina 2×" en `/afip/estado` — no lo pude confirmar**: `connection_status` → `list_connections` es **una** paginación completa por llamada. Lo caro real es otro: pagina el inventario **entero** de conexiones del tenant para responder el estado de **un** toolkit.

**Juicio del fix raíz:** el paquete (cap `slice(-N)` + booleano en onScroll + variante virtualizada de `ScrollFormulario` + TTL-cache per-tenant) es correcto y proporcionado. Dos bordes a nombrar: (1) el cap del chat debe podar `messages` y `seenIds` **juntos**; (2) la invalidación del TTL-cache por connect/disconnect no cubre el flip asíncrono a `ACTIVE` que ocurre del lado de Composio tras el OAuth (ningún endpoint propio se entera) → el TTL tiene que ser corto (30-60 s) o el estado "conectá tu cuenta" queda pegado justo después de que el usuario conectó — el peor momento para mentirle.

---

## C8 — Firma que promete y no cumple

**CONFIRMADA tal cual.** `web.py:310-314`: `signal_anulacion(cliente_id, anulacion_id, nombre, payload)` → `await handle.signal(nombre)` — el `payload` muere en la firma. Gemela sana `signal_factura` (`:272-277`) con el patrón condicional correcto. Repliqué el barrido en `afip_web.py` y `presupuestos_web.py`: sin casos nuevos. Fix = copiar la línea de la gemela; trivial, sin bordes.

---

## C9 — Secretos/PII en el árbol

**Veredicto: CONFIRMADA contra `origin/main`, PARCIALMENTE MITIGADA en el working tree, y con una instancia nueva.**

- En `origin/main:.gitignore` **no existen** reglas para `Factura/`, `_evidencia/`, `code/` ✓ (control: grep exit 1).
- **Pero el working tree ya tiene el fix sin commitear**: el `.gitignore` local (aparece `M` en git status) agrega las 3 reglas en líneas 46-48 y `git check-ignore` las matchea. Alguien ejecutó la "acción YA" del mapa — falta **aterrizarla en un commit** o se pierde/queda invisible para las otras 2 sesiones.
- **Instancia NUEVA:** en la raíz del checkout compartido hay **`tok.json`** (el nombre grita token — no lo abrí) y `gastos_antes.json`, ambos untracked y **NO ignorados** (`git check-ignore` exit 1). Mismo riesgo exacto que motivó C9: un `git add -A` de cualquiera de las 3 sesiones los commitea. También `.claude/` está untracked sin regla (puede contener settings locales con rutas/keys).

---

## Dimensiones D-A..D-E

**D-A (errores tragados) — CONFIRMADA y es más grande que 4 sitios.**
Los 4 del mapa verificados: `tool_catalog.py:~1131` (catch-all del executor, deliberado por PR #114 — lo que falta es el **log**, no sacar el catch), `inteligencia_chat.py:144/168` (todo fallo = "no tengo ese dato", sin rastro), `services/__init__.py:26` (`except: continue` — un módulo de servicio roto desaparece del catálogo sin log: el tenant pierde gmail entero y nadie se entera), `mercadopago_gateway.py:119` (path real: `motor/clients/agent/providers/`; firma inválida de atacante y bug interno del SDK colapsan en el mismo `False` mudo). **Nuevas de alto impacto:** `web.py` `consultar_factura`/`consultar_anulacion` — `except Exception → None → 404`: **una caída de Temporal se presenta al usuario como "la factura no existe"**, el peor disfraz posible para un outage; `presupuestos_web._cuit_del_tenant` (`except → None → 409`). Censo total: **42 `except Exception`** en `apps/copiloto` (sin tests) con solo 3 archivos que usan logging — la clase es sistémica, el mapa eligió bien sus ejemplares pero subdeclaró la superficie.

**D-B (timeouts) — CONFIRMADA.** `Composio()` sin timeout (`composio_gateway.py:94`, lazy en `_default_client_factory`); comparativa verificada: MP usa `httpx.Client(timeout=30)` ✓, AFIP documenta que el timeout lo pone el activity ✓ — "único de 3" exacto. El escenario fuga-de-threads bajo `asyncio.to_thread` cuando el activity da timeout a los 120 s es correcto (el thread bloqueado no es cancelable). Si el SDK de Composio tiene default interno de timeout queda `[ASSUMED_PENDING_VERIFY]` — evidencia: leer el default de `Composio()` en la versión pinneada de `requirements.txt`.

**D-C (validación de input) — CONFIRMADA como resuelta.** `Decimal(str())` en ≥10 archivos, validación a mano con 400 y motivo. De acuerdo con el 🟢.

**D-D (datetime) — CONFIRMADA.** `_parse_iso` con normalización naive→UTC en `graphity_memory_client.py:213-228`, documentando la causa (el copiloto persiste `reference_time` naive). El residuo señalado (cada lector nuevo repite la normalización) es real pero frío.

**D-E (logging/fingerprint) — CONFIRMADA al pie de la letra.** 0 hits de `fingerprint|structlog|dlq|trauma` en `apps/copiloto` + `motor`. Los `print()` de status verificados en las 5 líneas exactas. `agent_activities.py:~89` imprime `STT_TRANSCRIPT` con el texto **completo** del dictado a stdout, sin gate — con el comentario admitiendo el riesgo de PHI al lado. Matiz de literalidad: hay `logging` stdlib en 3 archivos y `activity.logger` en el motor, así que "gap TOTAL" es 95% cierto, no 100% — pero cero estructura, cero fingerprint, cero correlación por tenant: a 1000× usuarios este es el multiplicador de costo de TODOS los demás incidentes.

---

## Ranking global por riesgo de escala (qué se rompe primero a 1000×)

| # | Área | Por qué este orden |
|---|---|---|
| 1 | **C1 + polling `/reply`** | Es lo único que se rompe **solo, sin adversario y sin evento raro**: el churn de conexiones crece linealmente con usuarios activos (y el polling de 1.5 s lo multiplica por sesión abierta, incluso ociosa en modo lento). El techo de `max_connections` de un Postgres compartido (fusion, que además sirve a GoTrue) es un cliff, no una degradación. |
| 2 | **C4 `/auth/signup` sin barrera** | No se rompe por volumen orgánico sino por **un** actor: signup abierto → tenant facturable → `/chat` con COGS LLM. A diferencia de C1 no requiere escala para doler, pero sí requiere que alguien lo encuentre. El proxy de login que ciega el rate-limit de GoTrue agrava. |
| 3 | **D-E observabilidad** | No rompe nada por sí misma — **multiplica el costo de todo lo demás**: a escala multitenant, cada incidente de C1/C2/D-A sin logging estructurado ni tenant-id correlacionable es horas de arqueología en `journalctl`. Además el print de transcripciones es un incidente de privacidad esperando volumen. |
| 4 | **C2 writes no idempotentes** | Severidad máxima por incidente (dinero: link de MP con ext_ref aleatorio; facturas de terceros: mails/docs duplicados), probabilidad proporcional a la frecuencia de retries — que crece justo cuando C1/D-B empeoran las latencias. Las clases se realimentan: D-B produce los timeouts que disparan los retries que C2 no deduplica. |
| 5 | **C6 chat sin cota** | Degradación por usuario, no del sistema: la sesión permanente (continue-as-new) garantiza que `messages`+`seenIds`+persistencia O(N)+render sin virtualizar crecen sin techo por diseño. Se siente como "la app anda cada vez peor" — el churn silencioso más caro en un producto de suscripción. |
| 6 | **D-B timeout Composio** | Fallo correlacionado: un outage de Composio + retries acumula threads bloqueados hasta agotar el executor del worker — y entonces caen TODOS los tenants, no los que usaban Composio. |
| 7 | **C7 Composio sync en `/me`/`/catalog`** | Latencia y rate-limits de terceros en los endpoints de arranque de la app; molesto a 10×, serio a 1000×. Cacheable con TTL corto — riesgo acotado. |
| 8 | **C3 `_generar_doc_y_fila`** | Pérdida silenciosa de un efecto secundario declarado como "comodidad". Real pero acotado por diseño consciente. |
| 9 | **D-A errores tragados** | Costo de diagnóstico, no de disponibilidad — sube al puesto 3 si no se arregla junto con D-E (son la misma fix: loggear en el except). |
| 10 | **C9 higiene del árbol** | Riesgo de proceso (checkout compartido ×3 sesiones), mitigado a medias en el working tree; queda commitear + `tok.json`. |
| 11 | **C5 wf_id como clave** | Latente: solo explota si alguien cambia el formato, y hay 5 amarres de test que lo harían ruidoso. Con la FK escalada como MAYOR, no urge. |
| 12 | **C8 firma mentirosa** | Inocua hoy, fix de una línea. |
| 13 | **D-C / D-D** | Resueltas / disciplina alta. Coincido con los 🟢. |

---

## Lo que el mapa exageró o erró

1. **C5 "solo 1 de 5 reconstrucciones atada por test" — el error más claro del mapa.** Son 3 amarres directos (incluyendo uno que assertea el literal SQL de `presupuesto_store:107`, el sitio que el mapa da por huérfano) más 2 fixtures de integración que reconstruyen el formato. El riesgo de "cambio de formato rompe 4 en silencio" no existe como está descripto.
2. **El fix raíz de C5 contradice una decisión escrita del repo** ("§5 dice que no se refactoriza" en `cliente_store.py`) — bajarlo como táctica sería ejecutar un MAYOR sin escalar.
3. **"86/20" no reproducible** — cuento 84/18 con el patrón declarado. Menor, pero un mapa que predica "control ejecutado: N exacto" debería ser reproducible.
4. **"/afip/estado pagina 2×"** — es una paginación completa (cara por otra razón: inventario entero para un toolkit), no dos.
5. **"engine_mode default = dispatch" como raíz principal de C2** — cierto en `web.py:84`, pero `worker_b.py:181` hornea `"react"` y la memoria del proyecto declara react VIVO; si el env del VPS tiene `COPILOTO_ENGINE_MODE=react` (verificación pendiente, un comando), la raíz "dispatch no transporta idem_key" describe el camino de rollback ya documentado como degradado — y el frente real de C2 es el executor react sin tabla de dedup.
6. **Paths del frontend desactualizados**: `chatMachine.ts` está en `packages/core/src/chat/`, no en `apps/copiloto-web/src/chat/`; `mercadopago_gateway.py` en `motor/clients/agent/providers/`. Para un prompt v2 "dirigido con paths exactos", esto haría fallar los `git show` del auditor.
7. **"motivo descartado" en `presupuesto_doc`** — el motivo sí viaja hasta el endpoint; lo que falta es que alguien lo lea/loguee. Cambia el fix: no hay que "dejar de descartarlo", hay que consumirlo en `presupuestos_web.py:241`.
8. **C9 ya está a medio pagar** — las reglas existen en el `.gitignore` local sin commitear; y el mapa no vio `tok.json`/`gastos_antes.json` en la raíz, que son el mismo riesgo hoy.
9. **Lo que el mapa subdeclaró (inverso de exagerar):** el amplificador de C1 por polling de `/reply` cada 1.5 s; el `ext_ref` **aleatorio** en el mp_charge de dispatch (peor que "sin dedup"); que `/auth/login` ciega el rate-limit del upstream; y que D-A son 42 sitios, no 4.

## Supuestos abiertos (marcados, no resueltos)

- **`[REQUIRES_LIVE_VALIDATION]` engine_mode en prod** — cerrable con: env del servicio `uc-copiloto-web`/`uc-copiloto-worker` en el VPS (`COPILOTO_ENGINE_MODE`). Decide la prioridad relativa dentro de C2.
- **`[REQUIRES_LIVE_VALIDATION]` Caddy vivo sin rate-limit** — cerrable con: `caddy validate`/lectura del Caddyfile en el VPS (si difiere del repo, es drift a auditar aparte).
- **`[ASSUMED_PENDING_VERIFY]` timeout default del SDK Composio** — cerrable leyendo el default de `Composio()` en la versión pinneada; cambia D-B de "fuga garantizada" a "fuga si el default es None".
- **`[ASSUMED_PENDING_VERIFY]` resuelto:** `web.py:629` = `composio_disconnect`, path frío; excluirlo del fix de cache (es punto de invalidación).
