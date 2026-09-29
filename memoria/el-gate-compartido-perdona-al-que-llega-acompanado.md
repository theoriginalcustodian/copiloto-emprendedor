---
name: el-gate-compartido-perdona-al-que-llega-acompanado
description: El pre-push pasaba por contención con otro sync, no por salud. Al llegar solo, el guard corrió y abortó. Menos tráfico = más bloqueo, y cada sesión lo vive como mala suerte propia.
metadata:
  type: project
---

El `pre-push` sincroniza el grafo de código y es **fail-closed**. Su ejecutor, `graph-sync.sh`, toma
un lock: si otro push lo tiene, sale **`rc=0 motivo=contencion-otro-sync`** sin reconciliar, y el push
**pasa**. Si lo consigue, corre el reconcile completo — y ahí encuentra el problema real y **aborta**.

Medido el 2026-09-23, al segundo:

```
02:52:22  #683 mergeado por otra sesión (su push pasó)
02:52:50  mi push -> "reconcile abortado: el diff borraría 434 objetos (tope 200)"
          git ls-remote -> <AUSENTE>
```

Veintiocho segundos de diferencia. Mismo hook, mismo repo, mismo defecto de fondo. La diferencia no
fue el contenido: fue **haber llegado solo**.

**Por qué es traicionero.** Invierte la intuición de todo recurso compartido: acá el tráfico ajeno no
te estorba, **te salva**, porque le roba el lock al guard. El bloqueo aparece en los huecos de
actividad — de madrugada, o cuando las otras sesiones ya cerraron. Cada sesión lo vive como mala
suerte propia y nadie ve el patrón, que es justamente lo que impide nombrarlo como bloqueo de flota.

**Lo que yo hice mal con esto.** Vi un push pasar, escribí **«el push PASA, no se paren por el
grafo»** y le bajé la urgencia al operador de alta a media. Las dos cosas salieron de la misma
inferencia: *pasó ⇒ está sano*. El propio hook desmiente eso en un comentario que yo había leído
(`.githooks/pre-push:69-72`: «Hay un camino real de exit 0 sin sincronizar — el lock ocupado por otro
push concurrente»). **Un éxito no prueba que el mecanismo corrió**; prueba que no te frenó esa vez.
Antes de afirmar salud desde un caso exitoso, preguntá **qué camino tomó adentro** — acá lo dice la
bitácora del bridge, con el motivo textual.

**La trampa que hay que no tomar.** Sabiendo el mecanismo, es tentador disparar un `graph-sync` en
background para ocupar el lock y colar el push por contención. Eso es `--no-verify` con otro nombre:
saltea un guard fail-closed simulando la condición que lo desactiva. Y los dos atajos reales están
prohibidos por razones propias — `--no-verify` saca el escáner de secretos en un repo **público**, y
`UC_GRAPH_FORCE=1` borra estado compartido de forma irreversible.

**Qué hacer cuando aborta:** reintentar (el hook dice «el próximo push reintenta») y, si aborta
**tres veces**, dejar de tratarlo como propio: es bloqueo de flota, va escalado con el dry-run ya
mirado. El trabajo no se pierde — queda commiteado y con gate verde esperando el push.

## La vuelta de tuerca: medir el MECANISMO no es medir su CONDICIÓN

Describí la lotería bien y aun así comuniqué mal. Durante una hora le dije a las cuatro sesiones
«el push es una lotería: pasa si chocás con otro sync» — correcto como mecanismo— sin medir nunca
**si quedaba algún sorteo**. A las 03:43 lo medí:

```
gh pr list --state open   →  []         (cero PR abiertos)
git ls-remote origin main →  78320bf    (congelado hace ~51 min)
```

El salvavidas exige que **otra** sesión esté pusheando en ese mismo instante. Sin PR abiertos y con
todas las sesiones en tareas de medición en vez de commit, no hay con quién chocar: **la lotería no
tenía sorteos**. El mismo sistema, sin que nada cambiara en él, había pasado de «bloquea a veces» a
«bloquea siempre» — y yo seguía repartiendo la palabra «intermitente», que invita a reintentar.

**Y el vuelco es cruel al final del sprint:** cuando lo mergeable ya se mergeó, todos pasan a medir,
el tráfico cae a cero y el gate se cierra **justo cuando cada sesión vuelve sola con su último
commit**. El alivio escasea exactamente cuando más se lo necesita.

**La regla:** un mecanismo probabilístico se describe con su **condición de disparo medida**, no con
su fórmula. «Pasa si hay contención» y «hoy no hay contención» son el mismo sistema y **dos
instrucciones opuestas**: la primera dice reintentá, la segunda dice escalá y no gastes intentos.
Antes de publicar «a veces funciona», correr la consulta que cuenta **cuántas veces, hoy**.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]] ·
[[el-pipe-se-come-el-exit-code]]
