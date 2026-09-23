---
name: dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una
description: gitleaks devuelve rc=1 tanto si encontró un secreto como si no pudo cargar su config. secretos-check.sh anuncia las dos cosas como «encontró posibles secretos», así que un escáner mal configurado se lee como una detección. Fail-closed pero mal diagnosticado, que es como se enseña a usar --no-verify.
metadata:
  type: feedback
---

# 🔀🏷️ Dos causas distintas comparten el código de salida, y el mensaje elige una

**LEER cuando un wrapper traduce el exit code de una herramienta externa a un mensaje para humanos** —
gates, linters, escáneres, healthchecks, deploys.

## Qué pasó (2026-09-22, test adversarial M-3 de la capa local de secretos)

El push abortó con:

```
[secretos] ❌ gitleaks encontró posibles secretos (ver arriba). Repo PÚBLICO: no lo pushees.
[pre-push] ❌ secretos-check falló: el push se aborta (repo PÚBLICO).
```

No había ningún secreto detectado. Dos líneas más arriba, en la misma salida:

```
FTL unable to load gitleaks config, err: open /c/gfw-src/_m3/aldia/.gitleaks.toml: The system cannot find the path specified.
```

gitleaks **ni escaneó**. No pudo cargar su config y murió. Medido con control positivo, los dos casos
son indistinguibles por código de salida:

| situación | rc |
|---|---|
| config inexistente | **1** |
| árbol limpio, config buena | 0 |

Y `secretos-check.sh` hace `case "$1" in 1) echo "gitleaks encontró posibles secretos"`. El `1` de
«no pude arrancar» entra por la misma rama que el `1` de «encontré algo».

## Por qué importa aunque sea fail-closed

El push **se aborta**, así que no hay fuga: en la dirección peligrosa el comportamiento es correcto.
El daño es de otro tipo y es real:

1. **Manda a buscar algo que no existe.** Quien lee «encontró posibles secretos» revisa su diff, no
   encuentra nada, y queda sin explicación.
2. **Enseña el bypass.** El hook documenta `git push --no-verify` para fallos transitorios. Un
   mensaje que miente sobre la causa empuja justo ahí — y `--no-verify` apaga **todo** el hook,
   incluido el escáner que sí funciona. Es [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]
   con un disfraz peor: no grita de más, **grita otra cosa**.
3. **Contamina cualquier medición que lo use.** Mis casos A y B «abortaron» y mi propia columna de
   atribución dijo `scanner:hallazgo`, porque grepeaba el mensaje del wrapper. Dos filas de un test
   adversarial quedaron invalidadas: no probaban detección, probaban una config rota.

## La causa de mi lado, que es la misma lección

Yo produje la config rota: exporté `MSYS_NO_PATHCONV=1` para que `git show '<sha>:<path>'` no
manglara paths, **el hook la heredó**, y gitleaks —binario Windows nativo— recibió `$ROOT` en formato
MSYS (`/c/gfw-src/...`). La variable que puse para no fabricar ceros fabricó un falso positivo.

Regla que sale de ahí: **una variable de entorno puesta para arreglar un comando se hereda a todos sus
hijos.** Si el hijo es un binario nativo y la variable gobierna la traducción de paths, la arreglaste
para uno y la rompiste para el otro. Va inline en el comando que la necesita, nunca exportada.

## How to apply

- **Al envolver una herramienta, no traduzcas el exit code: leé su salida.** Antes de anunciar
  «encontró X», buscá la marca de que *corrió* (`FTL`, `unable to load`, `error:`). Si no puede
  distinguir arrancar-y-no-encontrar de no-arrancar, el wrapper no puede afirmar ninguna de las dos.
- **Validá las precondiciones antes de invocar.** `[ -f "$CONFIG" ] || fatal "config ausente"` cuesta
  una línea y convierte un diagnóstico falso en uno cierto.
- **Un guard fail-closed todavía puede estar roto.** Que aborte no prueba que haya mirado. La pregunta
  no es «¿frenó?» sino «¿frenó **por lo que dice**?». Ver
  [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]].
- **En un test, la atribución no puede salir del mensaje del sujeto que estás midiendo.** Si mi
  columna hubiera leído la salida de gitleaks en vez del `echo` del wrapper, se cazaba sola.

Relacionado: [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] ·
[[dos-causas-suficientes-el-test-no-atribuye]] ·
[[clasificar-un-hallazgo-por-su-etiqueta-y-no-por-su-codigo]] ·
[[instrumentos-que-confirman-en-vez-de-verificar]]
