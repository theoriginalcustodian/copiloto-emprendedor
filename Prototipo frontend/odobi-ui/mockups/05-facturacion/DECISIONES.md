# DECISIONES — 05 · Facturación por voz (doble HITL)

Creado 28/07/2026. El guión §5 del handoff («Odobi, facturale $80.000 a Rodríguez») hecho pantalla. Hereda el patrón madre del 04 cambiando **solo las filas de detalle** — es la demostración de que el HITL es un componente, no una pantalla. Feature IMPLEMENTADA (emisión real con CAE; confirmado por Martin 22/07 y repo 25/07) — **sin disclaimer de fechas**. La advertencia "es visión, no demo" del handoff §5 quedó obsoleta (desactualización ya señalada a Martin).

## El doble HITL

1. **HITL de datos (lane 1):** Odobi no inventa tipo de factura ni CUIT — lo que falta se pregunta ("me faltan dos cosas") y lo asumido se muestra antes de usarse (el CUIT del registro).
2. **HITL de emisión (lane 2):** la tarjeta "Queda así" con el botón "Emitir factura" — el único gatillo. Es el gate `ESPERANDO_CONFIRMACION` de la máquina real de estados del repo (`afip_rules.py`: BORRADOR → … → ESPERANDO_CONFIRMACION → EMITIENDO → EMITIDA → ENTREGADA, + RECHAZADA/CANCELADA). **Quién decide qué se emite es código, no un modelo.**

## Timeline (continuidad narrativa)

Jueves 24, 10:12–10:14 — entre la promo del miércoles 22 (04) y el viernes 25 del chat/Mi día (03/09). Rodríguez SRL, Factura C, $80.000, CUIT 20-28456789-3 (guión §5), Nº 0003-00000127, CAE 75282963517824. Cifras orientativas de mockup.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Facturar vive en el chat | El flujo entero pasa por el thread (Chat activa); no hay "pantalla de facturación" con formulario | El posicionamiento ES hablarle como a un socio: "facturale $80.000 a Rodríguez" es una frase, no un form. La app de Facturación en Apps queda como historial/listado, no como flujo de creación | Formulario clásico de factura — convierte el diferencial del producto en un Colppy más; el guión §5 existe justamente para esto |
| Invocación por voz visible | "Odobi, facturale $80.000 a Rodríguez." como burbuja de usuario + meta "por voz" | El nombre es el comando (handoff: invocación, 20+ impresiones/día). La voz entra al historial como texto: un solo hilo auditable, paridad de canales | Flujo de voz aparte tipo asistente (overlay que desaparece) — lo dicho se evaporaría; el chat es el registro |
| Lo que falta se pregunta junto | «Dale. Para la factura me faltan dos cosas: ¿es factura C? ¿y el CUIT…?» — un turno, dos preguntas | Guión §5 LITERAL. Junta lo faltante en un turno: ni interrogatorio de a uno ni asumir en silencio | Wizard de N pasos — lento y de formulario; asumir tipo/CUIT sin mostrar — viola HITL justo en el dominio fiscal, donde el error cuesta plata |
| CUIT del registro, mostrado antes de usarse | "¿uso el del registro que tengo (20-28456789-3)?" | El repo tiene registro de clientes (`cliente_store`); el dato asumido se exhibe para verificación (Nielsen #5). Ningún dato fiscal entra a ARCA sin haberse visto | Autocompletar en silencio — fe ciega con un dato que va a un comprobante legal |
| Tarjeta HITL heredada del 04 | Misma anatomía [1] encabezado+chip · [2] filas · [3] alcance · [4] decisión. Cambian las filas: Cliente / Importe / Concepto | Un componente, tres features (promo, factura, presupuesto) — argumento de sistema para el deck. Editar una fila abre el mismo sheet del 04 | Tarjeta ad-hoc de factura — segunda anatomía para el mismo trabajo; inconsistencia que David notaría |
| Chip "ARCA" | El organismo real como canal del write, texto en chip crema (igual que "Gmail" en el 04) | El chip declara por dónde sale la acción (IF Catalogue: transparencia). ARCA es el nombre vigente del organismo | Logo de AFIP/ARCA — marca ajena en la UI; "AFIP" — nombre viejo |
| Irreversibilidad fiscal frontal | "Se emite en ARCA a tu nombre. Una factura emitida no se borra: si está mal, se anula con una nota de crédito." | Voz §5: mala noticia frontal y con salida — y la salida es REAL: el repo tiene workflow de anulación con nota de crédito (`afip_anulacion_workflow.py`). Ni promesa falsa de undo ni letra chica | "No se puede deshacer" a secas — miente por omisión (sí hay camino: NC); ocultarlo — dark pattern |
| Botón "Emitir factura" | Fill `#DE7250` suave + label display 20 Bold blanco (3.17:1 = AA texto grande ✅), Cancelar igual tamaño debajo | Regla 28/07 v2 (Martin, decidida sobre este mockup): nunca negro s/terracota; el label sube a display 20 Bold para entrar por la vía "texto grande" (misma que "Cortar" en la escucha). Es el gate `ESPERANDO_CONFIRMACION`: el mockup dibuja un estado que existe en el código | Fill `#B04A2E` + Inter 16 blanco (regla 28/07 v1) — funcionaba (5.43:1) pero Martin prefirió la terracota de marca en el momento de decisión; "Confirmar" genérico — el verbo importa: emitir es el acto fiscal |
| Confirmación por voz equivalente | "Emitila." dicho = el botón (lane 3) | Guión §5 ([confirma]) + paridad de canales en el gesto central, igual que el 04 | Solo botón — degrada el canal identitario |
| Comprobante con Nº + CAE + vencimiento | Receipt: ícono success + "Factura C emitida", "Nº 0003-00000127 · $80.000 · Rodríguez SRL", "CAE 75282963517824 · vence 03/08", link "PDF" | La emisión fue real (EMITIENDO → EMITIDA): el CAE es la prueba. El chat como historial auditable (IF Catalogue) | Toast "Factura emitida ✓" — un comprobante fiscal no puede evaporarse |
| Ícono success = SVG de Martin, animado (28/07) | Su `Success.svg`: círculo blanco con borde + check, 32px. Color ajustado `#DE7250`→`#B04A2E` (check s/blanco 5.43:1 ✅ · borde s/crema 4.91:1 ✅). Check interior achicado 15% a pedido de Martin 28/07 (polyline escalada al 85% sobre el centro, dasharray 30→26). Motion del Lottie replicado en CSS puro: círculo pop (320ms) + check que se dibuja (dash-offset 400ms, delay 260ms) al entrar en pantalla (IntersectionObserver), una vez, reduced-motion ok. Ref: `assets/motion/Success.{svg,json}` | Dibujo aportado por Martin, se usa tal cual con el único ajuste legal (el `#DE7250` original da 2.86:1 s/blanco, falla 1.4.11). **Excepción a Decisión B decidida por Martin 28/07** (como la taza del 09) | Círculo negro + check blanco (primera versión) — cumplía B pero no era el ícono pedido; player Lottie — dependencia de runtime; loop del JSON — el estado "emitida" no es un spinner |
| Copy del cierre | "Emitida. Acá está el PDF — ¿lo guardo, lo mando por mail o lo compartís vos?" | Guión §5 LITERAL: buena noticia en seco + siguiente paso propuesto, nunca ejecutado solo | "¡Factura emitida con éxito! 🎉" — doble violación §5 |
| Chips de siguiente acción | "Guardalo en Drive" / "Mandalo por mail" — outline, texto `#B04A2E`, ≥48pt | Atajos de conversación con servicios REALES del catálogo (Drive, Gmail). Tocar uno arma OTRA tarjeta HITL: mandar el PDF es otro write con su propia puerta | Botones que ejecutan directo — un write sin puerta rompería el principio en la misma pantalla que lo demuestra; ofrecer WhatsApp — no existe en el catálogo |
| Sin disclaimer de feature | Ninguna marca de "próximamente" | Facturación está DENTRO del repo (emisión real, tool `emitir_factura`). El handoff §5 dice "EN PAUSA": obsoleto, señalado a Martin | Disclaimer por las dudas — vendería como visión algo que ya funciona: autogol |
| Anotación | Estándar uxsnaps (26/07) | Decisión Martin 26/07 | Columnas laterales — formato viejo |

## Revisión 30/07

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Monograma de la firma (3 apariciones) | Al **glifo real de la O con las ondas afuera** (rev. 29/07) | Un solo signo en todas las escalas — ver `09-mi-dia/DECISIONES.md` | Círculo dibujado: identidad divergente entre pantallas |
| Label de la fila "Cliente" | `Cambiar` → **`Cambiá`** | Deriva del componente: la misma fila decía "Editá" en el 04 (dueño del patrón) y "Cambiar" acá. Las acciones de fila van en voseo imperativo — Odobi te invita a intervenir sobre su propuesta. Se conserva el verbo distinto de "Editá" porque la acción es distinta: no editás "Rodríguez SRL", elegís otro cliente. Taxonomía y registros en `04-confirmacion-hitl/DECISIONES.md` | Unificar todo en "Editá": pierde una distinción real; dejar "Cambiar": el mismo componente nombrado de dos formas en cuatro pantallas |

**Auditado y sin cambios:** 3 tabs · "Odobi" con caja correcta · `.btn-confirm` con display 20 Bold blanco s/terracota (regla 28/07 v2) · 13 íconos Iconoir · anotación uxsnaps con flechas curvas · 4 tamaños de tipo (28/20/16/13) · cero léxico prohibido · terracota como texto sólo en el wordmark (exento, WCAG 1.4.3).

**Falsa alarma revisada:** la burbuja del lane 1 hace **dos preguntas en un turno** («¿es factura C? ¿y el CUIT…?»), lo que parecía chocar con "pedido ambiguo → pregunta UNA sola cosa". No choca: esa regla es para pedidos **ambiguos**, y acá el pedido es claro pero **incompleto**. El guión §5 lo trae literal y la alternativa —interrogatorio de a una pregunta por turno— es peor. Queda como está.

## Ratios usados (todos ya calculados, python3)

Blanco s/`#DE7250` 3.17:1 ✅ AA texto grande (Emitir, display 20 Bold — regla 28/07 v2) · `#B04A2E` s/blanco 5.43:1 ✅ (Cambiá/Editá/PDF/chips/tab activa) · `#1A1512` s/crema 16.37:1 ✅ (burbujas, receipt) · crema s/negro 16.37:1 ✅ (msg-user) · `#5C534C` s/blanco 7.51:1 ✅ (metas, labels, ✓✓) · `#5C534C` s/crema 6.79:1 ✅ (t2 del receipt) · `#B04A2E` s/blanco 5.43:1 ✅ (check del ícono success) · borde s/crema 4.91:1 ✅ · blanco s/`#DE7250` 3.17:1 ✅ solo ícono mic (1.4.11).

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ lane 1 ≈2% (mic + tab), lane 2 ≈7% (pantalla de decisión, máximo legítimo), lane 3 ≈3% (chips + links).
2. WCAG AA calculado → ✅ pares listados.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos UI → ✅.
4. Voseo, sin léxico prohibido, guiones §5 literales → ✅ ("Dale", "facturale", "Emitila", "Mandalo").
5. Cero orbes/glow/glassmorphism → ✅.
6. Caja "Odobi" correcta → ✅.
7. Grilla 8pt, CTAs thumb zone, targets ≥44pt → ✅ (filas, botones, chips ≥48pt).
8. Decisiones con fundamento citable → ✅ esta tabla.

---

## Revisión 16/08 — se retira la tabbar, y el composer gana contexto

Facturación es una **función**, y el modelo de capas dice que dentro de una función el composer lleva su contexto: **"Estás en Facturación"** sobre el input. No es cosmético — es la promesa de dónde cae lo que digas, que es justo lo que hace posible facturar por voz sin salir de acá (ver `mockups/11-voz-contextual`).

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
