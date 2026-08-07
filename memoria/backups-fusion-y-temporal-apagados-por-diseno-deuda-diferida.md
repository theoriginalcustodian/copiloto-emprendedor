---
name: backups-fusion-y-temporal-apagados-por-diseno-deuda-diferida
description: fusion y el VPS de Temporal tienen mecanismo de backup off-site (WAL-G + Backblaze B2) implementado pero apagado a propósito — deuda diferida, no gap accidental
metadata:
  type: project
---

**fusion (Postgres de producción) y el VPS de Temporal ya tienen el mecanismo de backup off-site
implementado — WAL-G + destino Backblaze B2 — pero apagado por diseño.** Se enciende cuando el
operador lo pida, no antes.

## Por qué (textual del operador, 2026-08-04)

> "el backup se configurará posteriormente... dejalo como deuda diferida documentada... tanto en
> fusion como en el VPS de temporal los mecanismos ya están implementados y apagados por diseño; en
> el momento que los necesitemos se encenderán... tenemos Backblaze para hacer los backups off-site
> pero apagado por diseño."

## Cómo aplicar

- **No tratar la ausencia de un base-backup reciente en `fusion` como una alarma.** Un `wal-g
  backup-list` con la última corrida de hace semanas, o un cron de base-backup ausente, **no es un
  hallazgo nuevo** — es el estado esperado del diseño actual. Si se necesita evidenciarlo de nuevo,
  citar esta memoria antes de escalar como `urgente_`.
- **El mecanismo vive a nivel infraestructura de los VPS, no en este repo.** No hay nada que grepear
  en `copiloto-emprendedor` para confirmarlo — la fuente de verdad es la palabra del operador, no un
  archivo versionado.
- **Condición de encendido:** orden explícita del operador — `[ASSUMED_PENDING_VERIFY]` que está
  atada a tener clientes reales en prod (razonable, pero no confirmada literal).
- **Propietario cuando se active:** backend — instalar el cron de base-backup + apuntar el destino a
  Backblaze B2 (no a RustFS local, que es lo que hay activo hoy para el archiving continuo).

## Antecedente en esta misma sesión

Diagnostiqué correctamente el estado del disco (WAL-G archivando bien, sin cron de base-backup,
"S3" apuntando al mismo `/dev/sda1`, snapshots Hetzner deshabilitados) pero **clasifiqué mal la
interpretación** — lo posteé como `urgente_` (riesgo de pérdida total) cuando en realidad es una
deuda **deliberada y gestionada**, no invisible. El error no fue de evidencia, fue de no preguntar
antes de escalar: la instrucción de oro dice "el humano decide lo MAYOR" y una decisión de diseño de
infra/costo (Backblaze on/off) es territorio del operador, no algo para inferir solo de lo que se ve
en el disco. Corregido en `coordinacion/cerrado/2026-08-04/...avance_...BETA3-backups-CERRADO...md`.

Ver también [[cero-deuda-no-gestionada]] — esta deuda es exactamente el caso "deliberada + visible"
que la regla permite.
