# Relevamiento de CÓDIGO — documento de cierre

> **Fecha:** 2026-10-09 · **Sujeto:** `origin/main` @ `6278836a280eaf7e810b1210ec99d3b3c1238664`
> **Para qué:** base del backlog y la planificación. Responde **qué capacidades existen hoy en el
> código**, para no volver a implementar lo que ya está hecho ni declarar hecho lo que no está.
> **Estado:** §0–§4 cerradas (dato mecánico, cuatro cruces con control positivo y negativo).
> §5: **los 11 lotes, completo** —  (L11 transversal · L10 agenda/admin/DLQ/grafo · L04 mi día/BI · L06 soporte/inteligencia · L05 cáscara/design-system · L03 auth/legal · L02 chat/HITL/voz · L08 gastos/clientes · L07 ingresos/presupuestos/MercadoPago · L09 conexiones/apps/ajustes · L01 facturación-AFIP). **§5 cerrada.**
> 🔴 **Los tres hallazgos críticos ya firmes, uno por tipo de daño:** **dinero** — un pago de MercadoPago se cuenta DOS VECES en «Entró», en `main` desde el 2026-10-06 (§5.4) · **verificación** — el test adversarial insignia del aislamiento multitenant mide una función **gemela** que el guard no usa, y su docstring afirma lo contrario (§5.3) · **cumplimiento** — un emprendedor que entra por Google, el único camino que funciona, **nunca acepta los términos** y nada se lo exige (§5.3). Un cuarto, de accesibilidad: mobile pinta los tres hexes que web retiró por contraste, y **dos de los tres** (éxito y peligro) quedan bajo AA **medidos contra los fondos propios de mobile** — el acento pasa (§5.5). La causa de la confusión es un hallazgo en sí: los contrastes de mobile se calcularon contra los fondos **de web**, en las dos pieles (§5.5, hallazgo 1.bis).
> 🔴 **Un quinto, de verificación, firme desde la segunda ronda:** el alta de cliente manda clave de idempotencia y el backend **la descarta en silencio**, con tres artefactos afirmando lo contrario y el gate que la vigila mirando sólo la paridad entre los dos fronts (§5.8). **Y uno de función que ya estaba y ahora tiene mecanismo:** en mobile la card HITL queda **activa después de responderla** porque el puente `ChatView` descarta el `hitlMessageId` que la lista le pasa, y TypeScript no puede avisarlo — lo encontró §5.2, lo localizó §N.2/L02.
> 🔴 **Y el que faltaba por tipo de daño, el FISCAL, del último lote:** el fix contra la doble emisión de comprobantes está aplicado a la factura y **no** a la nota de crédito — `AnulacionWorkflow` llama a la activity de emisión **sin reservar el número**, y el comentario del propio repo describe ese camino exacto como *«dos CAE por un solo pedido»*—. Y la nota de crédito se guarda con estado `emitida`, porque **ninguna fila vale nunca `nota_credito`**: de ahí que las dos UIs ofrezcan **«Anular» sobre una nota de crédito** —con un comentario que declara justamente esa protección— y que dos totales de «lo facturado» den **−X y +X para el mismo mes** (§5.1). Los cinco los verifiqué contra el código, uno por uno.
> 🔴 **Y dos de la refutación de L08, verificados por mí:** **dato** — cambiar **sólo el tipo de documento** de un cliente guarda la combinación imposible que `documento_incoherente` existe para impedir, porque el guard está anclado a que venga el número y la edición por campo no lo manda (§N.2/L08) · **rastro** — la Consola **confirma la suspensión de un tenant antes de auditarla**, en conexiones autocommit distintas: si la auditoría falla, el tenant queda suspendido **sin fila de auditoría** y al operador se le responde que falló, en el único módulo que se autodefine *precondición* (§N.2/L08).
> 🔴 **Y uno más de L07, el peor por lo que implica el fix:** el ingreso **dictado** manda `origen:'voz'`, el backend **descarta el campo** —no existe en el body— y queda guardado como **tipeado a mano**, que es exactamente la mezcla que tres capas declaran por escrito existir para impedir. Y el fix de una línea **rompe producción**: el store rechaza `voz`, así que agregar el campo haría fallar con 400 todo ingreso por voz. Es una decisión de diseño sobre cuatro dominios que no coinciden, no un parche (§5.7).

---

## §I · Índice de hallazgos — la entrada para el backlog

**Qué es y qué no.** Es un índice de **punteros**, no un resumen: cada fila dice el defecto en una
línea y manda a la sección donde está la medición con sus `archivo:línea`. **Si una fila y su sección
dicen cosas distintas, gana la sección** — esta tabla se escribió después y puede envejecer antes.
Está al frente porque es lo que va a circular, y lo que circula tiene que ser lo que apunta a la
medición, no una segunda versión de ella.

**Completitud, declarada:** **45 hallazgos** sobre **los 11 lotes: completo**. Ya no va a crecer por lotes
nuevos —sí puede crecer por refutación, que para dos lotes está pedida—, y **no** es una lista
cerrada de «todo lo que está mal»: es lo que 11 barridos de código encontraron. El conteo salió
de barrer el propio documento, no de memoria.

**La clase de trabajo es la columna que decide el backlog**, y es el resultado más fuerte de todo el
relevamiento: *sólo 15 de 45 son código roto corriendo en producción.* El resto se reparte entre
capacidades **completas que nadie puede alcanzar**, protecciones **declaradas y ausentes**, e
**instrumentos que miden otra cosa**. Un backlog que trate a los 45 como «bugs» va a costar de más y
va a priorizar al revés.

| # | dominio | el defecto, en una línea | clase de trabajo | § |
|---|---|---|---|---|
| 1 | mi día / BI | un cobro de MercadoPago se cuenta **dos veces** en «Entró»; en `main` desde el 2026-10-06 — y §5.7 encontró la **causa**, con un solo sitio de fix: el webhook de MP escribe en **las dos** tablas que «Entró» une (`mp_web.py:53-54,68-71` + `inteligencia_queries.py:43-49`), y el doble conteo está en portada, serie **y** detalle | 🔥 **código roto en prod** — dinero | §5.4 |
| 2 | chat / multitenant | el historial del chat web **no está acotado por tenant**: un segundo login en el mismo navegador hidrata la sesión ajena. El fix ya existe **tres veces** al lado (mobile y los dos de soporte) | 🔥 **código roto en prod** — aislamiento · *portar, no diseñar* | §5.2 |
| 3 | chat / HITL | en mobile la card HITL **queda activa después de responderla**: el puente `ChatView` descarta el `hitlMessageId` que la lista le pasa, y TypeScript no puede avisarlo | 🔥 **código roto** — función | §5.2 · mecanismo en §N.2/L02 |
| 4 | ingresos / mobile | la card de ingreso **no llega a «resuelto»** con un ingreso completo: el botón que persiste sólo se renderiza si **falta** algún dato; un remount la devuelve a `editando` y la 2ª vez el duplicado responde 409. La web no lo tiene Y la cola: en el 409 el botón «Es el mismo» llama a `onCancelar`, así que la card pinta **«No lo anotamos.»** sobre un ingreso que **sí quedó guardado** | 🔥 **código roto** — función · REQUIERE_DEVICE | §5.7 |
| 5 | design system | mobile pinta los tres hexes que web retiró; medidos contra **sus propios** fondos, **dos** quedan bajo AA (éxito 4,23 · peligro 4,29) y el acento pasa (4,91) | 🔥 **código roto** — accesibilidad, 2 tokens | §5.5 |
| 6 | design system | los contrastes de mobile se calcularon contra los **fondos de web**, en las dos pieles, bajo un comentario que afirma haberlos medido «contra el `fondoBase` real de cada piel» | 🔬 **registro que afirma un método y aplica otro** | §5.5 h1.bis |
| 7 | cáscara web | cruzar el breakpoint de 900 px **desmonta el árbol** y un dictado en curso **desaparece sin aviso ni envío**; el docstring dice «sin remontarlos» | 🔥 **código roto en prod** — consecuencia nunca declarada | §N.2/L05 |
| 8 | clientes | cambiar **sólo el tipo de documento** guarda la combinación imposible que el guard existe para impedir — y el guard nació de un caso **medido**; un pasaporte, además, se guarda mutilado a dígitos | 🔥 **código roto en prod** — dato | §N.2/L08 |
| 9 | ingresos / voz | el ingreso dictado manda `origen:'voz'` y el backend **descarta el campo**: queda registrado como tipeado a mano, que es la mezcla que tres capas declaran impedir. **El fix obvio rompe producción**: el store rechaza `voz` — y darle un origen propio rompe **tres cosas más**: borrar filtra `origen = 'manual'`, y `completitud_dictada` y `completar_ingreso` también | 🔥 **código roto en prod** — dato · *decisión, no parche* | §5.7 |
| 10 | cobros / voz | el consumidor de voz compara **`estado`** (ciclo de vida del comprobante: `emitida`, `anulada`, `nota_credito`) en vez de **`estado_cobro`** (`impaga`, `parcial`, `cobrada`), dos claves que `_resumen` devuelve juntas: **todo pago total dictado contesta «Todavía le quedan $0,00 por pagar.»** Y el fake del test devuelve la clave equivocada **con los valores derivados**, así que corregir producción pone el test en rojo | 🔥 **código roto en prod** — función · *el fake lo suelda* | §N.2/L07 |
| 11 | apps / conexiones | las **cards prometen lo que la poda se llevó**: Gmail anuncia «Enviá y buscá mails» y lista `Leer mails`, `Enviar mails`, `Buscar` (`catalog.py:38-39`) con **una sola** tool viva, `gmail_send` (`gmail.py:68`) — dos de las tres capacidades anunciadas **no existen**; Calendar anuncia «Buscar turnos» sin tool de búsqueda; y el prompt react promete «crear planillas» cuando `sheets_append_row` sólo appendea a una que ya existe | 🔥 **código roto en prod** — promesa al usuario | §5.9 |
| 12 | apps / conexiones | una app **caída** viaja con `connected=false`, así que el contador de la web **la suma en «disponibles»** mientras su card muestra RECONECTAR — el mismo dato leído con dos criterios en la misma pantalla. Y el badge de la fila no puede aparecer nunca porque `needsReconnect` es `return false` literal (`ModeButton.tsx:21-23`), aunque `/catalog` **sí** manda `status: 'caido'` | 🔥 **código roto en prod** — cifra visible · *el badge es el ítem más barato del documento* | §5.9 |
| 13 | facturación / anulación | **ninguna fila vale nunca `nota_credito`**: el alta toma `estado` por default `emitida` y las dos llamadas que registran una NC no lo pasan (`afip_comprobante_store.py:34` · `afip_factura_activities.py:161-168,181-187`), así que **las dos UIs ofrecen «Anular» sobre una nota de crédito** — con un comentario que declara justamente esa protección (`apps/copiloto-web/src/modules/facturacion/SeccionMisComprobantes.tsx:22-26` web, `apps/mobile/src/modules/facturacion/SeccionMisComprobantes.tsx:24-28` mobile) y tests que usan un solo comprobante `emitida` | 🔥 **código roto en prod** — fiscal · *el comentario declara la protección ausente* | §5.1 |
| 14 | facturación / BI | **«lo facturado» da −X y +X para el mismo mes**: `afip_comprobante_store.py:186-190` **resta** las notas de crédito por tipo y `inteligencia_queries.py:118-126` las **suma en positivo**, y lo que produce la divergencia es el default de `estado` de la fila anterior. Los tres tests de la segunda no insertan ninguna NC | 🔥 **código roto en prod** — dinero · *síntoma de la fila anterior* | §5.1 |
| 15 | anulación | **el fix contra la doble emisión llegó a la factura y no a la nota de crédito**: la factura reserva el número en el workflow y `AnulacionWorkflow` llama a la misma activity con 5 argumentos, sin reserva (`afip_anulacion_workflow.py:116-120`), cayendo en `ultimo_comprobante + 1` — el camino que el propio comentario describe como **«dos CAE por un solo pedido»** (`afip_factura_workflow.py:277-282`) | 🔥 **código roto en prod** — fiscal · *el fix ya existe en otro call-site* | §5.1 |
| 16 | facturación / perfil | las dos UIs ofrecen **Responsable Inscripto** y el motor sólo emite Factura C: `calcular_totales` levanta `NotImplementedError` diciendo *«No emitir A/B por este camino»* (`afip_rules.py:302-306`), `validar_perfil` no rechaza RI y **`puede_facturar = bool(creds) and bool(perfil)` no mira la condición** (`afip_web.py:635`) | 🔥 **código roto en prod** — promesa al usuario | §5.1 |
| 17 | splash | el botón de pronunciación **no tiene alimentador** en ninguna plataforma y el asset no existe; el test de web afirma «reproduce el audio» inyectando una ruta inexistente | 🕳️ **rama sin alimentador** + instrumento que fabrica la referencia | §N.2/L05 |
| 18 | auth / legal | la **aceptación legal no condiciona nada**, y los dos logins que funcionan la saltean: un emprendedor que entra por Google nunca acepta los términos | 🚫 **control ausente** — cumplimiento | §5.3 |
| 19 | auth | el **alta por email de web** no puede completarse contra el backend real | 🚫 **camino incompleto** | §5.3 |
| 20 | clientes | el alta manda clave de idempotencia y el backend **la descarta en silencio** — tres artefactos afirman lo contrario y el gate que la vigila sólo compara los dos fronts entre sí — y §5.7 midió un **segundo** hueco del mismo gate: es ciego a Ingreso | 🚫 **protección declarada y ausente** + instrumento ciego | §5.8 |
| 21 | consola admin | la **auditoría no es atómica** con la mutación: el tenant queda suspendido **sin rastro** y al operador se le responde que falló — en el único módulo que se autodefine *precondición* | 🚫 **protección declarada y ausente** | §N.2/L08 |
| 22 | cobros / MercadoPago | el webhook afirma **«SIEMPRE 200»** y responde 500 por el handler global, **sin DLQ**: ese código define si MP reintenta o abandona, y lo que se pierde es la noticia de que entró dinero | 🚫 **protección declarada y ausente** — dinero | §5.7 |
| 23 | facturación / wizard | `agregar_item` atrapa `(ValueError, TypeError)` y **`decimal.InvalidOperation` es un `ArithmeticError`**, así que un precio no numérico no llega a `item_invalido`: sale del handler del signal (`afip_factura_workflow.py:149-157`). El fix ya existe en `a_decimal` del módulo de reglas (`afip_rules.py:288-291`), y los tres códigos de error de los signals de edición no tienen test | 🚫 **camino de error ausente** · *el fix ya existe al lado* | §5.1 |
| 24 | soporte | la **clasificación automática de feedback** está completa y **no tiene disparador en producción** | 🕳️ **capacidad completa sin disparador** | §5.6 |
| 25 | perfil / ceremonia | el **modo de ceremonia** se configura y se muestra en las dos apps, **ningún código ramifica por él**, y tres comentarios dan tres estados distintos (en pausa / habilitado / siempre confirmación) | 🕳️ **capacidad sin rama** + registro en tres idiomas | §5.7 |
| 26 | clientes | la UI de **las dos** plataformas promete «la cartera se arma sola»; la derivación sólo la corre un script a mano, sin tests y sin disparador visible en el repo | 🕳️ **capacidad completa sin disparador** + UI que la promete | §5.8 |
| 27 | clientes | `consultar_cliente` está **podada del catálogo pero viva**, y es el único camino al historial que la ficha muestra vacío (`presupuestos: []`, `facturas: []` fijas) | 🕳️ **capacidad completa inalcanzable** | §5.8 |
| 28 | gastos / trabajos | **imputación y margen**: rutas cableadas en producción, sin un solo test HTTP y **sin ningún consumidor** de front. Misma clase, dos instancias más de §N.2/L07: el `?detalle=` de la serie «Entró vs Salió» y la mitad `caja` de `/contabilidad/resumen` | 🕳️ **capacidad completa sin consumidor** | §5.8 |
| 29 | chat / apps | el **«Modo por app»** está implementado en los dos extremos y **no existe en ninguno**: la web manda `mode` en **cada** POST (`apps/copiloto-web/src/modules/chat/useChat.ts:395-400`), `ChatIn` declara sólo tres campos y pydantic **lo descarta en silencio** (`apps/copiloto/web.py:532-535`), y la pantalla que lo elegiría **no tiene puerta** (`TABS` no tiene clave `'apps'`). Mobile manda `payload`, también indeclarado | 🕳️ **capacidad completa sin disparador** — y sin receptor | §5.9 |
| 30 | facturación / secretos | **dos activities registradas en el worker sin disparador** (`purgar_secretos_vencidos` y `listar_comprobantes`, `worker_b.py:370,374`) y dos campos producidos que nadie lee (`fecha_min`/`fecha_max`, `afip_web.py:294-304`). El único test del borrado afirma que **el vigente sigue siendo consumible**: un purgador que no borrara nada lo cumpliría igual, y su `DELETE` no filtra por `cliente_id` | 🕳️ **capacidad completa sin disparador** · *y un control que no mira* | §5.1 |
| 31 | multitenant | el **test adversarial insignia** del aislamiento mide una función **gemela** que el guard no usa — y su docstring afirma lo contrario | 🔬 **instrumento ciego** — el control queda no verificado | §5.3 · profundizado en §N.2/L03 |
| 32 | soporte | el **control positivo** del filtro de capacidades **se neutralizó solo**: queda verde por vacío | 🔬 **instrumento ciego** | §5.6 |
| 33 | design system | las **exenciones de contraste** de web sobrevivieron a su motivo: tres citan una deuda que el fix de septiembre ya pagó | 🔬 **exención sin autoridad** | §5.5 |
| 34 | CI / gate | **diez tests que ningún gate ejecuta nunca**, por dos mecanismos distintos de salteo — y el gate **no lo declara**: el verde los incluye | 🔬 **instrumento ciego** — ítem barato y de alto rendimiento | §N.1.bis |
| 35 | guía de capacidades | el **control negativo del filtro se desarmó solo**: la fila de `emitir_factura` existía para probar que la guía filtra, su tool **ya está viva** (`tool_catalog.py:450`) y entonces las 10 filas pasan —el estado exacto que su propio comentario advierte—, y el guard que ese comentario cita como control (`test_facturar_por_voz_NO_esta_en_la_guia_todavia`) **no existe en ningún archivo**. La guía publica 10 de las **17** tools ofrecidas al LLM: 7 que el emprendedor puede disparar y la ayuda no menciona | 🔬 **instrumento ciego** — el control citado no existe | §5.9 |
| 36 | apps / riesgo | el **contrato de riesgo** cuenta a Drive como servicio **con tool viva** (`service_risk_contrato.py:29-36`) mientras el módulo declara `TOOLS` vacío y lo dice por escrito (`drive.py:74-75`); y su test lo deriva de la **existencia del módulo**, no de su contenido | 🔬 **instrumento ciego** — certifica por el criterio equivocado | §5.9 |
| 37 | facturación | **todo lo que falla en la emisión se informa como `rechazo_afip`**: el `except Exception` del tramo fija ese código (`afip_factura_workflow.py:305-308`), único lugar que lo escribe, y el core lo documenta como *«rechazo fiscal de verdad»* — pero la política de reintentos sólo excluye dos excepciones, así que cualquier otro error termina ahí. Y dos `raise` quedan fuera del try | 🔬 **instrumento ciego** — el diagnóstico informa una sola causa | §5.1 |
| 38 | facturación / registro | `presupuesto_store.py:115` cita **`test_presupuesto_facturado.py`** como el test que compara dos fórmulas de id; **ese archivo no existe** (0 resultados). Y once comentarios más contradichos por el código — entre ellos `cobro_store.py:52-54`, que dice que el origen `mercadopago` *«todavía no lo escribe nadie»* cuando `mp_web.py:65-71` lo escribe | 🔬 **instrumento ciego** — el registro cita una autoridad inexistente | §5.1 |
| 39 | multitenant | **ningún test une handler real + store real + `require_tenant` real** para `/gastos`, `/clientes` ni `/trabajos`; el ratchet las arma con stores `_noop`. **Tres lotes independientes cayeron en la misma costura** — y el ratchet no ve las rutas armadas con **f-string**, mientras su comentario declara una cobertura que no tiene (`_DEUDA_TENANT_SCOPED_SIN_TEST = 65`) La prueba de **mutación** de §N.2/L07 deja la lista nombrada de mutantes que nadie caza — es el material concreto de este ítem | 📐 **evidencia que no toca prod** — un solo ítem transversal | §5.8 + §N.2/L03 |
| 40 | web / core | el **adaptador HTTP** que la web usa para todo lo que pasa por el core no tiene test; alcance acotado a los caminos que van por el core | 📐 **evidencia que no toca prod** | §N.1 · acotado en §N.1.bis |
| 41 | consola admin | **AD-1** — el control de acceso de la consola se auto-degradó a `EXISTE_PARCIAL` al refutarlo | 📐 **evidencia que no toca prod** | §N.2/L10 |
| 42 | guía / ajustes | `GET /capacidades` y `/conceptos` **sin ningún test HTTP**, ningún test ata el catálogo de apps al toolset del react, y `AjustesScreen` **no tiene archivo de test**: 6 de las 9 entradas de su router sin cubrir | 📐 **evidencia que no toca producción** | §5.9 |
| 43 | anulación / aislamiento | **no hay test adversarial de «A pide anular el comprobante de B»** — los adversariales cubren confirmar y consultar, no anular (`test_afip_web_facturas.py:187-212`) — así que por la regla dura del repo el control queda `[UNVERIFIED]`; y el ratchet que debería verlo acredita la ruta por menciones literales, dos de ellas de preparación, con deuda congelada en **65** y sin contar los hostiles escritos con f-string | 📐 **evidencia que no toca producción** | §5.1 |
| 44 | contabilidad | **tres implementaciones de `dos_decimales`** que divergen ante entrada inválida; la que importan siete módulos **no tiene test**, y el único test apunta a la que menos se usa | ♊ **duplicación divergente** | §5.8 |
| 45 | facturación web/mobile | **dos archivos byte a byte idénticos** en web y mobile (`maquinaEstado.ts` y `etiquetasComprobante.ts`, verificado con `cmp`) **con tests sólo del lado de mobile**, ninguno en `packages/core`; dos símbolos exportados que sólo prueba la plataforma que no los usa; y el CUIT del emisor cacheado en mobile y pedido en cada lectura en web | ♊ **duplicación divergente** | §5.1 |
| 46 | multitenant / MercadoPago | el store declara que **el filtro explícito es «la barrera efectiva»** porque el rol owner bypassa RLS (`apps/copiloto/mp_credential_store.py:3-5`, `:100-101`), pero `FORCE` es el default desde el 2026-07-31 (`deploy/copiloto/deploy.sh:312`) y `mp_credentials` está en el set forzado — el comentario describe un régimen **arreglado hace dos meses**, y bajo `FORCE` dos mutantes que borran el filtro son **equivalentes**: nadie mide la capa que el código llama la efectiva. El rol `BYPASSRLS` acotado que existe para medirla (`deploy/copiloto/test-db.sh:52-57`) cubre 7 tablas y **no ésta** | 🔬 **instrumento ciego** | §N.2/L09 |
| 47 | ratchet de rutas | la unidad de cuenta es el **path**, no el par (verbo, path) — y **su propio docstring** dice que el path solo no identifica la ruta (`apps/copiloto/tests/test_ratchet_endpoint_tenant_scope.py:348-351`) — así que un hostil a `GET /feedback` acredita también `POST /feedback`; cuenta por **AST, no por ejecución**, de modo que un test PG salteado acredita cobertura; y el **65** está inflado: `DELETE /composio/connection` tiene caso hostil y el ratchet no lo ve | 🔬 **instrumento ciego** — refina las filas 39 y 43 | §N.2/L09 |
| 48 | web / core | la **raíz de composición** de la web tiene **un solo importador** (`apps/copiloto-web/src/main.tsx:9`) y **ningún test la importa**: borrar la llamada o el import deja verde la suite web entera, y el `throw` que su docstring promete como falla explícita (`packages/core/src/api/config.ts:24`) tampoco tiene test | 📐 **evidencia que no toca producción** | §N.2/L09 |
| 49 | gate / recibo | `scripts/ci/backend.sh:33` corre `pytest -q` **sin contar los skips**, así que un recibo verde acredita que Postgres se aprovisionó, no que cada test PG haya corrido — y la línea base del árbol tiene **386 salteados** que el recibo no distingue de 386 verdes | 🔬 **instrumento ciego** | §N.2/L09 |
| 50 | conexiones / catálogo | `listarCatalogo` está **mockeado en los nueve consumidores**; el único que lo ejercita tiene **un** fixture y **un** test de error, y el test de paridad de contrato compara **una sola clave** leída como texto (`apps/copiloto-web/src/lib/api/catalog.contrato.paridad.test.ts:46-52`) — la costura backend→core de `/catalog` no tiene instrumento | 🔬 **instrumento ciego** | §N.2/L09 |
| 51 | multitenant / tests | un caso hostil con **un solo actor** no distingue «toma la identidad del token» de «tiene el tenant hardcodeado»: medido, los mutantes con el literal `"cid-A"` sobreviven en las **3** rutas de un actor y mueren en las **4** de dos actores — y uno de los ciegos **se llama** *«borra filtrando por el `cliente_id` del token»* (`apps/copiloto/tests/test_connect_endpoints.py:393`) | 🔬 **instrumento ciego** | §N.2/L09 |
| 52 | facturación / Ajustes | `puede_facturar` es `bool(creds) and bool(perfil)` (`apps/copiloto/afip_web.py:635`): **dos presencias, no una capacidad**. La condición IVA se pide, se valida y se persiste (`:92`, `:195`, `:222`) y `GET /afip/estado` **no la devuelve ni la mira** (`:628-642`) — así que un Responsable Inscripto lee «ya podés facturar» y el motor le levanta `NotImplementedError` al emitir (`apps/copiloto/afip_rules.py:302-306`, Factura A/B `NO_EXISTE`). Ningún test puede caerse: la propiedad no está escrita en ninguna parte | 🔥 **código roto en producción** | §N.2/L01 |
| 53 | certificado / vencimiento | el test del store inyecta un **cursor falso** (`apps/copiloto/tests/test_certificado_por_vencer.py:138-139`), así que ejercita el decodificado del PEM y **el SQL no lo corre Postgres** — y lo no ejercitado es justo el contrato: el filtro por `activo` que el docstring declara como «el único con el que se factura» (`apps/copiloto/afip_credential_store.py:161-164`). El veredicto decía `EXISTE_Y_COMPLETO` con «sin test que los ejecute» **en su propia celda de evidencia** | 📐 **evidencia que no toca producción** | §N.2/L01 |
| 54 | ingresos / aislamiento | los hostiles de ingresos abren con `pytestmark = pytest.mark.skipif(not DATABASE_URL, …)` (`apps/copiloto/tests/test_contabilidad_integracion.py:30`) y el recibo corre `pytest -q` sin contar salteados (`scripts/ci/backend.sh:33`): **un verde no distingue «corrieron» de «se saltearon»**. Y cuando corren, `conn_de_tenant` pasa a la vez por el `WHERE cliente_id` y por la policy RLS (`apps/copiloto/conftest.py:78-100`), así que **el verde no atribuye** cuál barrera frenó la fuga | 🔬 **instrumento ciego** — cierra la costura con la fila 49 | §N.2/L01 |
| 55 | presupuestos / facturación | el docstring promete que un cambio de formato «rompe acá, ruidosamente» y nombra a `test_presupuesto_facturado.py` (`apps/copiloto/presupuesto_store.py:114-116`) — **ese archivo no existe**. El control **sí** existe, con otro nombre (`apps/copiloto/tests/test_presupuesto_derivados.py:31`), así que lo roto es **la cita, no el guard**; y `apps/copiloto/tool_catalog.py:1299` ubica la función en `:82-99` cuando está en `:121` | 🔬 **instrumento ciego** | §N.2/L01 |
| 56 | trabajos / id de factura | `apps/copiloto/tests/test_trabajo_store.py:58` afirma una **cadena de código fuente** (`assert 'f"factura-{self._cid}-{fila[0]}"' in fuente` sobre `inspect.getsource`): **una línea comentada la satisface igual**, y un renombre de variable la pone roja sin que nada se haya roto. El test hermano de al lado (`:60`) compara el **valor**, que es la forma que sí mide | 🔬 **instrumento ciego** | §N.2/L01 |
| 57 | ambiente dev/prod | el default del ambiente vive en **cuatro** lugares y uno es la constante que existe para ser el único: `AMBIENTE_DEFAULT = "dev"` (`apps/copiloto/afip_web.py:101`) frente a tres literales propios (`apps/copiloto/worker_b.py:297`, `:306`, `apps/copiloto/afip_credential_store.py:108`). Es **el default que decide si una factura es real** (`production=(ambiente == "prod")`): cambiar la constante no propaga | ♊ **duplicación divergente** | §N.2/L01 |
| 58 | anulación / nota de crédito | la factura **reserva** el número antes de emitir (`apps/copiloto/afip_factura_workflow.py:287-297`) y su comentario explica que sin reserva una autorización perdida hace que el reintento emita **otro** comprobante (`:277-282`); `AnulacionWorkflow` llama a `emitir_comprobante` **sin reserva** (`apps/copiloto/afip_anulacion_workflow.py:116-120`) y cae en `ultimo_comprobante + 1` (`apps/copiloto/afip_factura_activities.py:146-147`) — el camino que un test **llama «la doble emisión» y deja verde a propósito** (`apps/copiloto/tests/test_afip_doble_emision.py:102-115`). El test de la NC pasa `nro_reservado=7` (`apps/copiloto/tests/test_afip_anulacion_workflow.py:245`), **un argumento que el workflow nunca envía**. La protección ya existe en el otro call-site | 🔥 **código roto en producción** | §N.2/L01-b |
| 59 | contabilidad / «lo facturado» | **cuatro predicados distintos** para la misma cifra, más una quinta consulta que cuenta las mismas filas con un sexto criterio: `total_periodo` resta las NC (`apps/copiloto/afip_comprobante_store.py:186-190`) · inteligencia las **suma en positivo** (`apps/copiloto/inteligencia_queries.py:118-126`) · `resumen_operaciones` filtra por CAE sin estado (`apps/copiloto/cliente_store.py:579-586`) · la web filtra `estado === 'emitida'` sobre la **primera página** (`apps/copiloto-web/src/modules/facturacion/ResumenFacturacion.tsx:72,82-83`) · e `impagos` trae las filas de NC como deuda **sin el tipo** (`apps/copiloto/cobro_store.py:125-139`, `:144-149`), consumido por cuatro superficies. **El mismo mes da números distintos en cuatro pantallas** | 🔥 **código roto en producción** | §N.2/L01-b |
| 60 | core / HTTP | `enviarAutenticado` (`packages/core/src/api/afip.ts:504-510`) llama `http.enviar` directo y se saltea la renovación del bearer, el 408 por corte de tiempo y el **refresh ante 401** (`packages/core/src/api/client.ts:68,166`, `:146-153,176`, `:182-189`) en `guardarPerfil` y `conectarArca`; las otras **17** llamadas del módulo van por `apiClient`. Su docstring se justifica con un problema que `packages/core/src/api/errors.ts:5-20` dice **ya arreglado** («se expuso `body` para que nadie más pague ese precio») y cita como precedente a `actualizarCliente`, que `packages/core/src/api/client.ts:219` dice que **ya no existe** | 🚫 **protección o camino ausente** | §N.2/L01-b |

**Cómo se reparten las 60** (sumandos a la vista, como toda cifra de este documento):
**18** código roto en producción · **7** protección o camino ausente · **8** capacidad completa que nadie alcanza · **17** instrumento ciego · **7** evidencia que no toca producción · **3** duplicación divergente. Contados sobre la columna de clase de la tabla, no de memoria.

**Y el dato de forma, que es la pregunta que §N+1 deja abierta:** de los 60, **ninguno** se retiró
por código ausente. Las **🕳️** son trabajo de **cableado**, no de implementación —la capacidad ya
está escrita y probada—; las **🔬** no se arreglan tocando el producto, se arreglan tocando el
**instrumento**; y las **📐** son código que probablemente funciona y que nadie puede afirmar. Tres
costos distintos, tres dueños distintos, y un id de backlog con un solo estado los colapsa.

➡️ **Y antes de planificar con esta tabla, leer [§N+2](#n2--de-51-filas-a-10-frentes-el-mapa-causasíntoma): las 51 filas no son 51 decisiones.** Diez grupos cubren **37** de ellas, con el orden interno forzado donde lo hay (la 13 antes que la 14 · la 50 antes que 11/12/36 · la 6 antes que la 5), y **26 filas** resultan ser instrumento, cableado o propagación — no «escribir la feature».

⚠️ **Nota de método, porque este índice ya falló una vez.** Hasta esta pasada la tabla estaba
numerada `1,2,3,4,20,21,22,5…19`: appendeé las filas de L05 en la posición correcta **por clase** y
no renumeré ninguna, y este mismo párrafo citaba *«las filas 8 a 11»*. Una referencia por **rango de
fila** se rompe con cada inserción, que en un documento que crece por lotes es siempre — y se rompe
**en silencio**, porque el texto sigue siendo gramatical. Por eso ahora se citan **clases** y la
numeración se recalcula de punta a punta en cada incorporación, con el conteo de clases medido sobre
la propia tabla. Es exactamente el defecto de las filas 🔬 de esta tabla, cometido **en** la tabla:
el índice que existe para circular era el que tenía el dato rancio.

---

## §0 · Por qué esta pasada existe (y por qué la anterior no sirve)

Hubo un relevamiento previo el mismo día que entró por los **documentos**: leyó 12 planes, backlogs,
DoDs y handoffs. Su universo fue, por construcción, *«lo que algún doc nombra»*, con dos fallas que
ningún refinamiento posterior corrige:

1. **Lo implementado que ningún doc menciona quedó invisible.** El universo no lo contenía.
2. **Arrastró filas de planes de julio ya superados**, que ningún código respalda.

Y produjo su propia medición de ese defecto: los 12 documentos **se contradicen 148 veces entre sí**,
con 150 huecos de evidencia, y 53 ids con estados en conflicto. Un corpus que se contradice no puede
ser el denominador de nada.

**Esta pasada invierte la entrada: el universo lo define el código.** La documentación quedó
**prohibida como fuente** —`docs/**`, `*.md`, planes, backlogs, DoDs, handoffs, auditorías,
`coordinacion/**`— incluso para orientarse.

## §1 · Sujeto: un árbol, un SHA

| | |
|---|---|
| Árbol | `C:/gfw-src/wt-relev` (worktree dedicado, detached) |
| SHA | **`6278836a`** = `origin/main` |
| Limpieza | `git diff` vs `origin/main` **LIMPIO (0)** · 0 archivos sucios |

**Por qué un worktree y no el checkout principal.** `C:/Proyectos/.../copiloto-emprendedor` está
**340 commits atrasado** y además vive en la rama de otra sesión. Medir ahí ya produjo un
diagnóstico falso el día anterior («14 filas de enum rotas», que no existían en `main`). Todo
`path:línea` de este documento vale **para este SHA**, y la procedencia se cita contra él, no contra
una rama que después se squashea.

## §2 · Método: el grafo orienta, el código decide

Dos pasos, en orden, sin excepción:

1. **El grafo localiza.** MCP `graphity-code`, `group_id="code-copiloto-emprendedor"`. Devuelve
   hechos del tipo `File X defines Function Y`, `Function A calls Class B`, con `source_file` y
   `source_location`. Sirve para encontrar rápido quién implementa y quién llama, en vez de grepear
   a ciegas. Frescura verificada: su nodo más nuevo (`afip_factura_activities.py` →
   `emitir_comprobante()`, `valid_at 2026-10-09T14:46:49Z`) corresponde al SHA ancla.
2. **El archivo decide. Siempre.** El grafo sólo conoce lo **pusheado**, conserva nodos de spikes y
   ramas viejas, y sus resúmenes los escribió un LLM. **Nada entra a este documento por decirlo el
   grafo**: se abre el archivo en la línea indicada. Si discrepan, **gana el archivo** y la
   discrepancia se reporta.

**Dos veredictos separados por capacidad**, nunca mezclados —mezclarlos es exactamente lo que
produjo los 53 estados contradictorios del intento anterior:

- `veredicto_codigo`: `EXISTE_Y_COMPLETO` (código **y** test que ejercita el camino de producción) ·
  `EXISTE_PARCIAL` · `NO_EXISTE`.
- `veredicto_evidencia`: `TEST_EJERCITA_PROD` · `TEST_NO_TOCA_PROD` · `SIN_TEST` · `REQUIERE_DEVICE`.

Reglas duras heredadas que el relevamiento aplica, no discute:

- **`REQUIERE_DEVICE` es obligatorio en toda capacidad de `apps/mobile/`.** Leyendo código se
  responde «existe», nunca «anda en el teléfono».
- **Un control de autorización/aislamiento sin test adversarial** —actor A pide el recurso de B y
  espera denegación— **es `EXISTE_PARCIAL`**: el happy-path pasa igual si el aislamiento no existe.
- **Un test que no pasa por el camino real** (composition root, cliente HTTP de prod, handler real)
  no cuenta: no puede verlo fallar.

## §3 · Inventario mecánico de superficie

Instrumento: `inventario-superficie.py` (recorre el árbol y emite `capacidad → path:línea`).
**Control positivo embebido de 6 elementos de existencia conocida: 6/6.** Si alguno faltara, el
inventario abortaría — un vacío por ceguera se lee idéntico a un vacío por ausencia.

| | |
|---|---|
| Archivos abiertos | **1196** |
| Elementos hallados (bruto) | **1146** |
| **Elementos del producto** | **1142** |
| Archivos de test | **517** (mapa aparte: un test no es superficie, es su cobertura) |

**Corrección del denominador — medida, no estimada.** 4 de los 1146 elementos (0,3%) **no son del
producto**: son el canario `GET /canario` del instrumento de auditoría
`docs/copiloto-emprendedor/Auditorias/instrumentos/barrido-superficie-front-backend.py:396,401,407,413`.
El inventario los tomó por rutas reales porque clasifica por decorador, no por zona del árbol.
Cayeron los 4 en `(sin-dominio)` → lote L11. **Rutas backend reales: 110, no 114.**

| categoría | n | | categoría | n |
|---|---|---|---|---|
| `export_barrel` | 360 | | `llamada_api` | 70 |
| `componente_tsx` | 273 | | `activity` | 35 |
| `fn_ts` | 265 | | `fn_store` | 19 |
| `ruta_backend` | 114 → **110** | | `workflow` | 10 |

**Dos defectos de partición que hubo que corregir antes de que el inventario sirviera** (los dos
estaban haciendo invisible una parte del producto):

1. **Clasificar por el archivo que contiene al elemento, no por su sujeto**, dejaba 463 de 1146
   elementos (40%) en `(sin-dominio)`: 131 exports colapsaban en `core/api/index.ts` (el barrel) y
   55 rutas en `web.py` (el front-door) — dos archivos cajón que no son un dominio. Corregido
   clasificando por **sujeto**: la ruta HTTP para una ruta, el módulo de origen para un re-export,
   el path para el resto. `(sin-dominio)` bajó a **57 (4%)** sobre 20 dominios.
2. **Un comodín demasiado ancho.** La clave `apps` matcheaba `apps/copiloto-web/…` y
   `apps/mobile/…`, y se comía **473 de 1146 elementos** dentro de «conexiones», dejando
   `auth-legal` y `shell-navegacion` en 0. Es el mismo defecto que ya había metido residuo ajeno por
   `^packages/core/ → agnostico`. Corregido recortando el prefijo del frente antes de matchear.

**Partición del fan-out: 11 lotes, cobertura `1146/1146`, cero solapamiento** (aserción mecánica, no
revisión a ojo), *dominios sin lote: ninguno*:

| lote | n | | lote | n |
|---|---|---|---|---|
| L01 facturación-afip | 181 | | L07 ingresos y presupuestos | 102 |
| L06 soporte e inteligencia | 124 | | L08 gastos y clientes | 99 |
| L05 shell y design-system | 114 | | L04 mi-día y BI | 98 |
| L02 chat, HITL y voz | 112 | | L09 conexiones y ajustes | 82 |
| L03 auth y legal | 108 | | L10 agenda·admin·captura·DLQ·grafo | 69 |
| | | | L11 transversal | 57 |

## §4 · Controles cruzados mecánicos (independientes del juicio de cualquier agente)

### 4.1 · Cruce llamada-del-front ↔ ruta-del-backend

Instrumento **ya existente en el repo** —`barrido-superficie-front-backend.py`, v7 autocontenido:
lee todo de `git show <ref>`, así que corre desde cualquier worktree y otra sesión lo reproduce.
Corrido contra `6278836a`. Su unidad de comparación es la **llamada** `(verbo, ruta)`, no el
archivo: un archivo del front llama muchas rutas, y contar archivos mide una población que no es la
que se quiere verificar. **Control positivo embebido: 3/3.**

Denominador: **81 llamadas en 35 archivos del front** contra **108 rutas en 129 archivos del backend**.

| veredicto | n | lectura |
|---|---|---|
| `OK` | 61 | la forma que el front declara coincide con la que el handler devuelve |
| **`DIFIERE`** | **0** | ninguna costura donde el front espere claves que el backend no manda |
| **`SIN_HANDLER`** | **0** | ninguna llamada del front apunta a una ruta que no existe |
| `NO_CONCLUYENTE` | 3 | la lista del handler es parcial: habilita OK, no acusa |
| `SIN_FORMA` | 9 | genérico `unknown` sin estrechamiento legible |
| `HANDLER_OPACO` | 8 | el backend no expone forma legible: **no acusa al front** |

Comparadas con veredicto real: **61 de 81 = 75%**. Lo no comparado no es un hallazgo: es
**cobertura del instrumento**, y se declara en vez de redondearse hacia arriba.

### 4.1.bis · La discrepancia entre instrumentos: explicada, no promediada

Los dos instrumentos no dieron el mismo número de rutas —**108** (barrido) vs **110**
(inventario)—. Un número sin método se deja citar para cualquier pregunta, así que la diferencia se
resolvió con un **tercer método independiente**: `grep -rnE '@(app|router)\.(verbo)\('` sobre
`apps/copiloto`, `motor` y `deploy`, excluyendo tests. Resultado: **111 decoradores en 11 archivos**.

Diferencia contra el inventario: **exactamente 1, e identificada** —
`apps/copiloto/web.py:1443` → `@app.post(RUTA_CANARIO)`, que es **`POST /salud/canario`**
(`apps/copiloto/canario_autosanacion.py:51`, importada en `web.py:54`). En el otro sentido: **0**. La
ruta de esa línea no es un literal sino una **constante**, y la regex del inventario exige literal.

> 🔍 **Ceguera conocida del inventario, declarada: no ve rutas cuyo path viene de una constante.**
> Hoy hay exactamente **una** en todo el repo y es un canario de verificación de deploy, no una
> capacidad del producto. Pero la ceguera es estructural, no anecdótica: si mañana se definen rutas
> por constante, el inventario las omitiría **en silencio**, y un instrumento que no mira nunca
> falla.

Cifras finales, cada una con su método:

| cifra | método | qué incluye |
|---|---|---|
| **111** | grep de decoradores (3er método) | todos los decoradores de ruta del backend |
| **110** | inventario (`@app`/`@router` + literal) | las 111 menos la definida por constante |
| **108** | barrido front↔backend | su propio reconocedor; **cobertura menor, sin consecuencia**: parte de las 81 llamadas del front y dio `SIN_HANDLER = 0`, así que las 3 que no reconoce no produjeron ninguna acusación falsa |

De las 110, **3 no son capacidad para el emprendedor** sino superficie de infraestructura:
`/healthz` (monitoreo) y los dos callbacks `/mp/*` de MercadoPago (§4.2). El canario de
`web.py:1443` es la cuarta por la misma razón.

### 4.2 · La dirección inversa: rutas del backend que ninguna UI consume

El barrido mide front → backend y dio 0 `SIN_HANDLER`. La dirección que nadie medía es la otra:
**capacidad implementada en el backend que ninguna UI usa**. Para el relevamiento importa, porque
«existe en el backend» y «el emprendedor puede usarlo» no son el mismo veredicto.

Instrumento propio (`rutas-huerfanas.py`), **deliberadamente conservador hacia CONSUMIDA** para no
acusar en falso: no busca contra la lista de llamadas que reconoció la regex del inventario —el
front puede llamar por un wrapper que la regex no ve, y la ruta parecería huérfana sin serlo—, sino
el **literal de la ruta en los 775 archivos del front**. Si ni el literal aparece, nadie la llama
por ningún camino. **Control positivo** (`POST /afip/facturas` → consumida): OK. **Control
negativo** (ruta inventada → `NINGUNO`): OK.

| nivel | n |
|---|---|
| `EXACTO` (la ruta completa aparece literal) | 73 |
| `PREFIJO` (sólo el prefijo estático; esperado en rutas con `{id}`, que el front arma por template) | 33 |
| `AMBIGUO` (prefijo demasiado corto para concluir) | 1 |
| `NINGUNO` | 7 |

**Las 7 de `NINGUNO`, una por una — y ninguna es un hallazgo:**

| ruta | path | por qué no es huérfana |
|---|---|---|
| `GET /canario` ×4 | `docs/…/instrumentos/barrido-superficie-front-backend.py:396,401,407,413` | **no es producto ni es una ruta del backend**: son las rutas de juguete que el instrumento de auditoría monta sobre una app propia como control positivo (§3). La ruta del canario del producto es otra: `POST /salud/canario` |
| `GET /healthz` | `apps/copiloto/web.py:1439` | la consume el deploy (`deploy/copiloto/deploy.sh:453-458,505`, guard de SHA desplegado) y el monitoreo — por diseño |
| `GET /mp/callback` | `apps/copiloto/mp_web.py:24` | la llama **MercadoPago**, no el front — por diseño |
| `POST /mp/webhook` | `apps/copiloto/mp_web.py:42` | ídem: callback de un tercero |

> **Rutas del backend genuinamente sin consumo: 0.** Toda la superficie backend tiene consumidor,
> sea el front o un actor externo esperado. El dato vale por lo que descarta: no hay una capa de
> endpoints implementados que nadie use, así que el backlog no tiene que decidir qué hacer con ella.

**Una excepción que el instrumento no pudo evaluar, y que importa:** `POST /salud/canario`
(`web.py:1443`) es justamente la ruta que el inventario no ve por estar definida con constante
(§4.1.bis), así que quedó fuera de este cruce. Verificada a mano: **no tiene ningún consumidor
automatizado en el repo** —sus únicas apariciones son su definición, su constante y el import
(`canario_autosanacion.py:35,51`, `web.py:54,1443`)— y su propio docstring dice que se invoca **a
mano**, «con el Bearer de un usuario real». Es decir: el canario que sirve para detectar que el
ciclo de autosanación falla **callado** depende de que alguien se acuerde de llamarlo. Eso no es un
bug de código; es un disparador sin dueño.

### 4.3 · Activities y workflows definidos vs **registrados en un worker**

Tercer cruce mecánico, y el único que **ningún lote del fan-out cubre completo** porque los 35
activities están repartidos entre varios dominios. Un `@activity.defn` que ningún `Worker(...)`
registra es código que Temporal **nunca puede invocar**, y no da error al arrancar: simplemente no
corre.

Método conservador hacia REGISTRADO: no se parsea la estructura de la lista (frágil), se busca el
nombre como token en el texto de los dos workers —`worker_b.py`, `worker_soporte.py`— **más el
bloque de la lista** `ACTIVITIES_AUTOSANACION` que `worker_b` agrega
(`autosanacion_activities.py:891-895`). Del archivo de la constante se toma **sólo el bloque de la
lista**, no el archivo entero: ahí viven también las definiciones, y contarlas como registro sería
circular. **Control positivo** (`emitir_comprobante` → registrado): OK. **Control negativo**
(nombre inventado → no registrado): OK.

| | definidos | registrados | sin registrar |
|---|---|---|---|
| workflows | 10 | 9 | **1** |
| activities | 35 | 33 | **2** |

De los 3 sin registrar, **2 son de un spike** —`spikes/s1-interceptor-temporal/spike.py:85,90`
(`execute_tool_que_falla`, `SpikeS1Workflow`)— y es correcto que no estén.

**El tercero es un hallazgo real:**

> **`transcribe_voice`** — `motor/backend/agent/agent_activities.py:105`
> Definida con `@activity.defn`, **invocada por string** desde el workflow
> (`motor/backend/agent/conversation_workflow.py:300` y `:388`, `execute_activity("transcribe_voice", …)`)
> y **registrada por ningún worker**: no está en `_ACTIVITIES` (`worker_b.py:93-94`), ni en la lista
> explícita (`worker_b.py:369-379`), ni en `worker_soporte.py:131`.

Cuatro precisiones que **bajan la severidad** —el relevamiento del lote transversal las verificó
una por una— y que importan porque sin ellas el hallazgo se lee mucho peor de lo que es:

1. **El camino de voz de la app no pasa por ahí.** La transcripción vive en el **front-door**, con
   `GroqSTT` resuelto en el proceso web (`apps/copiloto/web.py:58-59`, `serve.py:314-316`), no en
   Temporal. Y no es un endpoint sino **cuatro**, todos en `web.py`: `POST /transcribir` (`:853`,
   dictado sin sesión que rellena un campo), `POST /chat/audio` (`:867`, voz del chat),
   `POST /soporte/chat/audio` (`:925`) y `POST /feedback/audio` (`:1000`).
2. **La rama no es alcanzable hoy, ni siquiera fallando.** El único emisor de `kind="needs_stt"` es
   el canal Telegram (`motor/clients/agent/channels/telegram.py:51`, cuyo comentario de línea 5
   declara la transcripción como *«Fase 2»*), y el copiloto **registra únicamente**
   `WebChannelAdapter` (`worker_b.py:286`, `worker_soporte.py:129`), que coacciona `kind` a
   `text`/`callback` (`motor/clients/agent/channels/web.py:30-32`) y no tiene `download_file`. No
   hay forma de llegar a esa rama con el cableado actual.
3. **Tampoco hay proveedor de STT registrado para ella.** `register_stt_provider`
   (`motor/backend/agent/agent_runtime.py:74`) **no tiene llamador de producción**: sólo lo invocan
   tests. Sin proveedor, la activity devolvería `{"text":"","error":"no_stt_provider"}`
   (`agent_activities.py:111-112`) — y el workflow **lee sólo `text` e ignora `error`**
   (`conversation_workflow.py:302-309,390-397`), así que toda causa produce el mismo mensaje.
4. **El test verde no puede verlo.** `test_conversation_workflow_react.py:338` y `:382` **definen su
   propia** `@activity.defn(name="transcribe_voice")` dentro del test. El test registra lo que
   producción no registra: pasa en verde exactamente por la razón por la que no detecta el problema.

> **Lo que el backlog tiene que decidir acá no es «arreglar un bug»: es que hay DOS implementaciones
> de STT** —la del front-door, viva, y la del workflow, latente y no registrada— y cualquier cambio
> de criterio de transcripción tiene que llegar a las dos o quedará a medias en una.

### 4.4 · Cobertura de tests por dominio (contraste de los `veredicto_evidencia`)

No dice si un test es bueno, ni si pasa por el camino de producción, ni si pasa hoy: eso lo
dictamina quien lo lee. Dice **cuántos casos existen por dominio**, y sirve como contraste — un
dominio con 0 casos no puede tener ninguna capacidad `EXISTE_Y_COMPLETO`, y un veredicto `SIN_TEST`
sobre un dominio con cientos de casos merece una segunda mirada.

**517 archivos de test · 5140 casos detectados.** Control positivo (`facturacion-afip` > 0): OK.

| dominio | arch | casos | | dominio | arch | casos |
|---|---|---|---|---|---|---|
| chat-hitl-voz | 60 | 669 | | soporte-feedback | 24 | 217 |
| *(sin-dominio)* | 86 | 598 | | inteligencia | 16 | 217 |
| facturacion-afip | 45 | 542 | | gastos | 15 | 191 |
| mi-dia-bi | 35 | 392 | | memoria-grafo | 13 | 169 |
| auth-legal | 45 | 384 | | admin | 12 | 166 |
| shell-navegacion | 42 | 350 | | autosanacion-dlq | 10 | 95 |
| clientes | 13 | 233 | | design-system | 16 | 84 |
| ingresos-cobros | 26 | 225 | | ajustes-config | 13 | 66 |
| presupuestos | 14 | 225 | | captura-escritorio | 5 | 53 |
| conexiones | 23 | 222 | | agenda | 4 | 42 |

> **Dominios con 0 casos: ninguno. Dominios sin ningún archivo de test: ninguno.** Eso descarta de
> entrada la hipótesis de que haya un dominio entero sin cobertura — lo que queda por decidir es de
> **qué calidad** es cada cobertura, que es precisamente lo que no se puede contar y hay que leer.

Los cinco dominios con menos casos —`agenda` (42), `captura-escritorio` (53), `ajustes-config`
(66), `design-system` (84), `autosanacion-dlq` (95)— son los candidatos naturales a
`EXISTE_PARCIAL` por evidencia, y el lugar donde el relevamiento por dominio tiene que ser más
estricto al mirar si el test toca el camino real.

---

### 4.5 · Tests que inspeccionan el texto fuente — y el guard que **fija** un defecto

Un lote reportó «tres tests inspeccionan texto fuente en lugar de ejercitar producción». Lo barrí en
**toda** la suite para ver si era local o general, y el resultado corrige el reporte en un punto y lo
agrava en otro.

**Primera medición, descartada por sobre-acusar.** El patrón amplio
(`read_text` · `open(*.py)` · `Path(__file__)` · `inspect.getsource`) da 18 de 190 archivos de test
del backend y 7 del front: **25**. Ese número es ruido. `Path(__file__)` casi siempre ubica un
fixture o la raíz del repo —`test_afip_factura_replay.py:34` apunta a un `.json` de fixture,
`test_rls_invariantes.py:93` lee el manifiesto `uc_tables.json`— y eso no es inspección de código.
Publicar 25 habría sido un falso rojo con apariencia de prudencia.

**El patrón inequívoco es `inspect.getsource`: cinco casos.** Los abrí los cinco:

| test | qué afirma sobre el texto | veredicto |
|---|---|---|
| `test_mi_dia_detector.py:120` | el SQL de `emitir` tiene `ON CONFLICT` con la tupla exacta | **guard legítimo** — su docstring cita la regla del repo *«idempotencia con un `if` tiene ventana»*: verifica que la idempotencia sea por índice, no por `if` |
| `test_mi_dia_tarjeta_store.py:35` | `crear_si_no_existe` tiene `ON CONFLICT … WHERE regla IS NOT NULL … DO NOTHING` | **guard legítimo de drift** — declarado: *«cazaría el drift si alguien edita uno de los dos lados sin el otro»* (el SQL vive en Python, el índice parcial en `mi_dia_migrations.sql`) |
| `test_trabajo_store.py:48` | el SQL literal arma el id igual que `workflow_id_de_factura` | **guard legítimo** — paridad SQL↔Python que no se puede verificar ejecutando; y la línea siguiente **sí** ejercita el comportamiento |
| `test_mi_dia_schedule_workflow.py:49` | el código contiene el chequeo `_conn_factory is not None` | **guard legítimo**, el más débil de los cinco: afirma presencia de texto, no que el chequeo dispare |
| `test_zero_mutation_autosanacion.py:131` | la rama del ciclo lleva el prefijo `autosanacion/` | **guard legítimo**, autodeclarado *«Guard de fuente»* |

**Corrección al lote:** los cinco son guards de drift **declarados y correctos en su clase**. Cuando
un SQL vive en Python y su índice en un `.sql`, la paridad entre los dos lados no se puede verificar
ejecutando sin una base real; el guard texto-vs-texto es la herramienta adecuada. El defecto no es
«leen el fuente».

**Y el hallazgo que ningún lote podía ver, porque vive entre dos de ellos:**

🔴 **El guard de `crear_si_no_existe` (`test_mi_dia_tarjeta_store.py:35`) fija el `DO NOTHING` que
causa el hallazgo 2 de §5.4** —la tarjeta de regla que no reabre aunque el hecho vuelva, rompiendo
la promesa que `mi_dia_detector.py:254-256` declara—. El test no está ciego: **está protegiendo el
comportamiento que rompe la promesa.** Pasa porque el defecto está *especificado*, y cualquier fix
de la reapertura va a **romper este test**, que lo va a reportar como drift.

Eso cambia el trabajo que el backlog tiene que presupuestar: el ítem no es «arreglar la reapertura»,
es «decidir cuál de las dos afirmaciones es la correcta —el `DO NOTHING` del guard o la promesa de
`conexion_caida`— y corregir la otra». Un guard de fuente no sustituye al test de comportamiento: en
este caso **ocupa su lugar**, y por eso la contradicción vivió sin dar síntoma.

Los 7 del front (`temaSinHex`, `paresPintadosContraste`, `presion`, `movimientoReducido`,
`inerteAlPerderFoco`, y los dos `*.contrato.paridad.test.ts`) son todos de la misma clase legítima:
guards de diseño y de paridad de contrato, cuyo objeto declarado es el texto. Ninguno entra al
backlog por esto.

**Control del barrido:** encontró, sin saberlo, los tres casos de mi-día que el lote había reportado
por su cuenta —corroboración cruzada de dos métodos independientes— y agregó dos que ningún lote
había nombrado (`test_trabajo_store.py`, `test_zero_mutation_autosanacion.py`). Control negativo: los
tests normales (`test_actividad_store.py`, `test_actividad_web.py`, `test_admin_auditoria.py`) no
aparecen entre los hits, así que el patrón discrimina en vez de marcar todo.

### 4.6 · Citas `archivo:línea` en comentarios que apuntan a una línea **vacía**

La clase «comentario que declara algo que ya no es cierto» llegó a ~14 miembros medidos en tres lotes
independientes (§5.4, §5.5, §5.6). Antes de tratarla como clase, la intenté barrer. El resultado
sirve, con dos límites que hay que leer antes de la cifra.

**La clase se parte en cuatro familias, y sólo una es mecánica.** Mirando los ~14 miembros:

| familia | ejemplo | ¿barrible sin juicio? |
|---|---|---|
| 1 · niega existencia | *«no lo escribe nadie todavía»*, *«no está instalado»* | ❌ requiere leer el código actual |
| 2 · afirma paridad | *«alineado con web»* | ❌ requiere comparar los dos lados |
| 3 · afirma mecanismo | *«long-poll»*, *«la tabla no tiene RLS»* | ❌ requiere entender el mecanismo |
| 4 · **cita una ubicación** | *«ver `[cita-exhibida] web.py:714`»* | ✅ **mecánica** |

Las familias 1-3 quedan **declaradas como no barridas**, en vez de barridas mal. Mi primer intento de
barrer la familia 1 por palabras clave encontró **2 de 14** y yo lo publiqué como «la clase tiene un
solo miembro» (corregido en §5.4): un control negativo que no encuentra nada acredita el patrón, no la
ausencia. No repito el error en las otras dos.

**Resultado de la familia 4** (`scratchpad/citas-rotas.py`, sólo lectura, idempotente): **169 citas
documentales** en el árbol; **144 resueltas**; **11 apuntan a una línea en blanco**.

| el comentario está en | cita | la línea citada |
|---|---|---|
| `packages/core/src/api/actividad.ts:125` | `apps/copiloto/web.py:141` | **vacía** |
| `packages/core/src/api/gastos.ts:165` | `apps/copiloto/web.py:141` | **vacía** |
| `packages/core/src/api/perfilNegocio.ts:138` | `apps/copiloto/web.py:141` | **vacía** |
| `packages/core/src/api/presupuestos.ts:239` | `apps/copiloto/web.py:141` | **vacía** |
| `packages/core/src/api/afip.ts:1075` | `afip_web.py:275` | **vacía** |
| `packages/core/src/api/ingresos.test.ts:16` | `afip_web.py:334` | **vacía** |
| `packages/core/src/api/http.ts:40` | `http.web.ts:41` | **vacía** |
| `apps/copiloto/tests/test_admin_errores.py:89` | `soporte_feedback_activities.py:93` | **vacía** |
| `apps/mobile/.../FormularioIngreso.idemKey.test.tsx:67` | `FormularioIngreso.tsx:301` | **vacía** |
| `apps/mobile/src/theme/glass/MarcoGlass.tsx:220` | `ChatView.tsx:207` | **vacía** |
| `deploy/copiloto/deploy.sh:383` | `worker_b.py:301` | **vacía** |

**Y hay un patrón dentro del patrón: cuatro clientes del core citan la misma ubicación muerta**
(`[cita-exhibida] web.py:141`). No son cuatro descuidos: es **un comentario copiado en cuatro archivos**, apuntando a
un lugar que se movió una vez y los rompió a los cuatro de golpe. Eso es información de diseño para el
backlog, no una errata: una cita de ubicación duplicada a mano tiene el mismo problema que el código
duplicado a mano, y el arreglo es el mismo (una fuente, o ninguna cita).

**Los dos límites, y el segundo importa más que la cifra:**

1. **El 11 es un piso, no un total.** 25 citas no se pudieron resolver porque el nombre es ambiguo
   (hay 2 `web.py` en el árbol, 2 `useChat.ts`, 47 `index.ts`) y el barrido descarta lo ambiguo en vez
   de adivinar. Entre esas 25 está un defecto que L02 ya había encontrado leyendo
   (`smoke_beta_e2e.py:158` cita `[cita-exhibida] web.py:714`, que verifiqué: **también está vacía**). O sea: el
   archivo más citado del repo es justamente el que el barrido no puede resolver.
2. **Este barrido NO caza el defecto que los lotes encontraron.** Los 7 casos reportados por lectura
   apuntan a líneas que **existen y dicen otra cosa** — ése es el defecto real, y detectarlo exige
   juicio semántico. Que este barrido dé 11 no absuelve a las otras 158.

#### Y el instrumento me mintió primero, en mis manos

Vale registrarlo porque es la tercera vez en este relevamiento y la primera en que el instrumento
roto fue mío. La primera corrida dio **«0 defectos duros»** y casi la publiqué como un
descarte. Dos cosas estaban mal:

- **El criterio medía la cosa equivocada.** Clasificaba como duro sólo lo *fuera de rango*; una cita a
  una línea que existe pero está **vacía** entraba como «en rango», o sea como sana. El defecto más
  común de la familia pasaba por el centro del filtro.
- **El volcado de revisión estaba truncado y no lo decía.** `UnicodeEncodeError` en `cp1252` al
  imprimir una flecha `→` mató el proceso después de 26 de 150 líneas, con el traceback **dentro** del
  mismo archivo de salida. Yo leí las primeras líneas —correctas— y corrí un `awk` sobre el resto:
  **conté «9 citas a línea vacía» sobre un archivo mutilado.** Ese 9 no era una medición; era un
  artefacto, y tenía exactamente la misma apariencia que el 11 real.

Las dos fallas se cazaron por el mismo motivo: **los casos conocidos no aparecían en la salida**. Un
barrido nuevo cuyo control positivo son hallazgos que otro ya encontró leyendo es la forma más barata
de saber si mira. Sin esos 7 casos de L02 y L03 como control, el «0» habría entrado al documento con
la misma cara que los números medidos — que es precisamente el modo de falla que §4.1.bis documenta
para los instrumentos ajenos.

### 4.7 · El mismo barrido, aplicado a **este documento** — y las dos cosas que encontró

El documento va a ser la base del backlog, así que cada `archivo:línea` que contiene es **portante**:
si apunta a una línea que no existe, el lector hereda la afirmación sin la prueba, que es el defecto
que todo este relevamiento persigue. Así que corrí el barrido sobre el propio documento
(`scratchpad/verificar-citas-del-cierre.py`, sólo lectura, con control positivo obligatorio de tres
canarios inyectados —uno por tipo de defecto— que **exige** cazar los tres o abortar).

**Medición, sobre 2.568 líneas y el árbol completo @ `6278836a` (2.471 archivos indexados):**

| | antes | después |
|---|---|---|
| citas `archivo:línea` | **507** | 507 |
| `NO_SUCH_FILE` — el archivo no existe | 1 | **0** |
| `OUT_OF_RANGE` — la línea excede el archivo | 3 | **0** |
| basename ambiguo, **irresoluble** | 31 | **0** |
| basename ambiguo, resuelto por el número | 41 | 41 |

⚠️ **Esta columna no fue la última palabra.** Al re-correr el barrido *después* de escribir
§4.7, el instrumento volvió a acusar **4 de estos ceros** — y tenía razón. El motivo, el
arreglo y la medición final están al **cierre de esta sección**; las cifras vigentes son
las de esa última tabla, no las de ésta.

**Los cuatro defectos duros, corregidos:** `paresPintadosContraste.tsx` no existe —el archivo es
`paresPintadosContraste.test.tsx`, y el documento cita **dos** archivos de nombre casi igual, uno por
plataforma— · `[cita-exhibida] inbound_router.py:43-66` cuando el archivo tiene 63 líneas (`poll_loop` llega al final)
· `[cita-exhibida] stt.py:55-70` con 69 · y `[cita-exhibida] package.json:38`, que es el más instructivo: el resolvedor lo encontró
**sin ambigüedad** porque la coincidencia exacta gana, y resolvió al `package.json` de la raíz, de 20
líneas, cuando lo que yo citaba era el de mobile. Una regla de desempate razonable eligió el archivo
equivocado **y reportó certeza**. Es la misma clase que §4.1.bis describe para los instrumentos
ajenos, cometida por el mío.

#### Y el hallazgo que sólo significa algo *en este documento*

Los 31 ambiguos irresolubles **no estaban repartidos al azar**: eran casi todos **gemelos web↔mobile**
—`FormularioCliente.tsx`, `TarjetaIngresoPropuesto.tsx`, `ThemeProvider.tsx`, `useChat.ts`,
`Composer.tsx`, `AvatarCuenta.tsx`, `FichaCliente.tsx`, `SeccionCobro.tsx`,
`GraficosInteligencia.tsx`, `PantallaFeedback.tsx`—, que es exactamente el conjunto de archivos sobre
los que este documento reporta, una y otra vez, que **el fix llegó a un solo gemelo**. En un informe
cuyo hallazgo recurrente es *«de los dos clientes gemelos, uno quedó sin el fix»*, una cita como
`[cita-exhibida] FormularioCliente.tsx:198` es la peor posible: **cuál de los dos gemelos es el punto entero**, y el
basename pelado lo borra. Los 31 quedaron calificados con un sufijo real y único del árbol
(`copiloto-web/src/…`, `mobile/src/…`, `packages/core/src/…`), verificado por el barrido.

#### El refinamiento que esto deja disponible para §4.6

La distinción que hizo utilizable el resultado fue **separar «basename ambiguo» de «cita irresoluble»**:
si el número de línea citado existe en **un solo** candidato, la cita se resuelve mecánicamente aunque
el nombre se repita. Aplicado acá, eso partió 72 ambiguos en **41 resolubles + 31 reales + 0 rotos
escondidos** — y ese último número importaba, porque un veredicto grueso («ambiguo») puede estar
**tapando** uno fino («roto»), y había que medir que no lo hacía.

**Ese mismo refinamiento desbloquea las 25 citas que §4.6 dejó sin resolver** por nombre ambiguo en
los comentarios del código. No es una idea: es un mecanismo ya escrito y con control positivo
(`scratchpad/medir-ambiguedad-citas.py`). Queda como ítem barato del backlog —extenderlo al barrido
del código— y el «11» de §4.6 deja de ser un piso con 25 casos opacos para pasar a ser un piso con 25
casos **clasificables**.

#### Y corrido: el refinamiento cerró 18 de 19, y destapó **dos defectos reales**

No lo dejé como ítem: lo corrí (`scratchpad/resolver-ambiguas-del-codigo.py`, sólo lectura, sin tocar
el instrumento original para que su medición siga siendo reproducible). Dos desempates, ninguno con
juicio semántico: **por rango** (si la línea citada existe en un solo candidato, la cita se resuelve
sola) y **por acuerdo** (si todos los candidatos coinciden en el veredicto, el **veredicto** queda
determinado aunque la **referencia** siga ambigua — no hace falta saber a cuál apunta para saber si
rompe).

| | |
|---|---|
| citas ambiguas halladas | **19** |
| decididas por rango | 10 |
| decididas por acuerdo | 8 |
| cerradas a mano, por contenido | 1 |
| siguen indecidibles | **0** |
| **que ROMPEN** | **2** |

⚠️ **19, no 25, y no las reconcilio.** El «25» de §4.6 salió del barrido original con su propio
criterio de conteo; este 19 sale del mío (citas en línea con marcador de comentario, cuyo basename es
ambiguo y que no resuelven relativas al archivo que cita ni a la raíz). **Son dos mediciones
distintas con el mismo nombre**, y escribir «cerré las 25» sería exactamente la falla que este
documento cataloga. Lo que se puede afirmar: de las ambiguas que mi criterio ve, quedaron **19 de 19
clasificadas**.

**La última no la cerró un desempate: la cerré leyendo.** `apps/mobile/src/modules/apps/PantallaApps.tsx:174`
cita `[cita-exhibida] auth/oauth.ts:3-9` y hay cuatro `oauth.ts` en el árbol; dos tienen esas
líneas y **discrepan** (una está en blanco ahí, la otra no), así que ni el rango ni el acuerdo
alcanzan. La resolví por contenido: el comentario invoca *«el mecanismo que el operador rechazó por
su nombre para el login (BETA-4b, 2026-08-05)»*, y ese texto está literal en
`apps/mobile/src/modules/auth/oauth.ts:3-9` —*«ni Custom Tabs forzando Chrome ni ningún otro»*—
mientras que `apps/copiloto-web/src/auth/oauth.ts` no menciona BETA-4b ni Custom Tabs. **La cita
es correcta**, sólo venía sin calificar. Y eso deja la frontera del método dicha con precisión: los
desempates mecánicos cerraron **18 de 19**; la que sobró exigió abrir dos archivos y comparar lo
que afirman. Un instrumento que hubiera «resuelto» esa también estaría adivinando.

**Los dos defectos, verificados por mí — y los dos son referencias que DERIVARON, no erratas:**

1. `deploy/copiloto/smoke_beta_e2e.py:158` cita `[cita-exhibida] web.py:714` para afirmar que cada `/chat` arranca un
   `ConversationWorkflow` *«(`wf_id` en la respuesta)»*. `apps/copiloto/web.py:714` está **vacía**
   (cae entre `CambiarEmailIn` y `LoginIn`), y `wf_id` no aparece en ningún handler de `/chat` de ese
   archivo. La afirmación es la premisa del CLEANUP del smoke —por eso existe el comentario: sin
   cerrarlos quedaban *«2 RUNNING por corrida»*—, así que el puntero roto es el de un invariante
   operativo. **Dónde debería apuntar no lo afirmo: medí el defecto, no su destino.**
2. `packages/core/src/api/catalogo.ts:11` cita `[cita-exhibida] web.py:141` para explicar que el front-door monta un
   catch-all `@app.get("/{full_path}")` y que por eso una ruta no desplegada devuelve **405 y nunca
   404**. `[cita-exhibida] web.py:141` está **vacía**; el catch-all vive hoy en **`apps/copiloto/web.py:521-522`** — una deriva de
   380 líneas. Y este caso es el peor de los dos: el comentario trae una medición real (*«Medido
   contra el servicio vivo el 2026-07-21»*) y el puntero era su prueba de mecanismo. La medición
   probablemente sigue siendo cierta; lo que murió es la forma de comprobarla. Quien intente
   verificarla aterriza en una línea en blanco y puede concluir que el catch-all ya no existe.

**Por qué los dos estaban invisibles, que es la lección reusable:** `web.py` existe en más de un lugar
del árbol, así que el barrido original —correctamente prudente— no acusaba. **La prudencia del
instrumento se convirtió en el escondite del defecto.** Y la salida no fue agregarle juicio: fue
notar que el número de línea es, él mismo, un desempate.

#### 🔬 Y entonces el instrumento refutó **esta misma tabla** — el hallazgo más caro de §4.7

Volví a correr el barrido **después** de escribir todo lo de arriba. Acusó **3 `OUT_OF_RANGE` y 1
ambigüedad real**: exactamente las cuatro citas que esta sección declara en **0**. Y tenía razón —
son las citas rotas que §4.7 **escribe para reportarlas**: las de `inbound_router.py`, `stt.py`,
`package.json` y `FormularioCliente.tsx` están en el documento porque **son el ejemplo**. El
instrumento no distingue un defecto **cometido** de uno **exhibido** — y este párrafo, en su
primera versión, volvió a cometerlo: enumeraba los cuatro **con su número de línea** y sumó
cuatro acusaciones nuevas al barrido siguiente. La marca es necesaria, pero no escribir la cita
cuando el nombre alcanza es más barato.

**Por qué no es una curiosidad.** La tabla decía «después: 0» y el instrumento decía 4. Quien lo
re-corra —que es precisamente lo que invita a hacer— mide 4, lee 0, y concluye que el fix nunca
ocurrió. **Un informe refutado por su propio instrumento**, y el sentido del error es el peor
posible: la cifra limpia estaba en la prosa, la sucia en la medición. Es la misma clase que §4.1.bis
le reprocha a los instrumentos ajenos; la diferencia es que acá el falso no era el instrumento.

**El arreglo no fue aflojar la medición.** Las citas exhibidas llevan ahora una marca visible,
`` `[cita-exhibida] archivo.py:N` ``, y el verificador:

1. **las excluye de los defectos duros** — una cita que se cita no es una referencia que se afirma;
2. **las lista siempre, con su motivo** — una exclusión silenciosa es indistinguible de un
   verificador que dejó de mirar, así que el número de exenciones no puede crecer sin verse;
3. **tiene control positivo en los dos sentidos.** Una marca sobre una cita que resuelve limpia y sin
   ambigüedad es `MARCA_FALSA`, defecto duro: sin ese segundo sentido, la marca sería una licencia
   para tapar cualquier cita con sólo escribirle la etiqueta al lado. Los canarios obligatorios
   pasaron de 3 a **4 + 1 exhibida excluida**, y si alguno no se caza el script aborta.

**Dos correcciones de segundo orden, las dos de clases que este documento ya cataloga:**

- La marca se llamó primero `[cita-defectuosa]`. Afirmaba *«esta cita está rota»*, pero el defecto que
  el documento describe (*apunta a una línea en blanco*) **no es el que el instrumento puede ver**
  (*basename ambiguo*): la marca quedaba satisfecha por un defecto distinto del que declaraba. **Un
  nombre con dos referentes: se prueba uno y se concluye el otro.** `[cita-exhibida]` afirma lo único
  verificable —que se cita y no se afirma— y deja el juicio semántico afuera.
- El refinador (`medir-ambiguedad-citas.py`) **no conocía la marca**, así que seguía contando 1
  ambigüedad real donde el verificador ya contaba 0. **Dos instrumentos sobre el mismo documento con
  criterios distintos no se leen como «miden cosas distintas»: se leen como «uno de los dos está
  roto».** Comparten la marca.

**Medición final, con los dos instrumentos de acuerdo:**

| | medido |
|---|---|
| citas `archivo:línea` en el documento | **766** |
| `NO_SUCH_FILE` · `OUT_OF_RANGE` · `ILEGIBLE` · `MARCA_FALSA` | **0 · 0 · 0 · 0** |
| basename ambiguo, **resuelto por el número de línea** | 37 |
| basename ambiguo **irresoluble** | **0** |
| citas rotas que el `AMBIGUO` estaba tapando | **0** |
| citas **exhibidas**, excluidas y listadas | 13 |

⚠️ Esta tabla mide **esta** versión del documento —la de 766 citas—: se re-corre al incorporar los
lotes que falten, porque cada bloque nuevo trae citas nuevas — el barrido es parte del cierre,
no un trámite de una vez.

⚠️ El refinador lista **11** exhibidas y el verificador **13**, y la diferencia —exactamente 2— no se
tapa: son **las dos apariciones** de `[cita-exhibida] package.json:38`, que resuelve por
coincidencia **exacta** contra el `package.json` de la raíz, así que el refinador la da por
resuelta antes de llegar a mirar la marca. Es la misma regla de desempate que ya
había elegido el archivo equivocado *reportando certeza* —el cuarto defecto duro de esta sección—, y
el hecho de que ahora produzca una discrepancia de conteo en vez de una cita errónea es lo único que
cambió.

---

## §5 · Relevamiento por dominio

### §5.11 · L11 — capa transversal (cliente HTTP, errores, catch-all, motor, sondas)

**Cobertura: 53 de 57 elementos.** Los 4 no mirados son los `GET /canario` del instrumento bajo
`docs/**` (§3): no se abrieron **por la regla dura**, que es la respuesta correcta.
**Control positivo:** `GET /healthz` existe (`web.py:1439-1441`) y se prueba contra la app real
(`tests/test_web_app.py:444-469`). **Control negativo triple:** no existe `GET /canario` (la real es
`POST /salud/canario`), no existe ninguna ruta de *readiness*, y `transcribe_voice` no está
registrada — cada uno con su propio control positivo del mismo grep, para probar que la búsqueda ve.

**El grafo (7 consultas) no se contradijo con el código ni una vez**, y dejó dos lecciones sobre su
uso: (a) la arista `transcribir.ts → postMultipart` **no apareció con `limit=15`** y sí con una
consulta angosta — fue **truncamiento del límite, no hueco del grafo**, lo que convierte a un
`limit` bajo en una fuente de falsos «no existe»; (b) el grafo **no puede** responder «esta activity
no está registrada en ningún worker» ni «quién consume el barrel»: eso es silencio estructural, no
desacuerdo, y se resuelve con grep sobre archivos.

| veredicto_codigo | capacidades |
|---|---|
| `EXISTE_Y_COMPLETO` | **9** (contados sus bloques; ver abajo: **el «7» que decía esta fila lo inventé yo, el lote nunca reportó un total**). De los 9, el propio lote sostiene **3**: `POST /transcribir` · `/healthz` sólo como *liveness* · ReAct (`call_llm_tools`/`execute_tool`, con reserva). |
| `EXISTE_PARCIAL` | 17 |
| `NO_EXISTE` | 1 — la ruta `GET /canario` que nombraban los elementos de `docs/**` |

**Lo que este lote aporta al backlog, en orden de lo que más cuesta si se ignora:**

1. **El catch-all de la SPA SÍ puede devolver HTML con 200 a una llamada de API** — y se verificó
   **empíricamente**, montando la función real `_mount_spa` (`web.py:498-529`) sobre una app con una
   ruta POST y un `dist/index.html` temporal: un `GET` a ruta inexistente devolvió **200 text/html**,
   y también un `GET` a una ruta que sólo acepta `POST`. Los métodos de escritura dan 405 JSON y
   `/assets/*` da 404 JSON. En el cliente eso se convierte en `SyntaxError` crudo
   (`packages/core/src/api/client.ts:195`), que **26 sitios** de core traducen a `no_disponible` y
   `motivoDeError` rotula `'red'` (`motivoFallo.ts:41-45`). El test que debería cubrirlo
   (`tests/test_spa_mount.py`) usa **una app de juguete con su propio `/healthz`**, así que no puede
   verlo: ningún test afirma un 404 JSON para un GET a una ruta de API inexistente con el catch-all
   montado. **Cada dominio reimplementó su propia guarda de forma** (`actividad.ts:122-135`,
   `clientes.ts:129`, `gastos.ts:163`, `perfilNegocio.ts:150`, `presupuestos.ts:247`,
   `admin.ts:50-62`): la raíz nunca se tocó.
2. **Dos clientes HTTP gemelos, y cuatro fixes llegaron a uno solo.** Core
   (`packages/core/src/api/client.ts`) tiene timeout→`ApiError(408)`, `body`, `codigo`/`diferido` y
   `motivoDeError`; el cliente propio de la web (`apps/copiloto-web/src/lib/api/client.ts`) hace
   `fetch` **sin AbortController** (`:135-201`) —un request colgado espera para siempre, el 408 no
   existe—, lleva `extra` en vez de `body`, descarta `codigo` y `diferido` (`:110-133`) y sólo tiene
   get/post/delete contra los cuatro verbos de core. Peor: **`ApiError` está definido dos veces con
   el mismo `.name`** (`core/errors.ts:2` vs `copiloto-web/src/lib/api/client.ts:9`), así que un `instanceof` del core
   **no reconoce** un error del cliente web, y `motivoDeError` alimentado con uno devolvería siempre
   `'red'`. El propio código lo admite en un comentario (`packages/core/src/api/index.ts:39-44`).
3. **Más duplicación del mismo tipo:** `generarId` existe **tres** veces (web, mobile y una copia
   local en `copiloto-web/src/modules/facturacion/SeccionCobro.tsx:71-73` **sin el fallback**, que genera la clave de gesto de cobro);
   `getReply` dos veces; el adaptador `httpWeb` es copia del de mobile **y la copia web no tiene
   tests** mientras la mobile sí; y la validación de audio está **triplicada** en `web.py` —el helper
   `_transcribir_audio` (`:820-851`) más dos copias inline en `:937-953` y `:1006-1022`—, con un test
   que cuenta «2 llamadas y 1 definición» (`test_transcribir.py:94-100`) y por eso **no ve las
   copias**.
4. **Código escrito e inalcanzable:** `needsReconnect` devuelve **constante `false`**
   (`ModeButton.tsx:21-23`), así que el badge RECONECTAR (`:57`) no se alcanza nunca; cuatro exports
   del barrel de core (`codigoDeConflicto`, `mensajeDeConflicto`, `esDiferido`, `postMultipart`) **no
   tienen importador en `apps/`**; `register_stt_provider` y `register_staff_notifier` sólo los llaman
   tests; y `spikes/s1-interceptor-temporal/spike.py` está huérfano —nada lo referencia, y el gate de
   replay no lo ve porque sólo escanea `apps/copiloto` y `motor`.
5. **La escalación a staff puede perderse en silencio.** El workflow llama `notify_staff`
   (`conversation_workflow.py:344-348`), **no lee su resultado** y espera hasta **4 horas** una
   decisión humana (`:349-354`); si vence, `pass` y sale la respuesta original. Sin notificador
   registrado —que es el estado actual— `notify_staff` devuelve `{"notified": False}` con un warning
   (`agent_activities.py:94-96`) y **nadie recibe el aviso**, pero la espera ocurre igual.
6. **Pantallas con filas inertes**, que importan porque se ven como funcionalidad: en
   `AccountScreen.tsx`, Idioma es un `div` sin handler (`:133-139`), Notificaciones es un toggle con
   `useState(true)` que **no persiste nada** (`:61-75`, y el comentario de `:56-59` lo admite), «No
   molestar» no tiene `onClick` por diseño y «Privacidad del historial» es un `div` con chevron.
7. **El fix del turno roto no alcanza a las sesiones vivas.** `conversation_workflow.py:221-230`
   protege el turno con `workflow.patched(...)`; las ejecuciones **previas al patch** caen en la rama
   `else` **sin catch** (`:231-233`) y, por la memoización de `patched()` por run, el fix las alcanza
   **recién tras un continue-as-new**. Ningún test nombra ese patch.
8. **Tres comentarios que contradicen al código** —y un comentario que declara algo ciega la
   búsqueda del próximo: `apps/mobile/app/_layout.tsx:160-164` dice que `recientes` es inalcanzable
   cuando está cableada (`PantallaPrincipal.tsx:179`); `actividad.ts:124-125` ubica el catch-all en
   `[cita-exhibida] web.py:141` cuando está en `:521`; y `motivoFallo.ts:29-32` afirma que «sólo se afirma red cuando
   hay evidencia de que nunca hubo respuesta HTTP», que es lo contrario de lo que hace `:41-45`.

**Honestidad del propio reporte** (vale tanto como los hallazgos): declaró que el catch-all lo probó
con `fastapi 0.136.3`/`starlette 0.52.1` locales cuando el repo pinea `0.138.2`/`1.3.1`, que leyó el
comportamiento del SDK de Temporal en `1.30.0` local contra el `1.28.0` pineado, y que el valor vivo
de `COPILOTO_ENGINE_MODE` **no es verificable desde el repo** porque las unidades systemd leen un
`EnvironmentFile` fuera de él (`uc-copiloto-web.service:11-13`).

### §5.10 · L10 — agenda · admin · captura/escritorio · autosanación-DLQ · grafo

**Cobertura: 69 de 69 elementos**, cada uno abierto en su archivo y confirmado en la línea. Además
leyó 11 módulos del backend fuera del lote, el deploy, el gate y el CI **para trazar la cadena de
punta a punta** — que es lo que permitió los hallazgos de abajo. **Cinco controles negativos**, cada
uno con su propio control positivo del mismo grep.

**El grafo aportó localización y confirmó posiciones de nodo, pero este lote documentó ocho límites
suyos que conviene no olvidar** —y ninguno es una contradicción, son silencios:

- **Aristas espurias:** `File autosanacion_activities.py indirectly calls Function marcar_trauma()`
  es falso — el archivo sólo las **define** (`:176-177`, `:735-736`); quien las invoca es el workflow
  **por nombre string** (`autosanacion_workflow.py:77-78,154-158`).
- **Las aristas `CALLS` son a nivel de clase**, así que el grafo **no puede distinguir un método
  muerto**: `TraumaStore` figura como llamada aunque `.rescatar_colgados()`, `.tomar()` y
  `.hermanos_del_mismo_bug()` no tengan llamador de producción.
- **Invisible por diseño:** todo lo que Temporal invoca por string, los Schedules y la navegación por
  string. El grafo **no responde «quién invoca esta activity o esta ruta»**.
- **Las aristas a nivel archivo esconden el uso real:** `HudGrabacion.tsx imports useCronometro.ts`
  oculta que sólo importa `formatoMMSS` y que `useCronometroGrabacion` **no tiene llamadores**.
- Tipos e interfaces figuran como `Function`; los `source_file` **pierden el prefijo** `apps/` o
  `packages/`; hay colisiones de nombre (`ensure_schedule` está definida 4 veces); y el grafo **no
  tiene estado de activación** (no puede ver que una capacidad está apagada por config).

**Los hallazgos, por lo que cuestan si se ignoran:**

1. **La memoria conversacional está construida, registrada, pre-calentada desde la web… y apagada en
   producción.** `extra_config={"memory": False}` en `apps/copiloto/web.py:813` y `:880`, y **nada en
   todo el repo la pone en `True`** (verificado por mí: grep de `"memory": True`/`memory=True` sobre
   `apps`, `motor`, `packages`, `deploy`, `scripts` → **vacío**). El workflow gatea con ella en cuatro
   puntos (`conversation_workflow.py:128,166,238,543`), así que `recall` y `remember` **no corren**.
   `POST /warm` sí se dispara desde la web (`copiloto-web/src/modules/chat/useChat.ts:52,337`) y por lo tanto hoy **no tiene
   consumidor**; mobile no lo llama.
   > ⚠️ **No es deuda ni olvido: es una decisión deliberada escrita en el código** — el comentario de
   > ambas líneas dice *«hito 5 §2: apagada — el copiloto recibe órdenes y las ejecuta»*. Lo que el
   > backlog tiene que decidir no es «arreglarla» sino **si se abre el gate**. Y el único test de
   > aislamiento contra Graphity real (`test_memory_isolation_live.py:73`) **se saltea en el gate**,
   > así que abrirlo exige evidencia nueva, no la existente.
2. **El rescate de la DLQ está escrito y nadie lo llama.** `TraumaStore.rescatar_colgados`
   (`trauma_store.py:278`) se cita como la red de seguridad en dos docstrings
   (`autosanacion_workflow.py:175`, `autosanacion_activities.py:187`) pero **no tiene llamador de
   producción**: sus únicas llamadas están en `tests/test_trauma_store.py:247,251`. Y
   `AutosanacionWorkflow.run` **no tiene try/except** (grep `-c` = 0; control positivo:
   `afip_factura_workflow.py` tiene 14). Si una activity revienta después de `tomar` —por ejemplo la
   llamada al LLM, que no tiene try/except en `autosanacion_activities.py:336-338`— el trauma queda
   en `en_proceso`, y `tomar_un_bug_distinto` **sólo elige `pendiente`** (`trauma_store.py:211`). La
   única salida que existe es **manual**: `POST /admin/errores/{id}/reintentar`.
3. **El control de ceguera del barrido admin tolera perder 3 rutas sin avisar.**
   `RUTAS_ADMIN_MINIMAS = 9` (`tests/test_admin_authz_barrido.py:48`) contra **12** rutas con
   `Depends(require_admin)` (verificado por mí: `grep -c` = 12). El guard en sí es sólido y **tiene
   test adversarial real** —sin claim → 403, escalada por `user_metadata` → 403, sin header → 401, más
   control positivo (`:95-132`)—, pero el umbral que debería avisar si una ruta queda sin guard está
   calibrado 3 por debajo de la realidad. Un umbral del día envejece con el corpus.
4. **La cadena de autosanación no se ejercita en ningún test del gate.** `forjar_parche`,
   `auditar_parche` y `probar_parche_en_sandbox` sólo tienen llamadas directas bajo `necesita_llm`
   (`OPENAI_API_KEY`), y **el gate no reenvía esa clave** (`scripts/gate.sh:194-225`,
   `sync-test-backend.sh:53-60`; el CI sólo define `DATABASE_URL`, `UC_RLS_FORCE`, `PGPASSWORD`).
   Lo mismo con `GRAPHITY_BASE_URL`/`API_KEY`. Es decir: **el ciclo que repara bugs corre en
   producción sin que ningún test del gate lo haya ejercitado**.
5. **Un workflow registrado cuyo Schedule nadie crea.** `SoporteFeedbackWorkflow` está registrado
   (`worker_b.py:54,368`) pero **a `deploy/worker/ensure_soporte_feedback_schedule.py` no lo invoca
   nadie**: `deploy.sh` sólo llama los `ensure_*` de mi-día (`:315-324`), autosanación (`:327-357`) y
   grafo-sync (`:359-372`).
6. **Cinco herramientas operativas sin invocador**, citadas sólo en docstrings:
   `verificar-autosanacion.py`, `verificar_autosanacion.py`, `e2e_autosanacion_trauma_real.py`,
   `ensure_soporte_feedback_schedule.py` y la ruta `POST /salud/canario` (§4.2). El canario tiene test
   del camino real (`test_canario_autosanacion.py:116`) y **quien debería leer su resultado tampoco
   tiene invocador**.
7. **Falta de DSN = fallo silencioso diferido.** Sin `COPILOTO_AUTOSANACION_DSN` el worker imprime
   *«autosanacion: OFF»* **pero registra el workflow igual** (`worker_b.py:355-359`), el Schedule
   sigue disparando (`deploy.sh:346-349` sólo advierte) y el primer paso llama `None()`
   (`trauma_store.py:190`). **Sin test.**
8. **La captura global de errores del front no llega a ninguna parte.** `instalarCapturaGlobal`
   instala los listeners y se invoca al arrancar **sin argumento** (`main.tsx:17`), así que usa el
   reporter por defecto, que **sólo hace `console.error`** (`errores-globales.ts:32-35`). **No existe
   endpoint de ingesta de errores del cliente** (control negativo con control positivo de la regex),
   así que esos errores nunca entran a la DLQ. Los 4 tests **inyectan su propio reporter**: el de
   producción no se ejercita.
9. **Código muerto en mobile:** el componente `HudGrabacion` (`:218`) **no tiene montaje de
   producción** —sus únicas referencias son tests de contraste—, `useCronometroGrabacion`
   (`useCronometro.ts:23`) tiene **0 llamadores y 0 tests**, y el archivo sigue vivo sólo por los tres
   botones que exporta y que sí se usan vía `ControlesFlotantes.tsx:5`.
10. **Tres tests que no tocan lo que dicen probar:** el del intérprete del sandbox **repite la
    expresión** `os.environ.get(...) or sys.executable` en vez de llamar al código de producción
    (`test_autosanacion_e2e.py:473,484` vs `autosanacion_activities.py:423`); el de dos tenants del
    sync al grafo **no siembra eventos del otro tenant**, así que el filtro `WHERE cliente_id` del
    lector real no tiene test adversarial (`test_grafo_sync_activities.py:205-211`); y el aislamiento
    cross-tenant del log usa **un lector propio del test** en vez del de producción
    (`test_grafo_log.py:221-237`).
11. **El parser de la agenda sigue declarado como supuesto no verificado.** `_eventos_de`
    (`mi_dia_web.py:107-130`) es una heurística recursiva marcada `[ASSUMED_PENDING_VERIFY]`
    (`:17,110`), y el único test contra Composio real está gateado por entorno **y usa su propia copia
    de la heurística** (`test_e2e.py:34-45,78`), no la de producción.

**Lo que este lote confirma que está sólido** (y por eso no debería entrar al backlog): el control
de acceso admin con su barrido adversarial sobre las 12 rutas reales; el aislamiento por tenant de la
lectura de agenda, con test adversarial A-no-lee-lo-de-B (`test_adversarial_multitenant.py:330,359`);
la selección cross-tenant del bug a reparar con `FOR UPDATE SKIP LOCKED` y sus dos adversariales de
aislamiento de la DLQ; la entrega del arreglo, que **nunca mergea** y falla en voz alta si no toca
exactamente una fila (`autosanacion_activities.py:765`); y el log de eventos de negocio con 11
llamadores de producción en 6 stores.

> 🔧 **Defecto de mi propia partición, reportado por el lote:** el inventario rotuló
> `registrar_evento` (`apps/copiloto/evento_store.py:55`) como dominio **agenda** por la palabra
> «evento», cuando funcionalmente es el **log del grafo de negocio** y no tiene relación con el
> calendario. Es el mismo tipo de falla que los dos de §3: una clave de dominio demasiado genérica.
> No afectó la cobertura (el elemento se relevó igual, en este lote), pero sí habría torcido un
> conteo por dominio.

### §5.4 · L04 — mi día · BI / portada · actividad · perfil del negocio

**98 de 98 elementos abiertos.** Control positivo: `GET /mi-dia` (`apps/copiloto/web.py:1104`).
Control negativo: ningún cliente llama `PUT /gastos/{id}/imputacion` — comprobado con un grep del
literal en todo el front y acreditado con un control positivo que sí encuentra otras rutas.

#### 🔴 Hallazgo 1 — un pago de MercadoPago se cuenta DOS VECES en «Entró»

El hallazgo más caro del relevamiento, y el único que toca **dinero que el emprendedor lee en
pantalla**. Verificado por mí sobre el código, no sólo por el agente.

El webhook de MP, ante un pago `approved`, escribe en **dos** tablas:

| paso | archivo:línea | efecto |
|---|---|---|
| guarda el pago | `apps/copiloto/mp_web.py:53-54` | fila en `mp_payments` |
| **y además** registra un ingreso | `apps/copiloto/mp_web.py:55-59` → `_registrar_ingreso_mp` (`:65-71`) | fila en `copiloto_cobros` con `origen='mercadopago'` |

`ORIGEN_MP = "mercadopago"` (`apps/copiloto/cobro_store.py:55`) y `registrar_suelto` hace
`INSERT INTO copiloto_cobros` (`cobro_store.py:37` define `_TABLE`, el insert está en `:267`).
Está **cableado en producción**: `apps/copiloto/serve.py:155` pasa el `cobro_store_factory` real.

Y la definición única de «Entró» suma **las dos fuentes** con `UNION ALL`, sin filtrar por origen
(`apps/copiloto/inteligencia_queries.py:43-49`):

```sql
SELECT fecha AS dia, monto FROM copiloto_cobros WHERE cliente_id = %(cid)s   -- ← incluye origen='mercadopago'
UNION ALL
SELECT (occurred_at - interval '3 hours')::date, amount
  FROM mp_payments WHERE cliente_id = %(cid)s AND status = 'approved'        -- ← el MISMO pago otra vez
```

Grep de `origen` en toda la capa de queries: la única rama que filtra es la de facturas
(`:134`, `origen = 'factura'`). `_INGRESOS` no filtra. Un pago aprobado entra por las dos ramas.

**Qué infla:** `mes.ingresos`, `caja.saldo`, `variacion_pct`, `serie_mensual` y
`entro_vs_salio_detalle` — todo lo que la portada presenta como el dinero del mes.

**Por qué nadie lo vio — la cronología es la explicación, no una excusa:**

| fecha | commit | qué pasó |
|---|---|---|
| 2026-07-22 | `fc2219c1` | nace `_INGRESOS` con el `UNION ALL` y el comentario que lo justifica: *«`origen='mercadopago'` en `copiloto_cobros` está declarado pero **no lo escribe nadie todavía**»* (`inteligencia_queries.py:38-40`). **Era verdadero ese día.** |
| 2026-10-06 | `9e4a70dc` | COBROMP agrega el escritor. El comentario queda falso y **nadie barrió a su lector**. |

Ambos commits son ancestros del SHA ancla `6278836a`: **el defecto está en `main`.**

El código se contradice **a sí mismo dentro del mismo archivo**: la línea 38 declara que nadie
escribe `origen='mercadopago'`, y el docstring de `entro_vs_salio_detalle` (`:315`) lista
`mercadopago` como uno de los orígenes visibles de `copiloto_cobros`. Las dos no pueden ser
verdaderas. Un segundo comentario repite la premisa falsa en `cobro_store.py:52-54`
(*«no lo escribe nadie»*). Es el patrón ya pagado en este repo: **el comentario que declara un
estado del mundo apaga la búsqueda del próximo**, y un merge posterior lo volvió mentira sin
tocarlo.

**Por qué los tests pasan — cada uno mira una sola mitad de la costura:** el test de «Entró»
inserta el pago sólo en `mp_payments`; el test del webhook verifica sólo que quedó la fila en
`copiloto_cobros`. **Ninguno recorre webhook → portada.** El doble conteo vive exactamente en el
tramo que ningún test cruza.

**Alcance honesto de esta verificación:** es verificación de **código** —el escritor existe, está
cableado, la query suma sin filtrar, el literal coincide—, **no** una medición sobre datos de
producción: no se corrió SQL contra la base. Y el impacto *hoy* es nulo porque no hay tráfico real
(cero usuarios); se activa con el primer pago de MP de un emprendedor real.

##### La dirección del fix ya está escrita en el código — y el merge que «llegó el día» no la aplicó

El comentario de 2026-07-22 no sólo declaraba el estado del mundo: dejaba la **instrucción exacta**
de qué hacer cuando ese estado cambiara (`inteligencia_queries.py:39-40`):

> *«…el día que se unifiquen, la fila del `UNION` se saca de acá y ninguna cara se entera.»*

El 2026-10-06 llegó ese día —`9e4a70dc` unificó: el webhook ahora escribe el ingreso en
`copiloto_cobros`— y **nadie sacó la fila del `UNION`**. El autor original había previsto la
transición y dejado el paso escrito; el merge que la disparó no lo ejecutó. No es un defecto de
diseño: es un **barrido de llamadores que no se hizo**, con la instrucción a la vista.

**Corolario sobre el escritor: no es el error.** Barrido de las otras fuentes dobles del repo
(abajo) muestra que el feed de actividad (`apps/copiloto/actividad_store.py`) une siete fuentes y
**sólo mira `copiloto_cobros`, nunca `mp_payments`** (verificado: 0 menciones de `mp_payments` en
ese archivo). Antes del 2026-10-06, por lo tanto, un pago de MercadoPago **no aparecía en el feed
de actividad**. El mismo commit que rompió el agregado de «Entró» **completó** el feed. El fix
correcto es sacar la rama del `UNION ALL`, no quitar el escritor.

**La única incógnita que el fix tiene que resolver antes de aplicarse** —y que es de datos, no de
código—: sacar la rama del `UNION` deja afuera los pagos aprobados **anteriores** al 2026-10-06,
que no tienen fila en `copiloto_cobros` porque el escritor no existía. Los de monto ≤ 0 no cuentan
(`CobroInvalido` los descarta y **no son** ingresos: `mp_web.py:72-75`, correcto). Si existen pagos
previos, el fix necesita backfill o un corte por fecha. **Cuántos hay se mide con una query, no se
asume** — y con cero usuarios reales es probable que sean cero, lo que haría el fix de una línea.

##### Barrido: ¿caso único o clase? — dos barridos mecánicos, independientes de todo agente

| barrido | qué buscó | resultado |
|---|---|---|
| **A · el comentario** | comentarios del backend que declaran un estado del mundo (`no lo escribe nadie`, `todavía no`, `el día que`, `cuando se unifiquen`…) | **2 hits con mi patrón — y el patrón tuvo FALSO NEGATIVO.** El lote de soporte/inteligencia encontró **8** comentarios contradictorios leyendo, no grepeando (§5.6). Mi grep cazaba una *forma* del defecto, no el defecto. La clase NO tiene un solo miembro: tiene al menos ocho. |
| **B · la estructura** | todo agregado que sume dos fuentes (`UNION ALL` + sumas en Python), sin depender de que alguien dejara una advertencia | 9 `UNION ALL` en producción: 6 son el feed de actividad (**no doble-cuenta**, una sola de las dos tablas), 2 son este defecto (`:45` el agregado, `:338` el detalle), y el resto suma tablas disjuntas. |

El barrido B importa más que el A: **no depende de que el autor haya dejado un comentario.** Que
dé un solo defecto es un hallazgo que *descarta* —**el doble conteo no está esparcido: es uno**— y
vale tanto como el que acusa. Lo que el barrido A enseña es lo contrario, y sobre mí: un grep por la *forma* de un defecto («no lo escribe nadie») mide la forma, no el defecto. Los otros seis comentarios contradictorios no usan ninguna de mis palabras clave y mi barrido los declaró inexistentes. Un control negativo que no encuentra nada acredita el patrón, no la ausencia.

#### Hallazgos 2-4 · el auto-cierre cierra tarjetas que siguen vigentes (tres caminos distintos)

1. **No reabre.** `cerrar_resueltas` marca la tarjeta `hecha` sin borrarla
   (`apps/copiloto/mi_dia_tarjeta_store.py:92-95`), y `crear_si_no_existe` hace
   `ON CONFLICT DO NOTHING` contra un índice parcial. Una tarjeta de regla cerrada por auto-cierre
   **no vuelve aunque el hecho vuelva** — contradice la promesa que la propia regla
   `conexion_caida` declara en `apps/copiloto/mi_dia_detector.py:254-256`.
2. **El GET y el Schedule corren el mismo pipeline con entrada distinta.** El GET pasa
   `composio_conexiones` (`apps/copiloto/serve.py:284-285`); la activity no
   (`apps/copiloto/mi_dia_schedule_activities.py:35`) — aunque su docstring afirma que nunca
   divergen. Con auto-cierre, la divergencia no es cosmética: **cierra**.
3. Mismo efecto por la ventana de 200 presupuestos (`mi_dia_detector.py:304`).

#### Hallazgo 5 · `modo_ceremonia` se guarda, se valida y se muestra — pero nada lo impone

El único lector fail-closed (`modo_de`) y `completitud_dictada` **no tienen llamador de
producción**; las ramas 409 del cliente están dormidas. El modo es hoy un dato persistido y
visible, no un control de comportamiento.

#### Hallazgo 6 · campos que la UI lee y ninguna regla escribe

`datos.monto` y `datos.fecha` se leen en `packages/core/src/api/miDia.ts:109-110` y se muestran en
web (`MidiaScreen.tsx:382`) y mobile (`PantallaMiDia.tsx:623`). **Ninguna de las 8 reglas los
escribe.** Es la costura que ya tiene nombre en la memoria del repo: *leer un campo que nadie
escribe*.

#### Hallazgo 7 · dos reglas dependen de una imputación gasto→trabajo que ningún cliente escribe

El único camino escritor es `PUT /gastos/{id}/imputacion`, y **ningún cliente lo llama** (control
negativo del agente, con control positivo que acredita que el grep ve). Las dos reglas que
dependen de esa imputación no pueden dispararse en producción.

#### Hallazgo 8 · UI escrita e inalcanzable

- `ActividadScreen`: ninguna tab de producción setea `'actividad'` en shells web angostos.
- La ruta `/midia` de mobile no tiene navegador que la alcance.

Código que existe, nadie lo mide, y **no da síntoma** porque no se llega navegando.

#### Hallazgo 9 · el precheck consulta una tabla que no existe

`apps/copiloto/_precheck_midia_readonly.py:49,52` consulta `mi_dia_tarjetas`; la tabla real es
`copiloto_mi_dia_tarjetas`. Un precheck que no puede fallar porque no mira nada.

#### Hallazgo 10 · brechas de evidencia

- Tres tests inspeccionan **texto fuente** en lugar de ejercitar el camino de producción →
  `TEST_NO_TOCA_PROD`.
- Cinco endpoints con alcance por tenant **sin test hostil a nivel HTTP** → por la regla dura del
  repo (*«control de autorización sin test adversarial = control no verificado»*) quedan
  `EXISTE_PARCIAL`, no `EXISTE_Y_COMPLETO`.
- El elemento 9 del lote (`apps/copiloto/web.py:1482`) **es un comentario, no una ruta**: defecto
  de mi inventario, no del código.

#### Veredictos del lote

`EXISTE_Y_COMPLETO`: CAP-06, CAP-09, CAP-12, CAP-14, CAP-15b → **los cinco entran a la refutación
adversarial de §N.** El resto, `EXISTE_PARCIAL` por falta de test que recorra producción o por
costura abierta.

**Grafo vs código:** el grafo ubicó rápido las 8 reglas del detector y la capa de queries. No
conocía el cableado por string del Schedule (limitación estructural ya declarada en §5.10) ni
podía responder quién escribe `origen='mercadopago'` — eso salió del grep y del `git log -S`.

### §5.6 · L06 — soporte · feedback · consola de operador · inteligencia/BI · guía de capacidades

**124 de 124 elementos abiertos**, agrupados en 36 capacidades. El reporte más riguroso de los
cuatro recibidos: cada control negativo trae **su propio** control positivo. Profundidad declarada
como desigual (tests leídos por cabeceras y nombres de caso, no línea por línea; ningún test
ejecutado). Control positivo: `GET /inteligencia/portada` (`apps/copiloto/inteligencia_web.py:45`,
cableado en `serve.py:275-279`, SQL en `inteligencia_queries.py:188`, probado en
`tests/test_inteligencia_web.py:42`).

#### 🔴 Hallazgo 1 — la clasificación automática de feedback **no tiene disparador en producción**

Verificado por mí. `deploy/worker/ensure_soporte_feedback_schedule.py` crea el Schedule
`soporte-feedback-{cliente_id}` (cada 30 min, `:22`, `:42-62`), y **ningún archivo de deploy lo
invoca**: el único hit del grep en todo el repo es su propio docstring de uso (`:10`).

Control positivo del mismo grep, en el mismo archivo: `deploy.sh` **sí** invoca los otros tres
Schedules, explícitamente y numerados — `ensure_mi_dia_schedules.py` (`:315,:324`),
`ensure_autosanacion_schedules.py` (`:327,:356`), `ensure_grafo_sync_schedules.py` (`:359,:372`).
La ausencia no es un artefacto del método: es una asimetría dentro del mismo archivo.

Y el código está **completo**: la activity `procesar_feedback_pendiente_de_tenant`
(`soporte_feedback_activities.py:114-142`), el `SoporteFeedbackWorkflow`
(`soporte_feedback_workflow.py:18`), ambos registrados en el worker (`worker_b.py:368,:377-378`), y
`admin_salud.py:31` ya reconoce el prefijo `soporte-feedback-`. Todo armado y nada lo arranca.
**Ningún test los ejecuta** tampoco: el grep de sus nombres en `tests/` sólo devuelve la allowlist
del replay gate (`test_workflow_replay_gate.py:68`).

Para el backlog: esto no es «falta implementar», es «falta una línea en el deploy» — y nadie lo
habría notado, porque un Schedule que no existe no falla: simplemente nunca corre.

#### 🔴 Hallazgo 2 — el control positivo del filtro de capacidades **se neutralizó solo**

El lote reportó que un guard nombrado en el código no existe. **Verifiqué y es más fino que eso,
en los dos sentidos.**

`tool_catalog.py:374-376` declara, textualmente:

> *«`emitir_factura` queda declarada aunque todavía no exista (hito 9)… Es el control vivo del guard
> `test_facturar_por_voz_NO_esta_en_la_guia_todavia` — sin una entrada así, el filtro pasaría siempre
> sin filtrar nada.»*

- **El guard con ese nombre no existe** (grep vacío; control positivo: el mismo grep encuentra
  `test_la_guia_NO_promete_una_tool_que_no_existe` en `tests/test_plata_por_voz.py:527`). Pero
  **el control sí existe, renombrado**: ese test compara `capacidades_vivas()` contra
  `build_tool_catalog()` y falla si la guía promete una tool ausente del catálogo. El lote concluyó
  «no existe» **sobre el nombre**, no sobre el control, y tenía razón en eso: el comentario de
  `tool_catalog.py:376` cita un guard que no existe con ese nombre. El control existe renombrado.
- **Y el canario dejó de cantar.** `EMITIR_FACTURA_SCHEMA` **ya está** en `build_tool_catalog()`
  (`tool_catalog.py:450`) y `emitir_factura` sigue declarada en `_CAPACIDADES` (10 tools, medido).
  Así que la entrada que existía *para que el filtro tuviera al menos un caso que excluir* **hoy pasa
  el filtro**: no queda ninguna excluida. El guard sigue verde, pero verde-por-vacío — exactamente
  la situación que su propio comentario decía estar evitando («el filtro pasaría siempre sin filtrar
  nada»).

El propio test lo cuenta en su comentario interno: *«este test miraba la MISMA lista que el bug no
movía, así que estaba verde mientras la guía publicaba una tool podada. Lo cazó un control vivo.»*
El control vivo que lo cazó es el que acaba de quedar neutralizado.

#### Hallazgo 3 — ocho comentarios que contradicen el código (y refutan mi barrido)

Esto es lo que mi barrido A de §5.4 **no vio** y por qué:

| comentario | dice | el código |
|---|---|---|
| `tool_catalog.py:351,357,360-361,374-376` | `emitir_factura` no existe / no está en el catálogo | está en `build_tool_catalog():450`, schema en `:267` |
| `inteligencia_web.py:13-14` | el chat «todavía no está expuesto» | la ruta está en `:129` y cableada en `serve.py:256-279` |
| `[CONNECT]` en `core/src/api/inteligencia.ts:9-14`, `index.ts:336-338`, `PantallaInteligencia.tsx:28-31` | el endpoint no está publicado | existe (`inteligencia_web.py:45`) |
| `feedback_store.py:4-5` | «sin UI de admin en esta etapa» | existen `admin_web.py:72` y `:179` **y** su UI (`AdminScreen.tsx:191,:356`) |
| `admin.test.ts:413` | `/admin/soporte/tickets*` «todavía no existe en main» | están en `admin_web.py:157,:168,:198` |
| `inteligencia_chat.py:88-95` | nada escribe en el grafo `negocio-{cliente_id}` | existe un escritor al mismo group id (`grafo_sync_activities.py:82`, activity `:136`, registrada en `worker_b.py:376`, Schedules en `deploy.sh:359-372`) |
| `admin_soporte.py:12`, `test_admin_soporte.py:98`, `admin_errores.py:19` | citan `soporte_feedback_activities.py:90/:91/:93` | la activity está en `:98-99` |

Ninguno usa las palabras que mi grep buscaba. **Mi barrido midió una forma del defecto y declaró
que la clase tenía un solo miembro; la clase tiene al menos ocho.** Corregido en §5.4.

#### Hallazgo 4 — capacidades cableadas que ninguna UI alcanza

- **`POST /inteligencia/chat`** existe y está cableado, y **ninguna pantalla lo llama**: ambas usan
  `dejarPendiente` (`copiloto-web/src/modules/inteligencia/PreguntarInteligencia.tsx:20`, `mobile/src/modules/inteligencia/PreguntarInteligencia.tsx:24`).
  El cliente core `preguntarInteligencia` (`core/src/api/inteligencia.ts:206`) sólo aparece en el
  barrel y en sí mismo.
- **Los `?detalle=` de los tres gráficos** (`inteligencia_web.py:72,:91,:106`) tienen query probada
  (`test_inteligencia_queries.py:303,:334,:375,:467`) y **ningún disparador**: `onSegmentoClick` y
  `onSegmentoPress` se declaran en los cuatro componentes y nadie los pasa — lo dicen los propios
  archivos (`copiloto-web/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:22`, `mobile/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:28-31`).
- **`como_uso_la_app`**: el backend acepta la función (`web.py:887-923`) y el worker registra ambos
  dominios (`worker_soporte.py:123-127`), pero en web los dos shells enrutan esa función a otra
  pantalla (`AppShell.tsx:274-279`, `DesktopShell.tsx:198-203`), así que
  `WELCOME_TEXT.como_uso_la_app` (`SoporteScreen.tsx:21`) **no se alcanza**; en mobile no hay
  productor (sólo se empuja `soporte_tecnico`).
- **`cambiosDeConcepto`** (`core/src/api/conceptos.ts:296`) está exportada y **probada**
  (`conceptos.test.ts:250-264`), y ningún archivo de producción la referencia.
- **`NAV_ICONS.soporte`** existe y su propio comentario dice que no se renderiza (`navIcons.tsx:269-271`).

#### Hallazgo 5 — nombres y campos sin contraparte

- **`GET /admin/soporte` devuelve filas de *feedback* bajo la clave `tickets`** (`admin_web.py:76`;
  SQL sobre `copiloto_feedback` en `admin_soporte.py:49-61`), y el cliente web las tipa `FilaTicket`
  (`admin.ts:152,:201-204`) — mientras los tickets reales viven en `/admin/soporte/tickets`
  (`admin_web.py:157`). Un nombre con dos referentes, en la consola del operador.
- **`autor="agente"` es un tercer valor** que los tipos no declaran (`soporteTicket.ts:29-30`
  declara `'usuario'` y `'operador'`); las dos UIs muestran todo lo que no sea `'operador'` como
  «Vos» (`MiTicketScreen.tsx:144`, `PantallaTicket.tsx:136`), y la columna es `autor text NOT NULL`
  **sin CHECK** (`uc_tables.json:259`). El emprendedor ve como propio lo que escribió el agente.
- **`mes.rentabilidad`** es siempre `None` con queries (`inteligencia_queries.py:226`) y `"0.00"` en
  el fallback sin queries (`inteligencia_web.py:54-55`), y **un test fija ambos** comportamientos.

#### Convergencia con §5.4 — dos lotes llegaron al mismo hueco desde lados opuestos

El docstring de `inteligencia_queries.py:195-200` afirma que no existe asignación gasto→trabajo,
**y existe**: `TrabajoStore.imputar` (`trabajo_store.py:191`) y `margen_por_trabajo` con
`gastos_imputados` (`inteligencia_queries.py:445-481`). El lote de mi-día había encontrado la otra
mitad: el único camino escritor es `PUT /gastos/{id}/imputacion` y **ningún cliente lo llama**
(§5.4, hallazgo 7). Juntas, las dos mitades dan el cuadro completo: la maquinaria de imputación
está construida en los dos extremos —store y query— y **no tiene cómo recibir el dato**, mientras un
docstring declara que no existe y otro código la usa. Ningún lote solo podía ver esto.

#### Hallazgo 6 — dato estructural: la evidencia del backend vive detrás de `skipif`

Declarado por el lote y relevante para todo veredicto `TEST_EJERCITA_PROD` del backend: la mayoría
de esos tests están bajo `skipif` por `DATABASE_URL`, `COPILOTO_CONSOLA_DSN`, `OPENAI_API_KEY`,
`COPILOTO_AUTOSANACION_DSN` o `GRAPHITY_CODE_API_KEY`. **Sin esas variables, lo que corre son los
tests con fakes.** Qué provee el gate y qué no es una medición pendiente, declarada en §N+1.

#### Hallazgo 7 — sin test (lista cerrada del lote)

`GET /capacidades` · las cuatro rutas `/conceptos` del backend (`presupuestos_web.py:483,:491,:506,:527`)
· el cuerpo de `GET /admin/soporte` · `ComposerSoporte` (web) · todo
`web/modules/inteligencia/graficos/` · `AcumuladoAnual` de mobile · `soporteChat.ts` (web, duplicado
declarado del cliente de core) · `adminMarcarFeedbackEscuchado`. Cada vacío con su control positivo.

Y dos de robustez: **`limite` sin tope** en `/admin/errores` y `/admin/soporte`
(`admin_web.py:65-76`, `LIMIT %s` en `admin_soporte.py:60-61`) mientras auditoría, tenants y tickets
usan `min(limite, 500)` (`:88,:98,:165`); y **`useGrafico` sin try/catch** en web
(`copiloto-web/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:47-58`) y mobile (`:46-57`), mientras el cliente core relanza los
`ApiError` no manejados.

**Grafo vs código:** sirvió para localizar definidores y llamadores. Seis discrepancias declaradas,
dos nuevas respecto de los límites ya conocidos: un nodo `AudioRecorder.capacidades` **colisiona de
nombre** con las capacidades del lote (descartado abriendo el archivo), y una arista
«navIcons importa TabBar» resulta ser un **import de tipo** (`navIcons.tsx:3`), no dependencia de
runtime. Ninguna afirmación del grafo contradijo un hecho de archivo.

### §5.5 · L05 — cáscara, navegación y design system (web + mobile)

**114 de 114 elementos abiertos**, agrupados en 18 capacidades. Control positivo declarado: las 11
primitivas del design system web, todas consumidas en producción. Es el lote con más hallazgos de
**código escrito e inalcanzable** — no por casualidad: la cáscara es donde vive el cableado de
navegación, y un componente sin disparador no da síntoma.

#### 🔴 Hallazgo 1 — mobile pinta los tres hexes que web retiró, y **dos** quedan bajo AA sobre los fondos de mobile

Verificado por mí, hex por hex. El 2026-09-28, bajo `BL-Q4`, web reemplazó tres tokens por quedar
bajo el mínimo AA de 4,5:1, y dejó el motivo escrito en cada línea. Mobile conserva **los tres hexes
retirados**:

| token | web hoy (`design-system/themes.css`) | el hex que web retiró, y su ratio | mobile hoy (`src/theme/tokens.ts`) |
|---|---|---|---|
| acento / `--core` | `#A5462B` — 4,82:1 AA (`:106`) | `#B04A2E` — **4,38:1** | `ACCENT_TINTA_CLARO = '#B04A2E'` (`:448`) |
| éxito / `--ok-fg` | `#306654` — 5,36:1 y 4,59:1 (`:176`) | `#3C8069` — **3,77:1 / 3,23:1** | `exito: '#3C8069'` (`:519`) |
| peligro / `--danger-btn-bg` | `#AB3B4D` — 5,12:1 (`:182`) | `#c7455a` — **4,00:1** | `peligro: '#c7455a'` (`:387`) |

Tres de tres. No es una divergencia de paleta: es **el estado anterior de web, conservado**. Y los
ratios de la columna del medio no los calculé yo ni el agente — están escritos en los comentarios de
`themes.css`, puestos por quien hizo el fix.

**Y el comentario de mobile afirma lo contrario.** `tokens.ts:446-447` dice textualmente:

> *«Alineado con web, que ya hacía esto: `themes.css` usa `--core: #B04A2E` en pieles claras… Mobile
> era la excepción, no al revés.»*

Era cierto cuando se escribió. Después web cambió, y el comentario quedó certificando una alineación
que ya no existe. **Es el mismo mecanismo exacto del hallazgo 1 de §5.4** (el doble conteo de
MercadoPago): un comentario verdadero el día que se escribió, un fix posterior que no barrió a sus
dependientes, y la afirmación obsoleta apagando la búsqueda del próximo. Dos dominios sin relación,
el mismo modo de falla. Eso lo convierte en clase, no en caso.

En oscuro los tres coinciden. La divergencia es sólo en claro, que es la piel por default.

**Alcance, ahora medido — y la corrección importa.** Al entregar esto verifiqué la **identidad de los
hexes** y dejé escrito que *no* había recalculado contrastes. Lo recalculé en la segunda ronda, porque
L05 señaló que el *«bajo AA»* de la columna del medio es la medición **de web, contra el fondo de
web**. Tenía razón. Los ratios, calculados por mí con la fórmula WCAG sobre los hexes vigentes en
`6278836a`:

| sobre | acento `#B04A2E` | éxito `#3C8069` | peligro `#c7455a` |
|---|---|---|---|
| `#EFE6D2` — el `--bg` de **web** (`themes.css:96`) | 4,38 ❌ | 3,77 ❌ | 3,82 ❌ |
| `#F7F3EC` — el `fondoBase` claro real de **mobile** (`tokens.ts:514`) | **4,91 ✅** | 4,23 ❌ | 4,29 ❌ |
| `#F5EBD5` — superficie clara de mobile (`tokens.ts:509`) | **4,59 ✅** | 3,95 ❌ | 4,00 ❌ |
| `#FAF7EC` — superficie alta de mobile (`tokens.ts:509`) | **5,07 ✅** | 4,37 ❌ | 4,42 ❌ |

**Así que el defecto de accesibilidad es de dos tokens, no de tres.** El acento pasa AA sobre **todas**
las superficies claras de mobile que medí; éxito y peligro no pasan sobre ninguna. La identidad de los
tres hexes sigue siendo cierta y el ítem de backlog sigue existiendo —portar los tres mantiene la
paleta alineada, y el control positivo lo respalda: los tres hexes nuevos de web dan **5,41 / 6,02 /
5,48** sobre el fondo de mobile—, pero **el título original sobre-acusaba en un token** y el daño de
accesibilidad hay que declararlo por dos.

Mi medición reproduce las dos cifras de los dos lados: sobre `#EFE6D2` da exactamente los 4,38 y 3,77
que `themes.css` tiene escritos, y sobre `#F7F3EC` da exactamente los 4,91 / 4,23 / 4,29 que reportó
L05. Dos fuentes independientes convergiendo en los mismos decimales es lo que vuelve la corrección
aceptable sin un tercer cálculo.

#### 🔴 Hallazgo 1.bis — los contrastes de mobile se calcularon contra los fondos **de web**, en las dos pieles

Es la causa raíz del hallazgo anterior **y de mi propio error**, y es un defecto por derecho propio.
`tokens.ts:441-444` abre diciendo:

> *«Contrastes CALCULADOS contra el `fondoBase` real de cada piel, no estimados:
> claro `#B04A2E` sobre `#EFE6D2` = 4.38 · oscuro `#DE7250` sobre `#1E1610` = 5.63 ✅AA»*

Los dos fondos que cita **son los de web**: `#EFE6D2` es el `--bg` claro de `themes.css:96` y
`#1E1610` es el `--bg` oscuro de `themes.css:359`. Los de mobile son `#F7F3EC` y `#1A1512`
(`tokens.ts:514` y `:548`). O sea que el comentario **afirma el método correcto y aplica el
equivocado**, y en la piel oscura es peor: el token se corrigió a `#1A1512` —hay un comentario
inmediatamente abajo explicando que el código *«traía»* `#1E1610` y por qué se cambió
(`tokens.ts:545-547`)— y **la cifra de arriba quedó contra el fondo viejo**, que además es el de la
otra plataforma.

**Por qué esto vale más que las tres filas de la tabla:** un ratio de contraste **no significa nada sin
el fondo contra el que se midió**, y acá los números estaban bien calculados para una superficie que
en mobile no existe. Es la clase *«una cifra sin unidad se deja citar para cualquier pregunta»*, en su
forma más costosa: la cifra es verificable, reproducible y falsa para el sujeto al que está pegada. Y
funcionó en las dos direcciones — primero hizo que el comentario de mobile se declarara alineado con
web, y después me hizo escribir *«los tres»* en el encabezado de este documento. **Para el backlog el
ítem no es sólo cambiar hexes: es que todo ratio escrito en un comentario nombre su fondo**, que es lo
que el gate de mobile ya hace bien (excepciones por par con piso `min`,
`paresPintadosContraste.test.tsx:806-857`) y el de web no.

#### 🔴 Hallazgo 2 — las exenciones de contraste de web sobrevivieron a su motivo

`design-system/paresPintadosContraste.test.ts:110-117` mantiene cuatro tokens exentos del gate de
contraste, **en cualquier par** (lo dice su propia clave: *«se exime el token en cualquier par»*), y
**sin ningún chequeo de vigencia**. Tres de los cuatro motivos citan los ratios de los hexes que
BL-Q4 retiró:

| exención | motivo citado | lo que dice `themes.css` hoy |
|---|---|---|
| `--core` | *«4,38:1 en claro, decisión de diseño DEC-11/DA-4»* | **4,82:1** (`:106`) |
| `--danger-btn-fg` | *«AA-debt claro 4,00:1 escalada a planificación 2026-09-08»* | **5,12:1** (`:182`) |
| `--ok-fg` | *«AA-debt claro 3,77-3,95:1 escalada a planificación 2026-09-08»* | **5,36:1 / 4,59:1** (`:176`) |

No hace falta recalcular nada: **el archivo de tokens contradice a la lista de exenciones, dentro de
la misma carpeta.** Las tres exenciones citan deuda que ya se pagó, y mientras sigan ahí, el gate de
contraste **no mira** esos tres tokens en ningún par — incluidos los pares que todavía no existen y
que alguien pinte mañana. Una exención sin fecha de vencimiento se vuelve un agujero permanente en el
gate que la concedió.

La cuarta (`--identidad-word`, logotipo del splash, 2,86:1) **es legítima y no entra**: WCAG 1.4.3
exime logotipos, y la exención cita decisión y documento. Nombrarla junto a las otras tres sería
sobre-acusar.

#### Hallazgo 3 — escrito e inalcanzable, a escala de cáscara

Cinco casos, cada uno con el grep que lo acredita:

- **El Toast de web no puede mostrarse nunca.** Su único disparador es `avisarNoDisponible`, que sólo
  corre cuando `FUNCION_A_TAB[key] == null`, y **las seis claves de `funcionTabMap.ts:10-17` son
  no-nulas**. El componente, su test y su animación existen; la condición que lo enciende es
  insatisfacible con el mapa actual.
- **El modo por app no se puede activar.** `AppsModal` y `modeStore` están montados y probados, y
  **nada pasa `'apps'`**: ni `AppShell.tsx:123`, ni `DesktopShell.tsx:93`, y
  `AjustesScreen.tsx:23` tipa `onNavegarTab` sin esa opción. Así que el modo que
  `copiloto-web/src/modules/chat/Composer.tsx:91` lee **no tiene cómo encenderse**. Los propios comentarios lo admiten
  (*«sin caller real… rama viva a propósito»*) — está declarado, lo que lo vuelve decisión y no
  defecto; pero el backlog necesita saber que es una rama muerta deliberada, no una capacidad.
- **`Kit` y `StatusBar`**: 0 importadores fuera del barrel, no montados.
- **Tres de los 17 glifos de navegación** (`AppsIcon`, `AccountIcon`, `RecientesIcon`) están
  registrados y **nunca se pintan**.
- **La ruta `/midia` de mobile no tiene llamador** — 19 de 20 rutas sí lo tienen. A su pantalla se
  llega deslizando; a la ruta, sólo por deep link. (Converge con el hallazgo 8 de §5.4, que la había
  encontrado desde el otro lado.)

#### Hallazgo 4 — mobile no tiene navegación por tabs, y el único test que montaba el router real está apagado

Dato estructural, no defecto: el grep de `<Tabs`, `(tabs)` y drawer da **0**, con `<Stack` como
control positivo. Mobile es **una pantalla con panel deslizante + 20 rutas modales**. Cualquier
veredicto sobre «navegación de mobile» que asuma tabs está hablando de otra app.

Y el único test que monta el router de verdad —`shell.test.tsx:76`— es un **`describe.skip`** cuya
condición de reactivación declarada (*«cuando `modules/chat` esté portado»*) **ya se cumple**. El
invariante que cuidaba (un solo árbol al cruzar el breakpoint) **no tiene otro test**. Un skip con su
condición cumplida es deuda que ya venció sin que nadie la cobre.

Tres `router.push` directos saltean el gate de «un glass a la vez».

#### Hallazgo 5 — código muerto medido, no estimado

`M/theme/IconosTab.tsx` **entero** (0 importadores de producción; exporta íconos para un
`Tabs.screenOptions.tabBarIcon` que no existe — coherente con el hallazgo 4) · `Orbe` · `anilloFoco` ·
`useSkin` · el ícono `miPlan` · **10 tokens de mobile** · **15 de los 97 tokens CSS de web** sin
consumidor, entre ellos `--skin-preview-nocturno` de una piel retirada · y los `--brand-*`
duplicados a mano como hexes en `serviceIcons.tsx:50-70`.

#### Hallazgo 6 — cinco comentarios más que contradicen el código

Suman a la clase que §5.6 llevó a ocho y que mi barrido A de §5.4 había subestimado: «3 pieles»/«4
temas» con 2 skins (`MA/_layout.tsx:147-149,:160-163`) · `contabilidad.test.ts` dice «no desplegado»
y `contabilidad.ts:11-12` dice «ya desplegado» · `tokens.ts:516-518` dice que no hay gate WCAG en
mobile cuando `paresPintadosContraste.test.tsx` existe · `IconosTab.tsx:5` dice que
`react-native-svg` no está instalado y `apps/mobile/package.json:38` lo lista.

**Con esto la clase llega a ~14 miembros medidos en tres lotes independientes.** Ya no es una lista
de erratas: es el instrumento de orientación más usado del repo —el comentario que explica por qué el
código es así— fallando de forma sistemática en una dirección (quedan congelados en el estado del día
que se escribieron). Eso tiene consecuencia directa para el backlog: **leer un comentario no es
verificar**, y este relevamiento lo pagó dos veces en §5.4.

#### Hallazgo 7 — los guards de diseño no cubren los dos lugares con hexes sueltos

Mobile tiene guard global de hexes con allowlist. Web lista fuentes explícitas y **ni splash ni
design-system están en la lista** — y los dos tienen hexes sueltos. El gate existe y mira al costado
justo donde hay qué ver. Dato adicional: web no versiona sus fuentes (0 `.woff2` trackeados).

#### Hallazgo 8 — qué NO prueba jest en mobile (declarado por el lote, relevante para todos los lotes)

`MOB/jest.setup.js` stubea Reanimated (`withTiming`/`withSpring` **devuelven el destino y nunca
disparan el callback final**), worklets, `GestureDetector` como passthrough, FlatList, svg y
AsyncStorage, y reemplaza `useFocusEffect` por un `useEffect` de sólo-montaje (sin blur ni refoco).

**Ningún gesto, ninguna animación y ninguna transición real de navegación se ejercita en jest.** Esto
no degrada los veredictos de mobile —ya llevan todos `REQUIERE_DEVICE` por contrato— pero **sí
cuantifica qué significa ese sello**: un verde de jest en mobile acredita lógica de componente, y
nada de lo táctil. Es la justificación medida de la orden del operador de que lo táctil va a device.

**Grafo vs código:** sirvió para ubicar primitivas y consumidores. Sin discrepancias que
contradigan un hecho de archivo; se confirmaron los límites ya declarados en §2.

### §5.3 · L03 — auth · sesión · OAuth · onboarding · legal · cuenta

**108 de 108 elementos abiertos**, agrupados en 24 capacidades (C01-C24) más cuatro bloques
transversales. El lote **leyó seis archivos de test que su propio listado no incluía** porque eran los
que decidían los veredictos de aislamiento y autorización — criterio correcto, y el inventario era
mío, así que la omisión es de mi lado. Control positivo: `POST /me/legal/aceptar` con su adversarial
A/B contra Postgres real.

#### 🔴 Hallazgo 1 — el test adversarial insignia del aislamiento mide la función **gemela**

Verificado por mí, y es peor de lo que el lote reportó. Hay dos resolutores de tenant:

| función | quién la usa | quién la prueba adversarialmente |
|---|---|---|
| `resolve_cliente_id` (`auth.py:59`) | `onboarding.py` | **`test_adversarial_multitenant.py:217-227`** (A/B con Postgres real) |
| `resolve_cliente_id_y_estado` (`auth.py:72`) | **`require_tenant` (`auth.py:138`)** — el guard de todo request autenticado | **nadie**: el único hit en toda la suite es un comentario (`test_auth.py:71`) |

Y el docstring del test afirma lo contrario de lo que hace. Textual, `:218`:

> *«`resolve_cliente_id` (**camino crítico de `require_tenant`**) resuelve el `sub` del JWT de A al…»*

Repetido en `:51-52`: *«es el mismo camino que usa el `require_tenant` real»*. No lo es. `require_tenant`
llama a la otra.

**Por qué esto importa más que un rename.** La regla dura de este repo es *«control de autorización
sin test adversarial = control no verificado»*, y el control de autorización más básico del sistema
—resolver el token al tenant correcto— tiene su adversarial **apuntado a una función que producción
no usa en ese camino**. Las dos comparten el `WHERE`, así que el aislamiento muy probablemente
funcione; pero «muy probablemente, porque comparten el SQL» es inferencia, y la regla existe
precisamente porque la inferencia es lo que falló en el caso raíz (ADR-013: el guard especificado que
el código nunca codificó, dos meses en prod).

**Y la separación fue deliberada y correcta.** El docstring de `resolve_cliente_id_y_estado` explica
por qué son dos (*«no un cambio de firma… ese helper tiene otros llamadores que sólo necesitan el
id»*). Nadie se equivocó al separarlas: lo que no se hizo fue **mover el adversarial al lado que el
guard quedó usando**. Es el patrón de la memoria *«dos implementaciones del mismo cliente: el fix
llega a UNA»*, aplicado al instrumento en vez de al código — y el docstring, al afirmar la cobertura,
**es lo que impidió que se notara**.

Para el backlog es un ítem de una línea (apuntar el adversarial a la función del guard) con valor
desproporcionado: convierte el control más citado del sistema de inferido a medido.

#### 🔴 Hallazgo 2 — el alta por email de web no puede completarse contra el backend real

El backend exige `invite_token` válido y **falla cerrado**: sin `COPILOTO_INVITE_TOKEN` nadie se
registra (`web.py:590-605`, `hmac.compare_digest`, 403 en `:1304-1305`). El cliente web **nunca lo
manda**: el cuerpo es email+password (`lib/api/types.ts:48-51`), y el grep de `invite` en todo el
código no-test de web, mobile y core devuelve **sólo tres comentarios** (control positivo: el mismo
grep lo encuentra en el backend, `web.py:1304`).

El formulario además sólo se abre con `?signup=1` (`App.tsx:14,24`), sin link público.

Los adversariales del backend son ejemplares —sin token, token equivocado, env ausente, env vacía,
cuatro casos (`test_web_app.py:518-550`)—. El hueco no está en ninguno de los dos lados: está en que
**nadie probó el par**. La costura otra vez.

#### 🔴 Hallazgo 3 — la aceptación legal no condiciona nada, y los dos logins reales la saltean

Tres hechos medidos que se encadenan:

1. **El único escritor de la aceptación en todo el backend es `web.py:1165`** (grep de `.aceptar(`
   fuera de tests: un solo llamador).
2. **El único camino de web que llega a ese escritor es el `SignupScreen`** — el del hallazgo 2, que
   no puede completarse. Los logins con Google entran por `POST /auth/oauth/ensure-tenant`
   (`web.py:1413-1437`), que provisiona tenant **sin registrar aceptación**.
3. **Nada la exige.** El backend la registra y la reporta (`_campos_legales`, `web.py:670-691`), y el
   único lector de `legal_aceptado` en el front es **texto de display**
   (`AccountScreen.tsx:31-38`). No hay gate.

**Mobile no tiene aceptación en absoluto** → el único `NO_EXISTE` del lote (T3b). El grep de
`legal/aceptar|aceptarLegal` en `apps/mobile/**` y `packages/core/**` da vacío, con 5 archivos en web
como control positivo. `legal_aceptado` está tipado en el core (`packages/core/src/api/types.ts:112`) y **ningún archivo de
mobile lo lee**.

Resultado neto sobre `main` @ `6278836a`: **un emprendedor que entra por Google —el único camino que
funciona— nunca acepta los términos, y el sistema no se lo pide ni lo bloquea.** El backend del
mecanismo está completo y bien probado (handler, 400, 409 con versión vigente, adversarial A/B con
Postgres real, idempotencia); lo que falta es quién lo llame y qué lo exija.

**Nota de alcance, no de contenido:** existe una rama `fe2/bl-o6-legal-parte-a-y-parte-b-web` con
trabajo en vuelo sobre este frente. **No la leí** —este relevamiento mide `main`— así que el hallazgo
describe el estado de `main` y no dice nada sobre esa rama. Antes de convertirlo en ítem de backlog
hay que cruzarlo con ella, o el backlog va a presupuestar trabajo que quizá ya esté hecho. Es
exactamente el modo de falla que la memoria llama *«el contrato que manda a hacer algo ya hecho»*.

#### Hallazgo 4 — el composition root no lo ejercita ningún pytest (tercer lote que llega acá)

`serve.py:133-148` compone los guards reales (issuer fail-closed, `make_require_tenant`,
`make_require_claims`, `make_require_admin`, `GoTrueAdmin.from_env`) y `create_web_app`
(`:301-317`) los monta. **Ningún pytest recorre eso**: `test_serve.py:20-52` cubre importación y
defaults. Los adversariales HTTP inyectan un guard fake (`_RequireTenantByToken`, con `gotrue=None` y
sin `require_claims`).

Lo único que compone guard real + root real + dos tenants es el E2E manual
`scripts/e2e_bl_o6_legal_aceptacion.py:111-153`, y **ni el gate, ni el CI, ni el deploy lo invocan**
(`deploy.sh:519` lo declara «NO corrido por este deploy»). Mismo cuadro en `e2e_g6_adversarial_multitenant.py`,
`run-smoke-prod.sh` y `smoke_beta_e2e.py`.

**Es el tercer lote independiente que aterriza en el composition root** (L10 con AD-1, L04 con los
endpoints por tenant, L03 con los guards). Ya no es un hallazgo por lote: es el límite estructural de
la evidencia de este repo, y por eso tiene sección propia en §N.

#### Hallazgo 5 — la tabla que resuelve el tenant tiene RLS sin FORCE, y los docstrings dicen que no tiene RLS

`uc_factory.tenants` —donde vive `legal_version` y donde se resuelve el tenant— tiene RLS **habilitada
sin FORCE**, por diseño (`provision.py:96-101`), y el invariante lo afirma explícitamente
(`test_rls_invariantes.py:49,72-81`: `relforcerowsecurity` falso). Mientras tanto **cuatro docstrings
de test dicen que la tabla «no tiene RLS»** (`test_adversarial_multitenant.py:50,92,220`,
`test_admin_tenants.py:65`).

La consecuencia no es el drift del comentario: es **qué prueban realmente esos adversariales**. Sin
FORCE, y conectando con el dueño de la tabla, lo que verifican es **el filtro SQL de los stores**, no
que la base rechace la fila ajena. Eso sigue siendo evidencia válida —el filtro existe y discrimina—
pero es una capa menos de la que el nombre «adversarial multitenant» sugiere. Con qué rol conecta el
servicio vivo no es verificable desde el código.

Entronca con la memoria *«la tabla que RESUELVE el control no puede estar sujeta al control»*: la
decisión de diseño es correcta; lo que falta es que los tests digan qué están midiendo.

#### Hallazgo 6 — `cambiarEmail`: completo, probado, adversarial… y sin UI en ningún frente

Backend (`web.py:1359`), cliente core (`api/auth.ts:54`) y tests —incluido el adversarial *A no
cambia el mail de B* (`test_cambiar_cuenta.py:164`) y tres casos contra GoTrue real— y **cero
consumidores de UI**: el grep de `cambiarEmail` en web, mobile y core da vacío, con `cambiarContrasena`
y sus dos consumidores como control positivo.

Y depende de lo único que el operador tiene abierto: `GOTRUE_SMTP_*` con **default vacío**
(`docker-compose.gotrue.yml:80-85`) y `GOTRUE_MAILER_AUTOCONFIRM` default `true` (`:73`). **Esto le da
un segundo consumidor medido al ítem del proveedor SMTP**, que hasta ahora figuraba solo. No cambia su
prioridad; cambia su justificación: no es sólo recuperación de contraseña, hay una capacidad completa
y probada esperándolo.

#### Hallazgo 7 — brechas de evidencia que convergen con N.1

- **Los wrappers HTTP finos no los ejecuta ningún test**, en los dos frentes: web `login`, `signup`,
  `aceptarLegal`, `ensureOauthTenant` (todos los tests los reemplazan con `vi.mock` del objeto `api`)
  y core `login`, `me`, `ensureOauthTenant`, `loginWithGoogleIdToken`. **Ningún test afirma que un
  wrapper pida el path que dice pedir.** Es N.1 visto desde auth, y con una consecuencia concreta:
  un typo en un literal de ruta pasa los dos lados.
- **El contrato de claves de `/me` no lo compara ningún pytest** contra la respuesta real. `CLAVES_ME`
  (`me_contrato.py:11`) sólo se usa en el smoke manual y en tests TS que leen el `.py` **como texto**.
  Un contrato custodiado por lectura de texto y por un script que nadie corre.
- **Dos implementaciones del cliente de id_token de Google en mobile**: el flujo real hace `fetch`
  crudo (`modules/auth/oauth.ts:74`, con el client id web **como literal** en `:40`) y el wrapper del
  core (`api/auth.ts:17`) **no tiene llamadores**. El patrón gemelo otra vez, esta vez en el cliente.
- **Dos clientes HTTP en la web**, con **dos single-flight de refresh** y dos jerarquías de error
  (`lib/api/client.ts` y `packages/core/src/api/client.ts`). La web usa los dos; sólo comparten el
  registro de suscriptores de `api/sesion.ts`. Un fix de refresh llega a uno.
- **Los 10 tests contra GoTrue real sólo corren en el gate del VPS** (`@necesita_gotrue`,
  `gate.sh:205-218`) y se saltan en GitHub Actions (grep vacío; Postgres como control positivo). El
  comentario del gate dice **«8 tests»**. Otro umbral que envejeció con el corpus.
- **El ratchet de aislamiento por endpoint no ve los adversariales de cuenta**: lee sólo dos archivos
  (`test_ratchet_endpoint_tenant_scope.py:395`), y los adversariales de `/auth/cambiar-*` viven en un
  tercero. El lote no corrió el ratchet y lo declara como deducción de diseño, no como medición — la
  distinción correcta.
- **Sin test contra GoTrue real para refresh** (sí lo hay para login y cambiar-*), y la rotación
  configurada en el compose sólo la ejercita el smoke que el deploy declara no correr.

#### Hallazgo 8 — el texto legal es provisorio, y lo dice el código

`LEGAL_AVISO_PLANTILLA = "Plantilla estándar genérica - no es una revisión legal específica de este
negocio."` (`packages/core/src/legal.ts:21`), renderizado en los dos frentes
(`LegalScreen.tsx:45-47`, `PantallaLegal.tsx:41-44`), con el descargo marcado **PROVISORIO pendiente
de revisión legal** en `legal.ts:24-29`. No es un defecto a arreglar en código: es un ítem de negocio
que el código ya declara y que el backlog debe tener como tal.

La versión legal vive **literal en tres lugares** sin código compartido (`tenant_legal_store.py:20`,
`core/src/legal.ts:14`, `scripts/e2e_bl_o6_legal_aceptacion.py:48`); la igualdad la custodia un guard
de CI (`scripts/ci/idemkey_paridad.py:187-229`), que es la pieza que **sí** está cableada.

#### Hallazgo 9 — toggles inertes en las dos caras

Web: el toggle **Notificaciones** es estado local que no persiste (`AccountScreen.tsx:54-75`) y la fila
**Idioma** es estática (`:134-139`). Mobile: **No molestar** es inerte, y su propio
`accessibilityLabel` dice «(pendiente)» (`PantallaCuenta.tsx:88`). El de mobile está rotulado; los de
web no.

Y el **avatar** en los dos frentes: web deriva la inicial de `cliente_id` —un uuid— en vez del nombre
o el email que `/me` sí trae (`copiloto-web/src/shell/AvatarCuenta.tsx:38`), y su test cubre sólo el punto de estado, sin
afirmar la inicial; en mobile el único consumidor **no pasa la prop**, así que no muestra inicial
(`PantallaMiDia.tsx:523`).

**Grafo vs código:** una discrepancia, resuelta a favor del archivo — el grafo devolvió aristas
«`LegalAceptarIn` / `CambiarContrasenaIn` / `CambiarEmailIn` / `ChatSoporteIn` *references*
`TenantLegalStore`» y esos cuerpos sólo tienen campos `str` (`web.py:538-541,707,712,729`); las
referencias reales son `web.py:46,:689,:1165`. Es el mismo modo de falla que §2 ya documentó: aristas
plausibles a nivel de archivo que no existen a nivel de símbolo.

### §5.2 · L02 — chat · HITL · voz · foto · transporte del hilo

**112 de 112 elementos abiertos**, agrupados en 24 capacidades. **El lote con mejor método de los
siete**, y vale decir por qué, porque es replicable: verificó **por script** que los 112 elementos
existen en la línea indicada (0 faltantes, 0 sin coincidencia), **declaró la lista nominal de tests
cuyas aserciones NO leyó** —no «leí los tests», sino cuáles sí y cuáles sólo por título—, y
**autodeclaró un incidente de protocolo**: un grep recursivo le imprimió líneas de `docs/**` y
`memoria/*.md`, no las abrió, repitió la búsqueda excluyendo esas rutas y lo reportó. Eso último es
exactamente la regla de este relevamiento —sólo código— cumplida en el caso incómodo, que es el
único donde se ve si se cumple.

#### 🔴 Hallazgo 1 — el historial del chat web no está acotado por tenant, y el fix existe tres veces al lado

Verificado por mí, hex por hex del contraste. Las claves de `localStorage` del chat web son
**globales**:

```
apps/copiloto-web/src/modules/chat/useChat.ts:27   'copiloto-chat-session-id'          ← sin tenant
apps/copiloto-web/src/modules/chat/useChat.ts:28   'copiloto-chat-msgs:<sessionId>'    ← sin tenant
```

Y el mismo defecto está **corregido en los otros tres lugares donde vive el mismo patrón**:

| dónde | clave | ¿acotada? |
|---|---|---|
| **chat web** | `copiloto-chat-session-id` | ❌ **global** |
| chat mobile | `<prefijo>:${clienteId}` y `<prefijo>:${clienteId}:${sessionId}` | ✅ |
| soporte web | `copiloto-soporte-session-id:${clienteId}:${funcion}` | ✅ |
| soporte mobile | acotada | ✅ |

**Y mobile no sólo lo arregló: dejó escrito el escenario exacto**, con fecha y causa
(`apps/mobile/src/modules/chat/useChat.ts:71-80`):

> *«🔴 Las claves de storage van scoped por `clienteId` — **hallazgo en device 2026-07-23**. Antes,
> `CLAVE_SESSION` era una clave GLOBAL: un segundo login en el MISMO device (otro tenant) **hidrataba
> el `sessionId` — y por lo tanto el historial completo — de la sesión anterior, ajena**. […]
> `clienteId` vacío degrada a NO persistir — ningún fallback a una clave compartida.»*

Ese párrafo describe, palabra por palabra, el estado actual del chat web. Con test adversarial propio
en mobile (`mobile/src/modules/chat/useChat.test.ts:266-322`, con control positivo) y **sin ningún test del aislamiento en
web**.

**Alcance exacto, y la distinción importa para el fix:** el backend **sí** aísla. `read_replies`
filtra por `cliente_id` **y** `session_id` (`reply_store.py:48-50`) con RLS FORCE, y el adversarial
HTTP existe (`test_adversarial_multitenant.py:386`). Así que un emprendedor B que herede el
`sessionId` de A **no recibe los replies de A desde el servidor**. Lo que ve es **el historial local
de A, desde el disco de su propio navegador**. No es fuga de servidor: es la pantalla de B mostrando
la conversación de A. Grave igual, y de la clase que un test de backend no puede ver nunca.

Dos agravantes: **`clearToken` no borra esas claves** (`auth/session.ts:47-51`: sólo token y refresh),
así que ni cerrar sesión las limpia; y el único limpiador, `startNewSession` (`copiloto-web/src/modules/chat/useChat.ts:446-466`),
**está expuesto en el hook y ninguna UI lo llama** — verificado con grep fuera de tests. De paso,
eso vuelve inalcanzable a `podarResolucionesCard`, que sólo se invoca desde ahí.

**Por qué el backlog debe tratarlo como el ítem más barato de alto impacto del relevamiento:** el fix
no hay que diseñarlo. Está escrito en `apps/mobile/src/modules/chat/useChat.ts:71-89`, probado, con el
degradado decidido (`clienteId` vacío ⇒ no persistir, sin fallback a clave compartida) y con su test
adversarial. Es portar un patrón existente, no resolver un problema. Y choca de frente con la regla
no negociable 7 del `CLAUDE.md` del repo (*aislamiento cross-emprendedor verificado con test
adversarial*): hoy, en la cara que está LIVE, no está ni acotado ni probado.

#### 🔴 Hallazgo 2 — HITL en mobile: la card no se marca en la sesión viva, y el test pasa por encima de la costura

`ListaMensajes.tsx:336,339` pasa `hitlMessageId`. `ChatView.tsx:149-153` **lo descarta** al reenviar
—manda sólo `{kind, payload, displayText}`— y el `send` de mobile marca `hitlRespondido` **sólo si
recibe `hitlMessageId`** (`mobile/src/modules/chat/useChat.ts:337-343`). `TarjetaConfirmacion` no tiene estado local: se apoya
en `gate.respondido`.

Consecuencia, por lectura de código y declarada como tal por el lote (**no** verificada en device): en
la sesión viva **la card sigue activa después del toque**; un segundo toque reenvía el token y el
backend contesta el texto de callback viejo (*«Ese botón ya no sirve…»*, `conversation_workflow.py:404-414`).
La marca aparece sólo al rehidratar. **Web está bien cableado** (`ChatScreen.tsx:83-85` +
`hitlMapping.ts:125-126`).

Y lo que lo hace invisible: **el test llama `send` directo, pasándole el `hitlMessageId`**
(`mobile/src/modules/chat/useChat.test.ts:142-171`). O sea, el test inyecta a mano justamente el dato que la costura pierde.
Ni `ChatView.test.tsx:247-271` (sólo asserta `sendChat`) ni `ListaMensajes.test.tsx` lo cubren. Es la
entrada de la memoria *«un callback que recibe un parámetro y lo ignora no da síntoma»*, confirmada
por una medición independiente.

#### Hallazgo 3 — el token interno del gate llega al cliente, y el sanitizador cubre una mitad

En modo `react` el backend emite `choices[].value = confirm:<turn_ix>:<step>`
(`conversation_workflow.py:766-771`), el cliente lo guarda crudo en `hitlRespondido.value`, y los
historiales previos al fix #624 conservan **una burbuja de usuario con el token crudo** (ej.
`cancel:2:0`).

Los dos sanitizadores —`sanitizarHitlRespondido` (`core/src/chat/hitl.ts:151-166`) y
`sanitizeLegacyHitlTokens` (web `copiloto-web/src/modules/chat/useChat.ts:97-115`)— **normalizan sólo la card del asistente y
devuelven el mensaje de usuario sin tocar** (`hitl.ts:153`), mientras el comentario de
`hitl.ts:146-148` dice que mostrar `cancel:2:0` **«en cualquier lugar»** es peor. El comentario
declara la intención completa; el código cubre la mitad. Tercer caso en el relevamiento del patrón
*«el control positivo cubre la mitad que sospechás y la otra queda muda»*.

**Acotación correcta del lote, que hay que preservar:** el token **no es un secreto**. Es un valor de
ligadura anti-replay: un mismatch devuelve `False` en silencio (`:419-426`) y un callback sin gate
parqueado nunca llega al LLM (`:404-414`). Así que el daño es **cosmético** —texto feo en el hilo—, no
de seguridad. Sobre-acusar esto como fuga sería el error; el lote no lo hizo y el documento tampoco.
Y el residuo es de almacenamiento local: el backend sólo sirve replies.

#### Hallazgo 4 — el contrato `POST /chat` + polling: implementado, con dos divergencias y un rechazo que nadie mira

Verificado el contrato que el `HANDOFF` declara, y está implementado en los tres lados. Lo que el
relevamiento agrega:

- **Ningún frente lee `accepted` ni `wf_id`** del POST (0 usos fuera de tipos y mocks), y los tipos
  los declaran **no nulos** mientras el backend puede devolver `wf_id: null, accepted: false` con
  **HTTP 200** (`web.py:818`) cuando el texto viene vacío o falta `session_id`. Un rechazo del
  backend es, para el cliente, indistinguible de una aceptación.
- **Web abandona a los 60 s** (`copiloto-web/src/modules/chat/useChat.ts:359-362`); **mobile baja a polling lento de 10 s y nunca
  abandona** (`:294-299`). Dos políticas distintas para el mismo contrato.
- **Los dos cortan al primer lote no vacío**: si un turno emitiera más de un reply en momentos
  distintos, los posteriores se verían sólo al remontar. Inferencia de código, declarada como tal.
- **Dos docstrings dicen «long-poll»** (`reply_store.py:1-3`, `motor/clients/agent/channels/web.py:5`)
  y `GET /reply` **responde de inmediato**. Suma a la clase del hallazgo 6 de §5.5.
- **`POST /chat/foto` no pasa por Temporal**: escribe el reply sincrónicamente, con `wf_id` sintético
  que su propio docstring admite que nadie lee, y es `async def` llamando I/O sincrónico **mientras el
  comentario de `web.py:1100-1104` declara la regla que `:1063` no cumple**. El aislamiento de esa
  ruta se prueba contra un adapter espía, no contra PG.

#### Hallazgo 5 — el backend emite cinco kinds de artifact que sólo web dibuja

`tool_catalog.py` emite `email_draft`, `doc`, `sheet`, `file`, `calendar_event`, `payment_link` y las
cuatro cards propuestas. **Mobile renderiza sólo `payment_link`** (`ListaMensajes.tsx:310`): los otros
cinco **caen a burbuja de texto**. Control positivo del grep: encuentra `payment_link` en mobile.

No es código faltante por descuido: es una asimetría de superficie entre frentes que el backlog tiene
que decidir (¿mobile dibuja los cinco, o el backend no los emite para mobile?). Hoy el emprendedor ve
una cosa distinta según el dispositivo, sin que nada lo declare.

#### Hallazgo 6 — `[ASSUMED_PENDING_VERIFY]` vigentes sobre kinds que el backend ya emite

Seis marcadores vivos (`ListaMensajes.tsx:283,297`, `core/src/chat/facturaPropuesta.ts:11`,
`chat/index.ts:16,19`, `ingresoPropuesto.ts:7`) para `presupuesto_propuesto`, `factura_propuesta` e
`ingreso_propuesto` — **y el backend emite los tres** (`tool_catalog.py:904,1455,1105`). Peor: el
propio `ListaMensajes.tsx:269` dice de `ingreso_propuesto` *«CONFIRMADO en device»*.

El marcador existe para decir «esto lo supuse, falta verificarlo». Cuando la verificación ocurre y el
marcador queda, deja de señalar deuda y empieza a **esconderla**: nadie puede distinguir los
`[ASSUMED_PENDING_VERIFY]` que siguen pendientes de los que ya se pagaron. Es el mismo modo de falla
que el `describe.skip` con su condición cumplida (§5.5, hallazgo 4) y que las exenciones de contraste
vencidas (§5.5, hallazgo 2): **un marcador de deuda sin fecha de revisión se vuelve ruido**.

#### Hallazgo 7 — código muerto del motor y referencias a un componente que no existe

- **`poll_loop`** (`motor/backend/agent/inbound_router.py:43-63`): **0 llamadores** en todo el árbol.
  Control positivo: `route_inbound(` sí tiene cuatro.
- **`make_dispatcher` del motor** (`motor/backend/agent/dispatch.py:36`): sólo lo importa su propio
  test. El copiloto usa el suyo. Residuo del fork duro.
- **`nivelDeMuestras`** (`core/src/audio/nivel.ts:28`): sin consumidores — mobile calcula el nivel
  inline. **Su test de 6 casos cubre código que nadie usa.**
- **`capturaViva`**, **`construirEnvioClinico`**, las **4 funciones de `modo.ts`** (con test de 7
  casos), **`ChatHeader` web** (sin render; sólo lo mantiene vivo un test que lo carga como `?raw`),
  **los campos y kinds clínicos de `ReplyCard`** (tipos sin emisor backend: 0, con control positivo
  que encuentra los 14 `Artifact(kind=`) y **`CLAVES_CHAT`** (`chat_contrato.py:16-19`, sin
  importadores Python; sólo lo lee por regex un test web).
- **`GlassGrabacionCopiloto`**: citado en **cinco comentarios** de mobile, uno de los cuales dice que
  lo reemplaza. **Ningún archivo TS/TSX lo define.** Comentarios que explican el código por
  referencia a algo que no existe.

#### Hallazgo 8 — ningún test cruza HTTP → Worker → PG → `/reply`

Declarado por el lote y confirmado por su propio inventario: los E2E de ese tramo (`test_e2e.py`,
`test_e2e_tool_action.py`) están *gated* al VPS **y no pasan por HTTP**; los de aislamiento contra PG
real se saltean sin entorno. Los tests de paridad (`*.contrato.paridad.test.ts`) **comparan
declaraciones de texto, no handlers**. Y los clientes core de `chat`/`reply`/`audio`/`foto`/`warm`/
`transcribir` **no tienen test directo**.

O sea: el camino que **es** el producto —mandar un mensaje y recibir la respuesta del agente— no lo
recorre completo ningún test automático. Cada tramo tiene el suyo; la cadena no.

**Grafo vs código:** 0 discrepancias de hecho en lo que usó (incluida una arista `poll_loop →
route_inbound` que resultó correcta). Ruido nuevo documentado: **nodos `ExternalSymbol` con ruta de un
checkout viejo** (layout `copiloto/` sin `apps/`, `valid_at` 2026-10-07) que descartó sin usar — el
mismo límite de `source_file` ya declarado en §2, ahora visto como contaminación de un árbol anterior.

### §5.8 · L08 — gastos y clientes (99 elementos, 16 capacidades + 1 hallada fuera del inventario)

**El único lote que ejecutó código de producción.** Corrió cuatro sondas (`python -B`, scripts fuera
del árbol, sin dejar bytecode) contra los *handlers reales* montados con un store grabador, y declaró
con la misma precisión lo que **no** corrió: ningún test de la suite, porque los de Postgres llevan
`skipif(not DATABASE_URL)` — así que todo veredicto apoyado en PG real lo marcó *«por lectura»*, no
*«medido»*. Esa distinción es la que el resto del relevamiento tuvo que imponer a los otros lotes; acá
vino de fábrica.

#### 🔴 Hallazgo 1 — El front manda la clave de idempotencia del alta de cliente y el backend **la descarta en silencio**

Las dos plataformas derivan y retienen una `idemKey` para el alta de cliente, con el mismo molde que
el de gasto —que sí funciona—. El backend **no tiene dónde recibirla**. Verifiqué la cadena entera en
el árbol sujeto, eslabón por eslabón:

| eslabón | qué encontré | archivo:línea |
|---|---|---|
| front web | `cliente:${mensajeId}` o `generarId()`, enviada como `idemKey` | `copiloto-web/src/modules/clientes/FormularioCliente.tsx:112-115` |
| front mobile | lo mismo, `useRef` perezoso | `mobile/src/modules/clientes/FormularioCliente.tsx:204-205` |
| cable core | la pone en el cuerpo: `cuerpo.idem_key` | `core/src/api/clientes.ts:369` |
| **body del handler** | **`ClienteBody` no declara el campo ni `extra`** → pydantic la tira antes de `model_dump` | `clientes_web.py:28-58` |
| handler | `model_dump(exclude_unset=True)` → `crear(forzar=forzar, **datos)` | `clientes_web.py:166-171` |
| store | `ClienteStore.crear` no tiene el parámetro | `cliente_store.py:317-319` |
| tabla | `copiloto_clientes` no tiene la columna | `uc_tables.json:123-136` |

Y el control negativo con su positivo al lado, que es lo que vuelve la medición concluyente:
`grep -ci idem` da **0** en `clientes_web.py` y sólo la palabra *«idempotente»* en comentarios de
`cliente_store.py` y `clientes_migrations.sql`; el **mismo grep** sobre el lado gastos da **4 / 21 / 7**.
El lote además lo ejecutó (sonda E1): dos `POST /clientes` con la **misma** `idem_key` →
`201/201`, ids **1 y 2**, y los kwargs que recibió el store fueron `{forzar, nombre, origen}` — la
clave no llegó. Su control positivo es la misma sonda sobre `POST /gastos`: ahí la clave **sí** llega
y la segunda respuesta trae `repetido: true`.

**Lo que lo convierte en hallazgo de instrumento, no en una feature a medias:** hay **tres artefactos
que afirman lo contrario**, y los tres los leí literal.

> *«con la misma clave el backend devuelve el que ya existe»* — docstring de
> `apps/mobile/src/modules/clientes/FormularioCliente.tsx:131`
>
> *«sin esto… el backend no podía dedupear el alta»* — header del test
> `apps/copiloto-web/src/modules/clientes/FormularioCliente.test.tsx:21-22`

El tercero es el gate. `scripts/ci/idemkey_paridad.py` existe exactamente para vigilar este patrón, y
**su alcance declarado es la paridad mobile↔web** — no el consumidor. Lo medí: el único archivo de
backend que el script nombra es `tenant_legal_store.py`, y es para otro chequeo (`:188`). O sea que el
gate puede estar **verde para siempre** mientras los dos lados derivan la clave con precisión
quirúrgica y nadie la recibe. Es la forma más pura del patrón que este documento ya tiene medido tres
veces: *el instrumento mide mi mitad, no la propiedad*.

Y un cuarto detalle, menor pero del mismo linaje: el docstring del gate dice que Cliente *«no deriva
hoy»* (`:39-40`), mientras el inventario que el propio lote ejecutó (`--inventario`) da Cliente =
**deriva** en mobile y en web. **Cuarto umbral envejecido** del relevamiento.

**Lo que esto significa para el backlog, y es barato:** el efecto real hoy no es un duplicado por
cada reintento, porque los índices únicos por documento y por nombre normalizado
(`clientes_migrations.sql:18-20,37-39`) atajan el caso con documento. El agujero es el alta **sin
documento**: ahí el reintento da 409 de nombre y la UI ofrece *«crear igual»*. O se consume la clave
en el backend —el molde está escrito al lado, en `gasto_store.py:124-150`— o se **retira** del front y
de los tres artefactos. Lo que no puede quedar es el estado actual, donde tres lugares afirman una
protección que no existe.

#### 🔴 Hallazgo 2 — «La cartera se arma sola» en la UI de las dos plataformas, y la derivación sólo la corre un script a mano

El copy promete derivación automática (`ClientesScreen.tsx:238,252,317` en web;
`PantallaClientes.tsx:306,373` en mobile, con un test que **fija el texto** en
`PantallaClientes.test.tsx:136`). La derivación existe y está escrita
(`cliente_store.py:458-518`, `:421`, `:612`), pero su **único llamador** es
`apps/copiloto/derivar_clientes.py:90-91`, un script manual: `git grep` de los tres nombres en todo el
árbol —sin `docs/`, sin `memoria/`— no halla ningún `deploy/`, `scripts/` ni `.github` que lo invoque,
contra un control positivo (`crear_idem`) que aparece en 9 archivos con el mismo comando. **Y ninguno
de los tres tiene test.** El lote declaró el límite correcto: un cron del VPS no sería visible desde el
repo. Es el mismo patrón que el hallazgo 1 de §5.6 (capacidad completa sin disparador), ahora con la
UI prometiéndolo al usuario.

#### 🔴 Hallazgo 3 — `consultar_cliente` está podada del catálogo pero viva, y es el único camino al historial que la ficha promete

`GET /clientes/{id}` devuelve `presupuestos: []` y `facturas: []` **fijas** —lo leí: el `return` de
`clientes_web.py:211` las escribe literales— mientras **las dos fichas renderizan esas secciones**
(`copiloto-web/src/modules/clientes/FichaCliente.tsx:129-130` web, `:185-186` mobile) y el core ya modela las filas
(`OperacionCliente`, `core/src/api/clientes.ts:443`). El store **sí sabe calcularlas**:
`ClienteStore.resumen_operaciones` (`cliente_store.py:522-610`) cruza presupuestos por `cliente_ref` y
facturas por `(doc_tipo, doc_nro)`, restando notas de crédito. Su único llamador vivo es el runner de
una tool que **ya no está en el catálogo**: `tool_catalog.py:439-451` la poda, y un test **fija esa
ausencia** (`test_clientes_voz.py:42`), pero siguen definidos el schema (`:166`), el runner
(`:917-976`), el `TOOL_INDEX` (`:463`), el despacho (`:1600-1601`) y la fábrica del worker
(`worker_b.py:213-214`). Capacidad completa, con dos consumidores que la muestran vacía y ningún
camino que la alcance.

#### 🔴 Hallazgo 4 — Ningún test une handler real + store real + `require_tenant` real para `/gastos`, `/clientes` ni `/trabajos` — y **tres lotes independientes cayeron en la misma costura — por **dos mecanismos distintos**, y eso la empeora: L08 y L03 midieron la **ausencia** de un test que componga el guard real, y L07 midió que el **instrumento** que debería reportarla no ve las rutas armadas con f-string y declara una cobertura que no tiene. El hueco existe y el contador lo subestima**

Los adversariales de aislamiento existen en **dos** niveles y ninguno de los dos es el completo:
PG real contra el **store directo** (`test_gasto_store.py:92`, `test_cliente_store.py:39,51,58`,
`test_contabilidad_integracion.py:140-148`, `test_imputacion_y_margen.py:194`), y HTTP contra un
**store falso que reimplementa la partición por tenant** (`test_gastos_web.py:202,212`;
`test_clientes_web.py:203,211,592`). El ratchet que debería cubrir el hueco **arma estas apps con
stores `_noop`** (`test_ratchet_endpoint_tenant_scope.py:200-201`) y excluye de su conteo los tests que
llaman al store directo (`:395`). Ningún smoke ni E2E versionado toca `/gastos` ni `/clientes`.

**Esto es lo más importante de la convergencia de hoy:** L03 midió el mismo agujero desde el otro
extremo del sistema y llegó al mismo lugar — el `make_require_tenant` **real** aparece en **2 de 36**
archivos de test que arman apps, y los adversariales de dos tenants usan un `dict` como guard. Dos
lotes que no se hablaron, mirando dominios distintos, aterrizaron en la misma costura. Para el backlog
eso cambia la prioridad: no es una falta de cobertura de gastos ni de auth, es **un solo ítem
transversal** — un test que componga el root real.

#### 🔴 Hallazgo 5 — Tres implementaciones de `dos_decimales` que **divergen ante entrada inválida**, y la más usada no tiene test

| archivo:línea | ante inválido o `None` |
|---|---|
| `gasto_store.py:75-82` | `"0.00"` |
| `presupuesto_store.py:166-173` | sin `try` → **lanza** con inválido; `None` → `"0.00"` |
| `actividad_store.py:171-178` | `None` |

La de gastos la importan **siete** módulos (`afip_comprobante_store`, `cobro_store`,
`contabilidad_web`, `gasto_desde_foto`, `inteligencia_queries`, `tool_catalog`, `trabajo_store`) y
**ningún test la nombra**: el único que nombra `dos_decimales` importa la copia de presupuestos
(`test_presupuesto_derivados.py:16,61-69`). Es el patrón *«el mismo defecto vivía dos veces»* en su
variante peor — tres copias que no son iguales, con el test apuntando a la que menos se usa.

#### 🔴 Hallazgo 6 — Imputación y margen: cableadas en producción, sin test HTTP y sin consumidor de front

`PUT /gastos/{id}/imputacion` y `GET /trabajos/{eslabon}/{ref}/margen`
(`gastos_web.py:161,183`) están cableadas en el root real (`serve.py:213`) y tienen adversarial PG en
**los dos sentidos** (`test_imputacion_y_margen.py:194`, `test_trabajo_store.py:72`). Lo que no tienen
es **un solo test HTTP** —`/trabajos` no aparece en `apps/copiloto/tests`, y `/imputacion` sólo en un
comentario— ni **ningún llamador** en `packages`, `apps/copiloto-web` ni `apps/mobile`: los únicos hits
son comentarios y un título de test. El margen **sí** llega al front, por otra puerta
(`/inteligencia/graficos/margen-trabajo`). Dos rutas de escritura y lectura vivas que nadie consume.

#### Lo demás que midió, con control en cada caso

- **FORCE RLS detrás de un flag con TODO vencido.** `UC_RLS_FORCE` (`provision_tables.py:36-43,152-154`),
  con fecha de retiro **2026-07-31**. Su valor en producción no es visible desde el repo, así que el
  aislamiento *verificable desde el código* para gastos y clientes es el filtro SQL del store.
- **`POST /gastos` devuelve `repetido` y ningún TS lo lee** — control positivo: presupuestos sí lo lee
  (`core/src/api/presupuestos.ts:402-417`). La señal de «esto ya lo habías anotado» existe y no se muestra.
- **Categorías de gasto duplicadas** en TS (`core/src/api/gastos.ts:37`) y PY (`gasto_store.py:38`) **sin
  gate de paridad**, y la paleta mobile es **posicional** sobre el orden de la lista (`tokens.ts:398`).
- **13 de 15 exports de los barrels web no tienen importador por el barrel** — sólo `ClientesScreen` y
  `GastosScreen` se importan así.
- **No hay ruta para editar ni borrar un gasto, ni para borrar un cliente** (decoradores contados uno
  por uno, con el `@app.put` de `gastos_web.py:161` como control de que el grep ve los verbos).
- **Listados con `limit` y clamp, sin offset ni cursor**; el de gastos tampoco tiene `q`.
- **Tres comentarios más desactualizados**: el front dice que `GET /admin/tenants` «no existe en main»
  y existe y lo consume; mobile dice que un guard «todavía no se escribió» y está escrito; el header de
  un test dice «sin mockear más que la red» y el archivo mockea `crearCliente`.
- **Cobertura web asimétrica**: `DetalleGasto`, `ResumenMes`, `FichaCliente` y `FotoFuncion` **no tienen
  archivo de test propio**, y `GastosScreen.test.tsx` cubre mic y foto pero **no** las filas ni el resumen.
- **`idDeParam` copiada** con el mismo cuerpo en `app/gastos.tsx:22-26` y `app/clientes.tsx:22-26`.

#### Grafo vs código: un límite nuevo, de los peores

Al catálogo de límites del grafo se suma **D1, aristas `REFERENCES` mal atribuidas**: el grafo cuelga
`ClienteDuplicado` de `ClienteBody` y `TrabajoInexistente` de `NuevoGastoBody`, cuando en el archivo
esas clases **sólo declaran campos** y los usos reales viven en otros handlers. El lote verificó el
mismo patrón en seis clases más (`ImputacionBody`, `ChatIn`, `PerfilBody`, `ItemBody`,
`NuevoPresupuestoBody`). Por qué importa más que los otros límites ya anotados: éste no omite una
arista — **afirma una que no existe**, y en la dirección más creíble (una excepción colgada de un body
es exactamente lo que uno esperaría). Confirma además la contaminación por `ExternalSymbol` con prefijo
de otro checkout (D7) y la ausencia del prefijo `apps/`/`packages/` en `source_file` (D9), ya anotadas.

### §5.7 · L07 — ingresos, presupuestos y la cadena MercadoPago

El lote más denso del relevamiento: **31 capacidades** (9 completas · 18 parciales · **4 que no
existen**) y **40 hallazgos inesperados**, que es más del doble que cualquier otro. Y el que más
aporta a la planificación, porque tres de sus hallazgos **no son nuevos: son la causa** de hallazgos
que ya estaban en el índice con el síntoma.

Verifiqué yo mismo los dos de mayor consecuencia. Los dos resultaron **peores** de lo que el lote los
reportó, y uno de ellos cambia el ítem de backlog por completo.

#### 🔴 El `origen` del ingreso dictado: cuatro capas que no se ponen de acuerdo, y **el fix obvio rompe producción**

El lote reportó que *«todo ingreso por voz persiste como `manual`»*. Es cierto, y la cadena completa
es peor. Verificado por lectura, capa por capa:

| capa | el dominio de `origen` según esa capa | qué hace |
|---|---|---|
| core TS | `'factura' \| 'manual' \| 'mercadopago' \| 'voz'` (`ingresos.ts:32`) | la card dictada manda `'voz'` (`TarjetaIngresoPropuesto.tsx:106`, `ingresos.ts:179`) |
| **el body** | **el campo no existe** — ni `IngresoBody` ni `CobroBody` lo declaran (`afip_web.py:42-55`) | **lo descarta en silencio** |
| el store | `ORIGEN_FACTURA, ORIGEN_MANUAL, ORIGEN_MP` — **`voz` no está** (`cobro_store.py:55`) | guarda `manual`, su default |
| el lector TS | `v === 'factura' \|\| 'mercadopago' \|\| 'voz' ? v : 'manual'` (`ingresos.ts:101`) | el `manual` que vuelve pasa como legítimo |

**Y lo que ninguna capa puede ver:** cada una está documentada como correcta, y dos de ellas declaran
por escrito que existen para impedir exactamente el resultado que la composición produce.
`ingresos.ts:12` abre con *«`origen` no es cosmético y por eso viaja siempre»*. `cobro_store.py:241-244`
dice *«`origen='manual'` lo distingue de lo que el sistema **vio** … No valen lo mismo como evidencia
… Por eso el origen es parámetro: el que escribe es quien sabe qué vio»*. Y el normalizador del lector
(`ingresos.ts:95-98`) explica que su caída a `manual` *«está elegida»* porque lo contrario sería darle
*«el peso de algo que el sistema vio, que es exactamente la mezcla que `origen` existe para impedir»*.
Las tres son ciertas por separado. Juntas producen la mezcla: **un ingreso que nadie tipeó queda
registrado como tipeado a mano**, y el fallback del lector borra la última huella de que falta un dato.

**La parte que cambia el ítem de backlog, y que el lote no dijo:** `registrar_suelto` **lanza**
`CobroInvalido` si el origen no es `manual` o `mercadopago` (`cobro_store.py:252-253`), y `voz` no
pertenece a ese dominio. Así que agregar `origen` a `IngresoBody` —el fix de una línea que cualquiera
tomaría— haría **fallar con 400 todo ingreso dictado**. El descarte silencioso es, hoy, lo único que
impide el error. El ítem no es *«agregar el campo»*: es **decidir si `voz` es un valor de `origen` o
una propiedad del gesto**, y después reconciliar cuatro dominios. Es una decisión de diseño, no un
parche — y quien la tome sin leer esto embarca una regresión en el camino del dinero.

#### 🕳️ El modo de ceremonia: configurable en las dos apps, con **tres relatos contradictorios** y **cero ramas**

Verificado por mí, incluido el control. El backend lo guarda, lo valida y lo migra
(`perfil_negocio_store.py:27-61`, `presupuestos_web.py:63,85`, `provision.py:402-421,634`), y las dos
apps lo leen, lo escriben y lo **muestran** (`perfilNegocio.ts:63,79,123,214,233`;
`IndicadorModoCeremonia.tsx` + `ChatView.tsx:220` en mobile; las dos `PantallaPerfilNegocio`). Lo que
no existe es alguien que **ramifique** por él:

- `AUTOMATICO` se importa en `presupuestos_web.py:27` y **no aparece en ninguna otra línea del
  archivo** (grep completo).
- `modo_de()` (`perfil_negocio_store.py:36`) sólo lo llaman **tests** (reportado por L07, N-01).
- Y el único **409** cerca del modo en todo `presupuestos_web.py` es **el comentario que lo afirma**
  (`:81`), no una línea de código. Lo grepeé entero: los otros nueve 409 del archivo son de facturar,
  de CUIT y de transiciones de estado.

Los tres relatos, en el código, hoy:

| dónde | qué dice |
|---|---|
| `presupuestos_web.py:81` | *«`automatico` es un valor real que está **en pausa** → 409 con el motivo»* |
| `presupuestos_web.py:109` | *«✅ El modo automático quedó **HABILITADO** el 2026-07-29, tras pagar su condición»* |
| `tool_catalog.py:1047` | *«Hoy el modo es **siempre confirmación**, así que esta tool siempre propone»* |

**Y la respuesta del código no es ninguna de las tres:** `automatico` está en `MODOS`, así que la
validación lo **acepta**, se **guarda**, la UI lo **muestra como puesto**… y se comporta idéntico a
`confirmacion`. No es «en pausa» —eso sería un 409 visible y honesto— ni «habilitado» —eso sería
funcional—: es **aceptado y ignorado**, que es el peor de los tres para el emprendedor, porque la
única señal que recibe dice que quedó configurado. Es la clase *«el registro vivía en tres idiomas y
el lector hablaba uno»*, con el agravante de que las dos UIs **describen** el comportamiento
automático en texto.

#### 🔗 Las tres convergencias, que es lo que más vale para el backlog

Acá L07 no agrega hallazgos: agrega **la causa** de tres que ya estaban con el síntoma. Un backlog que
los trate como ítems separados va a arreglar síntomas.

1. **«Entró» se calcula en dos lugares y uno duplica el pago de MercadoPago.** ⚠️ Esta línea decía
   *«cuatro definiciones que no coinciden»* hasta que la segunda ronda de L07 se retractó y lo
   verifiqué: son **dos totales** (`inteligencia_queries.py:43-49` · `cobro_store.py:328+`), un
   **feed** que no suma (`actividad_store.py:102-117`, su comentario lo dice) y un **subconjunto
   declarado** (`inteligencia_queries.py:128-137`, `origen = 'factura'`, así nombrado en su
   docstring). **La corrección mejora el hallazgo:** el ítem no es reconciliar cuatro lados, es
   **quitar la unión que duplica** — el webhook escribe el pago aprobado en `mp_payments` **y** en
   `copiloto_cobros` (`mp_web.py:53-54,68-71`) y sólo el primer total une las dos. Y el
   docstring del segundo cita el contrato vigente (*«`caja.entro` suma los tres `origen` sin
   filtrar»*), así que **el que se desvía de lo escrito es el primero**. El doble conteo está en
   portada, serie **y** detalle (N-21, `[LEÍDO]`), con tests que no lo ven. *Detalle y mecanismo
   en §N.2/L07.*
2. **El gate de paridad de `idemKey` también es ciego a Ingreso** (`idemkey_paridad.py:93,119-129`):
   quitar la derivación mantendría la paridad y **el gate seguiría verde**. Es el **segundo** agujero
   del mismo gate que el hallazgo insignia de §5.8 ya acusaba —ahí comparaba sólo los dos fronts entre
   sí, acá no mira Ingreso—. Dos lotes, dos huecos, un instrumento.
3. **El ratchet de alcance por tenant no ve las rutas armadas con f-string**
   (`test_ratchet_endpoint_tenant_scope.py:381-385`), y su propio comentario (`:390-394`) **afirma una
   cobertura de cobros e ingresos que el ratchet no tiene**; los tests hostiles de `/ingresos/{id}` sí
   existen pero usan f-strings (`test_afip_web_facturas.py:372,382,400,411,427,442`), así que no
   cuentan. Declara `_DEUDA_TENANT_SCOPED_SIN_TEST = 65` (`:154`) y exime `/mp/callback` y
   `/mp/webhook` (`:111-112`). Con esto son **tres lotes independientes** —L03, L08 y L07— cayendo en
   la misma costura de evidencia multitenant, que en el índice es **un solo ítem transversal**.

#### Y cuatro más que sostienen por sí mismos

- **🔴 La card de ingreso de mobile no llega a «resuelto» con un ingreso completo** (`[LEÍDO]`,
  REQUIERE_DEVICE para confirmar). `onGuardado` sólo hace `setMonto`
  (`mobile/src/modules/chat/TarjetaIngresoPropuesto.tsx:85-90`); la resolución se persiste **únicamente** dentro de `onListo`
  (`:91-94`), que se dispara sólo desde el botón «Así está bien», que se renderiza sólo si
  `faltan.length > 0` (`FormularioIngreso.tsx:268,284`). Con un ingreso completo imprime *«Anotado, con
  todos los datos.»* y nada más: un remount vuelve a `editando` y la segunda vez el duplicado
  responde 409. **La web no tiene el defecto** —persiste en `onGuardado`
  (`TarjetaIngresoPropuesto.tsx:115-119`)—, así que es el patrón de *dos clientes gemelos donde el fix
  llegó a uno*.
- **🚫 El webhook de MercadoPago afirma «SIEMPRE 200» y es falso** (`mp_web.py:48`): responde 500 por
  el handler global y **no hay DLQ**. En un webhook de pagos eso no es cosmético — el 500 define si MP
  reintenta o abandona, y lo que se pierde es la noticia de que entró dinero. Alrededor: `verify_webhook`
  devuelve `False` **sin log**, `MP_WEBHOOK_BASE` sin setear produce la URL literal `"None/mp/webhook"`,
  la firma no incluye `cid`/`seller` y no hay filtro por `type`/`topic` (N-24).
- **🕳️ Cuatro capacidades que no existen** (CAP-28 a 31): el lote las declaró con `elementos: ninguno`,
  que es la forma correcta de reportar una ausencia — nombrada, no omitida. Son las únicas
  `NO_EXISTE` de todo el relevamiento.
- **📐 Cero tests de paridad para ingresos, presupuestos y cobros** (N-39): existen para
  `auth/me/catalog/chat/reply/warm/serviceRisk` y para ninguno de este lote, y el core se prueba sólo
  con `HttpPort` falso. Es el hallazgo del adaptador HTTP de §N.1 con su alcance medido en este
  dominio. Y la cobertura web es asimétrica contra mobile (N-38): sin test de `FormularioPresupuesto`,
  `TarjetaPresupuesto`, `ResumenIngresos` ni `TarjetaIngreso` en web.

#### Lo que el lote declaró de su propio método

No corrió tests ni SQL —no hay Postgres en la PC, y los `@necesita_pg` corren sólo en el VPS—, así que
**todo su análisis de carrera y de doble conteo es `[LEÍDO]`**, y lo marcó. El único comando de
ejecución fue un script del repo en modo lectura (`idemkey_paridad.py --inventario`). Declaró además
los dos `??` ajenos del árbol que no abrió —que son este documento y su script de citas—, y que usó
comentarios y docstrings *«sólo como contexto, nunca como prueba»*. Esa distinción es la que hace
utilizable un reporte de 40 hallazgos: sin ella, los tres relatos contradictorios del modo de
ceremonia habrían entrado como evidencia de algo.

### §5.9 · L09 — conexiones · apps · modo por app · ajustes · guía de capacidades

**82 elementos · 19 capacidades · 20 búsquedas negativas, cada una con su control positivo.** El lote
que más aporta sobre una superficie que ningún otro miró: **lo que la app le promete al emprendedor
antes de que toque nada**. Sus hallazgos no son fallas de cálculo — son **desfasajes entre lo
anunciado y lo que existe**, que es la clase de defecto que no da excepción, no rompe un test y llega
igual al usuario.

Verifiqué yo mismo las cinco afirmaciones de mayor consecuencia. Cuatro se sostuvieron; la quinta se
sostuvo **y mi propia primera medición de ella estaba mal**, lo cual dejo escrito abajo porque el
error es instructivo.

#### 🕳️ El «Modo por app» está implementado en los dos extremos y no existe en ninguno

Tres cortes independientes, los tres verificados por mí, y **cualquiera de los tres alcanza** para que
la función no exista:

1. **La web manda el campo en todos los mensajes.** `sendChat({session_id, text, kind, mode})` —
   `mode: opts?.mode ?? null` en **cada** POST (`apps/copiloto-web/src/modules/chat/useChat.ts:395-400`).
2. **El backend no lo declara, así que lo descarta en silencio.** `ChatIn` tiene exactamente tres
   campos —`session_id`, `text`, `kind`— (`apps/copiloto/web.py:532-535`); sin `extra="forbid"`,
   pydantic **tira la clave sin avisar**. Y el `raw_update` que viaja al workflow se arma a mano con
   esas tres (`apps/copiloto/web.py:817`), así que ni por accidente podría pasar. Mobile manda
   `payload`, también indeclarado: **el mismo agujero, por el otro lado**.
3. **La pantalla que elegiría el modo no tiene puerta.** `AppsScreen.tsx` está implementada y `TABS`
   no tiene clave `'apps'`: nadie navega ahí.

Es la intersección de dos clases de este índice —🕳️ capacidad completa que nadie alcanza, y 🚫 camino
ausente— y el punto para la planificación es que **el ítem no es «cablear el modo»**. Hay *dos*
pantallas de apps en la web, cada una con su propio `useConnections`, y un extremo que publica un
campo que el otro no declara. Primero se decide si el modo existe; recién después hay trabajo de
cableado. Es, además, el ejemplo más limpio del documento de *dos decisiones correctas que se cruzan en
un agujero*: ninguna de las dos capas está mal por separado.

#### 🔬 El control negativo que se desarmó solo — y el test que lo sostenía no existe

`/capacidades` publica una capacidad **sólo si su tool está en el catálogo que recibe el LLM**
(`tool_catalog.py:403`, `... if tool in ofrecidas`), y el módulo explica por
qué el filtro no usa `TOOL_INDEX`: hacerlo publicaba una tool podada, *medido contra el vivo*. El
diseño es correcto. Lo que se cayó es su **control**.

La fila de `emitir_factura` está en `_CAPACIDADES` con su razón escrita (`tool_catalog.py:375-377`):

> *«`emitir_factura` queda declarada aunque **todavía no exista** (hito 9): es una capacidad FUTURA que
> aparecerá sola. Es el control vivo del guard `test_facturar_por_voz_NO_esta_en_la_guia_todavia` —
> sin una entrada así, el filtro pasaría siempre sin filtrar nada.»*

**Las dos mitades son falsas hoy.** `EMITIR_FACTURA_SCHEMA` **está dentro** de `build_tool_catalog()`
(`tool_catalog.py:450`), así que la capacidad existe y el filtro la publica; y el guard que el
comentario nombra **no existe en ningún archivo** (grep de
`test_facturar_por_voz_NO_esta_en_la_guia_todavia` en `apps/`: el único hit es el comentario que lo
cita). El resultado es exactamente el que el comentario advierte: **las 10 filas pasan el filtro**, no
queda ninguna entrada que pruebe que filtra, y el instrumento que lo hubiera cazado es **un nombre sin
archivo**. Es la clase 📜 —*la exención cita una autoridad que no la ampara*— aplicada a un control
positivo, con el agravante de que acá la autoridad citada **nunca** existió.

**Y la cifra, con su unidad.** El catálogo ofrece **17** tools: 13 locales (`tool_catalog.py:445-452`)
más 4 de servicios (`gmail_send`, `docs_create_doc`, `docs_read_doc`, `sheets_append_row`). La guía
publica **10**. Quedan **7 que el emprendedor puede disparar y la ayuda no menciona** — `calendar_book`,
`mp_charge`, `completar_ingreso` y las 4 de servicios. ⚠️ **Mi primera medición dio «5 de 15» y era el
denominador equivocado:** conté los `"name"` del archivo, que incluyen las dos consultivas **podadas**
(`consultar_cliente`, `consultar_actividad` — fuera del catálogo a propósito) y **excluyen** las de
servicios, que se suman recorriendo `services.modules()`. El 15 se lee del archivo; el 17 sólo sale
**siguiendo el ensamblado**. Lo dejo escrito porque es el mismo error que este documento le cuenta a
otros: *una cifra sin la unidad —aquí, sin «ofrecidas al LLM»— se deja citar para cualquier pregunta*.

**Y lo que verifiqué por mi cuenta, porque decide el ítem de backlog: la tool está cableada completa
en producción.** El runner exige seis dependencias y si **una sola** viniera en `None` contesta *«no
puedo facturar por voz ahora mismo»* (`tool_catalog.py:1362-1366`). Las seis llegan en el composition
root del worker —`afip_cred_store_factory`, `afip_perfil_store_factory`, `abrir_borrador_dictado`,
`consultar_factura_dictado`, `signal_factura_dictado`, `buscar_borrador_dictado`
(`worker_b.py:260-266`)—, así que **publicarla en la guía es correcto**: la capacidad existe de punta a
punta. (Y no emite: arma el borrador y propone la card, porque emitir es un acto fiscal irreversible
que dispara el usuario — diseño declarado en su docstring.) La precisión importa para la
planificación: el ítem **no es** despublicar `emitir_factura`, es **devolverle al filtro su control
negativo y escribir el guard que nunca existió**. Un lector apurado de la fila 🔬 podría concluir lo
contrario.

**El recuento de los comentarios rancios, medido, con mis dos errores a la vista.** Son **tres** los
lugares que afirman en presente que `emitir_factura` no existe: `tool_catalog.py:351` (*«NO EXISTE»*),
`tool_catalog.py:375` (*«todavía no exista»*) y `apps/copiloto/web.py:1212`. ⚠️ Mi primer grep devolvió
**uno** porque exigía los dos términos en la **misma línea** —el defecto de *no era que no cazaba el
patrón, era que no lo cazaba en su forma real*—, y L09 reportó **cuatro**. Ninguno de los dos números
era el medido. Con el patrón abierto a las tres grafías y descontando los hits ajenos (`provision.py`,
un test de memoria y una pantalla de AFIP hablan de otra cosa), el número es **3**.

#### 🔥 Las cards prometen lo que la poda se llevó

Esto no es deuda interna: es el texto que el emprendedor lee **antes de conectar**.

- **Gmail** anuncia *«Enviá y buscá mails desde el chat»* y lista
  `capabilities: ["Leer mails", "Enviar mails", "Buscar"]` (`catalog.py:38-39`). El módulo expone
  **una sola** tool: `TOOLS = {"gmail_send": "send"}` (`gmail.py:68`). **Dos de las tres capacidades
  anunciadas no existen** — y el propio módulo dice por qué: *«Poda del hito 2: `gmail_fetch` se fue —
  leer correos se quitó por la auditoría de Google»*. La poda fue una decisión correcta; **la card no
  se enteró**.
- **Calendar** anuncia *«Buscar turnos»* y no hay tool de búsqueda; el slug de buscar evento lo usa
  sólo Mi Día, por fuera del agente.
- **El prompt react** promete *«crear documentos y planillas»* y nada crea una planilla:
  `sheets_append_row` **appendea a una que ya existe**, con un `spreadsheet_id` que el emprendedor
  tendría que dictar.

#### 🔬 El contrato de riesgo cuenta a Drive como servicio con tool viva

`SERVICIOS_CON_TOOL_VIVA` incluye `"googledrive"` (`service_risk_contrato.py:29-36`) y `drive.py`
declara `TOOLS: dict[str, str] = {}` con el comentario *«TOOLS vacío = el agente no ofrece Drive»*
(`drive.py:74-75`). El artefacto que debería ser la fuente de verdad del riesgo **afirma lo contrario de
lo que el módulo dice de sí mismo**, y su test lo deriva de la existencia del módulo, no de su
contenido: certifica por el criterio equivocado. Alrededor quedan los restos inertes de las tres apps
que ya no se ofrecen —la rama `drive_` de `_artifact_for`, inalcanzable, y un paso `then` cableado para
Instagram sin productor—.

#### 🕳️ El badge RECONECTAR que nunca aparece — y el contador que suma lo caído

`needsReconnect` es `return false` literal (`ModeButton.tsx:21-23`), y **su propio docstring lo
declara**: *«real (`needs_reconnect`/`status`, fuera de este ownership) — ese día esta función pasa a
leerla»*. O sea: pendiente declarado, no bug escondido — y por eso es el ítem **más barato** del lote:
`/catalog` **ya manda** `status: 'caido'`, el dato llega y el componente lo tira.

La asimetría que lo acompaña sí es un defecto: una app caída viaja con `connected=false`, así que el
contador de la web **la suma en «disponibles»** mientras su card muestra RECONECTAR. El mismo dato,
leído con dos criterios, en la misma pantalla. Y en la misma familia: la web se come el fallo de
vinculación que mobile sí muestra, el 404 del desconectar es error para la web y éxito para el core, y
una app caída ofrece Reconectar pero **ningún** cliente ofrece Desconectar, aunque el backend sí revoca
lo no-ACTIVO.

#### 📐 Comentarios que mienten sobre el presente, y la evidencia que falta

Ninguno de éstos rompe nada hoy; todos son **combustible del próximo error de lectura**, que es la
razón por la que este documento los cuenta aparte en vez de ignorarlos:

- **tres** comentarios afirman en presente que `emitir_factura` no existe y hoy es falso —entre
  ellos el docstring de `/capacidades`, que narra *«ya había nacido con el bug: prometía «facturale
  80 mil a la panadería» cuando `emitir_factura` **no existe**»*— aunque el mecanismo que ese
  docstring describe sí funciona (recuento y citas más arriba);
- Ajustes de mobile dice «5 entradas» con **8** reales, y el jest fija las 5;
- `catalogo.ts` del core dice «8 servicios» con **5** vivos, y se contradice consigo mismo sobre
  `disconnect_path`.

**Y una corrección a L09, que baja un hallazgo de categoría.** El lote reportó como defecto que
`COPILOTO_ENGINE_MODE` tiene default `"dispatch"` (`apps/copiloto/web.py:119`) mientras el worker
registra **sólo** el prompt react, de modo que un rollback correría el dispatcher viejo con el prompt
nuevo. **El mecanismo es real y ya está escrito, con dueño y con pago** (`worker_b.py:248-252`):
*«Deuda gestionada (pre-existente…): el domain registra UN solo `system_prompt` (el react)… Por eso un
rollback a `engine_mode=dispatch` correría el dispatcher con el prompt react → dispatch fallback
DEGRADADO (ya lo estaba). Pago: que este composition root arme prompt+engine_mode por
`COPILOTO_ENGINE_MODE`. Owner: operador.»* Un riesgo **declarado, con dueño y con el pago nombrado** no
es un hallazgo de este relevamiento: es deuda conocida, y meterlo al índice inflaría la tabla con algo
que el repo ya sabe. Lo que **sí** queda abierto es de otra naturaleza: el **valor vivo** de la
variable no está en el árbol —los units cargan `/etc/unreal-copilot/copiloto.env`— así que *qué motor
corre hoy en producción* **no es verificable desde el código**. Eso va como **medición pendiente**, no
como bug. (El `engine_mode` de `register_domain` se guarda y nadie lo lee.)

Huecos de evidencia del lote, nombrados: `GET /capacidades` y `/conceptos` **sin test HTTP** · ningún
test ata el catálogo de apps al toolset del react · el `throw` de `configurarApi` sin test ·
`AjustesScreen` **sin archivo de test**, con lo que 6 de las 9 entradas de su router no están cubiertas.

### §5.1 · L01 — facturación AFIP: emisión, anulación, comprobantes, wizard

**181 de 181 elementos** (backend 47 · web 39 · mobile 23 · core 72), partición verificada por script:
cada elemento en exactamente una capacidad. **21 capacidades** — 5 completas, 15 parciales y **1 que no
existe** (Factura A/B) — y **24 hallazgos** inesperados. El lote más caro del relevamiento: 5h 47m y
1.793 lecturas.

Y el resultado que más importa para el método: **de las cinco afirmaciones que verifiqué yo, cuatro son
instancias de clases que este documento ya tenía nombradas** antes de que L01 existiera. La taxonomía
del §I no fue una etiquetadora a posteriori: resultó **predictiva**.

#### 🔴 El estado que nadie escribe — y por qué «lo facturado» da **−X y +X para el mismo mes**

Este es el hallazgo donde causa y síntoma se juntan, y lo verifiqué entero.

**La causa.** `AfipComprobanteStore` define tres estados, entre ellos `ESTADO_NOTA_CREDITO = "nota_credito"`
(`afip_comprobante_store.py:24`). El alta de una fila toma `estado: str = ESTADO_EMITIDA` por default
(`:34`), y **las dos llamadas que registran una nota de crédito no pasan `estado`**
(`afip_factura_activities.py:161-168` y `:181-187`: pasan `cbte_asoc_nro` y no `estado`). Resultado:
**ninguna fila de la base vale nunca `nota_credito`**. El único lector del literal es una guarda de
`validar_anulacion` (`afip_rules.py:800-803`), y el tipo del core lo declara como estado posible de un
comprobante (`packages/core/src/api/afip.ts:82-83`). Es, otra vez, *la costura que lee un campo que
nadie escribe*.

**Lo que eso rompe en la pantalla.** Las dos UIs deciden si ofrecer «Anular» por el estado, con el
**mismo** código y el **mismo** comentario (`apps/copiloto-web/src/modules/facturacion/SeccionMisComprobantes.tsx:22-26` y
`apps/mobile/src/modules/facturacion/SeccionMisComprobantes.tsx:24-28`):

```ts
/** Un comprobante `estado==='emitida'` puede anularse; los demás (`anulada`/`nota_credito`) no vuelven
 *  a ofrecer la acción -- ya son el resultado de una anulación o la anulan a otro. */
function esAnulable(c: Comprobante): boolean { return c.estado === 'emitida'; }
```

El comentario **declara exactamente la protección que el código no puede dar**: como la nota de crédito
se guarda `emitida`, las dos listas **ofrecen «Anular» sobre una nota de crédito**. Es la clase *el
comentario que declara una protección desactiva la búsqueda del próximo* en su forma más limpia — y
ningún test lo ve, porque los tests de las dos listas usan **un solo** comprobante, tipo 11 y estado
`emitida` (`apps/copiloto-web/src/modules/facturacion/SeccionMisComprobantes.test.tsx:39,46` y
`apps/mobile/src/modules/facturacion/SeccionMisComprobantes.test.tsx:36,43`): nadie arma una fila de
nota de crédito y mira qué botón aparece.

**Y el mismo default hace que dos totales se contradigan en el signo.** Verifiqué los dos predicados que
más difieren de los cinco que L01 encontró:

| | el SQL | las notas de crédito |
|---|---|---|
| **1** `afip_comprobante_store.py:186-190` | `sum(CASE WHEN tipo_cbte = ANY(NOTAS_CREDITO) THEN -total ELSE total END)`, `estado != 'anulada'`, **sin exigir CAE** | **restan** (por tipo) |
| **2** `inteligencia_queries.py:118-126` | `sum(total)`, `estado <> 'anulada' AND cae IS NOT NULL` | **suman en positivo** |

Para una factura de $X anulada con su nota de crédito por el total en el mismo mes —que es **lo que
produce el flujo**: la NC se emite por el total del original (`afip_rules.py:821-822,844`) y después la
original se marca `anulada` (`afip_anulacion_workflow.py:158-169)`— la definición **1 da −X** y la
definición **2 da +X**. Las dos dicen en su docstring que calculan «lo facturado». **La divergencia no
es de criterio fiscal: la produce el default de `estado`**, porque la NC llega a la definición 2 como
`emitida` y suma. Y ninguno de los tres tests que ejercitan la definición 2 inserta una nota de crédito
(`test_inteligencia_queries.py:212-223, 288-299, 303-313`; control positivo de la técnica:
`test_contabilidad_integracion.py:121` sí arma una).

*Para la planificación:* **un solo sitio de fix para el síntoma visible** —escribir
`estado=ESTADO_NOTA_CREDITO` en las dos altas— y **una decisión aparte** para el total, porque ni
siquiera con el estado escrito la definición 2 excluiría la NC: filtra por `estado <> 'anulada'`, no por
tipo. Son dos ítems, no uno, y el orden importa: el estado primero, porque además apaga el «Anular»
sobre una nota de crédito.

#### 🔴 El fix contra la doble emisión llegó a la factura y **no** a la nota de crédito

El riesgo está escrito en el repo con una precisión que no se puede mejorar
(`afip_factura_workflow.py:277-282`):

> *«El número lo reserva el WORKFLOW, no la activity… Sin esto, el check-before-act de la activity
> interroga un número que por construcción nunca se emitió: si AFIP autorizó el 11 y la respuesta se
> perdió, el reintento pregunta por el 12 —"no existe"— y **emite el 12**. Dos CAE por un solo pedido.»*

La factura reserva el número y lo pasa a la activity, detrás de un `workflow.patched`
(`afip_factura_workflow.py:287-297`). **`AnulacionWorkflow` llama a la misma activity con cinco
argumentos y sin reserva** (`afip_anulacion_workflow.py:116-120`), así que la activity cae en
`gateway.ultimo_comprobante(...) + 1` (`afip_factura_activities.py:146-147`) — **el camino exacto que el
comentario describe como productor de dos CAE**, y el único guard que queda ahí es el
`existe_comprobante` que ese mismo comentario declara inútil (`:148`).

Es la clase ***el fix ya existe en otro call-site — propagar, no diseñar*** sobre la superficie más caro
del producto: un comprobante fiscal duplicado. Agravantes verificados por el lote: un test llama a ese
camino *«la doble emisión»* y lo deja verde **a propósito** (`test_afip_doble_emision.py:102-115`), el
test de la activity con una NC le pasa `nro_reservado=7` (`test_afip_anulacion_workflow.py:245`) — **un
argumento que el workflow de anulación nunca envía**, así que el test prueba un camino que producción no
usa—, y ningún test del workflow de anulación simula la autorización perdida.

#### 🔥 Las dos UIs ofrecen Responsable Inscripto y el motor sólo emite Factura C

- Las dos pantallas ofrecen la condición en el selector de IVA (`apps/copiloto-web/src/modules/ajustes/afip/PantallaAfipSetup.tsx:37` y
  `apps/mobile/src/modules/ajustes/afip/PantallaAfipSetup.tsx:74`).
- `calcular_totales` sólo implementa C y lo dice: *«El desglose de IVA para Factura A/B no está
  implementado todavía… **No emitir A/B por este camino**»* (`afip_rules.py:302-306`,
  `NotImplementedError`).
- `validar_perfil` **no rechaza** RI (`afip_rules.py:371-404`) y, lo decisivo,
  **`puede_facturar = bool(creds) and bool(perfil)`** (`afip_web.py:635`): **no mira la condición**. La
  app le dice a un responsable inscripto que ya puede facturar.
- Con el perfil guardado, la query `estado` del workflow levanta `NotImplementedError`
  (`afip_factura_workflow.py:113` → `:389-393`), que **no es un error de dominio**: por NE-K cae en el
  mismo lugar que todo lo demás.

El código escribió la instrucción —«no emitir A/B por este camino»— y **la UI no la hace cumplir**. Es
`C21 NO_EXISTE` con puerta abierta.

#### 🚫 `InvalidOperation` se escapa del signal — y el fix está en el módulo de al lado

`agregar_item` construye `Decimal(str(...))` dentro del try y atrapa `(ValueError, TypeError)`
(`afip_factura_workflow.py:149-157`). `decimal.InvalidOperation` es un `ArithmeticError`: **no es
ninguno de los dos**, así que una cantidad o un precio no numérico **no llega** a `item_invalido` —
sale del handler del signal y se vuelve una falla de workflow task, que reintenta en vez de contestar.
Y el módulo de reglas **ya resolvió esto**: `a_decimal` atrapa `(InvalidOperation, TypeError)` y lo
convierte en `ValueError` (`afip_rules.py:288-291`). El signal no lo usa.

Otra vez *el fix ya existe en otro call-site*, y con el mismo perfil de los demás: los tres códigos de
error de los signals de edición —`datos_venta_invalidos`, `cliente_invalido`, `item_invalido`— **no
aparecen en ningún test** del backend.

#### 🔬 El código que informa la causa informa **una sola** causa

El tramo de emisión tiene un `except Exception` que marca RECHAZADA y fija
`motivo_codigo = "rechazo_afip"` (`afip_factura_workflow.py:305-308`) — **el único lugar del backend que
escribe ese código**, y el core lo documenta como *«rechazo fiscal de verdad»*
(`packages/core/src/api/afip.ts:154`). Pero la política de reintentos sólo excluye `RechazoAfip` y
`SinCertificado` (`:64-65`), así que **cualquier otro error** de la activity, agotados sus 3 intentos,
llega al mismo `except` y se reporta como rechazo de AFIP. Ningún test del backend afirma ese código.
Es el *degradado prudente hacia el caso benigno* invertido: todo se informa como el caso **más**
específico, y el diagnóstico queda envenenado para cualquier otra causa.

Y dos `raise` quedan **fuera** de ese try: `armar_payload_wsfe` (`afip_factura_workflow.py:269`) y, en la
anulación, `armar_payload_nota_credito` (`afip_anulacion_workflow.py:113`, antes del try de `:115`).

#### 🔬 Registros que citan autoridades inexistentes — la tercera vez en este documento

`presupuesto_store.py:115` dice que **`test_presupuesto_facturado.py` compara esta función contra
`web._wf_id_factura`**. Ese archivo **no existe** (`find` por nombre en el árbol: 0 resultados; el
nombre sólo vive en ese docstring). Verificado por mí. Es el mismo defecto que el guard inexistente de
§5.9 y que el *acta de dos casos* de la fila 📜 del índice: **un registro que delega su crédito en un
instrumento que nadie puede abrir**.

L01 enumeró **once** comentarios más contradichos por el código, entre ellos: el core dice que
`ConectarBody` no declara `ambiente` y lo declara (`afip_web.py:109`) · dice que `GET /afip/estado`
exige `cuit` y es opcional (`:599`) · habla de *«los 13 endpoints»* de facturación cuando hay **23** bajo
`/afip` · `cobro_store.py:52-54` dice que el origen `mercadopago` *«todavía no lo escribe nadie»* y
**`mp_web.py:65-71` lo escribe** —el mismo webhook del doble conteo de la fila 1— · y `afip_web.py:396`
cita como test del orden de rutas un archivo que no contiene esa prueba.

#### 🕳️ Lo registrado, producido o expuesto que nadie dispara ni lee

- **`purgar_secretos_vencidos`**: activity registrada en el worker (`worker_b.py:370`) **sin ningún
  disparador**; su docstring promete la higiene de los handles vencidos. El único test del borrado
  guarda un vencido y un vigente y afirma que **el vigente sigue siendo consumible** — *«un
  `purgar_vencidos` que no borrara nada también cumpliría esa aserción»*. Es un **control que no mira**:
  la clase 🛥 del índice, encontrada por el lote sin que se la pidieran. Y su `DELETE` **no filtra por
  `cliente_id`**, a diferencia del `consume` de al lado (`afip_credential_store.py:339` vs `:328`).
- **`listar_comprobantes`**: activity registrada (`worker_b.py:374`) sin llamador; la ruta lee el store
  directo, **con un tope de 200 filas que la activity no aplica**.
- **`fecha_min` / `fecha_max`**: la ruta las agrega a la respuesta para que la UI deshabilite fechas
  (`afip_web.py:294-304`) y **no las nombra nadie** — ni el core, ni las UIs, ni un test.
- **`GET /afip/comprobantes/{id}`**: un solo consumidor, mobile. En web, `apps/copiloto-web/src/modules/actividad/destinoActividad.ts:58-62`
  devuelve `null` para factura y nota de crédito con un comentario que dice que esos módulos web no
  existen — **y el módulo de facturación web sí existe**, sólo que nadie le pasa un id inicial.
- Dos símbolos del front exportados sin consumidor de producción (`esRechazoPorFaltaDeCertificado`,
  `tituloComprobanteConTotal`), cada uno probado **sólo en la plataforma que no lo usa**.

#### 📐 El control adversarial que falta, y el ratchet que no cuenta a sus propios hostiles

**Anular un comprobante ajeno no tiene test adversarial.** Los adversariales de anulación cubren
*confirmar* y *consultar* la anulación de otro tenant (`test_afip_web_facturas.py:187-197` y `:201-212`),
pero **no «A pide anular el comprobante de B»**, ni a nivel ruta ni a nivel store. Por la regla dura de
este repo —*control de autorización sin test adversarial = control no verificado*— ese control queda
`[UNVERIFIED]`, y es exactamente el caso que el ratchet **cree** cubierto: acredita
`/afip/comprobantes/anular` por menciones literales, y dos de ellas la usan **sólo como preparación**.

Y el ratchet mismo: deuda congelada en **65** rutas con tenant sin test hostil, con sus comentarios
admitiendo que **los tests hostiles escritos con f-string no se cuentan** (`ast.JoinedStr`) y que sólo
**dos** archivos cuentan como adversariales, con uno excluido a propósito. Un instrumento que no puede
ver a parte de lo que mide, y que lo declara.

#### ⚠️ Y uno que no es un defecto, pero hay que saberlo

`spikes/afip-e2e/prod_facturas.py` **emite facturas y notas de crédito en producción**, con guard por
variable de entorno (`CONFIRMO_PRODUCCION != "si"`) y una ruta absoluta del VPS antepuesta al
`sys.path`. Está fuera de la suite y nadie lo dispara solo. Lo listo porque un relevamiento que no
nombra al único script capaz de emitir un comprobante fiscal real sería incompleto.

#### Los resultados negativos, que valen tanto como los hallazgos

Tres barridos volvieron **limpios**, los tres con control positivo declarado:

- **Las 28 rutas HTTP ↔ las 28 llamadas del core, emparejadas una a una** (20 por método y ruta, 8
  leyendo la línea). Ninguna llamada apunta a una ruta ausente y ninguna ruta queda sin llamada. El
  control de que el script no calla: una corrida previa, sin quitar comentarios, **sí** marcó desparejos.
- **`create_afip_app` cableada completa**: 17 parámetros, 17 pasados por keyword, comparado con `ast`.
- Y mis tres pre-verificaciones, hechas mientras el lote corría: **`emitir_factura` está cableada de
  punta a punta** (las seis dependencias en `worker_b.py:260-266`), **la factura no tiene ventana de
  doble emisión** (el signal setea un booleano, la corrutina transiciona una vez, `puede_emitir` exige
  `ESPERANDO_CONFIRMACION`), y el **default de ambiente cae siempre en homologación** — aunque por
  coincidencia de dos literales independientes, no por construcción (`AMBIENTE_DEFAULT = "dev"` con un
  único consumidor, y un literal propio en `worker_b.py:297`). Ese último es un ♊ en el único default
  donde divergir en silencio decide si una factura es real.

## §N · Refutación adversarial de los `EXISTE_Y_COMPLETO`

*(Por qué esta pasada existe: un `NO_EXISTE` equivocado cuesta una verificación de más. Un
`EXISTE_Y_COMPLETO` equivocado hace que el backlog **saltee** trabajo necesario, y eso se paga en
producción. Así que el sesgo de esta sección es deliberado: tumbar.)*

### N.0 · El método que funcionó no fue el que estaba planeado

El plan era despachar un agente refutador por veredicto. Antes de eso volví a cada lote y le pedí
una sola cosa: **por cada `EXISTE_Y_COMPLETO`, qué tendría que ser falso para que se caiga.** No
«re-verificá» ni «defendé»: nombrá el supuesto más débil.

Eso tumbó más veredictos que cualquier refutador externo, y en menos tokens. Un agente al que se le
pide re-verificar su conclusión **la confirma** —es el sesgo que la memoria de este repo ya tiene
escrito—; uno al que se le pide nombrar el supuesto que la sostiene **la desarma él mismo**, porque
nombrarlo es ya medirlo contra la regla. Dos de los tres lotes respondieron con frases que ningún
refutador habría conseguido:

> *«es el veredicto en el que menos confío, porque no leí ni un assert de esos tres tests»*
> *«con lectura estricta de la regla del composition root este veredicto cae a `EXISTE_PARCIAL`»*
> *«no deben entrar en ningún conteo de verificado»*

**Para el backlog esto es un procedimiento, no una anécdota:** todo veredicto de completitud que
entre al backlog debe venir con su campo «qué tendría que ser falso». Sin ese campo, el veredicto es
una afirmación; con él, es una medición con su propio margen declarado.

### N.1 · 🔴 El hallazgo transversal que degrada veredictos de TODOS los lotes

Medido por mí, no reportado por ningún lote:

| medición | valor |
|---|---|
| tests de `packages/core/src/api/` | **27** |
| de esos, los que falsean el `HttpPort` | **24** |
| adaptadores HTTP reales de producción | 3 — `apps/copiloto-web/src/adapters/http.ts:12` · `apps/mobile/src/adapters/http.native.ts:31` · `apps/mobile/src/adapters/http.web.ts:12` |
| tests sobre esos adaptadores | **mobile sí** (`apps/mobile/src/adapters/http.test.ts`, 4 casos) · **web NINGUNO** (`apps/copiloto-web/src/adapters/` no tiene un solo `.test.`) |

Consecuencia directa: **un test de `core/api` acredita la lógica del cliente, no que la app hable de
verdad con el backend.** Ejercita el `apiClient` real con un transporte inventado, cuyas respuestas
las escribió el autor del test. Nada en esa cadena puede ver fallar un cambio de forma del backend.

Y la asimetría apunta al lado que importa: el adaptador **sin** test es el de **web**, que es la cara
que está LIVE en producción. Tiene 50 líneas con lógica real —construcción de `FormData` multipart,
guard de `Blob` con mensaje propio, corte por `AbortController`, decisión de *no* fijar
`Content-Type` para que el browser ponga el boundary— y su docstring se declara «port directo» del de
mobile, que sí tiene los cuatro casos (JSON con su `Content-Type`; multipart por `uploadAsync` y
nunca por `fetch`; parseo idéntico al de `fetch`; un 4xx con cuerpo vacío que no revienta al
parsear). **Lo que mobile probó y web no, es exactamente la lógica que web copió.**

Esto no invalida los veredictos: los reclasifica. Toda capacidad cuyo `veredicto_evidencia` se
apoye en un test de `core/api` es `TEST_EJERCITA_PROD` **del cliente**, no del camino completo.

### N.1.bis · 🔴 Diez tests que **ningún gate ejecuta nunca** — ocho por marca y dos por variable de entorno — y la pregunta de §N+1 queda cerrada

El documento declaraba pendiente *«qué provee el gate y qué no»* (§5.6, hallazgo 6). L06 la midió al
responder su `lo_mas_fragil`, y lo verifiqué entero. Queda cerrada:

| gate | variables que pasa | archivo:línea |
|---|---|---|
| **GitHub Actions** | `DATABASE_URL` (rol `copiloto_app`, NOSUPERUSER, NOBYPASSRLS) · `UC_RLS_FORCE` · `PGPASSWORD` | `.github/workflows/tests.yml:68-71` |
| **gate del VPS** | las anteriores **+** `COPILOTO_AUTOSANACION_DSN` · `COPILOTO_CONSOLA_DSN` | `sync-test-backend.sh:53-60` |
| **ninguno de los dos** | ❌ `OPENAI_API_KEY` · ❌ `GRAPHITY_CODE_API_KEY` | — |

Los marcadores son `pytest.mark.skipif` definidos **inline en cada archivo**, con el nombre del env en
claro (`test_beta4a_soporte_clasificador_cadena.py:31,:36`). Así que la cuenta es mecánica:

**8 tests únicos, en 4 archivos, no corren en ningún gate automático** (y L02 midió **2 más** por otro mecanismo —`skipif` por variable de entorno de tenant, no por API key—, así que el total es **10**: ver §N.2/L02, donde además queda el ítem correcto para el backlog, que no es habilitar marcas sino **hacer visible todo test colectado-y-salteado**) —
`test_beta4a_soporte_clasificador_cadena.py` (2 de 2, cada uno con las cuatro marcas) ·
`test_autosanacion_cadena_completa.py` · `test_spike_beta0_forjador_vs_sintomas.py` ·
`test_auditor_parches.py`. Entre ellos está **la cadena completa del clasificador de feedback**, que
es justamente la capacidad del hallazgo 1 de §5.6 (la que tampoco tiene disparador en producción).
Esa capacidad no tiene ni Schedule que la arranque ni gate que la pruebe.

**Por qué esto no es «falta cobertura» sino un hallazgo del instrumento.** El mismo `gate.sh` hace lo
correcto dos veces, al lado:

> *«GoTrue de test efímera, misma disciplina que Postgres arriba — **fail-closed** (si no levanta, el
> job backend falla) para que los 8 tests `@necesita_gotrue` no vuelvan a depender de que alguien se
> acuerde de correrlos a mano (ese era exactamente el gap de BL-J11).»* — `gate.sh:205-207`

El repo **ya pagó este error** (BL-J11), lo entendió, y lo resolvió con la solución correcta —
provisionar la dependencia, fail-closed — para Postgres y para GoTrue. Para el LLM y el grafo de
código, no. Y lo que lo vuelve grave no es la omisión: es que **el gate no lo declara**. El grep de
`OPENAI` y `GRAPHITY` en `gate.sh` y en `scripts/ci/backend.sh` da **vacío**: no hay aviso, no hay
conteo, no hay `PG_AVISO` equivalente al que sí existe para Postgres (*«OFF — los tests
`@necesita_pg` se SALTAN»*, `sync-test-backend.sh:63`). Un test que se saltea **sale verde**: ocho
tests escritos, ninguno ejecutado, y ningún lugar donde eso se vea.

Es la asimetría dentro del mismo archivo, que es la forma más fuerte de control negativo: no es «falta
algo», es «está hecho dos veces acá al lado y la tercera vez no, sin decirlo».

**Para el backlog** el ítem es chico y de alto rendimiento, y tiene la plantilla escrita: el patrón de
`test-gotrue.sh --export` + fail-closed es exactamente lo que falta replicar — o, si la decisión es no
pagar un LLM real en CI, **declararlo** con un aviso como el de Postgres, para que «8 tests no
corren» sea visible en vez de invisible. Lo que no puede quedar es el estado actual, donde el verde
del gate incluye ocho tests que nadie ejecutó.

**Y un umbral más que envejeció:** el comentario de `gate.sh:206` dice «los 8 tests
`@necesita_gotrue`»; L03 contó **10** (`test_auth_login_gotrue_real.py` + `test_cambiar_cuenta_gotrue_real.py`).
Tercer caso en este relevamiento de una cifra escrita en un comentario que el corpus dejó atrás.

#### Y una corrección a mi propio N.1, que L06 acotó bien

Mi N.1 decía que el adaptador HTTP de web no tiene test y que eso afecta a los veredictos que se
apoyan en `core/api`. **Está sobre-generalizado.** L06 lo midió: la web tiene **dos** caminos de red
y el hueco sólo toca a uno.

| camino | qué falsea su test | ¿lo toca el hueco de `adapters/`? |
|---|---|---|
| `lib/api/client.ts` → `fetch` | **sólo `fetch`** (`soporteAudio.test.ts:21`, `admin.test.ts:64`) | **no** — ese test ejercita el cliente real de producción |
| `@copiloto/core` → `adapters/http.ts` | el `HttpPort` entero | **sí** — y el adaptador que queda en medio no tiene test |

Así que el hallazgo se mantiene pero con alcance recortado: **afecta a los caminos web que pasan por
el core** (`obtenerMiTicket`, feedback, inteligencia, capacidades, conceptos, contabilidad), **no** a
los que van por `lib/api/client.ts`. Esto además confirma desde el otro lado el hallazgo 7 de §5.3:
*hay dos clientes HTTP en la web*, y por eso una afirmación sobre «el cliente de web» es ambigua
hasta que se dice cuál.

Corrección aceptada y anotada: mi medición contó los tests de `core/api` correctamente y después
atribuyó la consecuencia a toda la web. **Un agente acotó mi hallazgo con una lectura que yo no hice**
— que es exactamente para qué sirve pedir el supuesto más débil, incluso sobre los hallazgos propios.

### N.2 · Resultado por lote

#### L11 — capa transversal: de **9**, sobreviven **3**

Y la cifra misma fue el primer hallazgo: **la fila de §5.11 decía «7», y ese número lo inventé yo.**
El lote nunca reportó un total; contados sus bloques son 9. Una cifra que nadie midió entró al
documento con la misma apariencia que las medidas. Corregido en §5.11.

| veredicto | capacidades | por qué |
|---|---|---|
| **sobrevive** | `POST /transcribir` (`web.py:853`) · `/healthz` **sólo como liveness** (`web.py:1439-1441`) · ReAct `call_llm_tools`/`execute_tool` (`motor/backend/agent/agent_activities.py:153,:202`), con reserva de alcance | pegan a la ruta/activity real; sólo el proveedor externo es inyectado |
| **cae a «función pura»** | SHA de build web (`buildSha.ts:6,:10`) · umbral de inundación del DLQ (`trauma_store.py:55`) · textos de pull-to-refresh (`textosRefresco.ts:24`) | el test llama la función suelta; **nada ejercita su cableado** |
| **cae a «código + jest»** | `PantallaRecientes` · `LogoMarca` · `abrirLink`/`compartirLink` | el propio lote: *«no deben entrar en ningún conteo de verificado»* |

Tres hallazgos técnicos que salieron **de la refutación**, no del relevamiento:

1. 🔴 **El SHA de build web es un instrumento cuyo cableado nadie prueba.** Los 6 tests llaman
   `resolveBuildSha`/`injectBuildSha` sueltas; **nada ejercita `vite.config.ts:14-22`**. Si el plugin
   no engancha o lee otra fuente, los tests siguen verdes y el SHA **no llega al HTML**. Es el
   instrumento con el que se verifica qué versión está desplegada: si miente, miente callado.
2. **`flood_threshold` degrada en silencio.** Un `COPILOTO_FLOOD_THRESHOLD` inválido devuelve 10
   **sin log** (`trauma_store.py:49-67`): un env mal escrito es invisible.
3. **`execute_tool` no atrapa las excepciones del executor** (`agent_activities.py:213-215`)
   **contra lo que afirma su propio docstring** (`:204-206`). Noveno comentario contradictorio.
4. **No hay readiness en todo el repo.** `/healthz` no toca DB ni Temporal; el grep de
   `readyz|readiness|livez` sólo devuelve un comentario en un script de GoTrue. Por eso el veredicto
   vale como *liveness* y no como «el servicio está sano».

#### L04 — mi día / BI: de **5**, sobreviven **2** (y los salvé midiendo, no el lote)

- **CAP-12** (helpers puros de Mi Día) y **CAP-14** (formato de dinero): el lote los declaró con
  **baja confianza explícita** —*«no leí ni un assert»*—, dados por válidos por inferencia. **Los
  medí y sobreviven**: los cinco tests existen con asserts reales (7/15, 3/3, 3/11, 15/27, 6/7
  casos/expects), **importan de la fuente** en vez de reimplementarla, `fechaDeHoyMidia` se cubre con
  fechas fijas, y `formatoDinero.ts` **no usa `Intl`** — la única mención de `toLocaleString` es un
  comentario que advierte contra usarlo. El riesgo «verde en Node no prueba Hermes» **queda
  descartado**. *La conclusión del lote era correcta; su justificación no lo era.*
- **CAP-06, CAP-09, CAP-15b** (clientes core de actividad, Mi Día y perfil): **caen** por N.1 —
  `HttpPort` falso, adaptador real nunca ejercitado. **CAP-15b cae dos veces**: su rama 409 (modo de
  ceremonia impuesto por el backend) se puede ejercitar contra un transporte falso **sin que el
  comportamiento exista**, porque en producción nada la dispara (`modo_de` sin llamador). Un test que
  prueba una rama inalcanzable es el caso puro de «el test que no usa el camino de producción no lo
  ve fallar».

#### L10 — agenda/admin/DLQ/grafo: de **14**, uno se auto-degradó y cinco quedan con reserva nombrada

Primero una corrección de premisa, suya y justa: le atribuí una sección «lo que está sólido» que su
reporte no tenía. No la tenía.

- 🔴 **AD-1 — el control de acceso de la consola admin — se auto-degrada a `EXISTE_PARCIAL`.** El
  barrido es genuinamente adversarial (sin claim → 403, escalada por `user_metadata` → 403, sin
  header → 401, más control positivo y **control de ceguera**), pero **arma el guard sin issuer**
  (`test_admin_authz_barrido.py:58`) y **ningún test recorre `serve._serve()`** ni monta el guard
  real en `create_web_app`. Por la regla del composition root de este repo, el control más
  importante del lote no está verificado en su cableado de producción.
- **DL-1** — `_conn_dlq_factory` (`worker_b.py:135-154`), el eslabón que entrega la conexión
  BYPASSRLS en producción, **no lo referencia ningún test** (grep = 0).
- **DL-3** — `gh` está **siempre doblado**: «abre el PR o el issue en GitHub» es inferencia, nunca
  ejecución.
- **GR-1** — el único test cross-tenant del log de eventos lee con **un lector propio del test**, no
  con el de producción (`grafo_sync_activities.py:52-65`).
- **AD-5** — el gating del shell **no es** control de acceso, y el propio código lo dice
  («Ergonomía, no control de acceso»). El control real es AD-1, que es el que se degradó.
- **CE-2** — *«es el veredicto con la evidencia más delgada de mi lista»*, por sus propias palabras.

Y sobre el `RUTAS_ADMIN_MINIMAS = 9` frente a 12 rutas: **mi pregunta al lote estaba mal formulada**
—pregunté «cuáles son las 3 rutas que el barrido no cubre», y no hay tales. Verificado leyendo
`_rutas_admin()` (`:66-75`): recorre `app.routes` **dinámicamente** y rellena los path params, así
que cubre todas. El defecto es del **umbral**, exactamente como §5.10 lo había escrito: el piso del
control de ceguera está calibrado **3 por debajo** de la realidad, así que si el filtro se rompiera y
pasara de 12 a 10 rutas, el control seguiría verde habiendo perdido dos. Un umbral del día envejece
con el corpus.

#### L06 — soporte/inteligencia: de **25**, sostiene **7**, reserva **15**, retira **3**

**La mejor respuesta de las siete, y la única que produjo hallazgos nuevos al falsearse.** No contestó
de memoria: hizo **9 lecturas puntuales** para medir las premisas que la compactación le había dejado
sin detalle, y las marcó `[nuevo]` una por una. Tres de esas lecturas encontraron cosas que su
relevamiento original no tenía.

| resultado | cuántos | criterio que declaró |
|---|---|---|
| **SOSTENGO** | 7 — C04a, C05a, FB-C, AD-2, AD-3, W-I2, W-I4 | el código real corre con sólo fronteras externas falseadas, y no conoce brecha propia |
| **CON RESERVA** | 15 | brecha nombrada que no cambia el veredicto pero lo baja si importa |
| **NO LO SOSTENGO** | **3** — F-A, I-A, M-I3 | pasa a `EXISTE_PARCIAL` |

Y distinguió los tres retirados por **naturaleza**, que es lo que el backlog necesita y ningún otro
lote hizo: **F-A e I-A son falta de test** (código correcto por lectura) · **M-I3 es defecto de
código**.

**M-I3, el defecto nuevo:** `useGrafico` de mobile (`mobile/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:46-59`) hace
`await leer()` **sin try/catch**, y los `leerGrafico*` del core relanzan todo `ApiError` salvo
405/501/503 (`core/src/api/inteligencia.ts:433-438`). Ante un 500, 400, 401 o 404 el resultado queda
`null` y **la tarjeta se queda en «Cargando» para siempre**, con un rechazo sin capturar. Ningún test
cubre ese camino. **Y el mismo hook existe en web** (`copiloto-web/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:47-58`). Es el patrón
*«el mismo defecto vivía dos veces»*, con las dos copias rotas igual.

**I-A:** los `?detalle=` **sí filtran por `cliente_id`** en el SQL (verificado por él: `:327,:337,:341,:378,:485`),
y **ningún test los prueba contra un tenant B** — los cuatro siembran sólo A. Por la regla dura del
repo, aislamiento sin test adversarial es aislamiento no verificado. El código está bien; la evidencia
no existe.

**F-A:** los dos únicos tests que ejecutan la activity real del clasificador llevan **las cuatro
marcas**, dos de ellas (`necesita_llm`, `necesita_graphity_code`) que **ningún gate habilita** → N.1.bis.

**Reservas que importan para el backlog:** `autor="agente"` lo escribe
`soporte_agent_tools.py:170` y las dos UIs rotulan **«Vos»** todo autor que no sea `'operador'`
(`MiTicketScreen.tsx:144`, `PantallaTicket.tsx:136`) — **el emprendedor lee como propio lo que escribió
el agente**, con el tipo dejado como string abierto (`soporteTicket.ts:34`) y la columna sin `CHECK`.
Y C01: cambiar `SOPORTE_TASK_QUEUE` o `engine_mode` **no rompería ningún test**.

**Corrección que me hizo, y la acepto:** sobre el canario del filtro de capacidades (§5.6, hallazgo 2),
su K1 ya tenía el hecho —`tool_catalog.py:450` incluye el schema y las 10 tools lo tienen, así que
`capacidades_vivas()` no excluye ninguna—. Lo que yo agregué fue nombrarlo como *verde por vacío*; el
hallazgo era suyo. La discrepancia real era sólo el **nombre** del guard que cita
`tool_catalog.py:376`. Coincidimos en el veredicto: K1 queda `EXISTE_PARCIAL`.

#### L03 — auth/legal: de **16**, sostiene **9**, caen **7** — y el eje aislamiento queda *inferido*

Primero una cifra que corrige: el lote declaró **16**, no los que yo había anotado, y los volvió a
contar sobre su propio reporte. Los nueve que quedan en pie son C01, C05, C09, C10, C12, C14, C15,
C16 y C21. Los siete que caen lo hacen **todos por evidencia**, ninguno por código ausente — y dos de
ellos (C13, C17) caen **sólo en el eje aislamiento**: su función sigue completa.

**T1, el que más importa, y el razonamiento es el mejor del relevamiento.** T1 era el veredicto
insignia del aislamiento multitenant — *«el token de A no alcanza lo de B»*. El lote lo descompuso en
la conjunción que realmente es:

> (1) el token resuelve a **un** `cliente_id`, lo decide el guard · **Y** · (2) ese `cliente_id`
> acota las filas, lo deciden handler y store.

El adversarial HTTP ejecuta **sólo la segunda**. La primera corre contra un `dict`
(`_RequireTenantByToken`, `test_adversarial_multitenant.py:233`, cableado en `:315` con
`gotrue=None` y sin `require_claims`). Y el filtro SQL del store **no puede** sostener T1 por sí
solo, con una frase que vale escribir tal cual: *filtra por el `cliente_id` que recibe, no decide de
quién es*. Así que T1 no puede quedar por encima de su segunda mitad, y se degrada a una
sub-afirmación más chica —*«el handler usa sólo el `cliente_id` del guard y los stores filtran por
él»*— que sí está acreditada con PG real.

**Y el remate convierte el hallazgo de §5.3 en algo medible:** si el `SELECT` de `auth.py:81-83`
perdiera su `WHERE`, **ningún pytest lo detectaría de forma determinista** —`test_auth.py:63-75`
resuelve por `dict` e ignora el SQL; `test_admin_tenants.py:99-116` siembra **un** tenant y sólo
asserta `status`—. Eso ya no es «falta un test»: es un fail-open sin alarma, en el control que la
regla dura del repo declara no negociable.

**El censo que lo cierra.** De los **36** archivos de `apps/copiloto/tests` que arman apps pasando un
`require_tenant=` ya construido, el `make_require_tenant` **real** aparece en **2**: `test_auth.py:106`
(conexión falsa, registry de **un** usuario) y `test_admin_tenants.py:89` (PG real, **un** tenant). Hay
además ~60 usos de `_require_tenant_401()` en 16 archivos que **fabrican el 401 en el propio test**, así
que esos *«sin token → 401»* no acreditan nada del guard real. Lo único que compone guard real + root
real + dos tenants + token real son **dos scripts E2E manuales contra producción**
(`scripts/e2e_bl_o6_legal_aceptacion.py:111-153` y `scripts/e2e_g6_adversarial_multitenant.py`), y **ni
el gate, ni el CI, ni el deploy los invocan** (`deploy.sh:519`).

**Conclusión que el backlog necesita, en los términos de la regla del repo:** en el eje de aislamiento
de tenant, *«control de autorización sin test adversarial = control no verificado»* **no está
satisfecha por el gate** — está **inferida** de tres pruebas parciales que alguien compone leyendo. Y
el lote fue justo en la excepción: el rol **admin** sí tiene su adversarial con guard y JWT reales
(`test_admin_tenants.py:202-211`), repetido contra prod en el smoke manual.

**C12 y otro instrumento que se mide a sí mismo.** El contrato `CLAVES_ME` (9 claves,
`me_contrato.py:11-21`) **no lo acredita ningún pytest**: ninguno lo importa, y los asserts de dict
completo son de **8** claves, de la rama *sin* claims. Lo compara con el payload real sólo el smoke
manual. Y `scripts/test-smoke-veredicto.py` lo prueba con un stub **que devuelve el contrato mismo** —
o sea prueba el comparador, no el handler. Tercer instrumento de este documento que acredita su propia
salida.

**C06, y toca el camino que §5.3 marcó como el único que funciona.** El login con Google por
`id_token` necesita `GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK=true` —lo dice el docstring del propio
grant (`onboarding.py:255-257`)— y el compose versionado usa `environment:` explícito con **sólo
cuatro** variables de Google (`docker-compose.gotrue.yml:92-95`): **desde lo versionado, el flag no
llega al contenedor.** No se puede automatizar sin un `id_token` real, así que la evidencia sólo puede
venir de un login real en el teléfono.

**Y dos que el propio código ya rotulaba.** C04 (refresh inválido/expirado/reusado) y el re-signup de
C10 llevan `[ASSUMED_PENDING_VERIFY]` escrito en el archivo (`onboarding.py:237-239`, `:132`). El lote
no los descubrió: los **respetó**, que es lo que la marca pide y casi nadie hace.

**El residual que declaró no poder leer:** que la cifra `_DEUDA_TENANT_SCOPED_SIN_TEST = 65` sea
exactamente 65 y que el ratchet esté verde en este SHA — porque los **miembros** de la deuda no existen
como lista, fixture ni json: se calculan en cada corrida (`test_ratchet_endpoint_tenant_scope.py:441-447`).
Los dos endpoints `/auth/cambiar-*` quedan como deuda **por derivación**, no por lectura de una lista.

#### L02 — chat/HITL/voz: de **8**, sostiene **uno**. Y refutando encontró un defecto de código

La mortandad más alta del relevamiento: **1 de 8**. El único que queda en pie es C20 (los separadores
de fecha del chat), y queda bien: el lote nombró tres supuestos débiles y los midió en vez de
defenderlos — el parser acepta `T` o espacio, con o sin fracción ni offset, no depende de `Date.parse`
y **ante un formato ajeno degrada a «sin fecha», no a una fecha inventada**
(`separadoresFecha.ts:59-69`). Eso último es lo que lo salva: un degradado que no fabrica dato.

#### 🔴 El mecanismo exacto de la card HITL — y mi error al llamarlo «nuevo»

**Primero la corrección, porque es del tipo que este documento vigila:** lo escribí como *«defecto nuevo»* y **no lo es**. El hallazgo ya estaba en §5.2 (hallazgo 2), con las mismas tres líneas y la misma consecuencia — lo había traído L02 en su reporte original. Rotularlo nuevo infla el rendimiento aparente de esta segunda ronda, que es exactamente la clase de artefacto que §4.6 documenta para los instrumentos ajenos y §N+1 para las cifras propias. Lo que la refutación **sí** agregó son tres cosas que §5.2 no tenía, y la primera es la que explica por qué nadie lo vio:

1. **Por qué TypeScript no avisa:** `hitlMessageId` no figura en el tipo del parámetro de `manejarEleccion`, y una función que acepta **menos** propiedades es asignable donde se espera una que acepta más. El compilador da verde por regla, no por descuido.
2. **Que el core tampoco lo infiere** (`chatMachine.ts:319-326`): no hay una segunda chance aguas abajo.
3. **Que el test que debería haberlo cazado usa la `ListaMensajes` real** (`ChatView.test.tsx:247-270`) y aun así sólo asserta `sendChat` — o sea que el caso pasa por el código roto y el assert mira para otro lado.

La cadena, verificada por mí eslabón por eslabón:

| eslabón | qué hace | archivo:línea |
|---|---|---|
| la lista | pasa `{ displayText, hitlMessageId: mensaje.id }` a `onChoice` | `ListaMensajes.tsx:336,339` |
| **el puente** | **declara el parámetro como `{ payload?, displayText? }` y reenvía sólo esos dos** | `ChatView.tsx:149-152` |
| el hook | arma `hitlRespondido` **sólo si** `opts?.hitlMessageId` llegó | `mobile/src/modules/chat/useChat.ts:338-342` |
| el core | marca la card **sólo si** el evento trae `hitlRespondido`; no lo infiere | `chatMachine.ts:319-326` |

La lista lo manda, el puente lo tira, y los dos de abajo lo exigen. **Y no hay quién avise:**
`hitlMessageId` no figura en el tipo del parámetro de `manejarEleccion`, y en TypeScript una función
que acepta **menos** propiedades es asignable donde se espera una que acepta más — así que el
compilador da verde. Efecto, por lectura: el emprendedor confirma o cancela, la burbuja de su
respuesta aparece, y **la card sigue con sus botones** en la sesión viva; recién al rehidratar puede
quedar resuelta, porque ahí entra otro mecanismo (`sanitizarHitlRespondido`, declarado en el
comentario de `ListaMensajes.tsx:330-331`).

**Por qué ningún test lo ve, que es la parte reusable:** `ListaMensajes.test.tsx:126,150` inyectan
`hitlRespondido` **a mano**; el `mobile/src/modules/chat/useChat.test.ts:142-171` de mobile llama `send` con el
`hitlMessageId` **a mano**; y `ChatView.test.tsx:247-270` —el único que aprieta «confirmar» con la
`ListaMensajes` real— **sólo asserta `sendChat`** (`:269`). Las dos mitades están fijadas por separado
y el eslabón del medio es justo el roto. Y el comentario de `ChatView.tsx:147-148` dice que sigue *«el
mismo criterio que `handleChoice` en `ChatScreen.tsx` de la PWA»*, donde la cadena **sí** está
completa: el fix llegó a un lado.

#### Dos instrumentos más que no pueden ver lo que vigilan

- **El propio `jest.setup.js` de mobile impide modelar el caso de C21.** `jest.setup.js:246` reemplaza
  `useFocusEffect` por `useEffect(cb, [cb])`, y el consumidor mobile del mensaje pendiente
  (`ChatView.tsx:140-145`) depende exactamente de que el foco vuelva al cerrar un `transparentModal`.
  No es que falte el test: **el harness no puede escribirlo.** Control positivo del lote: los tres
  productores sí tienen test del `tomarPendiente()` real, en ambas plataformas.
- **El STT de producción no lo instancia ningún test.** `GroqSTT` es el default real
  (`serve.py:314-316` → `web.py:550-565` → `stt.py:55-69`, multipart armado a mano), y los tests que
  entran por ese camino **se frenan en el chequeo de la key** (`stt.py:42-44`); el resto inyecta un
  `transcribe` lambda. `urlopen` sólo se falsea para OpenAI. Lo acreditado del audio es el handler
  —auth, 413/415/422/502/503— y el ruteo por tenant, **no que la voz llegue a transcribirse**.

#### Y N.1.bis sube de 8 a 10, por un mecanismo distinto

L02 midió dos tests más que **ningún gate corre nunca**: `test_e2e.py:47-50` y
`test_e2e_tool_action.py:36-39` **se colectan** (`scripts/ci/backend.sh:33`) y **se saltean**, porque
piden `COPILOTO_CLIENTE_ID` + `COPILOTO_COMPOSIO_USER_ID` — **0 hits** en `scripts/`, `.github/` y
`deploy/`, con `DATABASE_URL` como control positivo (sí aparece en los tres). Y **tampoco usan HTTP**:
el único que cruza `POST /chat` → poll `/reply` es `smoke_beta_e2e.py:157-185`, script vivo fuera del
gate.

Lo que esto agrega a §N.1.bis no es la cifra: es que **son dos mecanismos distintos** de no-ejecución —
marcas `skipif` por API key (los 8) y `skipif` por variable de entorno de tenant (estos 2)—. Un
inventario que busque sólo marcas conocidas encuentra ocho y declara el barrido completo. Para el
backlog: el ítem no es *«habilitar las marcas»*, es *«hacer visible todo test colectado-y-salteado»*,
que es una sola línea de `pytest` (`-ra` con assert sobre `skipped`) y cubre las dos familias y las que
vengan.

#### Las cuatro autocorrecciones, y por qué cuentan como resultado

El lote corrigió su propio reporte en cuatro puntos, y uno es del tipo que el contrato anti-ceguera
existe para cazar: **su META listaba `requiereConexion.test.ts` entre las aserciones NO leídas, y a la
vez C11 lo citaba como `TEST_EJERCITA_PROD`.** Una contradicción interna, dentro del mismo informe,
visible sólo porque el formato obliga a declarar qué se leyó. Los otros tres: C23 llevaba
`EXISTE_Y_COMPLETO` con `SIN_TEST` directo, contra su propio criterio; C13 rotulaba `TEST_EJERCITA_PROD`
una subida probada con `fetch` stubbeado; y C21 afirmaba que ningún test cruza productor→chat, falso
para web. **Ninguna de las cuatro la habría encontrado un refutador externo**: las cuatro salen de
confrontar el informe contra sí mismo.

#### L05 — cáscara/design-system: de **10**, sostiene **3**. Y trajo el mejor método de toda la pasada

Resultado: quedan en pie C02, C13 y C18a; caen los siete restantes (C05, C06, C07, C09, C11a, C14,
C16). Total corregido del lote: **21 capacidades = 3 completas / 18 parciales**.

**El método, que es reusable y lo adopto para el backlog: la prueba de mutación.** En vez de preguntarse
«¿hay un test?», se preguntó **«si quito X, ¿qué test se pone rojo?»**. Es la versión ejecutable de la
regla del composition root, y resuelve el problema que esta sección venía peleando: distingue el test
que *acompaña* al código del test que lo *vigila*. Dos veredictos cayeron sólo por esa pregunta, y
ninguna lectura de cobertura los habría tocado.

#### 🔴 El montaje del `ThemeProvider` no lo vigila ningún test — en **las dos** plataformas, con fallas opuestas

Es el resultado más limpio de la mutación. Quitar el provider de producción no pone rojo **ningún**
test, ni en web ni en mobile:

| | montaje de producción | por qué ningún test lo mira | qué pasa si falta |
|---|---|---|---|
| web | `App.tsx:95-104` (único `<ThemeProvider` fuera de tests) | el único test que renderiza `<App/>` **stubbea `ResponsiveShell`** (`App.test.tsx:21-25`), así que ningún consumidor de `useTheme` corre | **degrada en silencio**: arranca con el `:root` por defecto e **ignora la preferencia guardada**, porque sólo el provider escribe `data-theme` |
| mobile | `_layout.tsx:130,195` | **nadie renderiza `LayoutRaiz`**; el único test que monta el layout entero es `describe.skip` (`shell.test.tsx:76`) | **explota al arrancar** (`mobile/src/theme/ThemeProvider.tsx:84-86`) |

Los dos agujeros son el mismo y las consecuencias son opuestas, y **la peligrosa es la de web**: mobile
se cae ruidosamente en el primer arranque y cualquiera lo ve; web sigue funcionando, se ve bien, y
simplemente deja de respetar el tema que el emprendedor eligió. Un defecto que no se distingue de
*«no guardó la preferencia»*. Y en los dos casos los tests del provider lo montan **a mano** —diez
casos en web, y decenas de suites en mobile—, que es exactamente el patrón que la regla del
composition root existe para cazar.

#### 🔴 Cruzar el breakpoint de 900 px en web **descarta un dictado en curso**, y el docstring dice lo contrario

Verificado por mí. `ResponsiveShell.tsx:22-28` devuelve `<DesktopShell/>` **o** `<AppShell/>` —tipos de
componente distintos—, así que al cruzar 900 px React **desmonta el subárbol entero**. Su propio
docstring (`:17-19`) dice que *«ambos shells comparten la misma sesión/tema/modo **sin remontarlos** al
cruzar el breakpoint»*: es cierto **sólo de los providers**, que viven un nivel arriba, y se lee como
si nada se remontara.

El efecto está escrito en el código, en otro archivo: `MicButton.tsx:290-296` documenta que cruzar el
breakpoint desmonta el mic, y que el cleanup **anula `onstop` antes de parar** el `MediaRecorder` —
deliberadamente, *«el desmontaje no es un “enviar” ni un “cancelar” del usuario»*. La decisión es
correcta para lo que resuelve (no disparar `onSendAudio` sobre un componente muerto). Lo que **nadie
declaró** es la consecuencia de producto: **redimensionar la ventana mientras se dicta hace desaparecer
el dictado, sin aviso y sin enviarlo**. Y ningún test cruza el breakpoint con un shell montado:
`ResponsiveShell.test.tsx:43-81` monta cada ancho **por separado**, con `unmount()` entre medio y
`addEventListener: vi.fn()`.

Es el patrón de *dos decisiones correctas que se cruzan en un agujero*: el cleanup es correcto, el
switch de layout es correcto, y el hueco vive en el par.

#### 🔴 El botón de pronunciación: rama sin alimentador, asset que no existe, y un test que lo afirma igual

Verificado por mí en todo el árbol. `pronunciacionAsset` es prop de `Splash` (web, `:87,:92`) y de
`RevealEntrada` (mobile, `:78,:93`), y **ningún llamador de producción la pasa** — los únicos que la
pasan son los dos archivos de test. El asset tampoco existe: `public/` tiene cuatro `png` y nada de
audio, y `odobi.mp3` aparece **en una sola línea de todo el repo**, que es el propio test
(`Splash.test.tsx:60`).

Dos cosas distintas, y conviene separarlas:

1. **Mobile lo declara.** La cabecera de `RevealEntrada.test.tsx:2` dice *«sólo aparece con
   `pronunciacionAsset` (no hay audio en el repo…)»*. Eso es una rama deliberadamente sin alimentar, con
   su motivo escrito: deuda declarada, no descuido.
2. **Web afirma que reproduce.** `Splash.test.tsx:54` se titula *«con `pronunciacionAsset`, el botón se
   dibuja y **reproduce el audio**»* e inyecta `/assets/odobi.mp3`, **una ruta que no existe**. Pasa
   porque el `.play()` lleva `.catch(() => {})` (`Splash.tsx:184`). Es la clase *«el instrumento fabrica
   una referencia que no existe»*: el test no puede distinguir «reproduce» de «falla y se lo traga».

#### Lo demás que la mutación tumbó

- **C09 — la rama que evita centinelas huérfanos en el `history` tiene 0 aserciones** (`useBackGuard.ts:31-37`),
  y **corre en el flujo normal**: volver a Mi día por la barra baja `backDepth` sin `popstate`. Los dos
  tests que la rodean usan un `popstate` **sintético**, que no mueve el `history` real.
- **C11a — «un glass a la vez» tiene tres salidas sin guardia**: `PantallaCuenta.tsx:61,66` y
  `mobile/src/modules/feedback/PantallaFeedback.tsx:165` empujan con `router.push` directo, sin pasar por la puerta de
  `empujarUnaVez.ts`, cuya premisa (`:24`) dice que las pantallas hoja «no participan». Y el test de
  Cuenta **fija ese push directo como esperado**. *(Reportado por L05; no lo verifiqué yo.)*
- **C16 — la suscripción que le da el nombre al hook no la ejecuta ningún test.**
  `'reduceMotionChanged'` aparece **una sola vez en todo mobile**: el hook
  (`movimientoReducido.ts:52-54`), con control positivo del grep. Y tres componentes que animan
  —`PanelDeslizable`, `PanelFunciones`, `MarcoGlass`— **no consultan el ajuste en absoluto**.
- **`useSkin` no tiene consumidor de producción** (`mobile/src/theme/ThemeProvider.tsx:96`): la pantalla que debería
  usarlo lo nombra en un comentario y el código llama a otra cosa.
- **Y el mismo defecto de harness que reportó L02, medido de nuevo por otro lote:**
  `jest.setup.js:246` reemplaza `useFocusEffect` por un efecto de montaje, así que el refoco real
  **no se puede ejercitar** en mobile. Dos lotes independientes, el mismo archivo, la misma línea.

#### Y lo que afina el hallazgo 2 de §5.5

L05 midió el gate de contraste **como capacidad propia** —línea que su reporte original no tenía, y lo
declaró como omisión— y queda `EXISTE_PARCIAL` por una razón estructural: `DEUDA_CONOCIDA` es un skip
**por token, sin piso y sin chequeo de obsolescencia**, así que **no puede decir «no»** sobre los
tokens que exime. Peor: `--core` **no tiene gate vivo en ningún test** (está también en
`EXEMPT_FG_TOKENS`, `themesContrast.test.ts:187`) pese a tener 23 pares de texto reales. En cambio
`--danger-btn-fg` y `--ok-fg` **sí** se vigilan en vivo, con lo cual su exención en pares-pintados es
**redundante**. Mobile lo hace bien: excepciones **por par** y con piso `min`.

Y midió lo que yo había dejado como lectura: **44 pares** de los tres tokens, **0 por debajo de 4,5**
con los hexes vigentes, y el control positivo reproduce las cifras viejas (4,38 · 4,00 · 3,77-3,95)
inyectando los hexes retirados. La única que **no** reproduce es la cuarta exención
(`--identidad-word`: el port da 2,55 y 2,67 contra el «2,86» escrito) — discrepancia menor, pero es el
logotipo y su exención WCAG 1.4.3 es legítima, así que no cambia nada del ítem.

#### Seis autocorrecciones

Las dos que importan: **C11a lo entregó `EXISTE_Y_COMPLETO` con los tres bypasses ya escritos en su
propio motivo** —el mismo tipo de contradicción interna que cazó L02—, y **el «bajo AA» de los tres
hexes de mobile era la medición de web**, que es la que me obligó a corregir el encabezado de este
documento (§5.5, hallazgo 1 y 1.bis). Las otras cuatro: el gate de contraste sin línea de capacidad, la
rama de pronunciación no listada, los conteos de importadores de tres primitivas que incluían
importadores muertos, y el META que declaraba el árbol limpio cuando ya había dos archivos sin trackear
—que son, justamente, **este documento y su script de barrido**, depositados por mí mientras el lote
trabajaba—.

#### L08 — gastos/clientes/idempotencia: de **4**, ninguno sale intacto. **Y con esto cierran los ocho primeros: 91 de 91**

Resultado: **G1 cae · C5 se parte · A1 cae · N1w conserva el código y pierde la evidencia.** Queda en
pie uno solo en los dos ejes (C5-a, las funciones puras de normalización). El lote además **partió una
capacidad en cuatro** al refutarla —C5-a/b/c/d— y eso es lo correcto: «normalización de clientes» era
un paquete con cuatro destinos distintos, y declararlo como uno solo es justamente lo que hacía que el
verde de las funciones puras cubriera a las tres que no se ejercitan.

Verifiqué yo mismo las cuatro afirmaciones centrales. Dos son **defectos de código nuevos**, una es un
test que no puede ver lo que su nombre dice, y en la cuarta **L08 se pasó y lo corrijo**.

#### 🔴 Cambiar **sólo el tipo de documento** guarda la combinación que el guard existe para impedir

Verificado por lectura, eslabón por eslabón. El chequeo de coherencia vive **dentro** de un `if`:

| eslabón | qué hace | archivo:línea |
|---|---|---|
| el handler | llama `documento_incoherente` **sólo si** `"doc_nro" in datos` | `clientes_web.py:70-77` |
| el store | `editar` whitelistea `doc_tipo` y **no re-chequea**; el UPDATE toca sólo las claves recibidas | `cliente_store.py:375-387`, `:396-403` |
| el core | `cambiosDeCliente` es un diff **campo por campo**: `docTipo` entra solo si cambió | `clientes.ts:419-424` |
| la UI | el `<select>` de tipo es independiente del número, con su propio `setDocTipo` | `copiloto-web/src/modules/clientes/FormularioCliente.tsx:170-183` |

Así que tocar **únicamente el desplegable** emite exactamente `{docTipo: 80}`, que es la forma que
saltea el guard: un cliente guardado con un DNI de 7 dígitos pasa a declararse **CUIT de 7 dígitos**,
que es el estado imposible. L08 lo ejecutó (E6: `200`, y el store recibe `{'doc_tipo': 80}`; control
con `doc_nro` presente → `400`); yo verifiqué la cadena en el código, y la UI de **las dos**
plataformas emite esa forma (`mobile/src/modules/clientes/FormularioCliente.tsx:198` en mobile, REQUIERE_DEVICE).

**Por qué importa más que un 400 faltante:** el docstring de `documento_incoherente`
(`cliente_store.py:131-140`) dice que nació de un caso **medido**, no de una hipótesis — dictar *«CUIT
30-71234»* guardaba un DNI, *«con total confianza y sin un solo síntoma»*. El guard cierra la puerta
del alta y la de la edición-con-número; la edición-sólo-tipo quedó abierta, y por ahí entra el mismo
estado que motivó el guard. Después falla lejos: `validar_cuit` recién actúa al facturar
(`afip_rules.py:517`), con el error de AFIP y no con el del formulario.

Y hay un segundo síntoma de la misma raíz —un solo ítem de backlog con el anterior, no dos—: el
handler deja pasar **sin chequear** los tipos que no conoce (*«un tipo que no está acá pasa sin
chequear, a propósito»*, `cliente_store.py:114-118`) pero antes los pasa por `normalizar_documento`,
que es `re.sub(r"\D", "", …)` (`:72`). Un pasaporte `AB1234` se acepta como tipo y **se guarda como
`1234`** (L08 lo ejecutó, E7). La política de *aceptar lo desconocido* y la normalización
*sólo-dígitos* se contradicen, y el test que cubre el caso (`test_clientes_web.py:420-427`) **assertea
el `201` y no el valor guardado**.

Las dos son el patrón de *dos decisiones correctas que se cruzan en un agujero*: el diff por campo es
buen diseño, el guard anclado a `doc_nro` es razonable aislado, y el hueco vive **en el par**.

#### 🚫 La auditoría de la Consola **no es atómica** con la mutación, y el módulo se declara precondición

Verificado por lectura. `auditoria_store.py:6-12` no deja margen: la auditoría es *«la PRECONDICIÓN de
la mutación»*, `registrar()` **lanza** a propósito, y *«el llamador decide si aborta la mutación entera
o reintenta, pero nunca la deja pasar sin auditoría»*. El handler no aborta nada:

- `cambiar_estado` corre y **confirma** en `admin_web.py:113`; `registrar` recién en `:118-121`.
- `with tenant(...)` es un **ContextVar puro** —`_tenant.set` / `_tenant.reset`, sin una sola sentencia
  SQL (`contexto_tenant.py:68-75`)—, así que no abre ninguna transacción pese a leerse como un scope.
- Y toda conexión nace forzada a `autocommit = True` (`contexto_tenant.py:102-109`), desde el
  composition root real (`serve.py:111`). Son dos conexiones distintas del pool, cada una confirmando
  sola.

Ejecutado por L08 (E5, handler real): con `registrar` lanzando → **HTTP 500** y la secuencia
`[MUTACION_CONFIRMADA, auditoria_intentada]`.

**Y el resultado es peor que cualquiera de las dos mitades por separado:** el tenant queda suspendido,
**sin fila de auditoría**, y al operador se le responde que falló. Si reintenta, el endpoint es
idempotente por diseño (`admin_web.py:105-106`: *«cambiar al estado que ya tenía igual audita»*), así
que ve el estado destino ya aplicado y concluye que el primer intento no hizo nada. El comentario
inline de `:116-117` es la pieza fina: dice *«si esto lanza, la mutación no se confirma como exitosa
ante el operador»* — **cierto de la respuesta HTTP, y se lee como si fuera de la base**. Es la clase
*«el comentario que declara una protección ciega la búsqueda del próximo»*, en el único módulo del
repo que se autodefine como precondición.

Para el backlog: la regla dura del repo —*«control sin test adversarial = control no verificado»*—
aplica acá literalmente. Ningún test del handler fuerza el fallo de `registrar` (el barrido de authz
arma su propia app sin `conn_factory` y sólo exige «no 401/403», `test_admin_authz_barrido.py:58,97-98`).

#### 🔬 El test llamado «carrera» no puede alcanzar el índice que dice probar

Verificado por mí, y es más agudo de lo que el lote lo puso. `test_gasto_store.py:78-88` lanza dos
threads con `ThreadPoolExecutor(max_workers=2)` **sin barrera**, y assertea
`sorted(r[1] for r in resultados) == [False, True]`. **El camino serializado satisface esa aserción
idénticamente**: el thread A hace el `SELECT` vacío e inserta (`False`), el B hace el `SELECT`, lo
encuentra y devuelve `True` (`gasto_store.py:135-137`) — sin tocar nunca el `except UniqueViolation`
de `:142-150`, que es la protección real. El docstring del test declara justo la condición que el test
**no puede forzar**: *«sin el índice único parcial, las dos pasarían el SELECT vacío»*.

Control positivo: **0 hits** de `UniqueViolation`, `23505` o el nombre del índice en toda la suite de
gastos. O sea que la rama que cierra la ventana no tiene **ningún** test, y la que sí está probada
(`:47-54`, reintento secuencial) depende del `SELECT`, no del índice. El nombre y el docstring apuntan
al índice; las aserciones no pueden distinguirlo del `SELECT`.

#### ⚖️ Y acá L08 se pasó: el TabBar **sí** pinta el ícono

El lote reportó que *«el TabBar de teléfono no lo renderiza y sus tests afirman lo contrario»*. Lo
verifiqué y es falso en las dos mitades: `TabBar.tsx:141,150-151` **sí** resuelve `NAV_ICONS[tab.key]`
y lo pinta, y el test que citó (`TabBar.test.tsx:71-88`) no afirma nada sobre íconos — afirma que las
**7 funciones retiradas de la barra** no tienen botón propio a ‹900 px, que es cierto y está bien
probado. `gastos` y `clientes` están entre esas 7: no tienen ícono en el TabBar porque **no tienen
botón**, no porque el TabBar no pinte íconos.

Lo dejo escrito porque el método de este documento se apoya en que las refutaciones sean a su vez
verificables: **un refutador que se pasa es la misma clase de falla que un lote que se sobre-declara**,
y si no se mide, la segunda ronda hereda la autoridad de haber sido «la ronda que refuta».

**Lo que sí sostiene de N1w, y con control positivo propio:** `NAV_ICONS` lo importan **dos** archivos
de producción (`Rail.tsx`, `TabBar.tsx`) y **cero** tests; `GastosIcon`/`ClientesIcon` no se nombran
fuera de `navIcons.tsx`. Si `NAV_ICONS.gastos` apuntara a `ClientesIcon`, **ningún test cambiaría** —
`tsc` sólo garantiza que la clave exista, porque el tipo es `Record<TabKey, () => ReactNode>`
(`navIcons.tsx:251`) y las dos funciones tienen la misma firma. Control positivo del grep: **un solo**
test de web menciona `svg` en todo el árbol (`ServiceCard.test.tsx`), así que el barrido ve lo que
busca. Los dos íconos viven además dentro de spans `aria-hidden` (`Rail.tsx:73-74`, `TabBar.tsx:150`),
con lo cual **ninguna** consulta por nombre accesible puede alcanzarlos: la evidencia de N1w cae de
`TEST_EJERCITA_PROD` a `SIN_TEST` por construcción, no por omisión.

#### Y las dos capacidades que caen por no tener disparador

- **C5-c** (`partir_contacto`, `nombre_derivado`): sólo las llama `_asegurar_derivado`
  (`cliente_store.py:439,450`) desde `derivar_clientes` (`:458-518`), que **sólo invoca un script a
  mano** (`derivar_clientes.py:90`). Es el mismo agujero de la fila «la cartera se arma sola» del
  índice, un nivel más abajo: las funciones puras están probadas, la cadena no.
- **C5-a** es el único que queda `EXISTE_Y_COMPLETO` en los dos ejes, y el lote lo defendió bien:
  nombró el supuesto que lo sostiene —la regla de dominio (11 dígitos = CUIT, 7-8 = DNI, 99 =
  consumidor final)— y declaró que **no hay oráculo externo en esa capa**, que los tests parten de la
  misma premisa, y que si la premisa fuera falsa **caerían juntas con los tests en verde**. Eso es
  exactamente lo que se le pide a un `EXISTE_Y_COMPLETO`: no «hay tests», sino *qué tendría que ser
  falso para que esto se caiga*.

#### Cuatro autocorrecciones, una retirando su propio control positivo

La que más vale: **retiró E2 como evidencia de deduplicación**. Lo había presentado como prueba de que
la clave de idempotencia funciona end-to-end, y al revisarlo encontró que el doble `Grabador` decide
`repetido` **por sí mismo** (`len(recibido) > 1`), así que E2 sólo probaba que la clave *viaja* de
`gastos.ts:288` al store — no que el store la respete. Un control positivo que acreditaba al
instrumento, no al sujeto. Las otras tres: la corrección del TabBar que yo re-corregí en la otra
dirección, el matiz sobre `UC_RLS_FORCE` (el default del deploy **sí** se ve en el repo,
`deploy.sh:312`; lo que no se ve es el valor vivo de la base), y `documento_incoherente`, que ningún
test nombra pero **sí** se ejercita por dos caminos (`test_clientes_web.py:403-417` y la tool de voz).

#### L07 — ingresos/presupuestos/MP: de **9**, uno solo queda intacto. Y **separó los dos ejes**, que era el agujero del método

Resultado: **el eje código cae en 2** (CAP-05 *como capacidad consumida*, CAP-25) y **el eje evidencia
cae en 7** (CAP-05, 08, 16, 19, 22, 23, 24). Sólo **CAP-27** queda `EXISTE_Y_COMPLETO` en los dos ejes,
y con `REQUIERE_DEVICE`.

**La contribución de método es la separación, y vale más que la cuenta.** L07 declaró que su propio
criterio de la primera ronda **mezclaba los ejes** —exigía, para dar `EXISTE_Y_COMPLETO`, un test del
camino real de la afirmación central— y que bajo ese criterio mezclado caerían **8 de 9**. Separados,
la lectura cambia de sentido para la planificación: *«el código está bien y nadie lo vigila»* y *«el
código está mal»* son dos ítems distintos, con distinto costo y distinto dueño. Es la misma distinción
que §N.3 venía mostrando lote por lote, dicha por primera vez como criterio.

##### 🔴 El hallazgo más caro de toda la refutación: un nombre con dos referentes, soldado por un fake

`CobroStore._resumen` devuelve **dos claves casi homónimas** (`cobro_store.py:104`):

- `estado_cobro` → el estado **derivado** del cobro: `impaga | parcial | cobrada`
  (`estado_de_cobro`, `cobro_store.py:69-74`, función pura);
- `estado` → el **ciclo de vida del comprobante**, la columna `c.estado`:
  `emitida | anulada | nota_credito` (`afip_comprobante_store.py:22-24`). **Nunca vale `"cobrada"`.**

El consumidor de voz compara **la equivocada** (`tool_catalog.py:1210-1211`):

```python
queda = ("" if resumen["estado"] == COBRADA
         else f" Todavía le quedan {_plata(resumen['saldo'])} por pagar.")
```

Con el store real `"emitida" == "cobrada"` es **siempre falso**, así que **todo pago total dictado por
voz contesta «Todavía le quedan $0,00 por pagar.»** (`_plata("0.00") == "$0,00"`,
`tool_catalog.py:908-914`). Lo verifiqué yo contra el código: `COBRADA = "cobrada"`
(`cobro_store.py:46`) y la columna no tiene ese valor en su dominio.

**Y el fake lo suelda** (`tests/test_plata_por_voz.py:80-81`):

```python
return ({"id": 1, "monto": str(cobrado), "origen": ORIGEN_FACTURA},
        {"estado": "cobrada" if saldo <= 0 else "parcial", "saldo": f"{saldo:.2f}"})
```

El fake devuelve la clave `estado` **con los valores derivados** — una combinación que el store real
no produce nunca. El test pasa, producción falla, y **corregir el consumidor a `estado_cobro` pondría
el fake en rojo**: el doble vínculo completo. Los tests que sí miran lo derivado
(`test_cobros_y_catalogo.py:104,166,218,263`) asertan `estado_cobro` **sobre la función**, nunca sobre
el consumidor; y **ningún test asevera la ausencia de la frase** (grep de `Todavía le quedan` en
`apps/copiloto/tests/`: **0 hits**).

Es la intersección exacta de tres clases que este documento ya cataloga: *un nombre con dos
referentes* · *el test que no usa el camino de producción no lo ve fallar* · *el fake que sustituye al
valor perdido hace ciego al control*. Y la primera ronda de L07 **listó los llamadores
`cobro_store.py:104,148` y omitió justo éste** — el defecto estaba en el llamador que no se nombró.

##### Lo que confirma, y agrava, el `origen` del ingreso dictado (N-07)

Mi §5.7 ya decía que el fix obvio rompe producción. L07 lo cerró y verifiqué los tres agravantes, que
son **estructurales**, no incidentales:

- **borrar sólo funciona para `manual`** — el `DELETE` filtra `AND origen = 'manual'`
  (`cobro_store.py:455-457`). Darle a la voz un `origen` propio volvería **imborrable** todo ingreso
  dictado; y el docstring inmediatamente arriba declara lo contrario como diseño: *«Que borrar sea
  fácil es lo que permite que guardar sea rápido»*. El fix contradiría la razón escrita del módulo.
- **`completitud_dictada` filtra `origen = ORIGEN_MANUAL` en el SQL** (`cobro_store.py:318-319`), y de
  esa cuenta sale la oferta del modo automático: con un origen nuevo, el porcentaje pasaría a medirse
  sobre un conjunto vacío.
- **`completar_ingreso` filtra `ORIGEN_MANUAL`** (`tool_catalog.py:1135-1136`): los dictados
  incompletos dejarían de ser completables por voz.

Y un matiz que conviene no inflar: reenviar el `origen` del cliente tal cual permitiría a un usuario
**del propio tenant** fabricar filas con procedencia `mercadopago` —que además quedan imborrables por
el filtro de arriba—. **No es un agujero de aislamiento** entre emprendedores; es falsificación de
procedencia dentro del tenant, que es lo que el docstring de `listar_ingresos` dice que el campo
existe para evitar (*«un cobro que el sistema vio no es la misma evidencia que uno que alguien
tipeó»*).

##### 🔬 Y una corrección a **mi propio índice**: no son «cuatro definiciones»

L07 se retractó de su propio «4 divergentes» y lo verifiqué: **son dos totales, un feed y un
subconjunto declarado.**

| | qué es | consume |
|---|---|---|
| **A** `inteligencia_queries.py:43-49` | total: `copiloto_cobros` (todos los orígenes) `UNION ALL` `mp_payments` aprobados | Mi Día · Entró vs Salió |
| **B** `cobro_store.py:328+` | total: `sum(monto)` de `copiloto_cobros` **y nada más** | pantallas de Ingresos |
| **C** `actividad_store.py:102-117` | **no es un total**: una fila por evento. Su propio comentario lo dice — *«El feed no suma —eso es `/inteligencia/portada`»* | feed de Actividad |
| **D** `inteligencia_queries.py:128-137` | **subconjunto declarado**: filtra `origen = 'factura'`, y su docstring lo nombra *«Subconjunto de «Entró»»* | «Cobrado» de Inteligencia |

Con eso el hallazgo **mejora de precisión en vez de perderla**: la divergencia no es un *drift* de
cuatro lados a reconciliar, es **un doble conteo localizable en una costura conocida**. El webhook de
MercadoPago escribe en **las dos** tablas para el mismo pago —`upsert_from_payment` a `mp_payments` y
`registrar_suelto(..., origen=ORIGEN_MP)` a `copiloto_cobros` (`mp_web.py:53-54,68-71`)— y **A** une
las dos sin excluir el origen `mercadopago`. **B** lo cuenta una vez. Más todavía: el docstring de
**B** cita el contrato vigente —*«`caja.entro` suma los tres `origen` sin filtrar»*— así que **el que
se desvía de lo escrito es A**, y eso convierte «unificar la definición» en «quitar la unión que
duplica», que es un ítem con un solo sitio de fix.

⚠️ Y una cita de L07 que no cuadró: reportó `_cobrado` como `:128-137` **a continuación de
`actividad_store.py`**, y `_cobrado` vive en `inteligencia_queries.py:128-137`. Las líneas eran
correctas, el archivo no — un lector aterriza en un comentario sobre tickets. La clase ya tiene
nombre en §4.6; acá apareció en el reporte, no en el código.

##### Los mutantes que nadie caza — el material más barato del backlog

La prueba de mutación de L07 (`[LEÍDO]`, nada ejecutado) deja una lista de cambios que **ningún test
pondría en rojo**. Cada uno es un test que falta, nombrado con precisión:

- `inteligencia.ts:143` — poner `incompleta` en constante `false`, o borrar la línea: **ningún test**.
  El aviso de caja incompleta se puede **apagar** sin que nada lo note, aunque los dos extremos
  (la query y el componente) sí estén probados. El agujero vive **en el mapper**, en medio.
- intercambiar los íconos de `ingresos` y `presupuestos` en `NAV_ICONS`: **ningún test** (0 hits de
  `NAV_ICONS` en `*.test.ts(x)`). Lo único que sostiene la existencia es el compilador — borrar una
  clave sí da rojo, por `tsc`. «Son los canónicos» es un docstring que nada mide.
- `asunto` y `cuerpo` del `mailto` sin `encodeURIComponent`: **ningún test**, porque el test
  `decodeURIComponent`-ea la URL entera y el mutante devuelve lo mismo. El destinatario sí está
  vigilado. *El control pasa por el mismo lugar donde el defecto se cancela.*
- reemplazar el cuerpo de `dos_decimales` estricto (`presupuesto_store.py:166-173`) por el de su
  gemela tolerante (`gasto_store.py:75-82`, `try/except → 0`): **ningún test**. La palabra «estricto»
  no está ejercitada por nada.
- cambiar el **modo de redondeo** (`Decimal` usa `ROUND_HALF_EVEN`; el propio repo fija que AFIP
  espera *half-up*, `tests/test_afip_rules.py:407-408`): **ningún test** — y su alcanzabilidad **no es
  verificable desde el código**, porque el DDL base de `copiloto_presupuestos` no está en el árbol.
- retener la clave de idempotencia sin `mensajeId` (el camino `generarId()`): **ningún test**, ni en
  los formularios de ingreso (web y mobile) ni en los de presupuesto.

##### Tres hallazgos más de la ronda, los tres verificados por mí

**1 · El precio en blanco que el emisor protege, el formulario lo convierte en `0`.** El emisor de voz
preserva el hueco **a propósito** y lo dice en el código, no en un doc
(`tool_catalog.py:883`): *«Sin precio dictado → `""` (blanco en la card), **NUNCA inventado** (§2 del
contrato)»*, y emite `precio_unitario: ""`. Los dos formularios lo transportan como
`normalizarDecimal(it.precioUnitario) || '0'` (web
`copiloto-web/src/modules/presupuestos/FormularioPresupuesto.tsx:169`, mobile
`mobile/src/modules/presupuestos/FormularioPresupuesto.tsx:214`), y
`puedeGuardar` **no exige precio** (web `:172`). Resultado: el blanco que una capa se ocupó de
preservar sale **como precio cero** de la de al lado, y el presupuesto queda emitido en $0. **No son
dos bugs: es una política escrita en dos lugares con dos valores**, y el formulario gana porque es el
último que toca el dato. *Para la planificación: el ítem es decidir la política —blanco o cero— y
después hacerla valer en un solo lugar; cambiar el `|| '0'` sin esa decisión mueve el síntoma al
backend, cuyo default también es 0 (`presupuestos_web.py:137-138`).*

**2 · El deep-link a un presupuesto: muerto en web, sin `.catch` en mobile.** La prop
`presupuestoIdInicial` **existe y está implementada en las dos plataformas** (web
`PresupuestosScreen.tsx:62,140-147`; mobile `PantallaPresupuestos.tsx:48,115-122`), pero
**ningún call-site de web se la pasa**: el único que la pasa es `apps/mobile/app/presupuestos.tsx:45`
(verificado con grep sobre `apps/` y `packages/`: 11 hits, uno solo es un llamador). En web es la
clase 🕳️ de esta tabla otra vez — capacidad completa sin disparador. En mobile sí está cableada, y
ahí el defecto es otro: `void obtenerPresupuesto(id).then(...)` **sin `.catch`**
(`PantallaPresupuestos.tsx:117-120`), y el core **relanza** el `ApiError` que no es 404
(`packages/core/src/api/presupuestos.ts:319`, `throw err`) — así que un 5xx del backend sale como
**rechazo no manejado**. El `void` no es descuido: es el operador que **silencia** justo al linter que
avisaría. Y cero tests: `presupuestoIdInicial` no aparece en ningún `*.test.ts(x)`.

**3 · Dos pedazos de backend sin nadie que los pida.** El detalle de la serie «Entró vs Salió» acepta
`?detalle=<mes>:entro` y el core lo soporta con un parámetro opcional
(`packages/core/src/api/inteligencia.ts:401-405`), pero **las dos pantallas llaman sin argumento** —
literalmente `leerGraficoEntroVsSalio()` en web
`copiloto-web/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:96` y mobile
`mobile/src/modules/inteligencia/graficos/GraficosInteligencia.tsx:110`—, así
que la rama `entro_vs_salio_detalle` (`inteligencia_queries.py:314-349`) **no tiene camino desde la
UI**. Y la mitad `caja` de `/contabilidad/resumen` **no tiene ningún** consumidor: los **dos** que
leen ese endpoint en las apps —`copiloto-web/src/modules/inteligencia/AcumuladoAnual.tsx:37` y
`mobile/src/modules/inteligencia/AcumuladoAnual.tsx:38`— toman **sólo** `.facturado`, y no hay otro
(medido: los únicos lectores de `/contabilidad/resumen` son esos dos más el cliente del core y
su test). Escribí «su único consumidor» antes de medir, y eran **dos gemelos** — el mismo
descuido que este documento le cuenta a los demás. Ninguno de los dos es un bug; los dos son **trabajo ya pagado
que no rinde**, que es la razón por la que la clase 🕳️ existe en el índice y por la que conviene
contarla aparte de lo roto.

##### Las siete autocorrecciones, y la que más importa

L07 enmendó siete afirmaciones propias, entre ellas dos citas con número equivocado y un veredicto
incoherente con su propio motivo (`CAP-24`: decía `TEST_EJERCITA_PROD` «incidental» mientras el motivo
decía «sin aserción sobre el glifo»; es `SIN_TEST`). Pero la que vale como método es la octava:
**revisó sus propios controles y encontró que certificaban al instrumento, no al sujeto** — un control
que prueba *«el método ve por nombre»* no prueba *«no existe otra grafía»*. Re-midió dos de ellos con
alcance ampliado (de «10 scripts» a «todo el árbol rastreado») y **los dos se sostuvieron**; y declaró
los tres que **no** re-midió. Un lote que se audita el control a sí mismo y después dice cuál no
auditó es lo más cerca que llegó esta pasada del ideal del método.

#### L09 — conexiones/apps/ajustes: de **10**, sostienen **2**. Y las cuatro caídas son **todas de evidencia**, ninguna de código

Resultado: **sostienen 2** (CAP-07 verbos por acción; CAP-11 menú de Ajustes mobile, y éste `[LEÍDO]`,
que no es ejecución) · **caen 4** (CAP-01 y CAP-04 firmes; CAP-06 y CAP-17 reclasificables según dónde
se corte el alcance) · **4 con reserva nombrada** (CAP-03, 05, 12, 15). Las cuatro caídas son
`EXISTE_Y_COMPLETO → EXISTE_PARCIAL` con `parcial_por=EVIDENCIA`: **ningún veredicto de código se
movió**, y ningún mutante sobreviviente señala un defecto de producción. El código de este lote se lee
correcto hoy.

**La campaña de mutación más grande de toda la pasada: 113 experimentos, 81 muertos, 32
sobrevivientes** —48 de backend con pytest, 65 de JS con vitest en core y web—, cada uno sobre una
copia `git archive` del SHA, con manifiesto SHA-256 antes y después sin deriva en ninguna corrida. El
worktree no se tocó.

**Y la contribución de método, que es nueva y vale más que la cuenta: L09 clasificó a sus propios
sobrevivientes.** Tomó la separación de ejes que trajo L07 y le agregó lo que faltaba — que *no todo
mutante que sobrevive es un test que falta*. Cuatro de sus 32 sobrevivientes son **equivalentes bajo la
configuración real del gate**: con `RLS FORCE` y la conexión ligada al tenant, borrarle el filtro
explícito a una query no cambia **nada observable**, porque RLS ya recortó las filas. Un test nuevo no
los mataría; no hay nada que matar. Es la primera vez en este documento que un lote distingue *«no hay
test»* de *«no hay diferencia observable»* — y lo usó **contra sí mismo**, para retirar dos hallazgos
propios (autocorrección 9). Lo mismo con las otras tres clases que declaró: el mutante hipotético, el
valor de enumeración cuyo mecanismo sí está cubierto, y el que sólo mataría un Postgres que acá no hay.

##### 🔬 La premisa de aislamiento que el código afirma y el deploy contradice — y nadie mide la capa que el código llama «la efectiva»

Esto lo verifiqué yo, y es **más filoso que lo que el lote reportó**. El store de credenciales de
MercadoPago declara su propia barrera, dos veces, en dos lugares distintos
(`apps/copiloto/mp_credential_store.py:3-5` y `:100-101`):

> *«el filtro EXPLÍCITO por `cliente_id` en CADA query es la barrera efectiva — el worker usa el rol
> owner de `DATABASE_URL`, que BYPASSA la policy RLS»*

El deploy dice lo **contrario**, sobre el mismo mecanismo, y lo dice como lección aprendida
(`deploy/copiloto/deploy.sh:295-299`):

> *«Sin él, `provision.py` crea las tablas con RLS pero SIN `FORCE`, y la app se conecta con el rol
> DUEÑO — que Postgres exime de sus propias policies salvo FORCE. O sea: **toda tabla nueva nacería
> desprotegida**, en silencio»*

…y desde el 2026-07-31 `UC_RLS_FORCE` es **el default** (`deploy/copiloto/deploy.sh:312`,
`UC_RLS_FORCE="${UC_RLS_FORCE:-1}"`), con `provision_tables.py:154` aplicando `FORCE` y
`mp_credentials` **dentro** del set forzado (`apps/copiloto/uc_tables.json:17`). O sea: la condición
que el docstring del store describe como el presente **se arregló hace más de dos meses**, y el
comentario que un lector del store encuentra sigue describiendo el régimen viejo. Es la clase
*documentar el cambio en un comentario nuevo deja vivo el viejo*: **el arreglo se explicó en el lugar
del arreglo**, y la afirmación que lo niega quedó viva en el lugar donde se la va a leer.

Las dos consecuencias medidas, que es lo que lo vuelve ítem de backlog y no anécdota:

1. **Nadie mide la segunda capa.** Dos mutantes —`WHERE cliente_id=%s OR TRUE` en
   `apps/copiloto/mp_credential_store.py:110`, y borrar `AND cliente_id = %s` de `marcar_escuchado` en
   `apps/copiloto/feedback_store.py:52`— sobreviven, y bajo `FORCE` son **equivalentes**: RLS tapa la
   diferencia. El filtro explícito está declarado como defensa **extra**
   (`apps/copiloto/feedback_store.py:36-37`, *«nunca se confía sólo en RLS»*) y ningún test lo ve sin RLS.
2. **El instrumento que existe para medirla excluye justo estas tablas.** El repo ya tiene lo que hace
   falta: un rol `BYPASSRLS` acotado para ejercitar el guard app-side **solo**
   (`deploy/copiloto/test-db.sh:52-57`, grants en `:242-259`). Cubre 7 tablas de negocio. Medido:
   `mp_credentials` **no aparece en ese archivo** — cero coincidencias.

*Ítem de backlog:* barrer el docstring al régimen vivo **y** extender el rol acotado a las dos tablas,
que es el ítem que vuelve verificable la defensa que el código dice tener. Sin eso, la afirmación
*«el filtro explícito es la barrera efectiva»* es exactamente lo que este documento le reprocha a los
demás: una protección **declarada** y no ejercitada.

##### 🔬 El ratchet: su propio docstring enuncia el principio que su unidad de cuenta descarta

Dos cegueras nuevas del ratchet de rutas tenant-scoped, distintas de las que ya están en las filas 39
y 43 del índice (el f-string y los dos archivos). Las verifiqué yo sobre el árbol del SHA:

**1 · La unidad de cuenta es el *path*, no el par (verbo, path).** Y el instrumento **sabe** que eso no
alcanza: su propio docstring lo dice (`apps/copiloto/tests/test_ratchet_endpoint_tenant_scope.py:348-351`),

> *«el path solo no identifica la ruta (dos rutas con verbos distintos pueden compartir forma de
> `path_regex` por coincidencia)»*

…y usa el verbo **exactamente para eso**: resolver a qué ruta apunta cada llamada. Después lo tira.
`_clasificar_rutas` acumula `route.path` (`:271-285`) y la deuda se calcula restando conjuntos de
**paths** (`:439`). Consecuencia medida por el lote: un caso hostil a `GET /feedback` da por cubierto
también `POST /feedback`. El instrumento enuncia el principio y lo descarta nueve líneas después.

**2 · Cuenta por AST, no por ejecución.** La cobertura se arma parseando los archivos de test
(`ast.walk`, con el filtro de nombre `"adversarial" not in funcion.name.lower()` en `:334`), así que las
llamadas de `test_adversarial_multitenant.py` **cuentan igual cuando el archivo entero se saltea** por
falta de `DATABASE_URL` (`apps/copiloto/tests/test_adversarial_multitenant.py:43-44`). Un test que no
corrió acredita cobertura.

**3 · Y la deuda está inflada, en la dirección conservadora.** `DELETE /composio/connection` **sí** tiene
caso hostil (`apps/copiloto/tests/test_connect_endpoints.py:277`, que mata al mutante que acepta
`?connection_id=` y revoca un id ajeno), pero ese archivo no está en la tupla cerrada de dos
(`:395`), así que el path cuenta como deuda. El **65** tiene al menos un falso dentro.

⚖️ **Y acá corrijo al lote.** L09 listó entre los puntos ciegos que el ratchet excluya
`test_cobros_y_catalogo.py`. No es ceguera: es una decisión **declarada con motivo** (`:389-394`) —
sus adversariales llaman al store directo con un `cliente_id` ya resuelto y **nunca pasan por
`Depends(require_tenant)`**, que es precisamente la mitad que el ratchet existe para vigilar. Contarlos
sería acreditar cobertura falsa. El instrumento acertó ahí.

##### 📐 La raíz de composición de la web: una sola línea la sostiene, y **ningún test la importa**

`apps/copiloto-web/src/adapters/plataforma.ts` es lo que registra la web ante el core. Tiene **un solo
importador en todo el árbol**: `apps/copiloto-web/src/main.tsx:9`, un import por side-effect (medido;
el gemelo de mobile es `apps/mobile/app/_layout.tsx:24`). Borrar la llamada o borrar el import deja
**verde la suite web entera**. Y su propio docstring (`apps/copiloto-web/src/adapters/plataforma.ts:9-10`)
declara la protección:

> *«si no corrió, `config()` lanza un error explícito en vez de fallar en silencio»*

…salvo que el `throw` que lo cumple (`packages/core/src/api/config.ts:24`) **tampoco tiene test**: el
mutante que lo desactiva sobrevive en core y en web, y no hay un solo `toThrow` sobre `configurar*` en
`apps/` ni en `packages/`. La primera ronda había reservado `REQUIERE_DEVICE` sólo para el adaptador
**mobile**; el de web simplemente no tiene quien lo ejercite. Dos clases de este documento en el mismo
archivo: *verificar la composición root, no el default*, y *el comentario que declara una protección
desactiva la búsqueda del próximo*.

##### 🔬 Un caso hostil con **un solo actor** no distingue el token de una constante

El patrón más reutilizable que dejó esta ronda, y está **medido en los dos sentidos**. Los mutantes que
reemplazan la identidad por el literal `"cid-A"` sobreviven **exactamente** donde el test ejecutable usa
un único token, y mueren **exactamente** donde hay dos actores:

| | sobreviven (un actor) | mueren (dos actores) |
|---|---|---|
| rutas | `DELETE /composio/connection` · `DELETE /mp/connection` · `GET /feedback` | `/catalog` · `GET /composio/connect` · `GET /mp/connect` · `POST /feedback` |
| killer | — | `test_catalog_route.py:159` · `test_connect_endpoints.py:206` y `:156` · `test_feedback_routes.py:135` |

Y el caso que lo vuelve ítem: el test de `apps/copiloto/tests/test_connect_endpoints.py:393` **se llama**
*«borra filtrando por el `cliente_id` del token»* y no puede distinguir el token de una constante —
compara el SQL **por subcadena** (`:405`). La regla dura del repo dice *control de autorización sin
test adversarial = control no verificado*; esto la afina un grado: **un test hostil con un solo actor
caza el IDOR por id y no caza la sustitución de la fuente de identidad.** Son dos controles, no uno.

##### 🔬 La costura backend→core de `/catalog` no tiene instrumento: todos la mockean

`listarCatalogo` está mockeado en **todos** sus consumidores — cinco de mobile, tres de web y uno de
core por `spyOn` (`packages/core/src/chat/requiereConexion.test.ts:68`). El único que lo ejercita de
verdad es `packages/core/src/api/catalogo.test.ts:66-139`, con **un solo fixture** que trae
`connected:true` y ningún `status`, y **un solo** test de error, el 404. Por eso los dos mutantes de la
costura sobreviven: que `/catalog` deje de pasar `composio_caidos` (`apps/copiloto/web.py:1201`) y que
el core deje de derivar el `estado` del `status` (`packages/core/src/api/catalogo.ts:157`).

Y el único test que parecía cubrirla no la cubre: el de paridad de contrato
(`apps/copiloto-web/src/lib/api/catalog.contrato.paridad.test.ts:46-52`) compara **una sola clave**,
`services`, contra `apps/copiloto/catalog_contrato.py:12-14` **leído como texto**. No mira las claves
por servicio ni la respuesta real. Es la clase *un control a nivel archivo no ve la divergencia
adentro*, y es la razón por la que CAP-01 y CAP-06 caen por el mismo eslabón.

##### 🔬 El recibo verde prueba que se aprovisionó Postgres, no que los tests de Postgres corrieran

Esto cierra con precisión lo que §N.1.bis dejó planteado, y en la dirección buena: **los tests PG no son
decorativos.** `scripts/gate.sh:203-222` aprovisiona Postgres y GoTrue efímeros y, si no levantan, marca
el job backend como `failed` —fail-closed—; `deploy/copiloto/sync-test-backend.sh:53-54` vuelve esa URL
el `DATABASE_URL` que el `skipif` exige; y `.github/workflows/tests.yml:62-70` corre con el rol
**no-superusuario** `copiloto_app` y `UC_RLS_FORCE=1`, con el comentario de `:63-67` explicando que un
superusuario *«confirmaría en vez de verificar»*. El mecanismo está bien pensado.

Lo que falta es la **cuenta**: `scripts/ci/backend.sh:33` corre `pytest … -q` **sin contar los skips**.
Un recibo verde acredita que el aprovisionamiento ocurrió, no que cada test PG se haya ejecutado — y en
el ciclo de desarrollo quedan opt-in, con una advertencia
(`deploy/copiloto/sync-test-backend.sh:12-17`, `:120-129`). La línea base que midió el lote da la escala:
**1824 passed, 386 skipped**, 6 rojos y 3 errores de colección, todos preexistentes y ajenos a L09.
**386 salteados es la masa que el recibo no distingue de 386 verdes.**

##### La clase Q: una plantilla de ataque que el repo ya sabe escribir, aplicada a **una** ruta

Seis sobrevivientes `Q01…Q05, Q07` de una sola forma hipotética: inyectar
`request.query_params.get("cliente_id") or cliente_id` en las seis rutas del lote. Ninguna la viola hoy
—el código declara *«nunca del query»* (`apps/copiloto/web.py:983`, `:1281-1283`)— y ningún test manda
identidad por querystring a esas rutas. Lo que vale es que **la plantilla existe en el repo**: hay un
test hostil así, sobre una sola ruta (`apps/copiloto/tests/test_mi_dia_web.py:279`, `/mi-dia/calendario`)
más un filtro legítimo de admin (`apps/copiloto/tests/test_admin_auditoria.py:206`). Y dos docstrings
**prometen** cazarlo (`apps/copiloto/tests/test_adversarial_multitenant.py:494-498` y `:664-670`,
*«otra fuente»*, *«query param»*) cuando lo que cubren es el **reemplazo** de la fuente del token, no el
**override con fallback**. No es un defecto: es una promesa más ancha que su test, y una plantilla
barata de propagar.

##### Refuerzo de §5.9: la poda **se explicó a sí misma** en el otro archivo

El 🔥 de §5.9 —las cards prometen lo que la poda se llevó— tiene un detalle que lo agrava y que
verifiqué: la poda **dejó su propio comentario, en el lugar correcto**
(`apps/copiloto/services/gmail.py:65-66`: *«Poda del hito 2: `gmail_fetch` se fue — leer correos se
quitó por la auditoría de Google»*, con `TOOLS = {"gmail_send": "send"}` en `:68`). Lo que no se barrió
está treinta líneas más allá, en otro archivo, y es lo que **ve el usuario**: `apps/copiloto/catalog.py:38-39`
sigue publicando `description` *«Enviá y buscá mails desde el chat»* y `capabilities`
`["Leer mails", "Enviar mails", "Buscar"]`. No es que nadie supiera: está escrito. Está escrito **del
lado que nadie lee**.

##### La auditoría de los 20 controles negativos, que es lo que había que pedir y nadie había hecho entero

L09 volvió a correr sus **20** controles con alcance ampliado —`git grep` sobre el árbol del SHA, sin
`docs/`, sin `*.md`, sin `coordinacion/`— y los clasificó en tres baldes honestos: **prueban la
ausencia** (9: la fija un conjunto cerrado, un test, o un instrumento independiente) · **sólo prueban
que mi búsqueda ve** (10: la ausencia depende del nombre o del vocabulario que busqué) · **no medible
desde el código** (1: el valor vivo de `COPILOTO_ENGINE_MODE`).

Lo mejor de esa auditoría es cómo re-midió dos: en vez de repetir su propio grep, **usó el instrumento
del repo** —el ratchet— para confirmar que `/capacidades` y `/conceptos` están en la deuda. Un control
re-medido con un instrumento independiente es la forma fuerte; el resto, por honestidad, quedó marcado
como *«prueba que mi búsqueda ve»*, incluido el que sostiene que no hay HubSpot vivo (sólo `instagram`
está fijado por un test, `apps/copiloto/tests/test_service_risk_contrato.py:58-61`; HubSpot descansa en
el directorio y en la búsqueda). Y declaró los cuatro que **no** re-midió con alcance nuevo.

##### Trece autocorrecciones, y tres que juegan **contra** el lote

Auditó sus propias **578** citas `archivo:línea` contra el SHA: **0 fallos estructurales**, y de las 118
de las diez capacidades, **una** mal citada —`test_catalog_route.py:109` presentado como *«ruta real con
tenant»* cuando `:109` es `test_catalog_without_token_returns_401` y el de con-token es `:115`
(verificado por mí: las dos cosas son exactas)—. Pero las que cuentan como método son las tres que le
**restan** hallazgos:

- **retiró dos sobrevivientes propios** al darse cuenta de que son equivalentes bajo el gate
  (autocorrección 9), convirtiendo *«falta un test»* en *«falta un instrumento para una segunda capa»*,
  que es un ítem distinto y más chico;
- **retiró su propio control positivo** de CAP-04: el test que había citado como prueba de que un
  endpoint vulnerable se detectaría llama al gateway directo y valida **al espía, no al endpoint**
  (autocorrección 4) — la misma clase que L08 encontró en sí mismo;
- **se corrigió a favor del repo**: `DELETE /composio/connection` sí tiene caso hostil; lo que falla es
  el ratchet que no lo ve (autocorrección 11).

Un lote que retira hallazgos propios en contra de su propio resultado es la señal más fuerte que dio
esta pasada. Y hay una cuarta que vale como advertencia de método: dio un mutante por muerto porque el
test que lo mataba **sólo se pone rojo con la máquina cargada** (autocorrección 8). Lo repitió dos
veces y sobrevivió. Es la clase *un instrumento intermitente fabrica una excusa lista*, cazada por el
propio lote antes de publicar.

#### L01 — facturación AFIP: de **5**, sobreviven **2** (refutación hecha a mano, no por el lote)

El lote de facturación es el más grande del relevamiento (**181** elementos: backend 47, web 39, mobile 23,
core 72) y el único cuya refutación **medí yo**, no el lote. Eso no es rigor extra: es que la espera no se
podía acotar y la refutación salió del camino crítico. El reporte del lote se recuperó de su traza y se usó
como **corroboración independiente**, en el sentido correcto — primero medí, después leí lo que había
concluido.

Los cinco veredictos `EXISTE_Y_COMPLETO` del lote son C04 (cambio de ambiente), C06 (estado de la conexión
ARCA), C07 (vencimiento del certificado), C16 (ingresos — rutas) y C18 (facturar desde un presupuesto).
Los otros quince quedaron `EXISTE_PARCIAL` y C21 (Factura A/B) `NO_EXISTE`, así que no hay nada que
refutar ahí: un parcial ya declara su hueco.

| cap | el lote afirma | la refutación, medida contra el código |
|---|---|---|
| **C04** cambio de ambiente | `EXISTE_Y_COMPLETO` · ruta + store + core `TEST_EJERCITA_PROD` | **EN PIE en los dos ejes.** Los hostiles **a nivel ruta** existen y los leí: `client.post("/afip/ambiente")` con el ambiente no vinculado → 409 (`apps/copiloto/tests/test_afip_ambiente.py:148`) y el toggle entre ambientes vinculados (`:156`), más el store hostil (`apps/copiloto/tests/test_afip_stores_integracion.py:315`). Una nota anterior del propio lote decía *«no hay hostil a nivel ruta»*; **es falsa**, y conviene dejarlo escrito: el borrador se corrigió solo contra el archivo. **Reserva nombrada:** los tres casos usan **un solo actor**, así que no distinguen «toma el tenant del token» de «lo tiene fijo» — la clase que L09 midió en el hallazgo 51 |
| **C06** estado de la conexión ARCA | `EXISTE_Y_COMPLETO` · `TEST_EJERCITA_PROD` | **CAE — y no cae el código del handler, cae lo que el campo SIGNIFICA.** `puede_facturar` es `bool(creds) and bool(perfil)` (`apps/copiloto/afip_web.py:635`): dos presencias. La **condición IVA** la pide el alta, la valida y la persiste (`apps/copiloto/afip_web.py:92`, `:195`, `:222`), y `GET /afip/estado` **no la devuelve** (el dict completo está en `:628-642`) ni la mira. Con C21 `NO_EXISTE` —el motor sólo emite Factura C, `NotImplementedError` en `apps/copiloto/afip_rules.py:302-306`— y con las dos UIs ofreciendo Responsable Inscripto, la cadena cierra: el emprendedor se declara RI, el backend lo guarda, Ajustes lee **`puede_facturar: true`**, y el motor le levanta `NotImplementedError` al emitir. El handler hace exactamente lo que su test dice; el test no puede ver el defecto porque el defecto **no está en el handler, está en el predicado** |
| **C07** vencimiento del certificado | `EXISTE_Y_COMPLETO` · *«`TEST_EJERCITA_PROD` para la función; SQL del store y detector sin test que los ejecute»* | **CAE el eje evidencia — y lo dice su propia nota de veredicto.** `_store(filas)` construye `AfipCredentialStore(lambda: _Conn(filas), …)` (`apps/copiloto/tests/test_certificado_por_vencer.py:138-139`): un **cursor falso** que devuelve las filas tal cual. Lo que el test ejercita es el **decodificado** del PEM (ilegible / días); el **SQL nunca lo corre Postgres**. Y lo no ejercitado es justo el contrato: el filtro por `activo` que el docstring declara como *«el único con el que se factura»* (`apps/copiloto/afip_credential_store.py:161-164`). Un veredicto `EXISTE_Y_COMPLETO` cuya propia celda de evidencia dice «sin test que los ejecute» **no es completo**: es `EXISTE_PARCIAL` con la reserva ya escrita y no leída |
| **C16** ingresos (rutas) | `EXISTE_Y_COMPLETO` · `TEST_EJERCITA_PROD` | **CAE a parcial en el eje evidencia, por una costura entre dos lotes.** Las rutas se ejercitan con dobles; el **aislamiento** vive en los tests contra Postgres, y ésos abren con `pytestmark = pytest.mark.skipif(not DATABASE_URL, …)` (`apps/copiloto/tests/test_contabilidad_integracion.py:30`). El recibo del gate corre `pytest -q` **sin contar salteados** (`scripts/ci/backend.sh:33`, hallazgo 49 de L09): un recibo verde **no puede distinguir** «los hostiles corrieron» de «los hostiles se saltearon». Encima `conn_de_tenant` pasa a la vez por el `WHERE cliente_id` de la app y por la policy RLS (`apps/copiloto/conftest.py:78-100`), así que **cuando corre, el verde no atribuye** cuál de las dos barreras frenó la fuga. Dos lotes independientes llegaron a la misma pieza desde lados opuestos |
| **C18** facturar desde un presupuesto | `EXISTE_Y_COMPLETO` · `TEST_EJERCITA_PROD` | **EN PIE en los dos ejes — y la refutación se dio vuelta a mitad de camino.** El docstring de `presupuesto_store.py:114-116` promete que un cambio de formato en `web._wf_id_factura` *«rompe acá, ruidosamente»*, y nombra a `test_presupuesto_facturado.py` como el guard. **Ese archivo no existe** (sus únicas apariciones son el propio docstring y este documento). La conclusión fácil era «la paridad no está vigilada»; **es falsa**: el test existe con **otro nombre** y hace exactamente lo prometido — `assert workflow_id_de_factura("cid-A","abc123") == web_module._wf_id_factura("cid-A","abc123")` (`apps/copiloto/tests/test_presupuesto_derivados.py:31`), más la concatenación del SQL (`:39`) y la del `TrabajoStore` (`apps/copiloto/tests/test_trabajo_store.py:49-50`). Lo que cae no es el control: es **la cita** |

**Pregunta de mutación, por capacidad.** *Si quito X, ¿qué test se pone rojo?*

- **C04** — cambio el literal del ambiente: rojo en `test_afip_ambiente.py:148,156`. Reemplazo el `cliente_id` del token por `"cid-A"` fijo: **sobrevive** (un actor no lo ve). Mutante **no equivalente** — la ruta es per-tenant y el fallo sería real.
- **C06** — agrego la condición IVA a `puede_facturar`: **ningún test se pone rojo**, porque ninguno afirma el predicado; los tests afirman las dos presencias. El mutante que *arregla* el defecto es indistinguible del código actual para la suite. Es el caso límite: **no hay test que pueda caerse, porque la propiedad no está escrita en ninguna parte.**
- **C07** — borro el `WHERE activo` del SQL: **nada se pone rojo**, y acá el mutante **no** es equivalente bajo el gate (a diferencia de los cuatro de L09): con un `prod` inactivo y vencido en la base, el aviso saldría y el docstring dice en su propio texto que un aviso que grita en el caso normal se termina ignorando. El mutante es observable **en producción** y mudo en la suite.
- **C16** — borro un `WHERE cliente_id` de una ruta de ingresos: rojo **sólo si `DATABASE_URL` está puesta**. Mismo mutante, dos resultados, según una variable de entorno que el recibo no registra.
- **C18** — cambio el formato en `web._wf_id_factura`: rojo en `test_presupuesto_derivados.py:31`. Cambio `workflow_id_de_factura`: rojo en `:31`, `:41` y `test_trabajo_store.py:50`. **Tres tests, tres capas.** La paridad está genuinamente vigilada.

**Auditoría de mis propios controles positivos.** El control que usé para «el archivo no existe» fue un `grep`
del nombre en todo el árbol, con control positivo sobre un nombre que sí existe. Eso prueba *«no hay un archivo
con ese nombre»* — y **no** prueba *«no hay un test que haga eso»*, que es la pregunta que importaba. Las dos
mitades no son la misma, y por un momento tomé la primera por la segunda: la segunda se contesta buscando el
**efecto** (`_wf_id_factura` citado desde un test), no el nombre. Es exactamente la asimetría que el índice ya
lleva como clase, cazada acá sobre mi propia medición.

##### L01-b · tres hallazgos del lote que el índice no tenía

De los 24 hallazgos del reporte recuperado, **21 ya estaban** en el índice o en §5.1 desde la primera ronda
(medido por firma: `nota_credito`, `cbte_asoc_nro`, `purgar_secretos_vencidos`, `listar_comprobantes`,
Responsable Inscripto, `usuario`, `fecha_min`, `rechazo_afip`, `InvalidOperation`, …). **Tres no**, y los tres
son de consecuencia alta. Los verifiqué contra el archivo antes de darles fila.

1. **La nota de crédito se emite por el camino sin número reservado** — el mayor del relevamiento. La factura
   **reserva** el número antes de emitir (`apps/copiloto/afip_factura_workflow.py:287-297`) y su comentario
   explica el porqué: sin reserva, si AFIP autoriza y la respuesta se pierde, el reintento pregunta por el
   número siguiente, *«no existe»*, y **emite otro** (`:277-282`). `AnulacionWorkflow` llama a
   `emitir_comprobante` con cinco argumentos, **sin reserva**
   (`apps/copiloto/afip_anulacion_workflow.py:116-120`), así que la activity cae en `ultimo_comprobante + 1`
   (`apps/copiloto/afip_factura_activities.py:146-147`) — el camino que un test **llama «la doble emisión» y
   deja verde a propósito** (`apps/copiloto/tests/test_afip_doble_emision.py:102-115`). Y el remate: el test de
   la activity con una NC le pasa `nro_reservado=7`
   (`apps/copiloto/tests/test_afip_anulacion_workflow.py:245`), **un argumento que el workflow de anulación
   nunca envía** — el instrumento prueba una configuración que producción no usa. La protección **ya existe en
   el otro call-site**: no hay que diseñarla, hay que propagarla.
2. **«Lo facturado» se calcula con cuatro predicados distintos**, y una quinta consulta (lo impago) cuenta el
   mismo conjunto de filas con un sexto criterio: `total_periodo` excluye `'anulada'`, no filtra CAE y **resta**
   las NC (`apps/copiloto/afip_comprobante_store.py:186-190`) · inteligencia pide
   `estado <> 'anulada' AND cae IS NOT NULL` y las NC **suman en positivo**
   (`apps/copiloto/inteligencia_queries.py:118-126`) · `ClienteStore.resumen_operaciones` filtra por CAE **sin**
   estado y las NC restan (`apps/copiloto/cliente_store.py:579-586`) · la web filtra `estado === 'emitida'`
   sobre la **primera página** (`apps/copiloto-web/src/modules/facturacion/ResumenFacturacion.tsx:72,82-83`) ·
   y `CobroStore.impagos` incluye las filas de NC como deuda **sin traer el tipo**
   (`apps/copiloto/cobro_store.py:125-139`, `:144-149`), consumido por cuatro superficies
   (`apps/copiloto/afip_web.py:379`, `apps/copiloto/inteligencia_queries.py:181`,
   `apps/copiloto/mi_dia_detector.py:308`, `apps/copiloto/tool_catalog.py:1189`). Para una factura anulada con
   su NC por el total en el mismo mes, **el mismo período da números distintos en cuatro pantallas**, y la
   anulada puede aparecer como plata por cobrar.
3. **Dos caminos HTTP autenticados dentro del core, y el motivo del segundo ya no describe al primero.**
   `enviarAutenticado` (`packages/core/src/api/afip.ts:504-510`) lee el token y llama `http.enviar` directo,
   saltándose la renovación del bearer (`packages/core/src/api/client.ts:68,166`), la traducción del corte por
   tiempo a `ApiError` 408 (`:146-153,176`) y el **refresh ante 401** (`:182-189`). Lo usan sólo `guardarPerfil`
   (`afip.ts:570`) y `conectarArca` (`:614`); las otras **17** llamadas del módulo van por `apiClient`. Su
   docstring se justifica porque `mapearError` no preservaría `detail` cuando viene como array
   (`afip.ts:499-503`) — y `errors.ts:5-20` dice que eso **ya se arregló**, que bajar a `http.enviar` crudo
   costó el refresh-on-401 y que se expuso `body` *«para que nadie más pague ese precio»*. Cita además a
   `actualizarCliente` como precedente: `packages/core/src/api/client.ts:219` dice que **ya no existe**. Una exención viva sostenida
   por una autoridad derogada.

### N.3 · Cuánto queda en pie, hasta acá

| lote | `EXISTE_Y_COMPLETO` declarados | sobreviven la refutación |
|---|---|---|
| L11 transversal | 9 (no 7) | **3** |
| L04 mi-día/BI | 5 | **2** (ambos salvados midiendo, no por el lote) |
| L10 agenda/admin/DLQ/grafo | 14 | 13 — **AD-1 cae**, y 5 con reserva nombrada |
| L06 soporte/inteligencia | 25 | **7 firmes** · 15 con reserva · **3 retirados** |
| L05 cáscara/design-system | 10 | **3 en pie** · 7 caen por prueba de **mutación** |
| L03 auth/legal | 16 | **9 en pie** · 7 caen — 2 de ellos (C13, C17) **sólo en el eje aislamiento** |
| L02 chat/HITL/voz | 8 | **1** (C20) — y al refutar localizó el **mecanismo** del defecto de §5.2 |
| L07 ingresos/presupuestos/MP | 9 (CAP-05, 08, 16, 19, 22-25, 27) | **1** (CAP-27, y con `REQUIERE_DEVICE`) — el eje **código** cae en 2, el de **evidencia** en 7. Y separó los dos ejes como criterio |
| L08 gastos/clientes | 4 (G1, C5, A1, N1w) | **1** (C5-a) — G1 y A1 caen · C5 se **parte en 4** · N1w conserva código y pierde evidencia |
| L09 conexiones/apps/ajustes | 10 (CAP-01, 03-07, 11, 12, 15, 17) | **2** (CAP-07 · CAP-11, y éste `[LEÍDO]`) — caen **4** y **4** quedan con reserva nombrada, y las cuatro caídas son **de evidencia, ninguna de código**. **113** experimentos de mutación (81 muertos, 32 sobrevivientes), de los cuales **4 son equivalentes bajo el gate**: el lote distinguió «no hay test» de «no hay diferencia observable» y con eso **retiró dos hallazgos propios** |
| L01 facturación-AFIP | 5 (C04, C06, C07, C16, C18) | **2** (C04 · C18) — **refutación hecha a mano, no por el lote**, y corrige a este mismo documento: la pasada anterior decía «las 5 se sostuvieron» y la medición profunda tira **tres**. C06 cae por el **significado** de `puede_facturar`, no por su handler; C07 y C16 caen **sólo en evidencia** (cursor falso · hostiles gateados por `DATABASE_URL`). C18 se dio vuelta a mitad de camino: el guard que el código cita por un nombre inexistente **existe con otro nombre**. Más **3** hallazgos que el índice no tenía, rescatados de la traza del lote (§N.2/L01-b) |

**Lectura para la planificación, y es el punto de todo esto:** la mortandad no se reparte al azar.
Cae lo que se probó **una capa adentro** del lugar donde el usuario lo usa — la función pura sin su
cableado, el cliente sin su transporte, el guard sin su composition root, el mobile sin su teléfono.
Ninguno de esos tests está mal escrito; todos prueban algo real. Lo que ninguno prueba es **la
costura con la capa de al lado**, que es donde este repo ya pagó cuatro incidentes el mismo día.

## §N+1 · Lo que este relevamiento NO cubre (declarado, no omitido)

- **Nada de `apps/mobile/` queda verificado como funcional.** Todo sale `REQUIERE_DEVICE`: leyendo
  código se responde «existe», nunca «anda».
- **Ningún test se corrió.** Los veredictos de evidencia dicen si **hay** un test que ejercita el
  camino de producción, no si pasa hoy. Los tests corren en el VPS, no en la PC.
- **25% de las llamadas front↔backend no tiene veredicto de forma** (§4.1): cobertura del
  instrumento, declarada.
- **El inventario no ve rutas definidas por constante** (§4.1.bis). Hoy hay una y es un canario;
  la ceguera queda escrita porque no da síntoma.
- **Las familias 1-3 de comentarios obsoletos no están barridas** (§4.6): exigen juicio semántico, y
  quedan declaradas como no barridas en vez de barridas mal. Los ~14 miembros conocidos salieron de
  lectura, no de un barrido, así que **no son una lista cerrada**.
- **25 citas `archivo:línea` quedaron sin resolver** por nombre ambiguo (§4.6), entre ellas al menos
  un defecto confirmado. El 11 de ese barrido es un piso. **Pero ya no hace falta inventar el
  mecanismo:** §4.7 separó «basename ambiguo» de «cita irresoluble» —si la línea citada existe en
  un solo candidato, la cita se resuelve sola— y eso llevó los ambiguos irresolubles de **este**
  documento de 31 a **0**, midiendo además que ninguno tapaba un roto. Extenderlo al barrido del
  código es un ítem barato con el instrumento ya escrito y con control positivo.
- **No se midió qué citas apuntan a una línea que existe pero dice otra cosa** — que es el defecto
  real de la familia 4. Sólo se midieron las que apuntan a línea vacía.

#### Lo que estaba acá y ya NO: preguntas que el relevamiento cerró

Se dejan anotadas en vez de borradas, para que nadie las vuelva a abrir como si siguieran abiertas:

- ~~*«Qué provee el gate y qué no es una medición pendiente»*~~ → **cerrada en §N.1.bis**: GitHub
  Actions pasa 3 variables, el gate del VPS 5, y **ninguno pasa `OPENAI_API_KEY` ni
  `GRAPHITY_CODE_API_KEY`** ⇒ 8 tests no corren en ningún gate automático.
- ~~*«La clase de comentarios obsoletos: ¿caso único o clase?»*~~ → **cerrada**: clase, con ~14
  miembros en tres lotes independientes y cuatro familias distinguidas (§4.6). Mi primera respuesta
  («un solo miembro») era un falso negativo del método, no una medición.

#### Una cosa que este relevamiento NO puede decidir, y el backlog sí

Un hallazgo de este documento tiene **dos estados independientes**: el del código
(`EXISTE_Y_COMPLETO` / `EXISTE_PARCIAL` / `NO_EXISTE`) y el de la evidencia (`TEST_EJERCITA_PROD` /
`TEST_NO_TOCA_PROD` / `SIN_TEST` / `REQUIERE_DEVICE`). Mantenerlos separados fue lo que permitió ver
la mayor parte de lo que este documento encontró: casi todos los hallazgos caros son **código
correcto con evidencia que mira al costado**, o **evidencia verde sobre código que nadie puede
alcanzar**. Un solo estado los habría colapsado y escondido.

La pregunta abierta es si un id del backlog hereda los dos estados o si se parten en dos ids. **No la
contesta este relevamiento** — es decisión de planificación. Pero el dato está:
**115 `EXISTE_Y_COMPLETO`** declarados por los **once** lotes (9+14+5+25+10+16+8+4+9+10+5 —
contados, no estimados), de los cuales **115 pasaron la refutación** (9+5+14+25+16+8+10+4+9+10+5 — **los once lotes, completo**).
**60 quedan en pie** en el eje código (3+2+13+7+9+1+3+1+7+10+4 — L09 aporta los diez enteros: **ningún veredicto de código se movió**, sus cuatro caídas son todas de evidencia, y su único matiz funcional, CAP-01b, ya es la fila 11 del índice), con la mayoría retirada o en
reserva. El caso que mejor muestra por qué el eje importa es N1w de L08: el código queda `EXISTE_Y_COMPLETO` y la evidencia cae a `SIN_TEST` en el mismo movimiento. Y lo que decide la forma del backlog: **ningún retiro fue por código
ausente.** Todos fueron por evidencia que no toca producción. Un backlog con un solo estado por id no
puede expresar eso: colapsaría «funciona y no lo probamos» con «no existe», que son trabajos
distintos, de costo distinto y de dueño distinto.

*(Nota sobre esta cifra: la escribí primero como «90» sin sumarla. Es la segunda cifra inventada que
este documento tuvo que corregir — la primera fue el «7» de §5.11. Las dos veces el número tenía la
misma apariencia que los medidos, y las dos veces lo cazó una suma de treinta segundos. Para el
backlog: toda cifra agregada de este documento debe venir con los sumandos a la vista, como esta.)*

## §N+2 · De 51 filas a 10 frentes: el mapa causa→síntoma

Esta sección es el puente al backlog, y es lo único del documento que **no** sale de un lote: sale de
cruzar las 51 filas entre sí. La pregunta que contesta no es *«qué está roto»* —eso es §I— sino
**«cuántas decisiones distintas hay acá»**. Son muchas menos que 51, y eso cambia la planificación.

**Aritmética, con los sumandos a la vista:** **10 grupos cubren 37 filas**; **14 quedan solas**. Dos
filas están en **dos** grupos a la vez y se declaran donde aparecen (la 29 en G1 y G8; la 39 en G3 y es
adyacente a G6). Las filas se nombran por su número de §I, así que todo esto es verificable contra la
tabla sin volver a leer el documento.

**Y el hallazgo de forma, que es el punto:** los grupos **se separan por tipo de costo**, no por
módulo. Sumando a la vista, y con la distinción que importa:

- **10 filas de instrumento, que no pueden romper producción** — G3 (3) + G4 (3) + G5 (4). Un solo
  oficio, un solo dueño, riesgo nulo para el runtime.
- **4 filas de evidencia cuyo resultado es desconocido** — G6. Escribir el test hostil es la tarea;
  **qué encuentre es otra cosa**, y por eso no se puede presupuestar junto con las de arriba.
- **8 filas de cableado** de capacidad ya escrita y ya probada — G8 (una de ellas, la 29, cuenta además
  como código de producto en G1).
- **4 filas de propagación**, donde el arreglo **ya existe** y hay que moverlo, no diseñarlo — G7.

Son **26 de las 51** que no son «escribir la feature». Sin este cruce, las 51 entran al backlog como si
lo fueran — y las de instrumento se postergan por parecer caras, que es exactamente al revés.

### G1 · El campo cruza la costura y el receptor lo descarta — filas 3, 9, 20, 29

Cuatro filas, una sola forma: **un cliente manda un campo, el modelo del receptor no lo declara, y nada
falla**. El `hitlMessageId` que el puente de mobile tira (3) · el `origen:'voz'` del ingreso dictado
(9) · la clave de idempotencia del alta de clientes (20) · el `mode` del «Modo por app», que la web
manda en **cada** POST contra un `ChatIn` de tres campos (29). En los cuatro casos el silencio es el
mecanismo: pydantic descarta, TypeScript no puede avisar, y el test de cada lado pasa.

**Esto es UN barrido mecánico, no cuatro investigaciones.** Por cada modelo de request: el conjunto de
claves que los llamadores mandan contra el conjunto que el modelo declara. Lo que sobra es un campo
fantasma. Es barato, es automatizable, y es la clase que este repo ya tiene escrita como *la costura
leía un campo que nadie escribe*.

⚠️ **El barrido los encuentra; cada arreglo se dimensiona aparte.** La fila 9 lo dice con número: darle
origen propio al ingreso dictado **rompe tres cosas más** (el borrado filtra `origen = 'manual'`, más
`completitud_dictada` y `completar_ingreso`). Encontrar es uno; arreglar son cuatro tickets.

### G2 · Un default de columna que produce un número contradictorio — filas 13 → 14

**Ordenadas, porque una es la causa de la otra.** Ninguna fila vale nunca `nota_credito` (13), y de ahí
salen los dos síntomas: las dos UIs ofrecen «Anular» sobre una nota de crédito, y «lo facturado» da
**−X y +X para el mismo mes** (14).

Pero **14 no se cierra sola con 13**: aun escribiendo el estado, la segunda definición filtra por
`estado <> 'anulada'`, no por tipo de comprobante. Son **dos ítems, en este orden**: escribir el estado
primero —que además apaga el botón— y después decidir el predicado del total. Invertir el orden deja el
botón vivo.

🔜 **Lo único de este mapa que falta:** el colapso **interno** de §5.1 (sus 24 hallazgos a sus causas
reales) está pedido al lote y entra acá cuando llegue. Puede agregar filas a G2 y a G7; no puede
sacarlas.

### G3 · El cableado que nadie prueba — filas 39, 40, 48

Tres filas 📐, una forma: **cada pieza tiene test y la capa que las junta no**. Ningún test une handler
real + store real + `require_tenant` real (39) · el adaptador HTTP de la web no tiene test (40) · la
raíz de composición de la web tiene un solo importador y ningún test la importa, y borrar la llamada
deja verde la suite entera (48). Lo refuerza, sin fila propia, el montaje del `ThemeProvider` de
§N.2/L05, que falla distinto en cada plataforma.

**Un ítem por app: un test de composition root.** Ninguna de las tres filas es un defecto de producto
—el código probablemente anda— y ninguna se puede afirmar. Es la clase *verificar la composición root,
no el default*, y es la que explica por qué la refutación mató lo que mató: cae lo que se probó **una
capa adentro** del lugar donde se usa.

### G4 · La contabilidad del gate cuenta lo escrito, no lo ejecutado — filas 34, 47, 49

El mismo defecto en los **tres** instrumentos que llevan la cuenta. Diez tests que ningún gate ejecuta
nunca, y el verde los incluye (34) · el ratchet acredita cobertura por **AST**, así que un test de
Postgres salteado cuenta igual (47) · el recibo corre `pytest -q` **sin contar los skips**, con 386
salteados en la línea base (49).

**Una decisión, tres parches chicos:** que los tres cuenten **ejecuciones** y declaren los salteos. Es
el ítem con la mejor relación valor/costo de todo el backlog, porque es el que decide si **cualquier
otro** ítem se puede dar por cerrado. Mientras un verde no distinga «corrió» de «se salteó», todo
cierre de este backlog es una afirmación.

### G5 · El control cuya premisa venció, y nadie lo notó — filas 32, 33, 35, 38

Cuatro filas 🔬 con la misma biografía: **el control nació correcto, el mundo se movió, y el control
siguió verde**. El positivo que quedó verde por vacío (32) · tres exenciones de contraste que citan una
deuda ya pagada (33) · el control negativo que se desarmó cuando su tool se puso viva —y el guard que
su comentario cita como respaldo **no existe** (35) · un registro que cita un archivo de test
inexistente, más once comentarios contradichos por el código (38).

**Un ítem de forma, no de contenido:** todo control y toda exención declaran la premisa que los
sostiene, y **fallan cuando la premisa vence**. Hoy el vencimiento no tiene síntoma — que es la razón
por la que las cuatro llegaron hasta este relevamiento.

### G6 · El control de aislamiento declarado y no ejercitado hostilmente — filas 31, 43, 46, 51

La regla dura del repo —*control de autorización sin test adversarial = control no verificado*— tiene
**cuatro** incumplimientos medidos, y cada uno falla de una forma distinta: el test insignia mide una
función **gemela** que el guard no usa (31) · falta el hostil de «A anula lo de B», con el ratchet
creyéndolo cubierto (43) · la segunda capa que el código llama «la barrera efectiva» no la mide nadie,
y el instrumento que existe para medirla excluye la tabla (46) · y el hostil con **un solo actor** no
distingue el token de una constante (51). Adyacente: la fila 39, que es su versión sin ningún actor.

**El material concreto ya está hecho**, y eso baja el costo del ítem: las pruebas de mutación de
§N.2/L07 y §N.2/L09 dejaron **la lista nombrada** de los mutantes que nadie caza, con archivo y línea.
El ítem es escribir los hostiles de esa lista, no descubrirla.

### G7 · El arreglo ya existe y no viajó — filas 2, 15, 44, 45

**Trabajo de propagación, no de diseño**, y es el grupo más barato por fila con consecuencia 🔥. El
historial del chat web sin acotar por tenant, con el fix ya escrito **tres veces al lado** (2) · el fix
contra la doble emisión aplicado a la factura y **no** a la nota de crédito (15) · tres
implementaciones de `dos_decimales` que divergen, y la que importan siete módulos es la que no tiene
test (44) · dos archivos byte a byte idénticos en web y mobile con tests de un solo lado (45).

**Para el backlog, esto cambia cómo se escribe el ticket:** no *«implementar X»* sino *«propagar el X
de `<archivo:línea>` a los otros N call-sites»*, con los N contados. La clase está en la memoria del
repo —*el fix ya existe en otro call-site: propagar, no diseñar*— y acá tiene cuatro instancias.

### G8 · Capacidad completa sin disparador — filas 17, 24, 25, 26, 27, 28, 30 (+29)

Las ocho 🕳️, que son el grupo más grande y el más fácil de malinterpretar: **el código está escrito y
probado; lo que falta es la puerta**. La clasificación automática de feedback sin disparador (24) · el
modo de ceremonia configurable que ningún código ramifica (25) · la cartera que «se arma sola» y la
corre un script a mano (26) · `consultar_cliente` podada del catálogo pero viva, único camino al
historial que la ficha muestra vacío (27) · imputación y margen cableadas sin consumidor de front (28)
· dos activities registradas sin disparador (30) · el botón de pronunciación sin alimentador (17) · y
la pantalla del «Modo por app» que **no tiene puerta** en `TABS` (29, también en G1).

**Es trabajo de cableado y hay que presupuestarlo como tal.** Dos trampas: (a) un 🕳️ *no* se cierra
escribiendo la feature —ya está—, y (b) algunos **no hay que cablear, hay que retirar**: la decisión
«conectar o borrar» es por fila y es del operador, no técnica. Lo que no se puede es dejarlos: cada uno
es trabajo pagado que no rinde, y la 27 además deja una ficha mintiendo con listas vacías fijas.

### G9 · El defecto y su instrumento ciego, en la misma fila — filas 5, 6

El par más instructivo del documento. Mobile pinta tres hexes que web retiró y **dos quedan bajo AA**
(5); y los contrastes de mobile se calcularon contra los fondos **de web**, en las dos pieles, bajo un
comentario que afirma haberlos medido contra el fondo real de cada piel (6). **Primero se arregla el
instrumento**: con la medición apuntada al fondo equivocado, cualquier fix de color se valida contra la
referencia ajena y el verde no significa nada.

### G10 · El catálogo de apps publica un inventario que el código no respalda — filas 11, 12, 36, 50

Una sola superficie, cuatro filas, un dueño. Las cards prometen lo que la poda se llevó —Gmail anuncia
«buscá mails» con una sola tool viva (11) · una app **caída** se suma en «disponibles» porque viaja con
`connected=false` (12) · el contrato de riesgo cuenta a Drive como servicio con tool viva mientras el
módulo declara `TOOLS` vacío (36) · y la costura backend→core que decide todo esto **no tiene
instrumento**: `listarCatalogo` está mockeado en los nueve consumidores y el test de paridad compara
una sola clave leída como texto (50).

**El orden importa acá también:** 50 primero. Sin instrumento de la costura, 11, 12 y 36 se arreglan a
ciegas y vuelven — es la misma lección que G9, en otra superficie.

### Las 14 que quedan solas

Filas **1, 4, 7, 8, 10, 16, 18, 19, 21, 22, 23, 37, 41, 42**. Cada una es su propio ítem, y **eso es un
resultado, no un pendiente**: significa que el relevamiento no les encontró parentesco, no que falte
mirarlas. Tres merecen nota:

- **La 1 ya viene colapsada:** §5.4 vio el síntoma (el cobro contado dos veces en «Entró»), §5.7
  encontró la causa, y tiene **un solo sitio de fix**. Es el modelo de lo que este mapa busca.
- **La 18 es la de mayor consecuencia de negocio** y no tiene parentesco técnico con ninguna: la
  aceptación legal no condiciona nada y **los dos logins que funcionan la saltean**.
- **La 22** —el webhook que afirma «SIEMPRE 200» y responde 500 sin DLQ— es la única cuyo daño lo
  decide un **tercero**: ese código define si MercadoPago reintenta o abandona.

### Lo que este mapa NO decide

**El orden entre grupos.** Hay un orden **interno** forzado en tres de ellos (13 antes que 14 · 50
antes que 11/12/36 · 6 antes que 5), y eso es técnico, así que está escrito. Pero el orden **entre** G4
y G7, o entre G8 y lo demás, es una decisión de negocio: G4 vuelve creíble todo cierre posterior, G7 es
lo más barato con consecuencia 🔥, G8 es lo más grande y lo menos urgente, y G2/G1 tocan plata y
cumplimiento fiscal. Ese llamado es del operador. Lo que este relevamiento aporta es que **ya no hay
que elegir entre 51 cosas sueltas, sino entre 10 frentes con dueño, costo y orden interno declarados.**
