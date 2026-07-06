---
name: sync-memoria-claude-code
description: "Comando /sync-memoria multi-repo: sincroniza la memoria de Claude Code (projects/<slug>/memory) de CUALQUIER repo entre PC y VPS — auto-detecta el proyecto del cwd + auto-setup, gitdir externo + core.worktree, sin hook."
metadata: 
  node_type: memory
  type: project
  originSessionId: f92509a3-7453-4c09-805d-c8f453a91792
---

**Problema:** la memoria de Claude Code vive en `~/.claude/projects/<slug>/memory/` y el `<slug>` se deriva del PATH del proyecto → **difiere por máquina** (PC `c--Proyectos-…-unreal-copilot` · VPS `-root-workspace-unreal-copilot`). Un git-sync ingenuo no unifica.

**Solución (2026-06-23, validada E2E en unreal-copilot + graphity):** comando **`/sync-memoria`** (NO hook — control explícito por sesión, decisión del operador). **Multi-repo y auto-configurable**: corrés `/sync-memoria` parado en CUALQUIER repo y se configura + sincroniza solo. Un repo de memoria por proyecto: `theoriginalcustodian/claude-memory-<proyecto>` (privado, auto-creado la 1ª vez).

**Mecanismo — gitdir EXTERNO + `core.worktree`** (`~/.claude/memory-sync/<proyecto>.git`):
- gitdir fuera del memory dir; `core.worktree` apunta al memory dir de ESA máquina → el memory dir queda **100% limpio (sin `.git` adentro)**; cada máquina con su slug distinto apunta al mismo repo remoto. Sin symlinks.
- **Auto-detección del proyecto** (en `sync.sh`): `PROJECT` = lowercase(basename del cwd) → nombre de repo/gitdir consistente PC↔VPS. `SLUG` del cwd con el algoritmo de Claude Code = `sed 's/[^a-zA-Z0-9]/-/g'` (verificado empírico: `/root/workspace/unreal-copilot` → `-root-workspace-unreal-copilot`). Match **case-insensitive** contra `~/.claude/projects/` (en Windows el case del drive `C:`/`c:` varía; el FS es case-insensitive). El `core.worktree` del gitdir es la fuente de verdad del memdir una vez configurado.
- **Auto-setup la 1ª vez**: crea el repo remoto (idempotente, `gh repo create --private`) + gitdir + `core.autocrlf=false` + `info/attributes` con `* -text` (**bytes idénticos cross-OS**, sin conversión EOL).
- **Sync bidireccional e idempotente**: `fetch → checkout inicial si máquina nueva → commit local → merge origin/main → push`. Propaga creates/edits/borrados. Conflicto solo si el MISMO archivo se edita en ambas sin sincronizar → reporta para resolución manual.

Archivos: `~/.claude/memory-sync/{sync.sh, setup.sh}` + comando `~/.claude/commands/sync-memoria.md` (en PC y VPS). `setup.sh` queda como override manual (`setup.sh <proj> <memdir> <remote>`); el flujo normal es solo `sync.sh` (auto).

**Uso:** correr `/sync-memoria` al arrancar y al cerrar cada sesión, en cualquier repo (y mid-sesión si querés publicar). **Sin hook**; si el olvido del pull inicial molesta, sumar solo `SessionStart→pull`.

**Verificado E2E (no codificar la esperanza):** unreal-copilot (53 archivos) + graphity (76) → mismo commit en PC y VPS · auto-detección + auto-setup real (corriendo `cd <repo> && sync.sh`) · PC→VPS hash idéntico · borrado bidireccional · idempotencia (2º sync no-op) · memory dir sin `.git` en ambos.

**Gotchas:** (1) los `.sh` escritos en Windows necesitan `sed -i 's/\r$//'` en el VPS (CRLF rompe bash). (2) git no versiona dirs vacíos (`checkpoints/` vacío no se replica; inofensivo). (3) un repo por **basename** de cwd → dos repos con el mismo basename en paths distintos colisionarían (improbable; documentado). (4) en el VPS los repos viven en `/root/workspace/<repo>`; el slug se crea al primer sync si la sesión aún no escribió memoria ahí.

**Extender:** automático — `/sync-memoria` en un repo nuevo lo auto-configura. Parte del cockpit migrado → [[migracion-cockpit-vps-preparada]]. MEMORY.md de unreal-copilot está sobre el límite de tamaño (~46KB vs 24.4KB) — pendiente acortar entradas, no bloquea el sync.
