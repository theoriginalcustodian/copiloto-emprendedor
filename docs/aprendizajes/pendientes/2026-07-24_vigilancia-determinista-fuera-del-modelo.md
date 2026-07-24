---
sprint: IN + mobile-first (hitos 7, 8, 9, C, P)
nivel: 1
dueño: planificación
---
# La vigilancia determinista la hace un modelo caro, turno a turno

**Evidencia:** en 12 h, **465 turnos disparados por cron contra 149 por una persona (76 %)**, y
planificación consumió el **52,6 % de los tokens del sprint sin escribir una línea de producto**.
Medido con `scripts/metricas-sesiones.py`.

**Qué falló:** cada latido despierta al modelo para ejecutar pasos que son deterministas —listar el
buzón, medir antigüedades, comparar contra umbrales. El juicio (¿qué hago con esto?) sí necesita
modelo; la medición no. Y el cron tiene una inversión propia: **no puede interrumpir un turno en
curso**, así que dispara más cuanto menos trabaja la sesión.

**Gancho a construir:** que el cron ejecute **un script** que produzca el reporte y **sólo despierte al
modelo cuando hay alarma**. Sin alarma, no hay turno. `scripts/ultimas-acciones.sh` y
`scripts/no-ocio-check.sh` ya hacen la medición: falta el paso que decide si vale la pena despertar a
alguien.

**DoD binario:**
- Ventana sin alarmas → **cero turnos** de modelo por vigilancia (verificable en el transcript).
- Alarma real → el turno ocurre y trae el reporte del script, no una medición reconstruida.
- **Control negativo:** inyectar una condición de alarma conocida (una sesión sin actividad más allá
  del umbral) → debe despertar. Si no despierta, el ahorro es ceguera.
