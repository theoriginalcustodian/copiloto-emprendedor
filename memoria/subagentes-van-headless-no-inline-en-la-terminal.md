---
name: subagentes-van-headless-no-inline-en-la-terminal
description: Headless `claude -p` AUTORIZADO con techo de 3 por sesión y contexto cero (operador, 02-11-2026); el `Agent` tool inline sigue prohibido. El veto de octubre era a N sin techo, no al mecanismo
metadata:
  type: feedback
---

**2026-07-25, instrucción directa del operador:** *«los subagentes toman control de la sesión y
empiezan a escribir en la terminal esta, y la verdad es que interfieren en el desarrollo… para todo
lo que sea sub agentes usaremos headless, no inline.»*

**Qué cambia:** el `Agent` tool (aun con `run_in_background: true`) corre **dentro de esta misma
sesión/terminal** — su actividad se renderiza inline y compite visualmente con el trabajo del
operador en esa misma ventana. La alternativa es despachar como **proceso headless separado**
(`claude -p`, sesión fresca aislada — ver [[claude-code-headless-capabilities]] para flags y
verificación empírica del CLI), que no toca la terminal interactiva.

**Por qué importa acá en particular:** este repo ya vive en régimen de **3 sesiones paralelas**
sobre el mismo checkout (`coordinacion-tres-sesiones-buzon`) — el operador mira/usa la terminal de
esta sesión mientras trabaja, y el ruido de sub-agentes inline es justo el tipo de fricción que ese
régimen ya intenta minimizar.

**⚠️ CORRECCIÓN 2026-07-25 — mi primera versión de esta entrada afirmaba "tarifa API aparte" como
freno. Es FALSO en el caso general, corregido por el operador y reverificado empíricamente:**

```
$ echo $ANTHROPIC_API_KEY          → (vacío, no seteada)
$ claude auth status
{ "loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty",
  "subscriptionType": "max" }
$ claude --help | grep -A6 -- --bare
--bare   Minimal mode: ... Anthropic auth is strictly ANTHROPIC_API_KEY or
         apiKeyHelper via --settings (OAuth and keychain are NEVER read)...
```

**`claude -p` headless usa la MISMA auth OAuth/Max de esta sesión por default.** Sólo `--bare` fuerza
API-key-only — y nada de lo que se especifica acá usa `--bare`. La entrada vieja
([[claude-code-headless-capabilities]]) midió tarifa API en un contexto distinto: el arquitecto
headless de la fábrica `unreal-copilot`, que **elegía API key a propósito** para aislar costo de un
pipeline autónomo — una decisión de diseño de ESE sistema, no una propiedad inherente de `-p`.
Confundir "esa fábrica usa API key" con "headless cuesta API key" fue el error. Corregido: sin freno
de costo conocido para este caso.

**Sin verificar todavía (no asumir en ninguna dirección):** si el consumo de `claude -p` bajo OAuth
comparte el mismo pool de cuota semanal que la sesión interactiva, o es un balde aparte.

## Cómo aplicarlo — el comando concreto

Reemplaza `Agent(...)` por `Bash` con `run_in_background: true` (misma notificación async, sin
sleep-loop, sin renderizar inline):

```bash
claude -p "<prompt self-contenido, igual que a un Agent>" \
  --model haiku \                          # o sonnet/opus — misma regla de elección por tarea
  --output-format json \                   # parseable; --json-schema si necesitás schema forzado
  --allowedTools "Read,Grep,Glob" \         # el equivalente headless del glob exclusivo
  --permission-mode bypassPermissions \     # -p no tiene AskUserQuestion mid-flight — sin esto, cuelga
  --add-dir "<scope>" \
  > /path/al/output.json 2>&1
```

Mismo contrato que siempre: prompt self-contenido (no hereda el contexto del parent), scope
declarado (`--allowedTools`/`--add-dir` en vez de "glob exclusivo" en el prompt), output a archivo.

**Asentado en 4 lugares** (instrucción del operador: *«rotundamente inevitable ejecutarlo en todos
los repositorios»*) — detalle completo en [[gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea]]:
`pretooluse_validate_agent.mjs` (regla 5, dispara SIEMPRE, no condicional) · `HARNESS.md` §1.3 (smoke
7/7) · `CLAUDE.md` global §"Sub-agentes van HEADLESS, no inline" (el `Agent` tool pasa de default a
excepción documentada — interactividad mid-flight, `Workflow` tool, o calibrar un prompt nuevo) ·
`ejecutar-con-eficiencia.md` Pilar 0 (no Pilar 2 — es el canal que reemplaza a 1-5, no uno más de la
lista).


---

## 🔁 Refuerzo 2026-10-13 — la orden se REVOCÓ: ahora es CERO sub-agentes, y el freno es la RAM LOCAL

**Textual del operador, el 2026-10-13:** *«no uses sub agentes headless porque agotan la memoria y se
cuelga vs code»*. Media hora antes había dicho *«no mandes 15 sub agentes...maximo 4 por favor»*.
**Vale la última: cero.** Ni `claude -p`, ni el `Agent` tool.

**Qué cambió respecto de todo lo de arriba.** Esta entrada resolvía *dónde* corre el sub-agente
(headless, fuera de la terminal) y descartaba el freno equivocado (la tarifa API, que no existe bajo
OAuth). Las dos cosas siguen siendo verdad — y **ninguna de las dos era el límite real**. El límite
es la **RAM de la máquina del operador**: 15 procesos `claude -p` en paralelo le cuelgan el VS Code
en el que viven las cuatro sesiones. Sacar al sub-agente de la terminal lo volvió invisible, no
gratis: lo que molestaba se mudó del renglón de la terminal al administrador de memoria, y por eso
la solución de julio parecía haber cerrado el tema.

**La forma del error, que es lo reutilizable:** medí el costo en el eje que la entrada ya nombraba
(tokens, tarifa, ruido visual) y declaré «sin freno conocido para este caso». El freno vivía en un
eje que nunca medí — y era el del hardware del operador, no el de la cuenta. Un recurso **local y
compartido** (RAM, disco, el device, el checkout) no aparece en ninguna factura y no tiene quien lo
reporte: el proceso que lo agota no falla, cuelga a los demás. Antes de escalar N procesos
paralelos, preguntá *«¿qué recurso local comparten, y quién avisa cuando se acaba?»* — si la
respuesta es «nadie», el límite no es el presupuesto, es el hardware, y hay que fijarlo a mano.

**Qué se hace en su lugar** — es lo que CANON 4 pone PRIMERO, antes de delegar:
- **Un script idempotente > N agentes.** Un barrido de lectura mecánica (recorrer una tabla, abrir
  cada `path:línea`, emitir un reporte por fila) es UN proceso, reproducible, y es **mejor
  evidencia** que el reporte de un agente, que es autoevaluación (CANON 7).
- Después, secuencial, agrupando por archivo para no releer el mismo módulo dos veces.

**Costo pagado:** tres contratos del buzón y un `dato_` de padrón salieron con la instrucción de
despachar headless; una sesión alcanzó a lanzar 15 procesos antes de la contraorden. Corregidos con
un reemplazo idempotente de la sección (`🤖 Despachá sub-agentes HEADLESS` → `🚫 CERO SUB-AGENTES`)
y control que distingue la **instrucción** de la **prohibición** — grepear `claude -p` daba falso
rojo porque la prohibición también lo nombra. Ver [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].

---

## ⚠️ REINSTAURADOS 2026-11-02, con la condición que faltaba

**Orden del operador:** *«le 3 sesiones lanzan headless… pero máximo 3 sub agentes por sesión»*,
con **contexto cero** (*«solo el mínimo del sistema»*) y **haiku para barrido, sonnet para
construir**. El «cero» del 13-10 queda **superado**: vale esta.

**Lo que hay que leer en el cambio, y es lo útil.** La prohibición del 13-10 no fue un veto al
mecanismo: fue un veto a **N sin techo**. Esta misma entrada cerraba diciendo *«el límite no es el
presupuesto, es el hardware, y hay que fijarlo a mano»* — y la orden de hoy es justamente eso
hecho: **3 por sesión**. Lo que cambió no es la tolerancia del operador: es que ahora hay un
número. Una prohibición que en realidad era «falta el parámetro» se lee como «el mecanismo está
mal», y así queda vetado algo que sólo necesitaba un límite.

**Las tres condiciones son parte de la autorización, no recomendaciones:**

1. **El techo lo cuenta el LANZADOR, no la disciplina.** Cuenta procesos vivos y **encola**. Con 3
   sesiones son 3×3 = 9 en el peor caso, y un techo que hay que acordarse de respetar es cómo
   volvemos al 13-10: lo mecánico no se delega a la disciplina
   ([[buzon-se-ordena-por-janitor-no-por-disciplina]]).
2. **Contexto cero: el prompt lleva PATHS, nunca «explorá».** Un headless al que se le pide
   averiguar cómo funciona algo gasta su presupuesto redescubriendo el repo y devuelve prosa
   ([[sesion-con-modelo-caro-se-le-entrega-el-inventario-hecho]]).
3. **Control positivo en el mismo lanzador.** Un prompt no autocontenido devuelve **basura con exit
   0**. El nivel de delegación es un instrumento nuevo, y un instrumento sin control positivo no se
   sabe si mide ([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]]).

**Y el orden que manda por encima:** *determinista antes que LLM* (regla global 8). El headless
entra para lo que el código **no puede** juzgar. Un script idempotente sigue siendo mejor evidencia
que el reporte de un agente, que es autoevaluación (CANON 7). Caso raíz del 26-10: ~1090 juicios
innecesarios = más del 20 % de la cuota semanal.

**Qué sigue prohibido:** el `Agent` tool **inline** (el motivo de julio no cambió: escribe en la
terminal del operador), cualquier headless que toque el **device** — el teléfono tiene un dueño
único y un proceso aislado no puede sostener ese candado —, y cualquiera que escriba en `main` o
marque una ficha: la evidencia la aporta la sesión, que es quien responde por ella.

**Dónde está bajado:**
`docs/copiloto-emprendedor/2026-11-02-COORDINACION-sprint-correcciones-tres-sesiones.md` §5.
