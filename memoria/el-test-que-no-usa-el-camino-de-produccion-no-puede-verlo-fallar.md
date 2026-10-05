---
name: el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar
description: 16 archivos de test abrían la conexión con psycopg2 crudo — producción la envuelve; por eso 8 tests adversariales verdes nunca pudieron ver que el RLS no aplicaba
metadata:
  type: feedback
---

**Un test que construye su propia versión de una dependencia no verifica la dependencia real: verifica
la suya.** Y si difieren en la pieza que importa, el test es verde y ciego a la vez — no falla, no
avisa, y su verde se lee como cobertura.

**El caso (2026-07-31).** 16 archivos de test del copiloto definían cada uno su `conn_factory`:

```python
def factory():
    c = psycopg2.connect(os.environ["DATABASE_URL"]); c.autocommit = True; return c
```

Producción **no usa eso**: `serve.py:112` y `worker_b.py:292` envuelven la fábrica con
`conexion_con_tenant(...)`, que declara el tenant a la conexión. Los tests ejercitaban **un camino que
no existe en producción** — 16 copias de un atajo que nadie decidió, sólo copió del archivo de al lado.

Consecuencia exacta: entre esos tests había **8 adversariales de aislamiento cross-tenant**, el control
de seguridad más crítico del repo, que un ADR declaraba verificado. Estaban verdes. Y no podían haber
detectado que el RLS no filtraba en 72 de 77 tablas, **porque no pasaban por la pieza que lo hace
filtrar**. No era un test flojo: era un test midiendo otra cosa.

## Por qué no lo caza ninguna otra regla

Las reglas de rigor vigilan que el test **exista**, que ejercite el **caso hostil**, que corra contra
la **base real** y no un mock. Esos 8 cumplían las tres. La pregunta que faltaba es anterior y nadie la
hace en un review: **¿el test se conecta / autentica / entra por donde entra producción?** El sujeto
verificado era correcto; el **camino hacia él**, no.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]] — aquella pregunta *"¿qué devolvería mi
instrumento si lo que mido estuviera roto?"*; ésta pregunta *"¿mi instrumento está enchufado donde
está el sistema?"*. El mismo día se pisaron las dos, y una tercera vez: la base de tests corría como
**superuser**, donde el RLS tampoco aplica ([[suite-local-en-vps-con-rol-no-superuser]]).

## Qué hacer

**El setup del test sale del composition root, no se reescribe.** Si producción arma la dependencia en
`serve.py`/`worker_b.py`, el fixture importa **esa** construcción o una función compartida con ella; no
la reproduce a mano. Acá quedó como un solo fixture `conn_de_tenant` en `conftest.py` que devuelve la
fábrica envuelta, atada al tenant — 16 copias colapsadas a uno.

**Señal de alarma barata:** un `import` de bajo nivel (`psycopg2`, `httpx`, el SDK crudo) dentro de un
archivo de test cuando la app tiene una capa que lo envuelve. Grepearlo cuesta un comando y encuentra
exactamente esta clase de divergencia. [[verificar-la-composicion-root-no-el-default]]

## Hermana de entorno, 2026-09-22 — el recibo local 5/5 con el CI en rojo

El mismo principio, un nivel más arriba: no «el test no usa el camino de producción» sino **el test
no corre en la máquina de producción**.

`gate.sh` dio **5/5 con recibo sobre árbol limpio**; GitHub Actions dio `lint` en **rojo** sobre ese
mismo árbol. Causa: `test-graph-sync-lock-y-drift.sh` ejercita `graph-sync.sh`, que exige `uv` y
aborta si falta (`:82`). El runner no tiene `uv`, así que allá los 5 primeros casos medían «falta
uv» en vez de lock/drift/bitácora — **rojo en GitHub y verde en la PC desde que el test existe**.

Lo que hay que llevarse, porque el reflejo es el contrario: cuando el gate local y el CI difieren,
**la diferencia es información y el que suele tener razón es el entorno que NO elegiste**. Un recibo
verde no puede ver esta clase de fallo por construcción — todo lo que dependa de qué hay instalado.

**Y el control que casi me hace cerrarlo como «no reproducible»:** para reproducir saqué del `PATH`
el directorio de `uv`… y el test pasó 7/7. Conclusión falsa: esta PC tiene **dos** `uv` instalados
(`.local/bin` y `hermes/bin`) y seguía encontrando el otro. Un `command -v uv` **antes** de medir lo
decía en un segundo. Es [[vacio-no-es-hallazgo-correr-el-control]] aplicado al revés: no un vacío que
parece hallazgo, sino un **verde que parece refutación**. Antes de declarar «no se reproduce»,
probá que tu reproducción reproduce.

**Fix:** stub de la dependencia dentro del test, **antepuesto al PATH** para ganarle también a la
herramienta real. Instalarla en el runner parece más fiel pero acopla una prueba de lógica bash a un
gestor de paquetes Python que no participa; y dejar ganar a la de la máquina mantiene el defecto de
fondo, que no es el rojo: es que **el test medía cosas distintas en cada máquina**.

---

## Refuerzo 2026-10-05 · el stub COMODÍN: contesta lo mismo a toda invocación, y el fallo aparece del lado del script

`scripts/tests/test-ci-verde-gh-presente.sh` fabrica un `gh` falso que imprime **el mismo** array de 6
jobs ante *cualquier* subcomando. Mientras `ci-verde.sh` preguntaba una sola cosa (el rollup), alcanzaba.
`plan/ci-verde-mide-mergeable` le agregó una pregunta —`gh pr view --json mergeable,mergeStateStatus`—
y el comodín le devolvió el array de jobs: el script no pudo leer `mergeable`, repreguntó, siguió sin
poder y salió `exit 2` fail-closed. El CI quedó rojo **con el script correcto**.

**Dos cosas que esto agrega a la entrada:**

1. **Un doble que no despacha por entrada es un comodín, y el comodín envejece sin avisar.** No falla
   cuando se escribe: falla cuando el sujeto aprende a preguntar algo nuevo, y entonces acusa al
   sujeto. La pregunta de diseño es *¿este stub distingue las invocaciones que el script hace, o
   contesta una sola cosa?* — si contesta una sola, es una bomba de tiempo apuntada al próximo cambio.
2. **El camino nuevo puede ser INALCANZABLE para el fixture, y entonces sólo lo prueba la realidad.**
   El `exit 4` de ese PR (CI verde + PR `CONFLICTING`) no se puede ejercitar con el stub, porque el
   stub no sabe fabricar un conflicto de merge. Se verificó corriendo el script contra un PR realmente
   conflictivo (#776: 6/6 `pass`, `CONFLICTING`) → `exit 4` con el mensaje correcto. Un caso cuyo
   control positivo vive **fuera** del CI depende de que alguien lo corra a mano, y eso no sobrevive a
   una semana: hay que darle al fixture la capacidad de fabricarlo, o el caso queda sin gate.

**Cómo se usó acá, que es lo transferible:** el rojo se podía reportar en un minuto como «tu PR rompe
el caso verde». Medir **a quién** acusar costó dos comandos —leer el stub, y correr el script real
contra tres PR con esperados distintos— y cambió el destinatario del trabajo. Ver
[[un-control-positivo-con-esperado-falso-acusa-al-script]], que es el mismo error con el esperado en vez
del doble.

**REFUERZO 2026-10-05 — 14 casos verdes que eran estructuralmente incapaces de ver el bug.** El gate
`ci-verde.sh` tenía 3 archivos de test y 14 casos sobre el veredicto. Ninguno podía cazar que el
rollup trae cada job duplicado por run, porque **el `stub_gh` recibe el rollup *ya filtrado*** — así
se llama su propio parámetro — y lo devuelve tal cual. Los tests entraban **por debajo del `jq`** del
script, y el defecto vivía **en** el `jq`.

El stub emulaba la *salida* de la transformación en vez de su *entrada*, y así la transformación
nunca se ejercitó. Es la misma clase que el composition root, en miniatura: lo que el test salta es
exactamente lo que nadie prueba.

**El arreglo mantiene el stub viejo y no toca los 14 casos:** la expresión pasó a una variable
(`ROLLUP_JQ=`) y el test nuevo hace `eval` de esa línea del script, así que ejercita **la misma
expresión que corre en producción**, no una imitación. Fail-closed: si la variable desaparece o queda
vacía, el test se pone rojo en vez de pasar en silencio.

**Y el caso decisivo no es el que arregla el bug — es el que descarta el fail-open:** `FAILURE` nuevo
sobre `SUCCESS` viejo tiene que dar **FAILURE**. Sin él, un dedupe que tomara «cualquiera de los dos»
pasaría igual, porque en la corrida real los dos duplicados eran `SUCCESS`: la medición que motivó el
fix no distinguía «tomé el más reciente» de «tomé uno».
