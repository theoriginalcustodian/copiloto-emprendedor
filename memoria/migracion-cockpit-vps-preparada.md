---
name: migracion-cockpit-vps-preparada
description: "Migración del cockpit Claude Code completo (harness+secrets+MCP+SSH flota) de la PC al VPS unreal-copilot — preparada y validada, NO ejecutada aún."
metadata: 
  node_type: memory
  type: project
  originSessionId: f92509a3-7453-4c09-805d-c8f453a91792
---

Objetivo: convertir el VPS `unreal-copilot` en el **cockpit operativo completo** — dirigir desarrollos de la fábrica Y **operar toda la flota** — con cero fricción, replicando fielmente `~/.claude` de la PC. (Hoy el VPS solo corre Claude Code headless para la fábrica; nunca se usó interactivo ahí.)

**Estado (2026-06-23): ✅ EJECUTADA — cockpit E2E 100% funcional en el VPS.** Verificado: harness (23 hooks activos, 19 skills, 26 commands, agents, 16 plugins, doctrina 3/3, hook `.mjs` corre en Linux), settings.json adaptado (paths Linux, 0 permiso PowerShell, sin BOM), **memoria de 11 proyectos**, secrets (23 .env, 600) + 12 claves SSH de flota, **MCP 8/9 Connected** (temporal·github·hetzner·slack·ssh-manager·kaggle·graphity-memory·supabase-hyc; `n8n-hetzner` ✘ = endpoint externo caído), workspace 5 repos + clone `unreal-copilot` (en `/root/workspace/`). **SSH a la flota por RED INTERNA ✅ 4/5** (insight del operador: los VPS se hablan por red privada Hetzner, NO pública — las IPs públicas del config viejo de la PC estaban OBSOLETAS). Mapeo real vía **MCP hetzner** (`list_servers`+`list_networks`): VPS en 2 redes priv (graphiti-net 10.0.0.0/16 + arca-vswitch 10.10.0.0/16). Config interno limpio con aliases legibles en `/root/.ssh/config`: `ssh graphity`(10.0.0.10/graphiti_ed25519)·`ssh fusion`(10.0.0.3)·`ssh arca-temporal`(10.10.0.2)·`ssh arca-supabase`(10.10.0.10) — los 3 últimos con `supabaseselfhosted-prod` (key común; arca_temporal_vps_ed25519 NO era la de arca-temporal). Key descubierta por matching, no adivinada. `arca-enterprise-v010` (antes sin red privada, aislado `arca-only`) **fue agregado a arca-vswitch (IP 10.10.0.11) vía MCP hetzner por decisión explícita del operador** → la NIC se auto-configuró (DHCP Hetzner, sin reboot) → **5/5 nodos accesibles por alias** (`ssh arca-enterprise`→`arca-enterprise-v010`). ⚠️ deuda gestionada: esto rompió el aislamiento de red del nodo fiscal (operador consciente, autorizó; reversible con detach). El attach a infra prod requirió confirmación explícita de params (el auto-mode classifier bloqueó hasta tenerla). graphity-memory + supabase-hyc MCP se buildearon en el VPS (TypeScript, `npm install`+`tsc`) desde su código en el workspace. Scripts idempotentes en `~/.claude/migracion-vps/` (PC); staging con secretos borrado. Backup `/root/claude-backup-*.tar.gz` reversible. Decisión en sesión: `Agencia_IA_HyC` excluida (9.4G, 7.8G datasets de audio) salvo su sub-repo `Temporal` (6.4M).

**Decisiones (operador):** (1) claves SSH de flota AL VPS = opción A, **riesgo aceptado** (firewall Hetzner + passphrase solo-operador) → el VPS = punto único de acceso privilegiado de la flota = deuda de seguridad GESTIONADA/visible. (2) settings.json copia exacta (env con secrets preservado; TODO externalizar). (3) rotar PATs comprometidos = pendiente operador.

**Verificado empíricamente (no codificar la esperanza):** VPS autentica con suscripción **Max** (`.credentials.json`, NO ANTHROPIC_API_KEY) · headless de la fábrica aislado en `/opt/uc-claude-home` → portar a `/root/.claude` NO lo afecta · es **MERGE** (VPS ya tiene 19 skills + CLAUDE.md + 6 patterns), no fresh · hooks `.mjs` corren en node22 Linux (spike PASS) · MCP stdio npx arranca (spike PASS).

**Revisión adversarial cazó 2 errores de los sub-agentes** (el operador advirtió "suelen errar"): ANTHROPIC_API_KEY NO es gap (usa Max) · NO es fresh install (es merge) · sintaxis `claude mcp add` mal (`--scope user` + `-e` ANTES del `--`). Correcciones en `migracion-vps/REVISION.md` — fuente de verdad sobre los reportes crudos.

**Prereqs antes/durante migrar:** build de graphity-mcp (`node dist/index.js`) + binario `supabase-selfhost-mcp` en el VPS · plugins con deps nativas (typescript-lsp/playwright) podrían requerir reinstalar puntual · `arca-skills@arca-local` está disabled → NO se porta.

Accesos del VPS → [[plataforma-agentica-estado]]. Riesgo de keys = deuda gestionada → [[cero-deuda-no-gestionada]].
