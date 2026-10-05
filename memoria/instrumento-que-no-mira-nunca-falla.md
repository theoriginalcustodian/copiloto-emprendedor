---
name: instrumento-que-no-mira-nunca-falla
description: Un control cuyo rango de observación casi siempre sale vacío no verifica nada, y su silencio se lee como verde. Verificar que el instrumento MIRÓ es un paso distinto de verificar que pasó.
metadata:
  type: feedback
---

Un control positivo se construyó para probar que el sync del grafo **llegó al servidor**. Su primera
corrida real: el sync subió **15.906 filas** y el control respondió *«nada verificable en este rango»*
— comparaba contra `HEAD~1`, y los archivos del último commit no caían en los directorios indexados.

**No falló. No dijo que sí. Dijo que no miró — y eso se leyó como "todo bien".**

Es un escalón más abajo que [[instrumentos-que-confirman-en-vez-de-verificar]]. Aquel habla del
instrumento que responde mal; éste, del que **no responde** y cuyo silencio pasa por aprobación. El
código estaba bien escrito: distinguía «encontrado» (0), «no encontrado» (1) y «nada que mirar» (2),
que es más honesto que la mayoría. El defecto estaba en que **el rango de observación casi nunca
contenía algo observable**, así que la rama honesta era la única que se ejecutaba.

**La pregunta que lo caza**, y hay que hacerla aparte de «¿pasó?»:

> **¿Sobre cuántos elementos miró este control? Si la respuesta puede ser cero sin que nadie se entere,
> el verde no significa nada.**

Un DoD no está cumplido porque el comando salió 0: está cumplido cuando se puede nombrar **qué
observó**. Acá: `'scripts_graph_sync' está en Graphity — uuid b4687a87…`. Eso es evidencia; `exit 0`
no lo es.

**Y el diferencial es obligatorio.** Un control que dice que sí sobre algo presente no prueba nada
hasta que se lo ejercita contra algo ausente:

```
uuid inexistente -> node_exists = False
uuid real        -> node_exists = True
```

Sin esas dos líneas juntas, «está en Graphity» es compatible con un cliente que devuelve `True`
siempre.

**Dónde más aplica:** cualquier check que filtre antes de mirar — tests que se saltean por una
condición y reportan verde, linters con un `exclude` que se comió el directorio, greps de auditoría
sobre un glob equivocado, gates de CI que pasan porque el job no corrió. El patrón es el mismo:
**el filtro vacía la muestra, y el resultado vacío se pinta del color del éxito.**

## 🆕 La variante que muerde a un gate BIEN hecho: el veredicto más ancho que la medición

*Caso 2026-08-07, corpus de la KB.* Se escribió un gate para el corpus del RAG con todo lo que esta
entrada pide: **canario horneado** (4 defectos sembrados, los cazaba 4/4), **denominador impreso**
(«17 documentos auditados»), y el corpus vacío tratado como error y no como ausencia de hallazgos.
Salida: `0 hallazgos` → **`✓ corpus apto para ingest`**.

Fusion corrió su propio validador sobre el mismo corpus: **8 de 17 documentos perdían contenido al
ingestar** — 6.563 caracteres, porque las secciones acumulativas («Preguntas frecuentes», «Errores
frecuentes») cruzaban el tope de 1800 del chunker y **el final se truncaba en silencio**.

**Los tres ejes que el gate medía estaban impecables.** No falló en nada de lo que miraba. El defecto
está un nivel más arriba: **midió headers, PII y marcadores, y concluyó "apto para ingest"** — un
veredicto que abarca *todos* los ejes que importan para ingestar, no los tres que sabía mirar.

> **Un gate riguroso dentro de su eje puede emitir un veredicto que no le corresponde.** El canario y
> el denominador protegen de medir mal; **no** protegen de concluir de más.

**La pregunta que lo caza** (distinta de «¿sobre cuántos miró?»):

> **¿Mi veredicto usa palabras más anchas que mis ejes?** «Apto para ingest» ⊃ «pasa los 3 chequeos
> que escribí». Si la conclusión es más general que la medición, o se angosta la conclusión, o se
> agregan los ejes que faltan.

**El arreglo fue de raíz, y reutilizando:** el validador de chunking no se reimplementó — se
incorporó al gate (`scripts/validar_chunking_kb.py`, invocado por `kb-corpus-check.sh`), y el gate
**se niega a declarar el corpus apto si ese validador no está**, con su propio control probado
(sacar el archivo ⇒ exit 1). El veredicto ahora nombra los dos ejes: *«los DOS ejes en verde (forma
+ truncado)»*.

**Y el detalle que lo hacía indetectable desde adentro:** el truncado **no produce error**. El
documento se ingesta, los chunks existen, el retrieval devuelve algo. Lo que falta son *las últimas
preguntas de cada FAQ* — que en un corpus de soporte son las que se agregaron con el uso, o sea las
más buscadas. Un fallo que se lleva justo lo más valioso sin levantar la mano.

Relacionadas: [[vacio-no-es-hallazgo-correr-el-control]] (el vacío es una pregunta) ·
[[el-pipe-se-come-el-exit-code]] (la otra forma de leer verde sin medir) ·
[[bucle-canonico-dos-auditorias-y-el-enganche]] (§12, la ley de los instrumentos).

---

## 2026-09-23 — «el escáner dio limpio» significa «ninguno de los formatos que conozco»

Variante del mismo defecto, pero el instrumento acá **sí mira**: mira todo el árbol, archivo por
archivo. Lo que no tiene es una **regla** para lo que está buscando.

Después de sacar del repo público cinco archivos con credenciales que gitleaks había marcado, barrí
los 25 worktrees por *nombre* de archivo —`*token*.txt`, `*apikey*.txt`, `client_secret_*.json`,
`*.pem`— y apareció un sexto en la misma raíz: `apikey Composio Copiloto Emprendedores.txt`. **No
estaba entre los 12 hallazgos.** No lo perdonó una allowlist ni un fingerprint: las keys de Composio
no matchean ninguna regla, así que el escáner nunca lo vio.

Y el stack está lleno de proveedores sin regla: Composio, MercadoPago, Graphity, ARCA, DuckDNS.
Todos los secretos de esos servicios son invisibles para el escáner de contenido, en un repo
público, para siempre — no hasta que se actualice: **hasta que alguien escriba esa regla**.

**La pregunta que falta hacerle a todo detector basado en catálogo** —escáneres de secretos, linters
de seguridad, antivirus, validadores de esquema—: *¿contra qué lista compara, y qué de lo mío no
está en esa lista?* La respuesta no es «casi todo»: es enumerable, y en este repo son los cuatro o
cinco proveedores del stack.

**El complemento cuesta un `find`.** Lo que una persona guarda a mano casi siempre **se llama como
lo que es** —«apikey …», «token …», «client_secret_…»—, así que un barrido por nombre cubre justo el
hueco que deja el barrido por contenido. Son ortogonales: el de contenido caza el secreto pegado
adentro de un archivo con nombre inocente; el de nombre caza el archivo que el catálogo no reconoce.

Control positivo obligatorio también acá: el primer barrido tiene que encontrar algo que ya sabés
que existe, o el «cero resultados» no distingue entre *limpio* y *mal escrito el patrón*. Lo corrí
contra la carpeta donde acababa de mover los cinco: 4 de 4.

## El caso caro: un FILTRO con falso negativo deja el buzón «vacío» sin estar vacío

Lo cometí **dos veces en la misma sesión** (2026-09-23), y la segunda costó ocio ajeno medible.

Para ver qué mensajes me interpelaban, filtraba el buzón por nombre. El filtro estaba mal armado:
descartaba por un prefijo que también aparecía en los mensajes **entrantes**. Resultado: veía
`abierto/` lleno de archivos **míos** y concluía «nadie me escribió».

**Lo que había debajo, medido cuando corrí el filtro correcto:**

```
cierre_backend-a-planificacion_...     "Cola de backend vacía otra vez."
cierre_frontend2-a-planificacion_...   "Sin frente propio abierto."
```

Las dos sesiones habían terminado su trabajo y **avisado por el canal correcto**. Mientras tanto
`no-ocio-check.sh` las marcaba: backend **51 min girando en vacío**, frontend2 **76 min muda**.
**127 minutos de ocio que yo leí como silencio de ellas y era ceguera mía.** El aviso existía, estaba
bien escrito, en el lugar acordado, desde antes.

**Por qué no da síntoma:** un filtro que descarta de más devuelve una lista **plausible** — no vacía,
no rota, con archivos de verdad adentro. No hay error, no hay rojo. La forma de la salida es correcta
y sólo el **contenido** está mutilado, que es justo lo que no se revisa cuando el resultado confirma
lo que esperabas («nadie escribió» es una hipótesis cómoda: no exige nada).

**La regla, y es la misma de arriba aplicada a un filtro:** un filtro necesita su **control
positivo** igual que un escáner. Antes de concluir «no hay», poné a mano el caso que **sabés** que
debería pasar el filtro y verificá que pasa. Si no tenés un caso conocido, comparar el total contra
el filtrado ya alcanza: `N archivos, el filtro dejó 0` con N grande es una afirmación sobre el
filtro, no sobre el buzón.

**Y el corolario de dirección:** cuando dos sesiones aparecen ociosas al mismo tiempo, la hipótesis
barata no es que las dos se distrajeron — es que **el canal por el que iban a avisar no está
llegando**. Un ocio simultáneo apunta al lector, no a los escritores.

## El caso donde el instrumento fue CIERTO y venció (2026-09-29)

`scripts/podar-worktrees.sh` filtraba por un path **fijo**: `.claude/worktrees/`, con el comentario
«fuera de acá no son worktrees de trabajo de estas sesiones». **Era verdad el día que se escribió** —
y falso una semana después, cuando las 4 sesiones pasaron a trabajar en `C:/gfw-src/wt-*`.

Medido antes de tocarlo: de **34** worktrees registrados clasificaba **2**, ignoraba **23**, y su
resumen imprimía `0 no mergeado(s) · 0 sucio(s)`. Nadie lo lee como «no miré»: se lee como «no hay».

Lo que aparecía al destaparlo eran **3 worktrees sucios con trabajo sin commitear** — o sea trabajo
que no está en ninguna rama, exactamente el riesgo que el script existe para no correr.

**La variante nueva:** acá el supuesto no nació mal, **venció**. Un filtro escrito contra el layout
de hoy es correcto hoy y ciego dentro de una semana, sin que nada avise. Por eso el arreglo no fue
cambiar un path por otro —el próximo layout vuelve a dejarlo ciego— sino **parametrizar la base** y
hacer que el resumen declare SIEMPRE `N de M entraron al análisis`. Un conteo de resultados no es
interpretable sin el conteo de cobertura, y ésa es la línea que faltaba para que el defecto se viera.

> La pregunta que lo caza: *¿este filtro describe el mundo, o el mundo del día que lo escribí?*
> Emparenta con `[[un-inventario-de-procesos-vivos-es-un-snapshot-no-un-estado]]`: allá el dato
> envejecía, acá envejece **el criterio de selección**, que es peor porque no se vuelve a mirar.


---

## (2026-09-30) `rglob` **LISTA** rutas que `read_text` no puede abrir: el MAX_PATH de Windows

Barriendo el buzón (2104 `.md`), el script murió en un archivo que `rglob` acababa de enumerar:

```
FileNotFoundError: …coordinacion/cerrado/2026-08-05/2026-08-05_urgente_vigilancia-a-frontend_
  contrato-sin-tomar-2026-08-04_urgente_vigilancia-a-frontend_contrato-sin-tomar-2026-08-04_
  contrato_planificacion-a-frontend_MWEB-6-modulos-restantes-completo-paralelo.md
```

**El archivo existe.** Lo que falla es abrirlo: la ruta mide **295 caracteres** y el límite clásico de
Windows es 260. Medido: **4 de 2104** archivos del buzón son ilegibles así (260, 295, 296 y 303 chars).

**Por qué es esta patología y no un bug cualquiera:** la reacción natural al `FileNotFoundError` es
envolver la lectura en `try/except: continue`. Con eso el barrido **reporta «0 hits» sobre archivos que
nunca miró**, y no hay forma de distinguirlo de «los miré y no tenían nada». El instrumento no falla:
**deja de mirar**.

**Cómo aplicar:** (1) leé con el prefijo de ruta larga como segundo intento —`Path("\\?\\" + str(f.resolve()))`—
y (2) **contá y reportá los ilegibles como una cifra propia** (`LEIDOS: 2100 de 2104 · ILEGIBLES: 4`, con
su longitud y su nombre). Nunca `except: continue` a secas sobre un elemento del universo que declaraste
mirar. Un barrido tiene que poder decir **cuántos** miró, no sólo cuántos encontró.

**Y la causa de raíz, que es de planificación:** el escalador compone el nombre del `urgente_` metiendo
**el nombre completo del contrato adentro** (`urgente_vigilancia-a-<rol>_contrato-sin-tomar-<nombre del
contrato>.md`). Si el contrato ya es un `urgente_` compuesto, el nombre se anida otra vez y crece sin
techo — los 4 casos son exactamente eso, con «contrato-sin-tomar» dos veces en el mismo nombre. Un
generador de nombres sin límite de longitud fabrica archivos que después nadie puede leer.
Ver [[un-vacio-del-propio-instrumento-no-es-hallazgo]] · [[git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos]].

---

## Refuerzo 2026-09-30 — el instrumento **sabe** hacer lo que no hace: capacidad ≠ alcance

El caso de arriba es un control cuyo rango sale vacío. Este es peor, porque el instrumento **tiene la
capacidad** de mirar lo que no mira, y eso hace que el lector concluya —correctamente— que lo cubre.

`scripts/medir-indice-memoria.py` verifica, entre otras cosas, que ningún link apunte a un archivo
inexistente. Su función de extracción trae los dos formatos, y el docstring lo dice:

```python
def referencias(texto: str) -> set[str]:
    """Nombres de archivo referenciados, por link markdown Y por wikilink."""   # :43
    nombres = set(LINK_MD.findall(texto))
    nombres |= {f"{w}.md" for w in WIKILINK.findall(texto)}                     # :49
```

Y el universo sobre el que se lo llama:

```python
refs = referencias(texto_indice) | referencias(texto_historia)                  # :80
```

**Medido en `memoria/` el 2026-09-30:** 24 wikilinks viven en `MEMORY.md` + `HISTORIA.md`, y **1229 en los
360 cuerpos**. El control ve el **1,9 %**. Cuando se lo nombró como verificación de un renombre masivo de
~150 archivos —donde lo que se rompe son precisamente los links *de cuerpo a cuerpo*— el control seguía
imprimiendo `[OK ] links a archivos inexistentes: 0`.

**Canario, sobre una copia:** rompí a propósito un wikilink de un cuerpo.

```
SU control       (universo índice+historia):  0 rotos  -> VERDE  · ve el canario? NO
control ampliado (universo cuerpos):         12 rotos  -> ROJO   · ve el canario? SÍ
```

### Por qué esta variante engaña más que el rango vacío

Un control con rango vacío al menos **no promete**. Este promete en su propio docstring: dice «por link
markdown **Y** por wikilink», y es **verdad** — para las 24 del índice. La afirmación es correcta y la
conclusión que induce es falsa. **La capacidad de parsear un formato no dice nada sobre el conjunto al que
se aplica**, y en el código esas dos cosas viven en líneas distintas y lejanas: la capacidad en `:49`, el
alcance en `:80`. Quien lee la función se va convencido; el alcance está 30 líneas más abajo, en el
llamador.

### Y el segundo modo, que es el que lo deja vivir

El control imprimía `0` **antes** del renombre y habría impreso `0` **después**. Un absoluto no puede medir
un cambio cuando no separa la línea de base: la foto real era **238 de 249 destinos resuelven, 11 no** — los
11 preexistentes, todos en cuerpos. Con «rotos = 0» como criterio, 30 roturas nuevas se habrían mezclado con
los 11 viejos y se leerían como ruido conocido, que es
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]] aplicado a un conteo.
**El criterio correcto era diferencial: «los 238 que resolvían siguen resolviendo».**

**How to apply (suma a lo de arriba):** (1) ante un control que se nombra para verificar un cambio,
preguntá **sobre qué colección corre**, no qué sabe parsear — la capacidad vive en la función, el alcance en
el llamador, y sólo el segundo es el instrumento; (2) medí qué **fracción** del universo real cubre («24 de
1253» dice todo; «cubre wikilinks» no dice nada); (3) si la línea de base no es cero, el criterio no puede
ser un absoluto: guardá el ANTES y exigí que los que pasaban sigan pasando; (4) el canario es inyectar el
daño exacto que el cambio produciría **en el lugar donde lo produciría** — romper un link del índice no
prueba nada sobre los cuerpos.

---

## Refuerzo (2026-09-30): el control no podía **ver** el carácter que buscaba — `grep` de un emoji bajo cp1252

Verifiqué la firma de un mensaje recién escrito con `grep -c '\U0001F916' archivo` desde Git Bash y
obtuve **0**. El emoji **sí estaba** (medido después con Python: `t.count(...) == 1`, archivo de 5144
bytes). Lo que falló fue el camino del patrón: la consola de este entorno es **cp1252**, que no puede
representar U+1F916, así que el literal se manglaba **antes de llegar a grep**. El mismo `print` en
Python lo demostró reventando con `UnicodeEncodeError: 'charmap' codec can't encode character
'\U0001f916'` — el error salió del **instrumento**, no del dato.

Y el cero se lee idéntico a «no está». Un control que no puede representar lo que busca **siempre
informa ausencia**, y la ausencia es justo el resultado que uno ya teme, así que se cree.

**El control del control, que es una pregunta:** *¿el instrumento puede expresar el valor que busca?*
Si el patrón viaja por una shell, un `argv`, un log o una terminal con otro encoding, la respuesta puede
ser no — y entonces el `0` no mide el archivo, mide el canal.

**How to apply:** para verificar caracteres fuera de ASCII en un archivo, medilo **dentro** del proceso
que lee el archivo (`python -c` con `io.open(..., encoding='utf-8')` y comparación por codepoint),
nunca pasando el carácter como literal por la shell; y cuando tengas que imprimirlo, `PYTHONIOENCODING=utf-8`
o `\\uXXXX` con `backslashreplace`. Sumale el **control positivo barato**: buscá también un carácter que
NO pusiste (yo usé U+1F600) — si tu método discrimina, tiene que dar presente/ausente distinto para los
dos. Si ambos dan 0, no medió nada.

---

## Refuerzo 2026-10-05 · arreglar el instrumento ciego NO barre las afirmaciones que su ceguera ya escribió

El parser del criterio 3 no podía leer el id `(home)`: es sintético, empieza con paréntesis, y
`limpiar('(home)')` devolvía `'home)'`. Consecuencia medida, en palabras del propio comentario del
instrumento: *«la cifra no podía pasar de 53 de 54 por mucho que se midiera»*. El id **estaba medido**
desde el 2026-09-30, con veredicto `DESVÍO` y un documento en el buzón; lo que faltaba era un parser
que pudiera leer el nombre de la fila.

El parser se arregló. **La frase que su ceguera había escrito siguió viva** — «falta `(home)`, nunca
medida» — y el mismo día, en dos sesiones distintas, fabricó dos errores: una asignación de trabajo ya
hecho y un veredicto publicado en un entregable. Ninguna de las dos midió: **las dos citaron el mismo
renglón heredado**.

**La clase:** una afirmación generada por un instrumento ciego **no se parece a un bug**. Se parece a
estado conocido, y hereda la autoridad del lugar donde quedó escrita (un índice, un tablero, un
`PLAN.md`). El fix del instrumento es visible y celebrado; las afirmaciones que produjo mientras era
ciego son invisibles y sobreviven.

**El cierre que faltaba, y es parte del fix, no un extra:** al arreglar un instrumento, **grepear las
afirmaciones que produjo** mientras estaba ciego —en índices, tableros, docs maestros— y corregirlas
en la misma operación. Si el arreglo subió una cifra, toda cita de la cifra vieja es ahora falsa.
Corolario de proceso: el PR que arregla el parser y el que barre sus secuelas son **el mismo PR**,
como en [[barrer-llamadores-incluye-los-instrumentos-de-verificacion]].

Hermana de [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]] y de
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]].

## Refuerzo 2026-09-30 — el DETECTOR tiene que ser más ancho que el LECTOR

Regla de diseño, no anécdota: **un detector tan ancho como su lector no puede avisar de la ceguera
de su lector.** Si el instrumento que busca lo que se pierde usa el mismo criterio que el que lee,
los dos son ciegos al mismo conjunto y el silencio se lee como «no hay nada».

El caso: `contar-veredictos.py` leía el sujeto de una medición asumiéndolo en la **primera celda**
de la fila. Un `cierre_` puso el enumerador ahí (`A-1`) y el id en la segunda, bajo
`| # | camino | veredicto | … |`. Sus dos mediciones quedaron ilegibles — y por ser sus **únicos**
sujetos, el documento no llegó a *candidato*: ni medido ni descartado, invisible a los **cuatro**
ratchets del script, que operan todos sobre `candidatos`.

El arreglo tiene dos mitades y la segunda es la que importa a futuro:

1. **Lector**: guardar el índice de la columna que la cabecera declara (`camino`/`id`/`sujeto`), que
   es el mismo mecanismo que ese archivo ya usaba para la columna de *veredicto*.
2. **Detector**: `filas_ciegas_de()` acepta el id del padrón en **cualquier** celda. El margen entre
   los dos ES la alarma: cuando aparezca una forma que el lector no cubre, el detector la nombra en
   vez de perderla. Su exit nuevo mira justamente el conjunto que los otros cuatro no miran.

**Lo que hace que esto sea construible y no un guard que grita:** el discriminante se **midió sobre
el corpus entero antes de escribirlo** — 1 documento de 1979, 0 falsos positivos. La variante más
fina (marcar filas sueltas dentro de documentos que sí miden) daba **3 falsos de 5**: una tabla de
taxonomía donde los ids del padrón están en rol de *ejemplo*. Se eligió el falso negativo de la
tabla mixta antes que el guard que grita en el caso normal — ver
[[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]].

**Y la ceguera estaba ESCRITA ocho días antes**, en el comentario final del propio test del parser:
«un documento cuyo ÚNICO sujeto es ilegible no llega a ser candidato … y el ratchet exit 8 nunca se
entera». Describía el agujero sin mecanismo que lo cazara. Es la misma forma que
[[el-guard-se-satisface-con-su-propio-comentario]] y que el docstring que reservaba un cableado
nunca hecho: **dejarlo escrito lo vuelve invisible por escrito en vez de visible.** La pregunta que
lo convierte en trabajo: *¿qué mecanismo falla si esto que acabo de describir pasa de nuevo?* Si la
respuesta es «lo dice un comentario», no hay mecanismo.

**El remate que mide el valor sin inflarlo:** con el fix, la cifra titular **no se movió** (54 de
54) porque esos ids ya estaban cubiertos por otros documentos. Lo recuperado fueron *mediciones*,
no *cobertura* — entre ellas una tercera fuente concordante para dos veredictos. Decir «subió la
cifra» habría sido falso; el valor estaba en otro lado. Ver [[cero-que-no-se-puede-afirmar]].
