---
name: consultar-otro-repo-headless
description: "Cómo comunicarse/consultar al agente de OTRO repositorio desde la sesión actual — canal request→response vía `claude -p` headless con el cwd apuntando al repo target. Usar cuando necesite info/memoria/estado de otro repo o ejecutar algo en su contexto."
metadata: 
  node_type: memory
  type: reference
  originSessionId: db10c758-defe-4aab-b0c5-c9c5091e2c82
---

Para consultar cosas de otro repositorio (o "hablarle" a su agente) sin salir de la sesión actual: lanzar `claude -p` headless vía Bash con el **cwd del repo target**.

```bash
claude -p "tu petición/pregunta" --output-format json   # ejecutado desde / con cwd = el dir del otro repo
```

- **Canal = request→response.** Mando el prompt → esa sesión headless trabaja en ese repo → devuelve su respuesta por **stdout** (texto, o JSON con `--output-format json`). La capturo y sigo orquestando.
- **Contexto que carga la sesión target** (por correr desde su dir): el `CLAUDE.md` de ESE proyecto + el `~/.claude/CLAUDE.md` global + la **auto-memoria de ESE proyecto** (`~/.claude/projects/<slug-del-dir>/memory/`, keyed por el path) + Read/Glob/Grep de sus archivos. → SÍ tiene acceso a la memoria de ese repo.
- **Stateless por default** (one-shot; no recuerda llamadas previas salvo vía memoria/archivos). Multi-turno opcional: `--resume <session-id>` o `-c`. NO ve el contexto de mi sesión salvo lo que le ponga en el prompt.
- **No mensajea a una sesión interactiva VIVA** — spawnea una sesión FRESCA que comparte el estado PERSISTENTE del repo (archivos, CLAUDE.md, memoria), no el contexto en-vuelo de una sesión abierta.
- **Auth:** Max/API donde `claude` esté instalado (PC y VPS lo tienen). Bajo Max el costo es sombra.
- Es el mismo patrón `_claude_headless` que la fábrica usa para el gate_agent / arquitecto.

Útil para: consultar memoria/estado/convenciones de otro repo del workspace, pedirle a un agente scopeado a otro proyecto que ejecute algo en SU contexto, coordinar cross-repo. Tip: pasarle el contexto necesario explícito en el prompt (es stateless).

[[claude-code-headless-capabilities]]
