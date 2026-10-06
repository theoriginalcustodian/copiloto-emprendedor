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
