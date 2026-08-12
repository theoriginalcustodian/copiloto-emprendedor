---
name: barrer-llamadores-incluye-los-instrumentos-de-verificacion
description: "Al cambiar el contrato de entrada de un endpoint, el barrido de llamadores incluye los smokes y tests que lo ejercitan, no sólo el código de prod"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T15:38:43.166Z
---

Cuando un fix cambia el **contrato de entrada** de un endpoint (agregar un token obligatorio, un campo
requerido, un gate fail-closed), el barrido de llamadores tiene que incluir **los instrumentos de
verificación** — smokes de prod, scripts e2e, tests — y no sólo el código de producción. Y la
actualización va **en el mismo PR que el fix**, nunca después.

**Why:** el 2026-08-12, cerrando C4.1 (poner `/auth/signup` detrás de un invite-token fail-closed), el
barrido `git grep "auth/signup"` mostró que `deploy/copiloto/smoke_beta_e2e.py:56` postea sólo
`{email, password}`. Como los pasos 2-11 del smoke dependen del tenant que crea el paso 1, el fix
habría tumbado **el smoke entero**, no un check. Dos consecuencias, las dos malas: se pierde tiempo
diagnosticando un fallo autoinfligido, o alguien lee "C4.1 rompió prod" y revierte un fix de seguridad
correcto. La peor es la tercera: **ese smoke era el control positivo del propio fix** — el DoD exigía
probar que blindar el registro no rompía el acceso, y el instrumento para probarlo era justamente el
que el fix iba a romper.

**How to apply:** ante un cambio de contrato de entrada, correr `git grep <ruta/símbolo>` sobre
`origin/main` **incluyendo `deploy/`, `scripts/` y `tests/`**, y clasificar cada llamador en
*producción* / *instrumento*. Los instrumentos se actualizan en el mismo PR, y es la oportunidad barata
de agregarles el **caso hostil** (llamada sin el token nuevo → espera denegación) corriendo contra el
entorno real, no sólo en CI. Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[no-romper-no-es-arreglar]]
