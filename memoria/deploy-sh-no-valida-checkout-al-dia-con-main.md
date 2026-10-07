> 🔻 **2026-10-06 — VENCIDA EN SU TITULAR: el guard EXISTE desde `BL-B7`.** Medido en
> `origin/main`, no recordado. `deploy/copiloto/deploy.sh:37` corre `guard_deploy` (HEAD==origin/main +
> árbol limpio + candado único) y `:56-68` **aborta por drift** de `apps/copiloto` + `motor`, con
> escape hatch `UC_SKIP_DRIFT_CHECK=1` para el caso legítimo. El propio comentario del script **cita
> este archivo** como el incidente que lo motivó. **El relato de abajo sigue siendo cierto como
> historia; el titular «sube el disco tal cual» ya NO describe el presente.**
>
> ⚖️ **Lo que SÍ queda, y es el dato útil:** el gate ancla **2 de 6 paths**. Los otros cuatro
> —`apps/copiloto-web`, `packages/core`, `deploy/worker`, `deploy/copiloto`— **no se verifican**, y el
> script es honesto por diseño: el manifiesto los declara con nombre (`paths_NO_verificados`) y cuenta
> los sucios (`archivos_sucios_en_paths_no_verificados`) en vez de sugerir que todo el árbol está
> anclado. **Declarado ≠ frenado:** un deploy con el front sucio pasa, y lo único que queda es un
> número en un NDJSON que alguien tiene que leer después.
>
> 🧪 **Control positivo del guard, corrido hoy contra el checkout compartido** (read-only, sin
> desplegar): `HEAD=4a9f4f7c` vs `origin/main=f406b198` ⇒ `guard_deploy` aborta; y el gate de drift
> mide **2538 líneas** ⇒ aborta otra vez. **Aborta dos veces**, así que el riesgo de producto del
> checkout sucio está neutralizado y lo que queda de `WIPCOMPART` es cosmético, no un deploy malo
> esperando a pasar.
>
> 📘 **La lección meta, que es la que se repite:** este archivo me hizo arrancar un contrato para
> pedir un guard **que ya existía**. Una entrada de memoria afirma el presente en el título y el pasado
> en el cuerpo, y el título es lo único que viaja al índice — así que una memoria que se arregló
> **miente** hasta que alguien le edita el titular. Antes de diseñar contra una memoria: `grep` el
> mecanismo en el código. → [[el-contrato-que-manda-a-hacer-algo-ya-hecho]]

---
name: deploy-sh-no-valida-checkout-al-dia-con-main
description: deploy/copiloto/deploy.sh sube apps/copiloto tal cual está en disco, sin chequear si el checkout está al día con main — un checkout viejo regresiona código ya arreglado EN SILENCIO
metadata:
  type: project
---

**Incidente real (2026-07-23):** corrí `deploy.sh` desde un checkout basado en una rama ~95 commits
atrás de `main` (para subir un fix puntual de un solo archivo). El script sube `apps/copiloto/` completo
tal cual está en disco — no valida contra qué rama está parado el working tree. Efecto: `inteligencia_web.py`
(archivo nuevo en `main`, ausente en mi rama vieja) desapareció del backend vivo — `/inteligencia/*`
cayó al catch-all del SPA (200+HTML, indistinguible de "sin datos" a simple vista); `actividad_web.py`
volvió a una versión vieja — `/actividad` resucitó un **501 "entradas firmadas no implementadas"** que
el propio código de `web.py` documentaba como regresión ya resuelta el 2026-07-22.

**Por qué pasa sin ningún error:** no hay conflicto de git, no hay excepción, el deploy reporta éxito y
el smoke test (`/healthz`, `curl /`) pasa igual — el smoke no ejercita las rutas específicas que
regresionaron. Mismo patrón que [[glass-apilado-empujar-una-vez]] y el comentario de `web.py` sobre el
stub de actividad: código verde, front-door tapado, nadie se entera hasta que alguien pega justo a esa
ruta.

**Cómo se encontró:** corriendo un E2E de datos que llegó hasta `/actividad`, un 501 que contradecía un
comentario del propio código ("esto ya se arregló") disparó la sospecha — `git diff <commit-desplegado>
origin/main -- apps/copiloto/` confirmó el archivo faltante.

**How to apply:** ANTES de correr `deploy/copiloto/deploy.sh`, verificar que el checkout está al día:
`git diff origin/main -- apps/copiloto/ motor/ | wc -l` debe dar `0` (o el checkout tiene que estar
rebaseado/mergeado contra `origin/main`, no solo tener "mi commit puntual" encima de una base vieja). Un
fix de un solo archivo no exime de este chequeo — el script sube el directorio ENTERO, no un diff.

**Mitigación futura, no implementada todavía (deuda visible):** `deploy.sh` podría abortar si detecta
`git diff origin/main -- apps/copiloto/ motor/` no vacío, o al menos loguearlo como warning. Sin
propietario ni fecha asignada — queda como candidato, no como TODO comprometido.

---

**Refuerzo (2026-10-06): y el mismo árbol atrasado envenena las CITAS, no sólo los deploys — un diff
dice CUÁNTO difieren dos árboles y nunca CUÁL es el viejo.** Backend me refutó un hallazgo entero por
esto, y tenía razón.

**El caso.** Abrí `apps/copiloto/web.py` del checkout compartido, leí `first_seller_user_id()` en `:1045`
y `:1055`, vi el otro criterio (`_mp_connected`) en el mismo archivo y reporté *«`/me` y `/catalog`
responden `mp_connected` con dos criterios distintos»*. En `origin/main` hay **uno**: `_estado_mp`
(`:641`) → `_mp_connected` (`:648`) → `/me` (`:670`) y `/catalog` (`:1203`). Las líneas que cité son el
código **pre-#850 del disco**, y `main` incluso tiene un docstring en `:643` explicando por qué NO usar
ese criterio. El hallazgo no describía un defecto del producto: describía un **árbol atrasado**.

**Por qué no da síntoma.** El archivo abre, las líneas existen, el código es sintácticamente real y la
contradicción que señalás es verdadera **dentro de ese archivo**. Nada avisa que estás leyendo el pasado.
Y medir el diff no alcanza: `+21/−122` dice que difieren, no quién quedó atrás — ese mismo día la marca
`[WIP-LOCAL]` del plan de cierre empujaba a **commitear** justo los dos archivos cuyo disco era el viejo.

**How to apply:** (1) **toda cita de código en un hallazgo sale de `git show origin/main:<path>`**, nunca
del archivo en disco — es una línea más y elimina la clase entera de error. (2) Si igual citás del disco,
medí `git diff --numstat origin/main -- <path>` y **declará contra qué árbol** mediste. (3) Para decidir
la dirección, no mires el conteo: verificá un **símbolo** del fix en los dos lados (`git grep -c` en
`origin/main` vs disco) — si el símbolo nuevo está en `main` y no en el disco, el disco es el viejo. (4) El
caso peor no es el falso hallazgo: es commitear ese archivo «para limpiar el `git status`» y revertir un
fix mergeado.

---

**Refuerzo 2026-10-06 (auditoría) — el medidor del presupuesto mide el `MEMORY.md` **de la rama desde la que lo corrés**, y el techo se aplica a `main`.**

`scripts/medir-indice-memoria.py` resuelve su raíz con `RAIZ = Path(__file__).resolve().parents[1]` (`:35`),
así que mide el índice **del worktree que lo invoca**. Corrido desde `wt-aud-a3web`, parado en
`e4cbed6a` (una rama ya mergeada que el worktree no avanzó), reportó **23.985 / 24.000 · margen 15**. En
`origin/main` el mismo archivo pesa **23.943** → **margen 57**. El sesgo es de **42 bytes: casi tres veces el
margen que el propio medidor informa.**

**Y descarté la explicación fácil antes de escribir esto**, porque era la primera que se me ocurrió y era
falsa: en Windows el archivo está en CRLF y `wc -c` da 24.165, 180 bytes más — pero `Path.read_text()` abre en
modo texto y **normaliza los finales de línea**, así que el script no arrastra ese sesgo. El disco normalizado
a LF da 23.985 exactos, que es el número del blob de **su propia rama**. La causa es la **rama**, no el
formato: misma familia que esta entrada, otro mecanismo.

**Y el control que lo prueba sin interpretar nada — el mismo script, el mismo techo, dos worktrees:**

```
desde wt-aud-a3web      (rama e4cbed6a):  23985 / 24000
desde wt-aud-criterio3  (al día con main): 23943 / 24000
```

Es un **diferencial**: una sola corrida no distingue «el índice pesa 23.985» de «este worktree pesa 23.985»,
porque las dos salidas son idénticas. Dos corridas desde refs distintos lo separan en una línea.

**How to apply:** un medidor de un presupuesto que se aplica al **repo** tiene que medir el blob del ref, no
el árbol de trabajo: `git show origin/main:<path> | wc -c`. Si lo corrés desde un worktree, el número vale
para **esa rama** y hay que decirlo al citarlo. Y la regla de decisión: **si el sesgo posible es mayor que el
margen, el número no sirve para decidir** —acá el veredicto («no entra otra línea») coincidió igual, pero por
casualidad, porque el sesgo empujaba hacia el lado conservador. Un sesgo del otro signo habría autorizado una
línea que rompe el techo y trunca la cola del índice para todas las sesiones
([[el-indice-truncado-fabrica-duplicados]]).
