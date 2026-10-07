---
name: medir-la-cobertura-de-una-convencion-antes-de-hacerla-obligatoria
description: Un campo opcional que nadie leía se llena ~1 de cada 4 veces; empezar a leerlo convierte el 74% de los casos correctos en alarma falsa.
metadata:
  type: feedback
---

Cuando un instrumento va a empezar a **leer** una convención que hasta ahora era opcional —una línea
`RESPONDE:`, un `SUPERSEDE:`, una cita del documento que se contesta— la pregunta previa no es si la
convención es buena idea. Es **qué cobertura tiene hoy**, medida sobre el corpus real.

**Caso, 2026-09-29.** Planificación preguntó si la Regla 2 del escalador debía leer un
`cierre_`/`respuesta_` para dejar de escalar un `pedido_` ya contestado. La convención de citar el
pedido en el cuerpo **ya existía** (su propio cierre la usaba: «responde `pedido_…`»). Medido sobre el
buzón entero:

```
universo: 313 de 313 cierre_/respuesta_ (abierto + en-curso + cerrado)
>>> CITAN al menos un pedido_/contrato_:  82 de 313  (26%)
control POSITIVO: el cierre que a ojo cita -> 1 cita (el regex no está ciego)
control NEGATIVO: un nombre inventado -> False
```

Y **nadie** la cumplía, incluidos los dos que discutían el cambio: planificación 22%, auditoría 24%,
frontend1 8%.

**Con 26%, leer la convención convierte el 74% de las respuestas correctas en alarma falsa.** El guard
empieza a sonar encima de trabajo terminado, y eso es
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]: a la tercera vez se saltea, y después no
frena el caso real. La salida fácil —emparejar por heurística, «cualquier cierre posterior del
destinatario al emisor»— es peor: apaga pedidos que nadie contestó, o sea **fail-open**, y un falso
verde en un gate de parálisis no da síntoma nunca.

**Y el 26% no mide desidia: mide la consecuencia pasada.** Un campo que nadie lee se llena una de cada
cuatro veces, y eso es exactamente lo esperable. La cobertura sube *después* de que el lector exista —
nunca antes—, así que el orden correcto es **exigir la declaración al escribir, y sólo después
leerla**. Es la misma inversión que C3-25-E: *marcar la sucesión primero, contrastar después*; al revés
se fabrica el falso verde. Acá el artefacto es el falso rojo, y llega igual.

**Cómo aplicarlo:** antes de que un script empiece a depender de un campo o de una cita, corré el
conteo sobre el corpus entero con control positivo y negativo, y desglosalo **por emisor** — el
desglose es lo que muestra si el hueco es de una sesión distraída o del mecanismo. Si la cobertura no
está cerca de 100%, el cambio se parte en dos: primero el que escribe lo declara (y algo lo exige),
después el que lee lo usa.

**Corolario que vale para el diseño:** el campo opcional que se agrega «por si algún día lo leemos»
nace con 26% garantizado. Si el plan es leerlo, tiene que nacer exigido.

---

## Corolario (2026-09-30): cuando la cobertura es 0%, el proxy disponible mide OTRA COSA

La versión de arriba supone que la convención existe y está poco usada. Hay un caso peor: **cobertura
cero**, porque la convención no puede existir.

**Caso.** Planificación nombró un defecto estructural del buzón: «un `a-todos` **no tiene quien lo
mueva**» — con un destinatario único el dueño se reconoce, pero moverlo afirmaría algo sobre las otras
dos sesiones, así que queda en `abierto/` **por construcción**. Antes de que eligiera el criterio de
cierre, medí los dos candidatos sobre los 10 `a-todos` abiertos:

```
candidato A — "sus contrato_/pedido_ salieron de abierto/":  0 de 10 citan uno   (cobertura 0%)
candidato B — "los PRs que cita estan mergeados":            6 de 10 aplican, 15 de 15 PRs MERGED
```

El A no aplica **nunca**: un `a-todos` no responde a un contrato, lo **abre**. Y el B, que parece
funcionar con 15/15 verde, **falla hacia el sí**: el `hallazgo_…_A5-VEREDICTO-el-Cierre-A-NO-cierra` cita
tres PRs **MERGED** y está **vivo** — `PLAN.md:28` sigue pidiendo «RE-MEDIR las filas invalidadas ANTES
de cerrar». Uno de los tres PRs es `docs(bl-p5): cada pantalla del prototipo clasificada`: el **insumo**
del hallazgo, no su cura.

**La lección propia:** un PR mergeado prueba que **se escribió trabajo**, no que **el hallazgo murió**. El
proxy estaba disponible, medible y verde, y medía otra cosa. Tasa de falso-cumplido **≥1 de 6**, y el
falso «cumplido» en un buzón no vuelve a gritar nunca —
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]].

**Cómo aplicarlo:** cuando no hay convención que medir, el reflejo es agarrar el dato que **sí** existe.
Antes de usarlo, escribí qué afirma literalmente ese dato y comparalo con lo que necesitás afirmar. Si
son distintos —«se escribió» vs «se resolvió», «se desplegó» vs «funciona», «el test pasó» vs «el camino
de prod se ejercitó»— el proxy no es una aproximación: es otra medición. Y el veredicto correcto puede
ser que **no hay ancla mecánica** y el cierre tiene que ser **declarado** por alguien. Ver
[[el-nombre-es-una-hipotesis-sobre-el-contenido]] y [[vacio-no-es-hallazgo-correr-el-control]].

---

## Refuerzo (2026-09-30): con cobertura 0, el instrumento REPORTA — no actúa

Corolario operativo que faltaba. Cuando una convención nueva tiene cobertura ~0, el instrumento que
la consume **no puede ser el que toma la acción**, ni aunque la acción sea correcta.

**El caso.** Adopté `CIERRA: <nombre>` para cerrar los `a-todos` inmortales del buzón. La tentación
era escribirlo en `archivar-buzon.sh` y que archivara los declarados. Con cobertura 0, ese archivador
habría movido **cero archivos** — y `archivados=0` es **indistinguible de un glob roto**, que es el
filo que auditoría ya había nombrado sobre otro retiro (`retirados_obsoletos=0`).

Peor: el día que alguien escribiera el primer `CIERRA:` y el glob estuviera mal, el síntoma sería
«sigue sin archivar», idéntico al estado anterior. El defecto nacería invisible y con coartada.

**Por eso `a-todos-sin-cierre.sh` es un REPORTADOR:** lista los `a-todos` con su cerrador declarado o
su ausencia, y **no mueve nada**. Se convierte en archivador el día que la cobertura lo justifique.

**La regla:** *primero se exige al escribir, después se lee, y sólo al final se actúa.* Saltar del
paso 1 al 3 produce un mecanismo cuyo «no hizo nada» no se puede leer. Y el reportador paga solo: con
`0 cerrables · 6 sin cierre · de 9 examinados` la cobertura **se mide en cada corrida** en vez de
estimarse una vez.

---

## Tercer régimen (2026-09-30): la convención PARTIDA EN DOS FORMATOS — el lector mide la mitad y cree tener el total

Los dos casos de arriba son «poco usada» (26%) y «no puede existir» (0%). Falta el peor de los tres,
porque **no da síntoma**: la convención existe, se usa mucho, y se escribe de **dos maneras**. Cualquier
lector único ve una, devuelve un número redondo, y **nada indica que le falta la otra mitad**.

**Tres casos, todos en el mismo turno, midiendo el Cierre A:**

| convención | forma A | forma B | qué devolvía el lector de una sola forma |
|---|---|---|---|
| plataforma de una medición | FE2: columna `\| plataforma \|` | FE1: dentro de `medido_contra` («`leido@` (mobile…)»), columna `dimension` | 11 tablas / 40 filas; el doc de FE1 titulado «5 ids» aportaba **0** |
| casilla de DoD en el backlog | lista: `- [ ] casilla` | inline: `- **DoD:** [x] uno; [x] dos` | **1 de 66** ítems con DoD completo — falso; el correcto es 3, y `BL-P4` solo ya tenía 2 `[x]` |
| ubicación de un componente | `modules/chat/BotonVoz.tsx` | mi supuesto `modules/voz/` | `git show` devolvió **0 líneas**, no un error |

**Lo que los tres tienen en común: el resultado parecía plausible.** `1 de 66` en un backlog largo, `40
filas` en un buzón de 2085, un archivo que «no tiene ese gradiente». Ninguno se veía como un fallo del
lector, y dos de los tres habrían entrado a un veredicto como hallazgo del *sujeto*.

**Lo único que los cazó fue el control positivo elegido contra un hecho SABIDO POR OTRA VÍA** — no un
control genérico:

- para el DoD: *el acta afirma que `BL-P4` y `BL-P7` están tildados* ⇒ el lector tiene que verlos. Salió
  `[2,0]` y `[0,4]` en `BL-B1`, ambos coincidiendo con lo leído a mano.
- para la plataforma: *hay un doc titulado «5 ids» mobile* ⇒ tiene que aportar ~5 filas. Aportó 1, y
  después 0.
- para el archivo: *si el lector ve el archivo, `wc -l` > 0*. Dio 0.

Un control positivo **construido desde el propio instrumento** («¿el regex matchea algo?») habría pasado
en los tres. El que sirve viene de **afuera**: un número que otro documento afirma, y que el lector está
obligado a reproducir.

**Cómo aplicarlo:** cuando un lector devuelva una cifra sobre un corpus escrito por varias sesiones,
buscá **una segunda forma** de la misma convención antes de publicarla — abrí dos documentos de **emisores
distintos** y compará cómo escriben el mismo dato. Y elegí el control positivo apuntando a un hecho que
ya esté afirmado en otro lado: si tu control lo inventás vos, mide tu regex, no el mundo. Ver
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] e [[instrumento-que-no-mira-nunca-falla]].
