---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# El trabajo listo que nadie toma no produce ningún error: produce un archivo quieto

**Evidencia:** un `contrato_` de 13 K llevaba **47+ h en `abierto/`** sin que nadie lo tomara, y un
archivo de `en-curso/` llevaba **72+ h** (inventario del buzón, 2026-07-24). El janitor archiva por
edad pero **no escala** por edad. Hallazgo de la auditoría externa, §2 P5.

**Qué falla:** el protocolo detecta silencio de una **sesión**, no abandono de una **tarea**. Un
contrato con su disparador cumplido que nadie movió a `en-curso/` no dispara ninguna alarma: no hay
excepción, no hay error, hay un archivo con `mtime` viejo. Falla en silencio, que es la clase más cara.

**Gancho a construir:** tres reglas en el janitor (**script, no modelo** — el dato ya está gratis en el
`mtime` y la carpeta, porque el estado es la ubicación):
- `contrato_` con disparador cumplido y >2 h sin pasar a `en-curso/` → genera un `urgente_` automático.
- `pedido_` sin su `respuesta_` en >30 min → alarma nombrando a la sesión deudora.
- `en-curso/` sin `avance_` en el umbral declarado por el contrato → alarma al dueño del frente.

**DoD binario:**
- Dejar un `contrato_` con disparador cumplido en `abierto/` y adelantar su `mtime` 3 h → aparece un
  `urgente_` automático nombrando a quién le toca.
- **Control negativo:** un `contrato_` cuyo disparador **NO** está cumplido, con la misma antigüedad →
  **no** genera nada. Escalar lo que legítimamente espera convierte la alarma en ruido de fondo.
