---
name: relevamiento-mapa-pendientes-device-plan-guardado
description: Plan guardado (16-10) para terminar el relevamiento mapa↔app en device: 21 entradas sin medir, usuario del operador, ARCA sin verificar, y falta una vía de diagnóstico por tenant
metadata:
  type: project
---

El operador ordenó (2026-10-16) completar el relevamiento con **prueba empírica de device** de cada pantalla no medida: las 21 NO-VERIFICABLE no eran imposibles, se descartaron por criterio conservador mío. Audio se prueba con `adb input motionevent` (dedo sostenido) sin grabar nada; el operador está disponible en el teléfono; se usa **su** usuario `341lin@gmail.com` (alta por mail, Google vinculado después) y una factura de $100.

**Why:** el plan completo (tabla de las 21 con método y riesgo, receta del device, criterio de terminado) vive en `docs/copiloto-emprendedor/2026-10-16-relevamiento-PENDIENTES-device-plan-para-completarlo.md`. Dos cosas que no se deben perder: (1) **ARCA de 341lin sin verificar** — la memoria del 15/09 decía credencial 0, y la relectura la denegó el clasificador de permisos; (2) el operador pidió una **vía legítima para diagnosticar el estado de un tenant sin entrar a su app** (decisión MAYOR, no resuelta). Error mío corregido: `splash`/`volver`/`reveal` NO están entre las 21 (son veredictos por CÓDIGO).

**How to apply:** al retomar, leer el doc, verificar ARCA por Ajustes→ARCA en el teléfono antes de emitir, cerrar sesión sólo con el usuario del operador (nunca el canónico) y no tocar el contrato de las decisiones 7 y 8: el operador ordenó dejarlo pendiente. Relacionado: [[afip-vacia-en-prod-era-una-consulta-ciega-por-force-rls]] · [[usuario-de-prueba-canonico-uno-solo-a-fuego]] · [[una-orden-cerrada-exige-evidencia-de-device]].
