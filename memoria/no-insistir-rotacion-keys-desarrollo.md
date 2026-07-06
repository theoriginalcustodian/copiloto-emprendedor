---
name: no-insistir-rotacion-keys-desarrollo
description: En desarrollo/pruebas NO proponer ni recordar rotación de keys — es anti-eficiencia; se difiere a producción.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
---

Durante desarrollo/pruebas, NO proponer, recordar ni tratar como pendiente la rotación de API keys. El operador lo indicó **varias veces** (2026-06-30, y antes 2026-06-26): rotar keys en período de pruebas es **anti-eficiencia** — se pegan/reusan libremente y se rota UNA sola vez al pasar a producción, no antes.

**Why:** en dev las keys se usan y reescriben constantemente; agendar rotación por cada una añade fricción sin valor. La deuda YA está gestionada por decisión deliberada del operador: condición de pago = **hito de paso a producción**. Insistir es adulación invertida (celo de proceso), no rigor.

**How to apply:** al usar una key nueva en dev, usala y seguí — como mucho una línea al inventario [[deuda-secretos-rotar]] SIN ceremonia. NO abrir tareas de "rotar X", NO recordarlo al cerrar un sprint, NO tratarlo como bloqueo. Los hooks de secretos/tech-debt NO deben gatillar ceremonia acá: la decisión ya está documentada. La rotación se activa recién en el checklist de producción. Sí mantener lo básico: no commitear la key (gitignore), no pegarla en claro al chat.
