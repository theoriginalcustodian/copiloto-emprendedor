---
name: ""
metadata: 
  node_type: memory
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

**"No codificar la esperanza"** —actuar siempre con información verificada empíricamente, nunca con un supuesto razonado tratado como hecho— es la **regla raíz** del CLAUDE.md global (regla de oro #1 + toda la sección *"Validación empírica (regla principal)"*). El operador la elevó explícitamente (2026-06-21) a **tronco** de la constitución: *la prueba vale, la aserción no*. No es un cuarto principio paralelo a [[spike-first-central-proyecto]] y [[cero-deuda-no-gestionada]] — es el **padre** del que ambos son instancias.

**Why:** todas las demás reglas son aplicaciones del mismo principio en distintos momentos del ciclo. Si el **tronco** es débil, las **ramas** también lo son — una afirmación no verificada en la base se amplifica en todo lo que se apoya encima (composición), y en una fábrica **autónoma y recursiva** eso ocurre sin un humano por paso. Codificar la esperanza no es un descuido de prolijidad: es un **error de categoría** — tratar una hipótesis (el mapa) como si fuera prueba (el territorio). El árbol:

| Rama | Aplica el tronco… | Momento |
|---|---|---|
| **6 verificaciones** + V-EXT/V-INT/V-RES | al **afirmar alcance** ("todos los X" → grep + contar) | antes de proponer |
| **spike-first** | al validar el **supuesto del cimiento** | antes de construir |
| **primer ladrillo sólido** | al **apoyar trabajo** encima | durante |
| **cero deuda no-gestionada** | a no dejar **impago el atajo** | después de construir |
| **done verificable por test** + **no declarar listo sin evidencia** | al **cerrar** | al terminar |

**How to apply:** nunca afirmar alcance / estado / "funciona" / "está listo" sin **evidencia observable adjunta** — la autoevaluación del agente NO cuenta como verificación (regla de oro #5). Validar contra el repo/sistema real (V-INT/V-RES), contra la spec oficial de APIs externas (V-EXT), y medir antes de afirmar ("todos los X" → grep + contar N exacto). Si no se puede validar en sesión → marcar explícitamente `[ASSUMED_PENDING_VERIFY]` / `[REQUIRES_LIVE_VALIDATION]` y dejarlo como TODO, **no afirmar**. Frase canónica del global: *Medir antes de implementar. Reutilizar antes de crear. Activar por métricas, no por proyecciones. Documentar antes de proponer. Resolver de raíz, no parchear. Investigar antes de inventar.*

**Reflejado (2026-06-21):** receta DISTINTA a spike-first/cero-deuda (el operador lo decidió) — el tronco ya estaba exhaustivo en doctrina, así que NO se duplicó ni se creó hook (pospuesto). Alcance final: (1) **doctrina global** = retoque que articula que es el tronco y nombra sus ramas (cabecera de "Validación empírica"); (2) esta **memoria**; (3) **`CLAUDE.md` del repo** `unreal-copilot` = nota al cierre de la sección "Reglas no negociables" que ata las reglas 6/7/8/9 como ramas del tronco (aplicación al proyecto: nunca declarar "funciona/listo/verde" sin evidencia ejecutable del gate/VPS); (4) **`HARNESS.md` §8** = registro de la decisión NO-hook (audit trail). **ACTUALIZADO (2026-06-21, posterior): la decisión NO-hook se REVIRTIÓ ante evidencia empírica.** El operador reportó que, probando los desarrollos, seguía teniendo que recordar "actuá con información empírica / revisá la realidad antes de hacer nada" → la doctrina sola NO bastaba. Se construyó el hook **`empirical_check_suggester.mjs`** (5º hook de la familia; 7 triggers hot-reload, smoke 5/5) que PREVIENE el fallo: disparado por órdenes de acción/corrección sobre estado existente + afirmaciones/preguntas de estado/alcance, recuerda verificar la realidad ACTUAL (V-INT/V-RES) antes de actuar/afirmar. Trigger derivado de la **tabla "Triggers de verificación de alcance" del global** (el operador no tenía ejemplos → caracterización ya destilada, no inventada; v1 calibrable). **Lección:** evidencia del operador > teoría del agente — el propio tronco aplicado a su propia implementación (mi argumento "no-hook" era teórico; los datos lo refutaron). Relacionado: [[spike-first-central-proyecto]], [[cero-deuda-no-gestionada]].
