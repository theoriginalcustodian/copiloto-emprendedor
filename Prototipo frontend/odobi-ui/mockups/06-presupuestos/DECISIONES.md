# DECISIONES — 06 · Presupuestos (una puerta, no dos)

Creado 28/07/2026. No hay guión literal de presupuestos en el handoff (solo facturación tiene §5) — este mockup se construyó sobre el CÓDIGO REAL del repo: `presupuesto_store.py` (estados), `TarjetaPresupuestoPropuesto.tsx` (la card editable, hito 8), `tool_catalog.py` (tool `marcar_presupuesto`), `presupuesto_doc.py` (Doc+Sheet fail-open), `presupuestos_web.py` (POST /{id}/facturar). Copy de Odobi tomado VERBATIM del repo. Feature IMPLEMENTADA — sin disclaimer.

## La tesis: HITL proporcional al riesgo

Tercera feature del patrón madre del 04 — y la que completa el argumento de sistema:

- **05 (fiscal):** dos gates (datos + emisión) + irreversibilidad frontal. El write sale a ARCA a tu nombre.
- **06 (registro propio):** UN gate — la card editable con "Guardar presupuesto". El write queda en TU registro; a Fernández no le llega nada hasta que vos se lo mandes.
- **Cambiar el estado (aprobado/desestimado):** CERO tarjeta — por voz directo, porque es reversible (aprobado→desestimado permitido en el store).

La cantidad de puertas no es estilo: es la máquina de estados del repo. **Quién decide cuántas confirmaciones hacen falta es código, no un modelo.**

## Timeline (continuidad narrativa)

Lunes 20, 09:31 (lanes 1-2 y primera parte del 3) → Viernes 25, 09:04 (cierre del lane 3) — el presupuesto abre la semana que ya contamos: promo miércoles 22 (04), factura jueves 24 (05), chat/Mi día viernes 25 (03/09). Fernández, Presupuesto N° 12, Pintura completa 1×$80.000 + Cambio de luminarias 1×$65.000 = $145.000. Cifras orientativas de mockup.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Los ítems se piden, no se inventan | "Dale. ¿Qué le cotizás? Decime los ítems con su precio." — un turno, una pregunta | HITL de datos igual que el 05: Odobi no inventa precios. Pedido ambiguo → pregunta UNA cosa (regla de discurso) | Que el motor proponga ítems "típicos de reforma" — inventar precios en un documento comercial viola HITL donde el error cuesta plata |
| La card ES el gate (una puerta) | Card editable + "Guardar presupuesto"; sin segunda confirmación | Así funciona el repo: `TarjetaPresupuestoPropuesto` → POST /presupuestos al tocar Guardar. El alcance lo justifica: queda en tu registro, nada sale a terceros ni a organismos | Doble HITL heredado del 05 — sobre-proteger un write interno infantiliza y desgasta el gesto de confirmar para cuando importa (fiscal); fricción sin riesgo que la justifique |
| Copy literal del repo en la card | "Esto entendí. Revisalo, corregí lo que haga falta y tocá Guardar — todavía no lo anoté." | Verbatim de `TarjetaPresupuestoPropuesto.tsx`. "Todavía no lo anoté" es el estado BORRADOR dicho en criollo: el mockup dibuja el copy que ya existe | Redactar copy nuevo "más lindo" — desincronizar mockup y producto en la frase que define el gate |
| Fila Total SIN "Editá" | Cliente/Ítems tienen Cambiá/Editá; Total muestra `$145.000` + caption "suma de ítems" (clase `.calc`) | El store calcula Σ cantidad × precio_unitario e IGNORA cualquier total dictado. Se corrige el ítem, no la suma — la aritmética no se negocia con un LLM | "Editá" también en Total — permitiría un total inconsistente con los ítems, exactamente el bug que el store previene; mostrarlo editable mentiría sobre el código |
| Chip "Docs" | El servicio real del write (se arma el Google Doc del presupuesto) en chip crema, igual que "Gmail" (04) y "ARCA" (05) | El chip declara por dónde sale la acción (IF Catalogue). `presupuesto_doc.py` genera Doc + fila en Sheet | Chip "Drive" — el artefacto es un Doc; sin chip — rompería la anatomía del patrón en su tercera aparición |
| Alcance en positivo | "Queda en tu registro y te armo el Doc. A Fernández no le llega nada hasta que vos se lo mandes." | Simétrico del 05 pero invertido: allá la mala noticia frontal (irreversibilidad), acá la tranquilidad honesta (nada sale solo). El Doc es fail-open: si Google falla, el presupuesto se anota igual | Advertencia de irreversibilidad calcada del 05 — mentiría (esto ES reversible y privado); omitir el alcance — el usuario no sabría si el cliente ya lo vio |
| Botón "Guardar presupuesto" | Fill `#DE7250` + label display 20 Bold blanco (3.17:1 AA texto grande ✅), "Descartar" debajo | Regla 28/07 v2. El verbo es "Guardar" (el de la card real del repo), no "Confirmar": guardar es el acto — anotar en TU registro | "Confirmar" genérico — pierde el verbo; "Enviar" — mentiría: no se envía nada |
| Receipt con N° y estado | "Presupuesto anotado" + "N° 12 · $145.000 · Fernández" + "Pendiente · Doc listo para mandar" + link "Doc" | Copy del repo ("Presupuesto anotado — N° {n}"). El estado PENDIENTE a la vista: el ciclo recién empieza. El chat como historial auditable | Toast efímero — un documento comercial con número no puede evaporarse; ocultar el estado — el usuario no sabría que falta la respuesta del cliente |
| Ícono success heredado | SVG de Martin (04/05): círculo blanco + check `#B04A2E`, check al 85%, motion pop+draw por IntersectionObserver | Un solo signo de "hecho" en toda la app; ya decidido en 05 (excepción a Decisión B de Martin 28/07) | Ícono distinto por feature — diluiría el signo |
| Mandarlo es OTRA puerta | Chip "Mandalo por mail" → arma la tarjeta HITL de Gmail (patrón del 04) | Guardar y mandar son dos writes con riesgos distintos: el segundo sí sale a un tercero, entonces sí tiene gate propio. Es la tesis del mockup aplicada dos veces en la misma pantalla | Botón que manda directo — un write externo sin puerta en el mockup que explica las puertas |
| Aprobado por voz, sin tarjeta | Viernes: "Me aprobaron el de Fernández." → "Marqué el presupuesto N° 12 de Fernández ($145.000) como aprobado. ¿Te armo la factura?" | Tool real `marcar_presupuesto`: cambia el estado directo. Es reversible (aprobado→desestimado existe en el store) → no necesita gate. La confirmación repite número+cliente+monto: verificable de un vistazo. Nota del store: un desestimado NO revive — se hace presupuesto nuevo | Tarjeta HITL para marcar aprobado — el repo no la tiene y el riesgo no la pide; sería dogma, no proporcionalidad |
| Puente al 05 | Chip "Armá la factura" → POST /{id}/facturar: abre BORRADOR con los datos copiados, marca aprobado — **NO emite** | El gate fiscal (`ESPERANDO_CONFIRMACION`) queda intacto: facturar un presupuesto te ahorra tipeo, no te saltea la puerta. Cierra el ciclo presupuesto→factura entre los mockups 06 y 05 | "Facturar" que emite directo — rompería la máquina de estados de `afip_rules.py` y la promesa del 05 |
| Conexión con Mi día (09) | Referida en lane-sub: la regla `presupuestos_enfriandose` del detector vigila los PENDIENTE (tarjeta de Lucía en el 09) | `sin_respuesta` no es un cuarto estado: es PENDIENTE + tiempo (matiz calculado). El sistema completo: anotás acá, Mi día vigila allá | Estado "sin respuesta" dibujado en el receipt — mentiría sobre el store (solo PENDIENTE/APROBADO/DESESTIMADO existen) |
| Sin disclaimer de feature | Ninguna marca de "próximamente" | Presupuestos está DENTRO del repo (store + card + tools + Doc + web) | Disclaimer por las dudas — autogol, igual que en el 05 |
| Anotación | Estándar uxsnaps (26/07) | Decisión Martin 26/07 | Columnas laterales — formato viejo |

## Revisión 31/07

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Monograma de la firma (4 apariciones) | Al **glifo real de la O con las ondas afuera** (rev. 29/07) | Un solo signo en todas las escalas — ver `09-mi-dia/DECISIONES.md` | Círculo dibujado: identidad divergente entre pantallas |
| Label de la fila "Cliente" | `Cambiar` → **`Cambiá`** | Deriva del componente; las acciones de fila van en voseo imperativo. Registros por componente en `04-confirmacion-hitl/DECISIONES.md` | Dejarlo: el mismo componente con dos nombres en cuatro pantallas |

**Auditado y sin cambios:** 3 tabs · "Odobi" con caja correcta · `.btn-confirm` display 20 Bold blanco s/terracota · 13 íconos Iconoir · anotación uxsnaps · 4 tamaños (28/20/16/13) · cero léxico prohibido · terracota como texto sólo en el wordmark.

**Revisado y confirmado como correcto:** el chip dice **"Docs"** (el proveedor real) y no "Archivos" (la etiqueta de job que usa Conexiones). No es inconsistencia: en el HITL lo que importa es declarar **por dónde sale** la acción — misma lógica que "Gmail" en el 04 y "ARCA" en el 05. En Conexiones, en cambio, el nombre del trabajo ayuda a decidir qué conectar. Dos superficies, dos preguntas distintas.

## Ratios usados (todos pares ya calculados — sin combinaciones nuevas)

Blanco s/`#DE7250` 3.17:1 ✅ AA texto grande (Guardar presupuesto, display 20 Bold — regla 28/07 v2) · `#B04A2E` s/blanco 5.43:1 ✅ (Cambiá/Editá/Doc/chips/tab activa/check del ícono) · borde del ícono s/crema 4.91:1 ✅ · `#1A1512` s/crema 16.37:1 ✅ (burbujas, receipt) · crema s/negro 16.37:1 ✅ (msg-user) · `#5C534C` s/blanco 7.51:1 ✅ (metas, labels, `.calc`, ✓✓) · `#5C534C` s/crema 6.79:1 ✅ (t2 del receipt) · blanco s/`#DE7250` 3.17:1 ✅ solo ícono mic (1.4.11).

## Autoevaluación (checklist kickoff §4)

1. Terracota ≤10% → ✅ lane 1 ≈2% (mic + tab), lane 2 ≈7% (pantalla de decisión), lane 3 ≈3% (chips + links).
2. WCAG AA calculado → ✅ pares listados, todos preexistentes.
3. 2 familias / 4 tamaños (28-20-16-13) / 2 pesos UI → ✅.
4. Voseo, sin léxico prohibido, copy del repo verbatim → ✅ ("Dale", "Revisalo", "tocá", "Mandalo", "Armá").
5. Cero orbes/glow/glassmorphism → ✅.
6. Caja "Odobi" correcta → ✅.
7. Grilla 8pt, CTAs thumb zone, targets ≥44pt → ✅ (filas, botones, chips ≥48pt).
8. Decisiones con fundamento citable → ✅ esta tabla (archivos del repo citados por nombre).

---

## Revisión 16/08 — se retira la tabbar, y el composer gana contexto

Igual que en 05: es una **función**, y su composer lleva **"Estás en Presupuestos"**. Ver `mockups/11-voz-contextual` para el fundamento completo.

---

> **Revisión 18/08/2026 — el label del botón pasa de 20 a 19 px.** Donde este documento dice
> «display 20 Bold» sobre terracota, hoy son **19**. Decisión de Martin: a 20 el botón pesaba más que
> el contenido de la propia pantalla. ⚠️ **19 es el piso, no una preferencia:** WCAG cuenta como texto
> grande el bold desde **18,66 px**, y eso es lo único que vuelve legal el 3,17:1 de blanco sobre
> `#DE7250`. A 18 px el botón deja de cumplir sin que se note a ojo. Token: `--fs-btn:19px`.
