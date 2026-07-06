---
name: apps-deploys-siempre-vps
description: "TODA la fábrica (apps, builds, pruebas, deploys) corre en el VPS, NUNCA en local. Local = solo proyectos personales del operador. NUNCA montar primero en local — directiva re-enfatizada 2026-06-26"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6784837f-d1f4-4fa0-ba69-0620e24abcf0
---

**La fábrica `unreal-copilot` funciona ENTERA en el VPS — apps, builds, runtime, pruebas, E2E y deploys, todo en el VPS, NUNCA en local.** **Lo local NO es para la fábrica:** la PC del operador es para sus **proyectos personales**, que son otra cosa. NO existe el paso intermedio "lo monto primero en local para ver / probar y después lo subo al VPS" — eso NO sirve y el operador lo rechazó explícitamente dos veces.

Directiva del operador, **re-enfatizada 2026-06-26** ("la fábrica es en el vps... lo local es para mis proyectos personales no de la fábrica... he visto que has intentado montar primero en local y eso no me sirve"). Primera vez 2026-06-25, tras detectar que levanté el frontend de `clinic-management` en `localhost:3000` y corrí los E2E localmente por conveniencia.

**Por qué:** el proyecto entero vive en el VPS (Temporal, Supabase fusion, Graphity, workers, sandbox). La PC no tiene esos servicios y no es donde se prueba/deploya. Montar/probar en local da una falsa señal (paridad no garantizada), gasta tiempo y rompe la doctrina operativa.

**Cómo aplicar (sin excepciones):**
- La PC es SOLO para **editar código fuente** (mis tools de filesystem). Flujo único: editar local → **sync al VPS** → build/run/test/E2E/deploy **en el VPS**. Igual que [[tests-se-corren-en-vps]] (pytest en el VPS, no en la PC).
- **Build de Next, runtime, contenedores Docker, E2E con Playwright, exposición por IP** → TODO en el VPS (con swap si el build necesita RAM; el CX33 tiene ~1.2Gi libres). No buildear imágenes en local "por si acaso".
- **NUNCA** levantar `next dev`/`next start`/servidores locales para que el operador pruebe — el operador prueba **en el VPS por IP** (Playwright MCP navega a la IP del VPS, sin instalar nada local).
- Red flag para mí mismo: si me encuentro por escribir `localhost:3000` / `next dev` / `docker build` en la PC / `playwright test` local → STOP, es el anti-patrón; va al VPS.

**Local vs VPS — quién es quién:**
- **VPS `unreal-copilot`** = la fábrica y TODO lo que construimos juntos en este proyecto.
- **PC del operador** = sus proyectos personales (otra cosa, fuera de este alcance).
- **No confundir con [[fabrica-local-containerizada]]** — esa es una réplica soberana de la infra de la fábrica en la PC que el operador armó para SUS desarrollos personales (proyecto aparte, su decisión). NO es donde corre la fábrica con la que trabajamos: esa es el VPS.

[[tests-se-corren-en-vps]] [[frontend-clinic-plantilla-base]] [[no-codificar-la-esperanza-principio-raiz]]
