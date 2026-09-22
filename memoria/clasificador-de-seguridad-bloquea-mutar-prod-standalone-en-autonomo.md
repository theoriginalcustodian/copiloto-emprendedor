---
name: clasificador-de-seguridad-bloquea-mutar-prod-standalone-en-autonomo
description: "En sesión 100% autónoma (sin operador), el clasificador de seguridad del harness bloquea acciones que mutan/exponen producción cuando llegan como script standalone aislado, aunque el MISMO comando ya corrió sin bloqueo dentro de un pipeline reconocido (deploy.sh)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f54fd09-ae88-47d9-812e-a0bb31aae0af
  modified: 2026-08-12T21:47:01.883Z
---

Patrón confirmado 2 veces el mismo día (2026-08-12), misma sesión backend, dos clases de acción
distintas — no es una casualidad de una herramienta puntual:

1. **Lectura**: un sub-agente que iba a leer Temporal workflow history real (`docker exec
   temporal-admin-tools temporal workflow show ...`, con `arguments` reales de cliente — mails,
   eventos de calendario, filas de planilla) para el spike de idem_key de Composio (`ADR-002`).
2. **Escritura**: `sudo systemctl restart uc-copiloto-worker.service` en el VPS de prod, disparado
   por `scripts/e2e_g6_durabilidad_worker_restart.py` (test de durabilidad contratado, e2e §G6) —
   bloqueado **2 veces**, la 2ª con `description` explícita del propósito legítimo.

En ambos casos: el MISMO comando/dato ya había pasado sin bloqueo cuando estaba embebido en un
pipeline reconocido (`deploy/copiloto/deploy.sh` reinicia ese mismo servicio varias veces por
sesión sin fricción). Lo que discrimina el clasificador no parece ser el comando en sí, sino el
**contexto de standalone/experimental** ("veamos qué pasa si interrumpo esto ahora") vs. **el mismo
efecto como side-effect de un flujo ya establecido y revisado**.

**Por qué rinde.** Confirma que el guardarraíl no es ruido de una sola herramienta: es una postura
consistente del harness ante mutación/exposición de producción sin operador presente que la
confirme en el momento, independientemente de que exista autorización PERMANENTE de deploy en
`CLAUDE.md` §3 regla 8 — esa autorización cubre "un PR propio en verde se mergea/despliega", no
"un experimento ad-hoc que golpea el mismo botón fuera de ese flujo".

**Cómo aplicar.** Ante un bloqueo así: (1) NO buscar un canal alternativo para el mismo efecto (SSH
directo, sub-agente, reformular el script) — el propio mensaje del clasificador lo pide explícito y
es la misma disciplina de [[el-vigilante-muere-con-la-sesion-y-nadie-lo-vigila-a-el]] aplicada a
permisos: si el guardarraíl es real, se documenta, no se esquiva por otra puerta. (2) Documentar el
bloqueo con honestidad en el entregable (ADR, `avance_`), sin fingir que el ítem quedó "rojo" —
está *no ejecutado*, que es una categoría distinta de *ejecutado y falló*. (3) Buscar si el mismo
efecto se puede montar sobre un flujo YA autorizado (ej. enganchar el test de durabilidad al
próximo restart real de un deploy, en vez de disparar uno nuevo) antes de pedir intervención humana
puntual. (4) Si no hay flujo autorizado disponible, pedir explícitamente que alguien con sesión
interactiva corra la acción puntual — no es tarea del operador "aprobar en general", es ejecutar
un comando específico una vez.
