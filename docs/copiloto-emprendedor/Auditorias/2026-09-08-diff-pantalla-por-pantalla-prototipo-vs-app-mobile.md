# Diff pantalla-por-pantalla: prototipo Odobi ↔ app mobile

**De:** backend · **2026-09-08**
**Medido contra:** worktree `C:/gfw-src/wt-a16`, `main` @ `44781105`.
**Documento hermano (web):** `2026-09-08-diff-pantalla-por-pantalla-prototipo-vs-app.md` — misma
estructura, mismos 4 veredictos, para poder leerse en paralelo.

Lectura pura — sin cambios de código. Compara los 14 mockups de `Prototipo frontend/odobi-ui/mockups/`
contra `apps/mobile/src/modules/**`, `apps/mobile/app/*.tsx` (rutas Expo Router) y
`apps/mobile/src/shell/**`. Ejecutado con 4 lotes de lectura headless en paralelo (`claude -p`,
`--allowedTools Read,Grep,Glob`), consolidados y con una verificación puntual de líneas citadas antes
de publicar.

## Tabla de cobertura

| Mockup | Veredicto | Evidencia (`path:línea`) | Qué falta / qué difiere |
|---|---|---|---|
| `00-mapa` | ⚪ N/A | `DECISIONES.md:3` — "No es una pantalla de la app: es el plano." | Meta-diagrama de navegación del propio prototipo, no una pantalla de producto. ⚠️ **DIVERGE DE WEB**: el mapa propone el "modelo de capas" como alternativa a tabs — en mobile ya está implementado y en producción (`PanelDeslizable.tsx:1-21`, dos capas con gesto Pan real), mientras que web sigue con tabs planos. El plano describe el estado real de mobile con más fidelidad que el de web. |
| `01-onboarding` | 🔴 AUSENTE | `PantallaLogin.tsx:102-261` (único punto de entrada no autenticado) | No existe onboarding conversacional: ni reveal animado del wordmark, ni la conversación que pide Mercado Pago + Google, ni el primer insight financiero real como mensaje de chat. `PantallaLogin.tsx` es un formulario plano de email/password + botón de Google, sin ningún string del guión (`147.000`, `Laburo así`, `o-DO-bi`). El login con Google usa selector nativo de cuenta, más cercano al espíritu "dos minutos" que la versión web, pero sigue siendo formulario, no conversación. |
| `02-conexiones` | 🟡 PARCIAL | `PantallaApps.tsx:199-353` (`vincular`, `confirmarBaja`, `loQueSePierde`) — verificado: `loQueSePierde` en `:68`, `confirmarBaja` en `:180` | Existe el listado con estado real por servicio y acción "Desconectar" con confirmación que nombra la consecuencia. Falta: agrupamiento por permiso (2 consents Google/MP vs. lista plana de 6+ servicios técnicos), sheet de consentimiento just-in-time disparado desde el chat, tarjeta de conexión caída en Mi día. ⚠️ **DIVERGE DE WEB**: mobile SÍ implementa "Desconectar" con aviso de consecuencia real (`loQueSePierde`, `PantallaApps.tsx:68-93`); la auditoría web marcó esa acción como ausente. |
| `03-home-conversacional` | 🟡 PARCIAL | `ChatView.tsx:86-238` · `BotonVoz.tsx:71-314` · `ListaMensajes.tsx:60-105` | El armazón (lista + composer + gate HITL Confirmar/Cancelar) está. El gesto de voz de la revisión 24/08 (mantener/soltar/deslizar-cancela/bloquear) está implementado literal y **sin tapar pantalla**. Falta: chip de contexto "↩ Desde tu aviso" (sin resultado en grep), dividers de fecha, "✓✓ recibido". El gate de confirmación es de solo lectura, sin filas editables. ⚠️ **DIVERGE DE WEB**: mobile ya implementa el gesto sin scrim de la revisión vigente; la auditoría web encontró un `RecordingOverlay` con scrim full-screen que contradice esa misma decisión — mobile está más alineado al mockup en este punto. |
| `04-confirmacion-hitl` | 🟡 PARCIAL | `TarjetaPropuestaShell.tsx:41-65` (cáscara común) · `TarjetaGastoPropuesto.tsx`/`TarjetaIngresoPropuesto.tsx`/`TarjetaPresupuestoPropuesto.tsx` · `ListaMensajes.tsx:128-159` | Sin chip de canal/servicio ni bloque explícito de alcance/irreversibilidad en texto frontal. El detalle editable existe pero como formulario completo inline, no como filas "Editá"/"Cambiá" que abren un bottom sheet. El comprobante es una línea de texto (`TarjetaPropuestaTerminal`), sin check animado ni colapso con motion. ⚠️ **DIVERGE DE WEB**: mobile edita inline con el formulario nativo en vez de abrir un sheet aparte — ni calca el mockup ni replica el patrón web (`HitlCard.tsx`), es un tercer enfoque. |
| `05-facturacion` | 🟡 PARCIAL | `TarjetaFacturaPropuesta.tsx:42-150` · `PantallaFacturacion.tsx` (wizard, sólo si faltan datos) · `maquinaEstado.ts` | El flujo conversacional existe como card propia en el chat; deriva al wizard sólo si `faltantes.length > 0` — mejor cobertura que web, que siempre iba al wizard. Sin chip "ARCA"/canal ni aviso de irreversibilidad fiscal frontal. El comprobante tras emitir es sólo "Factura emitida." — no muestra CAE/número/vencimiento pese a que `maquinaEstado.ts` ya tiene esos datos. Sin chips de siguiente acción. ⚠️ **DIVERGE DE WEB**: mobile resuelve "preguntar en el mismo turno" evitando el defecto que marcó la auditoría web ("deriva al wizard en vez de preguntar en el chat") — mejor en este punto puntual, aunque ambas comparten el gap del comprobante sin CAE. |
| `06-presupuestos` | ✅ CUBIERTO | `TarjetaPresupuestoPropuesto.tsx:32-75` — copy verbatim igual al mockup y a la card web | Card en el chat con formulario precargado, ítems editables, botón "Guardar" → comprobante con N° de presupuesto. Una sola puerta (sin doble HITL), como pide el mockup. Sin verificar en este pase: chip "Docs" y chips "Mandalo por mail"/"Armá la factura" tras guardar — no aparecieron en el grep de `chat/`, posible gap menor no confirmado como AUSENTE. |
| `08-plan-limites` | 🟡 PARCIAL | `PantallaAjustes.tsx:64` (tile "Mi plan", verificado — 7 tiles totales en `TILES_AJUSTES`) · `PantallaAndamiaje.tsx:19-20` ("si no sabés qué va, poné un vacío explícito") | No hay medidor de acciones/mes, barra de consumo, ni aviso de límite en el chat — el backend sigue sin exponer plan/consumo (no verificado el backend en este turno, sólo el frontend). ⚠️ **DIVERGE DE WEB**: mobile tiene "Mi plan" cableado en la navegación con placeholder honesto (vacío explícito, sin dato inventado); web muestra una fila estática "Plan: Profesional" con comentario `// TODO backend`. Mobile es más honesto sobre el gap, pero sigue sin la feature. |
| `09-mi-dia` | 🟡 PARCIAL | `PantallaMiDia.tsx:75-80,122-257` (3 solapas, `ReanimatedSwipeable`, tap-para-expandir) · `PantallaMiDia.tsx:265-309` (`PanelCalendario`, sólo lectura) | Falta la portada numérica (Entró/Salió/Te queda/Por cobrar) que el mockup exige como apertura — mobile abre directo en el kanban. El vínculo tablero↔chat con chip de contexto no está: tocar una tarjeta expande in-place, no abre el chat. Estado vacío es texto llano, sin la ilustración de calma. ⚠️ **DIVERGE DE WEB**: ninguna de las dos apps junta portada+tablero como pide el mockup, pero mobile cubre la mitad "tablero" con más profundidad funcional (swipe con acciones fijas). |
| `10-arranque` | 🟡 PARCIAL | `PanelDeslizable.tsx:1-21,141-367` (verificado, archivo de 381 líneas) · `EscritorioFunciones.tsx:64-127` (verificado, archivo de 413 líneas) | El mecanismo de capas y "sin tabbar" que pide el mockup están construidos — a diferencia de web (🔴 AUSENTE allá). Diverge en contenido: 9 funciones con scroll horizontal, no las 6 en grilla 3×2 sin scroll de la rev. 20/08; Contabilidad no está unificada con Inteligencia; Ajustes es tile al final del grid, no movido al avatar; sin rodillo de ejemplos en el composer vacío. ⚠️ **DIVERGE DE WEB**: el mecanismo central del mockup (capas con gestos, sin tabbar) sólo existe en mobile — web usa tabs planos. |
| `11-voz-contextual` | 🔴 AUSENTE | `BotonVoz.tsx` (usado sólo en `chat/`, sin import en `gastos/`, `presupuestos/`, `clientes/`, `facturacion/`) · `PantallaGastos.tsx:1-227` (sin `BotonVoz` ni `useVozComando`, sólo alta manual por formulario) | El mecanismo central del mockup —dictar DENTRO de una función, sin abrir el chat— no existe: la voz vive únicamente en el chat. El gesto WhatsApp en sí (mantener/soltar/deslizar/bloquear, umbral 80px) SÍ coincide con la revisión 24/08, pero acotado al chat. ⚠️ **DIVERGE DE WEB**: web al menos tiene el mismo gesto dentro del chat (con el mismo problema de scrim); mobile no tiene ni el scrim ni el contexto de función — un paso atrás en alcance funcional aunque el gesto de bajo nivel esté mejor resuelto. |
| `12-funciones` | 🔴 AUSENTE | `PantallaGastos.tsx:130-221` (usa `MarcoGlass`+`ScrollFormulario`+`FilaBotones`, sin bloque negro) · `PantallaContabilidad.tsx:1-60` (pantalla separada de Inteligencia) | La anatomía exacta del mockup (card blanca + bloque negro con cifra accionable + rótulo con alta a la derecha + lista con chip de estado) no existe: la arquitectura visual de mobile es **glass** (`MarcoGlass`, blur/relieve), no la gramática Monzo de 4 bloques. El "—" en vez de "$0" se respeta. ⚠️ **DIVERGE DE WEB** — el hallazgo más fuerte de este documento: web adoptó la gramática Monzo (bloque negro) vía Tarea 3; mobile nunca migró y sigue en su propio sistema glass — son dos lenguajes visuales distintos para el mismo producto, y donde web dio ✅ CUBIERTO, mobile da 🔴 AUSENTE. Contabilidad sigue separada de Inteligencia en mobile, ni el mockup (unificación 20/08) ni web lo tienen así. |
| `13-ajustes` | 🟡 PARCIAL | `PantallaAjustes.tsx:52-82` (7 tiles, orden verificado) · `PantallaAndamiaje.tsx:17-43` (placeholder honesto "Mi plan") · `PantallaAfipSetup.tsx:531-553` (CUIT bloqueado con botón "Cambiar" igual que web) | Orden y cobertura de las 7 opciones coincide con el mockup; "Mi plan" es placeholder explícito igual que en web. Falta la Gramática B (título display suelto sin bloque de color) — mobile usa la misma gramática glass de tiles para todo, sin diferenciar operación de configuración. Bug de CUIT "bloqueado, sin acción" mostrando botón "Cambiar" es idéntico al de web. No se verificó si "Cómo hablarle" resuelve el duplicado con Perfil de negocio (no leído en este pase). |
| `14-mi-dia-3v` | 🟡 PARCIAL | `PantallaMiDia.tsx:73-310` (tablero + `PanelCalendario` sólo lectura) · `PantallaInteligencia.tsx:81-98` (portada de números, pantalla separada) | El tablero tiene equivalente pleno y con más funcionalidad que el mockup (swipe con acciones fijas). Los números existen pero en pantalla separada, igual que en web. La agenda existe (`PanelCalendario`) pero es de sólo lectura sin ninguna interacción, ni siquiera lista con acciones — no hay grilla horaria por bloques. ⚠️ **DIVERGE DE WEB**: mobile explicita por contrato (CAL1 §3) que el calendario es deliberadamente pasivo ("sin swipe, sin acciones") — una limitación intencional y documentada, no una carencia accidental como en web. |

## Cierre

- **Cubiertas:** 1 (`06-presupuestos`)
- **Parciales:** 9 (`02`, `03`, `04`, `05`, `08`, `09`, `10`, `13`, `14`)
- **Ausentes:** 3 (`01-onboarding`, `11-voz-contextual`, `12-funciones`)
- **N/A:** 1 (`00-mapa`)

## Comparado con el diff hermano de web (2 cubiertas / 8 parciales / 3 ausentes / 1 N/A)

Mobile tiene **1 cubierta menos** que web, no más — el modelo de capas (`10-arranque`) que web no
tiene lo compensa parcialmente (AUSENTE→PARCIAL), pero dos veredictos empeoran respecto a web:

- **`12-funciones` regresa de ✅ CUBIERTO (web) a 🔴 AUSENTE (mobile)** — es el hallazgo más fuerte de
  este documento. Web migró a la gramática visual Monzo (bloque negro) vía la Tarea 3 citada en su
  propio diff; mobile nunca la adoptó y sigue en su sistema glass original. No es un problema de
  cobertura de features — es que las dos plataformas del mismo producto usan dos lenguajes visuales
  distintos para la misma pantalla, algo que ningún test de contraste ni de snapshot detecta porque
  cada plataforma es internamente consistente consigo misma.
- **`11-voz-contextual` regresa de 🟡 PARCIAL (web) a 🔴 AUSENTE (mobile)** — mobile no tiene el
  scrim que le costó puntos a web, pero tampoco tiene el composer-con-mic dentro de las pantallas de
  función que web sí intenta (aunque tapado); es un caso de "menos implementado en general", no una
  mejora encubierta.

Mejoras reales de mobile sobre web, no estilísticas: `02-conexiones` (acción "Desconectar" con aviso
de consecuencia, ausente en web), `05-facturacion` (pregunta datos faltantes en el mismo turno en vez
de derivar siempre al wizard), `03-home-conversacional` y `11-voz-contextual`-el-gesto (sin scrim,
alineado a la revisión 24/08 vigente).

Ningún gap fue implementado ni repintado — este documento es sólo el inventario. Qué se construye (y
en qué orden, y si se unifica la gramática visual entre plataformas) queda como decisión del
operador.

— backend
