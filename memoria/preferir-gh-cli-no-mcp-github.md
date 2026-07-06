---
name: preferir-gh-cli-no-mcp-github
description: "Operaciones GitHub (PR, issues, etc.) con gh CLI, no con el MCP de github"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

Para operaciones de GitHub (crear/ver PRs, issues, reviews, merges) usar **`gh` CLI**, NO el MCP de github (`mcp__github__*`).

**Why:** el operador lo pidió explícito (2026-06-19) — `gh` está instalado en ambos lados: **PC `gh 2.89.0` (autenticado)** + **VPS `unreal-copilot` `gh 2.45.0` (instalado, ⚠️ NO autenticado — `gh auth status` → "not logged into any GitHub hosts"; confirmado empírico 2026-06-20)**. El MCP agrega una capa de credenciales/dependencia innecesaria cuando la CLI nativa ya está lista. **⚠️ El `gh` NO-auth del VPS bloquea: (a) el `open_pr` del FeatureWorkflow (finale de la fábrica — el repo de prueba real `Repositorio-Prueba-Unreal-Coding-Copilot` está creado pero vacío) y (b) ver el `trace`/`cost_by_level`/`resolution_distribution` de SP5 *en vivo* (solo viajan en el return `completed`, que está DESPUÉS de `open_pr`).** Pendiente del operador: `gh auth login` como root en el VPS → destraba ambos a la vez.

**How to apply:** `gh pr create --title ... --body ... --base main` · `gh pr view <n> --json ...` · `gh pr merge` · `gh issue ...`. Para multiline body usar `--body-file` o heredoc. El push sigue con `git push`. Solo caer al MCP de github si `gh` no está disponible en el contexto puntual.
