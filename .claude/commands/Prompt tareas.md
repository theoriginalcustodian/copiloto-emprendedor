# GAUNTLET — instrucción completa

## 1. TAREA — qué quiero
[Qué es, para quién, y qué se entrega. Concreto.]

Contexto y restricciones de negocio:
- Usuario: [quién lo usa y en qué momento]
- Problema: [qué deja de hacer mal o de no poder hacer]
- Entregable: [archivo, carpeta, URL, dashboard, app]
- Fuentes autorizadas: [carpeta, URLs, documentos]. Si un dato no está ahí, no existe.
- Fuera de alcance: [qué no tocar]
- Stack: [si hay uno fijo; si no, elegí el más simple que cumpla la barra y anotalo]

Piezas obligatorias:
- [pieza 1: qué hace, qué se ve, qué herramienta usar si aplica]
- [pieza 2]
- [pieza 3]

Referencias que el árbitro puede abrir:
- [URL, captura, archivo o métrica concreta]
- Si no hay referencia, buscá una nombrable, abrible y comparable. Explicá en una frase por qué sirve. No inventes el estándar.

## 2. MÉTODO — cómo trabajás
Trabajá de forma autónoma. No pares a preguntarme cada dos pasos. Si algo es ambiguo, decidí, anotalo y seguí. Solo frená si falta una credencial, un permiso destructivo o un dato que no podés inferir sin inventar.

No me entregues la primera versión.

Dividí el trabajo en las piezas más chicas que se puedan mejorar y juzgar por separado. El orquestador no implementa y no se puntúa a sí mismo.

Por cada pieza, loop:
1. Planificá el cambio mínimo que cierra el fallo más grande.
2. Construí.
3. Testeá el artefacto real: abrilo, ejecutalo, renderizalo o reconciliá los números. Un resumen del builder no es evidencia.
4. Revisá diseño y función.
5. Pasá el resultado a un árbitro distinto, con contexto fresco.
6. Corregí solo los fallos que el árbitro nombró, con evidencia.
7. Repetí.

Árbitro adversarial:
- Es otra instancia. No vio el razonamiento del builder ni su autoevaluación.
- Su trabajo es intentar tumbar el trabajo, no validarlo.
- Mira el artefacto, no el informe: píxeles, archivo abierto, tests, sumas, HTML renderizado.
- Comparación ciega cuando haya referencia: las dos versiones sin etiqueta, en orden aleatorio, y elige una. No un puntaje de 10 que sube solo.
- Si gana la referencia, nombra el único fallo más grande, con evidencia (qué se ve, dónde, valor medido vs esperado) y la corrección concreta.
- Prohibido: "mejorá el diseño", "se ve más pro", "está bastante bien".
- Si no hay fallo nuevo ni test rojo, lo dice. No inventa problemas para seguir.

Ratchet:
- Conservá el mejor candidato.
- Reemplazalo solo si el nuevo gana la comparación cabeza a cabeza.
- Una ronda con evidencia mala (captura incompleta, test que no corrió, archivo que no abre) se anula. No cuenta como mejora.

Estado:
- Mantené `progreso.md` actualizado: pieza, ronda, qué cambió, evidencia, veredicto, enfoque que ya falló, siguiente acción, presupuesto restante.
- No reescribas todo en cada vuelta.

Presupuesto (esto corta el loop; "perfecto" no es un criterio de parada):
- Máximo [5] rondas por pieza, o [X] horas, lo que ocurra primero.
- Si la misma falla se repite sin una estrategia distinta, parás y lo reportás.
- No gastes dinero, no despliegues, no borres, no contactes a nadie, no uses secretos.

## 3. BARRA — qué nivel tiene que alcanzar
La barra la usa el árbitro para decir pasa o no pasa. Cada ítem es sí/no. Si uno falla, no está terminado.

Referencia:
- Nivel a alcanzar: [URL, producto o archivo concreto, no "digno de Awwwards"]
- Qué se compara: [jerarquía, copy, números, latencia, fidelidad visual]
- Qué no se copia: [voz, marca, layout exacto]

Checklist binaria:
- [ ] El entregable abre y funciona sin que yo arregle nada.
- [ ] No hay placeholders ("imagen aquí", lorem, TODO, botones muertos).
- [ ] No es un prototipo a medias.
- [ ] Cada dato sale de la fuente. Nada inventado. Si falta, dice "no consta".
- [ ] Los totales cuadran con la fuente (documentos procesados = documentos en carpeta; sumas = líneas).
- [ ] [criterio funcional 1, verificable en 30 segundos]
- [ ] [criterio funcional 2]
- [ ] [criterio visual o de copy, solo si se puede fallar con evidencia]
- [ ] Interacciones que existen cumplen un propósito. Nada decorativo que no se pueda usar.
- [ ] El copy vende o instruye; no describe la interfaz ("este es el botón de…").

Para trabajo visual: captura real al lado de la referencia.
Para datos: tabla de reconciliación.
Para código: tests que corren, no una lista de "debería pasar".
Para texto: cada afirmación importante apunta a la fuente.

## 4. ENTREGA — cuándo está terminado y qué recibo
Restricciones no debatibles:
- No uses placeholders.
- No pares en un prototipo.
- No declares terminado si un ítem de la barra falla.
- No cambies la barra para poder aprobar.
- No expandas el alcance para "mejorarlo".

Formato final:
- [carpeta / HTML que abre en cualquier navegador / xlsx / repo]
- Cómo lo abro: [comando o archivo]
- Qué incluye y qué no

Al terminar, entregá solo esto:
1. El artefacto.
2. Cómo verificarlo en menos de 2 minutos.
3. Tabla: ítem de la barra / evidencia / pasa o falla.
4. Decisiones que tomaste por ambigüedad.
5. Rondas corridas y el fallo que cerró cada una.
6. Lo que no alcanzó la barra y por qué paraste (presupuesto, no "porque quedó bien").

Pase final, una sola vez, con un árbitro nuevo sobre el conjunto: que las piezas funcionen juntas, sin rediseñar. Si ese pase encuentra un fallo de la barra, vuelve al loop de esa pieza. Después parás.
