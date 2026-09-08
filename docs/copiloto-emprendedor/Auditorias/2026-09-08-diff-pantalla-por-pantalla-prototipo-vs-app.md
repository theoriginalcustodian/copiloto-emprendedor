# Diff pantalla-por-pantalla: prototipo Odobi ↔ app web

**De:** frontend1 · **2026-09-08** · **Contrato:** `coordinacion/cerrado/2026-09-08/2026-09-08_contrato_planificacion-a-frontend1_diff-pantalla-por-pantalla-prototipo-vs-app.md`
**Medido contra:** worktree `C:/gfw-src/wt-fe1`, `main` @ `7a54a456`.

Lectura pura — sin cambios de código. Compara los 14 mockups de `Prototipo frontend/odobi-ui/mockups/`
contra los 18 módulos de `apps/copiloto-web/src/modules/` (+ `shell/`, `auth/`, `chat/`).

## Tabla de cobertura

| Mockup | Veredicto | Evidencia (`path:línea`) | Qué falta / qué difiere |
|---|---|---|---|
| `00-mapa` | ⚪ N/A | `DECISIONES.md:3` — "No es una pantalla de la app: es el plano." | Es el meta-diagrama de navegación del propio prototipo, no una pantalla de producto. |
| `01-onboarding` | 🔴 AUSENTE | `App.tsx:39-64` · `LoginScreen.tsx:50-150` · `SignupScreen.tsx:73-169` | El flujo de 3 actos (reveal animado del wordmark, conversación que pide Mercado Pago + Google, primer insight financiero real como mensaje de chat) no existe. La app tiene formularios planos de email/password; ningún string del guión (`147.000`, `Laburo así...`) aparece en el código. Sólo coincide el destino final (signup → tab `connections`). |
| `02-conexiones` | 🟡 PARCIAL | `ConnectionsScreen.tsx:38-127` · `ServiceCard.tsx:52-92` · `useConnections.ts:96-109` | Existe el grid de tarjetas conectar/conectado, pero falta: acción "Cortar"/revocar, descripción de alcance por servicio, agrupamiento por permiso (vs. grid plano actual), el sheet de consentimiento just-in-time en el chat, y la tarjeta de conexión caída en Mi día. |
| `03-home-conversacional` | 🟡 PARCIAL | `ChatScreen.tsx:56-88` · `MicButton.tsx:184-225` · `HitlCard.tsx:41-125` · `chat.css:604-618` | La estructura general (mensajes + composer + confirmación HITL + `✓✓ recibido`) está. Falta: chip de contexto "Desde tu aviso", filas editables dentro de la card HITL, dividers de fecha en el historial, cancelar deslizando a la izquierda en el gesto de voz. Además, el `RecordingOverlay` tapa toda la pantalla con un scrim — contradice la decisión vigente del mockup de no tapar nada (ver `11-voz-contextual`). |
| `04-confirmacion-hitl` | 🟡 PARCIAL | `HitlCard.tsx:41-125` · `hitlMapping.ts:71-101` · `Bubble.tsx:53` | Encabezado de acción, alcance/irreversibilidad y decisión (Confirmar/Cancelar) están. Falta el detalle editable (filas "Editá"/"Cambiá" con bottom sheet) y el comprobante colapsado con animación tras confirmar — hoy sólo hay un `✓✓ recibido` inline. |
| `05-facturacion` | 🟡 PARCIAL | `TarjetaFacturaPropuesta.tsx:59-146` · `PasoResumen.tsx:82-183` · `PantallaFacturacion.tsx:404-425` | El wizard de formulario clásico existe, pero es justamente la alternativa que el mockup descarta explícitamente. El flujo conversacional (facturar por voz) existe parcial: falta preguntar datos faltantes en el mismo turno (deriva al wizard en vez de preguntar en el chat), falta el chip "ARCA"/irreversibilidad dentro de la card de chat, y el estado emitido no muestra CAE/número/vencimiento en el hilo (sólo texto plano "Factura emitida."). |
| `06-presupuestos` | ✅ CUBIERTO | `TarjetaPresupuestoPropuesto.tsx:75-95` · `PresupuestosScreen.tsx:166-171` · `DetallePresupuesto.tsx:112-296` | Las 3 lanes (pedido por voz + card editable, lista con estados, aprobar-por-voz → factura sin emitir) están implementadas con copy verbatim igual al mockup. Único detalle periférico sin verificar: el chip "Mandalo por mail" (acción puente a otro flujo). |
| `08-plan-limites` | 🔴 AUSENTE | `AccountScreen.tsx:107-115` (fila estática "Plan: Profesional", comentario propio `// TODO backend`) · `types.ts:48` (`MeResponse` sin campo de plan) | Verificado con grep amplio (`plan`, `suscripcion`, `cuota`, `tope`, `membership`, `billing`, `upgrade`, `limite`) en todo `src/` y en `web.py`: no existe medidor de acciones/mes, barra de consumo, ni upsell. El propio mockup se autodeclara "único mockup de visión" — el backend no expone el dato. |
| `09-mi-dia` | 🟡 PARCIAL | `MidiaScreen.tsx:136-214` vs `InteligenciaScreen.tsx:173-270` | El mockup fusiona portada numérica (Entró/Salió/Por cobrar) + Kanban de avisos en una pantalla; en la app están separados (`inteligencia` vs `midia`). El estado "sin pendientes" existe como texto llano, sin portada ni ilustración. La interacción es Kanban con botones, no el puente "tarjeta → chat con chip de contexto". |
| `10-arranque` | 🔴 AUSENTE | `App.tsx:39-49` · `AppShell.tsx:30,62,110-125,254` · `EscritorioScreen.tsx:48-58` | Este mockup propone una arquitectura de navegación por capas con gestos (sin tabbar), escritorio de 6 tiles con Ajustes movido al avatar, y rodillo de ejemplos en el chat vacío. Nada de eso existe: el shell real usa `TabBar` fija, `EscritorioScreen` tiene 9 tiles planos con Ajustes incluido, sin gestos ni carrusel. Es una propuesta de rediseño aún no adoptada, no un splash. |
| `11-voz-contextual` | 🟡 PARCIAL | `MicButton.tsx:279-288` · `chat.css:604-618` (`.recording-overlay{position:fixed;inset:0}`) | El gesto WhatsApp (mantener/deslizar/soltar) coincide con la revisión vigente del mockup. Pero faltan los dos rasgos que le dan nombre: (1) el mic sólo vive en el chat/soporte, no dentro de las pantallas de función (Gastos no tiene composer/mic); (2) durante la grabación se monta un scrim full-screen (`rgba(3,4,10,.74)`) que tapa toda la pantalla — la decisión vigente del mockup (24/08) es explícitamente no tapar nada. |
| `12-funciones` | ✅ CUBIERTO | `GastosScreen.tsx:90-155` · `PresupuestosScreen.tsx:178-262` · `ResumenFacturacion.tsx:104-126` | La anatomía de 4 bloques (stack nombre+período · bloque negro de cifra · rótulo+alta · lista) está implementada en orden en los 7 módulos que la adoptan, con comentarios que citan la propia Tarea 3. La regla "— nunca $0" se respeta y está documentada donde aplica. |
| `13-ajustes` | 🟡 PARCIAL | `AjustesScreen.tsx:63-69` · `PantallaPerfilNegocio.tsx:304-350` · `PantallaComoHablarle.tsx:46-104` · `PantallaAfipSetup.tsx:370-383` | La Gramática B (sin bloque negro, título suelto) se respeta en todas las sub-pantallas. Pero: el duplicado Tono/Largo/Nombre entre Perfil de negocio y "Cómo hablarle" no se resolvió (siguen siendo cosas distintas, no la fila-resumen que pide el mockup); "Mi plan" es un scaffold placeholder; el CUIT bloqueado muestra un botón "Cambiar" que contradice "bloqueado, sin acción"; elecciones excluyentes usan `<select>` nativo en vez de filas con radio explicativas. |
| `14-mi-dia-3v` | 🟡 PARCIAL | `MidiaScreen.tsx:36-48,218-250` · `InteligenciaScreen.tsx:173-287` | De las 3 vistas (números/agenda/tablero): "números" (`InteligenciaScreen`) y "tablero" (`MidiaScreen`, 3 solapas) tienen equivalente pleno. "Agenda" existe (`PanelCalendario`) pero como lista plana hora+título, sin la grilla horaria con bloques por duración que dibuja el mockup — el propio `DECISIONES.md` marca eso como visión, no como campo modelado hoy. |

## Cierre

- **Cubiertas:** 2 (`06-presupuestos`, `12-funciones`)
- **Parciales:** 8 (`02`, `03`, `04`, `05`, `09`, `11`, `13`, `14`)
- **Ausentes:** 3 (`01-onboarding`, `08-plan-limites`, `10-arranque`)
- **N/A:** 1 (`00-mapa`)

Ningún gap fue implementado ni repintado — este documento es sólo el inventario. Qué se construye
(y en qué orden) queda como decisión del operador.

— frontend1
