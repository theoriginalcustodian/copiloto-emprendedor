# Auditoría · el prototipo como REFERENCIA — 8 de 27 comentarios verificados están contradichos por su propio ejecutable

**De:** AUDITORÍA (`wt-aud-criterio3`) · **2026-09-28**
**Por qué existe:** planificación pidió medir una sospecha concreta — «el proto tiene una capa entera de
comentarios envejecidos y eso cambia cómo se cita como referencia». Tres casos sueltos ya estaban
identificados; faltaba **el denominador**, porque sin él no se distingue «tres casos» de «una capa».
**Sujeto:** `Prototipo frontend/odobi-ui/prototipo/index.html` — 305 719 bytes, 3 899 líneas.

---

## 0. Método y controles

**Extracción con script** (HTML `<!-- -->`, bloque `/* */`, línea `//`), filtro por forma de afirmación
verificable (cantidades, negación de existencia, «siempre/nunca», «se mudó/vuelve», nombres de id o
clase, «único/sólo»), y verificación **individual** de cada candidato priorizado contra el markup, el
CSS o el JS que señala. No se reportan juicios de estilo ni TODOs.

**Control positivo horneado en el encargo:** tres casos conocidos que el método **tenía que
reencontrar**, con la instrucción de abortar si no lo hacía. Los tres dieron ✅. Sin eso, un «0
hallazgos» no se distingue de un método roto.

⚠️ **El path que se le dio al barrido no existía** (`odobi-ui/index.html`; el real está un nivel más
abajo, en `odobi-ui/prototipo/`). Lo detectó el propio barrido antes de medir, eligiendo el único
`index.html` del árbol cuyo tamaño era compatible con las líneas citadas en el encargo, y se confirmó
después contra la corrección: 3 899 líneas, coincidencia exacta. **No hubo medición sobre otro sujeto**
— pero el error fue de quien escribió el encargo, y queda anotado: hay ~28 `index.html` bajo ese árbol.

---

## 1. Denominador

| etapa | cuántos |
|---|---|
| comentarios extraídos | **348** (70 HTML · 266 bloque · 12 línea) |
| con forma de afirmación verificable | **134** |
| **verificados uno por uno contra el código** | **27** |
| → líneas **contradichas** por el ejecutable | **8** (agrupadas en 6 hallazgos) |
| → **consistentes** | **19** |
| candidatos sin abrir | **107** |

⚠️ **Los 27 se eligieron por mayor señal**, así que **8/27 es un techo de la muestra, no la tasa del
archivo.** La lectura honesta: **no son tres casos sueltos, y tampoco es una capa entera** — el proto
acierta en la mayoría de lo que afirma (19 consistentes, incluidos «18 barras» contra
`Array.from({length:18})`, «las cinco claves de CARDS» contra un objeto de 5, «.subp y no .sub», «`#vacio`
vive DENTRO de `#hilo`», y el tambor que usa `transition` en vez de `animation` **a propósito** para
saltear el `*{animation:none!important}` de `:701`).

---

## 2. El patrón, que importa más que la lista

**No es «el comentario envejeció y nadie se dio cuenta».** En 4 de los 6 hallazgos el autor **documentó
el cambio en un comentario NUEVO y dejó el viejo intacto.** Las dos frases coexisten, las dos son
deliberadas, las dos suenan informadas — y **el que cita la referencia se queda con la que encuentra
primero**:

| el viejo afirma | el NUEVO narra el cambio | el ejecutable |
|---|---|---|
| `:796-802` «**SIETE** opciones en grilla… **no se reordena ni se agrupa**: es el mapa que el usuario ya tiene» | `:1505-1511` «Ajustes en FILAS AGRUPADAS (20/08)… la grilla venía del repo, que hablaba de 7 opciones. **Con 10 dejó de servir**» | `:2115-2137`: **10 filas en 3 grupos** con label (`Tu negocio` ×4 · `La app` ×3 · `Ayuda` ×3) |
| `:1073-1117` Inteligencia con **dos solapas (Resumen · Preguntar)**, cuatro gráficos con carga independiente, placeholder «Preguntá sobre tus números…», aviso de alcance propio y respuesta fija «Todavía no tengo datos para responder eso» | `:2151-2153` y `:3602-3604` hablan de «la duplicación que sacamos con **la solapa Preguntar**» — **en pasado** | `.solapas` se define en CSS (`:1081-1084`) y tiene **0 usos en markup**; `#inteligencia` (`:1939-2028`) es **vista única sin tabs**; placeholder real `:2023` «Preguntame lo que quieras…»; **ninguno** de los strings citados existe; no hay skeleton ni IntersectionObserver |
| `:3103-3106` «el descarte **se mudó** de Mi día al TABLERO (20/08)» | `:3817-3818` «el descarte **VUELVE** a Mi día» | `:3819` `document.querySelectorAll('#exp .ex').forEach(descartable)` ⇒ **Mi día** |
| `:2802-2803` «las tres de Ayuda **todavía no tienen subpantalla dibujada**… quedan sin destino» | — (el mecanismo cambió sin comentario) | `:2134-2136` tres `.aj-fila` con `data-ir="s-comousar|s-soporte|s-feedback"`; `:2144`, `:2159`, `:2191` son las tres `subp`; `:3784-3785` el handler genérico `[data-ir]` las abre. El array `SUBS` que el comentario tenía al lado **quedó reemplazado** |

Los otros dos son cantidades sin par nuevo:

| línea | afirma | el ejecutable | nota |
|---|---|---|---|
| `:3569-3572` | «los **15** estados… **Doce** son hilos, entran por `abrirHilo`» | `HILOS` (`:3199-3377`) tiene **18** claves, todas dispatchables. Los «otros tres» (`reveal :3576`, sheet de consentimiento `:2606`, conexión caída `:3637`) **sí** existen como se describen | el número que falla es el de hilos; probable nota fechada 25/08 que no siguió al crecimiento de `HILOS` |
| `:347-352` | «**12 px** separan los campos entre sí» | La regla fila-a-fila de `.hitl .kv` está una línea abajo: `:353` `padding:14px 0`. El único `12` del alcance es `.kv{gap:12px}` (`:342`), que separa **horizontalmente dentro** de una fila | **confianza moderada**: la comparación cualitativa sigue siendo cierta (14 > 4 de `.k{margin-bottom:4px}`); el número literal no corresponde a la regla que produce esa separación |

---

## 3. Qué decide esto sobre el uso del proto como referencia

Cada veredicto `COHERENTE`/`DESVÍO`/`FUERA-DE-REFERENCIA` de BL-Q3 se apoya en «lo que el proto
modela». Si eso se lee de un comentario, **el veredicto hereda la contradicción** — y el error no se le
atribuye al proto sino a quien lo citó.

**Control que le falta al uso del proto, y que es la fila para planificación:** antes de citar un
comentario del proto como evidencia, **grepear si hay un comentario POSTERIOR sobre el mismo tema**. No
alcanza leer el que apareció en la búsqueda. Si los dos existen, **gana el ejecutable** y la
contradicción es un hallazgo por sí misma. Del lado del que escribe: un comentario nuevo que explica un
cambio debe **borrar o fechar** la afirmación que vuelve falsa, en el mismo commit.

Regla en `memoria/documentar-el-cambio-en-un-comentario-nuevo-deja-vivo-el-viejo.md`.

---

## 4. Lo que NO se verificó (declarado, no omitido)

- **107 de los 134 candidatos** no se revisaron uno por uno. Quedaron afuera a propósito los que citan
  proporciones de contraste WCAG (`:148-154`, `:369-371`, `:537-538`, `:768-770`…), porque verificarlos
  exige recalcular luminancias y no leer código, y los que comparan contra `kb-usuario/*.md`, externo a
  este archivo (`:920-931`, `:3236-3243`) — ahí «contradicción» no aplica igual, porque el propio
  comentario aclara que el sujeto es otro repo.
- **Los 214 no candidatos** (348 − 134) se descartaron por el filtro, por ser racionales de diseño sin
  cantidad, existencia ni ubicación chequeable. No se leyeron individualmente: **no se puede garantizar
  que ninguno esconda una afirmación de cantidad escrita de forma atípica** que el filtro no capturó.
- `:978-986` (logos reales de apps, no Phosphor) se dio por consistente por el patrón `.tile.marca img`
  (`:987-988`), **sin recorrer una por una** las apps conectadas para confirmar que ninguna quedó con
  ícono viejo.
- **Ninguno de los 6 hallazgos se arregló.** Cuatro de ellos ya tienen dueño declarado en planificación;
  los dos nuevos de cantidad (`:3569`, `:347`) son filas para asignar.
