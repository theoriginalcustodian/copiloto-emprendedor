# DECISIONES — 00 · Mapa de la app (esquema UX + navegación)

Origen: crítica integral 26/07 (3 critical · 7 major · 4 minor) + pedido de Martin: "necesito visualizar el esquema de la app, desde su UX hasta el prototipado (la navegación entre funciones y pantallas)". Este artefacto es el esqueleto que ordena el rediseño mockup por mockup. No es una pantalla de la app: es el plano.

| Elemento | Decisión | Fundamento | Alternativa descartada y por qué |
|---|---|---|---|
| Existencia del mapa | Dibujar el esqueleto ANTES de rediseñar pantallas | Las 3 decisiones estructurales (tabs, semántica de color, puente) condicionan a TODOS los mockups; decidirlas pantalla por pantalla produce inconsistencias como las que la crítica encontró (wordmark del 04, lane tranquilo del 09) | Ir directo al 03 — repetiría el error de origen: cada mockup decidió su pedazo de estructura por su cuenta |
| Canvas 1: el ciclo como fila superior | Onboarding → Mi día → Chat → HITL → Queda anotado, con la flecha de retorno (anotado→Mi día) en terracota y más gruesa | El diagnóstico del reporte 25/07: el ciclo existe en backend y es invisible. En el mapa, la flecha 5 es la protagonista porque es la que la UI hoy no cuenta. Jerarquía visual = jerarquía del argumento | Mapa radial con el chat al centro — repite el modelo mental viejo ("la voz es el producto"); la voz es puerta, el ciclo es el producto |
| "Queda anotado" como nodo | El evento_store aparece en el mapa aunque no sea pantalla | Es el objeto central del sistema (el "libro" que Biyuya sí muestra). Si no está en el plano, ninguna pantalla lo va a contar | Solo pantallas en el mapa — esconde justamente lo que el rediseño tiene que hacer visible |
| Escucha como superficie global | Nodo aparte, conectado al chat, con nota "el mic vive en todos los tabs" | Regla de componente 22/07 (input+mic = unidad) + Wilensky (invocación = impresión de marca). En el esquema queda explícito que NO pertenece a un tab | Escucha como hijo del chat — dibujaría la voz como feature del chat, cuando es un canal de toda la app |
| Apps derivan (flecha punteada) | Apps → Chat en punteado: "muestran y explican; para ejecutar, derivan" | Regla real del producto: una sola puerta de escritura (HITL en chat). El punteado distingue navegación secundaria de flujo principal | Apps con ejecución propia — duplicaría el patrón de confirmación; ya descartado en 09 |
| Conexiones con borde punteado | Nodo marcado "¿tab o sheet?" — alimenta la Decisión A | Honestidad del artefacto: el mapa muestra lo decidido en sólido y lo abierto en punteado | Dibujarlo resuelto — decidiría por Martin algo que él pidió decidir mirando |
| Decisión A dibujada (5 vs 4 vs 3 tabs) | Tres tab bars 390px reales apiladas. C (idea Martin 26/07): 3 tabs (Mi día/Chat/Apps) + Cuenta en el avatar del header, Conexiones adentro de Cuenta. Recomendación: C con 3 salvaguardas | Frecuencia de uso: Conexiones se usa fuerte una vez (setup); Cuenta, poco. El avatar-arriba-derecha es patrón aprendido (Gmail, YouTube — Jakob's Law) y resuelve M7 (avatar sin destino). Salvaguardas contra el "muy oculto": puntito de estado en el avatar + conexión caída = tarjeta en Mi día + just-in-time consent (flujo 7). Nielsen #8: cada tab compite todos los días; 3 tabs de 124pt = nav 100% cotidiana | 5 tabs — Conexiones y Cuenta de baja frecuencia en máxima jerarquía; 4 tabs (punto medio) — mejor, pero Cuenta sigue ocupando un tab que se toca poco |
| Decisión B dibujada (semántica terracota) | Dos portadas reales: delta en terracota (hoy) vs delta en negro (propuesta). Recomendación: terracota = SOLO tocable | Un color con un significado se aprende en un día (consistencia, Nielsen #4). Hoy `#B04A2E` dice "tocá acá" (links, tab activa) y "esto está mal" (−18%, ✓✓): el usuario adivina. Además resuelve el caso delta positivo sin inventar un verde fuera de paleta | Sumar un color semántico (verde/rojo) — rompe la paleta cerrada; terracota para todo — mantiene la ambigüedad detectada (M1) |
| Decisión C dibujada (puente Mi día→Chat) | Secuencia de 3 frames: tap en acción → chat con chip "↩ Desde tu aviso" + HITL armado → back a Mi día con la tarjeta en estado resultado | Resuelve C3 de la crítica: el handoff es EL momento del sistema. El chip de contexto responde "¿dónde estoy y por qué?" (Nielsen #1); el back simétrico responde "¿cómo vuelvo?" (Nielsen #3). La tarjeta que cambia de estado cierra el loop sin que el usuario administre nada | Ejecutar desde la tarjeta (descartado en 09: rompe la puerta única) · abrir el chat sin contexto — el usuario aterriza en una conversación que no pidió y tiene que reconstruir por qué |
| 07-insight muere como pantalla | Propuesta: el puente ES el 07. Un solo patrón para tarjetas, voz y apps: todo desemboca en el chat con chip de contexto | El detector ya es real (repo 25/07) y sus tarjetas viven en Mi día; una pantalla "insight" aparte duplicaría superficie sin trabajo propio (M6/C1 de la crítica) | Mantener 07 como deep-dive de tarjeta — suma un nivel de navegación para contenido que cabe en el chat conversacional |
| Anotación: estándar nuevo | Texto flotante en **monoespaciada** (solo meta-capa — manuscrita hasta el 08/08) + flechas SVG curvas que terminan EN el elemento señalado | Pedido de Martin 26/07 con referencia visual (uxsnaps): el indicador debe apuntar al elemento per se. La fuente de anotación es de la capa de presentación, no de la UI (no viola las 2 familias) | Conectores rectos actuales — no señalan el elemento exacto, solo la zona; cajas con borde — más frías que la referencia elegida |

## Estado de las 3 decisiones — TODAS CERRADAS por Martin 26/07
- **A (tabs): CERRADA — gana C.** 3 tabs (Mi día / Chat / Apps) + Cuenta en el avatar del header, Conexiones adentro de Cuenta. La duda de Martin ("Conexiones puede quedar muy oculto") quedó respondida con las 3 salvaguardas: puntito de estado en el avatar · conexión caída = tarjeta en Mi día · just-in-time consent al ejecutar (flujo 7).
- **B (terracota): CERRADA — solo tocable.** "Si es terracota, pasa algo al tocarlo." Deltas y ✓✓ pasan a negro/sec.
- **C (puente): APROBADA.** Tap en acción → chat con chip "↩ Desde tu aviso" + HITL armado → back a Mi día con la tarjeta en estado resultado.

## Impacto de lo decidido (se aplica al rediseñar cada mockup)
- A=C → tab bars de 03/09 pasan a 3 tabs + header con avatar (badge de estado); 02-conexiones se rediseña como sheet just-in-time + sección dentro de Cuenta; 08-cuenta se accede desde el avatar. Resuelve M3 y M7 de la crítica.
- B → delta del 03/09 y ✓✓ del chat pasan a negro/sec; terracota queda en mic, tab activa, links de acción, botones HITL. Resuelve M1.
- C → **07-insight sale del plan como pantalla**; el chip de contexto se vuelve componente transversal (tarjetas, voz, apps). Resuelve C3 y M6.

## Contrastes usados (calculados, sin cambios)
- Negro `#1A1512` s/crema 16.37:1 ✅ · s/blanco 17.66:1 ✅ · `#B04A2E` s/blanco 5.43:1 ✅ · s/crema 4.91:1 ✅ · Sec `#5C534C` s/crema 6.79:1 ✅

## Autoevaluación (checklist kickoff §4)
1. Terracota ≤10% → ✅ (es un plano: terracota solo en nodo Escucha, flecha del ciclo y elementos señalados).
2. WCAG AA → ✅ pares listados (la meta-capa manuscrita no es UI).
3. 2 familias en UI → ✅ (la monoespaciada de anotación es capa de presentación, no cuenta como familia de UI).
4. Voseo, sin léxico prohibido → ✅ ("tocás", "venís", "elegís vos").
5. Cero orbes/glow → ✅.
6. Caja "Odobi" → ✅ (no aparece el wordmark en el plano).
7. Grilla/targets → n/a (no es UI operativa).
8. Decisiones con fundamento citable → ✅ esta tabla.
