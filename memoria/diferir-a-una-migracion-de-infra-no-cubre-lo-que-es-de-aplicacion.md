---
name: diferir-a-una-migracion-de-infra-no-cubre-lo-que-es-de-aplicacion
description: Diferir decisiones a una migracion de infra futura se traga las que la migracion no toca; hay que clasificar item por item por QUE CAPA los resuelve.
metadata:
  type: project
---

**Decision del operador, 2026-11-05:** post-beta, Odobi pasa a **4 VPS dedicados** — app/frontend,
Postgres, Graphity y Temporal, exclusivos de la app. Hasta entonces **se funciona con lo que hay**, y
las decisiones de seguridad que dependen de esa infra se **difieren a la migracion**, no se pagan
ahora. Eso es correcto y es su llamada.

**El riesgo que esa decision introduce, y por el que existe esta entrada:** «se resuelve en la
migracion» es un destino que **absorbe items que la migracion no toca**. Una vez que la frase circula,
nadie vuelve a preguntar por cual capa se resolvia cada uno, y los de **aplicacion** quedan diferidos
a un evento que no los va a tocar — quedan sin dueño y sin disparador, que es el modo de falla de
[[un-disparador-cumplido-no-avisa-a-nadie]] con una excusa encima.

**Lo que hay que hacer, entonces: clasificar item por item por la capa que lo resuelve.** De la ronda
de hardening del 2026-11-04/05 (`docs/copiloto-emprendedor/Auditorias/Seguridad/DECISIONES-OPERADOR.md`):

- **La migracion SI los resuelve** (son de infra, y un VPS dedicado los cambia de raiz): TLS y
  `log_connections` del Postgres —hoy host compartido, fuera de nuestro alcance—, correr los
  servicios como usuario no-root y `ProtectHome` (se obtienen gratis provisionando limpio), y
  repetir el nmap desde otra red (hay que remedir el perimetro nuevo igual).
- **La migracion NO los resuelve, son de APLICACION o de terceros**: borrado y exportacion de datos
  por tenant (codigo, no infra: migrar la DB no lo escribe), signup abierto de GoTrue sin MFA ni
  rate-limit (config de la app), el bump de `expo-router` (mobile, nada que ver con el VPS), los
  roles con `BYPASSRLS` (viajan **con** la base: la migracion los lleva, no los arregla), y los
  `.env` de las apps inactivas con tokens vivos de terceros — **esos tokens siguen validos en el
  proveedor pase lo que pase con el VPS; la unica accion que los apaga es revocarlos**.
- **Caso mixto, y el mas facil de perder**: la copia off-site de backups. Provisionar 4 VPS nuevos
  es la **oportunidad** de hacerlo bien de entrada, pero no la trae puesta: un VPS dedicado sin
  off-site tiene exactamente el mismo agujero que el compartido.

**Como se escribe un diferimiento asi para que no se pierda:** estado `DIFERIDO` con el disparador
nombrado («migracion a los 4 VPS dedicados, post-beta») **solo** en los de infra; los de aplicacion
quedan como fichas propias con su dueño, aunque se prioricen despues. Un diferimiento sin disparador
nombrable es parálisis ([[una-espera-sin-disparador-nombrable-es-paralisis]]), y uno con el
disparador **equivocado** es peor: parece atendido.
