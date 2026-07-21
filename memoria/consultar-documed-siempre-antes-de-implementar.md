---
name: consultar-documed-siempre-antes-de-implementar
description: "Antes de implementar CUALQUIER cosa de UI/UX móvil en el copiloto, leer primero cómo lo resolvió documed-front — es la app canónica y ya funciona"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-21T12:53:47.382Z
---

**Regla dura del operador, repetida 3 veces en la misma sesión (2026-07-21):**
*"recuerda que documed ya tiene todo implementado — no intentes reinventar la rueda — consultá todo
ahí por favor"*.

`C:\Proyectos\Claude\Claude code\Agencia_IA_HyC\documed-front\apps\mobile` es la **app canónica de
UI/UX**. El copiloto debe verse igual, con sus particularidades de dominio. Antes de escribir una
línea de cáscara, gesto, animación, barra de sistema, scroll o card: **abrir el archivo equivalente
en documed y leerlo.**

**Why:** documed pagó estos errores en device y dejó el porqué escrito en sus docstrings. Cada vez
que en este repo se implementó "de cero" algo que documed ya tenía, se volvió a pagar el mismo
peaje. Ejemplos de esta sesión: la barra de navegación de Android se oculta con
`<NavigationBar hidden />` de `expo-navigation-bar` (documed `app/_layout.tsx:213`, con el caveat de
que v57 ya no expone `setBehaviorAsync` y requiere el módulo nativo → rebuild EAS); el doble render
del encabezado se mata con `SafeAreaProvider initialMetrics={initialWindowMetrics}`. Nada de eso se
deduce: está escrito allá.

**How to apply:**
1. Ante cualquier tarea de UI/gesto/animación/barra/scroll → `grep` el síntoma o el componente en
   `documed-front/apps/mobile/src` **ANTES** de diseñar. Sus docstrings explican el *por qué* y los
   fallos que ya ocurrieron.
2. Portar **adaptando al dominio**, no copiar ciego: el copiloto NO tiene el caso clínico (dictado
   largo, retención, huérfanos). Traer la maquinaria de un problema que no tenemos es el error
   espejo.
3. Lo que documed **NO** cubre y manda igual: orquestación durable con Temporal (el moat),
   aislamiento multitenant (regla 7) y el contrato `POST /chat` + polling `GET /reply`. Si algo de
   documed choca con eso, ganan las reglas de este repo.

Está también en `CLAUDE.md §3.ter` del proyecto para que cargue en toda sesión.

[[copiloto-mobile-first-cascara-glass]] · [[no-codificar-la-esperanza-principio-raiz]]
