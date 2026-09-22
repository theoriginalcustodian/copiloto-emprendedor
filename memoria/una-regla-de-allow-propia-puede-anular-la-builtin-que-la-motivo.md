---
name: una-regla-de-allow-propia-puede-anular-la-builtin-que-la-motivo
description: "Al escribir una excepción en autoMode.allow para desbloquear un patrón legítimo, la redacción laxa termina bendiciendo exactamente el caso que la regla built-in existía para prevenir — `claude auto-mode critique` lo caza antes de que quede vivo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f0352eb8-852a-422c-82c3-a0a38ff31be9
  modified: 2026-08-13T01:44:32.479Z
---

Pasó el 2026-08-12, escribiendo el bloque `autoMode` que resolvía el double-block headless
([[headless-gate-exige-claude-p-pero-el-clasificador-lo-bloquea-igual]]).

Redacté una excepción en `autoMode.allow` para que lanzar `claude -p` como sub-agente dejara de
chocar con la regla built-in `Create Unsafe Agents`. La escribí así: *"lanzar `claude -p` … es el
patrón de trabajo normal de este operador y no es Create Unsafe Agents ni Auto-Mode Bypass"*.

`claude auto-mode critique` la devolvió con el diagnóstico exacto: **la regla no excluía los flags
que disparan el bloqueo** (`--dangerously-skip-permissions`, `--permission-mode bypassPermissions`,
`--no-sandbox`, `--allowedTools` con comodines), así que un clasificador podía leerla como
*clearing exactly the case the default rule exists for*. Yo había abierto el agujero completo
tratando de destapar un caso legítimo. Otros cinco hallazgos sobre la misma regla: el framing
"solo lectura" no se hacía cumplir, no cubría invocaciones ofuscadas ni delegación recursiva, y
—el peor— no excluía el caso de tunelear por delegación una acción que la sesión ya tenía
bloqueada, que es literalmente el brazo (ii) de `Auto-Mode Bypass`.

**Por qué rinde.** Una excepción en prosa no se comporta como un patrón de tool: el clasificador
la lee como lenguaje natural y generaliza. Enumerar los vehículos del riesgo ("no lleva estos 4
flags") produce una **plantilla de bypass**, no un límite: alcanza con llegar por un quinto vehículo
(`--settings`, `--mcp-config`, una env var en la misma línea). La forma correcta es positiva y
cerrada — "aplica sólo si la invocación no altera la superficie de permisos de ninguna manera;
estos flags son ejemplos, no la lista".

**Cómo aplicar.** Después de tocar `autoMode.allow`/`soft_deny`/`hard_deny`, correr SIEMPRE
`claude auto-mode critique` antes de darlo por hecho, y `claude auto-mode config` para confirmar
que `"$defaults"` se expandió y los built-ins siguen ahí (sin `"$defaults"` en el array se
descartan TODOS los built-ins de esa lista — incluida la regla de exfiltración en `hard_deny`).
El crítico también señala el error inverso, y vale: declarar algo en `environment` **no** levanta
un soft block — los slots de contexto no tienen reglas propias que los targeteen. Si querés
habilitar una acción, va en `allow`; si la ponés en `environment`, no hace nada y creés que sí.
