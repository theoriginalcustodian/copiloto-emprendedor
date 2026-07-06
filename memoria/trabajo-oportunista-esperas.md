---
name: trabajo-oportunista-esperas
description: "Durante esperas asíncronas (bg task, comando largo), buscar PROACTIVAMENTE y adelantar trabajo SAFE — de-risking/recon, nunca decidir/implementar una fase no aprobada"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

El operador pidió (2026-06-21) que durante los **intervalos ociosos de espera asíncrona** (workflow/sub-agente en background, comando largo, batch) yo **busque proactivamente** —sin que él lo pida cada vez— las tareas que se pueden adelantar, en vez de quedar ocioso. Es **latency hiding del loop de agente**: ejecución oportunista para no desperdiciar tiempo de pared.

**Why:** es **spike-first aplicado al tiempo muerto** — la espera se usa para mover supuestos del mapa al territorio, así cuando el resultado pendiente llega, la fase siguiente sale de evidencia y no de hipótesis. Caso de oro (el ejemplo del propio operador): mientras un workflow de planificación corría en bg, el agente adelantó **7 spikes de de-risking** (`claude -p --model` rutea bajo Max, hypothesis en sandbox `--network none`, deps bakeadas, fakes loopback, layout de paquete, vector conftest-de-IA + su fix) — validó supuestos críticos del plan **sin implementar ninguna palanca antes de la aprobación**. Eso es el patrón correcto.

**El filtro de seguridad (las 3 condiciones — TODAS):** solo es adelantable el trabajo que sea (a) de **valor independiente del resultado pendiente** (vale aunque ese resultado cambie), (b) **no-conflictivo** (read-only o write de scope aislado/desechable que NO toca lo que el bg task producirá), (c) **que no consuma una decisión no tomada**. Prioridad: **de-risking (spikes) > recon read-only > preparación reversible**.

**Blindaje de fases (la tensión clave, reconciliada con [[trabajo-por-fases-no-anticipar]]):** "proactivo" NO puede atropellar la disciplina de "una fase por vez". El trabajo oportunista **nunca adelanta la decisión ni la implementación de una fase no aprobada** — de-riskear/preparar el territorio de la fase siguiente SÍ; ejecutar la fase siguiente NO. La distinción: *spikear los supuestos de una fase ≠ ejecutar la fase*. Si lo más valioso que podría adelantar requiere una decisión del operador o implementa una fase sin aprobar → **señalarlo, no hacerlo**. Proactivo hacia el territorio, disciplinado hacia las fases.

**How to apply:** al lanzar un bg task (o entrar en cualquier espera async) → enumerar mentalmente el trabajo safe disponible (de-risking > recon > prep) → adelantar lo que pase el filtro (a/b/c + blindaje de fases) → reaccionar a la notificación automática del runtime (nunca `sleep`-loop). **Anti-patrón sutil:** inventar busy-work para parecer productivo — "sigo esperando, no hay nada safe que adelantar" es una respuesta legítima.

**Reflejado (2026-06-21):** doctrina global (sección "Meta-trabajo del agente" → subsección *"Trabajo oportunista durante esperas asíncronas"*) + esta memoria. **Skill** `/avanzar-mientras-espero` evaluada pero **pospuesta** (decisión del operador). **Sin hook**: la espera ociosa ocurre a mitad de turno; `UserPromptSubmit` dispara sobre el prompt del operador, no sobre el ocio del agente → mecanismo equivocado. Relacionado: [[trabajo-por-fases-no-anticipar]] (la tensión y su resolución), [[spike-first-central-proyecto]] (el caso de oro del trabajo oportunista).
