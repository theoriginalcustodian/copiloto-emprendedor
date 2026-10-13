---
name: un-instrumento-compartido-intermitente-fabrica-una-excusa-lista
description: "Un gate compartido que flakea no cuesta tiempo: instala una explicación disponible que después lava regresiones reales. Se exige discriminar antes de atribuir"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T16:08:38.992Z
---

Cuando un **instrumento compartido** (el gate, el smoke, el CI) falla de forma intermitente, el daño
no es el tiempo perdido re-corriéndolo: es que **instala una explicación disponible**. Una vez que
"es el flake conocido" existe como frase, la próxima falla real se atribuye ahí por parecido y pasa
igual. Por eso una fila de deuda sobre un instrumento **no se pondera como una de producto**, aunque
el síntoma parezca menor.

**Why:** el 2026-08-12 frontend reportó un flake del job `mobile` que sólo aparecía dentro de
`gate.sh` completo — 2/2 fallas en la corrida completa contra 4/4 limpias aisladas, siempre
`Exceeded timeout of 5000 ms`, siempre en un test **distinto** del mismo describe de gestos. El
diagnóstico era correcto y la decisión de no abrir contrato sin repro determinística también. Lo que
faltaba era el impacto: `gate.sh` lo comparten las tres sesiones y el DoD de esa ronda hacía de *gate
6/6* el criterio de cierre de **cada** ítem. Un gate que falla completo y pasa aislado no es un gate,
es una moneda — y una moneda con excusa incorporada.

**How to apply:** (1) mientras la intermitencia siga abierta, **prohibido atribuir por parecido**: se
re-corre el job aislado — pasa aislado ⇒ es el flake, y **se anota la aparición** (la anotación es lo
que permite contarlas); falla aislado ⇒ es regresión propia. (2) La fila lleva dueño y disparador
binario, nunca "si vuelve a aparecer" a secas. (3) Elegir el experimento que **prueba la causa y
aplica el fix en el mismo movimiento** (subir el timeout y correr el gate completo) por sobre el que
sólo confirma la hipótesis (reproducir la contención afuera). (4) Ojo con el fondo: un umbral que
sólo aguanta con la máquina ociosa —acá 5000ms para un gesto *hold-and-wait*, con 10 worktrees y
pushes de 2+ min— estaba mal elegido desde el principio; subirlo no es tapar el flake.

**Segunda vuelta, 2026-09-22 — la excusa también tapa bugs del script propio.** La máquina estaba
de verdad saturada (10 worktrees, gates en fila, un Chromium por captura), así que «contención»
explicaba todo y era **verdad en general**. Con esa frase disponible, FE2 documentó por escrito que 5
intentos de capturar pres-hitl a 390 morían por carga; cuando volvió a mirar, la causa era un
*unhandled promise rejection* de su script más un testid equivocado — se arregló en minutos y la
captura salió. El mismo día el gate dio **dos clases distintas** de rojo (EPERM de la caché de jest y
un timeout de suite lenta), y distinguirlas es lo único que decide si un reintento es legítimo: por
eso el reintento que se codificó (`scripts/ci/jest-con-reintento-eperm.sh`) perdona sólo el EPERM y
**nunca** un timeout ni una aserción. **Regla que agrega esta vuelta:** antes de escribir «fue la
máquina» en un `dato_` o un `cierre_`, correr el instrumento con el error visible (sin `catch` mudo) y
leer el mensaje real — un entorno ruidoso de verdad es el mejor escondite de un bug propio.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] (aquél es el instrumento que **afirma
sin verificar**; éste es el que **verifica bien pero de a ratos**, que es peor de detectar porque a
veces tiene razón) · [[no-romper-no-es-arreglar]] ·
[[barrer-llamadores-incluye-los-instrumentos-de-verificacion]] ·
[[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]]

## Refuerzo 2026-10-06 — «hereda el rojo de main» supone determinismo: un flake NO se hereda, se re-tira

`main` estaba rojo por un test de mobile intermitente. Verifique con `git merge-base --is-ancestor` que
mis dos ramas descendian del commit malo y **escribi en dos cuerpos de PR y tres mensajes** que mis PR
«heredan» ese rojo y que no se podian mergear hasta que alguien arreglara main.

**Falso.** Los 6 checks de los dos PR salieron **SUCCESS**, con el job `mobile` corriendo de verdad (7
steps, ~100 s) sobre el mismo codigo sin el fix. Un fallo intermitente **no se hereda**: cada corrida
re-tira los dados. `--is-ancestor` prueba que el **codigo** esta, no que el **resultado** se repita.

El dano no fue el retraso: fue que **le pase a tres sesiones un bloqueo que no existia**, con la
autoridad de una medicion de git. Y el molde es el de esta entrada: el flake compartido fabrica una
explicacion lista -- «es el rojo de main» -- que se acepta sin mirar la corrida.

**La regla:** la herencia vale para lo **deterministico** (codigo, config, un test que falla siempre).
Para un fallo intermitente, la unica evidencia es **la corrida de tu propio SHA**; antes de eso, lo
honesto es «puede volver a salir», no «hereda». Y antes de aceptar un verde de un job historicamente
flaky: confirmá que **corrio** (pasos y duracion), no que figure.

## Refuerzo 2026-10-13 — el lock COMPARTIDO decide quién paga el gate, y el que llega segundo no paga nada

El `pre-push` de este repo sincroniza el grafo de código con `graph-sync.sh`, que se protege con un lock
`mkdir` compartido entre todos los worktrees. Medido hoy, en tres push seguidos:

| push | qué hizo el gate |
|---|---|
| respaldo, 1er intento | **tomó el lock y sincronizó de verdad** — ~11 min sin terminar |
| PR #1066 | `lock ocupado … salgo sin tocar el árbol` ⇒ **no pagó nada**, push OK |
| respaldo, 2do intento | `lock ocupado … salgo sin tocar el árbol` ⇒ **no pagó nada**, push OK |

**Dos conclusiones distintas, y las dos importan.**

1. **El push que tarda 12 minutos no está colgado.** Eso es lo que parece: el hook no imprime nada
   mientras `graph-sync` trabaja, y si además pipeás el push por `tail` **no ves ni una línea** hasta que
   termina ([[pipear-un-proceso-largo-por-tail-borra-la-evidencia-del-fallo]] — caí en mi propia trampa y
   diagnostiqué «cuelgue» sobre una pantalla vacía que era el buffer). Si una rama no puede esperar, el
   camino **diseñado** es que otro sync esté corriendo: el segundo push sale por contención. No hace falta
   `--no-verify` — que acá el clasificador deniega igual, y es correcto que lo haga porque el mismo hook
   corre el guard de secretos del repo público.
2. **El alcance del gate lo decide la CONCURRENCIA, no el commit.** Quién paga el sync es cuestión de
   quién llegó primero, y una sesión que siempre pushea mientras otra sincroniza **nunca** lo paga. No es
   fail-open —el marcador queda viejo y el próximo push reintenta, así que converge— pero sí significa que
   **«mi push pasó el pre-push» no dice nada sobre si el grafo se sincronizó.** Medido: con el marcador en
   `402dc39a` y `main` ya en `5a9a1b61`, dos push pasaron limpios sobre un grafo atrasado **dos merges**.

**Por qué el diseño igual está bien, y conviene no «arreglarlo» de más:** el hook ya distingue las tres
cosas en su propio texto —sincronizó / salió por contención / no completó— y **no declara ✅ por haber
llamado al script**, sino contra el marcador. Esa es exactamente la lección de
[[instrumentos-que-confirman-en-vez-de-verificar]] ya aplicada. Lo que falta no es un lock mejor: es no
leer «push verde» como «grafo al día». **El control es el marcador contra `origin/main`**, y es una línea:

```bash
cat "$BRIDGE/.bridge/last-synced-copiloto-emprendedor.sha"   # vs: git rev-parse origin/main
```

**Y el corolario operativo, que es lo que más cuesta:** CANON 2 dice que el grafo *sólo conoce lo
pusheado*. Hay que agregarle **y sólo lo sincronizado**: preguntarle al grafo por código de los últimos
dos merges puede dar vacío sin que eso signifique que no existe — [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]].
