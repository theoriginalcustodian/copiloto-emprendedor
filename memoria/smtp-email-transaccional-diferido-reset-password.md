---
name: smtp-email-transaccional-diferido-reset-password
description: reset password (2.b) y email transaccional (2.c) del sprint BETA quedan diferidos por decisión del operador — mismo patrón que los backups
metadata:
  type: project
---

**BETA-2.b (reset password) y BETA-2.c (email transaccional) quedan diferidos** — decisión del
operador, 2026-08-04: *"deja diferido lo de la config de email... luego lo haremos más adelante
igual que backups"*.

## Estado técnico verificado (no cambia, sólo se pospone la acción)

- GoTrue dedicada (`copiloto-auth`) corre con `GOTRUE_MAILER_AUTOCONFIRM=true` — sin SMTP configurado,
  el alta autoconfirma sin email. Ver `deploy/copiloto/gotrue/docker-compose.gotrue.yml:69`.
- No hay ningún proveedor SMTP decidido ni credenciales en el repo/VPS (grep negativo en `.env*`,
  `requirements.txt`, memoria).
- **Corrección misma sesión:** el operador primero eligió Resend, después pidió dejar el SLOT listo
  para **Gmail SMTP** (cuenta dedicada del copiloto + app-password) en su lugar — ya cableado en
  `deploy/copiloto/gotrue/docker-compose.gotrue.yml` y `.env.gotrue.template`
  (`GOTRUE_SMTP_HOST=smtp.gmail.com:587`, user/pass vacíos). Al retomar: sólo falta crear la cuenta
  Gmail dedicada, generar el app-password en `myaccount.google.com/apppasswords`, cargar
  `GOTRUE_SMTP_USER`/`GOTRUE_SMTP_PASS`/`GOTRUE_SMTP_ADMIN_EMAIL` y flipear
  `GOTRUE_MAILER_AUTOCONFIRM=false`. No hace falta volver a decidir el proveedor.
- El arquetipo `notification_dispatch` que el brief propone reutilizar **no existe vendorizado en
  este repo** (era de la fábrica `unreal-copilot`, no se portó en la graduación) — al retomar, revisar
  primero si conviene portarlo o implementar directo sobre Resend (SDK simple, no justifica el
  arquetipo completo para un solo canal).

## Cómo aplicar

- **No re-investigar el estado de GoTrue/SMTP** — ya está documentado arriba, sigue siendo cierto
  hasta que alguien lo cablee.
- **Propietario cuando se active:** backend.
- **Condición de activación:** orden explícita del operador (mismo patrón que
  [[backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida]] — probablemente atada a tener
  usuarios reales, no confirmado literal).
- **Proveedor ya decidido:** Resend — no volver a preguntar "¿con qué proveedor?" al retomar.

Ver también [[cero-deuda-no-gestionada]] — deliberada + visible, no invisible ni impaga.
