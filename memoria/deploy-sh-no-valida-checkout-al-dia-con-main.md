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
