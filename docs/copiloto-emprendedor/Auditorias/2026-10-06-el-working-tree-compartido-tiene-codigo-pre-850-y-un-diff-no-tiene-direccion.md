# El working tree compartido tiene código **pre-#850** — y el camino para encontrarlo fue leer mal mi propia medición dos veces

**Auditoría · 2026-10-06** · medido en el checkout compartido
(`C:/Proyectos/Claude/Claude code/copiloto-emprendedor`) contra `origin/main` = `d69d244a`, con #850/#855 ya
mergeados. Entregable de la segunda mitad del turno; la primera está en
`2026-10-06-barrido-instrumentos-lint-y-recibo-cuatro-refutados-y-una-exencion-eterna.md` (7 candidatos, 7
refutados).

**Hallazgo: `apps/copiloto/web.py` en el working tree compartido es la versión anterior al fix de MP de hoy.
Commitearlo desde ahí revierte #850 + #855 con un diff que parece una feature.** Fila bajada como
`REVERSIONLATENTE` (`urgente_` a backend, `pedido_` a planificación). **Nada roto hoy; el riesgo es del próximo
`git add`.**

---

## 1 — El hallazgo

| | |
|---|---|
| `git diff --numstat origin/main -- apps/copiloto/web.py` | **+21 / −122** |
| `mtime` del archivo en disco | **2026-10-06** (hoy) |
| las 21 líneas que el disco tiene y main no | `seller = MpCredentialStore(...).first_seller_user_id()` · `"mp_connected": seller is not None` |

Ese es **el criterio que #850 eliminó**: el lado viejo del par divergente. Main hoy deriva todo de `salud()`
(`web.py:641` `_estado_mp`, `:648` `_mp_connected`), y #855 encima arregló que `catalog.py:158-159` no lo
descarte. **El disco está antes de las dos cosas.**

**Lo que lo hace peligroso no es que esté viejo: es que la reversión no se vería como una reversión.** Un PR
armado desde ese archivo mostraría un diff que **agrega** `first_seller_user_id()` y
`mp_connected: seller is not None` — código con nombres del dominio, plausible, sin nada que indique que ya se
retiró. El revisor no puede saber desde ese diff que está deshaciendo el fix de ayer.

## 2 — Y el método, que es la parte que vale: **leí mal la misma medición dos veces**

### Primera lectura: «15 archivos de trabajo en riesgo de perderse»

Barrí los 30 archivos `M` del checkout comparando **por blob** (`git hash-object` del working tree contra
`<ref>:<path>` de las 60 refs remotas — por commit no sirve, el índice de memoria ya avisa *«diffeá el archivo,
no cuentes commits»*):

| | |
|---|---|
| archivos `M` | **30** |
| iguales a `origin/main` — el `M` era ruido de CRLF/mtime | **9** |
| contenido respaldado por alguna de las 60 refs remotas | **6** |
| contenido que no existe en ninguna rama | **15** |

Y escribí la alarma: *15 archivos cuyo trabajo sólo vive en ese disco*. **Falso.**

### Segunda lectura: el signo

`web.py` **+21/−122** · `HISTORIA.md` **+2/−179** · el backlog beta **+13/−226** · `graph-sync.sh` **+4/−127** ·
`testid-paridad-excepciones.json` **+10/−71**. Cuando los **borrados aplastan a los agregados**, el archivo no
está adelantado: está **ATRASADO**. Esas 122 líneas «faltantes» son líneas que **main tiene y el disco no**.

**`git diff` mide una diferencia y no dice qué lado es el correcto.** Un conteo de archivos que difieren es un
**escalar sin signo**, y sobre un escalar sin signo cualquier narrativa calza — incluida la opuesta a la
verdadera. Lo que separa los dos mundos son dos comandos que no son `diff`:

- **`git diff --numstat`** → el **signo** del delta.
- **`git merge-base --is-ancestor HEAD origin/main`** → acá dio **no ancestro**, con **7 commits propios** de la
  rama de frontend2. Eso es lo que impide tratar el árbol como basura: *está* mezclado, con trabajo legítimo.

### Tercera lectura: el contenido, que fecha el archivo solo

Recién al leer **qué decían** las 21 líneas apareció el hallazgo real. Las dos lecturas piden acciones
**opuestas**: la primera dice *«commiteá antes de perderlo»*, la correcta dice ***«no lo commitees»***.
Una alarma con la dirección invertida es peor que ninguna, porque recomienda el gesto exactamente equivocado y
suena urgente mientras lo hace.

## 3 — El mismo molde, tres veces en un turno

Es la cuarta vez hoy, y conviene verlas juntas porque es **un** error con tres disfraces:

| medí | concluí | lo que faltaba |
|---|---|---|
| `grep -- '--historia'` → 0 llamadores | «ningún gate mira la historia» | el pre-push la mira con **otra bandera** (`--refs-stdin` → `gitleaks git --log-opts`): grepeé el **nombre**, no la **capacidad** |
| `-S'secretos-check.sh --refs-stdin'` → 0 commits | «la llamada no existe» | la línea real lleva **comillas en medio**; el control positivo `-S'secretos-check.sh'` dio **1** |
| barrido «¿algún PR de hoy cambió código sin tocar un test?» → 0 | «todo cubierto» | **#855 salió ✅ y es donde ya tenía un hallazgo**: medía *archivos*, el defecto vivía en *asertos* |
| 15 archivos difieren de main y de toda rama | «trabajo en riesgo de perderse» | el **signo**: borrados ≫ agregados ⇒ atraso, no trabajo nuevo |

**El patrón:** cada vez medí una **proxy sintáctica** (una bandera, una cadena, un archivo tocado, un conteo de
diferencias) y la leí como la **propiedad semántica** (una capacidad, una llamada, una cobertura, una autoría).
El control que lo caza en los cuatro casos es el mismo y cuesta una corrida: **estrenar el instrumento contra un
caso cuyo veredicto ya conocés**. En el tercero el canario era gratis —tenía el hallazgo en la mano— y el
barrido lo **absolvió**; eso bastaba para descartarlo antes de leer su cifra.

## 4 — DoD y dueños

- **backend** (`urgente_REVERSIONLATENTE`): confirmar que la `web.py` que vale es la de `main`, y trabajar ese
  archivo desde un worktree sincronizado, nunca desde el compartido.
- **planificación** (`pedido_REVERSIONLATENTE`): (a) decidir qué pasa con el working tree compartido — **no es
  mi llamada**, y no propongo un `checkout` masivo: hay 7 commits de frontend2 y 6 archivos respaldados; (b)
  corregir la línea del índice *«~100 archivos editados a mano · lo escrito ahí no llega a main»*, que **invierte
  la dirección** y empuja al gesto peligroso. Propuesta de reemplazo, mismo largo, en el `pedido_`. El índice
  está a **1 línea** del techo (23.793/24.000 bytes), así que tiene que entrar **dentro** de la línea existente.

## 5 — Lo que NO medí, explícito

- **No toqué el working tree compartido** (canon 9: ni `checkout`, ni `reset`, ni `stash`, ni `clean`), así que
  **no sé** si alguien está trabajando esos archivos ahora mismo. El `mtime` de hoy en `web.py` sugiere que sí.
- **No clasifiqué los 15 uno por uno.** Medí el signo de 10 y leí el contenido de **uno** (`web.py`, por ser
  código de producto y del fix de ayer). Los otros 5 y el contenido de los 9 restantes quedan sin leer: si
  planificación quiere el inventario completo, el script que lo hace compara por blob contra las 60 refs y está
  en el scratchpad de esta sesión — **no lo versioné en `scripts/`** porque es de planificación y porque un
  instrumento más no es lo que el operador pidió (el foco es la beta).
- **No verifiqué si los 6 archivos «respaldados» lo están en una rama VIVA** o en una ya mergeada y abandonada.
  Para el riesgo que reporto no cambia nada; para decidir qué se descarta, sí.

## 6 — Ampliación del mismo día: **son DOS archivos pre-fix, no uno — y el segundo me salvó hoy**

El §5 declaraba que de los 15 había leído el contenido de **uno**. Leí los otros cuatro que son código o
instrumento, y el hallazgo se amplía en los dos sentidos.

### 6.1 `scripts/graph-sync.sh` — el disco tiene la versión que roba el lock a un sync VIVO

| | disco (`+4/−127`) | `origin/main` |
|---|---|---|
| criterio para tomar un lock ajeno | `:165` `if [ "$edad" -gt "$LOCK_MAX_AGE" ]` — **la edad sola** | `:274-275` `if [ -n "$pid_lock" ] && kill -0 "$pid_lock"` → el lock de un **dueño vivo** vale, y sólo cede al techo duro de `LOCK_HARD_MAX=14400` |
| techos | **uno** (600 s) | **dos** (600 s dueño muerto · 4 h pid reciclado) |

Es **exactamente** el bug que el comentario de main documenta: *«con la regla vieja, la siguiente sesión le roba
el lock a un sync VIVO y las dos reescriben el mismo árbol y el mismo checkpoint, que es justamente lo que el
lock evita»*.

**Y lo midió este turno, por accidente:** mis dos pushes de hoy encontraron el lock tomado por el pid `1648592`
**vivo**, con **540 s** de edad, y la versión de main **cedió** las dos veces (`salgo sin tocar el árbol`). Los
dos pushes estuvieron a ~7 minutos uno del otro. Con la versión del disco, el segundo habría cruzado los 600 s
**contra un sync vivo** y se lo habría robado. **El fix que `main` tiene evitó hoy el incidente que su propio
comentario narra**, y el disco tiene la versión que lo causaba. Dueño: **planificación** (`scripts/` es suyo).

### 6.2 Y la corrección a mi corrección: **`PantallaFacturacion.tsx` SÍ es trabajo local genuino**

`+1/−0` — un agregado puro, cero borrados: un `// eslint-disable-next-line react-hooks/exhaustive-deps` con su
justificación. Ahí mi **primera** lectura («trabajo que sólo vive en ese disco») era la correcta.

> **La versión definitiva del molde, entonces, no es ninguna de mis dos narrativas globales.** No es «todo es
> trabajo en riesgo» ni «todo es atraso»: **el signo lo decide archivo por archivo, y los dos casos conviven en
> el mismo directorio.** `+21/−122` es atraso con código retirado adentro; `+1/−0` es trabajo sin respaldo. Una
> cifra agregada sobre los 15 —la que yo publiqué primero— **no puede ser correcta para ninguno de los dos**,
> porque promedia dos fenómenos con acciones opuestas. Es la misma trampa que
> `[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]]`: el total se forma
> con signos contrarios y deja de significar algo.

### 6.3 Los otros dos, sin veredicto fuerte

`apps/copiloto/tool_catalog.py` (`+7/−23`) trae manejo de Instagram y un `except MercadoPagoError` — el signo
dice atraso, pero **no confirmé** contra qué fix. `scripts/ci/testid-paridad-excepciones.json` (`+10/−71`) trae
excepciones fechadas 2026-09-22; el trinquete del §1 del barrido las rechazaría solo si ya no son drift, así que
ese archivo **tiene quien lo audite** y no necesita mi veredicto.
